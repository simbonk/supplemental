// Issues ("bugs") and goals ("features"): ranked list or three-column board, and the editor sheet.

import { state, persist, nav } from './state.js';
import {
  uid, todayISO, fmtDate, fmtAge, daysBetween, FEELINGS, AREAS, ISSUE_STATUSES, GOAL_STATUSES,
  ISSUE_PROMPTS, GOAL_PROMPTS, ISSUE_KINDS, TALKED, feelingEmoji, moveIssue, moveGoal,
} from './model.js';
import { esc, openSheet, confirmSheet, toast, enableDragReorder, celebrate, haptic } from './ui.js';

const CFG = {
  issues: {
    title: 'Issues',
    subtitle: 'The bugs. Top of the list gets your attention first.',
    statuses: ISSUE_STATUSES,
    doneKey: 'resolved',
    noun: 'issue',
    empty: 'No open issues. Add the things weighing on you, then put the most important on top.',
    celebrate: 'Issue resolved!',
    move: moveIssue,
  },
  goals: {
    title: 'Goals',
    subtitle: 'The new features. Things to build and look forward to.',
    statuses: GOAL_STATUSES,
    doneKey: 'done',
    noun: 'goal',
    empty: 'No goals yet. What would you like to look forward to?',
    celebrate: 'Goal achieved!',
    move: moveGoal,
  },
};

function pref(key, fallback) {
  try { return localStorage.getItem('supplemental:ui:' + key) || fallback; } catch { return fallback; }
}
function setPref(key, value) {
  try { localStorage.setItem('supplemental:ui:' + key, value); } catch { /* private mode */ }
}

const listOf = (kind) => state.data[kind];
const isDone = (kind, it) => it.status === CFG[kind].doneKey;

function intensityColor(n) {
  if (!n) return 'var(--line)';
  if (n <= 3) return '#7c9cbf';
  if (n <= 6) return '#f2a33a';
  return '#ef5a5a';
}

function statusLabel(kind, s) {
  return (CFG[kind].statuses.find(([k]) => k === s) || [])[1] || '';
}

// ---------- Page ----------

export function renderItems(view, kind) {
  const cfg = CFG[kind];
  const mode = pref(kind + ':mode', 'list');
  const filter = pref(kind + ':filter', 'open');
  view.innerHTML = `
    <header class="page-head">
      <div><h1>${cfg.title}</h1><p class="muted">${cfg.subtitle}</p></div>
      <button class="round-btn" data-new aria-label="Add ${cfg.noun}">+</button>
    </header>
    <div class="toolbar">
      <div class="segmented" data-seg="mode">
        <button data-v="list" class="${mode === 'list' ? 'on' : ''}">List</button>
        <button data-v="board" class="${mode === 'board' ? 'on' : ''}">Board</button>
      </div>
      ${mode === 'list' ? `<div class="segmented" data-seg="filter">
        <button data-v="open" class="${filter === 'open' ? 'on' : ''}">Open</button>
        <button data-v="done" class="${filter === 'done' ? 'on' : ''}">${kind === 'issues' ? 'Resolved' : 'Achieved'}</button>
        <button data-v="all" class="${filter === 'all' ? 'on' : ''}">All</button>
      </div>` : ''}
    </div>
    <div class="items-body"></div>`;

  const body = view.querySelector('.items-body');
  if (mode === 'board') renderBoard(body, kind);
  else renderList(body, kind, filter);

  view.querySelector('[data-new]').addEventListener('click', () => openEditor(kind, null, { onDone: () => renderItems(view, kind) }));
  view.querySelectorAll('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    setPref(kind + ':' + seg.dataset.seg, b.dataset.v);
    renderItems(view, kind);
  }));
  body.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card || e.target.closest('.drag-handle')) return;
    if (e.target.closest('[data-complete]')) return completeItem(kind, card.dataset.id, card, () => renderItems(view, kind));
    if (e.target.closest('[data-advance]')) return advance(kind, card.dataset.id, card, () => renderItems(view, kind));
    openEditor(kind, card.dataset.id, { onDone: () => renderItems(view, kind) });
  });
}

function cardHTML(kind, it, { rank, draggable, board }) {
  const done = isDone(kind, it);
  const since = kind === 'issues' ? it.startedAt : it.addedAt;
  const ageDays = since ? daysBetween(since, done && it.doneAt ? it.doneAt : todayISO()) : 0;
  const accent = kind === 'issues' ? intensityColor(it.intensity) : '#34c39a';
  const meta = kind === 'issues'
    ? `${it.feeling ? `<span>${feelingEmoji(it.feeling)} ${esc(it.feeling)}${it.intensity ? ` · ${it.intensity}/10` : ''}</span>` : '<span class="muted">No feeling set</span>'}`
    : `${it.targetDate ? `<span>🎯 ${esc(fmtDate(it.targetDate, { month: 'short', day: 'numeric' }))}</span>` : ''}${it.notes?.firstStep ? `<span class="muted ellipsis">Next: ${esc(it.notes.firstStep)}</span>` : ''}`;
  const nextStatus = CFG[kind].statuses[CFG[kind].statuses.findIndex(([k]) => k === it.status) + 1];
  return `
    <article class="item-card ${done ? 'done' : ''}" data-id="${it.id}" style="--accent:${accent}">
      ${draggable ? '<div class="drag-handle" aria-label="Drag to reorder"><span></span><span></span><span></span></div>' : ''}
      <div class="item-main">
        <div class="item-top">
          ${rank ? `<span class="item-rank">#${rank}</span>` : ''}
          ${it.area ? `<span class="tag">${esc(it.area)}</span>` : ''}
          ${board ? '' : `<span class="status-pill s-${it.status}">${esc(statusLabel(kind, it.status))}</span>`}
        </div>
        <div class="item-title">${esc(it.title)}</div>
        <div class="item-meta">${meta}<span class="age" title="${kind === 'issues' ? 'How long this has been an issue' : 'Added'}">${clockIcon()} ${since ? esc(fmtAge(since, done && it.doneAt ? it.doneAt : todayISO())) : '–'}</span></div>
        ${kind === 'issues' && !done ? `<div class="age-bar" title="Age"><i style="width:${Math.min(100, Math.max(4, (ageDays / 180) * 100))}%"></i></div>` : ''}
        ${board && nextStatus ? `<button class="advance-btn" data-advance>Move to ${esc(nextStatus[1])} →</button>` : ''}
      </div>
      ${!done && !board ? `<button class="check-btn" data-complete aria-label="Mark ${kind === 'issues' ? 'resolved' : 'achieved'}"></button>` : ''}
      ${done ? '<div class="done-mark">✓</div>' : ''}
    </article>`;
}

function clockIcon() {
  return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
}

function renderList(body, kind, filter) {
  const all = listOf(kind);
  const open = all.filter((x) => !isDone(kind, x));
  const done = all.filter((x) => isDone(kind, x)).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  let html = '';
  if (filter !== 'done') {
    html += open.length
      ? `<div class="item-list" data-open>${open.map((it, i) => cardHTML(kind, it, { rank: i + 1, draggable: open.length > 1 })).join('')}</div>`
      : `<div class="empty">${esc(CFG[kind].empty)}</div>`;
    if (open.length > 1) html += '<p class="hint">Drag the handle to reorder, or set the rank inside a card.</p>';
  }
  if (filter !== 'open') {
    if (filter === 'all' && done.length) html += `<h3 class="section-label">${kind === 'issues' ? 'Resolved' : 'Achieved'}</h3>`;
    html += done.length
      ? `<div class="item-list">${done.map((it) => cardHTML(kind, it, {})).join('')}</div>`
      : (filter === 'done' ? `<div class="empty">Nothing ${kind === 'issues' ? 'resolved' : 'achieved'} yet. It'll come.</div>` : '');
  }
  body.innerHTML = html;
  const list = body.querySelector('[data-open]');
  if (list) {
    enableDragReorder(list, async (id, to) => {
      CFG[kind].move(state.data, id, to);
      await persist();
      renderList(body, kind, filter);
    });
  }
}

function renderBoard(body, kind) {
  const all = listOf(kind);
  const openRank = new Map(all.filter((x) => !isDone(kind, x)).map((x, i) => [x.id, i + 1]));
  body.innerHTML = `<div class="board">${CFG[kind].statuses.map(([key, label]) => {
    let items = all.filter((x) => x.status === key);
    if (key === CFG[kind].doneKey) items = items.sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    return `<section class="board-col">
      <h3 class="board-head"><span class="status-dot s-${key}"></span>${esc(label)}<span class="count">${items.length}</span></h3>
      <div class="board-cards">${items.length ? items.map((it) => cardHTML(kind, it, { rank: openRank.get(it.id), board: true })).join('') : '<div class="empty small">Nothing here</div>'}</div>
    </section>`;
  }).join('')}</div>
  <p class="hint">Swipe sideways for more columns.</p>`;
}

async function setStatus(kind, it, status) {
  const wasDone = isDone(kind, it);
  it.status = status;
  const nowDone = isDone(kind, it);
  if (nowDone && !wasDone) it.doneAt = todayISO();
  if (!nowDone) delete it.doneAt;
  return nowDone && !wasDone;
}

async function completeItem(kind, id, card, rerender) {
  const it = listOf(kind).find((x) => x.id === id);
  if (!it) return;
  card.classList.add('completing');
  celebrate(CFG[kind].celebrate);
  await setStatus(kind, it, CFG[kind].doneKey);
  await persist();
  setTimeout(rerender, 650);
}

async function advance(kind, id, card, rerender) {
  const it = listOf(kind).find((x) => x.id === id);
  const statuses = CFG[kind].statuses;
  const next = statuses[statuses.findIndex(([k]) => k === it.status) + 1];
  if (!next) return;
  const celebrated = await setStatus(kind, it, next[0]);
  if (celebrated) {
    card.classList.add('completing');
    celebrate(CFG[kind].celebrate);
  }
  haptic();
  await persist();
  setTimeout(rerender, celebrated ? 650 : 0);
}

// ---------- Editor ----------

function chipsHTML(name, options, value) {
  return `<div class="chips" data-chips="${name}">${options.map(([v, label]) => `<button type="button" class="chip ${v === value ? 'on' : ''}" data-v="${esc(v)}">${label}</button>`).join('')}</div>`;
}

function segHTML(name, options, value) {
  return `<div class="segmented wide" data-chips="${name}">${options.map(([v, label]) => `<button type="button" data-v="${v}" class="${v === value ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
}

export function openEditor(kind, id, { onDone } = {}) {
  const cfg = CFG[kind];
  const isIssue = kind === 'issues';
  const existing = id ? listOf(kind).find((x) => x.id === id) : null;
  const it = existing ? JSON.parse(JSON.stringify(existing)) : (isIssue
    ? { id: uid(), title: '', area: '', status: 'noticed', startedAt: todayISO(), feeling: '', intensity: 5, kind: 'unsure', talked: 'not-yet', notes: {}, createdAt: Date.now() }
    : { id: uid(), title: '', area: '', status: 'planned', addedAt: todayISO(), targetDate: '', notes: {}, createdAt: Date.now() });
  it.notes = it.notes || {};

  const openList = listOf(kind).filter((x) => !isDone(kind, x));
  const total = openList.length + (existing && !isDone(kind, existing) ? 0 : 1);
  const currentRank = existing && !isDone(kind, existing) ? openList.findIndex((x) => x.id === id) + 1 : total;
  const prompts = isIssue ? ISSUE_PROMPTS : GOAL_PROMPTS;
  const filledPrompts = prompts.some(([k]) => it.notes[k]);
  const done = isDone(kind, it);

  const s = openSheet(`
    <form class="editor" autocomplete="off">
      <div class="editor-head">
        <span class="muted small">${existing ? (isIssue ? 'Issue' : 'Goal') : (isIssue ? 'New issue' : 'New goal')}</span>
      </div>
      <textarea name="title" class="title-input" rows="2" placeholder="${isIssue ? 'What\'s the issue?' : 'What would you like to do?'}">${esc(it.title)}</textarea>

      ${segHTML('status', cfg.statuses, it.status)}

      <div class="editor-grid">
        <label class="field ${done ? 'hidden' : ''}" data-rank-field>
          <span class="field-label">Priority</span>
          <div class="rank-row">
            <select name="rank">${Array.from({ length: total }, (_, i) => `<option value="${i + 1}" ${i + 1 === currentRank ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
            <span class="muted">of ${total}</span>
          </div>
        </label>
        <label class="field">
          <span class="field-label">${isIssue ? 'Started' : 'Date added'}</span>
          <input type="date" name="since" value="${esc(isIssue ? it.startedAt : it.addedAt)}" max="${todayISO()}">
        </label>
        ${isIssue ? '' : `<label class="field"><span class="field-label">Hoping to by</span><input type="date" name="targetDate" value="${esc(it.targetDate || '')}"></label>`}
      </div>

      <div class="field">
        <span class="field-label">Area of life</span>
        ${chipsHTML('area', AREAS.map((a) => [a, a]), it.area)}
      </div>

      ${isIssue ? `
      <div class="field">
        <span class="field-label">How it makes me feel</span>
        ${chipsHTML('feeling', FEELINGS.map(([n, e]) => [n, `${e} ${n}`]), it.feeling)}
      </div>
      <label class="field">
        <span class="field-label">How strongly <span class="intensity-val">${it.intensity || 5}/10</span></span>
        <input type="range" name="intensity" min="1" max="10" value="${it.intensity || 5}">
      </label>
      <div class="field">
        <span class="field-label">Is it solvable?</span>
        ${segHTML('kind', ISSUE_KINDS, it.kind || 'unsure')}
        <p class="hint left">Many relationship conflicts are ongoing differences in personality or needs. Those are managed with understanding rather than solved, and that's normal.</p>
      </div>
      <div class="field">
        <span class="field-label">Have we talked about it?</span>
        ${segHTML('talked', TALKED, it.talked || 'not-yet')}
      </div>` : ''}

      <details class="reflect" ${filledPrompts || !isIssue ? 'open' : ''}>
        <summary>${isIssue ? 'Think it through' : 'Shape it'}<span class="muted small">${isIssue ? 'Questions counselors often ask' : 'Make it real'}</span></summary>
        ${prompts.map(([k, q, hint]) => `
          <label class="field">
            <span class="field-label">${esc(q)}</span>
            <textarea name="n_${k}" rows="2" placeholder="${esc(hint)}">${esc(it.notes[k] || '')}</textarea>
          </label>`).join('')}
      </details>

      <div class="stack gap-s mt">
        ${existing ? (done
          ? `<button type="button" class="btn block" data-reopen>Reopen</button>`
          : `<button type="button" class="btn success block" data-finish>${isIssue ? 'Mark resolved' : 'Mark achieved'} ✓</button>`) : `<button type="button" class="btn primary block" data-close>Add ${cfg.noun}</button>`}
        ${existing ? `<button type="button" class="btn danger-ghost block" data-delete>Delete ${cfg.noun}</button>` : ''}
      </div>
      ${existing ? `<p class="muted small center mt">${isIssue ? 'On the list' : 'Added'} ${esc(fmtAge(isIssue ? it.startedAt : it.addedAt))} ago${it.doneAt ? ` · ${isIssue ? 'resolved' : 'achieved'} ${esc(fmtDate(it.doneAt))}` : ''}</p>` : ''}
    </form>`, { tall: true, onClose: () => commit() });

  const form = s.el.querySelector('form');
  let skip = false;
  let celebrateOnClose = false;
  const title = form.title;
  if (!existing) setTimeout(() => title.focus(), 300);

  form.querySelectorAll('[data-chips]').forEach((group) => group.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const name = group.dataset.chips;
    const same = it[name] === b.dataset.v;
    const toggleable = name === 'area' || name === 'feeling';
    it[name] = same && toggleable ? '' : b.dataset.v;
    group.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x.dataset.v === it[name]));
    if (name === 'status') form.querySelector('[data-rank-field]').classList.toggle('hidden', it.status === cfg.doneKey);
    haptic();
  }));
  if (isIssue) {
    form.intensity.addEventListener('input', () => {
      form.querySelector('.intensity-val').textContent = form.intensity.value + '/10';
    });
  }
  const finish = form.querySelector('[data-finish]');
  if (finish) finish.addEventListener('click', () => {
    it.status = cfg.doneKey;
    s.close();
  });
  const reopen = form.querySelector('[data-reopen]');
  if (reopen) reopen.addEventListener('click', () => {
    it.status = cfg.statuses[1][0];
    s.close();
  });
  const del = form.querySelector('[data-delete]');
  if (del) del.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: `Delete this ${cfg.noun}?`,
      body: 'It will be removed from the list. Past days keep their snapshot of it.',
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    skip = true;
    state.data[kind] = listOf(kind).filter((x) => x.id !== id);
    await persist();
    s.close();
    toast(`${isIssue ? 'Issue' : 'Goal'} deleted`);
    onDone && onDone();
  });

  async function commit() {
    if (skip || !state.data) return;
    it.title = title.value.trim();
    if (!it.title) {
      if (!existing) return;
      it.title = existing.title;
    }
    if (isIssue) {
      it.startedAt = form.since.value || it.startedAt;
      it.intensity = Number(form.intensity.value);
    } else {
      it.addedAt = form.since.value || it.addedAt;
      it.targetDate = form.targetDate.value;
    }
    prompts.forEach(([k]) => {
      const v = form['n_' + k].value.trim();
      if (v) it.notes[k] = v;
      else delete it.notes[k];
    });
    const wasDone = existing ? isDone(kind, existing) : false;
    const nowDone = isDone(kind, it);
    if (nowDone && !wasDone) {
      it.doneAt = todayISO();
      celebrateOnClose = true;
    }
    if (!nowDone) delete it.doneAt;

    const list = listOf(kind);
    if (existing) Object.assign(existing, it);
    else list.push(it);
    if (!nowDone) {
      const rank = Number(form.rank.value) || 1;
      cfg.move(state.data, it.id, rank - 1);
    }
    await persist();
    if (celebrateOnClose) celebrate(cfg.celebrate);
    else if (!existing) toast(`${isIssue ? 'Issue' : 'Goal'} added`);
    onDone ? onDone() : nav.refresh();
  }

  return s;
}
