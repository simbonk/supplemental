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

export const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

// Apple: webcal:// hands the feed straight to Calendar as a subscription (opening the
// plain .ics from a Home Screen app only showed a blank page).
// Everyone else: Google Calendar's "new event" link, prefilled to repeat daily.
export function dailyIcsUrl(time) {
  if (isApple) {
    const path = `reminders/daily-${time.replace(':', '-')}.ics`;
    return `webcal://${location.host}${location.pathname.replace(/[^/]*$/, '')}${path}`;
  }
  const [h, m] = time.split(':').map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  if (start < new Date()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 5 * 60000);
  const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Supplemental',
    details: 'How was today? Take a minute to log it.',
    dates: `${stamp(start)}/${stamp(end)}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recur: 'RRULE:FREQ=DAILY',
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function dailyHint() {
  return isApple
    ? 'Adds a daily "Supplemental" event with an alert to your phone\'s Calendar. When Calendar opens, keep <strong>Event Alerts</strong> on and tap the checkmark. To stop it, delete that calendar in the Calendar app.'
    : 'Opens Google Calendar with a daily "Supplemental" event filled in. Check it repeats <strong>Daily</strong>, set a notification <strong>at time of event</strong>, then tap <strong>Save</strong>. To stop it, delete the event and choose <strong>All events</strong>.';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function fmtTime(time) {
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
