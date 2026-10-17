// Shared constants, date helpers and data operations.

export const SCORE_LABELS = ['', 'Terrible', 'Awful', 'Bad', 'Rough', 'Meh', 'Okay', 'Good', 'Great', 'Excellent', 'Amazing'];

// Black for the worst days, shimmering white gold for 10/10. The actual colors
// come from the active theme (themes.js) as CSS variables --s1 … --s10.
export const SCORE_COLORS = ['', ...Array.from({ length: 10 }, (_, i) => `var(--s${i + 1})`)];

// Extra class for a score swatch: gold shimmer for 10, a faint ring for black on dark.
export const scoreClass = (n) => (n === 10 ? 'gold ink-dark' : n === 1 ? 'black' : n >= 8 ? 'ink-dark' : '');

export const FEELINGS = [
  ['Hurt', '💔'], ['Lonely', '🫥'], ['Sad', '😢'], ['Anxious', '😟'], ['Frustrated', '😤'],
  ['Angry', '😠'], ['Resentful', '😒'], ['Overwhelmed', '😵‍💫'], ['Numb', '😶'], ['Confused', '😕'],
  ['Guilty', '😣'], ['Disconnected', '🔌'], ['Hopeful', '🌱'],
];

export const AREAS = ['Marriage', 'Family', 'Kids', 'Work', 'Health', 'Money', 'Friends', 'Self', 'Home', 'Other'];

export const ISSUE_STATUSES = [
  ['noticed', 'Noticed'],
  ['working', 'Working on it'],
  ['resolved', 'Resolved'],
];

export const GOAL_STATUSES = [
  ['planned', 'Planned'],
  ['doing', 'In progress'],
  ['done', 'Achieved'],
];

export const ISSUE_PROMPTS = [
  ['facts', 'What actually happens?', 'Just the facts, as a camera would see it. No blame, no "always" or "never".'],
  ['need', 'What do I need underneath this feeling?', 'To feel respected, wanted, heard, appreciated, safe, like a team...'],
  ['story', 'What story am I telling myself about it?', '"The story I\'m telling myself is..." Is it fully true?'],
  ['theirSide', 'How might the other person see it?', 'What might they be feeling or needing? What would they say if they wrote this card?'],
  ['myPart', 'What part of this is mine?', 'Even 5%. What could I own or apologise for?'],
  ['better', 'What would "better" look like?', 'Describe a normal day where this is no longer an issue.'],
  ['ask', 'What could I ask for, gently?', 'A specific, positive request: "Could we..." rather than "You never..."'],
  ['nextStep', 'Smallest next step', 'Something doable this week.'],
];

export const ISSUE_KINDS = [
  ['unsure', 'Not sure yet'],
  ['solvable', 'Solvable'],
  ['perpetual', 'Ongoing difference to manage'],
];

export const TALKED = [
  ['not-yet', 'Not yet'],
  ['tried', 'Tried'],
  ['talking', 'We\'re talking'],
  ['help', 'With a counselor'],
];

export const GOAL_PROMPTS = [
  ['what', 'What needs to be done?', 'The finish line, in a sentence.'],
  ['why', 'Why does this matter to me?', 'Who does it make me? Who does it help?'],
  ['firstStep', 'First small step', 'Something doable in the next few days.'],
  ['withWho', 'Who is this with or for?', 'People who make this better.'],
  ['feel', 'How will it feel when it\'s done?', 'Picture it.'],
];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Dates (always local calendar days as YYYY-MM-DD) ----

export function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return iso(new Date());
}

export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export function fmtDate(s, opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  return parseISO(s).toLocaleDateString(undefined, opts);
}

export function fmtAge(fromISO, toISO = todayISO()) {
  const days = Math.max(0, daysBetween(fromISO, toISO));
  if (days === 0) return 'today';
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}wk`;
  if (days < 730) return `${Math.round(days / 30.4)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

// ---- Data ----

export function emptyData() {
  return { version: 1, days: {}, issues: [], goals: [], createdAt: Date.now() };
}

export function feelingEmoji(name) {
  const f = FEELINGS.find(([n]) => n === name);
  return f ? f[1] : '';
}

const isOpenIssue = (i) => i.status !== 'resolved';
const isOpenGoal = (g) => g.status !== 'done';

export function openIssues(data) {
  return data.issues.filter(isOpenIssue);
}

export function openGoals(data) {
  return data.goals.filter(isOpenGoal);
}

export function issueRank(data, id) {
  const open = openIssues(data);
  return { rank: open.findIndex((i) => i.id === id) + 1, total: open.length };
}

// Moves an item to a new position among the open (unfinished) items, keeping
// finished items where they are. The array order is the priority order.
export function moveOpen(list, id, toIndex, isOpen) {
  const open = list.filter(isOpen);
  const from = open.findIndex((x) => x.id === id);
  if (from < 0) return list;
  const [item] = open.splice(from, 1);
  open.splice(Math.max(0, Math.min(toIndex, open.length)), 0, item);
  const rest = list.filter((x) => !isOpen(x));
  return [...open, ...rest];
}

export const moveIssue = (data, id, toIndex) => { data.issues = moveOpen(data.issues, id, toIndex, isOpenIssue); };
export const moveGoal = (data, id, toIndex) => { data.goals = moveOpen(data.goals, id, toIndex, isOpenGoal); };

// What the issue and goal lists looked like when a day was saved.
export function snapshotIssues(data) {
  const open = openIssues(data);
  return open.map((i, idx) => ({
    id: i.id, title: i.title, rank: idx + 1, total: open.length,
    feeling: i.feeling || '', intensity: i.intensity || null, status: i.status,
  }));
}

export function snapshotGoals(data) {
  return openGoals(data).map((g, idx) => ({ id: g.id, title: g.title, rank: idx + 1, status: g.status }));
}

export function averageScore(data, fromISO, toISO) {
  const vals = Object.values(data.days).filter((d) => d.date >= fromISO && d.date <= toISO).map((d) => d.score);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function streak(data) {
  let n = 0;
  let d = todayISO();
  if (!data.days[d]) d = addDays(d, -1);
  while (data.days[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
