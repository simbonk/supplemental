# Supplemental

A private daily journal that installs on an iPhone Home Screen. Rate each day from 1 (Terrible) to 10 (Amazing), write what happened, and keep a ranked list of issues and goals. The home screen is a year-in-pixels heat map, deep purple for the hard days and white-hot for the 10s.

Live at https://simbonk.github.io/supplemental/

## Privacy

- Everything stays on the device. No server, no account, no analytics.
- The journal is one AES-256-GCM blob in `localStorage`. A random data key encrypts it, and that key is wrapped by a key derived from the 6-digit PIN with Argon2id (64 MiB, 3 passes).
- The app locks whenever the page is hidden (phone locked, app switched).
- Face ID is optional: a WebAuthn passkey with the PRF extension (iOS 18+) wraps the same data key. iOS can fall back to the phone passcode, which the Settings screen explains.
- Demo PIN `000000` opens sample data without touching the real journal.

## Code

Plain static site, no build step. `js/vault.js` and `js/crypto.js` hold all the storage and crypto; `vendor/argon2.umd.min.js` is [hash-wasm](https://github.com/Daninet/hash-wasm) 4.12.0 (MIT). Bump `VERSION` in `sw.js` when shipping changes so the offline cache refreshes.
