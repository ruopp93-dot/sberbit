// In-memory captcha store with SVG image generation.
// Each challenge has a token, answer, image (distorted SVG), and expires after TTL.
import { randomUUID } from 'crypto';

type CaptchaEntry = { answer: string; expiresAt: number; attemptsLeft: number };

const globalKey = '__SB_CAPTCHA_STORE_V2__';
const _global: any = (globalThis as any) || {};
if (!_global[globalKey]) {
  _global[globalKey] = new Map<string, CaptchaEntry>();
}
const store: Map<string, CaptchaEntry> = _global[globalKey];
const TTL_MS = 1000 * 60 * 5; // 5 minutes

// Seeded pseudo-random to get deterministic noise per captcha
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0xffffffff);
  };
}

function generateSvgCaptcha(question: string, seed: number): string {
  const rng = seededRng(seed);
  const W = 220;
  const H = 64;

  // Background noise dots
  const dots = Array.from({ length: 50 }, () => {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * H);
    const r = rng() * 2 + 0.5;
    const opacity = (rng() * 0.35 + 0.15).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="rgba(160,140,230,${opacity})"/>`;
  }).join('');

  // Interference lines
  const lines = Array.from({ length: 4 }, () => {
    const x1 = Math.floor(rng() * W);
    const y1 = Math.floor(rng() * H);
    const x2 = Math.floor(rng() * W);
    const y2 = Math.floor(rng() * H);
    const opacity = (rng() * 0.3 + 0.1).toFixed(2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(130,110,200,${opacity})" stroke-width="1"/>`;
  }).join('');

  // Render characters with per-char offset and rotation
  const chars = question.split('');
  const charW = 22;
  const totalWidth = chars.length * charW;
  const startX = Math.floor((W - totalWidth) / 2) + 4;
  const palette = ['#c4aaff', '#a78bfa', '#e2d9ff', '#ddd6fe', '#f0ebff'];

  const charElements = chars.map((ch, i) => {
    const baseX = startX + i * charW;
    const jitterX = (rng() * 6 - 3).toFixed(1);
    const jitterY = (rng() * 8 - 4).toFixed(1);
    const x = (baseX + parseFloat(jitterX)).toFixed(1);
    const y = (40 + parseFloat(jitterY)).toFixed(1);
    const rotate = (rng() * 24 - 12).toFixed(1);
    const color = palette[Math.floor(rng() * palette.length)];
    const fontSize = Math.floor(rng() * 4 + 24); // 24–27px
    // Escape special XML chars (only &, <, > needed here)
    const safe = ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
    return `<text x="${x}" y="${y}" transform="rotate(${rotate},${x},${y})" font-family="'Courier New',monospace" font-size="${fontSize}" font-weight="bold" fill="${color}">${safe}</text>`;
  }).join('');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" rx="10" fill="#160840"/>`,
    `<rect width="${W}" height="${H}" rx="10" fill="url(#grad)"/>`,
    `<defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="#1a0a48"/><stop offset="100%" stop-color="#0d0628"/>`,
    `</linearGradient></defs>`,
    lines,
    dots,
    charElements,
    `</svg>`,
  ].join('');

  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function createQuestion(): { question: string; answer: number } {
  const type = Math.floor(Math.random() * 3); // 0=add, 1=sub, 2=mul
  let a: number, b: number;
  if (type === 1) {
    // Subtraction: ensure positive result
    b = Math.floor(Math.random() * 9) + 1;
    a = b + Math.floor(Math.random() * 9) + 1;
    return { question: `${a} \u2212 ${b} = ?`, answer: a - b };
  }
  if (type === 2) {
    // Multiplication by small numbers (2–5)
    a = Math.floor(Math.random() * 8) + 2;
    b = Math.floor(Math.random() * 4) + 2;
    return { question: `${a} \u00D7 ${b} = ?`, answer: a * b };
  }
  // Addition: 1–15
  a = Math.floor(Math.random() * 15) + 1;
  b = Math.floor(Math.random() * 15) + 1;
  return { question: `${a} + ${b} = ?`, answer: a + b };
}

export const CaptchaStore = {
  create(): { token: string; imageData: string } {
    const { question, answer } = createQuestion();
    const token = randomUUID();
    const seed = Math.floor(Math.random() * 0xffffff);
    const imageData = generateSvgCaptcha(question, seed);
    store.set(token, { answer: String(answer), expiresAt: Date.now() + TTL_MS, attemptsLeft: 3 });
    return { token, imageData };
  },

  validate(token?: string, answer?: string) {
    if (!token || answer == null) return false;
    const entry = store.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      store.delete(token);
      return false;
    }
    const cleaned = String(answer).trim();
    const ok = Number(entry.answer) === Number(cleaned);
    if (ok) {
      store.delete(token);
      return true;
    }
    entry.attemptsLeft = (entry.attemptsLeft ?? 1) - 1;
    if (entry.attemptsLeft <= 0) {
      store.delete(token);
    } else {
      store.set(token, entry);
    }
    return false;
  },

  peek(token?: string) {
    if (!token) return undefined;
    const entry = store.get(token);
    if (!entry) return undefined;
    return { answer: entry.answer, expiresAt: entry.expiresAt, attemptsLeft: entry.attemptsLeft };
  },
};
