import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { dictateArabic, speechSupported } from '@/lib/speech';
import { ReciteSearchModal } from '@/components/ReciteSearchModal';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * ContentSearchOverlay (pass 20) — shared search UI for Quran / Hadith /
 * Dua / Athkar: search by name (surah/chapter/section) or by CONTENT
 * (ayah text, hadith text, dua text). Two tiers:
 *   · meta results — instant, from bundled indexes
 *   · content results — async corpus scan with a loading state
 */

export type SearchHit = {
  key: string;
  title: string;
  subtitle?: string;
  arabic?: string;
  /** pass 102 — when the SAME narration is reported by several collections the
   *  hadith search groups them into one hit and lists every book here, so the
   *  member sees "also in Sahih Muslim, Jami' at-Tirmidhi" instead of one
   *  arbitrary collection winning. */
  books?: string[];
  onPress: () => void;
};

export function ContentSearchOverlay({
  visible,
  onClose,
  placeholder,
  metaSearch,
  contentSearch,
  contentLabel = 'In content',
  initialQuery,
}: {
  visible: boolean;
  onClose: () => void;
  placeholder: string;
  /** instant search over names/titles — (q) => hits */
  metaSearch: (q: string) => SearchHit[];
  /** async search inside the corpus — (q) => hits (throw = unavailable) */
  contentSearch?: (q: string) => Promise<SearchHit[]>;
  contentLabel?: string;
  /** pass 24: prefill when opened (recite-to-find pipes dictated text here) */
  initialQuery?: string;
}) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [micBusy, setMicBusy] = useState(false);
  const [micHeard, setMicHeard] = useState('');
  const [speechOk, setSpeechOk] = useState(false);
  const [reciteOpen, setReciteOpen] = useState(false);
  useEffect(() => { setSpeechOk(speechSupported()); }, []);
  const [content, setContent] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const query = q.trim();
  const meta = useMemo(() => (query ? metaSearch(query) : []), [query, metaSearch]);

  useEffect(() => {
    if (!visible) {
      setQ('');
      setContent(null);
      setFailed(false);
    } else if (initialQuery) {
      setQ(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* pass 24: recite-to-find mic */
  const recite = async () => {
    if (micBusy) return;
    setMicBusy(true);
    setMicHeard('');
    try {
      const text = await dictateArabic((i) => setMicHeard(i), 14000);
      if (text.trim()) setQ(text.trim());
    } catch {} finally { setMicBusy(false); }
  };

  useEffect(() => {
    if (!visible || !contentSearch) return;
    let alive = true;
    if (query.length < 2) {
      setContent(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    setFailed(false);
    const t = setTimeout(() => {
      contentSearch(query)
        /* pass 102 — no blind `.slice(0, 40)` here. Truncating before ranking is
         * what made "the rest are not even close": the caller's first 40 in
         * corpus order were kept regardless of relevance. Callers now return an
         * already-scored list, and the full set is rendered inside a ScrollView
         * so nothing is unreachable. */
        .then((r) => alive && (setContent(r), setBusy(false)))
        .catch(() => alive && (setFailed(true), setBusy(false)));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, visible]);

  if (!visible) return null;

  const Hit = ({ h }: { h: SearchHit }) => (
    <Pressable
      onPress={() => {
        haptic.selection();
        h.onPress();
        onClose();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 13, borderWidth: 1, borderColor: theme.border, backgroundColor: pressed ? theme.cardSoft : theme.card, padding: 11, marginBottom: 7, opacity: pressed ? 0.75 : 1 })}
    >
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: `${theme.primary}18`, borderWidth: 1, borderColor: `${theme.primary}35`, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name="search" size={11} color={theme.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 12.5 }}>{h.title}</T>
        {h.subtitle ? <T v="caption" numberOfLines={1} style={{ fontSize: 10, marginTop: 1 }}>{h.subtitle}</T> : null}
        {h.arabic ? <T v="arabic" numberOfLines={1} style={{ fontSize: 14, marginTop: 2, color: theme.subtext }}>{h.arabic}</T> : null}
        {/* pass 102 — every collection that reports this narration */}
        {h.books && h.books.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {h.books.slice(0, 4).map((b) => (
              <View
                key={b}
                style={{
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: `${theme.primary}40`,
                  backgroundColor: `${theme.primary}12`,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <T v="caption" numberOfLines={1} style={{ fontSize: 8.5, fontWeight: '800', color: theme.primary }}>
                  {b}
                </T>
              </View>
            ))}
            {h.books.length > 4 ? (
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: theme.subtext, alignSelf: 'center' }}>
                +{h.books.length - 4} more
              </T>
            ) : null}
          </View>
        ) : null}
      </View>
      <FontAwesome5 name="chevron-right" size={10} color={theme.subtext} />
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 54 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, paddingHorizontal: 10 }}>
            <FontAwesome5 name="search" size={13} color={theme.subtext} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder={placeholder}
              placeholderTextColor={theme.subtext}
              numberOfLines={1}
              style={{ flex: 1, minWidth: 0, paddingVertical: 11, fontSize: 16, color: theme.text, fontFamily: 'Poppins-Medium' }}
            />
            {speechOk ? (
              <Pressable onPress={() => { setReciteOpen(true); }} hitSlop={8} accessibilityLabel="recite to search" style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(44,110,143,0.1)', borderWidth: 1, borderColor: 'rgba(44,110,143,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="microphone-alt" size={14} color="#5EA7C9" />
              </Pressable>
            ) : null}
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <FontAwesome5 name="times-circle" size={14} color={theme.subtext} />
              </Pressable>
            ) : null}
          </View>

        </View>

        {/* pass 102 — was a plain <View>, so any result past the first screenful
            was simply unreachable (owner: "the search results are not
            scrollable, we should fix that, even for the quran"). One ScrollView
            carries BOTH tiers so the whole result set can be read. */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 14 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
        >
          {!query ? (
            <T v="caption" style={{ textAlign: 'center', marginTop: 26 }}>Search by name or content — surahs, chapters, duas, athkar…</T>
          ) : (
            <>
              <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, marginBottom: 7 }}>NAMES · {meta.length}</T>
              {meta.slice(0, 12).map((h) => <Hit key={h.key} h={h} />)}
              {meta.length === 0 ? <T v="caption" style={{ marginBottom: 7 }}>No name matches.</T> : null}

              {contentSearch ? (
                <View style={{ marginTop: 10 }}>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, marginBottom: 7 }}>
                    {contentLabel.toUpperCase()} · {busy ? '…' : content?.length ?? 0}
                  </T>
                  {busy ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9 }}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <T v="caption">Scanning the corpus…</T>
                    </View>
                  ) : failed ? (
                    <T v="caption">Content search unavailable right now.</T>
                  ) : (
                    (content ?? []).map((h) => <Hit key={h.key} h={h} />)
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
        {/* pass 26: glassy recite modal — live bold transcript → analyzing → results */}
        <ReciteSearchModal
          visible={reciteOpen}
          onClose={() => setReciteOpen(false)}
          onText={(t) => { setQ(t); }}
          label={placeholder.includes('hadith') ? 'RECITE THE HADITH' : 'RECITE THE VERSE'}
        />
      </View>
    </Modal>
  );
}
