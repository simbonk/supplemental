import * as vault from './vault.js';
import { state, nav, persist } from './state.js';
import { todayISO, fmtDate } from './model.js';
import { esc, toast, confirmSheet, askPin, openSheet } from './ui.js';
import { openWeeklySheet, reopenWeekly } from './weekly.js';
import { startTour } from './tour.js';
import { sanitizeData } from './sanitize.js';
import { exportJournal, lastBackup } from './backup.js';
import { reminderPrefs, WEEKLY_CADENCES, BACKUP_CADENCES, DAILY_TIMES, dailyIcsUrl, dailyHint, isApple, fmtTime } from './reminders.js';
import { THEMES, APPEARANCES, currentTheme, currentAppearance, setTheme, setAppearance, scaleFor, isDark, lightForNow } from './themes.js';

let showAllAttempts = false;
const SETTINGS_TABS = [['general', 'General'], ['reminders', 'Reminders'], ['privacy', 'Privacy'], ['help', 'Help']];
let settingsTab = 'general';

export function renderSettings(view) {
  const real = state.mode === 'real';
  const all = vault.attempts();
  const list = showAllAttempts ? all : all.slice(0, 8);
  const weekAgo = Date.now() - 7 * 86400000;
  const failedWeek = all.filter((a) => !a.ok && a.t > weekAgo).length;
  const bioOn = vault.bioEnrolled();
  const prefs = reminderPrefs(state.data);

  view.innerHTML = `
    <header class="page-head"><div><h1>Settings</h1><p class="muted">${real ? 'Your journal is encrypted on this device' : 'Demo mode'}</p></div></header>

    ${showInstallTip() ? installTipHTML() : ''}

    ${!real ? `<section class="card callout">
      ${state.hasVault
        ? `<p>You're looking at demo data. Nothing here is saved. Lock to go back to your own journal.</p><button class="btn primary block" data-lock>Lock</button>`
        : `<p><strong>Ready to start?</strong> Setting a PIN (4 to 8 digits) clears the demo data and starts your own encrypted journal on this device.</p><button class="btn primary block" data-setup>Set your PIN</button>`}
    </section>` : ''}

    <div class="segmented wide set-tabs" data-settab>${SETTINGS_TABS.map(([v, l]) => `<button data-v="${v}" class="${settingsTab === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="set-pane" data-pane="general" ${settingsTab === 'general' ? '' : 'hidden'}>
    <h3 class="section-label">Backup</h3>
    <section class="card list-card">
      <button class="row-btn" data-export ${real ? '' : 'disabled'}><span>Export journal<span class="muted small block">An encrypted file, protected by a passphrase or your PIN.${real && lastBackup(state.data) ? ` Last saved ${esc(fmtDate(lastBackup(state.data), { month: 'short', day: 'numeric', year: 'numeric' }))}.` : ''}</span></span><span class="chev">›</span></button>
      <label class="row-btn ${real ? '' : 'disabled'}"><span>Import journal<span class="muted small block">Replaces what's here. You'll need the backup's passphrase or PIN.</span></span><span class="chev">›</span>
        <input type="file" accept=".supplemental,.json,application/json" data-import hidden ${real ? '' : 'disabled'}></label>
    </section>
    ${real ? '' : '<p class="hint left">Set your PIN first to export or import.</p>'}

    <h3 class="section-label">Appearance</h3>
    <section class="card">
      <div class="segmented wide" data-appearance>${APPEARANCES.map(([v, l]) => `<button data-v="${v}" class="${currentAppearance() === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${lightForNow() ? `<p class="hint left">${state.mode === 'demo' ? 'The demo stays light. Your journal follows your phone after its first day.' : 'Staying light for your first day. After that, System follows your phone.'} Pick Dark to switch now.</p>` : ''}
      <div class="theme-grid">${Object.entries(THEMES).map(([id, t]) => `
        <button class="theme-opt ${currentTheme() === id ? 'on' : ''}" data-theme="${id}">
          <span class="theme-opt-head">${esc(t.name)}${currentTheme() === id ? '<span class="theme-check">✓</span>' : ''}</span>
          <span class="theme-strip">${scaleFor(id, isDark()).map((c, i) => `<i class="${i === 9 ? 'gold' : i === 0 ? 'black' : ''}" style="background:${c}"></i>`).join('')}</span>
          <span class="muted small">${esc(t.blurb)}</span>
        </button>`).join('')}</div>
    </section>

    </div>
    <div class="set-pane" data-pane="reminders" ${settingsTab === 'reminders' ? '' : 'hidden'}>
    <section class="card reminders">
      <div class="rem-block">
        <strong>Daily check-in</strong>
        <p class="muted small">${dailyHint()}</p>
        <div class="rem-daily">
          <select data-daily-time aria-label="Reminder time">${DAILY_TIMES.map((t) => `<option value="${t}" ${t === prefs.dailyAt ? 'selected' : ''}>${esc(fmtTime(t))}</option>`).join('')}</select>
          <a class="btn primary" data-daily-add href="${esc(dailyIcsUrl(prefs.dailyAt))}" ${isApple ? '' : 'target="_blank" rel="noopener"'}>Add to Calendar</a>
        </div>
      </div>
      <div class="rem-block">
        <strong>Weekly review</strong>
        <p class="muted small">Top 3 issues and top goal, on Home at the start of the week.</p>
        <div class="segmented wide" data-cadence="weekly">${WEEKLY_CADENCES.map(([v, l]) => `<button data-v="${v}" class="${prefs.weekly === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="list-card flush">
          <button class="row-btn" data-weekly><span>Open this week's review</span><span class="chev">›</span></button>
          <button class="row-btn" data-weekly-home><span>Show it on Home this week</span><span class="chev">›</span></button>
        </div>
      </div>
      <div class="rem-block">
        <strong>Backup reminder</strong>
        <p class="muted small">How long after your last backup to nudge you on Home.</p>
        <div class="segmented wide" data-cadence="backup">${BACKUP_CADENCES.map(([v, l]) => `<button data-v="${v}" class="${prefs.backup === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
    </section>

    </div>
    <div class="set-pane" data-pane="privacy" ${settingsTab === 'privacy' ? '' : 'hidden'}>
    <section class="card privacy-note">
      <div class="privacy-note-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
      <div>
        <strong>Private by design</strong>
        <p class="small muted">Your journal never leaves this phone. There's no account and no tracking. The site only counts anonymous visits, without cookies, and never sees what you write. Everything is encrypted with your PIN before it's saved, so even someone who copied the app's files couldn't read them. Backups you export are encrypted the same way.</p>
      </div>
    </section>
    ${real ? storageHTML() : ''}
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

    <h3 class="section-label">Demo PIN</h3>
    <section class="card">
      ${real
        ? `<p class="small">Enter your demo PIN on the lock screen to open a year of sample data instead of your journal. It's always the same length as your real PIN (${vault.pinLength()} digits), so nobody watching can tell which one you typed. Nothing done in the demo is saved.</p>
           <button class="btn block" data-demo-pin>Change demo PIN</button>`
        : `<p class="small">This is a year of sample data. When you set your PIN, the demo PIN starts as all zeros of the same length (for example 0000 for a 4-digit PIN), and you can change it here.</p>`}
    </section>

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

    ${real ? `<h3 class="section-label">Danger zone</h3>
    <section class="card"><button class="btn danger-ghost block" data-erase>Erase journal from this device</button></section>` : ''}
    </div>
    <div class="set-pane" data-pane="help" ${settingsTab === 'help' ? '' : 'hidden'}>
    <h3 class="section-label">Help</h3>
    <section class="card list-card">
      <details class="collapse">
        <summary>Add Supplemental to your Home Screen</summary>
        <ol class="steps">
          <li>On iPhone, open this page in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button ${shareIcon()} at the bottom of the screen. On newer iOS, tap the menu button ${menuIcon()} to the left of the address first, then Share.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Keep <strong>Open as Web App</strong> on if you see it, then tap <strong>Add</strong>.</li>
          <li>Open Supplemental from the new icon and set your PIN there.</li>
        </ol>
        <p class="small"><strong>On Android:</strong> open this page in Chrome, tap <strong>⋮</strong>, then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
        <p class="hint left">The Home Screen app keeps its own storage, separate from Safari. Set your PIN and write your entries in the Home Screen app, not in a Safari tab. If you started in Safari, export there and import in the app.</p>
      </details>
      <details class="collapse">
        <summary>How your journal is protected, and its limits</summary>
        <div class="prose small">
          <p><strong>What the app does</strong></p>
          <ul>
            <li>Everything stays on this phone. There's no account and no server. The website only delivers the app's code and counts anonymous visits; your entries never go to it.</li>
            <li>Entries are encrypted with AES-256-GCM before they're saved. The key comes from your PIN through Argon2id, a deliberately slow, memory-hungry function (64 MB and about half a second per guess).</li>
            <li>The lock screen slows down after 5 wrong tries, and every attempt is logged under Privacy.</li>
            <li>It locks itself whenever your phone locks or you switch apps.</li>
            <li>A demo PIN opens sample data instead, so you're never forced to open the real thing in front of someone.</li>
            <li>Backups can have their own passphrase, protected with an even slower setting.</li>
          </ul>
          <p><strong>Where it's weaker</strong></p>
          <ul>
            <li><strong>Short PINs can be guessed offline.</strong> The lock-screen delays only protect the app itself. Someone who copies the encrypted data can try every PIN on their own computer: a 6-digit PIN in hours on a laptop and well under an hour on a gaming graphics card. An 8-digit PIN takes about 100 times longer.</li>
            <li><strong>Your phone passcode is the front door.</strong> Copying the data needs your unlocked phone and a computer. Keep your phone passcode private and different from your Supplemental PIN.</li>
            <li><strong>Backup files travel.</strong> A backup protected only by your PIN has the same weakness, but anywhere the file ends up. A passphrase fixes this.</li>
            <li><strong>Face ID can fall back to your phone passcode,</strong> so anyone who knows it could unlock the journal that way. Leave Face ID off if that matters.</li>
            <li><strong>The app's code comes from the website.</strong> Someone who took over the accounts that publish it could ship a version that records your PIN.</li>
            <li><strong>The demo PIN is stored with a fast hash,</strong> so it can be recovered easily. It only reveals the demo PIN and its length, never your journal.</li>
          </ul>
          <p>For keeping a private journal private from people around you, this is strong. Against a determined attacker with your phone passcode and serious computing power, a PIN slows them down but won't stop them.</p>
        </div>
      </details>
      <details class="collapse">
        <summary>Why Supplemental works the way it does</summary>
        <div class="prose small">
          <p>Supplemental is a supplement, not a substitute. It won't have the hard conversation for you, but it helps you walk into one clear-headed, with specifics instead of a vague bad mood.</p>
          <p><strong>Why each piece is there</strong></p>
          <ul>
            <li><strong>One number a day.</strong> Memory is unreliable: one bad week can color how a whole year feels, and slow slides go unnoticed. A daily score takes five seconds, and after a few months the heat map shows the real pattern, good stretches included.</li>
            <li><strong>One line about the day.</strong> Putting a feeling into words tends to take some of the heat out of it. A sentence is enough, and later it reminds you what was behind the number.</li>
            <li><strong>Issues ranked like bugs.</strong> You can't fix everything at once, and trying to usually means fixing nothing. Ranking makes you choose what matters most right now. The age shows what has been quietly sitting there for months.</li>
            <li><strong>Feeling and intensity.</strong> "Annoyed, 3/10" and "Hurt, 8/10" need very different conversations. Naming both helps you pick the right moment and the right words.</li>
            <li><strong>Solvable or ongoing.</strong> Relationship research suggests most recurring disagreements are about lasting differences in personality or needs, not problems with a fix. Those go better when you understand each other than when you try to win. Marking which kind an issue is changes how you approach it.</li>
            <li><strong>"Have we talked about it?"</strong> An issue you haven't raised yet is easy to resent and impossible to resolve. This keeps you honest about which ones are still only in your head.</li>
            <li><strong>Goals and the board.</strong> So it's not only about what's wrong. Things you're building toward deserve the same attention, and moving a card along is a small, real win.</li>
            <li><strong>The weekly review.</strong> Small, regular check-ins keep problems small. A few minutes a week beats a blowup every few months.</li>
            <li><strong>Private by design.</strong> You can only be honest in a journal nobody else will read. That's why there's a PIN, a demo PIN for curious eyes, and nothing ever leaves this phone.</li>
          </ul>
          <p><strong>Getting the most from it</strong></p>
          <ul>
            <li>Log every day, even the boring ones. The 6s and 7s are what make the 2s and 9s mean something.</li>
            <li>Keep the issues list short and honest. Five real issues are better than twenty half-ones.</li>
            <li>Before a hard talk, look at the issue's age, feeling and notes. Start with how it has felt, not what they did.</li>
            <li>Mark things resolved when they are. Looking back at what you've gotten through is part of the point.</li>
            <li>If you're working with a counselor, a few weeks of entries make a great starting point for a session.</li>
          </ul>
        </div>
      </details>
    </section>

    <h3 class="section-label">Open source</h3>
    <section class="card list-card">
      <p class="small muted pad-note">Supplemental is free and open source. Anyone can read the code, and ideas and bug reports are welcome on GitHub. Issues are public, so never include journal entries, your PIN or a backup.</p>
      <a class="row-btn" href="https://github.com/simbonk/supplemental/issues/new?template=bug_report.yml" target="_blank" rel="noopener"><span>Report a bug</span><span class="chev">›</span></a>
      <a class="row-btn" href="https://github.com/simbonk/supplemental/issues/new?template=feature_request.yml" target="_blank" rel="noopener"><span>Suggest a feature</span><span class="chev">›</span></a>
      <a class="row-btn" href="https://github.com/simbonk/supplemental" target="_blank" rel="noopener"><span>See the code<span class="muted small block">github.com/simbonk/supplemental</span></span><span class="chev">›</span></a>
    </section>

    <button class="btn ghost block mt" data-tour>Show the walkthrough again</button>
    <p class="muted small center mt">Supplemental · v1.0</p>    </div>
`;

  view.querySelector('[data-settab]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    settingsTab = b.dataset.v;
    view.querySelectorAll('[data-settab] [data-v]').forEach((x) => x.classList.toggle('on', x === b));
    view.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== settingsTab; });
  });
  const on = (sel, fn) => view.querySelectorAll(sel).forEach((el) => el.addEventListener('click', fn));
  on('[data-setup]', () => nav.startSetup());
  on('[data-tour]', () => startTour());
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
  view.querySelector('[data-daily-time]')?.addEventListener('change', async (e) => {
    state.data.reminders = { ...reminderPrefs(state.data), dailyAt: e.target.value };
    view.querySelector('[data-daily-add]').href = dailyIcsUrl(e.target.value);
    await persist();
  });
  view.querySelectorAll('[data-cadence]').forEach((seg) => seg.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    state.data.reminders = { ...reminderPrefs(state.data), [seg.dataset.cadence]: b.dataset.v };
    seg.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
    await persist();
  }));
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
// Safari allows about 5 MB per site, counted as 2 bytes per character.
const STORAGE_BUDGET = 2.5e6;

function storageHTML() {
  let used = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('supplemental')) used += k.length + (localStorage.getItem(k) || '').length;
    }
  } catch { /* storage unavailable */ }
  const days = Object.keys(state.data.days).length;
  // Until there's a couple of weeks of history, assume about 600 characters a day (a typical encrypted entry).
  const perDay = days >= 14 ? used / days : 600;
  const yearsLeft = Math.max(0, (STORAGE_BUDGET - used) / perDay / 365);
  const pct = Math.min(100, (used / STORAGE_BUDGET) * 100);
  return `<h3 class="section-label">Storage</h3>
    <section class="card storage">
      <div class="storage-bar"><i style="width:${Math.max(pct, 1).toFixed(1)}%"></i></div>
      <p class="small"><strong>${pct < 1 ? 'Less than 1%' : `${Math.round(pct)}%`} used</strong> · about ${yearsLeft >= 20 ? '20+' : Math.floor(yearsLeft)} years of daily entries left</p>
      <p class="small muted">${(used / 1000).toFixed(0)} KB of roughly 5 MB this phone gives the app. Long notes use it faster.</p>
    </section>`;
}

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
    : `<li>Tap <span class="kbd">${shareIcon()} Share</span> in Safari (on newer iOS, tap <span class="kbd">${menuIcon()}</span> left of the address first)</li>
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

// Safari's page menu button on newer iOS: three lines, each shorter than the last.
function menuIcon() {
  return '<svg class="menu-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-label="menu"><path d="M4 7h16M4 12h12M4 17h8"/></svg>';
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

function askPassphrase() {
  return new Promise((resolve) => {
    let done = false;
    const s = openSheet(`
      <h2 class="sheet-title">Enter the backup's passphrase</h2>
      <p class="muted small">The passphrase you chose when you made this backup.</p>
      <label class="field"><input type="text" data-pass autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <div class="stack gap-s mt"><button class="btn primary block" data-open>Open backup</button></div>`, { onClose: () => !done && resolve(null) });
    const input = s.el.querySelector('[data-pass]');
    const go = () => {
      if (!input.value.trim()) return;
      done = true;
      s.close();
      resolve(input.value.trim());
    };
    s.el.querySelector('[data-open]').addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    setTimeout(() => input.focus(), 300);
  });
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
  const usesPass = vault.backupUsesPassphrase(record);
  const secret = usesPass
    ? await askPassphrase()
    : await askPin('Enter the backup\'s PIN', 'This backup uses the PIN you had when it was made.');
  if (!secret) return;
  let data;
  toast('Opening backup…');
  try {
    data = await vault.openBackup(record, secret);
  } catch {
    vault.logAttempt(false, usesPass ? 'Backup passphrase' : 'Backup PIN');
    toast(usesPass ? 'Wrong passphrase for that backup' : 'Wrong PIN for that backup');
    return;
  }
  try {
    data = sanitizeData(data);
  } catch (e) {
    toast(e.message);
    return;
  }
  const days = Object.keys(data.days).length;
  const ok = await confirmSheet({
    title: 'Replace your journal?',
    body: `The backup${Number.isFinite(record.exportedAt) ? ` from ${fmtDate(new Date(record.exportedAt).toISOString().slice(0, 10))}` : ''} has ${days} days, ${data.issues.length} issues and ${data.goals.length} goals. It will replace everything here. Your current PIN stays the same.`,
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
    typeToConfirm: 'delete everything',
  });
  if (!ok) return;
  const pin = await askPin('Enter your PIN to erase');
  if (!pin || !(await vault.verifyPin(pin))) {
    if (pin) toast('That PIN is not right');
    return;
  }
  vault.eraseEverything();
  nav.go('home');
  location.reload();
}
