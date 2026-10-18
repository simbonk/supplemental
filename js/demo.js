// A year of made-up sample data so people can poke around before setting a PIN.

import { addDays, todayISO, emptyData, uid } from './model.js';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NOTES = {
  low: [
    'Argument about the schedule turned into an argument about everything. Went to bed without talking.',
    'Felt invisible at dinner. Everyone on their phones, me included.',
    'Work deadline slipped again. Snapped at the kids and felt awful afterwards.',
    'Bad sleep, short fuse. Not my best self today.',
    'Said things I regret. Slept on the couch.',
    'Felt completely alone in a full house.',
  ],
  mid: [
    'Ordinary day. Got through the to-do list, quiet evening.',
    'Long day at work but a decent walk at lunch helped.',
    'Some tension in the morning, but we were kind to each other by the evening.',
    'Did the grocery run together. Small talk, but it was nice to be on the same side of something.',
    'Tired. Watched a show, went to bed early.',
  ],
  high: [
    'Really good talk after the kids were asleep. Felt heard for the first time in a while.',
    'Saturday pancakes, park, and a long phone call with Mum. Full heart.',
    'Shipped the project. Team took me out for lunch.',
    'Date night! Tried the new Thai place and laughed a lot.',
    'Went through old photos of Grandpa. So many of him right in the middle of everyone.',
    'Whole family at the beach. Nobody wanted to leave.',
    'She left a note in my bag. Made my whole week.',
  ],
};

const THANKFUL = [
  'Morning coffee on the porch', 'A hug I didn\'t expect', 'My brother checking in', 'Good health',
  'The kids\' laughter at dinner', 'A warm bed', 'Grandpa\'s old watch', 'Sunshine on the walk home',
];

export function makeDemoData() {
  const rand = seeded(1701);
  const today = todayISO();
  const data = emptyData();
  data.demo = true;

  data.issues = [
    {
      id: uid(), title: 'We feel like roommates, not partners', area: 'Marriage', status: 'working',
      startedAt: addDays(today, -230), feeling: 'Lonely', intensity: 8, kind: 'solvable', talked: 'tried',
      notes: {
        facts: 'Most evenings we\'re in separate rooms after the kids go down.',
        need: 'To feel wanted and chosen.',
        story: 'That she\'d rather be alone than with me. Probably not fully true; she\'s exhausted too.',
        better: 'Twenty minutes together most nights, phones away.',
        nextStep: 'Ask about a standing Thursday walk.',
      },
      createdAt: Date.now(),
    },
    {
      id: uid(), title: 'Arguments about chores and the mental load', area: 'Marriage', status: 'noticed',
      startedAt: addDays(today, -160), feeling: 'Frustrated', intensity: 6, kind: 'perpetual', talked: 'not-yet',
      notes: { facts: 'Dishes, laundry and school forms. The same fight every few days.', need: 'To feel like a team.' },
      createdAt: Date.now(),
    },
    {
      id: uid(), title: 'Work stress spilling into home', area: 'Work', status: 'working',
      startedAt: addDays(today, -95), feeling: 'Overwhelmed', intensity: 7, kind: 'solvable', talked: 'talking',
      notes: { nextStep: 'Laptop closed by 7pm, three nights this week.' }, createdAt: Date.now(),
    },
    {
      id: uid(), title: 'Not sleeping enough', area: 'Health', status: 'noticed',
      startedAt: addDays(today, -40), feeling: 'Anxious', intensity: 5, kind: 'unsure', talked: 'not-yet',
      notes: {}, createdAt: Date.now(),
    },
    {
      id: uid(), title: 'Haven\'t called Dad in months', area: 'Family', status: 'resolved',
      startedAt: addDays(today, -300), feeling: 'Guilty', intensity: 4, kind: 'solvable', talked: 'talking',
      notes: {}, createdAt: Date.now(), doneAt: addDays(today, -6),
    },
  ];

  data.goals = [
    {
      id: uid(), title: 'Plan a weekend away, just the two of us', area: 'Marriage', status: 'doing',
      addedAt: addDays(today, -60), targetDate: addDays(today, 40),
      notes: { what: 'Book somewhere two hours away, line up the grandparents.', why: 'We used to be best friends. I want that back.', firstStep: 'Ask her which weekend.' },
    },
    {
      id: uid(), title: 'Make a photo book of Grandpa', area: 'Family', status: 'planned',
      addedAt: addDays(today, -120),
      notes: { what: 'Scan the old albums and make a book for the family.', why: 'He was the oak at the centre of the family. The kids should know him.', withWho: 'Aunties and cousins.' },
    },
    {
      id: uid(), title: 'Run a 10k', area: 'Health', status: 'planned', addedAt: addDays(today, -25),
      notes: { firstStep: 'Three easy runs this week.' },
    },
    {
      id: uid(), title: 'Teach the kids to ride bikes', area: 'Kids', status: 'done', addedAt: addDays(today, -210),
      doneAt: addDays(today, -150), notes: {},
    },
    {
      id: uid(), title: 'Family trip to the coast', area: 'Family', status: 'done', addedAt: addDays(today, -160),
      doneAt: addDays(today, -3), notes: { why: 'Everyone together, no screens.' },
    },
  ];

  // A year of days. Most get just a score; the black and gold days get the story.
  const goalDays = new Map(data.goals.filter((g) => g.doneAt).map((g) => [g.doneAt, g]));
  const fixDays = new Map(data.issues.filter((x) => x.doneAt).map((x) => [x.doneAt, x]));
  for (let i = 364; i >= 0; i--) {
    const date = addDays(today, -i);
    const goal = goalDays.get(date);
    const fixed = fixDays.get(date);
    if (i > 0 && !goal && !fixed && rand() < 0.07) continue;
    const season = Math.sin(((365 - i) / 365) * Math.PI * 4) * 1.1;
    const roughPatch = i < 260 && i > 190 ? -1.4 : 0;
    let score = Math.round(6 + season + roughPatch + (rand() - 0.5) * 3.6);
    const r = rand();
    if (r < 0.03) score = rand() < 0.5 ? 1 : 2;
    else if (r > 0.985) score = 10;
    if (goal || fixed) score = 10;
    score = Math.max(1, Math.min(10, score));
    let note = '';
    if (goal) note = `Goal achieved: ${goal.title}. ${NOTES.high[Math.floor(rand() * NOTES.high.length)]}`;
    else if (fixed) note = 'Called Dad after months of putting it off. We talked for an hour and he sounded so happy.';
    else if (score <= 2) note = NOTES.low[Math.floor(rand() * NOTES.low.length)];
    else if (score === 10) note = NOTES.high[Math.floor(rand() * NOTES.high.length)];
    else if (rand() < 0.12) note = NOTES.mid[Math.floor(rand() * NOTES.mid.length)];
    const issuesThen = data.issues.filter((x) => x.startedAt <= date && (!x.doneAt || x.doneAt > date));
    const goalsThen = data.goals.filter((g) => g.addedAt <= date && (!g.doneAt || g.doneAt >= date));
    data.days[date] = {
      date,
      score,
      note,
      thankful: rand() < 0.5 ? THANKFUL[Math.floor(rand() * THANKFUL.length)] : '',
      issues: issuesThen.map((x, idx) => ({
        id: x.id, title: x.title, rank: idx + 1, total: issuesThen.length, feeling: x.feeling, intensity: x.intensity, status: x.status,
      })),
      goals: goalsThen.map((g, idx) => ({ id: g.id, title: g.title, rank: idx + 1, status: g.doneAt === date ? 'done' : g.status === 'done' ? 'doing' : g.status })),
      updatedAt: Date.now(),
    };
  }
  return data;
}
