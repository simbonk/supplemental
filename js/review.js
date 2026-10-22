// Month in review. The flower bursts open when it comes into view: a petal per
// day in the day's color, with what you were thankful for written on it. Below
// it, the issues you resolved and the goals you achieved, each with a cheer.

import { state, nav } from './state.js';
import { SCORE_COLORS, SCORE_LABELS, todayISO, parseISO, iso, fmtDate, daysBetween, feelingEmoji } from './model.js';
import { esc, celebrate } from './ui.js';
import { Tap } from './device.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const R = 192; // petal tip
const CORE = 46;
const TEXT_FROM = CORE + 20;
const MAX_CHARS = 21;

// A petal pointing up from the origin, widest about two thirds of the way out.
function petalPath(w) {
  return `M0 ${-CORE + 6} C ${w * 0.55} ${-R * 0.45} ${w} ${-R * 0.62} ${w * 0.85} ${-R * 0.82} Q ${w * 0.5} ${-R} 0 ${-R} Q ${-w * 0.5} ${-R} ${-w * 0.85} ${-R * 0.82} C ${-w} ${-R * 0.62} ${-w * 0.55} ${-R * 0.45} 0 ${-CORE + 6} Z`;
}

const shorten = (s) => (s.length > MAX_CHARS ? s.slice(0, MAX_CHARS - 1).trimEnd() + '…' : s);

// Text runs along the petal, reading outward on the right half and inward on
// the left, so none of it is upside down.
function petalText(text, angle, dark) {
  const right = angle < 180;
  const t = esc(shorten(text));
  return `<text class="rv-ptext${dark ? ' dark' : ''}" transform="rotate(${right ? -90 : 90})" x="${right ? TEXT_FROM : -TEXT_FROM}" y="0"
    text-anchor="${right ? 'start' : 'end'}" dominant-baseline="central">${t}</text>`;
}

function flowerSVG(days, entries, { labels = true } = {}) {
  const n = days.length;
  const w = Math.min(30, ((2 * Math.PI * R * 0.62) / n) * 0.6);
  const path = petalPath(w);
  const petals = days.map((d, i) => {
    const e = entries[d];
    const a = (i * 360) / n;
    return `<g class="rv-petal${e ? '' : ' empty'}" data-date="${d}" style="--a:${a}deg;--i:${i}">
      <path d="${path}" style="fill:${e ? SCORE_COLORS[e.score] : 'transparent'}"></path>
      ${labels && e?.thankful ? petalText(e.thankful, a, e.score >= 8) : ''}</g>`;
  }).join('');
  return `<svg class="rv-flower" viewBox="-200 -200 400 400" role="img" aria-label="A petal for each day of the month">${petals}
    <circle class="rv-core" r="${CORE}"></circle></svg>`;
}

function itemCard(it, kind) {
  const since = kind === 'issues' ? it.startedAt : it.addedAt;
  const took = since ? daysBetween(since, it.doneAt) : null;
  const dur = took === null ? '' : took < 14 ? `${took} days` : took < 60 ? `${Math.round(took / 7)} weeks` : `${Math.round(took / 30.4)} months`;
  return `<article class="rv-card ${kind}">
    <span class="rv-stamp" aria-hidden="true">✓</span>
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
  const thanks = logged.filter((e) => e.thankful).length;
  const inMonth = (x) => x.doneAt && x.doneAt.startsWith(month);
  const issues = data.issues.filter((x) => x.status === 'resolved' && inMonth(x)).sort((a, b) => a.doneAt.localeCompare(b.doneAt));
  const goals = data.goals.filter((x) => x.status === 'done' && inMonth(x)).sort((a, b) => a.doneAt.localeCompare(b.doneAt));
  const soFar = month === thisMonth;
  const nextName = reviewMonthName(shiftMonth(month, 1));
  const introText = thanks
    ? `A petal for every day, in the color you gave it, with what you were thankful for. ${Tap} one to read the whole day.`
    : 'A petal for every day, in the color you gave it. Add what you\'re thankful for when you log a day, and it will grow on the petal.';

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

      <section class="rv-bloom">
        <div class="rv-flower-wrap">
          ${flowerSVG(days, entries)}
          <div class="rv-core-text"><strong>${avg ? avg.toFixed(1) : '–'}</strong><span>average</span></div>
        </div>
        <div class="rv-caption" aria-live="polite"><p class="muted">${esc(introText)}</p></div>
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

  // Tap a petal to read that day in full.
  const caption = view.querySelector('.rv-caption');
  view.querySelector('.rv-flower').addEventListener('click', (ev) => {
    const g = ev.target.closest('.rv-petal');
    if (!g || g.classList.contains('empty')) return;
    view.querySelectorAll('.rv-petal.on').forEach((p) => p.classList.remove('on'));
    g.classList.add('on');
    const d = g.dataset.date;
    const e = entries[d];
    caption.innerHTML = `<div class="rv-day">
      <div class="rv-cap-date"><i style="background:${SCORE_COLORS[e.score]}"></i>${esc(fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }))} · ${e.score} ${esc(SCORE_LABELS[e.score])}</div>
      ${e.thankful ? `<div class="rv-cap-thanks">Thankful for <strong>${esc(e.thankful)}</strong></div>` : ''}
      ${e.note ? `<div class="rv-cap-note">${esc(e.note)}</div>` : ''}</div>`;
  });

  // The flower bursts open once it's on screen; cards cheer as they arrive.
  const bloom = view.querySelector('.rv-bloom');
  if (reduced()) bloom.classList.add('bloomed');
  let cheers = 0;
  const io = new IntersectionObserver((list) => list.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target;
    io.unobserve(el);
    if (el === bloom) { el.classList.add('bloomed'); return; }
    el.classList.add('in');
    if (el.classList.contains('rv-card') && !reduced()) {
      const delay = 350 + 250 * cheers++;
      setTimeout(() => {
        if (!view.contains(el)) return;
        const r = el.getBoundingClientRect();
        celebrate(el.classList.contains('goals') ? 'Achieved!' : 'Resolved!', { small: true, x: r.left + r.width / 2, y: r.top + 10 });
      }, delay);
      setTimeout(() => { cheers = Math.max(0, cheers - 1); }, delay);
    }
  }), { threshold: 0.45 });
  io.observe(bloom);
  view.querySelectorAll('.rv-card, .rv-h2, .rv-empty, .rv-end').forEach((el, i) => { el.style.setProperty('--i', i % 4); io.observe(el); });
  cleanup = () => { io.disconnect(); cleanup = null; };
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
  return `<a class="card review-link bloomed" href="#review/${month}">
    ${flowerSVG(days, entries, { labels: false })}
    <div><strong>${esc(reviewMonthName(month))} in review</strong><span class="muted small">${soFar ? 'Your month so far, day by day' : 'Your month, day by day'}</span></div>
    <span class="chev">›</span>
  </a>`;
}
