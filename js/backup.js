// Export and the monthly "time to back up" reminder on Home.

import * as vault from './vault.js';
import { state, persist } from './state.js';
import { todayISO, addDays, fmtDate } from './model.js';
import { esc, toast } from './ui.js';
import { reminderPrefs } from './reminders.js';

const SNOOZE_DAYS = 7;

export function lastBackup(data) {
  return data.backup?.lastAt || null; // YYYY-MM-DD
}

// Due the chosen number of days after the last backup, or once a week of days is logged if there has never been one.
export function backupDue(data) {
  const every = reminderPrefs(data).backup;
  if (state.mode !== 'real' || every === 'off') return false;
  const today = todayISO();
  const b = data.backup || {};
  if (b.snoozeUntil && b.snoozeUntil > today) return false;
  if (b.lastAt) return addDays(b.lastAt, Number(every)) <= today;
  return Object.keys(data.days).length >= 7;
}

export function backupNagHTML(data) {
  const last = lastBackup(data);
  return `<section class="card backup-nag">
    <div class="backup-nag-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 19h14"/></svg>
    </div>
    <div class="backup-nag-text">
      <strong>Time to save a backup</strong>
      <div class="muted small">${last ? `Last one was ${esc(fmtDate(last, { month: 'short', day: 'numeric' }))}.` : 'You haven\'t saved one yet.'} If the app is ever deleted, a backup is the only copy.</div>
      <div class="backup-nag-btns">
        <button type="button" class="btn primary small" data-backup-now>Back up now</button>
        <button type="button" class="btn ghost small" data-backup-later>Later</button>
      </div>
    </div>
  </section>`;
}

export function bindBackupNag(root, refresh) {
  root.querySelector('[data-backup-now]')?.addEventListener('click', async () => {
    if (await exportJournal()) refresh();
  });
  root.querySelector('[data-backup-later]')?.addEventListener('click', async () => {
    state.data.backup = { ...(state.data.backup || {}), snoozeUntil: addDays(todayISO(), SNOOZE_DAYS) };
    await persist();
    refresh();
  });
}

async function markBackedUp() {
  state.data.backup = { lastAt: todayISO() };
  await persist();
}

// Returns true once the file was handed off (shared, saved or downloaded).
export async function exportJournal() {
  const text = vault.exportBackup();
  const name = `supplemental-${todayISO()}.json`;
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    // The share sheet takes focus; don't blur the app behind it.
    state.sharing = true;
    try {
      await navigator.share({ files: [file] });
      await markBackedUp();
      toast('Backup saved');
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      console.error(e);
    } finally {
      state.sharing = false;
      document.body.classList.remove('privacy');
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  await markBackedUp();
  return true;
}
