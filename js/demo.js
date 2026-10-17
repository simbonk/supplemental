// A month of made-up sample data so people can poke around before setting a PIN.

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
  ],
};

const THANKFUL = [
  'Morning coffee on the porch', 'A hug I didn\'t expect', 'My brother checking in', 'Good health',
  'The kids\' laughter at dinner', 'A warm bed', 'Grandpa\'s old watch', 'Sunshine on the walk home', '',
  '', '',
];

export function makeDemoData() {
  const rand = seeded(1701);
  const today = todayISO();
  const data = emptyData();
  data.demo = true;

  data.issues = [
    {
      id: uid(), title: 'We feel like roommates, not partners', area: 'Marriage', status: 'working',
      startedAt: addDays(today, -120), feeling: 'Lonely', intensity: 8, kind: 'solvable', talked: 'tried',
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
      startedAt: addDays(today, -75), feeling: 'Frustrated', intensity: 6, kind: 'perpetual', talked: 'not-yet',
      notes: { facts: 'Dishes, laundry and school forms. The same fight every few days.', need: 'To feel like a team.' },
      createdAt: Date.now(),
    },
    {
      id: uid(), title: 'Work stress spilling into home', area: 'Work', status: 'working',
      startedAt: addDays(today, -40), feeling: 'Overwhelmed', intensity: 7, kind: 'solvable', talked: 'talking',
      notes: { nextStep: 'Laptop closed by 7pm, three nights this week.' }, createdAt: Date.now(),
    },
    {
      id: uid(), title: 'Not sleeping enough', area: 'Health', status: 'noticed',
      startedAt: addDays(today, -21), feeling: 'Anxious', intensity: 5, kind: 'unsure', talked: 'not-yet',
      notes: {}, createdAt: Date.now(),
    },
    {
      id: uid(), title: 'Haven\'t called Dad in months', area: 'Family', status: 'resolved',
      startedAt: addDays(today, -90), feeling: 'Guilty', intensity: 4, kind: 'solvable', talked: 'talking',
      notes: {}, createdAt: Date.now(), doneAt: addDays(today, -12),
    },
  ];

  data.goals = [
    {
      id: uid(), title: 'Plan a weekend away, just the two of us', area: 'Marriage', status: 'doing',
      addedAt: addDays(today, -18), targetDate: addDays(today, 40),
      notes: { what: 'Book somewhere two hours away, line up the grandparents.', why: 'We used to be best friends. I want that back.', firstStep: 'Ask her which weekend.' },
    },
    {
      id: uid(), title: 'Make a photo book of Grandpa', area: 'Family', status: 'planned',
      addedAt: addDays(today, -9),
      notes: { what: 'Scan the old albums and make a book for the family.', why: 'He was the oak at the centre of the family. The kids should know him.', withWho: 'Aunties and cousins.' },
    },
    {
      id: uid(), title: 'Run a 10k', area: 'Health', status: 'planned', addedAt: addDays(today, -25),
      notes: { firstStep: 'Three easy runs this week.' },
    },
    {
      id: uid(), title: 'Teach the kids to ride bikes', area: 'Kids', status: 'done', addedAt: addDays(today, -28),
      doneAt: addDays(today, -4), notes: {},
    },
  ];

  for (let i = 29; i >= 0; i--) {
    const date = addDays(today, -i);
    if (i > 0 && rand() < 0.1) continue; // a few skipped days look realistic
    const wave = Math.sin((30 - i) / 4.5) * 1.8;
    let score = Math.round(5.6 + wave + (rand() - 0.5) * 4);
    score = Math.max(1, Math.min(10, score));
    const pool = score <= 3 ? NOTES.low : score >= 8 ? NOTES.high : NOTES.mid;
    const issuesThen = data.issues.filter((x) => x.startedAt <= date && (!x.doneAt || x.doneAt > date));
    const goalsThen = data.goals.filter((g) => g.addedAt <= date && (!g.doneAt || g.doneAt > date));
    data.days[date] = {
      date,
      score,
      note: pool[Math.floor(rand() * pool.length)],
      thankful: THANKFUL[Math.floor(rand() * THANKFUL.length)],
      issues: issuesThen.map((x, idx) => ({
        id: x.id, title: x.title, rank: idx + 1, total: issuesThen.length, feeling: x.feeling, intensity: x.intensity, status: x.status,
      })),
      goals: goalsThen.map((g, idx) => ({ id: g.id, title: g.title, rank: idx + 1, status: g.status })),
      updatedAt: Date.now(),
    };
  }
  return data;
}
