import { formatDP } from '@/components/DeenPoints';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { DeenPointsPill } from '@/components/DeenPoints';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import * as api from '@/api/client';
import { AvatarImage } from '@/components/FeedCard';
import { useAuth } from '@/context/AuthContext';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { Scholar } from '@/api/types';
import { DPIcon } from '@/components/DeenPoints';
import { QuestionThreadModal } from '@/components/QuestionThreadModal';
import { VerificationBadge } from '@/components/VerificationBadge';

/**
 * Ask Scholars (pass 34):
 *  · BROWSE — scholars + specialties, search & field filter → ask a scholar
 *  · MY QUESTIONS — track progress (processing / answered / rejected)
 *  · PUBLIC — answered public questions from the community
 *  · DeenPoints only set URGENCY priority — they never buy fatwas (note at
 *    the bottom of the category screen, per the user's clarification text).
 */

const FIELDS = ['Fiqh', 'Aqeedah', 'Hadith', 'Tafsir', 'Taharah', 'Salah', 'Zakah', 'Marriage', 'Inheritance'];
/* pass 35 — every category gets an icon (browse grid + ask multi-select) */
const CAT_META: Record<string, { icon: string; tint: string }> = {
  Fiqh: { icon: 'balance-scale', tint: '#5BC8F5' },
  Aqeedah: { icon: 'landmark', tint: '#E8C96A' },
  Hadith: { icon: 'scroll', tint: '#4AE38F' },
  Tafsir: { icon: 'book-open', tint: '#D4A5F5' },
  Taharah: { icon: 'tint', tint: '#7FD8F5' },
  Salah: { icon: 'mosque', tint: '#4AE38F' },
  Zakah: { icon: 'hand-holding-heart', tint: '#E8C96A' },
  Marriage: { icon: 'heart', tint: '#F58FB0' },
  Inheritance: { icon: 'sitemap', tint: '#F5B971' },
  Youth: { icon: 'user-friends', tint: '#7FD86F' },
  Other: { icon: 'ellipsis-h', tint: '#9AA8A0' },
};
const QCATS = ['Aqeedah', 'Fiqh', 'Hadith', 'Tafsir', 'Zakah', 'Marriage', 'Inheritance', 'Youth', 'Other'];

type Question = {
  id: string;
  scholarId: number;
  scholarName: string;
  title: string;
  body: string;
  cat: string;
  urgency: number; /* deenpoints pledged */
  isPublic: boolean;
  photo?: { uri: string; name?: string; type?: string; size?: number };
  at: number;
  status: 'processing' | 'answered' | 'rejected';
  answer?: string;
  asker?: { name: string; av: string };
};

/* a couple of seeded public answers so the tab is never empty */
/* pass 83-38 — demo public Q&A removed; only real answered questions render */
/* pass 42 — Q&A identity helpers: avatars + info for BOTH sides of every
 * answered exchange (asker row + scholar row with title · madhhab · institute) */
const scholarPhoto = (s: unknown): string | null => {
  const o = s as { photo?: unknown; profile_image_url?: unknown; image?: unknown } | null;
  const first = typeof o?.photo === 'string' ? o.photo : typeof o?.profile_image_url === 'string' ? o.profile_image_url : typeof o?.image === 'string' ? o.image : null;
  return first && first.trim() !== '' ? first : null;
};

/* pass 95 — owner: "under review on a question currently opens a
 * spinning-loader screen — make it an Under Review badge; Rejected must show
 * 'Rejected'; answered also shows a badge".
 *
 * A question can sit in review for days: a spinner is not a status, and the
 * local mirror kept spinning even after the scholar had answered. Every state
 * is now a badge with the same wording the server uses. */
const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Under Review', color: '#E8C96A', icon: 'hourglass-half' },
  reviewing: { label: 'Under Review', color: '#E8C96A', icon: 'hourglass-half' },
  processing: { label: 'Under Review', color: '#E8C96A', icon: 'hourglass-half' },
  to_answer: { label: 'Under Review', color: '#E8C96A', icon: 'hourglass-half' },
  answered: { label: 'Answered', color: '#4AE38F', icon: 'check-circle' },
  rejected: { label: 'Rejected', color: '#F58FB0', icon: 'times-circle' },
};

function StatusBadge({ status, isDark, size = 9 }: { status: string; isDark: boolean; size?: number }) {
  const key = String(status || 'pending').toLowerCase();
  const meta = STATUS_META[key] ?? STATUS_META.pending;
  const color = !isDark && meta.color === '#4AE38F' ? '#1D6F42' : meta.color;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: color + '66', backgroundColor: color + '14', paddingHorizontal: 9, paddingVertical: 3.5 }}>
      <FontAwesome5 name={meta.icon as never} size={Math.max(7, size - 1)} color={color} />
      <T v="caption" style={{ fontSize: size, fontWeight: '900', letterSpacing: 0.4, color }}>{meta.label.toUpperCase()}</T>
    </View>
  );
}
/* pass 83-38 — the roster is server-fed (Admin → Scholars); no demo list */
let SCHOLAR_ROSTER: Scholar[] = [];
const scholarOf = (id: number) => SCHOLAR_ROSTER.find((m) => m.id === id) ?? null;


const timeAgo = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Scholars() {
  const { user: me } = useAuth(); /* pass 83-38 - real own avatar */
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'browse' | 'mine' | 'public'>('browse');
  /* pass 41 — SELECTION SCREEN first (user request): browse scholars / public questions / my questions */
  const [picked, setPicked] = useState<'browse' | 'mine' | 'public' | null>(null);
  const [q, setQ] = useState('');
  const [field, setField] = useState<string | null>(null);
  const [catScreen, setCatScreen] = useState<string | null>(null);
  const [asking, setAsking] = useState<number | null>(null); /* scholar id */
  const [threadQuestion, setThreadQuestion] = useState<api.MyQuestion | null>(null);
  const routeParams = useLocalSearchParams<{ tab?: string; question_id?: string; scholar_id?: string }>();
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    if (routeParams.tab === 'mine' || routeParams.tab === 'public' || routeParams.tab === 'browse') {
      const next = routeParams.tab as 'browse' | 'mine' | 'public';
      setTab(next);
      setPicked(next);
    }
  }, [routeParams.tab]);

  const refreshPoints = useCallback(async () => {
    /* Live accounts must use the ledger. Local storage is only a preview/demo
     * mirror and is never used as a production balance or spending decision. */
    if (api.isLive()) {
      const wallet = await api.deenpointsHistory(1).catch(() => null);
      if (wallet && Number.isFinite(wallet.balance)) {
        setPoints(wallet.balance);
        return;
      }
      setPoints(null);
      return;
    }
    if (api.FORCE_DEMO) {
      const saved = await storage.getItem('dl.deenpoints').catch(() => null);
      setPoints(saved ? Number(saved) || 1250 : 1250);
    }
  }, []);
  useEffect(() => { void refreshPoints(); }, [refreshPoints]);

  /* pass 83-38 — the scholar roster comes from the server.
   * pass 97 — "when i navigate to browse scholars still am not seeing any
   * scholar, its empty": the fetch was fire-and-forget, its failure was
   * swallowed, and it ran exactly once per mount. A single flaky request on a
   * slow network left the roster empty for the whole visit, with the screen
   * blaming the roster ("No scholars are on the roster yet"). Now it retries,
   * says plainly when the server could not be reached, refetches on focus, and
   * never shows a stale empty list over a good one. */
  const [roster, setRoster] = useState<Scholar[]>([]);
  const [rosterState, setRosterState] = useState<'loading' | 'ready' | 'error'>('loading');
  const loadRoster = useCallback(async () => {
    /* pass 98 — api.scholars() never threw; it answered [] for a failed fetch,
     * so this retry loop and its error state were dead code and the screen
     * showed "no scholars" for a network hiccup. null = failed, [] = empty. */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rows = await api.scholars().catch(() => null);
      if (rows !== null) {
        SCHOLAR_ROSTER = rows;
        setRoster(rows);
        setRosterState('ready');
        void refreshPoints();
        return;
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    setRosterState('error');
  }, [refreshPoints]);
  useEffect(() => { void loadRoster(); }, [loadRoster]);
  /* returning to the screen re-checks — a scholar approved a minute ago shows up */
  useFocusEffect(useCallback(() => { void loadRoster(); }, [loadRoster]));
  /* Profile → Ask lands here. Select the requested scholar only after the live
   * roster exists, and never open an ask target for the signed-in account. */
  useEffect(() => {
    const wanted = Number(routeParams.scholar_id ?? 0);
    if (!wanted || !roster.length) return;
    const target = roster.find((x) => x.id === wanted);
    const self = !!me && (Number(me.id) === Number(target?.id) || String(me.username ?? '').replace(/^@/, '').toLowerCase() === String(target?.username ?? '').replace(/^@/, '').toLowerCase());
    setTab('browse');
    setPicked('browse');
    if (target && !self) setAsking(target.id);
  }, [routeParams.scholar_id, roster, me?.id, me?.username]);

  /* pass 89 — the server side of Ask Scholars. Questions, public answers, and
   * statuses are read from the live API; no phone-only question mirror is used
   * as a source of truth. */
  const [liveFatwas, setLiveFatwas] = useState<api.DirectFatwa[]>([]);
  const [liveMine, setLiveMine] = useState<api.MyQuestion[]>([]);

  useEffect(() => {
    const wanted = Number(routeParams.question_id ?? 0);
    if (wanted > 0) {
      const found = liveMine.find((x) => Number(x.id) === wanted);
      if (found) setThreadQuestion(found);
    }
  }, [routeParams.question_id, liveMine]);
  const [scholarBusy, setScholarBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewScholar, setPreviewScholar] = useState<api.DirectFatwa['scholar'] | null>(null);
  const refreshScholarData = async () => {
    setScholarBusy(true);
    const [pub, mine] = await Promise.all([
      api.directFatwas(30).catch(() => [] as api.DirectFatwa[]),
      api.myQuestions().catch(() => null),
    ]);
    setLiveFatwas(pub);
    setLiveMine(mine?.questions ?? []);
    setScholarBusy(false);
  };
  /* pass 90 — owner: "in the scholar's profile … add a button of My Questions
   * with the number of questions … and on the scholars screen, for a scholar
   * account, add a button My Questions that will match the design of the
   * others". The count is the scholar's own waiting queue (server-side). */
  const [desk, setDesk] = useState<{ toAnswer: number; reviewing: number; answered: number } | null>(null);
  const myApproval = String(
    (((me as { scholar?: { approval_status?: string } | null } | null | undefined)?.scholar) || null)
      ?.approval_status || '',
  ).toLowerCase();
  const awaitingApproval = myApproval === 'pending' || myApproval === 'reviewing';
  const isScholarMe =
    String((me as { user_type?: string } | null | undefined)?.user_type || '') === 'scholar' ||
    String(
      ((me as { scholar?: { approval_status?: string } | null } | null | undefined)?.scholar || null)?.approval_status || '',
    ).toLowerCase() === 'approved';
  const refreshDesk = () => {
    if (!isScholarMe || awaitingApproval) return;
    api
      .scholarDeskCounts()
      .then((c) => {
        if (c) setDesk(c);
      })
      .catch(() => {});
  };
  useEffect(() => {
    void refreshDesk();
  }, [isScholarMe]);

  useEffect(() => {
    void refreshScholarData();
  }, []);
  /* Public answered questions are the live Fatwa source. Refresh while the tab
   * is open so a scholar's newly published answer appears without navigating
   * away or relying on bundled data. */
  useEffect(() => {
    if (tab !== 'public' && tab !== 'mine') return;
    void refreshScholarData();
    if (tab !== 'public') return;
    const timer = setInterval(() => { void refreshScholarData(); }, 15000);
    return () => clearInterval(timer);
  }, [tab]);

  const scholar = roster.find((s) => s.id === asking) ?? null;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return roster.filter((s) => {
      const f = field ?? catScreen;
      /* pass 95 — a scholar with no recorded fields stays visible under every
       * category; before the normalisation landed, `fields_of_knowledge` was
       * always undefined here and one category tap emptied the whole roster. */
      if (f && (s.fields_of_knowledge ?? '').trim() !== '' && !(s.fields_of_knowledge ?? '').includes(f)) return false;
      if (!needle) return true;
      return (
        (s.display_name ?? '') + (s.institute ?? '') + (s.fields_of_knowledge ?? '') +
        (s.madhhab ?? '') + (s.level_label ?? '') + (s.country ?? '') + (s.description ?? '')
      ).toLowerCase().includes(needle);
    });
    /* pass 100 — `roster` MUST be a dependency: it arrives from the server
     * AFTER the first render, so a memo keyed only on q/field/catScreen kept the
     * list computed from the empty initial array for ever — the owner saw "No
     * scholar matches that search or field" on an account whose roster has one
     * approved scholar ("Browse scholar is not showing the scholar so that i can
     * ask questions"). Verified on the live site: tapping any category chip
     * changed catScreen, re-ran this memo, and the scholar appeared. */
  }, [q, field, catScreen, roster]);

  /* The SENT TO SCHOLARS block is rendered directly from the server response,
   * so one question has one authoritative status and answer. */
  const [publicQuery, setPublicQuery] = useState('');
  const [publicCategory, setPublicCategory] = useState<string | null>(null);
  const publicRows = useMemo(() => {
    const needle = publicQuery.trim().toLowerCase();
    return [...liveFatwas]
      .filter((f) => !publicCategory || String(f.category ?? '').toLowerCase() === publicCategory.toLowerCase())
      .filter((f) => !needle || `${f.title} ${f.question} ${f.scholar?.name ?? ''} ${f.scholar?.username ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const weight = (f: api.DirectFatwa) => { const p = String((f as api.DirectFatwa & { priority?: string }).priority ?? 'normal'); return p === 'urgent' ? 0 : p === 'priority' ? 1 : 2; };
        return weight(a) - weight(b);
      });
  }, [liveFatwas, publicQuery, publicCategory]);

  /* Search/filtering must query the live public-list endpoint rather than
   * searching only the first phone-sized page. The local filter remains as an
   * instant response while the authoritative server result arrives. */
  useEffect(() => {
    if (tab !== 'public' || (!publicQuery.trim() && !publicCategory)) return;
    const timer = setTimeout(() => {
      void api.directFatwas(100, undefined, publicQuery, publicCategory ?? undefined)
        .then((rows) => {
          if (rows.length || !publicQuery.trim()) {
            setLiveFatwas(rows);
            return;
          }
          /* Older API deployments returned 500 for the repeated-placeholder
           * search query. Fetch the same live source without q and filter the
           * returned rows locally, so public search remains usable immediately
           * while the corrected endpoint is being deployed. */
          return api.directFatwas(100, undefined, undefined, publicCategory ?? undefined).then(setLiveFatwas);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [tab, publicQuery, publicCategory]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar
        showBack
        title="Ask Scholars"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {((me as any)?.user_type ?? '') === 'scholar' ? (
              <Pressable
                accessibilityLabel="Scholar Desk — my questions"
                onPress={() => { haptic.light(); router.push('/tools/scholar-inbox'); }}
                style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center' }}
              >
                <FontAwesome5 name="inbox" size={13} color={d.text} />
              </Pressable>
            ) : null}
            <DeenPointsPill />
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {flash ? (
          <View style={{ borderRadius: 13, borderWidth: 1, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderColor: flash.ok ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : '#F58FB0', backgroundColor: flash.ok ? (isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)') : 'rgba(245,143,176,0.1)' }}>
            <T v="caption" style={{ fontSize: 11, lineHeight: 16, color: d.subtext }} onPressIn={() => setFlash(null)}>{flash.text}</T>
          </View>
        ) : null}

        {picked == null ? (
          /* pass 41 — the SELECTION screen: three big cards instead of tabs */
          <View style={{ gap: 12, marginBottom: 14 }}>
            {/* pass 90 — a scholar gets his own desk as the first card, with the
             * number of questions waiting to be answered. */}
            {isScholarMe ? (
              <Pressable
                accessibilityLabel="Scholar desk — my questions"
                onPress={() => { haptic.medium(); refreshDesk(); router.push('/tools/scholar-inbox' as never); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.33)', backgroundColor: 'rgba(212,175,55,0.06)', padding: 15, opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.33)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="chess" size={17} color="#D4AF37" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <T v="h3" style={{ fontSize: 14.5, fontWeight: '800', color: d.text }}>My Questions — Scholar Desk</T>
                    {desk && desk.toAnswer + desk.reviewing > 0 ? (
                      <View style={{ minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' }}>
                        <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: '#14240F' }}>{desk.toAnswer + desk.reviewing}</T>
                      </View>
                    ) : null}
                  </View>
                  {/* pass 92 — a scholar whose application is still with the
                      verification team keeps his desk card (his page exists from
                      the moment he registers) and is told exactly what unlocks
                      question management, instead of the card vanishing or the
                      queue answering 403 with no explanation. */}
                  <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 2, lineHeight: 15 }}>
                    {desk
                      ? `${desk.toAnswer} waiting for an answer · ${desk.reviewing} under review · ${desk.answered} answered`
                      : awaitingApproval
                        ? 'Your application is with the verification team — answering unlocks the moment an admin approves you and assigns your level.'
                        : 'Answer the ummah\u2019s questions — public answers are posted to your profile.'}
                  </T>
                </View>
                <FontAwesome5 name="chevron-right" size={13} color={d.faint} />
              </Pressable>
            ) : null}
            {([
              ['browse', 'Browse scholars', 'user-graduate', 'Find a qualified scholar by field of knowledge, madhhab or institute — then ask directly.', '#4AE38F'],
              ['public', 'Public questions', 'globe-africa', 'Read answered questions from the community — fiqh, taharah, marriage and more.', '#5BC8F5'],
              ['mine', isScholarMe ? 'Questions I asked' : 'My questions', 'inbox', 'Track everything you asked — processing, answered, or returned.', '#E8C96A'],
            ] as ReadonlyArray<readonly [string, string, string, string, string]>).map(([id, label, icon, sub, tint]) => (
              <Pressable
                key={id}
                accessibilityLabel={label}
                onPress={() => { haptic.medium(); setTab(id as 'browse' | 'mine' | 'public'); setPicked(id as 'browse' | 'mine' | 'public'); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, borderWidth: 1.5, borderColor: `${tint}55`, backgroundColor: `${tint}0F`, padding: 15, opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: `${tint}1E`, borderWidth: 1, borderColor: `${tint}55`, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={icon} size={17} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="h3" style={{ fontSize: 14.5, fontWeight: '800', color: d.text }}>{label}</T>
                  <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 2, lineHeight: 15 }}>{sub}</T>
                </View>
                <FontAwesome5 name="chevron-right" size={13} color={d.faint} />
              </Pressable>
            ))}
          </View>
        ) : (
          /* inside a view — a back pill replaces the tabs */
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Pressable accessibilityLabel="back to choices" onPress={() => { haptic.light(); setPicked(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 11, paddingVertical: 8 }}>
              <FontAwesome5 name="chevron-left" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Choices</T>
            </Pressable>
            <T v="caption" style={{ flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8, color: d.faint }}>
              {picked === 'browse' ? 'BROWSE SCHOLARS' : picked === 'mine' ? 'MY QUESTIONS' : 'PUBLIC QUESTIONS'}
            </T>
            <View style={{ width: 62 }} />
          </View>
        )}

        {/* ── BROWSE ── */}
        {picked != null && tab === 'browse' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10, marginBottom: 10 }}>
              <FontAwesome5 name="search" size={12} color={d.faint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search scholars, institutes, specialties…" placeholderTextColor={d.faint} style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: 'Poppins-Medium', color: d.text }} />
            </View>
            {/* pass 35 — categories are a dedicated screen: tap a card → its scholars */}
            {!catScreen ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 }}>
                {[null, ...FIELDS].map((f) => {
                  const meta = f ? (CAT_META[f] ?? { icon: 'ellipsis-h', tint: '#9AA8A0' }) : { icon: 'globe-africa', tint: '#E8C96A' };
                  return (
                    <Pressable
                      key={f ?? 'all'}
                      accessibilityLabel={f ? `category ${f}` : 'all fields'}
                      onPress={() => { haptic.selection(); setCatScreen(f); }}
                      style={{ width: '31%', flexGrow: 1, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 6, gap: 7 }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${meta.tint}18`, alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={meta.icon as never} size={13} color={meta.tint} />
                      </View>
                      <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: d.subtext, textAlign: 'center' }}>{f ?? 'All fields'}</T>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Pressable onPress={() => { haptic.selection(); setCatScreen(null); }} hitSlop={10}>
                  <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '700' }}>‹ Categories</T>
                </Pressable>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FontAwesome5 name={(CAT_META[catScreen]?.icon ?? 'globe-africa') as never} size={11} color={CAT_META[catScreen]?.tint ?? '#E8C96A'} />
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{catScreen}</T>
                </View>
                <View style={{ width: 60 }} />
              </View>
            )}

            {list.map((s) => {
              const isSelf = !!me && (Number(me.id) === Number(s.id) || String(me.username ?? '').replace(/^@/, '').toLowerCase() === String(s.username ?? '').replace(/^@/, '').toLowerCase());
              return <Pressable
                key={s.id}
                accessibilityLabel={isSelf ? `${s.display_name} — your account` : `ask ${s.display_name}`}
                onPress={() => { haptic.selection(); if (!isSelf) router.push({ pathname: '/profile/[username]', params: { username: String(s.username ?? s.display_name ?? s.id), tab: 'questions' } } as never); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 9, opacity: pressed ? 0.85 : 1 })}
              >
                <AvatarImage source={scholarPhoto(s)} name={s.display_name || 'Scholar'} size={46} tint="rgba(212,175,55,0.14)" border="rgba(212,175,55,0.5)" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T v="body" style={{ fontWeight: '800', fontSize: 13.5, color: d.text, flexShrink: 1 }} numberOfLines={1}>{s.display_name}</T>
                    {s.verification_badge && s.verification_badge !== 'none' ? <VerificationBadge type={s.verification_badge as import('@/api/types').BadgeType} size={11} /> : null}
                    {(s.level_label ?? s.level) ? (
                      <View style={{ borderRadius: 6, backgroundColor: 'rgba(212,175,55,0.14)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', paddingHorizontal: 6, paddingVertical: 1.5 }}>
                        <T v="caption" style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#E8C96A' : '#8C6D1F' }}>{String(s.level_label ?? s.level)}</T>
                      </View>
                    ) : null}
                  </View>
                  {/* pass 95 — the scholar's school/law line and his fields come
                      from the server row now; when only the joined description
                      is available it is shown verbatim instead of a blank "·". */}
                  {(() => {
                    const line = String(s.aqeedah ?? '').trim();
                    return line ? (
                      <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2 }} numberOfLines={1}>Aqeedah: {line}</T>
                    ) : null;
                  })()}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {(s.fields_of_knowledge ?? '').split(', ').filter((f) => f.trim() !== '').map((f) => (
                      <View key={f} style={{ borderRadius: 7, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.2)', paddingHorizontal: 7, paddingVertical: 2 }}>
                        <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', color: isDark ? '#4AE38F' : '#1D6F42' }}>{f}</T>
                      </View>
                    ))}
                    {s.response_time ? (
                      <View style={{ borderRadius: 7, backgroundColor: isDark ? 'rgba(232,201,106,0.12)' : 'rgba(212,175,55,0.1)', paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <FontAwesome5 name="clock" size={7.5} color="#E8C96A" />
                        <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', color: isDark ? '#E8C96A' : '#8C6D1F' }}>replies in {String(s.response_time)}</T>
                      </View>
                    ) : null}
                  </View>
                </View>
                {!isSelf ? <Pressable
                  accessibilityLabel={`Ask ${s.display_name}`}
                  onPress={(event) => { event.stopPropagation(); haptic.selection(); setAsking(s.id); }}
                  style={({ pressed }) => ({ borderRadius: 10, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', paddingHorizontal: 11, paddingVertical: 7, opacity: pressed ? 0.8 : 1 })}
                >
                  <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Ask</T>
                </Pressable> : <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: d.faint }}>You</T>}
              </Pressable>; 
            })}
            {!list.length ? (
              <View style={{ borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 16, marginTop: 24 }}>
                <T v="body" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>
                  {roster.length
                    ? 'No scholar matches that search or field.'
                    : rosterState === 'loading'
                      ? 'Loading the scholar roster…'
                      : rosterState === 'error'
                        ? 'Could not reach the scholar list.'
                        : 'No scholars are on the roster yet.'}
                </T>
                <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, marginTop: 6 }}>
                  {roster.length
                    ? 'Try clearing the search or picking another field — the roster is filtered by the field you chose.'
                    : rosterState === 'error'
                      ? 'Your connection dropped while loading. Tap Retry below — nothing is wrong with your account.'
                      : 'A scholar applies with one document (a certificate, an ijāzah or a recommendation letter), and appears here once the team approves them in Admin → Scholar Management. Press the button below to apply from your own account.'}
                </T>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {/* pass 98 — the copy promised a Retry that did not exist; the
                      roster fetch retries on focus, this does it on demand. */}
                  {rosterState === 'error' ? (
                    <Pressable onPress={() => { haptic.light(); void loadRoster(); }} style={{ marginTop: 11, alignSelf: 'flex-start', borderRadius: 11, backgroundColor: isDark ? 'rgba(74,227,143,0.16)' : 'rgba(29,111,66,0.1)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.45)' : 'rgba(29,111,66,0.35)', paddingHorizontal: 12, paddingVertical: 8 }}>
                      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Retry</T>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => { haptic.light(); router.push('/tools/scholar-apply' as never); }} style={{ marginTop: 11, alignSelf: 'flex-start', borderRadius: 11, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.45)' : 'rgba(29,111,66,0.35)', paddingHorizontal: 12, paddingVertical: 8 }}>
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Apply as a scholar</T>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* DeenPoints clarification — bottom of the selection screen */}
            <View style={{ borderRadius: 17, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)', padding: 15, marginTop: 16 }}>
              <T v="h3" style={{ fontWeight: '800', fontSize: 13.5, color: '#E8C96A' }}>⚠️ Important clarification</T>
              <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.text, marginTop: 8, fontWeight: '700' }}>
                DeenPoints do not buy fatwas or Islamic opinions.
              </T>
              <T v="bodyS" style={{ fontSize: 11, lineHeight: 17, color: d.subtext, marginTop: 4 }}>
                They are used for purchases in DeenLink, unlocking app content, and setting the priority of questions sent to scholars.
              </T>
              <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginTop: 10 }}>EARN DEENPOINTS BY</T>
              {[
                'Participating in app activities — reading Qur’an, prayer times and more',
                'Contributing to the community',
                'Supporting the DeenLink project',
              ].map((x) => (
                <View key={x} style={{ flexDirection: 'row', gap: 7, marginTop: 6 }}>
                  <FontAwesome5 name="check-circle" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 3 }} />
                  <T v="caption" style={{ flex: 1, fontSize: 10.5, lineHeight: 15, color: d.subtext }}>{x}</T>
                </View>
              ))}
              <T v="caption" style={{ fontSize: 10, color: d.faint, fontStyle: 'italic', marginTop: 10 }}>🤍 This system ensures fairness, respect and sustainability.</T>
            </View>
          </>
        ) : null}

        {/* pass 89 — YOUR QUESTIONS AS THE SCHOLARS SEE THEM (server first). */}
        {picked != null && tab === 'mine' ? (
          liveMine.length ? (
            <View style={{ marginBottom: 8 }}>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 7 }}>SENT TO SCHOLARS · {liveMine.length}</T>
              {liveMine.map((x) => (
                <Pressable key={'srvq' + x.id} onPress={() => setThreadQuestion(x)} style={{ borderRadius: 17, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', backgroundColor: d.card, padding: 14, marginBottom: 9 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={x.status} isDark={isDark} />
                    {x.scholar?.name ? (
                      <T v="caption" style={{ fontSize: 10, color: d.faint }}>to {x.scholar.name}</T>
                    ) : null}
                  </View>
                  <T v="body" style={{ fontWeight: '800', fontSize: 13.5, color: d.text, marginTop: 7 }}>{x.title}</T>
                  <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, marginTop: 6 }}>{x.question ?? x.question_text ?? 'Question details unavailable.'}</T>
                  {x.answer ? (
                    <View style={{ marginTop: 7 }}>
                      <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: d.faint, letterSpacing: 0.7 }}>ANSWER</T>
                      <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, marginTop: 3 }}>{x.answer}</T>
                    </View>
                  ) : (
                    <T v="caption" style={{ fontSize: 10.5, lineHeight: 15, color: d.faint, marginTop: 7 }}>
                      {String(x.status).toLowerCase() === 'rejected'
                        ? 'This question could not be answered — see the note from the verification team.'
                        : 'A scholar has the question in their queue. Answers arrive in this list.'}
                    </T>
                  )}
                  {x.attachment_url ? <Image source={{ uri: /^(https?:|blob:|file:|data:)/i.test(x.attachment_url) ? x.attachment_url : `${api.API_ORIGIN}${x.attachment_url.startsWith('/') ? '' : '/'}${x.attachment_url}` }} style={{ width: 150, height: 105, borderRadius: 10, marginTop: 8 }} resizeMode="contain" /> : null}
                </Pressable>
              ))}
            </View>
          ) : scholarBusy ? (
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginVertical: 16 }} />
          ) : null
        ) : null}

        {/* pass 89 — answers PUBLISHED ON THE SERVER. This tab used to read only
            this phone's storage, so a scholar's public answer could never appear. */}
        {picked != null && tab === 'public' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10, marginBottom: 9 }}>
              <FontAwesome5 name="search" size={12} color={d.faint} />
              <TextInput value={publicQuery} onChangeText={setPublicQuery} placeholder="Search question or scholar…" placeholderTextColor={d.faint} style={{ flex: 1, paddingVertical: 11, fontSize: 16, fontFamily: 'Poppins-Medium', color: d.text }} />
              {publicQuery ? <Pressable onPress={() => setPublicQuery('')} hitSlop={8}><FontAwesome5 name="times-circle" size={13} color={d.faint} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 9 }}>
              {[null, ...Array.from(new Set(liveFatwas.map((f) => f.category).filter(Boolean)))].map((c) => (
                <Pressable key={c ?? 'all'} onPress={() => setPublicCategory(c)} style={{ borderRadius: 999, borderWidth: 1, borderColor: publicCategory === c ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder, backgroundColor: publicCategory === c ? (isDark ? 'rgba(74,227,143,0.12)' : 'rgba(29,111,66,0.07)') : d.card, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: publicCategory === c ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint }}>{c ?? 'All topics'}</T>
                </Pressable>
              ))}
            </ScrollView>
            {publicRows.length ? (
            <View style={{ marginBottom: 8 }}>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 7 }}>ANSWERED IN PUBLIC · {publicRows.length} · PRIORITY FIRST</T>
              {publicRows.map((f) => (
                <View key={'pf' + f.id} style={{ borderRadius: 17, borderWidth: 1, borderColor: (f.priority === 'urgent' || f.priority === 'priority') ? '#D4AF37' : d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 9 }}>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: (f.priority === 'urgent' || f.priority === 'priority') ? '#D4AF37' : (isDark ? '#4AE38F' : '#1D6F42') }}>
                    {(f.category || 'GENERAL').toUpperCase()} · {f.priority_label ?? (f.priority === 'urgent' ? 'Urgent' : f.priority === 'priority' ? 'Priority' : '')} · {f.answered_time_ago}
                  </T>
                  <T v="body" style={{ fontWeight: '800', fontSize: 13.5, color: d.text, marginTop: 5 }}>{f.title}</T>
                  <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: d.faint, letterSpacing: 0.7, marginTop: 7 }}>QUESTION</T>
                  <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, marginTop: 3 }}>{f.question}</T>
                  {f.user?.username ? (
                    <Pressable
                      accessibilityLabel={`Question asker ${f.user.name ?? f.user.username}`}
                      onPress={() => {
                        const asker = String(f.user?.username ?? '').replace(/^@/, '').toLowerCase();
                        const mine = String(me?.username ?? '').replace(/^@/, '').toLowerCase();
                        if (!asker || (mine && asker === mine)) return;
                        router.push({ pathname: '/profile/[username]', params: { username: f.user?.username } } as never);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, alignSelf: 'flex-start' }}
                    >
                      <AvatarImage source={f.user.profile_image_url ?? null} name={f.user.name || f.user.username} size={23} tint="rgba(74,227,143,0.12)" border={d.cardBorder} />
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>asked by @{f.user.username}</T>
                    </Pressable>
                  ) : null}
                  <View style={{ marginTop: 9, borderRadius: 13, borderTopLeftRadius: 4, marginLeft: 18, backgroundColor: isDark ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.05)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.15)', padding: 11 }}>
                    <Pressable onPress={() => setPreviewScholar(f.scholar)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`View scholar details for ${f.scholar?.name || 'scholar'}`}>
                      <AvatarImage source={f.scholar?.profile_image_url ?? null} name={f.scholar?.name || 'Scholar'} size={30} tint="rgba(212,175,55,0.14)" border="rgba(212,175,55,0.55)" />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text }}>{f.scholar?.name || 'DeenLink scholar'}</T>
                          {f.scholar?.verification_badge && f.scholar.verification_badge !== 'none' ? <VerificationBadge type={f.scholar.verification_badge as import('@/api/types').BadgeType} size={10} /> : null}
                        </View>
                        <T v="caption" style={{ fontSize: 9, color: d.faint }}>answered publicly · {f.tags?.length ? f.tags.slice(0, 3).join(', ') : 'fatwa'}</T>
                        <T v="caption" numberOfLines={1} style={{ fontSize: 8.8, color: d.subtext, marginTop: 2 }}>
                          {[f.scholar?.title || f.scholar?.display_name, f.scholar?.aqeedah ? `Aqeedah: ${f.scholar.aqeedah}` : '', f.scholar?.level_label || f.scholar?.level ? `Level: ${f.scholar.level_label || f.scholar.level}` : ''].filter(Boolean).join(' · ') || 'Verified scholar'}
                        </T>
                      </View>
                      <FontAwesome5 name="info-circle" size={12} color={d.faint} />
                    </Pressable>
                    <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: d.faint, letterSpacing: 0.7, marginTop: 7 }}>ANSWER</T>
                    <T v="bodyS" style={{ fontSize: 14, lineHeight: 22, fontWeight: '800', color: d.text, marginTop: 3 }}>{f.answer}</T>
                    {f.attachment_url ? <Pressable onPress={() => setPreviewImage(/^(https?:|blob:|file:|data:)/i.test(f.attachment_url!) ? f.attachment_url! : `${api.API_ORIGIN}${f.attachment_url!.startsWith('/') ? '' : '/'}${f.attachment_url!}`)}><Image source={{ uri: /^(https?:|blob:|file:|data:)/i.test(f.attachment_url) ? f.attachment_url : `${api.API_ORIGIN}${f.attachment_url.startsWith('/') ? '' : '/'}${f.attachment_url}` }} style={{ width: 150, height: 105, borderRadius: 10, marginTop: 9 }} resizeMode="contain" /></Pressable> : null}
                  </View>
                </View>
              ))}
            </View>
            ) : (
            <View style={{ borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 16, marginBottom: 10 }}>
              <T v="body" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{scholarBusy ? 'Loading public answers…' : 'Nothing published yet'}</T>
              <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, marginTop: 6 }}>
                When a scholar answers a question that was asked in public, the question and the answer are published here for everyone. Ask your own question and leave “Share the answer publicly” on to add to this page — private questions are answered in My Questions only.
              </T>
              <Pressable onPress={() => { haptic.light(); void refreshScholarData(); }} style={{ marginTop: 11, alignSelf: 'flex-start', borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 12, paddingVertical: 8 }}>
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text }}>Refresh</T>
              </Pressable>
            </View>
          )}
          </>
        ) : null}

      </ScrollView>

      <QuestionThreadModal visible={threadQuestion != null} question={threadQuestion} onClose={() => setThreadQuestion(null)} />

      <Modal visible={!!previewScholar} transparent animationType="fade" onRequestClose={() => setPreviewScholar(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' }} onPress={() => setPreviewScholar(null)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: d.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: d.cardBorder, padding: 20, paddingBottom: insets.bottom + 22 }}>
            <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: d.cardBorder, marginBottom: 15 }} />
            {previewScholar ? (
              <>
                <View style={{ alignItems: 'center' }}>
                  <AvatarImage source={previewScholar.profile_image_url ?? null} name={previewScholar.name || 'Scholar'} size={76} tint="rgba(212,175,55,0.14)" border="rgba(212,175,55,0.55)" />
                  <T v="h3" style={{ color: d.text, fontSize: 17, fontWeight: '900', marginTop: 10 }}>{previewScholar.name || 'DeenLink Scholar'}</T>
                  <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }}>@{String(previewScholar.username || '').replace(/^@/, '')}</T>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 15 }}>
                  {[['Title', previewScholar.title || previewScholar.display_name], ['Aqeedah', previewScholar.aqeedah], ['Level', previewScholar.level_label || previewScholar.level], ['Madhhab', previewScholar.madhhab], ['Institute', previewScholar.institute]].filter(([, value]) => String(value || '').trim()).map(([label, value]) => (
                    <View key={String(label)} style={{ borderRadius: 10, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 10, paddingVertical: 7 }}>
                      <T v="caption" style={{ color: d.faint, fontSize: 8.5 }}>{label}</T>
                      <T v="caption" style={{ color: d.text, fontSize: 10.5, fontWeight: '800', marginTop: 2 }}>{String(value)}</T>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => { const u = String(previewScholar.username || '').replace(/^@/, ''); setPreviewScholar(null); if (u) router.push({ pathname: '/profile/[username]', params: { username: u, tab: 'questions' } } as never); }} style={{ marginTop: 18, borderRadius: 13, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', alignItems: 'center', paddingVertical: 13 }}>
                  <T v="button" style={{ color: '#fff', fontWeight: '800' }}>View scholar profile</T>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => setPreviewImage(null)} />
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }} centerContent>
            {previewImage ? <Image source={{ uri: previewImage }} style={{ width: 340, height: 480 }} resizeMode="contain" /> : null}
          </ScrollView>
        </View>
      </Modal>

      {/* ── ASK SHEET ── */}
      <Modal visible={asking != null} transparent animationType="slide" onRequestClose={() => setAsking(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)' }} onPress={() => setAsking(null)} />
        <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '92%' }}>
          <AskSheet
            scholarName={scholar?.display_name ?? ''}
            fields={scholar?.fields_of_knowledge ?? ''}
            points={points}
            onClose={() => setAsking(null)}
            onSubmit={async (payload) => {
              const entry = { ...payload, scholarId: asking ?? 0 };
              setAsking(null);
              setTab('mine');
              /* pass 89 — this is what “scholar: nothing new” actually was: the
               * question never left the phone, and a fake reply was written into
               * local storage after nine seconds. It now goes to
               * api/questions/submit.php so it lands in the scholar's inbox, and
               * the answer (if the scholar shares it publicly) on the public
               * page. The local entry above stays as the offline mirror. */
              if (!api.isLive()) {
                setFlash({ ok: false, text: 'You are offline — connect to the live app before sending this question.' });
                return;
              }
              const r = await api.submitQuestion({
                scholar_id: entry.scholarId,
                title: payload.title,
                details: payload.body,
                privacy: payload.isPublic ? 'public' : 'private',
                category: payload.cat,
                additional_deenpoints: payload.urgency > 0 ? payload.urgency : undefined,
                attachment: payload.photo ?? null,
              }).catch(() => ({ ok: false }));
              if (r.ok) {
                await refreshPoints();
                setFlash({ ok: true, text: 'Sent — the scholar has it in their queue. Answers show up in My Questions, and in Public if you allowed it. JazakAllahu khairan.' });
                const fresh = await api.myQuestions().catch(() => null);
                if (fresh) { setLiveMine(fresh.questions); }
              } else {
                setFlash({ ok: false, text: 'Could not reach the server. Nothing was saved — please try sending again when you are connected.' });
              }
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

function AskSheet({ scholarName, fields, points, onClose, onSubmit }: { scholarName: string; fields: string; points: number | null; onClose: () => void; onSubmit: (p: Omit<Question, 'id' | 'scholarId' | 'at' | 'status'>) => void }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [urgency, setUrgency] = useState('0');
  const [isPublic, setIsPublic] = useState(true);
  const [photo, setPhoto] = useState<Question['photo']>(undefined);
  const pickPhoto = async () => {
    haptic.selection();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.82,
    }).catch(() => null);
    const asset = result && !result.canceled ? result.assets?.[0] : null;
    if (asset?.uri) setPhoto({ uri: asset.uri, name: asset.fileName ?? 'question-photo.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
  };

  const pledged = Math.min(Number(urgency) || 0, points ?? 0);
  const valid = title.trim().length > 4 && body.trim().length > 9;

  return (
    <ScrollView style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: (insets.bottom ?? 0) + 18 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <T v="h3" style={{ fontWeight: '800', fontSize: 15 }}>Ask your question</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>to {scholarName} · {fields}</T>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="times" size={12} color={d.subtext} />
        </Pressable>
      </View>

      {/* deenpoints balance */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.07)' : 'rgba(212,175,55,0.05)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 }}>
        <DPIcon size={13} />
        <T v="bodyS" style={{ flex: 1, fontWeight: '800', fontSize: 12.5, color: d.text }}>{points == null ? 'Loading balance…' : `${formatDP(points)} DeenPoints`}</T>
        <T v="caption" style={{ fontSize: 9, color: d.faint }}>balance</T>
      </View>

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>TITLE</T>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Ruling on combining prayers while travelling" placeholderTextColor={d.faint} style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, fontSize: 14, fontFamily: 'Poppins-Medium', color: d.text, marginBottom: 12 }} />

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>YOUR QUESTION</T>
      <TextInput value={body} onChangeText={setBody} placeholder="Describe your situation with the details that affect the ruling…" placeholderTextColor={d.faint} multiline style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, fontSize: 13.5, minHeight: 110, textAlignVertical: 'top', fontFamily: 'Poppins-Regular', color: d.text, marginBottom: 12 }} />

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>CATEGORY — PICK UP TO 3</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
        {QCATS.map((c) => {
          const on = cats.includes(c);
          const meta = CAT_META[c] ?? CAT_META.Other;
          return (
            <Pressable
              key={c}
              accessibilityLabel={`category ${c}`}
              onPress={() => { haptic.selection(); setCats((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= 3 ? cur : [...cur, c]); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent', paddingHorizontal: 11, paddingVertical: 7 }}
            >
              <FontAwesome5 name={meta.icon as never} size={10} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : meta.tint} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{c}</T>
              {on ? <FontAwesome5 name="check" size={8} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
            </Pressable>
          );
        })}
      </View>

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>URGENCY — PAY DEENPOINTS TO PRIORITIZE</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 12, marginBottom: 4 }}>
        <TextInput editable={points != null} value={urgency} onChangeText={(t) => { const raw = t.replace(/[^0-9]/g, ''); const n = raw === '' ? 0 : Math.min(Number(raw), Math.max(0, points ?? 0)); setUrgency(String(n)); }} keyboardType="numeric" style={{ flex: 1, paddingVertical: 11, fontSize: 14, fontWeight: '700', fontFamily: 'Poppins-Medium', color: d.text }} placeholder="0" placeholderTextColor={d.faint} />
        <DPIcon size={10} color="#E8C96A" /><T v="caption" style={{ fontSize: 9.5, color: d.faint }}>max {points == null ? '—' : formatDP(points)}</T>
      </View>
      <T v="caption" style={{ fontSize: 9, color: d.faint, marginBottom: 12 }}>Paying DeenPoints only moves your question up the queue — it never changes the answer. {pledged ? `${pledged.toLocaleString()} DP will be pledged.` : ''}</T>

      {/* public / private */}
      <Pressable onPress={() => { haptic.selection(); setIsPublic((p) => !p); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, marginBottom: 12 }}>
        <FontAwesome5 name={isPublic ? 'globe-africa' : 'lock'} size={13} color={isPublic ? (isDark ? '#4AE38F' : '#1D6F42') : '#E8C96A'} />
        <View style={{ flex: 1 }}>
          <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{isPublic ? 'Public question' : 'Private question'}</T>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{isPublic ? 'Posted to Public Questions once answered' : 'Visible only to you and the scholar'}</T>
        </View>
        <View style={{ width: 40, height: 22, borderRadius: 12, backgroundColor: isPublic ? '#1F8F5C' : d.bgSoft, borderWidth: 1, borderColor: isPublic ? '#1F8F5C' : d.cardBorder, padding: 2 }}>
          <View style={{ width: 16, height: 16, borderRadius: 9, backgroundColor: '#FFFFFF', marginLeft: isPublic ? 18 : 0 }} />
        </View>
      </Pressable>

      {/* real image picker; the selected URI is sent as multipart FormData */}
      <Pressable onPress={photo ? () => setPhoto(undefined) : pickPhoto} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: photo ? 'rgba(74,227,143,0.4)' : d.cardBorder, backgroundColor: d.bg, padding: 12, marginBottom: 8 }}>
        <FontAwesome5 name={photo ? 'check-circle' : 'camera'} size={13} color={photo ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
        <T v="bodyS" style={{ flex: 1, fontSize: 12, fontWeight: '700', color: photo ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{photo ? 'Photo attached — tap to remove' : 'Attach a photo (optional)'}</T>
      </Pressable>
      {photo ? <Image source={{ uri: photo.uri }} style={{ width: 110, height: 82, borderRadius: 10, marginBottom: 12 }} resizeMode="contain" /> : null}

      <Pressable
        accessibilityLabel="send question"
        onPress={() => { if (valid) { haptic.success(); onSubmit({ scholarName, title: title.trim(), body: body.trim(), cat: cats.join(' · ') || 'Other', urgency: pledged, isPublic, photo: photo ?? undefined }); } }}
        disabled={!valid}
        style={({ pressed }) => ({ borderRadius: 14, backgroundColor: valid ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder, alignItems: 'center', paddingVertical: 14, opacity: pressed ? 0.85 : 1 })}
      >
        <T v="bodyS" style={{ fontWeight: '900', fontSize: 13, color: valid ? '#06140D' : d.faint }}>Send question{pledged ? ` · ${pledged.toLocaleString()} DP` : ''}</T>
      </Pressable>
      <T v="caption" style={{ fontSize: 9, color: d.faint, textAlign: 'center', marginTop: 10, lineHeight: 14 }}>
        Scholars answer according to the Qur{"'"}an and Sunnah. DeenPoints never buy fatwas — they only set priority.
      </T>
    </ScrollView>
  );
}
