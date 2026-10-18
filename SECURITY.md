# Security policy

Supplemental keeps a private journal encrypted on the device, so security reports are taken seriously.

## Reporting a problem

Please report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/simbonk/supplemental/security/advisories/new), not in a public issue. Include what an attacker needs (physical access, a crafted backup file, a malicious website), the steps to reproduce, and what they gain.

You should get a reply within a week. Please give a reasonable window for a fix before disclosing publicly.

## In scope

- Reading or changing journal data without the PIN, the Face ID passkey or a backup passphrase
- Weaknesses in the key derivation, encryption or key wrapping (`js/crypto.js`, `js/vault.js`)
- Script or markup injection, including through a crafted backup file
- Bypassing the lockout from inside the app
- Anything that sends journal data off the device

## Known limits (not vulnerabilities)

These are documented trade-offs, listed in the README:

- A 4 to 8 digit PIN can be brute-forced offline by someone who already has the encrypted data or a PIN-only backup file.
- The demo PIN uses a fast hash and reveals the PIN's length.
- iOS may show the last screen in the app switcher before the app can cover it.
- Someone with an unlocked phone and the app open can read what's on screen.
