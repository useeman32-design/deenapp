import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { T } from '@/components/T';
import { linkPreview, type LinkPreview } from '@/api/client';

/**
 * pass 66-night — link preview card. Any chat message (or shared content)
 * containing a URL gets an og-preview card under the text: the server fetches
 * the page meta (CORS-safe on every platform), so shared links look like
 * WhatsApp/Telegram previews instead of raw text.
 */
export function findUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text ?? '');
  return m ? m[0].replace(/[),.;!?]+$/, '') : null;
}

export function LinkPreviewCard({ url, dark, compact = false }: { url: string; dark: boolean; compact?: boolean }) {
  const [p, setP] = useState<LinkPreview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    void linkPreview(url).then((r) => {
      if (dead) return;
      if (r) setP(r);
      else setFailed(true);
    });
    return () => { dead = true; };
  }, [url]);

  const site = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 40); }
  })();

  if (failed) return null;

  const card = dark ? 'rgba(255,255,255,0.06)' : 'rgba(20,36,28,0.05)';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.12)';
  const txt = dark ? '#F2F7F3' : '#14241C';
  const sub = dark ? 'rgba(233,244,237,0.65)' : 'rgba(20,36,28,0.7)';
  const faint = dark ? 'rgba(233,244,237,0.45)' : 'rgba(20,36,28,0.5)';

  return (
    <Pressable
      onPress={() => { try { void Linking.openURL(url); } catch { /* noop */ } }}
      style={({ pressed }) => ({ marginTop: 7, borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: card, overflow: 'hidden', opacity: pressed ? 0.8 : 1, maxWidth: compact ? 230 : 300 })}
    >
      {p?.image ? <Image source={{ uri: p.image }} style={{ width: '100%', height: compact ? 90 : 130 }} contentFit="cover" /> : null}
      <View style={{ padding: 10, gap: 3 }}>
        {!p ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <ActivityIndicator size="small" color={faint} />
            <T v="caption" style={{ fontSize: 10.5, color: faint }}>Loading preview · {site}</T>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <FontAwesome5 name="link" size={8} color="#E8C96A" />
              <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3, color: faint }}>{site.toUpperCase()}</T>
            </View>
            {p.title ? <T v="bodyS" numberOfLines={2} style={{ fontSize: 12, fontWeight: '700', color: txt }}>{p.title}</T> : null}
            {p.description ? <T v="caption" numberOfLines={2} style={{ fontSize: 10.5, lineHeight: 14, color: sub }}>{p.description}</T> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}
