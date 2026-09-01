import { Pressable, ScrollView, View } from 'react-native';
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
import type { ComponentType } from 'react';

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

export default function Learning() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
    </View>
  );
}
