import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { loadFatwas, type Fatwa } from '@/lib/ai';
import { storage } from '@/lib/storage';

/** Learning — Fatwa & Rulings (pass 29): searchable islamqa corpus
 * (1,080 answered rulings) bundled with the app. */
export default function FatwaBrowser() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [all, setAll] = useState<Fatwa[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  /* pass 32: save rulings (bookmark icon) + a SAVED view, like the seerah
   * events screen — saved fatwas persist in local storage. */
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());
  const [view, setView] = useState<'all' | 'saved'>('all');
  /* pass 36 — ALL rulings load (was capped at 30): incremental pages of 40
   * with a loader pinned to the bottom while more stream in */
  const [limit, setLimit] = useState(40);
  const [more, setMore] = useState(false);

  useEffect(() => { loadFatwas().then(setAll).catch(() => setAll([])); }, []);
  useEffect(() => {
    storage.getItem('dl.fatwa.saved').then((r) => {
      try { setSavedIdx(new Set(JSON.parse(r ?? '[]') as number[])); } catch {}
    }).catch(() => {});
  }, []);
  const toggleSave = (i: number) => {
    haptic.light();
    setSavedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      storage.setItem('dl.fatwa.saved', JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  const matched = useMemo(() => {
    if (!all) return [];
    if (view === 'saved') return all.filter((_, i) => savedIdx.has(i));
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    const toks = needle.split(/\s+/).filter((t) => t.length > 2);
    return all
      .map((f) => {
        const low = (f.t + ' ' + f.q).toLowerCase();
        let sc = 0;
        for (const t of toks) if (low.includes(t)) sc++;
        return { f, sc };
      })
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .map((x) => x.f);
  }, [all, q, view, savedIdx]);
  const list = matched.slice(0, limit);

  useEffect(() => { setLimit(40); }, [q, view]);

  /* scroll near the end → stream the next page in (with a brief loader) */
  const loadMore = () => {
    if (more || !all || limit >= matched.length) return;
    setMore(true);
    setTimeout(() => { setLimit((l) => l + 40); setMore(false); }, 450);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="Fatwa & Rulings" />
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10 }}>
          <FontAwesome5 name="search" size={12} color={d.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search rulings — e.g. zakah, fasting, hajj…"
            placeholderTextColor={d.faint}
            style={{ flex: 1, paddingVertical: 11, fontSize: 16, fontFamily: 'Poppins-Medium', color: d.text }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <FontAwesome5 name="times-circle" size={13} color={d.faint} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 0 }}>
          {(['all', 'saved'] as const).map((v) => (
            <Pressable key={v} onPress={() => { haptic.selection(); setView(v); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6, marginRight: 7, borderWidth: 1, borderColor: view === v ? (isDark ? 'rgba(74,227,143,0.45)' : 'rgba(29,111,66,0.35)') : d.cardBorder, backgroundColor: view === v ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : d.card }}>
              <FontAwesome5 name={v === 'all' ? 'scale' : 'bookmark'} size={9} color={view === v ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: view === v ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint }}>{v === 'all' ? 'ALL RULINGS' : `SAVED (${savedIdx.size})`}</T>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>
            {view === 'all' ? (all ? `${all.length} rulings · islamqa.info archive` : 'Loading…') : `${list.length} saved`}
          </T>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          if (contentOffset.y + layoutMeasurement.height > contentSize.height - 420) loadMore();
        }}
        scrollEventThrottle={140}
      >
        {!all ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            {[...Array(7)].map((_, i) => (
              <View key={i} style={{ borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9, opacity: 1 - i * 0.1 }}>
                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: isDark ? 'rgba(242,247,243,0.08)' : 'rgba(20,36,28,0.06)' }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ height: 10, borderRadius: 5, width: `${72 - i * 6}%`, backgroundColor: isDark ? 'rgba(242,247,243,0.08)' : 'rgba(20,36,28,0.06)' }} />
                  <View style={{ height: 8, borderRadius: 4, width: `${46 + i * 4}%`, backgroundColor: isDark ? 'rgba(242,247,243,0.05)' : 'rgba(20,36,28,0.04)' }} />
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 }}>
              <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>{all ? 'Loading more…' : 'Loading the rulings archive…'}</T>
            </View>
          </View>
        ) : list.length === 0 ? (
          <T v="caption" style={{ textAlign: 'center', marginTop: 30, fontSize: 11.5 }}>{view === 'saved' ? 'No saved rulings yet — tap the bookmark on any ruling.' : `No rulings match “${q}”. Try a simpler word.`}</T>
        ) : (
          list.map((f, i) => {
            const isOpen = open === i;
            return (
              <Pressable
                key={i}
                onPress={() => { haptic.selection(); setOpen(isOpen ? null : i); }}
                style={{ backgroundColor: d.card, borderWidth: 1, borderColor: isOpen ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : d.cardBorder, borderRadius: 15, padding: 13, marginBottom: 9 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(48,63,143,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="scale" size={11} color="#3F51B5" />
                  </View>
                  <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', lineHeight: 18 }}>{f.t}</T>
                  <Pressable onPress={() => toggleSave(list.indexOf(f) >= 0 ? all.indexOf(f) : i)} hitSlop={8} style={{ padding: 4 }}>
                    <FontAwesome5 name="bookmark" size={13} solid={savedIdx.has(all.indexOf(f))} color={savedIdx.has(all.indexOf(f)) ? '#E8C96A' : d.faint} />
                  </Pressable>
                  <FontAwesome5 name={isOpen ? 'chevron-up' : 'chevron-down'} size={10} color={d.faint} />
                </View>
                {isOpen ? (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: d.cardBorder, paddingTop: 10 }}>
                    <T v="caption" style={{ fontSize: 10, lineHeight: 16, color: d.subtext }}>
                      {(f.q.replace(f.t, '').trim() || f.q).slice(0, 420)}
                    </T>
                    <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, marginTop: 8 }}>{f.a.slice(0, 1400)}…</T>
                    {f.u ? (
                      <Pressable onPress={() => {} } style={{ alignSelf: 'flex-start', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <FontAwesome5 name="link" size={9} color="#5EA7C9" />
                        <T v="caption" style={{ fontSize: 9.5, color: '#5EA7C9' }}>source: islamqa.info</T>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}
        {all && list.length < matched.length ? (
          <Pressable onPress={loadMore} style={{ alignItems: 'center', paddingVertical: 16, gap: 7 }}>
            {more ? <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
            <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>
              {more ? 'Loading more rulings…' : `Load more (${matched.length - list.length} remaining)`}
            </T>
          </Pressable>
        ) : null}
        {all && limit >= matched.length && matched.length > 40 ? (
          <T v="caption" style={{ textAlign: 'center', fontSize: 9.5, color: d.faint, paddingBottom: 8 }}>— all {matched.length} rulings loaded —</T>
        ) : null}
      </ScrollView>
    </View>
  );
}
