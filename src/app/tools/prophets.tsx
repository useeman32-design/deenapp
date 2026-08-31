import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * Story of the Prophets (pass 32) — the complete English text of Ibn Kathir's
 * "Stories of the Prophets" (from Al-Bidayah wan-Nihayah, tr. Muhammad
 * Mustapha Geme'ah, Al-Azhar) — 19 chapters, Adam ﷹ‎ﻻ to Muhammad ﷺ, bundled
 * per-prophet under /prophets/*.json and read here with saved progress.
 */

type Ch = { slug: string; name: string; n: number };
type Full = { slug: string; name: string; source: string; paras: string[] };

const ICONS: Record<string, string> = {
  adam: 'user-friends', idris: 'scroll', nuh: 'ship', hud: 'wind', salih: 'mountain',
  ibrahim: 'kaaba', 'isma-il': 'kaaba', ishaq: 'child', yusuf: 'moon', ayyub: 'seedling',
  'dhul-kifl': 'balance-scale', yunus: 'fish', musa: 'water', dawud: 'star-and-crescent',
  daniel: 'lion', zakariyya: 'praying-hands', yahya: 'dove', isa: 'heart', muhammad: 'mosque',
};

export default function ProphetsStories() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [chapters, setChapters] = useState<Ch[] | null>(null);
  const [open, setOpen] = useState<Ch | null>(null);
  const [full, setFull] = useState<Full | null>(null);
  const [loading, setLoading] = useState(false);
  /* how many paragraphs the reader shows — resume per prophet */
  const [read, setRead] = useState<Record<string, number>>({});

  useEffect(() => {
    const base = typeof window !== 'undefined' ? window.location.pathname.replace(/^(\/deenapp\b).*$/, '$1') : '';
    fetch(`${base}/prophets/index.json`).then((r) => r.json()).then(setChapters).catch(() => setChapters([]));
    storage.getItem('dl.prophets.read.v1').then((r) => {
      try { setRead(JSON.parse(r ?? '{}')); } catch {}
    }).catch(() => {});
  }, []);

  const openCh = (c: Ch) => {
    haptic.selection();
    setOpen(c);
    setFull(null);
    setLoading(true);
    const base = typeof window !== 'undefined' ? window.location.pathname.replace(/^(\/deenapp\b).*$/, '$1') : '';
    fetch(`${base}/prophets/${c.slug}.json`).then((r) => r.json()).then(setFull).catch(() => setFull(null)).finally(() => setLoading(false));
  };

  const shown = useMemo(() => (full ? Math.min(full.paras.length, Math.max(8, read[full.slug] ?? 8)) : 0), [full, read]);
  const markRead = (n: number) => {
    if (!full) return;
    setRead((prev) => {
      const next = { ...prev, [full.slug]: n };
      storage.setItem('dl.prophets.read.v1', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  if (open) {
    const pct = full ? Math.round((shown / full.paras.length) * 100) : 0;
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <TopBar title={open.name} subtitle={full?.source ?? 'loading…'} />
        <View style={{ height: 4, backgroundColor: d.cardBorder }}>
          <View style={{ width: `${pct}%`, height: 4, backgroundColor: pct >= 100 ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42' }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 8 }}>Opening the chapter…</T>
            </View>
          ) : !full ? (
            <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>Chapter unavailable — check your connection.</T>
          ) : (
            <>
              {full.paras.slice(0, shown).map((p, i) => (
                <T key={i} v="body" style={{ fontSize: 14.5, lineHeight: 24, color: d.text, marginBottom: 13 }}>{p}</T>
              ))}
              {shown < full.paras.length ? (
                <Pressable onPress={() => { haptic.light(); markRead(Math.min(full.paras.length, shown + 8)); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}>
                  <FontAwesome5 name="book-reader" size={12} color="#fff" />
                  <T v="button" style={{ fontSize: 13, fontWeight: '800' }}>CONTINUE READING ({Math.min(8, full.paras.length - shown)} more)</T>
                </Pressable>
              ) : (
                <View style={{ alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <FontAwesome5 name="check-circle" size={22} color="#B8870B" />
                  <T v="caption" style={{ fontSize: 11, color: d.faint, textAlign: 'center' }}>Chapter finished — {full.source}</T>
                  <Pressable onPress={() => { haptic.light(); setOpen(null); }} style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 18, paddingVertical: 11 }}>
                    <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>NEXT PROPHET →</T>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="Story of the Prophets" subtitle="Ibn Kathir · 19 chapters · Adam → Muhammad ﷺ" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {!chapters ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
        ) : (
          chapters.map((c, i) => {
            const prog = read[c.slug] ?? 0;
            const pct = Math.min(100, Math.round((prog / c.n) * 100));
            return (
              <Pressable key={c.slug} onPress={() => openCh(c)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: pct >= 100 ? 'rgba(212,175,55,0.45)' : d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 9, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(141,110,67,0.12)', borderWidth: 1, borderColor: 'rgba(141,110,67,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={(ICONS[c.slug] ?? 'scroll') as never} size={14} color="#8D6E43" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 13.5 }}>{i + 1}. {c.name}</T>
                  <T v="caption" style={{ fontSize: 10, marginTop: 2, color: d.faint }}>{c.n} passages{pct > 0 ? ` · ${pct >= 100 ? 'finished ✓' : `${pct}% read`}` : ''}</T>
                </View>
                <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
              </Pressable>
            );
          })
        )}
        <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 8, lineHeight: 14 }}>
          Stories of the Prophets by Ibn Kathir, compiled from Al-Bidayah wan-Nihayah — supported by Qur'an and authentic hadith, free of fabricated narrations.
        </T>
      </ScrollView>
    </View>
  );
}
