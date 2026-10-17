import * as vault from './vault.js';
import { state, nav, persist } from './state.js';
import { todayISO, fmtDate } from './model.js';
import { esc, toast, confirmSheet, askPin } from './ui.js';
import { openWeeklySheet, reopenWeekly } from './weekly.js';
import { exportJournal, lastBackup } from './backup.js';
import { THEMES, APPEARANCES, currentTheme, currentAppearance, setTheme, setAppearance, scaleFor, isDark } from './themes.js';

let showAllAttempts = false;

export function renderSettings(view) {
  const real = state.mode === 'real';
  const all = vault.attempts();
  const list = showAllAttempts ? all : all.slice(0, 8);
  const weekAgo = Date.now() - 7 * 86400000;
  const failedWeek = all.filter((a) => !a.ok && a.t > weekAgo).length;
  const bioOn = vault.bioEnrolled();

  view.innerHTML = `
    <header class="page-head"><div><h1>Settings</h1><p class="muted">${real ? 'Your journal is encrypted on this device' : 'Demo mode'}</p></div></header>

    ${showInstallTip() ? installTipHTML() : ''}

    ${!real ? `<section class="card callout">
      ${state.hasVault
        ? `<p>You're looking at demo data. Nothing here is saved. Lock to go back to your own journal.</p><button class="btn primary block" data-lock>Lock</button>`
        : `<p><strong>Ready to start?</strong> Setting a PIN (4 to 8 digits) clears the demo data and starts your own encrypted journal on this device.</p><button class="btn primary block" data-setup>Set your PIN</button>`}
    </section>` : ''}

    ${real ? `<h3 class="section-label">Security</h3>
    <section class="card list-card">
      <button class="row-btn" data-change-pin><span>Change PIN</span><span class="chev">›</span></button>
      <div class="row-btn">
        <span>Unlock with Face ID<span class="muted small block">${bioOn ? 'On. Your PIN still works too.' : 'Off. Optional, on top of your PIN.'}</span></span>
        <label class="switch"><input type="checkbox" data-bio ${bioOn ? 'checked' : ''}><i></i></label>
      </div>
      <button class="row-btn" data-lock><span>Lock now</span><span class="chev">›</span></button>
    </section>
    <p class="hint left">Supplemental locks itself whenever your phone locks or you switch to another app.</p>` : ''}

    <h3 class="section-label">Login attempts</h3>
    <section class="card">
      <p class="small ${failedWeek ? 'warn' : 'muted'}">${failedWeek ? `${failedWeek} failed attempt${failedWeek === 1 ? '' : 's'} in the last 7 days.` : 'No failed attempts in the last 7 days.'}</p>
      ${list.length ? `<ul class="attempts">${list.map((a) => `
        <li><span class="dot ${a.ok ? 'ok' : 'bad'}"></span>
          <span>${a.ok ? 'Success' : 'Failed'} <span class="muted">· ${esc(a.method)}</span></span>
          <time class="muted">${esc(new Date(a.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time></li>`).join('')}</ul>` : '<p class="muted small">No attempts yet.</p>'}
      <div class="row gap-s">
        ${all.length > 8 ? `<button class="link-btn" data-more>${showAllAttempts ? 'Show fewer' : `Show all ${all.length}`}</button>` : ''}
        ${real && all.length ? '<button class="link-btn" data-clear-log>Clear log</button>' : ''}
      </div>
    </section>

    <h3 class="section-label">Backup</h3>
    <section class="card list-card">
      <button class="row-btn" data-export ${real ? '' : 'disabled'}><span>Export journal<span class="muted small block">An encrypted file that opens only with your current PIN.${real && lastBackup(state.data) ? ` Last saved ${esc(fmtDate(lastBackup(state.data), { month: 'short', day: 'numeric', year: 'numeric' }))}.` : ''}</span></span><span class="chev">›</span></button>
      <label class="row-btn ${real ? '' : 'disabled'}"><span>Import journal<span class="muted small block">Replaces what's here. You'll need the backup's PIN.</span></span><span class="chev">›</span>
        <input type="file" accept=".supplemental,.json,application/json" data-import hidden ${real ? '' : 'disabled'}></label>
    </section>
    ${real ? '' : '<p class="hint left">Set your PIN first to export or import.</p>'}

    <h3 class="section-label">Appearance</h3>
    <section class="card">
      <div class="segmented wide" data-appearance>${APPEARANCES.map(([v, l]) => `<button data-v="${v}" class="${currentAppearance() === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="theme-grid">${Object.entries(THEMES).map(([id, t]) => `
        <button class="theme-opt ${currentTheme() === id ? 'on' : ''}" data-theme="${id}">
          <span class="theme-opt-head">${esc(t.name)}${currentTheme() === id ? '<span class="theme-check">✓</span>' : ''}</span>
          <span class="theme-strip">${scaleFor(id, isDark()).map((c, i) => `<i class="${i === 9 ? 'gold' : i === 0 ? 'black' : ''}" style="background:${c}"></i>`).join('')}</span>
          <span class="muted small">${esc(t.blurb)}</span>
        </button>`).join('')}</div>
    </section>

    <h3 class="section-label">Demo</h3>
    <section class="card">
      ${real
        ? `<p class="small">Enter your demo PIN on the lock screen to open a year of sample data instead of your journal. It's always the same length as your real PIN (${vault.pinLength()} digits), so nobody watching can tell which one you typed. Nothing done in the demo is saved.</p>
           <button class="btn block" data-demo-pin>Change demo PIN</button>`
        : `<p class="small">This is a year of sample data. When you set your PIN, the demo PIN starts as all zeros of the same length (for example 0000 for a 4-digit PIN), and you can change it here.</p>`}
    </section>

    <h3 class="section-label">Weekly review</h3>
    <section class="card list-card">
      <button class="row-btn" data-weekly><span>Open this week's review<span class="muted small block">Top 3 issues, top goal, and how they're going</span></span><span class="chev">›</span></button>
      <button class="row-btn" data-weekly-home><span>Show it on Home again</span><span class="chev">›</span></button>
    </section>

    <h3 class="section-label">Help</h3>
    <section class="card list-card">
      <details class="collapse">
        <summary>Add Supplemental to your Home Screen</summary>
        <ol class="steps">
          <li>On iPhone, open this page in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button ${shareIcon()} at the bottom of the screen. On newer iOS, tap <strong>•••</strong> first, then Share.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Keep <strong>Open as Web App</strong> on if you see it, then tap <strong>Add</strong>.</li>
          <li>Open Supplemental from the new icon and set your PIN there.</li>
        </ol>
        <p class="small"><strong>On Android:</strong> open this page in Chrome, tap <strong>⋮</strong>, then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
        <p class="hint left">The Home Screen app keeps its own storage, separate from Safari. Set your PIN and write your entries in the Home Screen app, not in a Safari tab. If you started in Safari, export there and import in the app.</p>
      </details>
      <details class="collapse">
        <summary>How your journal is protected</summary>
        <div class="prose small">
          <p>Everything stays on this phone. There is no server and no account; this page is just the app's code.</p>
          <p>Your entries are encrypted with AES-256-GCM. The key comes from your PIN through Argon2id, a deliberately slow, memory-hungry function, so copied files are useless without the PIN, and each guess is expensive.</p>
          <p>A 4-digit PIN has 10,000 combinations and an 8-digit one has 100 million, so longer really is safer. A PIN stops someone poking at the phone, and the lock screen slows down after 5 wrong tries. A determined attacker who copies the files and has serious computing power could still try every PIN over time, so don't treat this as a vault for anything you couldn't bear to have read.</p>
          <p>Face ID is optional and off by default. When it's on, a passkey protected by Face ID can unlock the journal. If Face ID fails, iPhone can fall back to the phone passcode, so anyone who knows your phone passcode could get in that way. Leave it off if that matters to you.</p>
          <p>Backups are encrypted the same way. Export now and then: if the app is deleted, its data goes with it.</p>
        </div>
      </details>
      <details class="collapse">
        <summary>Why "Supplemental"?</summary>
        <div class="prose small"><p>Every captain's log needs a supplemental entry. This is the one that's just for you.</p></div>
      </details>
    </section>

    ${real ? `<h3 class="section-label">Danger zone</h3>
    <section class="card"><button class="btn danger-ghost block" data-erase>Erase journal from this device</button></section>` : ''}
    <p class="muted small center mt">Supplemental · v1.0</p>`;

  const on = (sel, fn) => view.querySelectorAll(sel).forEach((el) => el.addEventListener('click', fn));
  on('[data-setup]', () => nav.startSetup());
  on('[data-lock]', () => nav.lock());
  on('[data-more]', () => { showAllAttempts = !showAllAttempts; renderSettings(view); });
  on('[data-clear-log]', async () => {
    if (await confirmSheet({ title: 'Clear the login log?', confirm: 'Clear' })) {
      vault.clearAttempts();
      renderSettings(view);
    }
  });
  on('[data-change-pin]', changePin);
  on('[data-export]', async () => { if (await exportJournal()) renderSettings(view); });
  on('[data-erase]', erase);
  on('[data-demo-pin]', changeDemoPin);
  on('[data-weekly]', () => openWeeklySheet());
  on('[data-weekly-home]', () => reopenWeekly());
  on('[data-install-done]', () => {
    try { localStorage.setItem('supplemental:ui:install-tip', 'done'); } catch { /* private mode */ }
    toast('Nice. Enjoy the app');
    renderSettings(view);
  });
  on('[data-install-now]', async () => {
    const prompt = installPrompt;
    installPrompt = null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      try { localStorage.setItem('supplemental:ui:install-tip', 'done'); } catch { /* private mode */ }
    }
    renderSettings(view);
  });
  on('[data-theme]', (e) => { setTheme(e.currentTarget.dataset.theme); renderSettings(view); });
  const ap = view.querySelector('[data-appearance]');
  if (ap) ap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    setAppearance(b.dataset.v);
    renderSettings(view);
  });
  const bio = view.querySelector('[data-bio]');
  if (bio) bio.addEventListener('change', () => toggleBio(bio, view));
  const imp = view.querySelector('[data-import]');
  if (imp) imp.addEventListener('change', () => importJournal(imp, view));
}

// Hidden once marked done, or when already running from the Home Screen.
const isAndroid = /Android/i.test(navigator.userAgent);

// Chrome on Android offers its own install prompt; keep it for the tip's button.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

function installTipHTML() {
  const steps = isAndroid
    ? `<li>Tap <span class="kbd">⋮</span> at the top right in Chrome</li>
          <li>Choose <span class="kbd">Install app</span> or <span class="kbd">Add to Home screen</span></li>
          <li>Open it from the new icon</li>`
    : `<li>Tap <span class="kbd">${shareIcon()} Share</span> in Safari (on newer iOS, tap <span class="kbd">•••</span> first)</li>
          <li>Choose <span class="kbd">Add to Home Screen</span></li>
          <li>Open it from the new icon</li>`;
  return `<section class="card install-tip">
      <img src="icons/apple-touch-icon.png" alt="" class="install-icon" width="64" height="64">
      <div class="install-body">
        <strong>Put Supplemental on your Home Screen</strong>
        <p class="small muted">It opens full screen like a real app, works offline, and keeps your journal in its own private storage.</p>
        ${installPrompt ? '<button class="btn primary block" data-install-now>Install Supplemental</button>' : `<ol class="install-steps small">
          ${steps}
        </ol>`}
        <button class="btn ${installPrompt ? 'ghost' : 'primary'} block" data-install-done>Done, it's on my Home Screen</button>
      </div>
    </section>`;
}

function showInstallTip() {
  const standalone = navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  let done = false;
  try { done = localStorage.getItem('supplemental:ui:install-tip') === 'done'; } catch { /* private mode */ }
  return !standalone && !done;
}

function shareIcon() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
}

async function changeDemoPin() {
  const len = vault.pinLength();
  const pin = await askPin('New demo PIN', `${len} digits, the same length as your real PIN.`, { exact: len });
  if (!pin) return;
  if (await vault.verifyPin(pin)) {
    toast("That's your real PIN. Pick a different one.");
    return;
  }
  await vault.setDemoPin(pin);
  toast('Demo PIN changed');
}

async function changePin() {
  const current = await askPin('Enter your current PIN');
  if (!current) return;
  if (!(await vault.verifyPin(current))) {
    vault.logAttempt(false, 'PIN change');
    toast('That PIN is not right');
    return;
  }
  const next = await nav.askNewPin('Choose a new PIN');
  if (!next) return;
  await vault.changePin(state.session, next);
  vault.logAttempt(true, 'PIN changed');
  if (vault.pinLength() !== next.length || (await vault.isDemoPin(next))) {
    const zeros = '0'.repeat(next.length);
    await vault.setDemoPin(zeros);
    toast(`PIN changed. Demo PIN is now ${zeros}`);
  } else {
    toast('PIN changed');
  }
  nav.refresh();
}

async function toggleBio(input, view) {
  if (!input.checked) {
    vault.disableBio();
    toast('Face ID unlock turned off');
    return renderSettings(view);
  }
  input.checked = false;
  if (!(await vault.bioSupported())) {
    toast('Face ID is not available here');
    return;
  }
  const ok = await confirmSheet({
    title: 'Turn on Face ID unlock?',
    body: 'Your PIN keeps working. Heads up: if Face ID fails, iPhone can offer your phone passcode instead, so anyone who knows your phone passcode could open Supplemental this way.',
    confirm: 'Turn on Face ID',
  });
  if (!ok) return;
  try {
    await vault.enrollBio(state.session);
    toast('Face ID unlock is on');
  } catch (e) {
    console.error(e);
    toast(e.name === 'NotAllowedError' ? 'Face ID setup cancelled' : e.message);
  }
  renderSettings(view);
}

async function importJournal(input, view) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  let record;
  try {
    record = vault.parseBackup(await f.text());
  } catch (e) {
    toast(e.message || 'Could not read that file');
    return;
  }
  const pin = await askPin('Enter the backup\'s PIN', 'The PIN you had when the backup was made.');
  if (!pin) return;
  let data;
  try {
    data = await vault.openBackup(record, pin);
  } catch {
    vault.logAttempt(false, 'Backup PIN');
    toast('Wrong PIN for that backup');
    return;
  }
  const days = Object.keys(data.days || {}).length;
  const ok = await confirmSheet({
    title: 'Replace your journal?',
    body: `The backup${record.exportedAt ? ` from ${fmtDate(new Date(record.exportedAt).toISOString().slice(0, 10))}` : ''} has ${days} days, ${(data.issues || []).length} issues and ${(data.goals || []).length} goals. It will replace everything here. Your current PIN stays the same.`,
    confirm: 'Replace',
    danger: true,
  });
  if (!ok || !state.data) return;
  delete data.demo;
  state.data = data;
  await persist();
  toast('Journal imported');
  renderSettings(view);
}

async function erase() {
  const ok = await confirmSheet({
    title: 'Erase your journal?',
    body: 'Every day, issue and goal on this device will be deleted. This cannot be undone. Export a backup first if you might want it.',
    confirm: 'Erase everything',
    danger: true,
  });
  if (!ok) return;
  const pin = await askPin('Enter your PIN to erase');
  if (!pin || !(await vault.verifyPin(pin))) {
    if (pin) toast('That PIN is not right');
    return;
  }
  vault.eraseEverything();
  location.hash = '#home';
  location.reload();
}
