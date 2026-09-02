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

/* ── pass 42 — COURSE QUIZZES: 5 questions per curriculum. A quiz session is
 *   Q→A with instant feedback + explanation, then a score card; best score
 *   persists per course under dl.courses.quiz.v1. */
type QuizQ = { q: string; a: string[]; correct: number; why: string };
const QUIZZES: Record<string, QuizQ[]> = {
  'tajwid-essentials': [
    { q: 'How many articulation points (makhārij) do the scholars define?', a: ['10', '14', '17', '21'], correct: 2, why: '17 in total — and the tongue alone carries 10 of them.' },
    { q: 'Before which letter does noon sākinah turn into a mīm sound (iqlāb)?', a: ['ب', 'م', 'و', 'ن'], correct: 0, why: 'Iqlāb: before ب the noon is converted into a hidden mīm.' },
    { q: 'Iẓhār applies when noon sākinah meets…', a: ['the letters ي ر م ل و ن', 'the six throat letters', 'ب only', 'any letter'], correct: 1, why: 'With ء ه ع ح غ خ the noon is pronounced clearly, no nasal hold.' },
    { q: 'How long is the necessary madd (madd lāzim) held?', a: ['2 counts', '4 counts', '5 counts', '6 counts'], correct: 3, why: 'Necessary madd is held steady for six counts.' },
    { q: 'Idghām WITHOUT ghunnah occurs with which two letters?', a: ['ل ر', 'ي م', 'و ن', 'ب م'], correct: 0, why: 'ل and ر merge with no nasal trace; ي م و ن merge with ghunnah.' },
  ],
  'fiqh-worship': [
    { q: 'What is the zakat rate on qualifying wealth?', a: ['1%', '2.5%', '5%', '10%'], correct: 1, why: '2.5% after a lunar year at or above niṣāb (85g gold or equivalent).' },
    { q: 'The window of which prayer ends when "the sun yellows"?', a: ['Dhuhr', 'Asr', 'Maghrib', 'Isha'], correct: 1, why: 'Asr lasts until the sun yellows and weakens.' },
    { q: 'Sujūd is made on how many bones (body parts)?', a: ['5', '6', '7', '8'], correct: 2, why: 'Seven: forehead+nose, two palms, two knees, two toes.' },
    { q: 'When is Zakat al-Fitr due?', a: ['any day of Ramadan', 'before the Eid prayer', 'on Eid day itself', 'at the next Ramadan'], correct: 1, why: 'A staple measure of food per household member, before the Eid prayer.' },
    { q: '"Whoever fasts Ramadan with faith and seeking reward…" — his previous sins are…', a: ['lightened', 'doubled in record', 'forgiven', 'awaited'], correct: 2, why: '…his previous sins are forgiven. (Bukhari 38)' },
  ],
  seerah: [
    { q: 'The Prophet ﷺ was born in…', a: ['the Year of the Elephant', 'the Year of Sorrow', 'the Year of the Trench', 'the Year of Delegation'], correct: 0, why: 'The Year the Elephant — Abrahah’s failed march on the Ka’bah.' },
    { q: 'How many believers fought at Badr?', a: ['313', '700', '1,000', '3,000'], correct: 0, why: '313 against roughly a thousand — victory by Allah’s help.' },
    { q: 'The "Year of Sorrow" marks the deaths of…', a: ['Hamzah & Ja’far', 'Khadījah & Abū Ṭālib', 'Umm Kulthūm & Ibrāhīm', 'ʿUthmān & ʿUmar'], correct: 1, why: 'Khadījah (RA) and his uncle Abū Ṭālib — the two great supports.' },
    { q: 'Which event gave the ummah the five daily prayers?', a: ['the Hijrah', 'Isrā’ & Miʿrāj', 'the Farewell Pilgrimage', 'the Conquest of Makkah'], correct: 1, why: 'The Night Journey — a gift from the fifty to the five.' },
    { q: 'Makkah was opened in which year?', a: ['6 AH', '8 AH', '10 AH', '11 AH'], correct: 1, why: '8 AH — bloodless, with a general amnesty.' },
  ],
  default: [
    { q: 'Every Islamic science begins with…', a: ['memorisation', 'adab', 'debate', 'isnad drawing'], correct: 1, why: 'Adab: intention, respect for the teacher, verified sources.' },
    { q: 'The Prophet ﷺ said whoever travels a path seeking knowledge, Allah eases for him a path to…', a: ['provision', 'Paradise', 'forgiveness', 'honour'], correct: 1, why: '…a path to Paradise. (Muslim 2699)' },
    { q: 'Which study habit multiplies retention, per the course?', a: ['re-reading ten times', 'a five-line summary after each lesson', 'listening while walking', 'group chats'], correct: 1, why: 'Write five lines after each lesson — retrieval beats re-reading.' },
    { q: 'The salaf said knowledge calls to…', a: ['authority', 'action', 'wealth', 'fame'], correct: 1, why: 'It calls to action; if answered it stays, otherwise it departs.' },
    { q: 'The "Feynman test" of understanding is to…', a: ['read aloud fast', 'explain it in two minutes without notes', 'memorise the headings', 'teach only seniors'], correct: 1, why: 'Explain the lesson aloud in two minutes, notes closed.' },
  ],
};
const quizFor = (c: Course): QuizQ[] => QUIZZES[c.slug ?? ''] ?? QUIZZES.default;

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
  /* pass 42 — quiz session state */
  const [quizOn, setQuizOn] = useState(false);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState(0);
  const quiz = quizFor(course);
  useEffect(() => {
    (async () => {
      try {
        const all = JSON.parse((await storage.getItem('dl.courses.quiz.v1')) ?? '{}');
        setBest(all[course.slug ?? course.id.toString()]?.best ?? 0);
      } catch {}
    })();
  }, [course]);
  const saveQuiz = async (sc: number) => {
    setBest((b) => Math.max(b, sc));
    try {
      const all = JSON.parse((await storage.getItem('dl.courses.quiz.v1')) ?? '{}');
      const k = course.slug ?? course.id.toString();
      const cur = all[k] ?? { best: 0, tries: 0 };
      all[k] = { best: Math.max(cur.best, sc), tries: cur.tries + 1 };
      await storage.setItem('dl.courses.quiz.v1', JSON.stringify(all));
    } catch {}
  };
  const startQuiz = () => { haptic.selection(); setQuizOn(true); setQi(0); setPick(null); setScore(0); setFinished(false); };
  const done = progress.length;
  const pct = Math.round((done / lessons.length) * 100);
  const nextIdx = lessons.findIndex((_, i) => !progress.includes(i));

  return (
    <Modal visible animationType="slide" onRequestClose={() => (quizOn ? setQuizOn(false) : li != null ? setLi(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 8 }}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable onPress={() => { haptic.selection(); if (quizOn) setQuizOn(false); else if (li != null) setLi(null); else onClose(); }} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={quizOn ? 'chevron-left' : li != null ? 'chevron-left' : 'times'} size={13} color={theme.primary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h3" numberOfLines={1} style={{ fontWeight: '800' }}>{quizOn ? (finished ? 'Quiz complete' : `Quiz · Q${qi + 1} of ${quiz.length}`) : li != null ? lessons[li].title : course.title}</T>
            <T v="caption" numberOfLines={1} style={{ marginTop: 1 }}>{quizOn ? (finished ? `Score ${score}/${quiz.length} · best ${Math.max(best, score)}` : `${course.title} · question ${qi + 1}`) : li != null ? `${lessons[li].kind === 'lecture' ? 'Lecture' : 'Reading'} · ${lessons[li].minutes} min` : `${done}/${lessons.length} lessons · ${pct}% complete`}</T>
          </View>
          <View style={{ minWidth: 44, height: 26, borderRadius: 9, borderWidth: 1.5, borderColor: pct === 100 ? 'rgba(212,175,55,0.6)' : theme.border, backgroundColor: pct === 100 ? 'rgba(212,175,55,0.12)' : theme.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
            <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: pct === 100 ? '#B8870B' : theme.primary }}>{pct}%</T>
          </View>
        </View>
        {/* thin progress bar */}
        <View style={{ height: 4, backgroundColor: theme.border }}>
          <View style={{ width: `${pct}%`, height: 4, backgroundColor: pct === 100 ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42' }} />
        </View>

        {quizOn ? (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
            {finished ? (
              <View style={{ alignItems: 'center', paddingTop: 26 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2.5, borderColor: score === quiz.length ? 'rgba(212,175,55,0.7)' : isDark ? 'rgba(74,227,143,0.6)' : 'rgba(29,111,66,0.5)', backgroundColor: score === quiz.length ? 'rgba(212,175,55,0.1)' : isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={score === quiz.length ? 'trophy' : 'award'} size={30} color={score === quiz.length ? '#B8870B' : isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <T v="h2" style={{ marginTop: 16, fontWeight: '900' }}>{score === quiz.length ? 'Perfect score!' : score >= quiz.length - 1 ? 'Well done!' : 'Keep studying'}</T>
                <T v="body" style={{ marginTop: 5, color: theme.subtext, textAlign: 'center' }}>You scored {score} of {quiz.length}{best > score ? ` · your best is ${best}` : score > best ? ' · a new best!' : ''}</T>
                <Pressable onPress={startQuiz} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: isDark ? '#4AE38F' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}>
                  <FontAwesome5 name="redo" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  <T v="button" style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>RETRY QUIZ</T>
                </Pressable>
                <Pressable onPress={() => setQuizOn(false)} style={{ marginTop: 10, paddingVertical: 12 }}>
                  <T v="caption" style={{ fontWeight: '700' }}>Back to lessons</T>
                </Pressable>
              </View>
            ) : (
              <View>
                {/* quiz progress dots */}
                <View style={{ flexDirection: 'row', gap: 5, marginBottom: 16 }}>
                  {quiz.map((_, k) => (
                    <View key={k} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: k < qi ? (isDark ? '#4AE38F' : '#1D6F42') : k === qi ? 'rgba(212,175,55,0.8)' : theme.border }} />
                  ))}
                </View>
                <T v="h3" style={{ fontSize: 17, fontWeight: '800', lineHeight: 25 }}>{quiz[qi].q}</T>
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 14, marginBottom: 9 }}>CHOOSE ONE</T>
                {quiz[qi].a.map((opt, k) => {
                  const chosen = pick === k;
                  const reveal = pick != null;
                  const isRight = k === quiz[qi].correct;
                  return (
                    <Pressable
                      key={k}
                      disabled={reveal}
                      onPress={() => { haptic.selection(); setPick(k); if (isRight) setScore((x) => x + 1); }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1.5, borderColor: reveal ? (isRight ? 'rgba(74,227,143,0.75)' : chosen ? 'rgba(239,68,68,0.65)' : theme.border) : chosen ? 'rgba(212,175,55,0.6)' : theme.border, backgroundColor: reveal ? (isRight ? 'rgba(46,204,113,0.1)' : chosen ? 'rgba(239,68,68,0.07)' : theme.card) : theme.card, padding: 13, marginBottom: 9, opacity: pressed ? 0.85 : 1 })}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 1.5, borderColor: reveal ? (isRight ? 'rgba(74,227,143,0.75)' : chosen ? 'rgba(239,68,68,0.65)' : theme.border) : theme.border, alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={reveal ? (isRight ? 'check' : chosen ? 'times' : 'circle') : 'circle'} size={11} color={reveal ? (isRight ? '#2FA866' : chosen ? '#EF4444' : theme.subtext) : theme.subtext} />
                      </View>
                      <T v="bodyS" style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: reveal && isRight ? (isDark ? '#7CE8A8' : '#166534') : theme.text }}>{opt}</T>
                    </Pressable>
                  );
                })}
                {pick != null ? (
                  <View style={{ borderRadius: 13, borderWidth: 1, borderColor: pick === quiz[qi].correct ? 'rgba(74,227,143,0.4)' : 'rgba(239,68,68,0.35)', backgroundColor: pick === quiz[qi].correct ? 'rgba(46,204,113,0.07)' : 'rgba(239,68,68,0.05)', padding: 12, marginTop: 4 }}>
                    <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5, color: pick === quiz[qi].correct ? (isDark ? '#4AE38F' : '#1D6F42') : '#EF4444' }}>{pick === quiz[qi].correct ? 'CORRECT' : 'NOT QUITE'}</T>
                    <T v="bodyS" style={{ fontSize: 12.5, marginTop: 4, color: theme.text }}>{quiz[qi].why}</T>
                    <Pressable
                      onPress={() => { haptic.selection(); if (qi + 1 < quiz.length) { setQi(qi + 1); setPick(null); } else { setFinished(true); saveQuiz(score); } }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}
                    >
                      <FontAwesome5 name={qi + 1 < quiz.length ? 'arrow-right' : 'flag-checkered'} size={12} color="#fff" />
                      <T v="button" style={{ fontSize: 12.5, fontWeight: '800' }}>{qi + 1 < quiz.length ? 'NEXT QUESTION' : 'SEE RESULTS'}</T>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        ) : li == null ? (
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
            {/* pass 42 — course quiz launcher */}
            <Pressable onPress={startQuiz} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.09)', padding: 13, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.55)', backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="graduation-cap" size={14} color="#B8870B" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13 }}>Course quiz</T>
                <T v="caption" style={{ fontSize: 10, marginTop: 2 }}>{quiz.length} questions{best > 0 ? ` · best ${best}/${quiz.length}` : ' · test yourself'}</T>
              </View>
              <ChevronRightIcon size={14} color={theme.subtext} />
            </Pressable>
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
