import { state, nav } from './state.js';
import { SCORE_COLORS, scoreClass, iso, todayISO, addDays, fmtDate, averageScore, streak, openIssues, openGoals, feelingEmoji, fmtAge } from './model.js';
import { esc, openSheet } from './ui.js';
import { openDay } from './day.js';
import { shouldShowWeekly, weeklyHTML, bindWeekly } from './weekly.js';
import { backupDue, backupNagHTML, bindBackupNag } from './backup.js';
import { reviewLinkHTML } from './review.js';
import { Tap } from './device.js';

let monthOffset = 0; // 0 = the 12 months ending this month

export function renderHome(view) {
  const { data } = state;
  const today = todayISO();
  const avg30 = averageScore(data, addDays(today, -29), today);
  const logged = Object.keys(data.days).length;
  const st = streak(data);
  const topIssue = openIssues(data)[0];
  const nextGoal = openGoals(data)[0];
  const todayEntry = data.days[today];

  view.innerHTML = `
    <header class="page-head">
      <div>
        <h1>${esc(fmtDate(today, { weekday: 'long' }))}</h1>
        <p class="muted">${esc(fmtDate(today, { month: 'long', day: 'numeric', year: 'numeric' }))}</p>
      </div>
    </header>

    ${backupDue(data) ? backupNagHTML(data) : ''}

    ${shouldShowWeekly(data) ? weeklyHTML(data) : ''}

    <section class="stats">
      <div class="stat"><div class="stat-num">${avg30 ? `<i class="stat-sw ${scoreClass(Math.round(avg30))}" style="background:${SCORE_COLORS[Math.round(avg30)]}"></i>` : ''}${avg30 ? avg30.toFixed(1) : '–'}</div><div class="stat-label">30-day average</div></div>
      <div class="stat"><div class="stat-num">${logged}</div><div class="stat-label">days logged</div></div>
      <div class="stat"><div class="stat-num">${st}</div><div class="stat-label">day streak</div></div>
    </section>

    ${todayEntry ? '' : `<a class="today-cta" href="#new">
      <div><strong>How was today?</strong><div class="muted small">${Tap} to log ${esc(fmtDate(today, { weekday: 'long' }))}</div></div>
      <span class="today-plus">+</span></a>`}

    <section class="card heat-card">
      <div class="heat-head">
        <button class="icon-btn" data-shift="-12" aria-label="Previous year">‹</button>
        <div class="heat-title"></div>
        <button class="icon-btn" data-shift="12" aria-label="Next year" ${monthOffset >= 0 ? 'disabled' : ''}>›</button>
      </div>
      <div class="heat-grid"></div>
      <div class="legend">
        <span>Terrible</span>
        <div class="legend-swatches">${SCORE_COLORS.slice(1).map((c, i) => `<i class="${scoreClass(i + 1)}" style="background:${c}" title="${i + 1}"></i>`).join('')}</div>
        <span>Amazing</span>
      </div>
    </section>

    ${reviewLinkHTML(data)}

    <section class="home-pair">
      ${topIssue ? `<a class="mini-card" href="#issues">
        <div class="mini-kicker">Top issue</div>
        <div class="mini-title">${esc(topIssue.title)}</div>
        <div class="muted small">${feelingEmoji(topIssue.feeling)} ${esc(topIssue.feeling || '')} · ${esc(fmtAge(topIssue.startedAt))}</div>
      </a>` : `<a class="mini-card" href="#issues"><div class="mini-kicker">Issues</div><div class="mini-title">Nothing on the list</div><div class="muted small">Add what's weighing on you</div></a>`}
      ${nextGoal ? `<a class="mini-card goal" href="#goals">
        <div class="mini-kicker">Looking forward to</div>
        <div class="mini-title">${esc(nextGoal.title)}</div>
        <div class="muted small">${nextGoal.targetDate ? 'by ' + esc(fmtDate(nextGoal.targetDate, { month: 'short', day: 'numeric' })) : esc(nextGoal.area || '')}</div>
      </a>` : `<a class="mini-card goal" href="#goals"><div class="mini-kicker">Goals</div><div class="mini-title">Something to look forward to</div><div class="muted small">Add a goal</div></a>`}
    </section>`;

  drawHeatmap(view);
  const weekly = view.querySelector('.weekly');
  if (weekly) bindWeekly(weekly, () => renderHome(view));
  bindBackupNag(view, () => renderHome(view));
  view.querySelectorAll('[data-shift]').forEach((b) => b.addEventListener('click', () => {
    monthOffset = Math.min(0, monthOffset + Number(b.dataset.shift));
    renderHome(view);
  }));
}

function drawHeatmap(view) {
  const { data } = state;
  const today = todayISO();
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const months = Array.from({ length: 12 }, (_, i) => new Date(end.getFullYear(), end.getMonth() - 11 + i, 1));
  const first = months[0];
  const last = months[11];
  const sameYear = first.getFullYear() === last.getFullYear();
  view.querySelector('.heat-title').textContent = sameYear
    ? String(first.getFullYear())
    : `${first.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;

  let html = '<div class="hm-corner"></div>';
  html += months.map((m) => `<div class="hm-month">${m.toLocaleDateString(undefined, { month: 'narrow' })}</div>`).join('');
  for (let d = 1; d <= 31; d++) {
    html += `<div class="hm-day">${d % 5 === 0 || d === 1 ? d : ''}</div>`;
    for (const m of months) {
      const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      if (d > dim) {
        html += '<div class="hm-cell none"></div>';
        continue;
      }
      const date = iso(new Date(m.getFullYear(), m.getMonth(), d));
      const entry = data.days[date];
      const cls = ['hm-cell'];
      if (date > today) cls.push('future');
      if (date === today) cls.push('today');
      if (entry) cls.push('filled');
      if (entry && scoreClass(entry.score)) cls.push(scoreClass(entry.score));
      const delay = entry && entry.score === 10 ? `;--d:${((d * 7 + months.indexOf(m) * 3) % 10) * 0.26}s` : '';
      const style = entry ? `style="background:${SCORE_COLORS[entry.score]}${delay}"` : '';
      html += `<button class="${cls.join(' ')}" data-date="${date}" ${style} ${date > today ? 'disabled' : ''} aria-label="${date}${entry ? ', ' + esc(entry.score) + ' out of 10' : ''}"></button>`;
    }
  }
  const grid = view.querySelector('.heat-grid');
  grid.innerHTML = html;
  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-date]');
    if (!cell || cell.disabled) return;
    const date = cell.dataset.date;
    if (state.data.days[date]) openDay(date);
    else emptyDay(date);
  });
}

function emptyDay(date) {
  const s = openSheet(`
    <h2 class="sheet-title">${esc(fmtDate(date))}</h2>
    <p class="muted">Nothing logged for this day.</p>
    <div class="stack gap-s mt">
      <button class="btn primary block" data-log>Log this day</button>
    </div>`);
  s.el.querySelector('[data-log]').addEventListener('click', () => {
    s.close();
    nav.go('new/' + date);
  });
}

