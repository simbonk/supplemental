// Small UI toolkit: escaping, sheets, toasts, confirm, keypad, drag-to-reorder, confetti.

import { SCORE_COLORS } from './model.js';

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

export function openSheet(html, { onClose, tall = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true">
      <div class="sheet-grabber"></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('sheet-open');
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
      if (!openSheets.length) document.body.classList.remove('sheet-open');
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

// ---- PIN keypad ----

export function keypadHTML(length, { extraKey = '' } = {}) {
  const dots = Array.from({ length }, () => '<span class="pin-dot"></span>').join('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => `<button class="key" data-key="${k}">${k}</button>`).join('');
  return `<div class="pin-dots">${dots}</div>
    <div class="keypad">${keys}
      <div class="key-slot">${extraKey}</div>
      <button class="key" data-key="0">0</button>
      <button class="key key-icon" data-del aria-label="Delete">⌫</button>
    </div>`;
}

// Wires a keypad; calls onComplete(pin) when `length` digits are entered.
export function bindKeypad(root, length, onComplete) {
  let pin = '';
  let busy = false;
  const dots = $$('.pin-dot', root);
  const render = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const api = {
    reset() { pin = ''; busy = false; render(); },
    shake() {
      const el = $('.pin-dots', root);
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      setTimeout(() => api.reset(), 450);
    },
    setBusy(b) { busy = b; root.classList.toggle('busy', b); },
  };
  const press = (k) => {
    if (busy) return;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < length) pin += k;
    haptic();
    render();
    if (pin.length === length) {
      const value = pin;
      setTimeout(() => onComplete(value, api), 120);
    }
  };
  root.addEventListener('click', (e) => {
    const k = e.target.closest('[data-key]');
    if (k) return press(k.dataset.key);
    if (e.target.closest('[data-del]')) press('del');
  });
  const onKey = (e) => {
    if (!root.isConnected) return document.removeEventListener('keydown', onKey);
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  document.addEventListener('keydown', onKey);
  return api;
}

// Opens a sheet asking for a PIN. Resolves with the PIN or null.
export function askPin(title, subtitle = '') {
  return new Promise((resolve) => {
    let done = false;
    const s = openSheet(`
      <h2 class="sheet-title center">${esc(title)}</h2>
      ${subtitle ? `<p class="muted center">${esc(subtitle)}</p>` : ''}
      <div class="pin-pad">${keypadHTML(6)}</div>
      <button class="btn ghost block" data-close>Cancel</button>`, { onClose: () => !done && resolve(null) });
    bindKeypad(s.el, 6, (pin) => {
      done = true;
      s.close();
      resolve(pin);
    });
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

export function celebrate(text = 'Done!') {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const badge = document.createElement('div');
  badge.className = 'celebrate-badge';
  badge.innerHTML = `<div class="celebrate-check">✓</div><div>${esc(text)}</div>`;
  document.body.appendChild(badge);
  requestAnimationFrame(() => badge.classList.add('show'));

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = SCORE_COLORS.slice(4);
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2,
    y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 15 - 4,
    r: Math.random() * 6 + 3,
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
  if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
}
