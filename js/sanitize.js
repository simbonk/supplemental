// Rebuilds journal data into a known shape. Runs on every import and unlock, so a
// hand-crafted backup can't inject markup through ids, numbers or statuses, or
// break the app with values of the wrong type. Free text stays as typed (it is
// escaped when shown); everything else is coerced to a whitelist or a range.

import { uid, todayISO, ISSUE_STATUSES, GOAL_STATUSES, ISSUE_KINDS, TALKED, ISSUE_PROMPTS, GOAL_PROMPTS } from './model.js';
import { WEEKLY_CADENCES, BACKUP_CADENCES, DAILY_TIMES } from './reminders.js';

const MAX_TEXT = 20000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]{1,32}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : '');
const date = (v, fallback = '') => (typeof v === 'string' && DATE.test(v) ? v : fallback);
const int = (v, lo, hi, fallback) => (Number.isInteger(v) && v >= lo && v <= hi ? v : fallback);
const num = (v) => (Number.isFinite(v) ? v : undefined);
const oneOf = (v, options, fallback) => (options.some(([k]) => k === v) ? v : fallback);
const id = (v) => (typeof v === 'string' && ID.test(v) ? v : uid());
const list = (v) => (Array.isArray(v) ? v.filter(isObj) : []);

function notes(v, prompts) {
  const out = {};
  if (isObj(v)) for (const [k] of prompts) if (typeof v[k] === 'string' && v[k]) out[k] = text(v[k]);
  return out;
}

function checkins(v, options) {
  return list(v)
    .map((c) => ({ week: date(c.week), trend: oneOf(c.trend, options, '') }))
    .filter((c) => c.week && c.trend);
}

function cleanIssue(x) {
  const out = {
    id: id(x.id), title: text(x.title), area: text(x.area),
    status: oneOf(x.status, ISSUE_STATUSES, 'noticed'),
    startedAt: date(x.startedAt, todayISO()), feeling: text(x.feeling),
    intensity: int(x.intensity, 1, 10, 5), kind: oneOf(x.kind, ISSUE_KINDS, 'unsure'),
    talked: oneOf(x.talked, TALKED, 'not-yet'), notes: notes(x.notes, ISSUE_PROMPTS),
    checkins: checkins(x.checkins, [['worse'], ['same'], ['better']]),
    createdAt: num(x.createdAt),
  };
  if (date(x.doneAt)) out.doneAt = x.doneAt;
  if (num(x.boardPos) !== undefined) out.boardPos = x.boardPos;
  return out;
}

function cleanGoal(x) {
  const out = {
    id: id(x.id), title: text(x.title), area: text(x.area),
    status: oneOf(x.status, GOAL_STATUSES, 'planned'),
    addedAt: date(x.addedAt, todayISO()), targetDate: date(x.targetDate),
    notes: notes(x.notes, GOAL_PROMPTS),
    checkins: checkins(x.checkins, [['none'], ['some'], ['big']]),
    createdAt: num(x.createdAt),
  };
  if (date(x.doneAt)) out.doneAt = x.doneAt;
  if (num(x.boardPos) !== undefined) out.boardPos = x.boardPos;
  return out;
}

function cleanDay(d, key) {
  const out = {
    date: key, score: int(d.score, 1, 10, 0), note: text(d.note), thankful: text(d.thankful),
    issues: list(d.issues).map((s) => ({
      id: id(s.id), title: text(s.title), rank: int(s.rank, 1, 10000, 1), total: int(s.total, 1, 10000, 1),
      feeling: text(s.feeling), intensity: int(s.intensity, 1, 10, null), status: oneOf(s.status, ISSUE_STATUSES, 'noticed'),
    })),
    goals: list(d.goals).map((s) => ({
      id: id(s.id), title: text(s.title), rank: int(s.rank, 1, 10000, 1), status: oneOf(s.status, GOAL_STATUSES, 'planned'),
    })),
    createdAt: num(d.createdAt),
    updatedAt: num(d.updatedAt),
  };
  return out.score ? out : null;
}

// Throws when the input isn't journal data at all.
export function sanitizeData(raw) {
  if (!isObj(raw)) throw new Error('That backup does not contain a journal');
  const days = {};
  if (isObj(raw.days)) {
    for (const [k, d] of Object.entries(raw.days)) {
      if (!DATE.test(k) || !isObj(d)) continue;
      const day = cleanDay(d, k);
      if (day) days[k] = day;
    }
  }
  const out = {
    version: 1, days,
    issues: list(raw.issues).map(cleanIssue),
    goals: list(raw.goals).map(cleanGoal),
    createdAt: num(raw.createdAt) ?? Date.now(),
  };
  if (isObj(raw.backup)) {
    const b = { lastAt: date(raw.backup.lastAt), snoozeUntil: date(raw.backup.snoozeUntil) };
    out.backup = Object.fromEntries(Object.entries(b).filter(([, v]) => v));
  }
  if (isObj(raw.reminders)) {
    const r = raw.reminders;
    out.reminders = {
      weekly: oneOf(r.weekly, WEEKLY_CADENCES, 'off'),
      backup: oneOf(r.backup, BACKUP_CADENCES, '30'),
      dailyAt: DAILY_TIMES.includes(r.dailyAt) ? r.dailyAt : '21:00',
    };
  }
  if (isObj(raw.weekly)) {
    const w = { dismissed: date(raw.weekly.dismissed), pinned: date(raw.weekly.pinned) };
    out.weekly = Object.fromEntries(Object.entries(w).filter(([, v]) => v));
  }
  if (raw.demo === true) out.demo = true;
  return out;
}
