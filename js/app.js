import * as vault from './vault.js';
import { state, nav } from './state.js';
import { makeDemoData } from './demo.js';
import { emptyData } from './model.js';
import { $, esc, keypadHTML, bindKeypad, openSheet, closeAllSheets, confirmSheet, toast, askPin } from './ui.js';
import { renderHome } from './home.js';
import { renderNewDay } from './day.js';
import { renderItems } from './items.js';
import { renderSettings } from './settings.js';
import { renderReview, leaveReview } from './review.js';
import { shouldTour, startTour } from './tour.js';
import { applyTheme, setKeepLight, inFirstDay } from './themes.js';

const app = $('#app');

const TABS = [
  ['home', 'Home', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'],
  ['issues', 'Issues', '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'],
  ['new', 'New day', ''],
  ['goals', 'Goals', '<path d="M12 3c-3 4-6 6.5-6 10.5a6 6 0 0 0 12 0C18 9.5 15 7 12 3z"/><path d="M12 21v-6"/>'],
  ['settings', 'Settings', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'],
];

const ICON_SVG = `<svg viewBox="0 0 64 64" class="logo" aria-hidden="true">${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => {
  const n = r + c === 6 ? 10 : r + c + 3;
  return `<rect x="${4 + c * 15}" y="${4 + r * 15}" width="12" height="12" rx="3.5" style="fill:var(--s${n})"/>`;
}).join('')).join('')}</svg>`;

// ---------- Lock screen ----------

function showLock(message = '') {
  setKeepLight(inFirstDay());
  closeAllSheets();
  document.body.classList.remove('privacy');
  const bio = vault.bioEnrolled();
  app.innerHTML = `
    <div class="lock">
      <div class="lock-head">
        ${ICON_SVG}
        <h1>Supplemental</h1>
        <p class="muted lock-msg">${esc(message || 'Enter your PIN')}</p>
      </div>
      <div class="pin-pad">${keypadHTML()}</div>
      <div class="lock-links">
        ${bio ? `<button class="link-btn faceid" data-faceid>${faceIdIcon()} Use Face ID</button>` : ''}
        <button class="link-btn muted-link" data-forgot>Forgot PIN?</button>
      </div>
    </div>`;
  const msg = $('.lock-msg', app);
  const pad = bindKeypad($('.pin-pad', app), async (pin, api) => {
    if (await vault.isDemoPin(pin)) {
      vault.logAttempt(true, 'Demo PIN');
      return enterDemo();
    }
    const wait = vault.lockoutRemaining();
    if (wait) {
      msg.textContent = `Too many tries. Wait ${Math.ceil(wait / 1000)}s.`;
      return api.shake();
    }
    api.setBusy(true);
    msg.textContent = 'Unlocking…';
    try {
      const { session, data } = await vault.unlockWithPin(pin);
      vault.logAttempt(true, 'PIN');
      if (!vault.pinLength()) await vault.setDemoPin('0'.repeat(pin.length));
      enterReal(session, data);
    } catch (e) {
      api.setBusy(false);
      if (e.code !== 'WRONG_PIN') {
        console.error(e);
        msg.textContent = 'Could not open the journal: ' + e.message;
        return api.reset();
      }
      vault.logAttempt(false, 'PIN');
      const w = vault.lockoutRemaining();
      msg.textContent = w ? `Wrong PIN. Wait ${Math.ceil(w / 1000)}s.` : 'Wrong PIN. Try again.';
      api.shake();
    }
  });
  const faceBtn = $('[data-faceid]', app);
  if (faceBtn) faceBtn.addEventListener('click', () => faceUnlock(msg, pad));
  $('[data-forgot]', app).addEventListener('click', forgotPin);
}

async function faceUnlock(msg, pad) {
  try {
    pad.setBusy(true);
    msg.textContent = 'Unlocking…';
    const { session, data } = await vault.unlockWithBio();
    vault.logAttempt(true, 'Face ID');
    enterReal(session, data);
  } catch (e) {
    pad.setBusy(false);
    if (e.name !== 'NotAllowedError') vault.logAttempt(false, 'Face ID');
    msg.textContent = e.name === 'NotAllowedError' ? 'Face ID cancelled. Enter your PIN.' : e.message;
  }
}

function faceIdIcon() {
  return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/>
    <path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1.2 3.6 1.2 5 0"/></svg>`;
}

function forgotPin() {
  const s = openSheet(`
    <h2 class="sheet-title">Forgot your PIN?</h2>
    <p class="muted">Your journal is encrypted with your PIN and nobody, including the app, can unlock it without it. That's the point, but it means there is no reset.</p>
    <p class="muted">If you have Face ID set up, use that, then change your PIN in Settings. If you have a backup file and remember the PIN you used then, you can start fresh and import it.</p>
    <div class="stack gap-s mt">
      <button class="btn danger block" data-erase>Erase journal and start over</button>
      <button class="btn ghost block" data-close>Cancel</button>
    </div>`);
  s.el.querySelector('[data-erase]').addEventListener('click', async () => {
    s.close();
    const ok = await confirmSheet({ title: 'Erase everything?', body: 'Every day, issue and goal on this device will be gone for good.', confirm: 'Erase everything', danger: true, typeToConfirm: 'delete everything' });
    if (!ok) return;
    vault.eraseEverything();
    state.hasVault = false;
    enterDemo();
  });
}

// ---------- Modes ----------

function enterDemo() {
  setKeepLight(true);
  state.mode = 'demo';
  state.session = null;
  state.data = makeDemoData();
  showShell();
}

function enterReal(session, data) {
  setKeepLight(inFirstDay());
  state.mode = 'real';
  state.session = session;
  state.data = data;
  state.hasVault = true;
  showShell();
}

export function lock() {
  if (!state.hasVault) return; // nothing to protect yet
  if (!state.mode) return;
  vault.wipeSession(state.session);
  state.session = null;
  state.data = null;
  state.mode = null;
  showLock();
}

export async function startSetup() {
  const pin = await askNewPin();
  if (!pin) return;
  const zeros = '0'.repeat(pin.length);
  const ok = await confirmSheet({
    title: 'Start your journal?',
    body: `The demo data will be cleared and your journal will be encrypted with this PIN. There is no way to recover it if you forget the PIN. Your demo PIN is now ${zeros}; you can change it in Settings.`,
    confirm: 'Start my journal',
  });
  if (!ok) return;
  toast('Encrypting…');
  const data = emptyData();
  const session = await vault.createVault(pin, data);
  await vault.setDemoPin(zeros);
  vault.logAttempt(true, 'PIN set');
  enterReal(session, data);
  nav.go('home');
  toast('Your journal is ready');
}

function tooEasy(pin) {
  return /^(\d)\1+$/.test(pin) || '01234567890'.includes(pin) || '98765432109'.includes(pin);
}

// Ask for a new PIN twice. Returns the PIN or null.
export async function askNewPin(title = 'Choose a PIN') {
  const first = await askPin(title, '4 to 8 digits, then tap ✓. Longer is safer. Use something different from your iPhone passcode.');
  if (!first) return null;
  if (tooEasy(first)) {
    toast('Too easy to guess. Pick another.');
    return null;
  }
  const second = await askPin('Enter it again', '', { exact: first.length });
  if (second !== first) {
    if (second) toast("PINs didn't match");
    return null;
  }
  return first;
}

// ---------- Shell & routing ----------

function showShell() {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        ${state.mode === 'demo' ? `<div class="demo-banner">
          <span>${state.hasVault ? 'Demo data. Changes are not saved.' : 'You are looking at demo data.'}</span>
          <button class="chip-btn" data-demo-action>${state.hasVault ? 'Lock' : 'Set your PIN'}</button>
        </div>` : ''}
        <div class="app-head"><a href="#home" class="wordmark">Supplemental</a><span class="app-tagline">Private journal</span></div>
      </header>
      <main id="view" class="view"></main>
      <nav class="tabbar">
        ${TABS.map(([id, label, path]) => id === 'new'
          ? `<a href="#new" class="tab tab-new" data-tab="new" aria-label="${label}"><span class="plus">+</span></a>`
          : `<a href="#${id}" class="tab" data-tab="${id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg><span>${label}</span></a>`).join('')}
      </nav>
    </div>`;
  const demoBtn = $('[data-demo-action]', app);
  if (demoBtn) demoBtn.addEventListener('click', () => (state.hasVault ? lock() : startSetup()));
  bindTabbar($('.tabbar', app));
  // Always open on Home, not wherever the app was when it last locked.
  history.replaceState(null, '', '#home');
  route();
}

// iOS swallows the first tap while the page is still coasting from a scroll,
// so tabs switch on touchend rather than waiting for a click that never comes.
function bindTabbar(bar) {
  let start = null;
  bar.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, tab: e.target.closest('.tab') };
  }, { passive: true });
  bar.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const tab = start?.tab;
    const moved = start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 12;
    start = null;
    if (!tab || moved || e.target.closest('.tab') !== tab) return;
    e.preventDefault(); // no follow-up click, so it doesn't fire twice
    nav.go(tab.dataset.tab);
  });
  bar.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    e.preventDefault();
    nav.go(tab.dataset.tab);
  });
}

function route() {
  if (!state.mode) return;
  const view = $('#view');
  if (!view) return;
  const [name, arg] = (location.hash.slice(1) || 'home').split('/');
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === (name === 'review' ? 'home' : name)));
  view.scrollTop = 0;
  window.scrollTo(0, 0);
  if (name !== 'review') leaveReview();
  if (name === 'review') renderReview(view, arg);
  else if (name === 'new') renderNewDay(view, arg);
  else if (name === 'issues') renderItems(view, 'issues');
  else if (name === 'goals') renderItems(view, 'goals');
  else if (name === 'settings') renderSettings(view);
  else renderHome(view);
}

// Switch screens without adding history entries, so iOS's edge swipe-back
// has nothing to go back to (it used to fire mid-drag on the board).
nav.go = (hash) => {
  if (location.hash !== '#' + hash) history.replaceState(null, '', '#' + hash);
  route();
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  e.preventDefault();
  nav.go(a.getAttribute('href').slice(1));
});
nav.refresh = route;
nav.lock = lock;
nav.startSetup = startSetup;
nav.askNewPin = askNewPin;

window.addEventListener('hashchange', route);

// ---------- Auto-lock: whenever the phone locks or the app goes to the background ----------

// Cover the screen first and synchronously, so the app switcher snapshot
// has the best chance of catching the cover rather than the journal.
const cover = () => { document.body.classList.add('privacy'); void document.body.offsetHeight; };
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    cover();
    lock();
  } else {
    document.body.classList.remove('privacy');
  }
});
window.addEventListener('pagehide', () => { cover(); lock(); });
document.addEventListener('freeze', () => { cover(); lock(); });
window.addEventListener('blur', () => {
  if (state.hasVault && state.mode && !state.sharing) document.body.classList.add('privacy');
});
window.addEventListener('focus', () => document.body.classList.remove('privacy'));

// ---------- Boot ----------

function boot() {
  applyTheme();
  state.hasVault = vault.hasVault();
  if (state.hasVault) showLock();
  else {
    enterDemo();
    if (shouldTour()) setTimeout(startTour, 400);
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
