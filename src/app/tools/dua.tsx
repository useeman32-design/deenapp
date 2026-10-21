import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { loadDuas, type ContentDua } from '@/lib/content';
import { markGoal } from '@/lib/routine';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { BackButton } from '@/components/BackButton';
import { haptic } from '@/lib/haptics';
import { DUA_SECTIONS, groupBySection, sectionIdOf, type DuaSectionId } from '@/lib/duaSections';
import { ContentSearchOverlay, type SearchHit } from '@/components/ContentSearchOverlay';
import { useAdminContentDuas } from '@/lib/liveAthkar';

/**
 * Duas (pass 20) — sections list (from the user's dua pack): each section
 * opens /tools/dua/[id] listing its duas. Plus full-text search.
 *
 * PASS 103 — the page used to show duas outside their sections. Two causes,
 * both fixed:
 *   · sections were guessed from title keywords, so 60 of 132 duas fell into a
 *     "More Duas" catch-all and others were misfiled (the Hajj set under
 *     Travel because "first dates of the season" matched "sea" in "season").
 *     Grouping is now an explicit Hisn al-Muslim ID map — see lib/duaSections.
 *   · the 14 admin-managed `kind='dua'` rows were rendered as loose cards in a
 *     "From DeenLink" block above the grid. All 14 have an empty title and are
 *     duplicates of the bundled pack, so the page carried 14 unnamed Arabic
 *     cards that repeated duas already filed below. `useAdminContentDuas` now
 *     drops unnamed rows and anything the pack already has, and files the rest
 *     into a real section — so a genuine admin addition shows up in its section,
 *     never floating outside one.
 */
export default function Duas() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pack, setPack] = useState<Record<string, ContentDua[]> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    markGoal('dua');
    loadDuas()
      .then((p) => setPack(p))
      .catch(() => setPack({}));
  }, []);

  const english = useMemo(() => (pack ? (pack['English'] ?? []) : []), [pack]);
  /* admin additions, already deduped against the pack and bundle-shaped */
  const adminDuas = useAdminContentDuas(english);
  /* one grouped index over both sources, so a section is never split in two */
  const all = useMemo(
    () => (adminDuas.length ? [...english, ...adminDuas] : english),
    [english, adminDuas],
  );
  const grouped = useMemo(() => groupBySection(all), [all]);

  const metaSearch = (q: string): SearchHit[] => {
    const needle = q.toLowerCase();
    return all
      .filter((c) => c.TITLE.toLowerCase().includes(needle))
      .slice(0, 15)
      .map((c) => ({
        key: `d${c.ID}`,
        title: c.TITLE,
        subtitle: `${c.TEXT.length} part${c.TEXT.length > 1 ? 's' : ''} · ${c.AUDIO_URL ? 'audio' : 'text'}`,
        arabic: c.TEXT[0]?.ARABIC_TEXT?.slice(0, 40),
        onPress: () => router.push(`/tools/dua/${sectionIdOf(grouped, c.ID)}?open=${c.ID}` as never),
      }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              Duas & Adhkar
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              {all.length} duas · Hisn al-Muslim{adminDuas.length ? ` + ${adminDuas.length} from DeenLink` : ''}
            </T>
          </View>
          <Pressable onPress={() => { haptic.selection(); setSearchOpen(true); }} style={{ width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="search" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 10, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!pack ? <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>Loading duas…</T> : null}
        {/* PASS 103 — admin additions are filed into their sections below, not
            dumped here as loose cards. This is only a notice, and it names the
            sections they went to so nothing looks like it fell off the page. */}
        {adminDuas.length > 0 && (
          <View style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.30)' : 'rgba(29,111,66,0.20)', borderRadius: 16, padding: 13 }}>
            <FontAwesome5 name="sparkles" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="bodyS" style={{ flex: 1, color: d.subtext, fontSize: 11.5, lineHeight: 16 }}>
              {adminDuas.length} dua{adminDuas.length > 1 ? 's' : ''} added by DeenLink — filed in {sectionLabelsFor(adminDuas, grouped)}
            </T>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {DUA_SECTIONS.filter((s) => grouped[s.id]?.length).map((s) => {
            const count = grouped[s.id].length;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  haptic.selection();
                  router.push(`/tools/dua/${s.id}` as never);
                }}
                style={({ pressed }) => ({
                  width: '47.5%',
                  flexGrow: 1,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  backgroundColor: d.card,
                  padding: 13,
                  gap: 7,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={s.icon as never} size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <T v="body" style={{ color: d.text, fontWeight: '800', fontSize: 12.5, lineHeight: 17 }}>{s.label}</T>
                <T v="caption" style={{ color: d.faint, fontSize: 10 }}>{count} dua{count > 1 ? 's' : ''}</T>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ContentSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="Search duas — title or text…"
        metaSearch={metaSearch}
        contentSearch={async (q) => {
          const needle = q.toLowerCase();
          return all
            .flatMap((c) =>
              c.TEXT.map((t, i) => ({ c, t, i }))
                .filter(({ t }) => (t.ARABIC_TEXT || '').includes(q.trim()) || (t.ENGLISH_TEXT || '').toLowerCase().includes(needle) || (t.TRANSLATED_TEXT || '').toLowerCase().includes(needle))
                .slice(0, 2),
            )
            .slice(0, 40)
            .map(({ c, t }) => ({
              key: `c${t.ID}`,
              title: c.TITLE,
              subtitle: (t.TRANSLATED_TEXT || t.ENGLISH_TEXT || '').slice(0, 90),
              arabic: (t.ARABIC_TEXT || '').slice(0, 44),
              onPress: () => router.push(`/tools/dua/${sectionIdOf(grouped, c.ID)}?open=${c.ID}` as never),
            }));
        }}
        contentLabel="In dua texts"
      />
    </View>
  );
}

/** "Morning & Evening and Travel & Journey" — the sections admin duas landed in. */
function sectionLabelsFor(
  adminDuas: ContentDua[],
  grouped: Record<DuaSectionId, ContentDua[]>,
): string {
  const ids = new Set(adminDuas.map((c) => sectionIdOf(grouped, c.ID)));
  const labels = DUA_SECTIONS.filter((s) => ids.has(s.id)).map((s) => s.label);
  if (!labels.length) return 'More Duas';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
