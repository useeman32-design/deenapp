/**
 * Share-card generator (web): renders a premium PNG of the daily ayah / hadith
 * with the DeenLink logo and a QR code, for social sharing or saving.
 *
 * - 4 selectable designs: Classic (vector gradient), Emerald, Midnight, Cream.
 * - Dynamic height: long arabic / moderate meaning extend the card so text
 *   never clips; the bottom (QR) block stays anchored at the footer.
 */
import { Platform } from 'react-native';
import { create as createQR } from 'qrcode';

const appIcon = require('../../assets/images/icon.png');
const bgEmerald = require('../../assets/img/share-emerald.jpg');
const bgMidnight = require('../../assets/img/share-midnight.jpg');
const bgCream = require('../../assets/img/share-cream.jpg');

export interface ShareCardInput {
  kind: 'ayah' | 'hadith';
  arabic: string;
  meaning: string;
  ref: string;
}

export interface ShareDesign {
  id: string;
  name: string;
  src: number | null;
  dark: boolean;
}

export const SHARE_DESIGNS: ShareDesign[] = [
  { id: 'classic', name: 'Classic', src: null, dark: true },
  { id: 'emerald', name: 'Emerald', src: bgEmerald, dark: true },
  { id: 'midnight', name: 'Midnight', src: bgMidnight, dark: true },
  { id: 'cream', name: 'Cream', src: bgCream, dark: false },
];

const W = 1080;
const H_MIN = 1350;
const GOLD = '#D4AF37';
const GOLD_SOFT = 'rgba(212,175,55,0.4)';
const BG = '#0B0F0D';
const WHITE = '#F5F8F5';
const DARK_TEXT = '#15251C';
const DARK_SUB = 'rgba(21,37,28,0.72)';
const DARK_GOLD = '#8C6D1F';

function isWeb() {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

function rr(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function eightStar(ctx: any, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const ang = (Math.PI * i) / 8 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function loadImage(doc: any, src: number | string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    try {
      const url = typeof src === 'number' ? (src as any)?.uri : src;
      if (!url) return res(null);
      const img = new doc.defaultView.Image();
      img.src = url;
      const done = () => res(img.naturalWidth ? img : null);
      img.onload = done;
      img.onerror = () => res(null);
      setTimeout(() => res(img.naturalWidth ? img : null), 3000);
    } catch {
      res(null);
    }
  });
}

/** Draws the whole card and returns a PNG data URL. Web only. */
export async function generateShareCard(input: ShareCardInput, designId = 'classic'): Promise<string> {
  if (!isWeb()) throw new Error('share card is web-only');
  const doc = document as any;
  const design = SHARE_DESIGNS.find((dd) => dd.id === designId) ?? SHARE_DESIGNS[0];

  // make sure the app fonts are ready for canvas
  try {
    await doc.fonts.load('700 60px "Poppins-ExtraBold"', 'A');
    await doc.fonts.load('700 60px "Poppins-Bold"', 'A');
    await doc.fonts.load('500 40px "Poppins-Medium"', 'A');
    await doc.fonts.load('400 40px "Poppins-Regular"', 'A');
    await doc.fonts.load('700 90px "Amiri-Bold"', 'A');
    await doc.fonts.load('400 90px "Amiri-Regular"', 'A');
    await doc.fonts.ready;
  } catch {}

  const canvas = doc.createElement('canvas');
  canvas.width = W;
  canvas.height = H_MIN;
  const ctx = canvas.getContext('2d');

  /* measure text first → dynamic height for long content */
  ctx.font = '700 92px "Amiri-Bold"';
  ctx.direction = 'rtl';
  const arabicLines = wrapText(ctx, input.arabic, W - 320);
  ctx.direction = 'ltr';
  ctx.font = '400 44px "Poppins-Regular"';
  const mLines = wrapText(ctx, `“${input.meaning}”`, W - 300);

  const aStart = 620;
  const afterArabic = aStart + (arabicLines.length - 1) * 130 + 60;
  const afterMeaning = afterArabic + 90 + (mLines.length - 1) * 62 + 70;
  const footerTop = afterMeaning + 90;
  const H = Math.max(H_MIN, footerTop + 216 + 120);
  canvas.height = H;

  const ink = design.dark ? WHITE : DARK_TEXT;
  const inkSub = design.dark ? 'rgba(245,248,245,0.82)' : DARK_SUB;
  const inkGold = design.dark ? GOLD : DARK_GOLD;
  const frameGold = design.dark ? GOLD : 'rgba(140,109,31,0.8)';

  /* background: design image (cover) or classic vector gradient */
  if (design.src != null) {
    const bg = await loadImage(doc, design.src);
    if (bg) {
      const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
      const dw = bg.naturalWidth * s;
      const dh = bg.naturalHeight * s;
      ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
    }
    // readability scrim (darker for dark designs, lighter for cream)
    const scrim = ctx.createLinearGradient(0, 0, 0, H);
    if (design.dark) {
      scrim.addColorStop(0, 'rgba(0,0,0,0.34)');
      scrim.addColorStop(0.4, 'rgba(0,0,0,0.12)');
      scrim.addColorStop(1, 'rgba(0,0,0,0.30)');
    } else {
      scrim.addColorStop(0, 'rgba(255,255,255,0.24)');
      scrim.addColorStop(0.45, 'rgba(255,255,255,0.05)');
      scrim.addColorStop(1, 'rgba(255,255,255,0.22)');
    }
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 220, 60, W / 2, 220, 720);
    glow.addColorStop(0, 'rgba(212,175,55,0.16)');
    glow.addColorStop(0.45, 'rgba(20,60,40,0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  /* frames */
  ctx.strokeStyle = frameGold;
  ctx.lineWidth = 3;
  rr(ctx, 30, 30, W - 60, H - 60, 26);
  ctx.stroke();
  ctx.strokeStyle = design.dark ? GOLD_SOFT : 'rgba(140,109,31,0.35)';
  ctx.lineWidth = 1;
  rr(ctx, 46, 46, W - 92, H - 92, 18);
  ctx.stroke();

  /* corner stars */
  ctx.fillStyle = design.dark ? GOLD_SOFT : 'rgba(140,109,31,0.4)';
  for (const [cx, cy] of [
    [46, 46],
    [W - 46, 46],
    [46, H - 46],
    [W - 46, H - 46],
  ]) {
    eightStar(ctx, cx, cy, 13);
    ctx.fill();
  }

  /* logo */
  const icon = await loadImage(doc, appIcon);
  let wordmarkY = 220;
  if (icon) {
    const s = 150;
    rr(ctx, W / 2 - s / 2, 100, s, s, 34);
    ctx.save();
    ctx.clip();
    ctx.drawImage(icon, W / 2 - s / 2, 100, s, s);
    ctx.restore();
    wordmarkY = 330;
  }

  /* wordmark */
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = '700 58px "Poppins-ExtraBold"';
  (ctx as any).letterSpacing = '10px';
  ctx.fillText('DEENLINK', W / 2, wordmarkY);
  (ctx as any).letterSpacing = '4px';
  ctx.fillStyle = inkGold;
  ctx.font = '500 26px "Poppins-Medium"';
  ctx.fillText('deenlink.org', W / 2, wordmarkY + 42);
  (ctx as any).letterSpacing = '0px';

  /* eyebrow */
  const eyY = wordmarkY + 140;
  ctx.fillStyle = inkGold;
  ctx.font = '700 30px "Poppins-Bold"';
  (ctx as any).letterSpacing = '9px';
  const label = input.kind === 'hadith' ? 'DAILY HADITH' : 'DAILY AYAH';
  ctx.fillText(label, W / 2, eyY);
  (ctx as any).letterSpacing = '0px';
  const lw = ctx.measureText(label).width / 2;
  ctx.strokeStyle = design.dark ? GOLD_SOFT : 'rgba(140,109,31,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lw - 90, eyY - 10);
  ctx.lineTo(W / 2 - lw - 30, eyY - 10);
  ctx.moveTo(W / 2 + lw + 30, eyY - 10);
  ctx.lineTo(W / 2 + lw + 90, eyY - 10);
  ctx.stroke();

  /* arabic */
  ctx.fillStyle = ink;
  ctx.font = '700 92px "Amiri-Bold"';
  ctx.direction = 'rtl';
  arabicLines.forEach((ln, i) => ctx.fillText(ln, W / 2, aStart + i * 130));
  ctx.direction = 'ltr';

  /* divider */
  ctx.strokeStyle = inkGold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, afterArabic);
  ctx.lineTo(W / 2 + 70, afterArabic);
  ctx.stroke();
  ctx.fillStyle = inkGold;
  ctx.beginPath();
  ctx.arc(W / 2, afterArabic, 4, 0, Math.PI * 2);
  ctx.fill();

  /* meaning */
  ctx.fillStyle = inkSub;
  ctx.font = '400 44px "Poppins-Regular"';
  mLines.forEach((ln, i) => ctx.fillText(ln, W / 2, afterArabic + 90 + i * 62));

  /* ref */
  ctx.fillStyle = inkGold;
  ctx.font = '700 32px "Poppins-Bold"';
  ctx.fillText(input.ref, W / 2, afterMeaning);

  /* bottom: QR + caption (anchored to the real bottom of the dynamic card) */
  const boxS = 216;
  const bx = W - 120 - boxS;
  const by = H - 120 - boxS;
  ctx.fillStyle = design.dark ? '#FFFFFF' : '#FFFFFF';
  rr(ctx, bx, by, boxS, boxS, 22);
  ctx.fill();
  try {
    const qr = createQR('https://deenlink.org', { errorCorrectionLevel: 'M', margin: 1 });
    const size = qr.modules.size;
    const cell = Math.floor((boxS - 36) / size);
    const off = (boxS - cell * size) / 2;
    ctx.fillStyle = design.dark ? BG : '#FFFFFF';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qr.modules.get(x, y)) {
          ctx.fillRect(bx + off + x * cell, by + off + y * cell, cell - 0.5, cell - 0.5);
        }
      }
    }
  } catch {}

  ctx.textAlign = 'right';
  ctx.fillStyle = ink;
  ctx.font = '700 34px "Poppins-Bold"';
  ctx.fillText('Scan to explore', bx - 40, by + boxS / 2 - 14);
  ctx.fillStyle = inkSub;
  ctx.font = '400 30px "Poppins-Regular"';
  ctx.fillText('the DeenLink app', bx - 40, by + boxS / 2 + 34);
  ctx.textAlign = 'center';

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  if (!isWeb()) return;
  const doc = document as any;
  const a = doc.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
}

/** Tries Web Share (with the image file on mobile), falls back to download. */
export async function shareOrSaveCard(dataUrl: string, filename: string, textMessage: string): Promise<'shared' | 'saved'> {
  if (!isWeb()) return 'saved';
  const nav = (globalThis as any).navigator;
  try {
    if (nav?.canShare) {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: textMessage });
        return 'shared';
      }
    }
  } catch {}
  downloadDataUrl(dataUrl, filename);
  return 'saved';
}
