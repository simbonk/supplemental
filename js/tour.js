// First-run walkthrough: a spotlight on each tab, then Settings to install and set a PIN.

import { state, nav } from './state.js';

const KEY = 'supplemental:ui:tour';
const standalone = () => navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

const STEPS = [
  { go: 'home', target: '.tab[data-tab=home]', title: 'Home', text: "Your day at a glance: today's score, your year as a heat map, and anything that needs you." },
  { go: 'issues', target: '.tab[data-tab=issues]', title: 'Issues', text: "The things weighing on you, ranked. The top of the list is what gets your attention first." },
  { go: 'goals', target: '.tab[data-tab=goals]', title: 'Goals', text: "What you're building toward, so it isn't only about what's wrong." },
  { go: 'new', target: '.tab[data-tab=new]', title: 'Log your day', text: 'Tap + once a day: a score from 1 to 10 and a line about how it went. About a minute.' },
  {
    go: 'settings', target: '.install-tip', title: 'First, add it to your Home Screen',
    text: 'Follow the steps in this card. It then opens full screen, like a real app.',
  },
  {
    go: 'settings', target: '[data-setup]', title: () => (standalone() ? 'Last step: set your PIN' : 'Then set your PIN'),
    text: () => (standalone()
      ? 'Your PIN encrypts your journal. Make it different from your phone passcode.'
      : 'Do this in the app you just added, not here in the browser. Your PIN encrypts your journal, so make it different from your phone passcode.'),
    action: () => (standalone() ? ['Set my PIN', () => nav.startSetup()] : null),
  },
];

export function shouldTour() {
  if (state.hasVault || state.mode !== 'demo') return false;
  try { return localStorage.getItem(KEY) !== 'done'; } catch { return false; }
}

export function startTour() {
  const el = document.createElement('div');
  el.className = 'tour';
  el.innerHTML = '<div class="tour-hole"></div><div class="tour-tip" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(el);
  const hole = el.querySelector('.tour-hole');
  const tip = el.querySelector('.tour-tip');
  let i = -1;
  let target = null;

  const finish = () => {
    try { localStorage.setItem(KEY, 'done'); } catch { /* private mode */ }
    window.removeEventListener('resize', place);
    el.remove();
  };

  function place() {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 6;
    Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(320, vw - 32);
    const cx = r.left + r.width / 2;
    const left = Math.max(16, Math.min(cx - w / 2, vw - w - 16));
    tip.style.width = `${w}px`;
    tip.style.left = `${left}px`;
    tip.style.setProperty('--arrow-x', `${Math.max(18, Math.min(cx - left, w - 18))}px`);
    const h = tip.offsetHeight;
    tip.classList.remove('above', 'below', 'floating');
    tip.style.top = tip.style.bottom = '';
    if (r.top - pad - 14 - h > 12) {
      tip.classList.add('above');
      tip.style.top = `${r.top - pad - 14 - h}px`;
    } else if (r.bottom + pad + 14 + h < vh - 12) {
      tip.classList.add('below');
      tip.style.top = `${r.bottom + pad + 14}px`;
    } else {
      // Tall target: float the tip in whichever gap is bigger.
      tip.classList.add('floating');
      if (r.top > vh - r.bottom) tip.style.top = '12px';
      else tip.style.bottom = '24px';
    }
  }

  async function show(n) {
    for (i = n; i < STEPS.length; i++) {
      const s = STEPS[i];
      nav.go(s.go);
      await new Promise((ok) => setTimeout(ok, 60));
      target = document.querySelector(s.target);
      if (target) break;
    }
    if (i >= STEPS.length) return finish();
    const s = STEPS[i];
    if (s.go === 'settings') {
      // Sit the card just above the tab bar, leaving room for the tip above it.
      const bar = document.querySelector('.tabbar')?.getBoundingClientRect().top ?? window.innerHeight;
      window.scrollBy(0, target.getBoundingClientRect().bottom - (bar - 16));
      await new Promise((ok) => setTimeout(ok, 250));
    }
    const last = !STEPS.slice(i + 1).length;
    const action = s.action?.();
    tip.innerHTML = `
      <strong>${typeof s.title === 'function' ? s.title() : s.title}</strong>
      <p>${typeof s.text === 'function' ? s.text() : s.text}</p>
      <div class="tour-btns">
        ${last ? '<span></span>' : '<button class="link-btn muted-link" data-skip>Skip</button>'}
        <span class="tour-right">
          ${action ? '<button class="btn ghost small" data-next>Later</button>' : ''}
          <button class="btn primary small" ${action ? 'data-act' : 'data-next'}>${action ? action[0] : last ? 'Done' : 'Next'}</button>
        </span>
      </div>`;
    tip.querySelector('[data-skip]')?.addEventListener('click', finish);
    tip.querySelector('[data-next]')?.addEventListener('click', () => (last ? finish() : show(i + 1)));
    tip.querySelector('[data-act]')?.addEventListener('click', () => { finish(); action[1](); });
    place();
    setTimeout(place, 450); // again once the page's entrance animation settles
  }

  window.addEventListener('resize', place);
  show(0);
}
