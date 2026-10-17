// Small UI toolkit: escaping, sheets, toasts, confirm, keypad, drag-to-reorder, confetti.


export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function haptic() {
  if (navigator.vibrate) navigator.vibrate(8);
}

// ---- Bottom sheet ----

const openSheets = [];
let lockedScrollY = 0;

// Keep sheets sized to the part of the screen not covered by the keyboard.
function trackViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  root.style.setProperty('--vv-h', (vv ? vv.height : innerHeight) + 'px');
  root.style.setProperty('--vv-top', (vv ? vv.offsetTop : 0) + 'px');
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', trackViewport);
  visualViewport.addEventListener('scroll', trackViewport);
}
window.addEventListener('resize', trackViewport);
trackViewport();

function lockPage() {
  lockedScrollY = window.scrollY;
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.classList.add('sheet-open');
}

function unlockPage() {
  document.body.classList.remove('sheet-open');
  document.body.style.top = '';
  window.scrollTo(0, lockedScrollY);
}

export function openSheet(html, { onClose, tall = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true">
      <div class="sheet-grabber"></div>
      <button type="button" class="sheet-x" data-close aria-label="Close">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <div class="sheet-body">${html}</div>
    </div>`;
  if (!document.body.classList.contains('sheet-open')) lockPage();
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('show');
    const i = openSheets.indexOf(close);
    if (i >= 0) openSheets.splice(i, 1);
    setTimeout(() => {
      wrap.remove();
      if (!openSheets.length && !document.querySelector('.sheet-wrap')) unlockPage();
    }, 260);
    onClose && onClose();
  };
  openSheets.push(close);
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { el: wrap.querySelector('.sheet-body'), close };
}

export function closeAllSheets() {
  [...openSheets].forEach((c) => c());
}

// ---- Toast ----

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

// ---- Confirm ----

export function confirmSheet({ title, body = '', confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet(`
      <h2 class="sheet-title">${esc(title)}</h2>
      ${body ? `<p class="muted">${esc(body)}</p>` : ''}
      <div class="stack gap-s mt">
        <button class="btn ${danger ? 'danger' : 'primary'} block" data-yes>${esc(confirm)}</button>
        <button class="btn ghost block" data-close>Cancel</button>
      </div>`, { onClose: () => !answered && resolve(false) });
    s.el.querySelector('[data-yes]').addEventListener('click', () => {
      answered = true;
      s.close();
      resolve(true);
    });
  });
}

// ---- PIN keypad (4 to 8 digits) ----

export const PIN_MIN = 4;
export const PIN_MAX = 8;

export function keypadHTML() {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => `<button type="button" class="key" data-key="${k}">${k}</button>`).join('');
  return `<div class="pin-dots"></div>
    <div class="keypad">${keys}
      <button type="button" class="key key-icon" data-del aria-label="Delete">⌫</button>
      <button type="button" class="key" data-key="0">0</button>
      <button type="button" class="key key-ok" data-ok aria-label="Enter">✓</button>
    </div>`;
}

// Wires a keypad. With `exact`, submits as soon as that many digits are typed;
// otherwise the ✓ key submits once there are at least PIN_MIN digits.
export function bindKeypad(root, onComplete, { exact = 0 } = {}) {
  let pin = '';
  let busy = false;
  const dotsEl = $('.pin-dots', root);
  const okBtn = $('[data-ok]', root);
  const max = exact || PIN_MAX;
  const render = () => {
    const slots = exact || Math.max(PIN_MIN, pin.length);
    dotsEl.innerHTML = Array.from({ length: slots }, (_, i) => `<span class="pin-dot ${i < pin.length ? 'on' : ''}"></span>`).join('');
    okBtn.classList.toggle('ready', pin.length >= (exact || PIN_MIN));
  };
  const api = {
    reset() { pin = ''; busy = false; root.classList.remove('busy'); render(); },
    shake() {
      dotsEl.classList.remove('shake');
      void dotsEl.offsetWidth;
      dotsEl.classList.add('shake');
      setTimeout(() => api.reset(), 450);
    },
    setBusy(b) { busy = b; root.classList.toggle('busy', b); },
  };
  const submit = () => {
    if (busy || pin.length < (exact || PIN_MIN)) return;
    const value = pin;
    busy = true;
    setTimeout(() => { busy = false; onComplete(value, api); }, 120);
  };
  const press = (k) => {
    if (busy) return;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < max) pin += k;
    haptic();
    render();
    if (exact && pin.length === exact) submit();
  };
  root.addEventListener('click', (e) => {
    const k = e.target.closest('[data-key]');
    if (k) return press(k.dataset.key);
    if (e.target.closest('[data-del]')) return press('del');
    if (e.target.closest('[data-ok]')) submit();
  });
  const onKey = (e) => {
    if (!root.isConnected) return document.removeEventListener('keydown', onKey);
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') submit();
  };
  document.addEventListener('keydown', onKey);
  render();
  return api;
}

// Opens a sheet asking for a PIN. Resolves with the PIN or null.
export function askPin(title, subtitle = '', { exact = 0 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const s = openSheet(`
      <h2 class="sheet-title center">${esc(title)}</h2>
      ${subtitle ? `<p class="muted center small">${esc(subtitle)}</p>` : ''}
      <div class="pin-pad">${keypadHTML()}</div>`, { onClose: () => !done && resolve(null) });
    bindKeypad(s.el, (pin) => {
      done = true;
      s.close();
      resolve(pin);
    }, { exact });
  });
}

// ---- Drag to reorder (pointer events, works with touch) ----

export function enableDragReorder(list, onDrop) {
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || !list.contains(handle)) return;
    const item = handle.closest('[data-id]');
    const items = $$(':scope > [data-id]', list);
    const from = items.indexOf(item);
    if (from < 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const rect = item.getBoundingClientRect();
    const gap = items.length > 1 ? Math.abs(items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().bottom) : 0;
    const step = rect.height + gap;
    const mids = items.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    let to = from;
    item.classList.add('dragging');
    list.classList.add('is-dragging');
    haptic();

    const move = (ev) => {
      const dy = ev.clientY - startY;
      item.style.transform = `translateY(${dy}px) scale(1.02)`;
      const cy = rect.top + rect.height / 2 + dy;
      to = 0;
      items.forEach((el, i) => { if (el !== item && mids[i] < cy) to++; });
      items.forEach((el, i) => {
        if (el === item) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -step;
        if (from > to && i >= to && i < from) shift = step;
        el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      items.forEach((el) => { el.style.transform = ''; });
      item.classList.remove('dragging');
      list.classList.remove('is-dragging');
      if (to !== from) {
        haptic();
        onDrop(item.dataset.id, to);
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

// ---- Celebration ----

// Full celebration (confetti + badge), or a small burst at a point with { x, y, small: true }.
export function celebrate(text = 'Done!', { x = innerWidth / 2, y = innerHeight * 0.45, small = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const badge = document.createElement('div');
  badge.className = small ? 'celebrate-pop' : 'celebrate-badge';
  badge.innerHTML = small ? esc(text) : `<div class="celebrate-check">✓</div><div>${esc(text)}</div>`;
  if (small) {
    x = Math.min(Math.max(x, 90), innerWidth - 90);
    badge.style.left = x + 'px';
    badge.style.top = y + 'px';
  }
  document.body.appendChild(badge);
  requestAnimationFrame(() => badge.classList.add('show'));

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = [5, 6, 7, 8, 9, 10, 10].map((n) => css.getPropertyValue('--s' + n).trim() || '#f2d683');
  const power = small ? 0.55 : 1;
  const parts = Array.from({ length: small ? 45 : 140 }, () => ({
    x,
    y,
    vx: (Math.random() - 0.5) * 14 * power,
    vy: (-Math.random() * 15 - 4) * power,
    r: Math.random() * (small ? 4 : 6) + 3,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.45;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t / 1800);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    });
    if (t < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  setTimeout(() => {
    badge.classList.remove('show');
    setTimeout(() => badge.remove(), 400);
  }, 1400);
  if (navigator.vibrate) navigator.vibrate(small ? 12 : [10, 40, 10]);
}
