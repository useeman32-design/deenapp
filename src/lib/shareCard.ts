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
  kind: 'ayah' | 'hadith' | 'dua' | 'athkar' | 'post';
  /** optional — posts have no arabic line */
  arabic?: string;
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

  /* measure text first → dynamic height for long content.
   * pass 22: LONG texts auto-shrink (in steps) so they always fit nicely —
   * huge cards looked broken; text that STILL overflows is truncated. */
  const hasArabic = !!input.arabic;
  const MAX_A_LINES = 9;
  const MAX_M_LINES = 8;
  let arFs = 92;
  let arLineH = 130;
  let arLines: string[] = [];
  if (hasArabic) {
    for (const size of [92, 82, 72, 64, 56]) {
      ctx.font = `700 ${size}px "Amiri-Bold"`;
      ctx.direction = 'rtl';
      arLines = wrapText(ctx, input.arabic ?? '', W - 320);
      if (arLines.length <= MAX_A_LINES) {
        arFs = size;
        arLineH = Math.round(size * 1.42);
        break;
      }
      if (size === 56) {
        arFs = size;
        arLineH = Math.round(size * 1.42);
        arLines = arLines.slice(0, MAX_A_LINES);
        arLines[MAX_A_LINES - 1] = arLines[MAX_A_LINES - 1].trim() + '…';
      }
    }
    ctx.direction = 'ltr';
  }
  let mFs = 44;
  let mLineH = 62;
  let mLines: string[] = [];
  for (const size of [44, 40, 36, 32, 28]) {
    ctx.font = `400 ${size}px "Poppins-Regular"`;
    mLines = wrapText(ctx, `“${input.meaning}”`, W - 300);
    if (mLines.length <= MAX_M_LINES) {
      mFs = size;
      mLineH = Math.round(size * 1.42);
      break;
    }
    if (size === 28) {
      mFs = size;
      mLineH = Math.round(size * 1.42);
      mLines = mLines.slice(0, MAX_M_LINES);
      mLines[MAX_M_LINES - 1] = mLines[MAX_M_LINES - 1].trim() + '…';
    }
  }

  const aStart = 620;
  const afterArabic = hasArabic ? aStart + (arLines.length - 1) * arLineH + 60 : aStart - 90;
  const afterMeaning = afterArabic + 90 + (mLines.length - 1) * mLineH + 70;
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
  const LABELS: Record<ShareCardInput['kind'], string> = { ayah: 'QUR’AN', hadith: 'HADITH', dua: 'DUA', athkar: 'DHIKR', post: 'COMMUNITY' };
  const label = LABELS[input.kind];
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

  /* arabic (skipped for posts) */
  if (hasArabic) {
    ctx.fillStyle = ink;
    ctx.font = `700 ${arFs}px "Amiri-Bold"`;
    ctx.direction = 'rtl';
    arLines.forEach((ln, i) => ctx.fillText(ln, W / 2, aStart + i * arLineH));
    ctx.direction = 'ltr';
  }

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
  ctx.font = `400 ${mFs}px "Poppins-Regular"`;
  mLines.forEach((ln, i) => ctx.fillText(ln, W / 2, afterArabic + 90 + i * mLineH));

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

  /* pass 21: return a BLOB url — multi-MB data: URLs fail to render on
   * mobile Safari/Chrome; blob: previews everywhere and shares as a File */
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b: Blob | null) => res(b), 'image/png'));
  if (blob) return URL.createObjectURL(blob);
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

/* ═══════════════════════════════════════════════════════════════════════
 * pass 83-31 — generatePostShareCard (WEB): an exact replica of the post
 * card — avatar, name, @username (+badge), content, photo, like + comment
 * counts — plus the DeenLink brand strip and a QR code. Native uses the SVG
 * twin (components/PostShareCardSvg.tsx) via the existing export pipeline.
 * ═══════════════════════════════════════════════════════════════════ */
export interface PostShareCardInput {
  name: string;
  username: string;
  photoUrl?: string | null;
  badge?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  likeCount?: number;
  commentCount?: number;
  link: string;
  timeAgo?: string;
}

export async function generatePostShareCard(input: PostShareCardInput): Promise<string> {
  if (!isWeb() || typeof document === 'undefined') throw new Error('web only');
  const doc = document;
  const canvas = doc.createElement('canvas');
  const W = 1080;
  const PAD = 54;
  const LINE = '#E3E9E4';
  const SUB = '#6C7F74';
  const GREEN = '#1D6F42';
  const GOLD = '#B8860B';
  const TEXT = '#1E2B24';
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('no 2d context');

  /* preload photos first so we can size the canvas correctly */
  const [photo, photo_] = await Promise.all([
    input.photoUrl ? loadImage(doc, input.photoUrl) : Promise.resolve(null),
    input.imageUrl ? loadImage(doc, input.imageUrl) : Promise.resolve(null),
  ]);

  const headerH = 132;
  ctx.font = '500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const words = (input.text || '').split(/\s+/);
  const textLines: string[] = [];
  let cur = '';
  const maxText = 10;
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > W - PAD * 2 && cur) { textLines.push(cur); cur = w; } else cur = test;
  }
  if (cur) textLines.push(cur);
  if (textLines.length > maxText) { const kept = textLines.slice(0, maxText); kept[maxText - 1] = `${kept[maxText - 1].trim()}…`; textLines.length = 0; textLines.push(...kept); }
  const textH = textLines.length ? textLines.length * 46 + 18 : 0;
  const imgH = photo_ ? Math.min(640, Math.max(360, (photo_.naturalHeight / Math.max(1, photo_.naturalWidth)) * (W - PAD * 2))) : 0;
  const countsH = 96;
  const footerH = 190;
  const H = Math.max(900, PAD + headerH + textH + imgH + countsH + footerH + 22);
  canvas.width = W; canvas.height = H;

  /* card + border */
  rr(ctx, 0, 0, W, H, 40); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 3; rr(ctx, 3, 3, W - 6, H - 6, 38); ctx.stroke();

  /* header */
  const avX = PAD, avY = PAD, avR = 39;
  ctx.save();
  ctx.beginPath(); ctx.arc(avX + avR, avY + avR, avR + 1, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#EEF4EF'; ctx.fillRect(avX, avY, avR * 2, avR * 2);
  if (photo) {
    const s = Math.max((avR * 2) / photo.naturalWidth, (avR * 2) / photo.naturalHeight);
    ctx.drawImage(photo, avX + avR - (photo.naturalWidth * s) / 2, avY + avR - (photo.naturalHeight * s) / 2, photo.naturalWidth * s, photo.naturalHeight * s);
  } else {
    ctx.fillStyle = GREEN; ctx.font = '800 40px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((input.name || '?').trim().slice(0, 1).toUpperCase(), avX + avR, avY + avR + 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.fillStyle = TEXT; ctx.font = '800 34px system-ui, sans-serif';
  let nameTxt = input.name || ''; while (ctx.measureText(nameTxt).width > 420 && nameTxt.length > 3) nameTxt = `${nameTxt.slice(0, -2)}…`;
  ctx.fillText(nameTxt, avX + 100, avY + 40);
  ctx.fillStyle = SUB; ctx.font = '600 27px system-ui, sans-serif';
  const sub = `@${input.username}${input.timeAgo ? ` · ${input.timeAgo}` : ''}`;
  ctx.fillText(sub, avX + 100, avY + 76);
  if (input.badge && input.badge !== 'none') {
    const bx = avX + 100 + ctx.measureText(sub).width + 16, by = avY + 67;
    ctx.fillStyle = input.badge === 'green' ? '#27AE60' : input.badge === 'gold' ? '#D4AF37' : '#3F51B5';
    ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(bx - 6, by); ctx.lineTo(bx - 1, by + 5); ctx.lineTo(bx + 7, by - 5); ctx.stroke();
  }

  /* content */
  ctx.fillStyle = TEXT; ctx.font = '500 34px system-ui, sans-serif';
  textLines.forEach((ln, i) => ctx.fillText(ln, PAD, PAD + headerH + 40 + i * 46));

  /* photo */
  const imgY = PAD + headerH + textH;
  if (photo_ && imgH > 0) {
    ctx.save(); rr(ctx, PAD, imgY, W - PAD * 2, imgH, 26); ctx.clip();
    const s = Math.max((W - PAD * 2) / photo_.naturalWidth, imgH / photo_.naturalHeight);
    ctx.drawImage(photo_, PAD + (W - PAD * 2 - photo_.naturalWidth * s) / 2, imgY + (imgH - photo_.naturalHeight * s) / 2, photo_.naturalWidth * s, photo_.naturalHeight * s);
    ctx.restore();
  }

  /* likes + comments */
  const countsY = imgY + imgH;
  ctx.fillStyle = '#E74C3C'; ctx.font = '700 32px system-ui, sans-serif';
  ctx.fillText('♥', PAD + 4, countsY + 46);
  ctx.fillStyle = SUB; ctx.fillText(String(input.likeCount ?? 0), PAD + 56, countsY + 46);
  ctx.lineWidth = 4; ctx.strokeStyle = SUB; ctx.beginPath();
  ctx.moveTo(PAD + 158, countsY + 40); ctx.bezierCurveTo(PAD + 150, countsY + 14, PAD + 180, countsY + 6, PAD + 190, countsY + 28);
  ctx.bezierCurveTo(PAD + 198, countsY + 6, PAD + 228, countsY + 14, PAD + 220, countsY + 40);
  ctx.bezierCurveTo(PAD + 216, countsY + 58, PAD + 190, countsY + 70, PAD + 190, countsY + 70);
  ctx.bezierCurveTo(PAD + 190, countsY + 70, PAD + 162, countsY + 58, PAD + 158, countsY + 40); ctx.stroke();
  ctx.fillText(String(input.commentCount ?? 0), PAD + 240, countsY + 46);
  rr(ctx, PAD + 300, countsY + 12, 68, 44, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD + 322, countsY + 56); ctx.lineTo(PAD + 322, countsY + 70); ctx.lineTo(PAD + 336, countsY + 56); ctx.stroke();

  /* footer */
  const footY = H - footerH;
  ctx.fillStyle = '#F2F5F2'; ctx.fillRect(0, footY, W, footerH);
  ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, footY); ctx.lineTo(W - PAD, footY); ctx.stroke();
  ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(PAD + 34, footY + 64, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.font = '800 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('DL', PAD + 34, footY + 66);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = '800 38px system-ui, sans-serif';
  ctx.fillStyle = TEXT; ctx.fillText('Deen', PAD + 92, footY + 56);
  ctx.fillStyle = GOLD; ctx.fillText('Link', PAD + 92 + ctx.measureText('Deen').width + 6, footY + 56);
  ctx.fillStyle = SUB; ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('your deen, connected — scan to join', PAD + 92, footY + 94);

  /* QR */
  try {
    const qrc = (await import('qrcode')) as unknown as { toDataURL?: (t: string, o?: Record<string, unknown>) => Promise<string> };
    const qrUrl = qrc.toDataURL ? await qrc.toDataURL(input.link, { margin: 0 }) : null;
    const qrImg = qrUrl ? await loadImage(doc, qrUrl) : null;
    if (qrImg) {
      const qs = 128, qx = W - PAD - qs, qy = footY + 16;
      ctx.fillStyle = '#FFFFFF'; rr(ctx, qx - 8, qy - 8, qs + 16, qs + 16, 12); ctx.fill();
      ctx.strokeStyle = LINE; rr(ctx, qx - 8, qy - 8, qs + 16, qs + 16, 12); ctx.stroke();
      ctx.drawImage(qrImg, qx, qy, qs, qs);
    }
  } catch {}

  return canvas.toDataURL('image/jpeg', 0.92);
}
