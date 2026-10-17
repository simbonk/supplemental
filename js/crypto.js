// Encryption primitives. Argon2id (memory-hard, via vendored hash-wasm) turns the
// PIN into a key-encryption key; AES-GCM does all the actual encryption.

const te = new TextEncoder();
const td = new TextDecoder();

export const KDF_DEFAULTS = { alg: 'argon2id', m: 65536, t: 3, p: 1 }; // 64 MiB, 3 passes

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function aesKey(raw, usages = ['encrypt', 'decrypt']) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, usages);
}

export async function deriveKeyFromPin(pin, saltB64, params) {
  if (params.alg !== 'argon2id') throw new Error('Unknown key derivation: ' + params.alg);
  const raw = await window.hashwasm.argon2id({
    password: pin,
    salt: fromB64(saltB64),
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: 32,
    outputType: 'binary',
  });
  return aesKey(raw);
}

// Turns a WebAuthn PRF output into an AES key.
export async function deriveKeyFromSecret(secret, info) {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(key, bytes) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function unseal(key, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
  return new Uint8Array(pt);
}

export const sealJSON = (key, obj) => seal(key, te.encode(JSON.stringify(obj)));
export const unsealJSON = async (key, box) => JSON.parse(td.decode(await unseal(key, box)));
