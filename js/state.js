// In-memory app state. Decrypted data only ever lives here, and is dropped on lock.

import * as vault from './vault.js';
import { toast } from './ui.js';

export const state = {
  mode: null, // 'demo' (sample data, never saved) or 'real'
  data: null,
  session: null,
  hasVault: false,
  sharing: false, // true while the iOS share sheet is up
};

// Set by app.js
export const nav = {
  go: () => {},
  refresh: () => {},
};

let saving = Promise.resolve();

export function persist() {
  if (state.mode !== 'real') return Promise.resolve();
  const { session, data } = state;
  saving = saving
    .then(() => vault.save(session, data))
    .catch((e) => {
      console.error(e);
      toast('Could not save. Is storage full?');
    });
  return saving;
}
