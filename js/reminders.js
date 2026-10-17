// Reminder settings: how often the weekly review and backup nudges appear, and
// the daily check-in, which is a repeating Calendar event (web apps can't
// schedule their own notifications without a server).

export const WEEKLY_CADENCES = [['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['off', 'Off']];
export const BACKUP_CADENCES = [['14', '2 weeks'], ['30', 'Monthly'], ['90', '3 months'], ['off', 'Off']];

export function reminderPrefs(data) {
  return { weekly: 'weekly', backup: '30', dailyAt: '21:00', ...(data.reminders || {}) };
}

// Half-hour slots, matching the files in reminders/.
export const DAILY_TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  return `${h}:${i % 2 ? '30' : '00'}`;
});

export function dailyIcsUrl(time) {
  return `reminders/daily-${time.replace(':', '-')}.ics`;
}

export function fmtTime(time) {
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
