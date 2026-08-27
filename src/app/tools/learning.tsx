import { Linking, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
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

interface LearningCard {
  title: string;
  desc: string;
  icon: ComponentType<IconProps>;
  grad: [string, string];
  stats: { icon: ComponentType<IconProps>; label: string }[];
  cta: string;
  action: { type: 'route'; href: string } | { type: 'web'; url: string } | { type: 'none' };
}

const CARDS: LearningCard[] = [
  {
    title: 'Islamic Quiz',
    desc: 'Test your knowledge with interactive quizzes on Quran, Hadith, Fiqh, Seerah, and Islamic history. Challenge yourself with different difficulty levels.',
    icon: HelpIcon,
    grad: ['#1565C0', '#2196F3'],
    stats: [
      { icon: BookIcon, label: '100+ Quizzes' },
      { icon: BrainIcon, label: '10,000+ Players' },
    ],
    cta: 'Start Quiz',
    action: { type: 'route', href: '/tools/quiz' },
  },
  {
    title: 'Islamic Courses & Lessons',
    desc: 'Structured courses on Tafsir, Fiqh, Aqeedah, Arabic, Seerah, and more. Learn at your own pace with certified instructors.',
    icon: BookIcon,
    grad: ['#00796B', '#00BFA5'],
    stats: [
      { icon: GraduationCapIcon, label: '25+ Courses' },
      { icon: HelpIcon, label: 'Free Certificates' },
    ],
    cta: 'Browse Courses',
    action: { type: 'route', href: '/tools/courses' },
  },
  {
    title: 'Islamic Events',
    desc: 'Explore key moments from the Seerah and early Islamic history in a timeline built for quick reading and deeper reflection.',
    icon: LandmarkIcon,
    grad: ['#D4AF37', '#F39C12'],
    stats: [
      { icon: LandmarkIcon, label: '40+ Milestones' },
      { icon: BookIcon, label: 'Seerah Timeline' },
    ],
    cta: 'Explore Events',
    action: { type: 'route', href: '/tools/events' },
  },
  {
    title: 'Story of the Prophets',
    desc: "Journey through the lives of Allah's Messengers - from Adam to Muhammad (PBUT). Learn valuable lessons, wisdom and guidance from their stories.",
    icon: MosqueIcon,
    grad: ['#8D6E63', '#A0522D'],
    stats: [
      { icon: MosqueIcon, label: '25+ Prophets' },
      { icon: BookIcon, label: 'Quran & Sunnah' },
    ],
    cta: 'Explore Stories',
    action: { type: 'none' },
  },
  {
    title: 'Islamic Riddles',
    desc: 'Sharpen your mind with Islamic-themed riddles and puzzles. Test your critical thinking while learning about Islamic concepts.',
    icon: BrainIcon,
    grad: ['#7B1FA2', '#9C27B0'],
    stats: [
      { icon: BrainIcon, label: '150+ Riddles' },
      { icon: GraduationCapIcon, label: '3 Difficulty Levels' },
    ],
    cta: 'Solve Riddles',
    action: { type: 'web', url: 'https://deenlink.org/learning/riddles.html' },
  },
  {
    title: 'Islamic Jokes',
    desc: 'Light-hearted Islamic humor with educational value. Share laughs while learning important lessons from everyday Islamic life.',
    icon: SmileIcon,
    grad: ['#F57C00', '#FF9800'],
    stats: [
      { icon: SmileIcon, label: '80+ Jokes' },
      { icon: BookIcon, label: 'Share with Friends' },
    ],
    cta: 'Read Jokes',
    action: { type: 'web', url: 'https://deenlink.org/learning/jokes.html' },
  },
  {
    title: 'Islamic Articles',
    desc: 'In-depth articles on contemporary Islamic issues, spirituality, family life, and practical guidance for modern Muslims.',
    icon: NewspaperIcon,
    grad: ['#D32F2F', '#F44336'],
    stats: [
      { icon: NewspaperIcon, label: '300+ Articles' },
      { icon: BookIcon, label: '15 Categories' },
    ],
    cta: 'Read Articles',
    action: { type: 'web', url: 'https://deenlink.org/learning/articles.html' },
  },
  {
    title: 'Fatwa & Rulings',
    desc: 'Authentic Islamic rulings on contemporary issues. Search by topic or ask questions to qualified scholars and muftis.',
    icon: ScaleIcon,
    grad: ['#303F9F', '#3F51B5'],
    stats: [
      { icon: ScaleIcon, label: 'Search Fatwa' },
      { icon: GraduationCapIcon, label: 'Verified Scholars' },
    ],
    cta: 'Browse Fatwas',
    action: { type: 'route', href: '/tools/scholars' },
  },
];

/**
 * Web learning/index.html, 1:1 — page hero "Learning Hub / Enhance Your
 * Knowledge" + eight learning cards (gradient icon, title, description,
 * stat chips, CTA).
 */
export default function Learning() {
  const { theme } = useTheme();
  const router = useRouter();

  const open = (c: LearningCard) => {
    if (c.action.type === 'route') router.push(c.action.href as never);
    else if (c.action.type === 'web') Linking.openURL(c.action.url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <PageHero title="Learning Hub" heading="Enhance Your Knowledge" sub="Courses, quizzes, and knowledge for every Muslim" icon={GraduationCapIcon} />
        <View style={{ paddingTop: 20, paddingLeft: 16, paddingRight: 16, gap: 14 }}>
          {CARDS.map((c) => {
            const Icon = c.icon;
            const comingSoon = c.action.type === 'none';
            return (
              <Pressable
                key={c.title}
                onPress={() => open(c)}
                disabled={comingSoon}
                style={({ pressed }) => ({
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  padding: 20,
                  opacity: comingSoon ? 0.75 : pressed ? 0.9 : 1,
                  shadowColor: '#000',
                  shadowOpacity: 0.05,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                  <LinearGradient
                    colors={c.grad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOpacity: 0.12,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 2,
                    }}
                  >
                    <Icon size={22} color="#fff" />
                  </LinearGradient>
                  <T v="h2" style={{ fontWeight: '700', flex: 1 }}>
                    {c.title}
                  </T>
                </View>
                <T v="bodyS" style={{ lineHeight: 19.5, marginBottom: 12 }}>
                  {c.desc}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  {c.stats.map((s) => {
                    const SIcon = s.icon;
                    return (
                      <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <SIcon size={12} color={theme.subtext} />
                        <T v="caption" style={{ fontSize: 11 }}>
                          {s.label}
                        </T>
                      </View>
                    );
                  })}
                </View>
                {/* CTA (web .card-action: hairline row, primary label + arrow) */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    marginTop: 2,
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                  }}
                >
                  <T v="caption" color={comingSoon ? 'subtext' : 'primary'} style={{ fontSize: 12, fontWeight: '600' }}>
                    {comingSoon ? 'Coming Soon' : c.cta}
                  </T>
                  {!comingSoon ? <ChevronRightIcon size={14} color={theme.subtext} /> : null}
                </View>
              </Pressable>
            );
          })}

          {/* Info box (web .info-box) */}
          <View
            style={{
              backgroundColor: 'rgba(29,111,66,0.1)',
              borderLeftWidth: 4,
              borderLeftColor: theme.primary,
              borderRadius: 12,
              padding: 16,
              marginTop: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <InfoIcon size={15} color={theme.primary} />
              <T v="bodyS" color="primary" style={{ fontWeight: '600' }}>
                About Learning Hub
              </T>
            </View>
            <T v="bodyS" style={{ lineHeight: 19.5 }}>
              Our Learning Hub provides diverse Islamic educational resources. From interactive quizzes to scholarly articles, each section is designed to enhance your understanding of Islam in an engaging way. All content is verified by qualified Islamic scholars.
            </T>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
