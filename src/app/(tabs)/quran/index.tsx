import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import type { ComponentType } from 'react';
import { BookIcon, ChevronRightIcon, ScrollIcon, type IconProps } from '@/components/Icons';

function SectionCard({
  title,
  desc,
  icon: Icon,
  grad,
  titleColor,
  stats,
  onPress,
}: {
  title: string;
  desc: string;
  icon: ComponentType<IconProps>;
  grad: [string, string];
  titleColor: string;
  stats: { n: string; l: string }[];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.card,
        borderRadius: 16,
        overflow: 'hidden',
        opacity: pressed ? 0.9 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          }}
        >
          <Icon size={28} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <T v="h2" style={{ fontWeight: '700', color: titleColor }}>
            {title}
          </T>
          <T v="caption" style={{ marginTop: 4 }}>
            {desc}
          </T>
        </View>
        <ChevronRightIcon size={18} color={theme.subtext} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.cardSoft,
          paddingVertical: 12,
        }}
      >
        {stats.map((s, i) => (
          <View key={s.l} style={{ flex: 1, alignItems: 'center' }}>
            <T v="stat" style={{ fontSize: 18, color: titleColor }}>
              {s.n}
            </T>
            <T v="caption" style={{ marginTop: 2 }}>
              {s.l}
            </T>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/**
 * Web quranHadith/index.html, 1:1 — page hero + The Holy Qur'an card
 * (114 Surahs · 6,236 Verses · 60 Hizb) + Hadith Collections card (14).
 */
export default function QuranHub() {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const quranGrad: [string, string] = isDark ? ['#3498DB', '#2980B9'] : ['#1A5F7A', '#2E86C1'];
  const hadithGrad: [string, string] = isDark ? ['#9B59B6', '#8E44AD'] : ['#6A1B9A', '#8E44AD'];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <PageHero title="Qur'an & Hadith" heading="Divine Guidance" sub="Explore the Holy Quran and authentic Hadith collections" icon={BookIcon} />
        <View style={{ paddingTop: 20, paddingLeft: 16, paddingRight: 16, gap: 16 }}>
          <SectionCard
            title="The Holy Qur'an"
            desc="Read, Listen, and Explore"
            icon={BookIcon}
            grad={quranGrad}
            titleColor={isDark ? '#3498DB' : '#1A5F7A'}
            stats={[
              { n: '114', l: 'Surahs' },
              { n: '6,236', l: 'Verses' },
              { n: '60', l: 'Hizb' },
            ]}
            onPress={() => router.push('/(tabs)/quran/surah')}
          />
          <SectionCard
            title="Hadith Collections"
            desc="Sahih Bukhari, Muslim, and more"
            icon={ScrollIcon}
            grad={hadithGrad}
            titleColor={isDark ? '#9B59B6' : '#6A1B9A'}
            stats={[{ n: '14', l: 'Collections' }]}
            onPress={() => router.push('/tools/hadith')}
          />
        </View>
      </ScrollView>
    </View>
  );
}
