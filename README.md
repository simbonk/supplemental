# Supplemental

A private daily journal that installs on your iPhone Home Screen. Rate each day from 1 to 10, write a line about how it went, and keep a ranked list of the issues weighing on you and the goals you're building toward. After a few months, the year-in-pixels heat map shows patterns you couldn't see day to day.

**Try it:** open [supplemental.day](https://supplemental.day) in Safari on an iPhone, tap Share, then **Add to Home Screen**. It opens with demo data so you can look around before setting a PIN.

## What it does

- **Daily log.** A score and a short note, about a minute a day. Optional "thankful for" line.
- **Heat map.** Your year as colored squares, in one of six color themes, with light and dark modes.
- **Issues.** A ranked list of what's on your mind, with prompts to think each one through (what actually happens, what you need, how the other person might see it). A board view moves them from Noticed to Working on it to Resolved.
- **Goals.** The good stuff you're working toward, so it isn't only about what's wrong.
- **Weekly review.** A short check-in on how each issue and goal moved this week.
- **Reminders.** A daily Calendar reminder, and nudges to save a backup.

## Privacy and security

Supplemental has no server, no account and no analytics. Everything stays on your device.

- **Encrypted at rest.** The journal is stored as one AES-256-GCM blob in `localStorage`. A random 256-bit data key encrypts it, and that key is wrapped by a key derived from your PIN with Argon2id (64 MiB, 3 passes).
- **Its own PIN.** 4 to 8 digits. Use something different from your phone passcode.
- **Locks itself** whenever the phone locks or you switch apps. Decrypted data only lives in memory while unlocked.
- **Face ID (optional).** A passkey with the WebAuthn PRF extension (iOS 18+) wraps the same data key. iOS may fall back to the phone passcode for a passkey, which Settings explains.
- **Demo PIN.** All zeros by default and always the same length as the real PIN. It opens sample data instead of your journal, so nobody watching can tell which one you typed.
- **Backups** are encrypted files you save yourself. A passphrase backup uses its own random key and a heavier Argon2id setting (64 MiB, 10 passes). You can skip the passphrase and protect a backup with your PIN instead, but see the limits below.
- **Works offline,** even in airplane mode, once it has been opened.
- **Strict Content Security Policy:** no third-party scripts, no network requests beyond the app's own files.

### Limits worth knowing

- **A PIN is short.** If someone copies your encrypted data off an unlocked device, or gets a PIN-only backup file, they can try every PIN on their own computer. A 6-digit PIN has a million combinations, so expect hours, not years. The on-screen lockout after wrong guesses only slows down guessing in the app itself. Use a passphrase for backups, and a longer PIN if this matters to you.
- **The demo PIN is stored with a fast hash.** It can be recovered easily. It only reveals the demo PIN and the PIN's length, never your journal.
- **The app switcher.** iOS may take its app switcher snapshot before a web app can hide the screen, so the last screen you saw can show there. The journal is still locked.
- **Forgotten PIN.** There is no recovery. Without the PIN or a backup and its passphrase, nobody can read the journal, including you.
- **Deleting the app deletes the journal.** Keep a backup.

To report a security problem, see [SECURITY.md](SECURITY.md).

## Running it yourself

It's a static site with no build step and no dependencies to install.

```sh
git clone https://github.com/simbonk/supplemental.git
cd supplemental
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Service workers and passkeys need HTTPS (or `localhost`), so serve it over HTTPS if you want to test on a phone.

To deploy, point any static host at the repository. On Vercel, `vercel.json` adds the security headers and the calendar content type for `reminders/`.

## Code

| Path | What's there |
|---|---|
| `js/crypto.js` | Argon2id key derivation and AES-GCM helpers |
| `js/vault.js` | Storage, PIN and Face ID unlock, backups, lockout |
| `js/sanitize.js` | Checks the shape of imported backups |
| `js/app.js` | Boot, lock screen, routing, auto-lock |
| `js/home.js`, `day.js`, `items.js`, `weekly.js`, `settings.js` | The screens |
| `js/demo.js` | Sample data, regenerated relative to today |
| `sw.js` | Offline cache. Bump `VERSION` when shipping changes |
| `vendor/argon2.umd.min.js` | [hash-wasm](https://github.com/Daninet/hash-wasm) 4.12.0, unmodified (MIT) |

## Contributing

Bug reports and ideas are welcome through [Issues](https://github.com/simbonk/supplemental/issues). Please never post journal entries, PINs, passphrases or backup files, since issues are public.

## Licence

[MIT](LICENSE). hash-wasm is MIT licensed by Dani Biró; see `vendor/hash-wasm.LICENSE`.
