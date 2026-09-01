import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import type { Course } from '@/api/types';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { ChevronRightIcon, GraduationCapIcon, StarIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * Islamic Courses & Lectures (pass 32): the course list opens a REAL learning
 * player — a curriculum of actual lessons (lecture/reading), a reader pane,
 * and per-course progress that persists. A COURSE is a sequence of lessons; a
 * single LECTURE is one lesson inside it.
 */

type Lesson = { title: string; minutes: number; kind: 'lecture' | 'reading'; body: string[] };

const CURRICULUM: Record<string, Lesson[]> = {
  'tajwid-essentials': [
    { title: 'Why Tajwid Matters', minutes: 6, kind: 'lecture', body: ['Tajwid is the discipline of reciting the Qur’an as it was revealed to the Prophet ﷺ and preserved by successive reciters.', 'Allah says: “…and recite the Qur’an with measured recitation.” (Al-Muzzammil 73:4)', 'In this course you will learn the articulation points (makhārij), the rules of noon sākinah and mīm sākinah, elongation (madd), and stopping (waqf).'] },
    { title: 'The Articulation Points (Makhārij)', minutes: 9, kind: 'lecture', body: ['The scholars define 17 articulation points. The tongue alone carries 10 of them — which is why precise recitation takes deliberate practice.', 'Practice tip: say ق then ك back to back. Both are produced deep in the throat-mouth region, but ق is the very root of the tongue and ك slightly forward.', 'Homework: recite Al-Fatiha slowly, naming the makhraj of every letter.'] },
    { title: 'Noon Sākinah & Tanwīn: Iẓhār', minutes: 7, kind: 'reading', body: ['When noon sākinah or tanwīn meets one of the six throat letters (ء ه ع ح غ خ), the noon is pronounced clearly without a nasal hold.', 'Example: مَنْ آمَنَ — the noon is declared, not merged.'] },
    { title: 'Idghām, Iqlāb & Ikhfā', minutes: 10, kind: 'lecture', body: ['Idghām: with ي ر م ل و ن the noon merges into the next letter — with غنة in ي م و ن, without it in ل ر.', 'Iqlāb: before ب the noon turns into a mīm sound. Ikhfā’: before the remaining 15 letters the noon is lightly hidden with a nasal trace.', 'Drill: al-Baqarah 1–5 contains every one of these cases — record yourself and compare with a reciter.'] },
    { title: 'Madd (Elongation) Rules', minutes: 8, kind: 'reading', body: ['Natural madd (two counts) occurs wherever a ḥarf madd follows a vowel. Connected and separated madd stretch 4–5 counts.', 'Necessary madd (6 counts) appears in like لَا أَعْبُدُ and the lām of نَصْتَفِهِ style words — hold it steady.'] },
    { title: 'Waqf (Stopping) & Continuation', minutes: 7, kind: 'lecture', body: ['Knowing where to stop preserves meaning. مْ full stop, ⌐ permissible, لا do not stop.', 'Never stop where the sentence splits a meaning that belongs together — e.g. inside إِنَّ اللَّهَ … statements.'] },
  ],
  'fiqh-worship': [
    { title: 'Purity: Wudū Step by Step', minutes: 9, kind: 'lecture', body: ['Wudū begins with intention and Allah’s name. Wash the hands, rinse the mouth and nose, wash the face, then the arms to the elbows, wipe the head and ears, and wash the feet to the ankles.', 'The Prophet ﷺ said: “No prayer is accepted without purification.” (Bukhari 135)', 'Nullifiers include using the toilet, deep sleep, and the exit of anything from the two passages.'] },
    { title: 'The Prayer’s Conditions & Times', minutes: 8, kind: 'reading', body: ['Five prayers, each with a window: Fajr from true dawn to sunrise; Dhuhr after zenith; Asr until the sun yellows; Maghrib until twilight fades; Isha until dawn.', 'Conditions: Islam, discernment, purity, covering the awrah, facing the qiblah, and entering the time.'] },
    { title: 'The Pillars of Salah', minutes: 11, kind: 'lecture', body: ['Standing in Fajr, the opening takbīr, reciting Al-Fatiha, rukūʿ, sujūd on seven bones, sitting between prostrations, tranquility in every posture, the final tashahhud and salām.', '“Pray as you have seen me praying.” (Bukhari 631)'] },
    { title: 'Sujūd as-Sahw & Common Mistakes', minutes: 7, kind: 'lecture', body: ['Forgetfulness prostrations repair added, omitted, or doubted acts. Two prostrations before the salām when a pillar was doubted after moving past it — otherwise after.', 'Common mistakes: rushing tranquility, reciting Fatiha inaudibly in audible prayers deliberately, and cutting the first taslīm short.'] },
    { title: 'Zakat: The Purifying Due', minutes: 9, kind: 'reading', body: ['2.5% of qualifying wealth held a lunar year at or above niṣāb (85g gold or equivalent). Recipients are the eight categories of At-Tawbah 9:60.', 'Zakat al-Fitr is due before the Eid prayer — a staple measure of food for every household member.'] },
    { title: 'Fasting Ramadan: Essentials', minutes: 8, kind: 'lecture', body: ['Intention the night before, abstention from dawn to sunset, and making up missed days. The fast is voided by eating, drinking, sexual relations, deliberate vomiting — sins of the tongue break its reward.', '“Whoever fasts Ramadan with faith and seeking reward, his previous sins are forgiven.” (Bukhari 38)'] },
  ],
  seerah: [
    { title: 'The World Before the Prophet ﷺ', minutes: 9, kind: 'lecture', body: ['Sixth-century Arabia: tribal honor, poetry, trade — and idols filling the Ka’bah. Yet monotheists remained: the ḥunafā’, seekers of the faith of Ibrāhīm.', 'Understanding pre-Islamic Arabia makes the revolution of Islam measurable.'] },
    { title: 'Birth, Childhood & Young Adulthood', minutes: 8, kind: 'reading', body: ['Born in the Year of the Elephant, orphaned early, raised by his uncle Abū Ṭālib, known as al-Amīn — the trustworthy — long before prophethood.', 'His marriage to Khadījah (RA) at 25 gave him stability and unwavering support.'] },
    { title: 'Revelation & the Makkan Years', minutes: 12, kind: 'lecture', body: ['Cave Ḥirā, Jibrīl’s first command: “Read.” Thirteen years of calling to tawḥīd, persecution, boycott, and the deaths of Khadījah and Abū Ṭālib — the Year of Sorrow.', 'The Night Journey (Isrā’ & Miʿrāj) comforted the Prophet ﷺ and gave the ummah the gift of the five daily prayers.'] },
    { title: 'Hijrah & the Madinan State', minutes: 11, kind: 'lecture', body: ['The migration to Yathrib renamed Madīnah. The Constitution of Madīnah bound Muslims, Jews, and tribes into one polity with the Prophet ﷺ as arbiter.', 'Brotherhood (mu’ākhāh) paired Muhājirūn with Anṣār — the most beautiful social experiment in history.'] },
    { title: 'Badr, Uhud & the Trench', minutes: 12, kind: 'lecture', body: ['Badr (2 AH): 313 believers against ~1,000 — decisive victory by Allah’s help. Uhud (3 AH): a lesson in obedience when archers left their post. The Trench (5 AH): patience under siege.', 'Each battle carried a moral the Qur’an etched permanently.'] },
    { title: 'The Conquest & the Farewell', minutes: 10, kind: 'lecture', body: ['Makkah opened in 8 AH without battle — a general amnesty. The Farewell Pilgrimage carried the final sermon: sanctity of life and property, women’s rights, brotherhood, and the Qur’an as the inheritance.', 'The Prophet ﷺ passed in 11 AH in Madīnah, leaving no dinar — only the deen.'] },
  ],
  default: [
    { title: 'Welcome & How to Study', minutes: 5, kind: 'lecture', body: ['Set a fixed weekly time, study with a notebook, and close every session with a duʿā for beneficial knowledge.', '“Whoever travels a path seeking knowledge, Allah eases for him a path to Paradise.” (Muslim 2699)'] },
    { title: 'Foundations', minutes: 8, kind: 'reading', body: ['Every Islamic science begins with adab: sitting with intention, respecting the teacher, and verifying sources.', 'Knowledge worshiped for its own sake is pride; sought to act upon, it is light.'] },
    { title: 'Core Content', minutes: 10, kind: 'lecture', body: ['Work through the essential texts of this subject level by level — start with summarized classics before extended commentaries.', 'Write a five-line summary after each lesson; retention multiplies.'] },
    { title: 'Application & Practice', minutes: 7, kind: 'reading', body: ['Knowledge is only profit when it changes action. Choose one point from each lesson to implement within 48 hours.', 'The salaf said: knowledge calls to action; if answered it stays, otherwise it departs.'] },
    { title: 'Review & Assessment', minutes: 6, kind: 'lecture', body: ['Self-test: explain the lesson aloud in two minutes without notes — the Feynman test of understanding.', 'Return to previous lessons monthly; spaced review beats re-reading.'] },
  ],
};

const lessonsFor = (c: Course): Lesson[] => CURRICULUM[c.slug ?? ''] ?? CURRICULUM.default;

export default function Courses() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<Course[]>([]);
  const [tab, setTab] = useState('All');
  const [openCourse, setOpenCourse] = useState<Course | null>(null);
  /* per-course progress: { [courseId]: number[] (completed lesson indexes) } */
  const [progress, setProgress] = useState<Record<string, number[]>>({});

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.courses()
      .then((c) => { setCourses(c); })
      .finally(() => setLoading(false));
    storage.getItem('dl.courses.progress.v1').then((r) => {
      try { setProgress(JSON.parse(r ?? '{}')); } catch {}
    }).catch(() => {});
  }, []);

  const toggleDone = (courseId: number, li: number) => {
    haptic.light();
    setProgress((prev) => {
      const cur = prev[courseId] ?? [];
      const next = cur.includes(li) ? cur.filter((x) => x !== li) : [...cur, li];
      const out = { ...prev, [courseId]: next };
      storage.setItem('dl.courses.progress.v1', JSON.stringify(out)).catch(() => {});
      return out;
    });
  };

  /* web parity: course tabs — all / tafsir / fiqh / aqeedah / arabic / tauhid */
  const TABS = ['All', 'Tafsir', 'Fiqh', 'Aqeedah', 'Arabic', 'Tauhid'];
  const list = useMemo(
    () => (tab === 'All' ? courses : courses.filter((c) => ((c.category as string | undefined) ?? 'Other') === tab || (tab === 'Arabic' && (c.category as string | undefined) === 'Qur’an'))),
    [courses, tab],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <PageHero title="Islamic Courses & Lectures" heading="Learn Step by Step" sub="Courses, lessons & lectures — with progress" icon={GraduationCapIcon} height={220} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 6 }}>
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: on ? 'rgba(74,227,143,0.5)' : theme.border, backgroundColor: on ? 'rgba(46,204,113,0.12)' : theme.card, paddingHorizontal: 12, paddingVertical: 7 }}
              >
                {t !== 'All' ? <FontAwesome5 name={{ Tafsir: 'book-open', Fiqh: 'balance-scale', Aqeedah: 'landmark', Arabic: 'language', Tauhid: 'star-and-crescent' }[t] as never} size={9} color={theme.primary} /> : null}
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? theme.primary : theme.subtext }}>{t.toUpperCase()}</T>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ paddingTop: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
          {/* pass 36 — loading skeleton while courses load (slow networks) */}
          {loading && !list.length ? (
            <>
              {[...Array(4)].map((_, i) => (
                <View key={i} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, gap: 10, opacity: 1 - i * 0.15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <View style={{ height: 11, borderRadius: 6, width: '58%', backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                      <View style={{ height: 9, borderRadius: 5, width: '76%', backgroundColor: isDark ? 'rgba(242,247,243,0.05)' : 'rgba(20,36,28,0.04)' }} />
                    </View>
                  </View>
                  <View style={{ height: 9, borderRadius: 5, width: '92%', backgroundColor: isDark ? 'rgba(242,247,243,0.05)' : 'rgba(20,36,28,0.04)' }} />
                  <View style={{ height: 5, borderRadius: 3, width: '100%', backgroundColor: isDark ? 'rgba(242,247,243,0.06)' : 'rgba(20,36,28,0.05)' }} />
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 4 }}>
                <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                <T v="caption" style={{ fontSize: 10.5, color: theme.subtext }}>Loading courses…</T>
              </View>
            </>
          ) : null}
          {list.map((c) => {
            const lessons = lessonsFor(c);
            const done = (progress[c.id] ?? []).length;
            const pct = Math.round((done / lessons.length) * 100);
            return (
              <Pressable
                key={c.id}
                onPress={() => { haptic.selection(); setOpenCourse(c); }}
                style={({ pressed }) => ({ backgroundColor: theme.card, borderRadius: 16, padding: 16, opacity: pressed ? 0.9 : 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <GraduationCapIcon size={22} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h3">{c.title ?? 'Course'}</T>
                    <T v="caption" style={{ marginTop: 3 }}>
                      {(c.category as string | undefined) ?? 'Course'} · {c.level ?? 'All levels'} · {lessons.length} lessons
                    </T>
                  </View>
                  <ChevronRightIcon size={16} color={theme.subtext} />
                </View>
                {c.description ? (
                  <T v="caption" style={{ marginTop: 10, lineHeight: 17 }}>
                    {c.description}
                  </T>
                ) : null}
                {/* progress */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 }}>
                  <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: 5, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
                  </View>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{done}/{lessons.length}{done > 0 ? ` · ${pct}%` : ''}</T>
                </View>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <StarIcon size={14} color={theme.accent} />
            <T v="caption" style={{ flex: 1 }}>
              {api.isLive() ? 'Progress syncs with your DeenLink account.' : 'Progress is saved on this device.'}
            </T>
          </View>
        </View>
      </ScrollView>

      {openCourse ? <CoursePlayer course={openCourse} progress={progress[openCourse.id] ?? []} onToggle={(li) => toggleDone(openCourse.id, li)} onClose={() => setOpenCourse(null)} /> : null}
    </View>
  );
}

/* ── the learning player: curriculum list ⇄ lesson reader ── */
function CoursePlayer({ course, progress, onToggle, onClose }: { course: Course; progress: number[]; onToggle: (li: number) => void; onClose: () => void }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [li, setLi] = useState<number | null>(null);
  const lessons = lessonsFor(course);
  const done = progress.length;
  const pct = Math.round((done / lessons.length) * 100);
  const nextIdx = lessons.findIndex((_, i) => !progress.includes(i));

  return (
    <Modal visible animationType="slide" onRequestClose={() => (li != null ? setLi(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 8 }}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable onPress={() => { haptic.selection(); if (li != null) setLi(null); else onClose(); }} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={li != null ? 'chevron-left' : 'times'} size={13} color={theme.primary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h3" numberOfLines={1} style={{ fontWeight: '800' }}>{li != null ? lessons[li].title : course.title}</T>
            <T v="caption" numberOfLines={1} style={{ marginTop: 1 }}>{li != null ? `${lessons[li].kind === 'lecture' ? 'Lecture' : 'Reading'} · ${lessons[li].minutes} min` : `${done}/${lessons.length} lessons · ${pct}% complete`}</T>
          </View>
          <View style={{ minWidth: 44, height: 26, borderRadius: 9, borderWidth: 1.5, borderColor: pct === 100 ? 'rgba(212,175,55,0.6)' : theme.border, backgroundColor: pct === 100 ? 'rgba(212,175,55,0.12)' : theme.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
            <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: pct === 100 ? '#B8870B' : theme.primary }}>{pct}%</T>
          </View>
        </View>
        {/* thin progress bar */}
        <View style={{ height: 4, backgroundColor: theme.border }}>
          <View style={{ width: `${pct}%`, height: 4, backgroundColor: pct === 100 ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42' }} />
        </View>

        {li == null ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 9 }} showsVerticalScrollIndicator={false}>
            {/* continue card */}
            {nextIdx >= 0 && pct > 0 ? (
              <Pressable onPress={() => { haptic.selection(); setLi(nextIdx); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', padding: 13 }}>
                <FontAwesome5 name="play-circle" size={22} color={isDark ? '#4AE38F' : '#1D6F42'} />
                <View style={{ flex: 1 }}>
                  <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: isDark ? '#4AE38F' : '#1D6F42' }}>CONTINUE</T>
                  <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 12.5, marginTop: 2 }}>{lessons[nextIdx].title}</T>
                </View>
                <ChevronRightIcon size={14} color={theme.subtext} />
              </Pressable>
            ) : null}
            {lessons.map((l, i) => {
              const isDone = progress.includes(i);
              return (
                <Pressable key={i} onPress={() => { haptic.selection(); setLi(i); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: isDone ? 'rgba(212,175,55,0.4)' : theme.border, backgroundColor: theme.card, padding: 13, opacity: pressed ? 0.85 : 1 })}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, borderColor: isDone ? 'rgba(212,175,55,0.55)' : theme.border, backgroundColor: isDone ? 'rgba(212,175,55,0.12)' : theme.card, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={isDone ? 'check' : l.kind === 'lecture' ? 'chalkboard-teacher' : 'book-open'} size={13} color={isDone ? '#B8870B' : theme.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="bodyS" style={{ fontWeight: '700', fontSize: 13 }}>{l.title}</T>
                    <T v="caption" style={{ fontSize: 10, marginTop: 2 }}>{l.kind === 'lecture' ? 'Lecture' : 'Reading'} · {l.minutes} min</T>
                  </View>
                  <ChevronRightIcon size={14} color={theme.subtext} />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ borderRadius: 9, backgroundColor: theme.primarySoft, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 9, paddingVertical: 4 }}>
                <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: theme.primary }}>LESSON {li + 1} OF {lessons.length}</T>
              </View>
              <View style={{ flex: 1 }} />
              <T v="caption" style={{ fontSize: 10, color: theme.subtext }}>{lessons[li].minutes} min</T>
            </View>
            {lessons[li].body.map((p, k) => (
              <T key={k} v="body" style={{ fontSize: 14.5, lineHeight: 24, color: theme.text, marginBottom: 13 }}>{p}</T>
            ))}
            <Pressable
              onPress={() => { onToggle(li); if (li + 1 < lessons.length) setLi(li + 1); else { setLi(null); } }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 8, paddingVertical: 15, borderRadius: 15, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}
            >
              <FontAwesome5 name={progress.includes(li) ? 'check' : 'check-circle'} size={13} color="#fff" />
              <T v="button" style={{ fontSize: 13.5, fontWeight: '800' }}>{progress.includes(li) ? 'COMPLETED — NEXT LESSON' : 'MARK COMPLETE & CONTINUE'}</T>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
