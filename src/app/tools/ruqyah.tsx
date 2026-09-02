import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { stopBubble } from '@/lib/press';
import { RUQYAH_PROGRAMS, RUQYAH_TOPICS, ruqyah, type RuqyahEntry } from '@/lib/islamicApi';
import { audioForEntry, audioForProgram, onRuqyahAudio, playRuqyahAudio, ruqyahPosition, seekRuqyahFrac, stopRuqyahAudio } from '@/lib/ruqyahAudio';
import { ShareWithFriends } from '@/components/ShareWithFriends';

/**
 * pass 35 — Ruqyah Shariah (islamicapi.com):
 *  · 3 programs (Brief / Medium / Long) × from-Quran / from-Sunnah entries
 *  · 13 educational topic categories
 *  · entry sheet: arabic + transliteration + translation + reference + share
 */

type Tab = 'recite' | 'learn';

export default function Ruqyah() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('recite');
  const [program, setProgram] = useState<string>(RUQYAH_PROGRAMS[0].id);
  const [source, setSource] = useState<'from-quran' | 'from-sunnah'>('from-quran');
  const [entries, setEntries] = useState<RuqyahEntry[] | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<RuqyahEntry | null>(null);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState<string | null>(null);
  const [topicArts, setTopicArts] = useState<RuqyahEntry[] | null>(null);
  /* pass 39 — ruqyah AUDIO (static MP3s from the API docs) */
  const [playing, setPlaying] = useState<string | null>(null);
  /* pass 40 — full-program player progress + our send-to-users share */
  const [prog, setProg] = useState<{ pos: number; dur: number } | null>(null);
  const [friendsShare, setFriendsShare] = useState<{ title: string; preview?: string } | null>(null);
  const trackRef = useRef<View>(null);
  useEffect(() => onRuqyahAudio((k) => setPlaying(k)), []);
  /* poll position while the full program plays */
  useEffect(() => {
    const iv = setInterval(() => {
      setProg(playing?.startsWith('full:') ? ruqyahPosition() : null);
    }, 400);
    return () => clearInterval(iv);
  }, [playing]);

  useEffect(() => {
    setEntries(null); setErr(false);
    ruqyah.entries(program, source)
      .then(setEntries)
      .catch(() => setErr(true));
  }, [program, source]);

  useEffect(() => {
    if (!topic) { setTopicArts(null); return; }
    setTopicArts(null);
    ruqyah.topic(topic).then(setTopicArts).catch(() => setTopicArts([]));
  }, [topic]);

  const filtered = (entries ?? []).filter((e) => !q.trim() || e.title.toLowerCase().includes(q.toLowerCase()));

  const EntryRow = ({ e }: { e: RuqyahEntry }) => {
    const key = `${program}:${source}:${e.id}`;
    const done = readSet.has(key);
    return (
      <Pressable
        accessibilityLabel={`ruqyah ${e.title}`}
        onPress={() => { haptic.selection(); setOpen(e); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: done ? 'rgba(74,227,143,0.35)' : d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 8, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: source === 'from-quran' ? 'rgba(74,227,143,0.1)' : 'rgba(212,175,55,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name={source === 'from-quran' ? 'book-open' : 'comment-dots'} size={13} color={source === 'from-quran' ? (isDark ? '#4AE38F' : '#1D6F42') : '#E8C96A'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', color: d.text }} numberOfLines={1}>{e.title}</T>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }} numberOfLines={1}>{e.reference || e.sub_category || (source === 'from-quran' ? 'Quran' : 'Sunnah')}</T>
        </View>
        {done ? <FontAwesome5 name="check-circle" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
        {audioForEntry(e.title) ? <FontAwesome5 name="volume-up" size={11} color="#E8C96A" style={{ marginLeft: done ? 6 : 0 }} /> : null}
        <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 12) + 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="shield-alt" size={15} color="#E8C96A" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Ruqyah Shariah</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>Quran & Sunnah healing · 308 recitations · 13 topics</T>
          </View>
        </View>

        {/* tabs */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 4 }}>
          {([['recite', 'Recitations', 'book-open'], ['learn', 'Learn', 'graduation-cap']] as const).map(([id, label, icon]) => {
            const on = tab === id;
            return (
              <Pressable key={id} onPress={() => { haptic.selection(); setTab(id); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.14)' : 'rgba(29,111,66,0.09)') : 'transparent' }}>
                <FontAwesome5 name={icon} size={11} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{label}</T>
              </Pressable>
            );
          })}
        </View>

        {tab === 'recite' ? (
          <>
            {/* program picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
              {RUQYAH_PROGRAMS.map((p) => {
                const on = program === p.id;
                return (
                  <Pressable key={p.id} onPress={() => { haptic.selection(); setProgram(p.id); }} style={{ borderRadius: 13, borderWidth: 1, borderColor: on ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.09)' : d.card, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? '#E8C96A' : d.subtext }}>{p.label}</T>
                    <T v="caption" style={{ fontSize: 8.5, color: d.faint, marginTop: 1 }}>{p.sub}</T>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* source toggle */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 3 }}>
              {([['from-quran', 'From the Quran', 'book-open'], ['from-sunnah', 'From the Sunnah', 'comment-dots']] as const).map(([id, label, icon]) => {
                const on = source === id;
                return (
                  <Pressable key={id} onPress={() => { haptic.selection(); setSource(id); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 9, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.13)' : 'rgba(29,111,66,0.08)') : 'transparent' }}>
                    <FontAwesome5 name={icon} size={10} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{label}</T>
                  </Pressable>
                );
              })}
            </View>

            {/* pass 40 — OUR player card for the COMPLETE program: play/pause,
             * progress bar with seek, time labels, and a send-to-friends share */}
            {(() => {
              const full = audioForProgram(program);
              const key = `full:${program}`;
              const isOn = playing === key;
              const fmtT = (sec: number) => {
                if (!Number.isFinite(sec) || sec < 0) sec = 0;
                const m = Math.floor(sec / 60);
                const ss = Math.floor(sec % 60);
                return `${m}:${String(ss).padStart(2, '0')}`;
              };
              return full ? (
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: isOn ? 'rgba(74,227,143,0.5)' : 'rgba(212,175,55,0.45)', backgroundColor: isOn ? (isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)') : isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.06)', paddingHorizontal: 13, paddingVertical: 11, marginHorizontal: 16, marginBottom: 12, gap: 9 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable
                      accessibilityLabel="play full ruqyah program"
                      onPress={() => { haptic.medium(); if (isOn) stopRuqyahAudio(); else playRuqyahAudio(key, full.url); }}
                      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isOn ? (isDark ? '#1F8F5C' : '#1D6F42') : 'rgba(212,175,55,0.2)', borderWidth: 1, borderColor: isOn ? 'transparent' : 'rgba(212,175,55,0.55)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <FontAwesome5 name={isOn ? 'pause' : 'play'} size={13} color={isOn ? '#FFFFFF' : '#E8C96A'} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{isOn ? 'Playing full program' : 'Listen — full program audio'}</T>
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{full.label} · downloaded as you listen</T>
                    </View>
                    <Pressable
                      accessibilityLabel="share program with friends"
                      onPress={() => { haptic.light(); setFriendsShare({ title: `Ruqyah Shariah — ${full.label}`, preview: 'Listen along in DeenLink · tools/ruqyah' }); }}
                      style={{ width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <FontAwesome5 name="paper-plane" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                    </Pressable>
                  </View>
                  {isOn ? (
                    <View>
                      {/* seek track */}
                      <Pressable
                        accessibilityLabel="seek program audio"
                        onPress={(e) => {
                          const { locationX } = e.nativeEvent as unknown as { locationX?: number };
                          const w = 300; /* approximate track; clamp handles the rest */
                          const node = trackRef.current as unknown as { measure?: (cb: (x: number, y: number, w: number) => void) => void } | null;
                          const use = (frac: number) => seekRuqyahFrac(Math.max(0, Math.min(1, frac)));
                          if (locationX != null && node?.measure) node.measure((_x, _y, width) => use(locationX / width));
                          else if (locationX != null) use(locationX / w);
                        }}
                        style={{ paddingVertical: 6 }}
                      >
                        <View ref={trackRef as never} style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.12)', overflow: 'hidden' }} pointerEvents="none">
                          <View style={{ width: `${Math.min(100, prog && prog.dur > 0 ? (prog.pos / prog.dur) * 100 : 0)}%`, height: 6, borderRadius: 3, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
                        </View>
                      </Pressable>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{fmtT(prog?.pos ?? 0)}</T>
                        <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{prog && prog.dur > 0 ? fmtT(prog.dur) : 'live'}</T>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null;
            })()}

            {/* search */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12, height: 42, marginHorizontal: 16, marginBottom: 12 }}>
              <FontAwesome5 name="search" size={11} color={d.faint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search recitations…" placeholderTextColor={d.faint} style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 13, color: d.text, paddingVertical: 0 }} />
            </View>

            {entries == null && !err ? (
              <View style={{ alignItems: 'center', padding: 30, gap: 8 }}>
                <ActivityIndicator color="#E8C96A" />
                <T v="caption" style={{ fontSize: 11, color: d.faint }}>Loading ruqyah from IslamicAPI…</T>
              </View>
            ) : err ? (
              <View style={{ alignItems: 'center', padding: 26, gap: 8 }}>
                <FontAwesome5 name="wifi" size={18} color={d.faint} />
                <T v="caption" style={{ fontSize: 11, color: d.subtext, textAlign: 'center' }}>Ruqyah needs an internet connection. Pull the list again once you are back online.</T>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
                {filtered.map((e) => <EntryRow key={String(e.id)} e={e} />)}
                {!filtered.length ? <T v="caption" style={{ textAlign: 'center', color: d.faint, padding: 16 }}>No match for “{q}”.</T> : null}
              </View>
            )}
          </>
        ) : topic ? (
          <>
            <Pressable onPress={() => { haptic.selection(); setTopic(null); }} hitSlop={10} style={{ paddingHorizontal: 18, marginBottom: 8 }}>
              <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '700' }}>‹ All topics</T>
            </Pressable>
            {topicArts == null ? (
              <View style={{ alignItems: 'center', padding: 26 }}><ActivityIndicator color="#E8C96A" /></View>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
                {topicArts.map((a) => (
                  <Pressable key={String(a.id)} onPress={() => { haptic.selection(); setOpen(a); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 8 }}>
                    <FontAwesome5 name="file-alt" size={13} color="#E8C96A" />
                    <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: d.text }} numberOfLines={2}>{a.title}</T>
                    <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {RUQYAH_TOPICS.map((t) => (
              <Pressable key={t.slug} onPress={() => { haptic.selection(); setTopic(t.slug); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 8, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(74,227,143,0.09)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={t.icon} size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: d.text }}>{t.label}</T>
                <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* entry sheet */}
      <Modal visible={open != null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(null)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '86%' }} onStartShouldSetResponder={() => true}>
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <T v="h3" style={{ fontWeight: '800', flex: 1, fontSize: 15, color: d.text }}>{open?.title}</T>
                <Pressable onPress={() => setOpen(null)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="times" size={12} color={d.subtext} />
                </Pressable>
              </View>
              {open?.introduction ? (
                <T v="caption" style={{ fontSize: 11, color: d.subtext, lineHeight: 17, marginBottom: 10 }}>{open.introduction}</T>
              ) : null}
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.04)', padding: 14 }}>
                <T v="bodyS" style={{ fontFamily: 'Amiri-Bold', fontSize: 20, lineHeight: 38, color: d.text, textAlign: 'right' }}>{open?.arabic}</T>
              </View>
              {open?.transliteration ? (
                <T v="caption" style={{ fontSize: 10.5, color: d.subtext, fontStyle: 'italic', lineHeight: 16, marginTop: 10 }}>{open.transliteration}</T>
              ) : null}
              {open?.translation ? (
                <T v="bodyS" style={{ fontSize: 12, color: d.text, lineHeight: 19, marginTop: 10 }}>{open.translation}</T>
              ) : null}
              {open?.reference ? (
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#E8C96A', marginTop: 12 }}>— {open.reference}</T>
              ) : null}
              {/* pass 39 — listen to this entry's audio */}
              {(() => {
                const a = open ? audioForEntry(open.title) : null;
                const key = `e:${open?.id ?? ''}`;
                const isOn = playing === key;
                return a ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: isOn ? 'rgba(74,227,143,0.5)' : 'rgba(212,175,55,0.45)', backgroundColor: isOn ? (isDark ? 'rgba(46,204,113,0.09)' : 'rgba(29,111,66,0.05)') : isDark ? 'rgba(212,175,55,0.07)' : 'rgba(212,175,55,0.05)', paddingHorizontal: 13, paddingVertical: 11, marginTop: 14 }}>
                    <Pressable
                      accessibilityLabel={isOn ? 'stop ruqyah audio' : 'play ruqyah audio'}
                      onPress={() => { haptic.medium(); if (isOn) stopRuqyahAudio(); else if (a) playRuqyahAudio(key, a.url); }}
                      hitSlop={8}
                    >
                      <FontAwesome5 name={isOn ? 'pause' : 'play'} size={13} color={isOn ? (isDark ? '#4AE38F' : '#1D6F42') : '#E8C96A'} />
                    </Pressable>
                    <Pressable onPress={() => { haptic.medium(); if (isOn) stopRuqyahAudio(); else if (a) playRuqyahAudio(key, a.url); }} style={{ flex: 1 }}>
                      <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{isOn ? 'Playing recitation…' : 'Listen to the recitation'}</T>
                    </Pressable>
                    <Pressable
                      accessibilityLabel="download ruqyah audio"
                      onPress={() => { haptic.light(); playRuqyahAudio(key, a.url); }}
                      hitSlop={8}
                      style={{ width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(91,200,245,0.45)', backgroundColor: 'rgba(91,200,245,0.08)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <FontAwesome5 name="cloud-download-alt" size={12} color="#5BC8F5" />
                    </Pressable>
                  </View>
                ) : null;
              })()}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Pressable
                  onPress={() => { if (!open) return; haptic.success(); setReadSet((s) => new Set(s).add(`${program}:${source}:${open.id}`)); setFriendsShare({ title: `${open.title} — Ruqyah Shariah`, preview: `${(open.translation ?? '').slice(0, 80)} · DeenLink` }); }}
                  style={{ flex: 1, borderRadius: 13, backgroundColor: '#1F8F5C', alignItems: 'center', paddingVertical: 12 }}
                >
                  <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Read & share</T>
                </Pressable>
                <Pressable onPress={() => setOpen(null)} style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', paddingVertical: 12 }}>
                  <T v="button" style={{ color: d.subtext, fontWeight: '800', fontSize: 12 }}>Close</T>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ShareWithFriends visible={!!friendsShare} onClose={() => setFriendsShare(null)} title={friendsShare?.title ?? ''} preview={friendsShare?.preview} />
    </View>
  );
}
