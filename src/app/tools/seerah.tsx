import { markGoal } from '@/lib/routine';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SEERAH, type SeerahEvent } from '@/data/seerah';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

const CLAMP = 160; // chars shown before "Read more"

/**
 * Seerah timeline (pass 21) — search, per-event bookmarks, clamped cards with
 * Read more → full modal (dates, location, source — everything in the data).
 */
export default function Seerah() {
  useEffect(() => { markGoal('seerah').catch(() => {}); }, []);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [marks, setMarks] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<SeerahEvent | null>(null);
  const [onlyMarked, setOnlyMarked] = useState(false);

  useEffect(() => {
    storage.getItem('dl.seerah.marks').then((r) => {
      if (r)
        try {
          setMarks(new Set(JSON.parse(r)));
        } catch {}
    });
  }, []);

  const toggleMark = (id: number) => {
    haptic.light();
    setMarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      storage.setItem('dl.seerah.marks', JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let l = SEERAH;
    if (onlyMarked) l = l.filter((e) => marks.has(e.id));
    if (needle) {
      l = l.filter(
        (e) =>
          e.title.toLowerCase().includes(needle) ||
          e.desc.toLowerCase().includes(needle) ||
          e.year.includes(needle) ||
          e.hijri.includes(needle) ||
          e.location.toLowerCase().includes(needle),
      );
    }
    return l;
  }, [q, marks, onlyMarked]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header + search */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => { haptic.light(); router.back(); }}
            accessibilityLabel="Back"
            hitSlop={10}
            style={{ width: 38, height: 38, borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="chevron-left" size={15} color={d.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 20 }}>Seerah of the Prophet ﷺ</T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              {list.length} events · {marks.size} bookmarked
            </T>
          </View>
          <Pressable
            onPress={() => { haptic.selection(); setOnlyMarked((o) => !o); }}
            style={{ width: 38, height: 38, borderRadius: 13, borderWidth: 1.5, borderColor: onlyMarked ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: onlyMarked ? 'rgba(212,175,55,0.1)' : d.card, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="bookmark" size={13} solid={onlyMarked} color={onlyMarked ? '#E8C96A' : d.subtext} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 11, marginTop: 10 }}>
          <FontAwesome5 name="search" size={12} color={d.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search events — title, year, place…"
            placeholderTextColor={d.faint}
            style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: d.text, fontFamily: 'Poppins-Medium' }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <FontAwesome5 name="times-circle" size={13} color={d.faint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {list.map((e, i) => {
          const marked = marks.has(e.id);
          const long = e.desc.length > CLAMP;
          return (
            <Pressable
              key={e.id}
              onPress={() => { haptic.selection(); setOpen(e); }}
              style={{ flexDirection: 'row', gap: 12 }}
            >
              {/* rail */}
              <View style={{ alignItems: 'center', width: 38 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={e.icon as never} size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                {i < list.length - 1 ? <View style={{ flex: 1, width: 2, borderRadius: 1, backgroundColor: isDark ? 'rgba(74,227,143,0.2)' : 'rgba(29,111,66,0.15)' }} /> : null}
              </View>

              <View style={{ flex: 1, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: marked ? 'rgba(212,175,55,0.4)' : d.cardBorder, backgroundColor: d.card, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10.5, letterSpacing: 0.5, flexShrink: 1 }}>
                    {e.year.toUpperCase()}{e.hijri ? ` · ${e.hijri}${e.month ? ` ${e.month}` : ''}` : ''}
                  </T>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => toggleMark(e.id)} hitSlop={10} style={{ padding: 3 }}>
                    <FontAwesome5 name="bookmark" size={13} solid={marked} color={marked ? '#E8C96A' : d.faint} />
                  </Pressable>
                </View>
                <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13.5, marginTop: 3 }}>{e.title}</T>
                {e.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <FontAwesome5 name="map-marker-alt" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
                    <T v="caption" style={{ color: d.faint, fontSize: 10.5 }}>{e.location}</T>
                  </View>
                ) : null}
                <T v="caption" numberOfLines={4} style={{ color: d.subtext, fontSize: 11, lineHeight: 16, marginTop: 5 }}>
                  {e.desc}
                </T>
                {long ? (
                  <Pressable onPress={() => { haptic.selection(); setOpen(e); }} hitSlop={6} style={{ marginTop: 5 }}>
                    <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 10.5 }}>Read more</T>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {list.length === 0 ? <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>No events match your search.</T> : null}
      </ScrollView>

      {/* full event modal — everything in the data */}
      <Modal visible={open != null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.62)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(null)} />
          <View style={{ maxHeight: '86%', backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30 }}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
            </View>
            {open ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <View style={{ borderRadius: 9, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 8, paddingVertical: 3 }}>
                    <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10.5 }}>
                      {open.year.toUpperCase()}{open.hijri ? ` · ${open.hijri}${open.month ? ` ${open.month}` : ''}` : ''}
                    </T>
                  </View>
                  {open.location ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', paddingHorizontal: 8, paddingVertical: 3 }}>
                      <FontAwesome5 name="map-marker-alt" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
                      <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 10.5 }}>{open.location}</T>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => toggleMark(open.id)} hitSlop={10} style={{ padding: 4 }}>
                    <FontAwesome5 name="bookmark" size={15} solid={marks.has(open.id)} color={marks.has(open.id) ? '#E8C96A' : d.faint} />
                  </Pressable>
                </View>
                <T v="h3" style={{ fontWeight: '800', fontSize: 16.5, lineHeight: 23, marginTop: 10 }}>{open.title}</T>
                <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, lineHeight: 20, marginTop: 10 }}>{open.desc}</T>
                {open.source ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
                    <FontAwesome5 name="book" size={10} color={d.faint} />
                    <T v="caption" style={{ color: d.faint, fontSize: 10, flexShrink: 1 }}>Source: {open.source}</T>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
