// What kind of device the app is running on. Two separate questions:
// - Layout: a wide window with a mouse or trackpad gets the desktop layout
//   (menu at the top). Phones and touch-first tablets keep the mobile layout.
// - Wording: phones and tablets (iPad included, which reports itself as a Mac)
//   say "phone" and "tap"; computers say "computer" and "click".

const ua = navigator.userAgent;
const iPad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;

export const desktopQuery = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
export const isMobileOS = /iPhone|iPad|iPod|Android/.test(ua) || iPad;
export const isComputer = !isMobileOS;
export const isMac = /Macintosh/.test(ua) && !iPad;
export const isWindows = /Windows/.test(ua);
// Safari on a Mac (not Chrome, Edge, Firefox or another browser that also says "Safari").
export const isMacSafari = isMac && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua);

export const device = isComputer ? 'computer' : 'phone';
export const tap = isComputer ? 'click' : 'tap';
export const Tap = isComputer ? 'Click' : 'Tap';
export const passcode = isComputer ? 'computer password' : 'phone passcode';
// The platform's name for unlocking with a fingerprint or face.
export const bioName = isMac ? 'Touch ID' : isWindows ? 'Windows Hello' : isComputer ? 'Fingerprint' : 'Face ID';
