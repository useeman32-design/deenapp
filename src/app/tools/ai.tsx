import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { QURAN } from '@/data/quran';
import { loadSurah } from '@/lib/content';
import { DUA_SECTIONS } from '@/lib/duaSections';
import { storage } from '@/lib/storage';

/**
 * DeenLink AI (pass 22) — an on-device assistant over OUR OWN datasets:
 * answers about any surah, dua topics, daily deen guidance. No external AI
 * service — it searches the user's quran/dua packs and answers with real
 * content + deep links. Clearly labelled "on-device".
 */

type Msg = { id: string; text: string; mine: boolean; link?: { label: string; href: string }; typing?: boolean };
const uid = () => Math.random().toString(36).slice(2, 9);

const SUGGESTIONS = [
  'What is Surah Al-Fatiha about?',
  'Give me a dua for guidance',
  'Which surah protects from anxiety?',
  'A short ayah to start my day',
  'What is Surah Al-Kahf about?',
];

export default function DeenLinkAI() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: uid(),
      mine: false,
      text: 'Assalamu alaikum! I am DeenLink AI — your on-device islamic assistant. Ask me about any surah, a dua topic, or what to read today. I answer from the Qur\'an and dua collections inside the app.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    storage.getItem('dl.ai.history').then((r) => {
      if (r)
        try {
          setHistory(JSON.parse(r));
        } catch {}
    });
  }, []);

  const remember = (q: string) => {
    const next = [q, ...history.filter((h) => h !== q)].slice(0, 12);
    setHistory(next);
    storage.setItem('dl.ai.history', JSON.stringify(next)).catch(() => {});
  };

  /* ---- the "engine": intent match over our own data ---- */
  const answer = async (qRaw: string): Promise<Msg> => {
    const norm = (x: string) => x.toLowerCase().replace(/[-']/g, ' ').replace(/\s+/g, ' ');
    const q = norm(qRaw);
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 500));

    /* surah by name or number */
    const surah = QURAN.find((s) => q.includes(norm(s.english)) || (s.name && q.includes(s.name)) || (/surah \d+/.test(q) && Number(q.match(/surah (\d+)/)?.[1]) === s.number));
    if (surah && q.includes(norm(surah.english))) {
      try {
        const data = await loadSurah(surah.number);
        const first = data?.verses?.[0];
        return {
          id: uid(),
          mine: false,
          text: `Surah ${surah.number} — ${surah.english} (${surah.name}) · ${surah.revelation} · ${surah.ayahs} verses.\n\nIt opens with: "${first?.english?.slice(0, 220) ?? '—'}${first?.english && first.english.length > 220 ? '…' : ''}"\n\n${surah.english === 'Al-Kahf' ? 'It is recited on Fridays and carries four stories of trial: the people of the cave, the man of the two gardens, Musa & Khidr, and Dhul-Qarnayn.' : ''}${surah.english === 'Al-Fatiha' ? 'It is the opening of the Qur\'an, recited in every unit of prayer — a summary of praise, mercy and guidance.' : ''}${surah.english === 'Al-Mulk' ? 'The Prophet ﷺ said it defends its reciter from the trial of the grave.' : ''}`,
          link: { label: `Open ${surah.english}`, href: `/read/${surah.number}` },
        };
      } catch {
        return { id: uid(), mine: false, text: `Surah ${surah.english} (${surar_name(surah.name)}) · ${surah.revelation} · ${surah.ayahs} verses.`, link: { label: `Open ${surah.english}`, href: `/read/${surah.number}` } };
      }
    }

    /* anxiety / protection */
    if (/(anxiety|worry|anxious|stress|protect|fear|calm)/.test(q)) {
      return {
        id: uid(),
        mine: false,
        text: 'For anxiety and worry, the Qur\'an points to two ayat of Ash-Sharh (94:5-6): "For indeed, with hardship [will be] ease." The Prophet ﷺ also taught the dua of Yunus (as): "La ilaha illa anta, subhanaka, inni kuntu minaz-zalimin" (Qur\'an 21:87) — recited in every distress. Surah Al-Fatiha, Ayat al-Kursi (2:255) and the last two surahs (Al-Falaq, An-Nas) are recited for protection morning and evening.',
        link: { label: 'Open Ash-Sharh', href: '/read/94?ayah=5' },
      };
    }

    /* dua topic */
    if (q.includes('dua')) {
      const section = DUA_SECTIONS.find((s) => q.includes(s.label.toLowerCase().split(' ')[0] ?? 'zzz') && s.label.toLowerCase() !== 'other');
      const picked =
        section ??
        DUA_SECTIONS.find((s) => /guidance|right path|hidayah/.test(q) && s.id === 'knowledge') ??
        DUA_SECTIONS.find((s) => /forgive|forgiveness|sin/.test(q) && s.id === 'protection') ??
        DUA_SECTIONS.find((s) => /anxiety|worry|distress/.test(q) && s.id === 'distress') ??
        null;
      if (picked) {
        return { id: uid(), mine: false, text: `Here is a collection for you: ${picked.label}. Open it for the arabic, transliteration, translation and audio. Make the intention, then ask Allah with certainty.`, link: { label: `Open ${picked.label}`, href: `/tools/dua/${picked.id}` } };
      }
      return { id: uid(), mine: false, text: 'Tell me the topic — guidance, forgiveness, morning, evening, sleep, anxiety, protection, or Ramadan — and I will pull the right duas from Hisn al-Muslim.' };
    }

    /* short ayah to start the day */
    if (/(short|start my day|morning ayah|daily ayah|begin)/.test(q)) {
      return {
        id: uid(),
        mine: false,
        text: 'A beautiful way to start the day — Surah Al-Baqarah, Ayah 152: "So remember Me; I will remember you. And be grateful to Me and do not deny Me." Begin with bismillah, the morning adhkar, and Fajr on time.',
        link: { label: 'Open Al-Baqarah 152', href: '/read/2?ayah=152' },
      };
    }

    /* fallback */
    return {
      id: uid(),
      mine: false,
      text: 'I can help with: any surah (name or number) — its opening, size and why it matters; duas by topic; ayahs for anxiety, gratitude or protection; and what to read today. Try: "What is Surah Yasin about?" or "dua for forgiveness".',
    };
  };

  const send = async (text?: string) => {
    const q = (text ?? draft).trim();
    if (!q || busy) return;
    haptic.light();
    remember(q);
    setDraft('');
    setMsgs((m) => [...m, { id: uid(), text: q, mine: true }, { id: uid(), text: '', mine: false, typing: true }]);
    setBusy(true);
    const a = await answer(q);
    setMsgs((m) => [...m.filter((x) => !x.typing), a]);
    setBusy(false);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 100);
  };

  const openLink = (href: string) => {
    haptic.selection();
    router.push(href as never);
  };

  const quick = useMemo(() => SUGGESTIONS, []);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: d.cardBorder }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.6)', backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="robot" size={15} color="#E8C96A" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>DeenLink AI</T>
          <T v="caption" style={{ color: d.faint, fontSize: 10, marginTop: 1 }}>on-device · answers from the app's own quran & dua data</T>
        </View>
      </View>

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 14, paddingBottom: 20, gap: 10 }} showsVerticalScrollIndicator={false}>
        {msgs.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
            {!m.mine ? (
              <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2 }}>
                <FontAwesome5 name="robot" size={10} color="#E8C96A" />
              </View>
            ) : null}
            <View style={{ maxWidth: '80%', borderRadius: 16, borderBottomRightRadius: m.mine ? 5 : 16, borderBottomLeftRadius: m.mine ? 16 : 5, backgroundColor: m.mine ? '#1F8F5C' : d.card, borderWidth: 1, borderColor: m.mine ? 'transparent' : d.cardBorder, paddingHorizontal: 13, paddingVertical: 10 }}>
              {m.typing ? (
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', height: 18 }}>
                  <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginLeft: 4 }}>searching the quran…</T>
                </View>
              ) : (
                <>
                  <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 19, color: m.mine ? '#FFFFFF' : d.text }}>{m.text}</T>
                  {m.link ? (
                    <Pressable onPress={() => openLink(m.link!.href)} style={{ marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)', backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', paddingHorizontal: 10, paddingVertical: 7 }}>
                      <FontAwesome5 name="arrow-right" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
                      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{m.link.label}</T>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* quick chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 8 }}>
        {(history.length ? history.slice(0, 4) : quick).map((qq) => (
          <Pressable key={qq} onPress={() => send(qq)} style={{ borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10, paddingVertical: 6 }}>
            <T v="caption" style={{ fontSize: 9.5, fontWeight: '700', color: d.subtext }}>{qq}</T>
          </Pressable>
        ))}
      </ScrollView>

      {/* composer */}
      <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12), paddingTop: 2, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about a surah, a dua, guidance…"
            placeholderTextColor={d.faint}
            returnKeyType="send"
            onSubmitEditing={() => send()}
            style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: d.text, fontFamily: 'Poppins-Regular' }}
          />
        </View>
        <Pressable onPress={() => send()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: busy ? 'rgba(31,143,92,0.5)' : '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="paper-plane" size={13} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* arabic name safe-print */
function surar_name(name?: string) {
  return name ?? '';
}
