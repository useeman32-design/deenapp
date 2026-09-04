import { Platform, Share } from 'react-native';

/**
 * pass 49 — Link previews. Shared DeenLink links point at /share.php, which
 * serves Open Graph tags so WhatsApp / iMessage / Telegram / X render a rich
 * preview card (image + title + description) and then deep-link into the app.
 */
const SHARE_BASE = 'https://app.deenlink.org/share.php';

export type ShareKind = 'video' | 'post' | 'dua' | 'verse' | 'article' | 'hadith';

export function buildShareUrl(kind: ShareKind, id?: string | number, title?: string, text?: string, img?: string): string {
  const parts: string[] = [`t=${encodeURIComponent(kind)}`];
  if (id !== undefined && id !== null && id !== '') parts.push(`id=${encodeURIComponent(String(id))}`);
  if (title) parts.push(`title=${encodeURIComponent(title)}`);
  if (text) parts.push(`text=${encodeURIComponent(text)}`);
  if (img) parts.push(`img=${encodeURIComponent(img)}`);
  return `${SHARE_BASE}?${parts.join('&')}`;
}

/** Open the native share sheet with a preview-enabled DeenLink link. */
export async function shareLink(opts: { kind: ShareKind; id?: string | number; title: string; text?: string; img?: string }): Promise<void> {
  const url = buildShareUrl(opts.kind, opts.id, opts.title, opts.text, opts.img);
  try {
    await Share.share(
      Platform.OS === 'ios'
        ? { title: opts.title, message: `${opts.title}\n\n${url}`, url }
        : { title: opts.title, message: `${opts.title}\n\n${url}` },
    );
  } catch {
    /* user cancelled or share unavailable */
  }
}
