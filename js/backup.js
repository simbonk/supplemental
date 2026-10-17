// Export and the monthly "time to back up" reminder on Home.

import * as vault from './vault.js';
import { state, persist } from './state.js';
import { todayISO, addDays, fmtDate } from './model.js';
import { esc, toast, openSheet } from './ui.js';
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

// Six random words from 250 is about 48 bits; with the backup's Argon2id setting
// that is far beyond guessing, even with GPUs.
const WORDS = 'acorn admiral almond amber anchor anvil apple apron arrow aspen atlas autumn badge bagel bakery bamboo banjo barn basil beacon beaver berry bicycle birch biscuit bison blanket blossom bonfire bramble breeze brick bridge brook bucket buffalo butter cabin cactus camel candle canoe canyon carrot castle cedar cello chalk cherry chestnut cider cinnamon circus clover cobalt cobble coconut comet compass copper coral cottage cotton coyote crayon cricket crystal cupcake daffodil daisy dolphin donkey dragon drizzle dune eagle echo ember emerald falcon feather fennel fern ferry fiddle fig flannel flute forest fossil fountain fox galaxy garden garnet gecko ginger glacier goose granite grape gravel guitar harbor harvest hazel hedge heron hickory honey horizon husky iceberg igloo indigo island ivory jacket jasmine jelly jigsaw juniper kayak kettle kiwi koala ladder lagoon lantern lavender lemon lilac lobster locket lotus lumber magnet mango maple marble meadow melon mitten molasses monsoon moose mosaic muffin mustard nectar nickel nutmeg oasis oatmeal ocean olive onion orchard otter owl paddle pancake panda paper parrot pasta peach pebble pelican pepper pickle pigeon pillow pine planet plum pocket pony poppy prairie pretzel puddle pumpkin quartz quill quilt rabbit raccoon radish rainbow raven reef ribbon river robin rocket rose saddle saffron salmon sapphire satchel scarf seashell shadow sherbet silver sketch sled sparrow spinach sprout squirrel stable starfish stone sunset swan tangerine teapot thistle thunder tiger timber toast tomato topaz tractor trumpet tulip tundra turnip turtle umbrella valley velvet violin volcano waffle walnut walrus willow window winter wizard wombat yarn yogurt zebra zephyr'.split(' ');
const MIN_LENGTH = 12;

function suggestPassphrase() {
  const out = [];
  while (out.length < 6) {
    const n = crypto.getRandomValues(new Uint8Array(1))[0];
    if (n < WORDS.length) out.push(WORDS[n]);
  }
  return out.join('-');
}

// Returns true once the file was handed off (shared, saved or downloaded).
export function exportJournal() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const s = openSheet(`
      <h2 class="sheet-title">Add a passphrase?</h2>
      <p class="muted small">Optional, but recommended. A backup file can end up in iCloud Drive or email, where anyone who gets it can try every PIN at their own pace. A 6-digit PIN has only a million combinations, which a fast computer can work through in hours. A long passphrase would take centuries.</p>
      <p class="muted small">Write it down somewhere safe. Without it, nobody can open the backup, including you.</p>
      <label class="field"><span class="field-label">Passphrase</span>
        <input type="text" data-pass autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="At least ${MIN_LENGTH} characters"></label>
      <button type="button" class="link-btn" data-suggest>Suggest one for me</button>
      <label class="field mt"><span class="field-label">Type it again</span>
        <input type="text" data-pass2 autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <p class="small muted" data-pass-hint></p>
      <div class="stack gap-s mt">
        <button class="btn primary block" data-make disabled>Create backup</button>
        <button class="btn ghost block" data-pin-only>Skip, protect it with my PIN</button>
      </div>`, { onClose: () => finish(false) });
    const el = s.el;
    const pass = el.querySelector('[data-pass]');
    const pass2 = el.querySelector('[data-pass2]');
    const hint = el.querySelector('[data-pass-hint]');
    const make = el.querySelector('[data-make]');
    const check = () => {
      const a = pass.value.trim();
      const b = pass2.value.trim();
      make.disabled = a.length < MIN_LENGTH || a !== b;
      hint.textContent = a.length && a.length < MIN_LENGTH ? `${MIN_LENGTH - a.length} more characters to go.`
        : b && a !== b ? "The two don't match yet." : '';
    };
    pass.addEventListener('input', check);
    pass2.addEventListener('input', check);
    el.querySelector('[data-suggest]').addEventListener('click', () => {
      pass.value = suggestPassphrase();
      pass2.value = '';
      check();
      pass2.focus();
    });
    const ready = (text, how) => {
      // Sharing needs a fresh tap, so the file is handed off from a second button.
      el.innerHTML = `
        <h2 class="sheet-title">Backup ready</h2>
        <p class="muted small">Save it to Files or iCloud Drive. To restore it later, use Import journal and enter ${how}.</p>
        <div class="stack gap-s mt"><button class="btn primary block" data-save>Save backup file</button></div>`;
      el.querySelector('[data-save]').addEventListener('click', async () => {
        const ok = await saveFile(text);
        if (ok) { finish(true); s.close(); }
      });
    };
    make.addEventListener('click', async () => {
      if (make.disabled) return;
      make.disabled = true;
      make.textContent = 'Encrypting…';
      try {
        ready(await vault.exportBackup(state.data, pass.value.trim()), 'this passphrase');
      } catch (e) {
        console.error(e);
        toast('Could not create the backup');
        make.disabled = false;
        make.textContent = 'Create backup';
      }
    });
    el.querySelector('[data-pin-only]').addEventListener('click', () => ready(vault.exportPinBackup(), 'the PIN you have today'));
  });
}

async function saveFile(text) {
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
