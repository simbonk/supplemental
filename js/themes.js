// Color themes. Every theme shares the two ends of the scale: 1/10 is black and
// 10/10 is a shimmering white gold. Only the steps in between, the accent and
// the surfaces change. The choice is a plain-text preference (no journal content).

const BLACK = { light: '#0a0a0c', dark: '#000000' };
const GOLD = '#f2d683';
const LIGHT_SHADOW = '0 1px 2px rgba(20, 10, 40, .05), 0 6px 20px rgba(20, 10, 40, .06)';

const NEUTRAL_LIGHT = { bg: '#f6f6f8', surface: '#ffffff', surface2: '#eeeef2', text: '#16161a', muted: '#6b6b76', line: '#e2e2e8', empty: '#e6e6ec' };
const NEUTRAL_DARK = { bg: '#0d0d10', surface: '#17171b', surface2: '#212127', text: '#f2f2f5', muted: '#9a9aa6', line: '#2a2a31', empty: '#222228' };

export const THEMES = {
  ember: {
    name: 'Ember',
    blurb: 'Warm and expressive. Bad days glow down to black, good days heat up to gold.',
    scale: ['#2e1065', '#4c1d95', '#6d28d9', '#a23fb0', '#d6517c', '#ee6a52', '#f98c2c', '#fbbf24'],
    light: { bg: '#f6f5f9', surface: '#ffffff', surface2: '#efedf4', text: '#17141f', muted: '#6e6a7c', line: '#e3e0ea', empty: '#e7e4ee', accent: '#6d28d9', ink: '#ffffff' },
    dark: { bg: '#0e0c14', surface: '#18151f', surface2: '#221e2b', text: '#f2f0f7', muted: '#9a95aa', line: '#2c2836', empty: '#24202d', accent: '#8b5cf6', ink: '#ffffff' },
  },
  spectrum: {
    name: 'Spectrum',
    blurb: 'The full rainbow. Black through purple, blue, green, red and orange to yellow.',
    scale: ['#3b0f6e', '#7c3aed', '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#f59e0b', '#facc15'],
    light: { bg: '#f5f5f8', surface: '#ffffff', surface2: '#ededf2', text: '#15151c', muted: '#6b6b78', line: '#e1e1e8', empty: '#e5e5ec', accent: '#6d28d9', ink: '#ffffff' },
    dark: { bg: '#0d0d12', surface: '#17171e', surface2: '#212129', text: '#f2f2f6', muted: '#9a9aa8', line: '#2a2a33', empty: '#22222a', accent: '#8b5cf6', ink: '#ffffff' },
  },
  slate: {
    name: 'Slate',
    blurb: 'Clean and corporate. Navy into clear blue, like a well-run dashboard.',
    scale: ['#1e293b', '#1e3a5f', '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
    light: { bg: '#f3f5f8', surface: '#ffffff', surface2: '#eaeef3', text: '#0f172a', muted: '#64748b', line: '#e2e8f0', empty: '#e6eaf0', accent: '#2563eb', ink: '#ffffff' },
    dark: { bg: '#0b1120', surface: '#111a2e', surface2: '#1a2540', text: '#e2e8f0', muted: '#94a3b8', line: '#24314d', empty: '#1a2338', accent: '#3b82f6', ink: '#ffffff' },
  },
  oak: {
    name: 'Oak',
    blurb: 'Earthy and steady. Bark browns grow into leaf green, then sunlight.',
    scale: ['#2b1d14', '#4a2f1d', '#6b4423', '#7f5a2a', '#7d7a34', '#5f8f3a', '#86b04a', '#c3d672'],
    light: { bg: '#f7f5f0', surface: '#ffffff', surface2: '#efece5', text: '#1c1917', muted: '#78716c', line: '#e7e2da', empty: '#ebe7df', accent: '#4d7c0f', ink: '#ffffff' },
    dark: { bg: '#12100d', surface: '#1c1915', surface2: '#27231d', text: '#f5f5f4', muted: '#a8a29e', line: '#2f2a24', empty: '#26221c', accent: '#84cc16', ink: '#14200a' },
  },
  ocean: {
    name: 'Ocean',
    blurb: 'Calm and cool. Deep water rising to bright teal shallows.',
    scale: ['#0c1a2b', '#0f2f4f', '#0e4a6e', '#0e7490', '#0891b2', '#14b8a6', '#2dd4bf', '#99f6e4'],
    light: { bg: '#f2f7f8', surface: '#ffffff', surface2: '#e8f0f2', text: '#0b1f2a', muted: '#5b7380', line: '#dbe7eb', empty: '#e1ebee', accent: '#0e7490', ink: '#ffffff' },
    dark: { bg: '#071219', surface: '#0e1c25', surface2: '#152733', text: '#e6f3f6', muted: '#8fb0bc', line: '#1d3340', empty: '#13242e', accent: '#22d3ee', ink: '#062029' },
  },
  mono: {
    name: 'Graphite',
    blurb: 'Minimal. Shades of gray, with gold saved for the days that earn it.',
    scale: ['#262626', '#3a3a3a', '#4f4f4f', '#666666', '#7f7f7f', '#999999', '#b5b5b5', '#d4d4d4'],
    light: { ...NEUTRAL_LIGHT, accent: '#18181b', ink: '#ffffff' },
    dark: { ...NEUTRAL_DARK, accent: '#f4f4f5', ink: '#18181b' },
  },
};

export const APPEARANCES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];

function pref(key, fallback) {
  try { return localStorage.getItem('supplemental:ui:' + key) || fallback; } catch { return fallback; }
}

function setPref(key, value) {
  try { localStorage.setItem('supplemental:ui:' + key, value); } catch { /* private mode */ }
}

export const currentTheme = () => (THEMES[pref('theme', 'ember')] ? pref('theme', 'ember') : 'ember');
export const currentAppearance = () => pref('appearance', 'system');

const media = window.matchMedia('(prefers-color-scheme: dark)');

// New users and the demo stay light on System, whatever the phone is set to,
// so the first impression is the bright version. Picking Dark still wins.
let keepLight = false;
export function setKeepLight(on) {
  keepLight = on;
  applyTheme();
}

const FIRST_OPEN = 'first-open';
export function inFirstDay() {
  let first = Number(pref(FIRST_OPEN, 0));
  if (!first) { first = Date.now(); setPref(FIRST_OPEN, String(first)); }
  return Date.now() - first < 86400000;
}

// True while System would be dark but the app is staying light for now.
export const lightForNow = () => keepLight && currentAppearance() === 'system' && media.matches;

export function isDark() {
  const a = currentAppearance();
  return a === 'dark' || (a === 'system' && media.matches && !keepLight);
}

export function scaleFor(themeId, dark) {
  return [dark ? BLACK.dark : BLACK.light, ...THEMES[themeId].scale, GOLD];
}

export function applyTheme() {
  const t = THEMES[currentTheme()];
  const dark = isDark();
  const c = dark ? t.dark : t.light;
  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, v);
  set('--bg', c.bg);
  set('--surface', c.surface);
  set('--surface-2', c.surface2);
  set('--text', c.text);
  set('--muted', c.muted);
  set('--line', c.line);
  set('--empty-cell', c.empty);
  set('--accent', c.accent);
  set('--accent-ink', c.ink);
  scaleFor(currentTheme(), dark).forEach((col, i) => set(`--s${i + 1}`, col));
  set('--shadow', dark ? '0 1px 2px rgba(0, 0, 0, .3), 0 8px 24px rgba(0, 0, 0, .25)' : LIGHT_SHADOW);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.scheme = dark ? 'dark' : 'light';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', c.bg));
}

export function setTheme(id) {
  setPref('theme', id);
  applyTheme();
}

export function setAppearance(a) {
  setPref('appearance', a);
  applyTheme();
}

media.addEventListener('change', applyTheme);
