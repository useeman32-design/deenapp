import { Platform } from 'react-native';
import { storage } from '@/lib/storage';

/**
 * pass 35 — cross-platform image export.
 *
 * NATIVE (Expo Go + dev builds): render a react-native-svg <Svg> tree hidden
 * on screen, call ref.toDataURL() (PNG base64), write to cache, convert to
 * JPEG via expo-image-manipulator, then share (expo-sharing) or save to the
 * gallery (expo-media-library). This is what made "share as image" silently
 * do nothing on native before (the old path was html-canvas only).
 *
 * WEB: keeps the canvas pipeline (shareCard.ts) — better typography.
 */

export type SvgRefHandle = { toDataURL: (cb: (data: string) => void, opts?: Record<string, unknown>) => void } | null;

export async function svgRefToPng(ref: React.RefObject<SvgRefHandle>): Promise<string> {
  const node = ref.current;
  if (!node?.toDataURL) throw new Error('svg export: no ref');
  return new Promise<string>((resolve, reject) => {
    try {
      node.toDataURL((data: string) => {
        if (!data) reject(new Error('svg export: empty'));
        else resolve(data);
      });
    } catch (e) {
      reject(e as Error);
    }
  });
}

/** native: png dataURL → JPEG file in cache → returns file:// uri */
export async function pngDataUrlToJpegFile(dataUrl: string, fileName: string, quality = 0.92): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const { File, Paths } = await import('expo-file-system');
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const dir = Paths.cache;
  const png = new File(dir, `${fileName}.png`);
  png.write(base64, { encoding: 'base64' } as never);
  const pngUri: string = (png as unknown as { uri?: string }).uri ?? `file://${png}`;
  const res = await manipulateAsync(
    pngUri,
    [],
    { compress: quality, format: SaveFormat.JPEG },
  );
  return res.uri;
}

/** share a local file (native) or data url (web share/download) */
export async function shareImage(uri: string, fileName: string, message = ''): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const blob = await (await fetch(uri)).blob();
        const file = new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' });
        await navigator.share({ files: [file], text: message });
        return;
      } catch { /* user cancelled or no files support → download */ }
    }
    const a = document.createElement('a');
    a.href = uri;
    a.download = `${fileName}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const { shareAsync } = await import('expo-sharing');
  await shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: message || 'Share' });
}

/** save to the device gallery (native only) */
export async function saveToGallery(uri: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const MediaLibrary = await import('expo-media-library');
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) return false;
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch {
    return false;
  }
}

/** pass 37 — can this device save images? (web: always false → share/download
 * only; native: only when the photo-library permission is already granted).
 * "Save to gallery" is a privilege — the Share sheet is for everyone. */
export async function canSaveImages(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const MediaLibrary = await import('expo-media-library');
    const cur = await MediaLibrary.getPermissionsAsync();
    return cur.granted;
  } catch {
    return false;
  }
}

/** one-shot: rasterize a hidden Svg ref → JPEG file → share (native) */
export async function shareSvgRef(ref: React.RefObject<SvgRefHandle>, fileName: string, message = ''): Promise<void> {
  const png = await svgRefToPng(ref);
  if (Platform.OS === 'web') {
    /* web Svg refs don't expose toDataURL — callers use the canvas path */
    await shareImage(png, fileName, message);
    return;
  }
  const jpg = await pngDataUrlToJpegFile(png, fileName);
  await shareImage(jpg, fileName, message);
}

export async function saveSvgRefAsJpg(ref: React.RefObject<SvgRefHandle>, fileName: string): Promise<boolean> {
  const png = await svgRefToPng(ref);
  if (Platform.OS === 'web') return false;
  const jpg = await pngDataUrlToJpegFile(png, fileName);
  return saveToGallery(jpg);
}

/* last-save marker so screens can toast "saved" */
export const markSaved = (key: string) => storage.setItem(`dl.saved.${key}`, new Date().toISOString()).catch(() => {});
