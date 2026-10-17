// Weekly review: a banner on Home once a week that looks at the top three
// issues and the top goal, asks how each is going, and nudges toward the next
// unanswered reflection question. Dismissing hides it until next week; it can
// be reopened from Settings.

import { state, persist, nav } from './state.js';
import {
  addDays, todayISO, parseISO, iso, fmtDate, fmtAge, averageScore, openIssues, openGoals,
  feelingEmoji, ISSUE_PROMPTS, GOAL_PROMPTS, SCORE_COLORS, scoreClass,
} from './model.js';
import { esc, openSheet, haptic, celebrate } from './ui.js';
import { openEditor } from './items.js';
import { reminderPrefs } from './reminders.js';

// Issues ask which way things moved; goals ask how much progress was made.
const CHECKINS = {
  issues: { label: "This week it's", options: [['worse', 'Worse'], ['same', 'Same'], ['better', 'Better']], cheer: { better: 'Progress!' } },
  goals: { label: 'Progress', options: [['none', 'Not yet'], ['some', 'Some'], ['big', 'Big step']], cheer: { some: 'Nice!', big: 'Big step!' } },
};
const CHECKIN_WORDS = { none: 'no progress', some: 'some progress', big: 'a big step' };

// Monday of this week, as YYYY-MM-DD.
export function weekId(date = todayISO()) {
  const d = parseISO(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

function hasContent(data) {
  return data.issues.length || data.goals.length || Object.keys(data.days).length;
}

// Every other week counts from a fixed Monday so the rhythm doesn't drift.
function onCadence(cadence) {
  if (cadence === 'off') return false;
  if (cadence === 'biweekly') return Math.round((parseISO(weekId()) - parseISO('2024-01-01')) / (7 * 86400000)) % 2 === 0;
  return true;
}

export function shouldShowWeekly(data) {
  // Demo data skips the banner to keep Home uncluttered; Settings can still open it.
  return state.mode !== 'demo' && hasContent(data) && onCadence(reminderPrefs(data).weekly) && (data.weekly?.dismissed !== weekId());
}

// The issue's rank in the newest saved day from at least a week ago.
function rankLastWeek(data, id) {
  const cutoff = addDays(todayISO(), -7);
  const day = Object.keys(data.days).sort().reverse().find((d) => d <= cutoff);
  const snap = day && data.days[day].issues?.find((x) => x.id === id);
  return snap ? snap.rank : null;
}

function checkin(item) {
  return (item.checkins || []).find((c) => c.week === weekId());
}

function lastCheckin(item) {
  return (item.checkins || []).filter((c) => c.week !== weekId()).sort((a, b) => b.week.localeCompare(a.week))[0];
}

function promptProgress(item, prompts) {
  const answered = prompts.filter(([k]) => item.notes?.[k]).length;
  const next = prompts.find(([k]) => !item.notes?.[k]);
  return { answered, total: prompts.length, next };
}

function trendChips(kind, item) {
  const now = checkin(item);
  const { label, options } = CHECKINS[kind];
  return `<div class="trend" data-kind="${kind}" data-id="${item.id}">
    <span class="muted small">${label}</span>
    ${options.map(([v, l]) => `<button type="button" class="trend-btn t-${v} ${now?.trend === v ? 'on' : ''}" data-trend="${v}">${l}</button>`).join('')}
  </div>`;
}

export function weeklyHTML(data, { banner = true } = {}) {
  const today = todayISO();
  const wk = weekId();
  const thisAvg = averageScore(data, wk, today);
  const lastAvg = averageScore(data, addDays(wk, -7), addDays(wk, -1));
  const daysThisWeek = Object.keys(data.days).filter((d) => d >= wk && d <= today).length;
  const issues = openIssues(data).slice(0, 3);
  const goal = openGoals(data)[0];

  const scoreLine = thisAvg
    ? `<span class="wk-sw ${scoreClass(Math.round(thisAvg))}" style="background:${SCORE_COLORS[Math.round(thisAvg)]}"></span>
       Averaging <strong>${thisAvg.toFixed(1)}</strong> this week${lastAvg ? `, ${thisAvg >= lastAvg ? 'up' : 'down'} from ${lastAvg.toFixed(1)} last week` : ''} · ${daysThisWeek} day${daysThisWeek === 1 ? '' : 's'} logged`
    : `No days logged yet this week${lastAvg ? ` (last week averaged ${lastAvg.toFixed(1)})` : ''}.`;

  const issueRows = issues.map((it, i) => {
    const before = rankLastWeek(data, it.id);
    const move = before && before !== i + 1 ? (before > i + 1 ? `↑ from #${before}` : `↓ from #${before}`) : before ? 'same rank as last week' : 'new this week';
    const prog = promptProgress(it, ISSUE_PROMPTS);
    const last = lastCheckin(it);
    return `<div class="wk-item">
      <div class="wk-item-head">
        <span class="wk-rank">#${i + 1}</span>
        <div class="wk-item-title">${esc(it.title)}
          <div class="muted small">${feelingEmoji(it.feeling)} ${esc(it.feeling || 'No feeling set')} · ${esc(fmtAge(it.startedAt))} · ${move}${last ? ` · last week: ${last.trend}` : ''}</div>
        </div>
      </div>
      ${trendChips('issues', it)}
      <button type="button" class="wk-reflect" data-open="issues" data-id="${it.id}">
        <span class="wk-meter"><i style="width:${(prog.answered / prog.total) * 100}%"></i></span>
        <span>${prog.next
          ? `${prog.answered ? `${prog.answered} of ${prog.total} questions answered. ` : ''}Next to think about: <strong>${esc(prog.next[1])}</strong>`
          : 'All questions answered. Worth rereading: has anything changed?'}</span>
        <span class="chev">›</span>
      </button>
    </div>`;
  }).join('');

  const goalBlock = goal ? (() => {
    const prog = promptProgress(goal, GOAL_PROMPTS);
    const lastG = lastCheckin(goal);
    const daysLeft = goal.targetDate ? Math.round((parseISO(goal.targetDate) - parseISO(today)) / 86400000) : null;
    return `<div class="wk-item goal">
      <div class="wk-item-head">
        <span class="wk-rank goal">★</span>
        <div class="wk-item-title">${esc(goal.title)}
          <div class="muted small">${daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days to go` : `${-daysLeft} days past the target`) : `added ${esc(fmtAge(goal.addedAt))} ago`}${goal.notes?.firstStep ? ` · next step: ${esc(goal.notes.firstStep)}` : ''}${lastG ? ` · last week: ${CHECKIN_WORDS[lastG.trend] || lastG.trend}` : ''}</div>
        </div>
      </div>
      ${trendChips('goals', goal)}
      <button type="button" class="wk-reflect" data-open="goals" data-id="${goal.id}">
        <span class="wk-meter goal"><i style="width:${(prog.answered / prog.total) * 100}%"></i></span>
        <span>${prog.next ? `Fill in: <strong>${esc(prog.next[1])}</strong>` : 'What is one small step you can take this week?'}</span>
        <span class="chev">›</span>
      </button>
    </div>`;
  })() : '<p class="muted small">No goals yet. Something to look forward to helps balance the hard stuff.</p>';

  return `<section class="weekly ${banner ? 'card' : ''}">
    <div class="wk-head">
      <div>
        <div class="mini-kicker">Weekly review · week of ${esc(fmtDate(wk, { month: 'short', day: 'numeric' }))}</div>
        <h2 class="wk-title">How is it going?</h2>
      </div>
      ${banner ? '<button type="button" class="sheet-x wk-x" data-dismiss aria-label="Dismiss until next week"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' : ''}
    </div>
    <p class="wk-score small">${scoreLine}</p>
    ${issues.length ? `<h3 class="section-label">Top issues</h3>${issueRows}` : '<p class="muted small">No open issues right now. That is worth noticing.</p>'}
    <h3 class="section-label">Top goal</h3>
    ${goalBlock}
    ${banner ? '<button type="button" class="btn ghost block small" data-dismiss>Done for this week</button>' : ''}
  </section>`;
}

// Wires buttons inside a rendered review. `refresh` re-renders after changes.
export function bindWeekly(root, refresh) {
  root.addEventListener('click', async (e) => {
    const trendBtn = e.target.closest('[data-trend]');
    if (trendBtn) {
      const box = trendBtn.closest('.trend');
      const item = state.data[box.dataset.kind].find((x) => x.id === box.dataset.id);
      if (!item) return;
      item.checkins = (item.checkins || []).filter((c) => c.week !== weekId());
      item.checkins.push({ week: weekId(), trend: trendBtn.dataset.trend });
      box.querySelectorAll('[data-trend]').forEach((b) => b.classList.toggle('on', b === trendBtn));
      const cheer = CHECKINS[box.dataset.kind].cheer[trendBtn.dataset.trend];
      if (cheer) {
        const r = trendBtn.getBoundingClientRect();
        celebrate(cheer, { x: r.left + r.width / 2, y: r.top, small: true });
      } else haptic();
      await persist();
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) {
      openEditor(open.dataset.open, open.dataset.id, { onDone: refresh, reflect: true });
      return;
    }
    if (e.target.closest('[data-dismiss]')) {
      state.data.weekly = { ...(state.data.weekly || {}), dismissed: weekId() };
      await persist();
      refresh();
    }
  });
}

export function openWeeklySheet() {
  const s = openSheet(weeklyHTML(state.data, { banner: false }), { tall: true });
  const rerender = () => {
    if (!state.data) return;
    s.el.innerHTML = weeklyHTML(state.data, { banner: false });
  };
  bindWeekly(s.el, rerender);
  return s;
}

export function reopenWeekly() {
  if (state.data.weekly) delete state.data.weekly.dismissed;
  persist();
  nav.go('home');
}
