import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { DhikrCounter } from '@/components/DhikrCounter';
import { TopBar } from '@/components/TopBar';

type Preset = { id: string; label: string; arabic: string; target: number };

const PRESETS: Preset[] = [
  { id: 'subhan', label: 'SubhanAllah (33)', arabic: 'سُبْحَانَ ٱللَّهِ', target: 33 },
  { id: 'hamd', label: 'Alhamdulillah (33)', arabic: 'ٱلْحَمْدُ لِلَّهِ', target: 33 },
  { id: 'akbar', label: 'Allahu Akbar (33)', arabic: 'ٱللَّهُ أَكْبَرُ', target: 33 },
  { id: 'astghfar', label: 'Astaghfirullah (100)', arabic: 'أَسْتَغْفِرُ ٱللَّهَ', target: 100 },
  { id: 'salawat', label: 'Salawat (11)', arabic: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', target: 11 },
  { id: 'unlimited', label: 'Unlimited', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّهُ', target: 0 },
];

export default function Tasbeeh() {
  const { theme } = useTheme();
  const [presetId, setPresetId] = useState('subhan');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    storage.getItem('dl.tasbeeh').then((raw) => {
      if (raw) {
        try {
          setCounts(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const count = counts[presetId] ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const bump = async () => {
    const next = count + 1;
    setCounts((c) => {
      const n = { ...c, [presetId]: next };
      storage.setItem('dl.tasbeeh', JSON.stringify(n));
      return n;
    });
    if (Platform.OS !== 'web') {
      if (preset.target > 0 && next === preset.target) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const reset = () =>
    setCounts((c) => {
      const n = { ...c, [presetId]: 0 };
      storage.setItem('dl.tasbeeh', JSON.stringify(n));
      return n;
    });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Digital Tasbeeh" subtitle={`${total} total counts · saved on this device`} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPresetId(p.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 18,
                backgroundColor: presetId === p.id ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: presetId === p.id ? theme.primary : theme.border,
              }}
            >
              <Text
                style={{
                  color: presetId === p.id ? '#fff' : theme.subtext,
                  fontWeight: '600',
                  fontSize: 12.5,
                }}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <DhikrCounter
          label={preset.label}
          arabic={preset.arabic}
          target={preset.target}
          count={count}
          onIncrement={bump}
          onReset={reset}
          note="Tip: the Prophet ﷺ encouraged counting dhikr with the fingers — use your hands when you can."
        />

        <Card style={{ marginTop: 24, backgroundColor: theme.primarySoft, borderColor: 'transparent' }}>
          <Text style={{ color: theme.text, fontSize: 13, lineHeight: 19 }}>
            <Text style={{ fontWeight: '800' }}>Full Tasbeeh:</Text> 33 SubhanAllah + 33 Alhamdulillah + 33
            Allahu Akbar after
            each prayer — 99 glorifications, then one Shahaada to complete 100. (Sahih al-Bukhari)
          </Text>
        </Card>
      </View>
    </View>
  );
}
