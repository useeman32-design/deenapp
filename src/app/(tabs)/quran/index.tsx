import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Qur'an & Hadith hub — pass-14 dash redesign: pattern header with gold
 * accents, two premium cards (emerald Qur'an · gold Hadith), quick-strip of
 * reader + collections shortcuts.
 */
export default function QuranHub() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const BigCard = ({
    eyebrow,
    title,
    desc,
    stats,
    icon,
    tint,
    grad,
    onPress,
  }: {
    eyebrow: string;
    title: string;
    desc: string;
    stats: Array<{ n: string; l: string }>;
    icon: string;
    tint: string;
    grad: [string, string, ...string[]];
    onPress: () => void;
  }) => (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${tint}44`,
        backgroundColor: d.card,
        overflow: 'hidden',
        opacity: pressed ? 0.92 : 1,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.25 : 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      })}
    >
      <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: tint }} />
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: grad[0],
              borderWidth: 1,
              borderColor: `${tint}55`,
            }}
          >
            <FontAwesome5 name={icon} size={21} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="caption" style={{ color: tint, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 }}>
              {eyebrow}
            </T>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 18, marginTop: 2 }}>
              {title}
            </T>
            <T v="caption" style={{ color: d.subtext, fontSize: 11.5, marginTop: 2 }}>
              {desc}
            </T>
          </View>
          <FontAwesome5 name="chevron-right" size={14} color={d.faint} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
          {stats.map((s) => (
            <View key={s.l} style={{ flex: 1, alignItems: 'center' }}>
              <T v="stat" style={{ fontSize: 17, color: tint, fontWeight: '800' }}>
                {s.n}
              </T>
              <T v="caption" style={{ color: d.faint, fontSize: 10, marginTop: 1 }}>
                {s.l}
              </T>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ paddingHorizontal: 18, paddingTop: insets.top + 14, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: d.gold, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="book-open" size={17} color={d.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
                Qur'an & Hadith
              </T>
              <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
                Divine guidance, daily
              </T>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
          {/* Daily Ayah */}
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.22)',
              backgroundColor: isDark ? 'rgba(21,92,53,0.22)' : 'rgba(29,111,66,0.06)',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <FontAwesome5 name="quote-right" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 9.5, letterSpacing: 1.2 }}>
                DAILY AYAH
              </T>
              <View style={{ flex: 1 }} />
              <T v="caption" style={{ color: d.faint, fontSize: 9.5 }}>
                Ash-Sharh 94:6
              </T>
            </View>
            <T v="arabic" style={{ color: d.text, fontSize: 21, textAlign: 'right', lineHeight: 38, marginTop: 10 }}>
              فَإِنَّ مَعَ الْعُسْرِ يُسْرًا
            </T>
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, marginTop: 8, fontStyle: 'italic' }}>
              "For indeed, with hardship [will be] ease."
            </T>
          </View>

          {/* Daily Hadith */}
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(212,175,55,0.28)' : 'rgba(184,134,11,0.25)',
              backgroundColor: isDark ? 'rgba(140,109,31,0.14)' : 'rgba(184,134,11,0.05)',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <FontAwesome5 name="book-reader" size={10} color={isDark ? '#E8C96A' : '#B8860B'} />
              <T v="caption" style={{ color: isDark ? '#E8C96A' : '#B8860B', fontWeight: '800', fontSize: 9.5, letterSpacing: 1.2 }}>
                DAILY HADITH
              </T>
              <View style={{ flex: 1 }} />
              <T v="caption" style={{ color: d.faint, fontSize: 9.5 }}>
                Sahih al-Bukhari 1
              </T>
            </View>
            <T v="arabic" style={{ color: d.text, fontSize: 21, textAlign: 'right', lineHeight: 38, marginTop: 10 }}>
              إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ
            </T>
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, marginTop: 8, fontStyle: 'italic' }}>
              "Actions are only by intentions."
            </T>
          </View>

          <BigCard
            eyebrow="READ · LISTEN · REFLECT"
            title="The Holy Qur'an"
            desc="Read, listen and explore every surah"
            icon="quran"
            tint={isDark ? '#4AE38F' : '#1D6F42'}
            grad={(isDark ? ['rgba(21,92,53,0.9)', 'rgba(10,46,26,0.9)'] : ['rgba(29,111,66,0.92)', 'rgba(21,79,47,0.9)']) as [string, string, ...string[]]}
            stats={[
              { n: '114', l: 'Surahs' },
              { n: '6,236', l: 'Verses' },
              { n: '60', l: 'Hizb' },
            ]}
            onPress={() => router.push('/(tabs)/quran/surah')}
          />
          <BigCard
            eyebrow="AUTHENTIC COLLECTIONS"
            title="Hadith Collections"
            desc="Sahih Bukhari, Muslim and more"
            icon="book-reader"
            tint={isDark ? '#E8C96A' : '#B8860B'}
            grad={(isDark ? ['rgba(140,109,31,0.55)', 'rgba(74,58,14,0.55)'] : ['rgba(184,134,11,0.5)', 'rgba(120,88,16,0.45)']) as [string, string, ...string[]]}
            stats={[{ n: '14', l: 'Collections' }]}
            onPress={() => router.push('/tools/hadith')}
          />

          {/* shortcuts */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            {[
              { icon: 'bookmark', label: 'Bookmarks', href: '/tools/hadith' },
              { icon: 'graduation-cap', label: 'Courses', href: '/tools/courses' },
              { icon: 'quote-right', label: 'Quiz', href: '/tools/quiz' },
            ].map((s) => (
              <Pressable
                key={s.label}
                onPress={() => {
                  haptic.selection();
                  router.push(s.href as never);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  gap: 7,
                  backgroundColor: d.card,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  borderRadius: 14,
                  paddingVertical: 13,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <FontAwesome5 name={s.icon} size={15} color={d.emerald} />
                <T v="caption" style={{ color: d.subtext, fontSize: 10.5, fontWeight: '700' }}>
                  {s.label}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
