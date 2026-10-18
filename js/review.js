// Month in review: a scrolling story. A flower blooms with a petal per day in
// the day's color, then walks through what you were thankful for, then the
// issues you resolved and the goals you achieved that month.

import { state, nav } from './state.js';
import { SCORE_COLORS, SCORE_LABELS, todayISO, parseISO, iso, fmtDate, daysBetween, feelingEmoji } from './model.js';
import { esc, celebrate } from './ui.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (t) => 1 - (1 - t) ** 3;

let cleanup = null;

// The month to open by default: last month during the first few days of a new one.
export function defaultReviewMonth(today = todayISO()) {
  const d = parseISO(today);
  if (d.getDate() <= 5) d.setMonth(d.getMonth() - 1);
  return iso(d).slice(0, 7);
}

export function reviewMonthName(month) {
  return fmtDate(month + '-01', { month: 'long' });
}

function monthDays(month) {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

function shiftMonth(month, by) {
  const d = parseISO(month + '-01');
  d.setMonth(d.getMonth() + by);
  return iso(d).slice(0, 7);
}

// A petal pointing up from the origin; its length follows the score.
function petalPath(len, w) {
  return `M0 0 C ${w} ${-len * 0.3} ${w * 0.9} ${-len * 0.85} 0 ${-len} C ${-w * 0.9} ${-len * 0.85} ${-w} ${-len * 0.3} 0 0 Z`;
}

function flowerSVG(days, entries) {
  const n = days.length;
  const w = Math.min(22, (2 * Math.PI * 70) / n * 0.75);
  const petals = days.map((d, i) => {
    const e = entries[d];
    const len = e ? 70 + e.score * 9 : 74;
    const fill = e ? SCORE_COLORS[e.score] : 'transparent';
    return `<g class="rv-petal${e ? '' : ' empty'}${e?.thankful ? ' thanks' : ''}" data-i="${i}" data-date="${d}" style="--a:${(i * 360) / n}deg">
      <path d="${petalPath(len, w)}" style="fill:${fill}"></path></g>`;
  }).join('');
  return `<svg class="rv-flower" viewBox="-180 -180 360 360" aria-hidden="true">${petals}
    <circle class="rv-core" r="42"></circle></svg>`;
}

function itemCard(it, kind) {
  const since = kind === 'issues' ? it.startedAt : it.addedAt;
  const took = since ? daysBetween(since, it.doneAt) : null;
  const dur = took === null ? '' : took < 14 ? `${took} days` : took < 60 ? `${Math.round(took / 7)} weeks` : `${Math.round(took / 30.4)} months`;
  return `<article class="rv-card ${kind}">
    <div class="rv-card-top">${it.area ? `<span class="tag">${esc(it.area)}</span>` : ''}<span class="muted small">${esc(fmtDate(it.doneAt, { month: 'short', day: 'numeric' }))}</span></div>
    <div class="rv-card-title">${esc(it.title)}</div>
    <div class="muted small">${kind === 'issues'
      ? `${it.feeling ? `${feelingEmoji(it.feeling)} Started as ${esc(it.feeling.toLowerCase())}. ` : ''}${dur ? `On the list for ${dur}.` : ''}`
      : `${dur ? `${dur} from idea to done.` : ''}${it.notes?.why ? ` ${esc(it.notes.why)}` : ''}`}</div>
  </article>`;
}

export function renderReview(view, arg) {
  if (cleanup) cleanup();
  const { data } = state;
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(arg || '') ? arg : defaultReviewMonth(today);
  const thisMonth = today.slice(0, 7);
  const name = reviewMonthName(month);
  const days = monthDays(month);
  const entries = Object.fromEntries(days.filter((d) => data.days[d]).map((d) => [d, data.days[d]]));
  const logged = Object.values(entries);
  const avg = logged.length ? logged.reduce((a, e) => a + e.score, 0) / logged.length : null;
  const best = logged.length ? Math.max(...logged.map((e) => e.score)) : null;
  const thanks = days.filter((d) => entries[d]?.thankful);
  const inMonth = (x) => x.doneAt && x.doneAt.startsWith(month);
  const issues = data.issues.filter((x) => x.status === 'resolved' && inMonth(x)).sort((a, b) => a.doneAt.localeCompare(b.doneAt));
  const goals = data.goals.filter((x) => x.status === 'done' && inMonth(x)).sort((a, b) => a.doneAt.localeCompare(b.doneAt));
  const soFar = month === thisMonth;
  const nextName = reviewMonthName(shiftMonth(month, 1));

  // Each thankful day gets a stretch of scrolling; the bloom itself takes the first screen.
  const walk = Math.min(thanks.length, 31);
  view.innerHTML = `
    <div class="review">
      <header class="rv-hero">
        <div class="rv-nav">
          <button class="icon-btn" data-month="${esc(shiftMonth(month, -1))}" aria-label="Previous month">‹</button>
          <button class="link-btn muted-link" data-home>Home</button>
          <button class="icon-btn" data-month="${esc(shiftMonth(month, 1))}" aria-label="Next month" ${month >= thisMonth ? 'disabled' : ''}>›</button>
        </div>
        <p class="rv-kicker">${soFar ? 'Your month so far' : 'Month in review'}</p>
        <h1 class="rv-title">${esc(name)}</h1>
        <p class="muted">${logged.length ? `${logged.length} ${logged.length === 1 ? 'day' : 'days'} logged · averaging ${avg.toFixed(1)}` : 'No days logged this month'}</p>
        <div class="rv-scroll-cue" aria-hidden="true">Scroll<span>↓</span></div>
      </header>

      <section class="rv-bloom" style="--walk:${walk}">
        <div class="rv-stage">
          <div class="rv-flower-wrap">
            ${flowerSVG(days, entries)}
            <div class="rv-core-text"><strong>${avg ? avg.toFixed(1) : '–'}</strong><span>average</span></div>
          </div>
          <div class="rv-caption" aria-live="polite">
            <div class="rv-cap-intro">
              <strong>Every day is a petal.</strong>
              <span class="muted">Longer and brighter for the better days.${best ? ` Your best was a ${best}, ${esc(SCORE_LABELS[best])}.` : ''}</span>
            </div>
            <div class="rv-cap-day" hidden></div>
          </div>
        </div>
      </section>

      <section class="rv-section">
        <p class="rv-kicker">Worked through</p>
        <h2 class="rv-h2">${issues.length ? `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} resolved` : 'Nothing resolved this month'}</h2>
        ${issues.length ? `<div class="rv-cards">${issues.map((it) => itemCard(it, 'issues')).join('')}</div>`
          : '<p class="muted rv-empty">That\'s okay. Some things take longer than a month, and noticing them is the first step.</p>'}
      </section>

      <section class="rv-section rv-goals">
        <p class="rv-kicker">Achieved</p>
        <h2 class="rv-h2">${goals.length ? `${goals.length} ${goals.length === 1 ? 'goal' : 'goals'} reached` : 'No goals reached this month'}</h2>
        ${goals.length ? `<div class="rv-cards">${goals.map((it) => itemCard(it, 'goals')).join('')}</div>`
          : '<p class="muted rv-empty">Every goal starts with one small step. What could next month\'s be?</p>'}
      </section>

      <footer class="rv-end">
        <div class="rv-end-mark">✿</div>
        <p>${soFar ? `There's still time to add to ${esc(name)}.` : `See you in ${esc(nextName)}.`}</p>
        <button class="btn primary" data-home>Back to Home</button>
      </footer>
    </div>`;

  view.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => nav.go('review/' + b.dataset.month)));
  view.querySelectorAll('[data-home]').forEach((b) => b.addEventListener('click', () => nav.go('home')));

  const bloom = view.querySelector('.rv-bloom');
  const petals = [...view.querySelectorAll('.rv-petal')];
  const intro = view.querySelector('.rv-cap-intro');
  const dayCap = view.querySelector('.rv-cap-day');
  const thankPetals = thanks.slice(0, walk).map((d) => petals[days.indexOf(d)]);
  let shown = -2;

  const showDay = (d, petal) => {
    const e = entries[d];
    petals.forEach((p) => p.classList.toggle('on', p === petal));
    if (!e) { dayCap.hidden = true; intro.hidden = false; return; }
    intro.hidden = true;
    dayCap.hidden = false;
    dayCap.innerHTML = `
      <div class="rv-cap-date"><i style="background:${SCORE_COLORS[e.score]}"></i>${esc(fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }))} · ${e.score} ${esc(SCORE_LABELS[e.score])}</div>
      ${e.thankful ? `<div class="rv-cap-thanks">Thankful for <strong>${esc(e.thankful)}</strong></div>` : e.note ? `<div class="rv-cap-note">${esc(e.note)}</div>` : ''}`;
  };

  function frame() {
    const r = bloom.getBoundingClientRect();
    const span = Math.max(1, r.height - window.innerHeight);
    const p = clamp(-r.top / span);
    // First 35% of the stretch: the bud opens. The rest: one thankful day after another.
    const open = reduced() ? 1 : ease(clamp(p / 0.35));
    bloom.style.setProperty('--open', open.toFixed(3));
    const k = walk ? Math.floor(clamp((p - 0.38) / 0.6, 0, 0.9999) * walk) : -1;
    const idx = p < 0.38 || !walk ? -1 : k;
    if (idx !== shown) {
      shown = idx;
      if (idx < 0) { petals.forEach((x) => x.classList.remove('on')); dayCap.hidden = true; intro.hidden = false; }
      else showDay(thanks[idx], thankPetals[idx]);
    }
  }

  // Tap a petal to see that day.
  view.querySelector('.rv-flower').addEventListener('click', (e) => {
    const g = e.target.closest('.rv-petal');
    if (g && !g.classList.contains('empty')) showDay(g.dataset.date, g);
  });

  // Cards rise in as they come into view; reaching an achieved goal gets a cheer.
  let cheered = false;
  const io = new IntersectionObserver((list) => list.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    io.unobserve(en.target);
    if (!cheered && en.target.classList.contains('goals') && !reduced()) {
      cheered = true;
      celebrate('Achieved!', { small: true, x: innerWidth / 2, y: en.boundingClientRect.top });
    }
  }), { threshold: 0.35 });
  view.querySelectorAll('.rv-card, .rv-h2, .rv-empty, .rv-end').forEach((el, i) => { el.style.setProperty('--i', i % 4); io.observe(el); });

  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (view.contains(bloom)) frame(); }); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();
  cleanup = () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    io.disconnect();
    cleanup = null;
  };
}

export function leaveReview() {
  if (cleanup) cleanup();
}

// The Home card that opens the review, with a tiny version of the month's flower.
export function reviewLinkHTML(data) {
  const month = defaultReviewMonth();
  const days = monthDays(month);
  const entries = Object.fromEntries(days.filter((d) => data.days[d]).map((d) => [d, data.days[d]]));
  if (!Object.keys(entries).length) return '';
  const soFar = month === todayISO().slice(0, 7);
  return `<a class="card review-link" href="#review/${month}" style="--open:1">
    ${flowerSVG(days, entries)}
    <div><strong>${esc(reviewMonthName(month))} in review</strong><span class="muted small">${soFar ? 'Your month so far, day by day' : 'Your month, day by day'}</span></div>
    <span class="chev">›</span>
  </a>`;
}
