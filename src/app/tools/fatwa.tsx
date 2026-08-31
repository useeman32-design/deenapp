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

  const list = useMemo(() => {
    if (!all) return [];
    if (view === 'saved') return all.filter((_, i) => savedIdx.has(i));
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 30);
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
      .slice(0, 40)
      .map((x) => x.f);
  }, [all, q, view, savedIdx]);

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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {!all ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 8 }}>Loading 1,080 rulings…</T>
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
      </ScrollView>
    </View>
  );
}
