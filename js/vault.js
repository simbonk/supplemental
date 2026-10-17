// The vault: everything Simon writes lives in one AES-GCM blob in localStorage.
// A random 256-bit data key encrypts the journal; that data key is itself
// encrypted ("wrapped") by a key derived from the PIN, and optionally by a
// Face ID passkey's PRF secret. Nothing readable is stored without the PIN.

import {
  KDF_DEFAULTS, randomBytes, toB64, fromB64, aesKey,
  deriveKeyFromPin, deriveKeyFromSecret, seal, unseal, sealJSON, unsealJSON,
} from './crypto.js';

const KEYS = {
  vault: 'supplemental:vault',
  attempts: 'supplemental:attempts',
  lockout: 'supplemental:lockout',
  demo: 'supplemental:demo',
};

function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function hasVault() {
  return !!readJSON(KEYS.vault, null);
}

function readVault() {
  return readJSON(KEYS.vault, null);
}

// ---- Session (only exists in memory while unlocked) ----

async function sessionFromDek(dek) {
  return { dek, dataKey: await aesKey(dek) };
}

export function wipeSession(session) {
  if (session && session.dek) session.dek.fill(0);
}

// ---- Create / unlock / save ----

async function wrapWithPin(pin, dek) {
  const kdf = { ...KDF_DEFAULTS, salt: toB64(randomBytes(16)) };
  const kek = await deriveKeyFromPin(pin, kdf.salt, kdf);
  return { kdf, wrapped: await seal(kek, dek) };
}

export async function createVault(pin, data) {
  const dek = randomBytes(32);
  const { kdf, wrapped } = await wrapWithPin(pin, dek);
  const session = await sessionFromDek(dek);
  const record = { app: 'supplemental', v: 1, kdf, wrapped, bio: null, data: null };
  record.data = await sealJSON(session.dataKey, data);
  record.updatedAt = Date.now();
  writeJSON(KEYS.vault, record);
  return session;
}

async function openRecordWithPin(record, pin) {
  const kek = await deriveKeyFromPin(pin, record.kdf.salt, record.kdf);
  let dek;
  try {
    dek = await unseal(kek, record.wrapped);
  } catch {
    const err = new Error('Wrong PIN');
    err.code = 'WRONG_PIN';
    throw err;
  }
  const session = await sessionFromDek(dek);
  const data = await unsealJSON(session.dataKey, record.data);
  return { session, data };
}

export async function unlockWithPin(pin) {
  const record = readVault();
  if (!record) throw new Error('No journal on this device');
  return openRecordWithPin(record, pin);
}

export async function save(session, data) {
  const record = readVault();
  record.data = await sealJSON(session.dataKey, data);
  record.updatedAt = Date.now();
  writeJSON(KEYS.vault, record);
}

export async function changePin(session, newPin) {
  const record = readVault();
  const { kdf, wrapped } = await wrapWithPin(newPin, session.dek);
  record.kdf = kdf;
  record.wrapped = wrapped;
  writeJSON(KEYS.vault, record);
}

export async function verifyPin(pin) {
  try {
    const record = readVault();
    const kek = await deriveKeyFromPin(pin, record.kdf.salt, record.kdf);
    await unseal(kek, record.wrapped);
    return true;
  } catch {
    return false;
  }
}

export function eraseEverything() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

// ---- Face ID (WebAuthn passkey + PRF extension) ----

export function bioEnrolled() {
  const r = readVault();
  return !!(r && r.bio);
}

export async function bioSupported() {
  if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function prfSecret(credId, prfSalt) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  const out = assertion.getClientExtensionResults().prf?.results?.first;
  if (!out) {
    const err = new Error('This device did not return a Face ID key. Face ID unlock needs iOS 18 or later.');
    err.code = 'NO_PRF';
    throw err;
  }
  return new Uint8Array(out);
}

export async function enrollBio(session) {
  const prfSalt = randomBytes(32);
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Supplemental', id: location.hostname },
      user: { id: randomBytes(16), name: 'Supplemental', displayName: 'Supplemental journal' },
      challenge: randomBytes(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  const ext = cred.getClientExtensionResults();
  if (ext.prf && ext.prf.enabled === false) {
    const err = new Error('Face ID unlock is not supported on this device. It needs iOS 18 or later.');
    err.code = 'NO_PRF';
    throw err;
  }
  const credId = new Uint8Array(cred.rawId);
  let secret = ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : null;
  if (!secret) secret = await prfSecret(credId, prfSalt);
  const key = await deriveKeyFromSecret(secret, 'supplemental-faceid-v1');
  const record = readVault();
  record.bio = { credId: toB64(credId), prfSalt: toB64(prfSalt), wrapped: await seal(key, session.dek) };
  writeJSON(KEYS.vault, record);
}

export function disableBio() {
  const record = readVault();
  if (!record) return;
  record.bio = null;
  writeJSON(KEYS.vault, record);
}

export async function unlockWithBio() {
  const record = readVault();
  if (!record || !record.bio) throw new Error('Face ID is not set up');
  const secret = await prfSecret(fromB64(record.bio.credId), fromB64(record.bio.prfSalt));
  const key = await deriveKeyFromSecret(secret, 'supplemental-faceid-v1');
  const dek = await unseal(key, record.bio.wrapped);
  const session = await sessionFromDek(dek);
  const data = await unsealJSON(session.dataKey, record.data);
  return { session, data };
}

// ---- Backup files (still encrypted; need the PIN that was set when exported) ----

export function exportBackup() {
  const record = readVault();
  const copy = { ...record, bio: null, exportedAt: Date.now() };
  return JSON.stringify(copy);
}

export function parseBackup(text) {
  const record = JSON.parse(text);
  if (record.app !== 'supplemental' || !record.kdf || !record.wrapped || !record.data) {
    throw new Error('That file is not a Supplemental backup');
  }
  return record;
}

export async function openBackup(record, pin) {
  const { session, data } = await openRecordWithPin(record, pin);
  wipeSession(session);
  return data;
}

// ---- Demo PIN ----
// Opens sample data instead of the journal. It is always the same length as the
// real PIN, so someone watching can't tell the two apart. Stored as a salted hash.

async function demoHash(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
  return toB64(buf);
}

export async function setDemoPin(pin) {
  const salt = toB64(randomBytes(16));
  writeJSON(KEYS.demo, { salt, hash: await demoHash(pin, salt), len: pin.length });
}

export async function isDemoPin(pin) {
  const d = readJSON(KEYS.demo, null);
  if (!d) return false;
  return d.len === pin.length && (await demoHash(pin, d.salt)) === d.hash;
}

export function pinLength() {
  const d = readJSON(KEYS.demo, null);
  return d ? d.len : 0;
}

// ---- Login attempts and lockout (plain text: timestamps only, no journal content) ----

export function attempts() {
  return readJSON(KEYS.attempts, []);
}

export function logAttempt(ok, method) {
  const list = attempts();
  list.unshift({ t: Date.now(), ok, method });
  writeJSON(KEYS.attempts, list.slice(0, 200));
  const lock = readJSON(KEYS.lockout, { fails: 0, until: 0 });
  if (ok) {
    writeJSON(KEYS.lockout, { fails: 0, until: 0 });
  } else if (method !== 'Face ID') {
    lock.fails += 1;
    if (lock.fails >= 5) lock.until = Date.now() + Math.min(30000 * 2 ** (lock.fails - 5), 3600000);
    writeJSON(KEYS.lockout, lock);
  }
}

export function clearAttempts() {
  writeJSON(KEYS.attempts, []);
}

export function lockoutRemaining() {
  const lock = readJSON(KEYS.lockout, { fails: 0, until: 0 });
  return Math.max(0, lock.until - Date.now());
}
