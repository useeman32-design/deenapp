/**
 * Share-card generator (web): renders a premium 1080×1350 PNG of the daily
 * ayah / hadith with the DeenLink logo and a QR code, for social sharing
 * or saving to the phone.
 */
import { Platform } from 'react-native';
import { create as createQR } from 'qrcode';

const appIcon = require('../../assets/images/icon.png');

export interface ShareCardInput {
  kind: 'ayah' | 'hadith';
  arabic: string;
  meaning: string;
  ref: string;
}

const W = 1080;
const H = 1350;
const GOLD = '#D4AF37';
const GOLD_SOFT = 'rgba(212,175,55,0.4)';
const BG = '#0B0F0D';
const WHITE = '#F5F8F5';

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

/** Draws the whole card and returns a PNG data URL. Web only. */
export async function generateShareCard(input: ShareCardInput): Promise<string> {
  if (!isWeb()) throw new Error('share card is web-only');
  const doc = document as any;

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
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  /* background + glow */
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 220, 60, W / 2, 220, 720);
  glow.addColorStop(0, 'rgba(212,175,55,0.16)');
  glow.addColorStop(0.45, 'rgba(20,60,40,0.18)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  /* frames */
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  rr(ctx, 30, 30, W - 60, H - 60, 26);
  ctx.stroke();
  ctx.strokeStyle = GOLD_SOFT;
  ctx.lineWidth = 1;
  rr(ctx, 46, 46, W - 92, H - 92, 18);
  ctx.stroke();

  /* corner stars */
  ctx.fillStyle = GOLD_SOFT;
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
  const iconSrc: any = appIcon;
  const iconUrl = typeof iconSrc === 'string' ? iconSrc : iconSrc?.uri;
  if (iconUrl) {
    try {
      const img = new (doc.defaultView as any).Image();
      img.src = iconUrl;
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
        setTimeout(() => res(), 2500);
      });
      if (img.naturalWidth) {
        const s = 150;
        rr(ctx, W / 2 - s / 2, 100, s, s, 34);
        ctx.save();
        ctx.clip();
        ctx.drawImage(img, W / 2 - s / 2, 100, s, s);
        ctx.restore();
      }
    } catch {}
  }

  /* wordmark */
  ctx.textAlign = 'center';
  ctx.fillStyle = WHITE;
  ctx.font = '700 58px "Poppins-ExtraBold"';
  (ctx as any).letterSpacing = '10px';
  ctx.fillText('DEENLINK', W / 2, iconUrl ? 330 : 220);
  (ctx as any).letterSpacing = '4px';
  ctx.fillStyle = GOLD;
  ctx.font = '500 26px "Poppins-Medium"';
  ctx.fillText('deenlink.org', W / 2, (iconUrl ? 330 : 220) + 42);
  (ctx as any).letterSpacing = '0px';

  /* eyebrow */
  const eyY = iconUrl ? 470 : 380;
  ctx.fillStyle = GOLD;
  ctx.font = '700 30px "Poppins-Bold"';
  (ctx as any).letterSpacing = '9px';
  const label = input.kind === 'hadith' ? 'DAILY HADITH' : 'DAILY AYAH';
  ctx.fillText(label, W / 2, eyY);
  (ctx as any).letterSpacing = '0px';
  const lw = ctx.measureText(label).width / 2;
  ctx.strokeStyle = GOLD_SOFT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lw - 90, eyY - 10);
  ctx.lineTo(W / 2 - lw - 30, eyY - 10);
  ctx.moveTo(W / 2 + lw + 30, eyY - 10);
  ctx.lineTo(W / 2 + lw + 90, eyY - 10);
  ctx.stroke();

  /* arabic */
  ctx.fillStyle = WHITE;
  ctx.font = '700 92px "Amiri-Bold"';
  ctx.direction = 'rtl';
  const arabicLines = wrapText(ctx, input.arabic, W - 320);
  const aStart = eyY + 130;
  arabicLines.forEach((ln, i) => ctx.fillText(ln, W / 2, aStart + i * 130));
  ctx.direction = 'ltr';
  const afterArabic = aStart + (arabicLines.length - 1) * 130 + 60;

  /* divider */
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, afterArabic);
  ctx.lineTo(W / 2 + 70, afterArabic);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(W / 2, afterArabic, 4, 0, Math.PI * 2);
  ctx.fill();

  /* meaning */
  ctx.fillStyle = 'rgba(245,248,245,0.82)';
  ctx.font = '400 44px "Poppins-Regular"';
  const mLines = wrapText(ctx, `“${input.meaning}”`, W - 300);
  mLines.forEach((ln, i) => ctx.fillText(ln, W / 2, afterArabic + 90 + i * 62));
  const afterMeaning = afterArabic + 90 + (mLines.length - 1) * 62 + 70;

  /* ref */
  ctx.fillStyle = GOLD;
  ctx.font = '700 32px "Poppins-Bold"';
  ctx.fillText(input.ref, W / 2, afterMeaning);

  /* bottom: QR + caption */
  const boxS = 216;
  const bx = W - 120 - boxS;
  const by = H - 120 - boxS;
  ctx.fillStyle = '#FFFFFF';
  rr(ctx, bx, by, boxS, boxS, 22);
  ctx.fill();
  try {
    const qr = createQR('https://deenlink.org', { errorCorrectionLevel: 'M', margin: 1 });
    const size = qr.modules.size;
    const cell = Math.floor((boxS - 36) / size);
    const off = (boxS - cell * size) / 2;
    ctx.fillStyle = BG;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qr.modules.get(x, y)) {
          ctx.fillRect(bx + off + x * cell, by + off + y * cell, cell - 0.5, cell - 0.5);
        }
      }
    }
  } catch {}

  ctx.textAlign = 'right';
  ctx.fillStyle = WHITE;
  ctx.font = '700 34px "Poppins-Bold"';
  ctx.fillText('Scan to explore', bx - 40, by + boxS / 2 - 14);
  ctx.fillStyle = 'rgba(245,248,245,0.65)';
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
