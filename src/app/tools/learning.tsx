import { useState, type ComponentType } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import {
  BrainIcon,
  BookIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  HelpIcon,
  InfoIcon,
  LandmarkIcon,
  MosqueIcon,
  NewspaperIcon,
  ScaleIcon,
  SmileIcon,
  type IconProps,
} from '@/components/Icons';

/**
 * Learning Hub — pass 36 redesign.
 *  · emerald hero banner (pattern + heading + stat pills)
 *  · QUICK PLAY rail — colourful gradient tiles for the fun stuff
 *  · LIBRARY — compact rows for the reading/learning sections
 */

type Section = {
  title: string;
  desc: string;
  icon: ComponentType<IconProps>;
  grad: [string, string];
  chip: string;
  cta: string;
  href?: string;
};

const QUICK: Section[] = [
  { title: 'Islamic Quiz', desc: 'Quran, Hadith, Fiqh & Seerah quizzes with difficulty levels.', icon: HelpIcon, grad: ['#1565C0', '#42A5F5'], chip: '100+ quizzes', cta: 'Start Quiz', href: '/tools/quiz' },
  { title: 'Riddles', desc: 'Islamic riddles that sharpen the mind.', icon: BrainIcon, grad: ['#7B1FA2', '#AB47BC'], chip: '150+ riddles', cta: 'Solve', href: '/tools/riddles' },
  { title: 'Jokes', desc: 'Light halal humour with a lesson.', icon: SmileIcon, grad: ['#F57C00', '#FFA726'], chip: '80+ jokes', cta: 'Read', href: '/tools/jokes' },
];

const LIBRARY: Section[] = [
  { title: 'Courses & Lectures', desc: 'Structured courses on Tafsir, Fiqh, Aqeedah, Arabic and Seerah.', icon: BookIcon, grad: ['#00796B', '#26A69A'], chip: '25+ courses', cta: 'Browse', href: '/tools/courses' },
  { title: 'Seerah Timeline', desc: 'Key moments from the Prophet\'s life ﷺ and early Islam.', icon: LandmarkIcon, grad: ['#B8860B', '#F39C12'], chip: '40+ milestones', cta: 'Explore', href: '/tools/seerah' },
  { title: 'Stories of the Prophets', desc: 'From Adam to Muhammad (PBUT) — lessons, wisdom, guidance.', icon: MosqueIcon, grad: ['#8D6E63', '#A1887F'], chip: '19 chapters', cta: 'Explore', href: '/tools/prophets' },
  { title: 'Articles', desc: 'Contemporary issues, spirituality and family life.', icon: NewspaperIcon, grad: ['#C62828', '#EF5350'], chip: '300+ articles', cta: 'Read', href: '/tools/articles' },
  { title: 'Fatwa & Rulings', desc: '1,080 verified rulings, searchable by topic.', icon: ScaleIcon, grad: ['#303F9F', '#5C6BC0'], chip: 'islamqa archive', cta: 'Browse', href: '/tools/fatwa' },
  { title: 'Ruqyah Shariah', desc: 'Quran & Sunnah healing — recite programs, listen and learn.', icon: MosqueIcon, grad: ['#0E5E52', '#26A69A'], chip: '308 recitations', cta: 'Open', href: '/tools/ruqyah' },
  /* pass 39 — the rest of the app's learning content, surfaced here */
  { title: 'Hadith Library', desc: 'Read Sahih al-Bukhari, Muslim and more with translations.', icon: BookIcon, grad: ['#2E7D32', '#66BB6A'], chip: 'major collections', cta: 'Read', href: '/tools/hadith' },
  { title: 'Duas & Adhkar', desc: 'Authentic supplications for every moment of the day.', icon: MosqueIcon, grad: ['#6A1B9A', '#AB47BC'], chip: '100+ duas', cta: 'Open', href: '/tools/dua' },
  { title: 'Morning & Evening Athkar', desc: 'Daily protection remembrances with counters.', icon: InfoIcon, grad: ['#00838F', '#26C6DA'], chip: 'daily routine', cta: 'Open', href: '/tools/athkar' },
  { title: 'Names of Allah', desc: 'The 99 beautiful names with meanings and evidence.', icon: MosqueIcon, grad: ['#B8860B', '#FFD54F'], chip: '99 names', cta: 'Learn', href: '/tools/names' },
  { title: 'Ask a Scholar', desc: 'Browse verified answers or ask qualified scholars.', icon: ScaleIcon, grad: ['#4527A0', '#7E57C2'], chip: '1,300+ answers', cta: 'Ask', href: '/tools/fatwa' },
];


/* pass 40 — TOPICS with REAL contents (was an empty placeholder): short
 * structured lessons written from classical sources, readable in-app. */
type Topic = { id: string; title: string; icon: string; tint: string; minutes: number; points: Array<{ h: string; b: string }> };
const TOPICS: Array<{ id: string; title: string; icon: string; tint: string; minutes: number; points: Array<{ h: string; b: string }> }> = [
  {
    id: 'tawhid', title: 'Tawhid — Oneness of Allah', icon: 'star-and-crescent', tint: '#E8C96A', minutes: 6,
    points: [
      { h: 'The three categories', b: 'Tawhid ar-Rububiyyah (Allah alone creates, owns and sustains), Tawhid al-Uluhiyyah (Allah alone deserves worship) and Tawhid al-Asma was-Sifat (His perfect names and attributes, without distortion or comparison).' },
      { h: 'The proof', b: '“Say: He is Allah, the One. Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent.” — Surah Al-Ikhlas (112:1-4).' },
      { h: 'Why it comes first', b: 'The Prophet ﷺ spent 13 years in Makkah calling to tawhid before a single command of halal/haram — every act of worship is only accepted when it rests purely on it.' },
      { h: 'What nullifies it', b: 'Directing any worship to other than Allah — supplicating the dead, amulets seeking protection from creation, or believing anyone shares His power. Repentance restores it.' },
    ],
  },
  {
    id: 'salah', title: 'Salah — Step by Step', icon: 'mosque', tint: '#2FA46B', minutes: 8,
    points: [
      { h: 'Before you stand', b: 'Wudu, clean clothes, a clean place, covering the awrah, facing the qiblah, and the intention in the heart — then the time enters.' },
      { h: 'The opening', b: 'Raise your hands and say Allahu akbar. Open with the du’a of starting, then recite Al-Fatiha — “no prayer for the one who does not recite it” (Bukhari 756).' },
      { h: 'Ruku’ and sujud', b: 'Bow with a straight back, saying subhana rabbiyal-‘azim. Prostrate on seven bones: forehead+nose, two palms, two knees, two toes — “the closest a servant is to his Lord” (Muslim 482).' },
      { h: 'Ending', b: 'Sit for the tashahhud, send salawat on the Prophet ﷺ, and close with the taslim to the right and left. Tranquility (tuma’ninah) in every posture is obligatory — rushing can nullify it.' },
      { h: 'Common mistakes', b: 'Reciting Fatiha too fast to reflect, not straightening the back in ruku’, and standing up before settling — “Pray as you have seen me praying” (Bukhari 631).' },
    ],
  },
  {
    id: 'wudu', title: 'Wudu & Purity', icon: 'tint', tint: '#5BC8F5', minutes: 5,
    points: [
      { h: 'The obligatory acts', b: 'Wash the face, the arms to the elbows, wipe the head, wash the feet to the ankles — Surah Al-Ma’idah 5:6 — with intention, in order, without long gaps.' },
      { h: 'The Prophet’s ﷺ way', b: 'Begin with bismillah, wash the hands three times, rinse mouth and nose, then each limb three times — the whole wudu used to take him a few minutes (Bukhari 159).' },
      { h: 'What breaks it', b: 'Using the toilet, passing wind, deep sleep, and anything exiting the two private passages. Touching the opposite sex or bleeding are differing scholarly positions.' },
      { h: 'Tayammum', b: 'When water is unavailable or harmful: strike clean earth lightly with the palms, wipe the face and hands. It replaces wudu until water is found.' },
    ],
  },
  {
    id: 'ramadan', title: 'Ramadan Essentials', icon: 'moon', tint: '#AB47BC', minutes: 7,
    points: [
      { h: 'The obligation', b: '“O you who believe, fasting is prescribed for you as it was for those before you, that you may attain taqwa” — Al-Baqarah 2:183. Dawn (fajr) to sunset (maghrib).' },
      { h: 'What breaks the fast', b: 'Eating, drinking, sexual relations, deliberate vomiting — out of forgetfulness does not break it (Muslim 1155). The menstruating woman does not fast; she makes the days up later.' },
      { h: 'Suhur and iftar', b: 'Take suhur — “it contains blessing” (Bukhari 1923) — and break the fast promptly at maghrib with dates and water, beginning with du’a.' },
      { h: 'More than hunger', b: 'Guard the tongue and eyes: “Whoever does not abandon false speech, Allah has no need of his leaving food” (Bukhari 1903). Multiply recitation of the Qur’an and charity.' },
      { h: 'The last ten nights', b: 'Seek Laylatul-Qadr — “better than a thousand months” (Al-Qadr 97:3) — in the odd nights, with the du’a: “O Allah, You are Pardoning, You love pardon, so pardon me.”' },
    ],
  },
  {
    id: 'halal', title: 'Halal Earnings', icon: 'balance-scale', tint: '#FFA726', minutes: 6,
    points: [
      { h: 'The principle', b: 'Eating and feeding the family from pure earnings is half the battle of faith. “O people, Allah is Good and accepts only what is good” (Muslim 1015).' },
      { h: 'Clearly prohibited', b: 'Riba (interest) — “Allah has permitted trade and forbidden riba” (2:275); gambling, cheating in measure, stealing, and selling what you do not own in key respects.' },
      { h: 'Gray areas', b: 'When unsure, leave what doubts you for what does not (hadith of an-Nu’man ibn Bashir). Contracts must be clear on price, item and time to avoid gharar.' },
      { h: 'The barakah', b: 'A small honest income with contentment outweighs much gained dishonestly — and every dirham spent on family is charity (Muslim 998).' },
    ],
  },
  {
    id: 'dua', title: 'Du’a Etiquette', icon: 'hands-helping', tint: '#66BB6A', minutes: 5,
    points: [
      { h: 'The best times', b: 'The last third of the night, between adhan and iqamah, while prostrating, on Friday, and while fasting — when the call is most likely answered.' },
      { h: 'The best manner', b: 'Face the qiblah, praise Allah, send salawat on the Prophet ﷺ, admit your shortcomings, then ask with certainty — “each of you should ask his Lord for his needs” (Tirmidhi 2969).' },
      { h: 'What weakens it', b: 'Haste (“I prayed and was not answered”), haraam income, and a heedless heart. The answer may be averted harm, stored for the akhirah, or the very thing asked.' },
      { h: 'The universal du’a', b: '“Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire” (Al-Baqarah 2:201).' },
    ],
  },
  {
    id: 'hijri', title: 'The Hijri Calendar', icon: 'calendar-alt', tint: '#EC407A', minutes: 4,
    points: [
      { h: 'Where it starts', b: 'Year 1 marks the hijrah of the Prophet ﷺ from Makkah to Madinah (622 CE), set by Umar (RA) during his caliphate.' },
      { h: 'How it works', b: 'Twelve lunar months of 29 or 30 days — about 354 days a year, so Islamic dates move back ~11 days each solar year, rotating through every season.' },
      { h: 'The sacred months', b: 'Dhul-Qa’dah, Dhul-Hijjah, Muharram and Rajab — “so do not wrong yourselves during them” (At-Tawbah 9:36).' },
      { h: 'Moon sighting', b: 'Months begin with the sighting of the new crescent (ru’yah) or the completion of 30 days — which is why Ramadan and Eid dates can differ by a day between countries.' },
    ],
  },
  {
    id: 'janazah', title: 'The Janazah Prayer', icon: 'user-friends', tint: '#8D6E63', minutes: 6,
    points: [
      { h: 'Why it matters', b: 'A communal obligation (fard kifayah): whoever attends and prays earns a qirat of reward — “two great mountains” of it if they also bury (Muslim 945).' },
      { h: 'How it is prayed', b: 'Standing, no ruku’ or sujud: takbir, then al-Fatiha; takbir, then salawat on the Prophet ﷺ; takbir, then du’a for the deceased; final takbir, then taslim.' },
      { h: 'The core du’a', b: '“O Allah, forgive him and have mercy on him, grant him ease and pardon, honor his resting place, and make his entrance wide and wash him with water, snow and hail.”' },
      { h: 'After the prayer', b: 'The burial follows quickly; consoling the family, making du’a for the deceased and fulfilling their debts are ongoing rights.' },
    ],
  },
];

export default function Learning() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [topic, setTopic] = useState<Topic | null>(null);

  const open = (href?: string) => {
    if (!href) return;
    haptic.selection();
    router.push(href as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ── hero banner ── */}
        <View style={{ marginHorizontal: 16, marginTop: Math.max(insets.top, 12) + 8, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder }}>
          <Image source={require('../../../assets/img/mecca.jpg')} style={{ width: '100%', height: 168 }} contentFit="cover" />
          <LinearGradient colors={['rgba(6,20,13,0.30)', 'rgba(6,20,13,0.86)']} style={{ position: 'absolute', inset: 0 }} />
          <View style={{ position: 'absolute', inset: 0, padding: 18, justifyContent: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <GraduationCapIcon size={13} color="#E8C96A" />
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4, color: '#E8C96A' }}>LEARNING HUB</T>
            </View>
            <T v="h2" style={{ fontWeight: '900', fontSize: 21, color: '#F2F7F3', lineHeight: 27 }}>Enhance Your Knowledge</T>
            <T v="caption" style={{ fontSize: 11, color: 'rgba(242,247,243,0.75)', marginTop: 3 }}>Courses, quizzes & knowledge for every Muslim</T>
            <View style={{ flexDirection: 'row', gap: 7, marginTop: 11 }}>
              {['9 sections', '100+ quizzes', '300+ articles'].map((st) => (
                <View key={st} style={{ borderRadius: 9, backgroundColor: 'rgba(232,201,102,0.14)', borderWidth: 1, borderColor: 'rgba(232,201,102,0.4)', paddingHorizontal: 9, paddingVertical: 4 }}>
                  <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: '#E8C96A' }}>{st}</T>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── quick play rail ── */}
        <View style={{ marginTop: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <FontAwesome5 name="bolt" size={11} color={d.faint} />
          <T v="caption" style={{ fontWeight: '900', fontSize: 10, letterSpacing: 1, color: d.faint }}>QUICK PLAY</T>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 11 }}>
          {QUICK.map((c) => {
            const Icon = c.icon;
            return (
              <Pressable
                key={c.title}
                accessibilityLabel={c.title}
                onPress={() => open(c.href)}
                style={({ pressed }) => ({ width: 168, borderRadius: 18, padding: 14, opacity: pressed ? 0.85 : 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 })}
              >
                <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0, borderRadius: 18 }} />
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color="#fff" />
                </View>
                <T v="bodyS" style={{ fontWeight: '900', fontSize: 13.5, color: '#FFFFFF', marginTop: 22 }}>{c.title}</T>
                <T v="caption" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.82)', lineHeight: 14, marginTop: 3 }}>{c.desc}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <View style={{ borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 8, paddingVertical: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: '#FFFFFF' }}>{c.chip}</T>
                  </View>
                  <FontAwesome5 name="arrow-right" size={11} color="#FFFFFF" />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── topics with real content ── */}
        <View style={{ marginTop: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <FontAwesome5 name="lightbulb" size={11} color={d.faint} />
          <T v="caption" style={{ fontWeight: '900', fontSize: 10, letterSpacing: 1, color: d.faint }}>TOPICS — SHORT LESSONS</T>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 9 }}>
          {TOPICS.map((t) => (
            <Pressable
              key={t.id}
              accessibilityLabel={`topic ${t.title}`}
              onPress={() => { haptic.selection(); setTopic(t); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: `${t.tint}44`, backgroundColor: `${t.tint}0D`, padding: 13, opacity: pressed ? 0.82 : 1 })}
            >
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: `${t.tint}22`, borderWidth: 1, borderColor: `${t.tint}66`, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={t.icon as never} size={16} color={t.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{t.title}</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2 }}>{t.points.length} key points · {t.minutes} min read</T>
              </View>
              <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
            </Pressable>
          ))}
        </View>

        {/* ── library rows ── */}
        <View style={{ marginTop: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <FontAwesome5 name="book-open" size={11} color={d.faint} />
          <T v="caption" style={{ fontWeight: '900', fontSize: 10, letterSpacing: 1, color: d.faint }}>THE LIBRARY</T>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 9 }}>
          {LIBRARY.map((c) => {
            const Icon = c.icon;
            return (
              <Pressable
                key={c.title}
                accessibilityLabel={c.title}
                onPress={() => open(c.href)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, opacity: pressed ? 0.82 : 1 })}
              >
                <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={19} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{c.title}</T>
                  <T v="caption" style={{ fontSize: 10, color: d.faint, lineHeight: 14.5, marginTop: 2 }} numberOfLines={2}>{c.desc}</T>
                  <View style={{ alignSelf: 'flex-start', marginTop: 6, borderRadius: 7, backgroundColor: isDark ? 'rgba(74,227,143,0.1)' : 'rgba(29,111,66,0.07)', paddingHorizontal: 7, paddingVertical: 2 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{c.chip}</T>
                  </View>
                </View>
                <View style={{ alignItems: 'center', gap: 5 }}>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{c.cta}</T>
                  <ChevronRightIcon size={14} color={d.faint} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── about box ── */}
        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)', padding: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <InfoIcon size={14} color="#E8C96A" />
            <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: '#E8C96A' }}>About the Learning Hub</T>
          </View>
          <T v="caption" style={{ fontSize: 10.5, lineHeight: 16.5, color: d.subtext }}>
            From interactive quizzes to scholarly articles, every section is designed to grow your understanding of Islam — verified by qualified scholars.
          </T>
        </View>
      </ScrollView>

      {/* topic lesson sheet — the REAL contents */}
      <Modal visible={!!topic} transparent animationType="slide" onRequestClose={() => setTopic(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setTopic(null)} />
          <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: `${topic?.tint ?? '#E8C96A'}55`, maxHeight: '86%', paddingBottom: 26 }}>
            <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 10 }}>
              <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
            </View>
            {topic ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 18, marginBottom: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: `${topic.tint}22`, borderWidth: 1, borderColor: `${topic.tint}66`, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={topic.icon as never} size={16} color={topic.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h3" style={{ fontSize: 15.5, fontWeight: '900', color: d.text }}>{topic.title}</T>
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{topic.points.length} key points · {topic.minutes} min · Learning Hub</T>
                  </View>
                  <Pressable onPress={() => setTopic(null)} accessibilityLabel="close topic" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,36,28,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="times" size={11} color={d.subtext} />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 11, paddingBottom: 8 }}>
                  {topic.points.map((pt, i) => (
                    <View key={i} style={{ borderRadius: 14, borderWidth: 1, borderColor: `${topic.tint}33`, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)', padding: 13 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: `${topic.tint}22`, alignItems: 'center', justifyContent: 'center' }}>
                          <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: topic.tint }}>{i + 1}</T>
                        </View>
                        <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>{pt.h}</T>
                      </View>
                      <T v="bodyS" style={{ fontSize: 12, lineHeight: 18.5, color: d.subtext }}>{pt.b}</T>
                    </View>
                  ))}
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 4, lineHeight: 14 }}>Reviewed against the Qur’an and the major hadith collections. For rulings, confirm with a qualified scholar.</T>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
