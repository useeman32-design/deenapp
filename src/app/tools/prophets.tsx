import { markGoal } from '@/lib/routine';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { themeFor } from '@/data/prophetThemes';
import { prophetChapters, prophetFull } from '@/api/client';

/**
 * Story of the Prophets — pass 37 redesign.
 *  · 25 chapters (all 25 prophets named in the Qur'an; Ya'qub inside Ishaq's
 *    chapter, plus Daniel) — public/prophets/*.json
 *  · EVERY prophet has his own theme (gradient, icon, motif, key ayah,
 *    Hausa summary) — see data/prophetThemes.ts
 *  · hero "continue" card (last read + progress) like the Qur'an reader
 *  · EN / HA language pill in the reader (Hausa = Hausa summary)
 *  · reading progress saved per chapter (dl.prophets.read.v1) + last opened
 */

type Ch = { slug: string; name: string; n: number };
type Full = { slug: string; name: string; source: string; paras: string[] };

const READ_KEY = 'dl.prophets.read.v1';
const LAST_KEY = 'dl.prophets.last.v1';
const PAGE_SIZE = 6; // paragraphs per reading page (Next / Previous paging)

export default function ProphetsStories() {
  useEffect(() => { markGoal('prophets').catch(() => {}); }, []);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [chapters, setChapters] = useState<Ch[] | null>(null);
  const [open, setOpen] = useState<Ch | null>(null);
  const [full, setFull] = useState<Full | null>(null);
  const [loading, setLoading] = useState(false);
  /* how many paragraphs the reader shows — resume per prophet */
  const [read, setRead] = useState<Record<string, number>>({});
  const [last, setLast] = useState<string | null>(null);
  /* pass 37 — EN (full text) / HA (Hausa summary) */
  const [lang, setLang] = useState<'en' | 'ha'>('en');
  /* pass 45 — paged reading: Next / Previous + scroll-to-top + progress */
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const { publicBase } = require('@/lib/gzio') as typeof import('@/lib/gzio');
    Promise.all([
      fetch(`${publicBase()}/prophets/index.json`).then((r) => r.json()).catch(() => []),
      prophetChapters().catch(() => null),
    ])
      .then(([base, admin]) => {
        const b: Ch[] = Array.isArray(base) ? base : [];
        if (admin && admin.length) {
          const bySlug = new Map(admin.map((a) => [a.slug, a]));
          const overridden = b.map((c) => {
            const a = bySlug.get(c.slug);
            return a ? { ...c, name: a.name, n: a.n } : c;
          });
          const have = new Set(b.map((c) => c.slug));
          const appended = admin.filter((a) => !have.has(a.slug)).map((a) => ({ slug: a.slug, name: a.name, n: a.n }));
          setChapters([...overridden, ...appended]);
        } else setChapters(b);
      })
      .catch(() => setChapters([]));
    storage.getItem(READ_KEY).then((r) => {
      try { setRead(JSON.parse(r ?? '{}')); } catch {}
    }).catch(() => {});
    storage.getItem(LAST_KEY).then((r) => setLast(r ?? null)).catch(() => {});
  }, []);

  const openCh = (c: Ch) => {
    haptic.selection();
    setOpen(c);
    setFull(null);
    setLang('en');
    setPage(Math.floor((read[c.slug] ?? 0) / PAGE_SIZE));
    setLoading(true);
    storage.setItem(LAST_KEY, c.slug).catch(() => {});
    setLast(c.slug);
    const { publicBase } = require('@/lib/gzio') as typeof import('@/lib/gzio');
    const fromFile = () =>
      fetch(`${publicBase()}/prophets/${c.slug}.json`).then((r) => r.json()).then(setFull).catch(() => setFull(null)).finally(() => setLoading(false));
    prophetFull(c.slug).then((adm) => {
      if (adm && Array.isArray(adm.paras) && adm.paras.length) setFull(adm);
      else fromFile();
      setLoading(false);
    }).catch(fromFile);
  };

  const markRead = (n: number) => {
    if (!full) return;
    setRead((prev) => {
      const next = { ...prev, [full.slug]: n };
      storage.setItem(READ_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  /* pass 45 — paged reader: Next / Previous, scroll-to-top, progress from page */
  const totalParas = full?.paras.length ?? 0;
  const pages = Math.max(1, Math.ceil(totalParas / PAGE_SIZE));
  const curPage = Math.min(page, pages - 1);
  const start = curPage * PAGE_SIZE;
  const shownEnd = Math.min(totalParas, start + PAGE_SIZE);
  const goTo = (p: number) => {
    const np = Math.max(0, Math.min(pages - 1, p));
    setPage(np);
    markRead(Math.min(totalParas, (np + 1) * PAGE_SIZE));
    // Scroll to top after the new page paints. Done defensively — a throwing
    // scrollTo here previously blanked the reader (white screen on CONTINUE).
    setTimeout(() => {
      try { scrollRef.current?.scrollTo({ y: 0, animated: true }); } catch {}
    }, 0);
  };

  /* ───────────────────────── READER ───────────────────────── */
  if (open) {
    const th = themeFor(open.slug);
    const total = full?.paras.length ?? open.n;
    const pct = full ? Math.round((shownEnd / total) * 100) : 0;
    const finished = full ? (read[full.slug] ?? 0) >= total : false;
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {/* themed hero — each prophet gets his own gradient + motif */}
          <View style={{ position: 'relative' }}>
            <LinearGradient colors={th.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: Math.max(insets.top, 14) + 8, paddingBottom: 46, paddingHorizontal: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable onPress={() => { haptic.selection(); setOpen(null); }} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="chevron-left" size={13} color="#F2F7F3" />
                </Pressable>
                <View style={{ flex: 1 }} />
                {/* language pill: EN full text / HA Hausa summary */}
                <View style={{ flexDirection: 'row', borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.32)', padding: 2 }}>
                  {(['en', 'ha'] as const).map((l) => (
                    <Pressable key={l} onPress={() => { haptic.selection(); setLang(l); }} style={{ borderRadius: 8, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: lang === l ? 'rgba(255,255,255,0.16)' : 'transparent' }}>
                      <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', color: lang === l ? '#F2F7F3' : 'rgba(242,247,243,0.55)' }}>{l.toUpperCase()}</T>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 }}>
                <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1.5, borderColor: 'rgba(232,201,102,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={th.icon as never} size={21} color="#E8C96A" />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4, color: 'rgba(232,201,102,0.9)' }}>{th.motif.toUpperCase()}</T>
                  <T v="h2" style={{ fontWeight: '900', fontSize: 22, color: '#F2F7F3', marginTop: 2 }}>{open.name}</T>
                  {th.ar ? <T v="arabic" style={{ fontSize: 20, color: 'rgba(242,247,243,0.9)', marginTop: 2 }}>{th.ar}</T> : null}
                </View>
              </View>
            </LinearGradient>
            {/* progress bar hanging off the hero */}
            <View style={{ marginHorizontal: 18, marginTop: -18, borderRadius: 13, borderWidth: 1, borderColor: finished ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: d.card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FontAwesome5 name={finished ? 'check-circle' : 'book-reader'} size={15} color={finished ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42'} />
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: d.bgSoft, overflow: 'hidden' }}>
                <View style={{ width: `${lang === 'ha' ? (finished || (read[open.slug] ?? 0) > 0 ? 100 : 0) : pct}%`, height: 6, backgroundColor: finished ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42' }} />
              </View>
              <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: finished ? '#D4AF37' : d.subtext }}>{lang === 'ha' ? 'summary' : `${pct}%`}</T>
            </View>
          </View>

          {/* key ayah quote */}
          {th.ayah ? (
            <View style={{ marginHorizontal: 18, marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)', padding: 16, alignItems: 'center' }}>
              <T v="arabic" style={{ fontSize: 21, lineHeight: 38, textAlign: 'center', color: d.text }}>{th.ayah.ar}</T>
              <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 17.5, textAlign: 'center', color: d.subtext, marginTop: 9, fontStyle: 'italic' }}>{th.ayah.en}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <View style={{ width: 18, height: 1.5, backgroundColor: 'rgba(212,175,55,0.6)' }} />
                <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#E8C96A' }}>{th.ayah.ref}</T>
                <View style={{ width: 18, height: 1.5, backgroundColor: 'rgba(212,175,55,0.6)' }} />
              </View>
            </View>
          ) : null}

          <View style={{ padding: 18, paddingTop: 16 }}>
            {loading ? (
              <View style={{ alignItems: 'center', marginTop: 30, gap: 10 }}>
                {[...Array(5)].map((_, i) => (
                  <View key={i} style={{ height: 11, borderRadius: 6, width: `${92 - i * 7}%`, backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                ))}
                <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 8 }} />
                <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Opening the chapter…</T>
              </View>
            ) : !full ? (
              <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>Chapter unavailable — check your connection.</T>
            ) : lang === 'ha' ? (
              /* Hausa summary view */
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <FontAwesome5 name="language" size={11} color="#E8C96A" />
                  <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#E8C96A' }}>TAUSAYIN LABARI (HAUSA)</T>
                </View>
                {th.ha.map((p, i) => (
                  <T key={i} v="body" style={{ fontSize: 14, lineHeight: 23, color: d.text }}>{p}</T>
                ))}
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>Cikakken labarin Turanci (EN) yana a saman — shafi na biyu.</T>
              </View>
            ) : (
              <>
                {full.paras.slice(start, shownEnd).map((p, idx) => {
                  const i = start + idx;
                  return (
                    <View key={i} style={{ flexDirection: i === 0 ? 'row' : 'column' }}>
                      {i === 0 ? (
                        <T v="h1" style={{ fontSize: 34, fontWeight: '900', color: isDark ? '#4AE38F' : '#1D6F42', lineHeight: 38, marginRight: 7 }}>{p.trim().replace(/^["“]/, '').slice(0, 1)}</T>
                      ) : null}
                      <T v="body" style={{ fontSize: 14.5, lineHeight: 24, color: d.text, marginBottom: 13, flex: 1 }}>
                        {i === 0 ? p.trim().replace(/^["“]/, '').slice(1) : p}
                      </T>
                    </View>
                  );
                })}
                {/* pass 45 — Previous / Continue paging with scroll-to-top */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  {curPage > 0 ? (
                    <Pressable onPress={() => { haptic.light(); goTo(curPage - 1); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card }}>
                      <FontAwesome5 name="chevron-left" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                      <T v="button" style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>PREVIOUS</T>
                    </Pressable>
                  ) : null}
                  {shownEnd < full.paras.length ? (
                    <Pressable onPress={() => { haptic.light(); goTo(curPage + 1); }} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}>
                      <FontAwesome5 name="book-reader" size={12} color="#fff" />
                      <T v="button" style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>CONTINUE ({Math.min(PAGE_SIZE, full.paras.length - shownEnd)} more)</T>
                    </Pressable>
                  ) : null}
                </View>
                {shownEnd >= full.paras.length ? (
                  <View style={{ alignItems: 'center', gap: 10, marginTop: 12 }}>
                    <FontAwesome5 name="check-circle" size={22} color="#B8870B" />
                    <T v="caption" style={{ fontSize: 11, color: d.faint, textAlign: 'center' }}>Chapter finished — {full.source}</T>
                    <Pressable onPress={() => { haptic.light(); setOpen(null); }} style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 18, paddingVertical: 11 }}>
                      <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>ALL PROPHETS →</T>
                    </Pressable>
                  </View>
                ) : null}
                <T v="caption" style={{ textAlign: 'center', fontSize: 9.5, color: d.faint, marginTop: 12 }}>Page {curPage + 1} of {pages}</T>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ───────────────────────── HUB ───────────────────────── */
  const lastCh = chapters?.find((c) => c.slug === last) ?? null;
  const lastTh = lastCh ? themeFor(lastCh.slug) : null;
  const lastProg = lastCh ? Math.min(100, Math.round(((read[lastCh.slug] ?? 0) / lastCh.n) * 100)) : 0;
  const doneCount = (chapters ?? []).filter((c) => (read[c.slug] ?? 0) >= c.n).length;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Story of the Prophets" subtitle="Ibn Kathir · 25 chapters · Adam → Muhammad ﷺ" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* hero — continue where you stopped (like the Qur'an reader) */}
        {lastCh && lastTh ? (
          <Pressable
            accessibilityLabel="continue reading"
            onPress={() => openCh(lastCh!)}
            style={({ pressed }) => ({ borderRadius: 20, overflow: 'hidden', marginBottom: 14, opacity: pressed ? 0.9 : 1, borderWidth: 1, borderColor: d.cardBorder })}
          >
            <LinearGradient colors={lastTh.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1.5, borderColor: 'rgba(232,201,102,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={lastTh.icon as never} size={19} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.3, color: 'rgba(232,201,102,0.9)' }}>
                  {lastProg >= 100 ? 'FINISHED — READ AGAIN' : 'CONTINUE READING'}
                </T>
                <T v="h3" style={{ fontWeight: '900', fontSize: 17, color: '#F2F7F3', marginTop: 2 }}>{lastCh.name}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                    <View style={{ width: `${lastProg}%`, height: 5, borderRadius: 3, backgroundColor: lastProg >= 100 ? '#E8C96A' : '#4AE38F' }} />
                  </View>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', color: '#F2F7F3' }}>{lastProg}%</T>
                </View>
              </View>
              <FontAwesome5 name="play-circle" size={26} color="rgba(242,247,243,0.85)" />
            </LinearGradient>
          </Pressable>
        ) : null}

        {/* overall progress */}
        {chapters && chapters.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 14 }}>
            <FontAwesome5 name="torah" size={13} color="#E8C96A" />
            <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.subtext, fontWeight: '700' }}>
              Your journey: {doneCount} of {chapters.length} stories completed
            </T>
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '900', color: isDark ? '#4AE38F' : '#1D6F42' }}>{Math.round((doneCount / chapters.length) * 100)}%</T>
          </View>
        ) : null}

        {!chapters ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, opacity: 1 - i * 0.12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ height: 10, borderRadius: 5, width: '55%', backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                  <View style={{ height: 8, borderRadius: 4, width: '38%', backgroundColor: isDark ? 'rgba(242,247,243,0.05)' : 'rgba(20,36,28,0.04)' }} />
                </View>
              </View>
            ))}
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 6 }} />
          </View>
        ) : (
          chapters.map((c, i) => {
            const th = themeFor(c.slug);
            const prog = read[c.slug] ?? 0;
            const pct = Math.min(100, Math.round((prog / c.n) * 100));
            return (
              <Pressable key={c.slug} onPress={() => openCh(c)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: pct >= 100 ? 'rgba(212,175,55,0.45)' : d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 9, opacity: pressed ? 0.85 : 1 })}>
                <LinearGradient colors={th.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={th.icon as never} size={15} color="#F2F7F3" />
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 13.5 }}>{i + 1}. {c.name}</T>
                  <T v="caption" style={{ fontSize: 9.5, marginTop: 2, color: d.faint }} numberOfLines={1}>{th.motif} · {c.n} passages</T>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: d.bgSoft, overflow: 'hidden', marginTop: 6 }}>
                    <View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: pct >= 100 ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42' }} />
                  </View>
                </View>
                {pct >= 100 ? (
                  <FontAwesome5 name="check-circle" size={16} color="#D4AF37" />
                ) : pct > 0 ? (
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{pct}%</T>
                ) : (
                  <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
                )}
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
