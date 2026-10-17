import { state, nav, persist } from './state.js';
import { SCORE_COLORS, SCORE_LABELS, scoreClass, todayISO, fmtDate, openIssues, openGoals, feelingEmoji, ISSUE_STATUSES, GOAL_STATUSES } from './model.js';
import { esc, openSheet, confirmSheet, toast, haptic } from './ui.js';
import { openEditor } from './items.js';

// ---------- New / edit day ----------

export function renderNewDay(view, dateArg) {
  const today = todayISO();
  const date = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) && dateArg <= today ? dateArg : today;
  const existing = state.data.days[date];
  const draft = {
    score: existing ? existing.score : 0,
    note: existing ? existing.note : '',
    thankful: existing ? existing.thankful || '' : '',
  };

  view.innerHTML = `
    <header class="page-head">
      <div>
        <h1>${existing ? 'Edit day' : 'New day'}</h1>
        <p class="muted">${existing ? 'Update this entry' : 'One honest line is enough'}</p>
      </div>
    </header>

    <form class="day-form" autocomplete="off">
      <label class="field">
        <span class="field-label">Date</span>
        <input type="date" name="date" value="${date}" max="${today}" required>
      </label>

      <div class="field">
        <span class="field-label">How was today?</span>
        <div class="score-display">
          <span class="score-tile">–</span>
          <span class="score-word muted">Tap a square</span>
        </div>
        <div class="score-picker">
          ${SCORE_COLORS.slice(1).map((c, i) => `<button type="button" class="score-sq ${scoreClass(i + 1)}" data-score="${i + 1}" style="--c:${c}" aria-label="${i + 1} ${SCORE_LABELS[i + 1]}">${i + 1}</button>`).join('')}
        </div>
        <div class="score-ends muted small"><span>Terrible</span><span>Amazing</span></div>
      </div>

      <label class="field">
        <span class="field-label">What happened?</span>
        <textarea name="note" rows="6" placeholder="The main things that happened, and how they felt.">${esc(draft.note)}</textarea>
      </label>

      <label class="field">
        <span class="field-label">Something I'm thankful for</span>
        <input type="text" name="thankful" value="${esc(draft.thankful)}" placeholder="Big or tiny">
      </label>

      <div class="field">
        <div class="field-row"><span class="field-label">Issues today</span><button type="button" class="link-btn" data-add="issues">+ Add issue</button></div>
        <div class="day-issues"></div>
      </div>

      <div class="field">
        <div class="field-row"><span class="field-label">Looking forward to</span><button type="button" class="link-btn" data-add="goals">+ Add goal</button></div>
        <div class="day-goals"></div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn primary block">${existing ? 'Save changes' : 'Save day'}</button>
      </div>
    </form>`;

  const form = view.querySelector('form');
  const paintScore = () => {
    form.querySelectorAll('.score-sq').forEach((b) => b.classList.toggle('on', Number(b.dataset.score) === draft.score));
    const tile = form.querySelector('.score-tile');
    tile.textContent = draft.score || '–';
    tile.className = 'score-tile ' + (draft.score ? 'set ' + scoreClass(draft.score) : '');
    tile.style.setProperty('--c', draft.score ? SCORE_COLORS[draft.score] : '');
    form.querySelector('.score-word').textContent = draft.score ? SCORE_LABELS[draft.score] : 'Tap a square';
  };
  const paintLists = () => {
    const issues = existing && date !== today ? existing.issues : openIssues(state.data).map((i, idx, arr) => ({ ...i, rank: idx + 1, total: arr.length }));
    const goals = existing && date !== today ? existing.goals : openGoals(state.data);
    form.querySelector('.day-issues').innerHTML = snapshotList(issues, 'issue', 'No open issues.');
    form.querySelector('.day-goals').innerHTML = snapshotList(goals, 'goal', 'No goals yet. What would you like to look forward to?');
  };
  paintScore();
  paintLists();

  form.querySelector('.score-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-score]');
    if (!b) return;
    draft.score = Number(b.dataset.score);
    haptic();
    paintScore();
  });
  form.date.addEventListener('change', () => {
    if (form.date.value) nav.go('new/' + form.date.value);
  });
  form.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    openEditor(b.dataset.add, null, { onDone: paintLists });
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!draft.score) {
      toast('Pick a score for the day');
      form.querySelector('.score-picker').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const d = form.date.value || date;
    const prev = state.data.days[d];
    const keepSnapshot = prev && d !== today;
    state.data.days[d] = {
      date: d,
      score: draft.score,
      note: form.note.value.trim(),
      thankful: form.thankful.value.trim(),
      issues: keepSnapshot ? prev.issues : snapshotIssuesOn(d),
      goals: keepSnapshot ? prev.goals : snapshotGoalsOn(d),
      createdAt: prev ? prev.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    await persist();
    toast(prev ? 'Day updated' : 'Day saved');
    nav.go('home');
  });
}

// The issues/goals that existed on a given day, in today's priority order.
function snapshotIssuesOn(date) {
  const list = state.data.issues.filter((i) => (i.startedAt || '') <= date && (i.status !== 'resolved' || (i.doneAt && i.doneAt > date)));
  return list.map((i, idx) => ({
    id: i.id, title: i.title, rank: idx + 1, total: list.length, feeling: i.feeling || '', intensity: i.intensity || null, status: i.status,
  }));
}

function snapshotGoalsOn(date) {
  const list = state.data.goals.filter((g) => (g.addedAt || '') <= date && (g.status !== 'done' || (g.doneAt && g.doneAt > date)));
  return list.map((g, idx) => ({ id: g.id, title: g.title, rank: idx + 1, status: g.status }));
}

function statusLabel(kind, status) {
  const list = kind === 'issue' ? ISSUE_STATUSES : GOAL_STATUSES;
  return (list.find(([k]) => k === status) || [])[1] || '';
}

function snapshotList(items, kind, empty) {
  if (!items || !items.length) return `<p class="muted small">${esc(empty)}</p>`;
  return `<ol class="snap-list">${items.map((it, idx) => `
    <li class="snap ${kind}">
      <span class="snap-rank">${it.rank || idx + 1}${kind === 'issue' && it.total ? `<small>/${it.total}</small>` : ''}</span>
      <span class="snap-title">${esc(it.title)}</span>
      <span class="snap-meta">${kind === 'issue'
        ? `${feelingEmoji(it.feeling)}${it.intensity ? ` <small>${it.intensity}/10</small>` : ''}`
        : `<small>${esc(statusLabel('goal', it.status))}</small>`}</span>
    </li>`).join('')}</ol>`;
}

// ---------- Day detail ----------

export function openDay(date) {
  const entry = state.data.days[date];
  if (!entry) return;
  const dates = Object.keys(state.data.days).sort();
  const i = dates.indexOf(date);
  const prev = dates[i - 1];
  const next = dates[i + 1];
  const s = openSheet(`
    <div class="day-detail">
      <div class="day-nav">
        <button class="icon-btn" data-goto="${prev || ''}" ${prev ? '' : 'disabled'} aria-label="Previous entry">‹</button>
        <h2 class="sheet-title">${esc(fmtDate(date))}</h2>
        <button class="icon-btn" data-goto="${next || ''}" ${next ? '' : 'disabled'} aria-label="Next entry">›</button>
      </div>
      <div class="day-score" style="--c:${SCORE_COLORS[entry.score]}">
        <div class="day-score-sq ${scoreClass(entry.score)}">${entry.score}</div>
        <div><div class="day-score-word">${esc(SCORE_LABELS[entry.score])}</div><div class="muted small">${entry.score} out of 10</div></div>
      </div>
      ${entry.note ? `<p class="day-note">${esc(entry.note).replace(/\n/g, '<br>')}</p>` : '<p class="muted">No notes.</p>'}
      ${entry.thankful ? `<div class="thankful"><span>Thankful for</span>${esc(entry.thankful)}</div>` : ''}
      <h3 class="section-label">Issues that day</h3>
      ${snapshotList(entry.issues, 'issue', 'No open issues that day.')}
      <h3 class="section-label">Looking forward to</h3>
      ${snapshotList(entry.goals, 'goal', 'No goals that day.')}
      <div class="row gap-s mt">
        <button class="btn block" data-edit>Edit</button>
        <button class="btn danger-ghost block" data-delete>Delete day</button>
      </div>
    </div>`, { tall: true });

  s.el.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.goto) return;
    s.close();
    setTimeout(() => openDay(b.dataset.goto), 120);
  }));
  s.el.querySelector('[data-edit]').addEventListener('click', () => {
    s.close();
    nav.go('new/' + date);
  });
  s.el.querySelector('[data-delete]').addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: 'Delete this day?',
      body: 'The score and notes for this day will be removed. Your issues and goals lists stay exactly as they are.',
      confirm: 'Delete day',
      danger: true,
    });
    if (!ok) return;
    delete state.data.days[date];
    await persist();
    s.close();
    toast('Day deleted');
    nav.refresh();
  });
}
