import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ATHKAR } from '@/data/athkar';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { DhikrCounter } from '@/components/DhikrCounter';
import { TopBar } from '@/components/TopBar';
import { ContentShareSheet } from '@/components/ContentShareSheet';
import { haptic } from '@/lib/haptics';

export default function AtharDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = ATHKAR.find((a) => a.id === id);
  const { theme } = useTheme();
  const [count, setCount] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    storage.getItem(`dl.athkar.${id}`).then((raw) => {
      if (raw) {
        try {
          setCount(Number(raw) || 0);
        } catch {
          // ignore
        }
      }
    });
  }, [id]);

  if (!item) return null;

  const bump = async () => {
    const next = count + 1;
    setCount(next);
    await storage.setItem(`dl.athkar.${id}`, String(next));
    if (Platform.OS !== 'web') {
      if (item.count > 0 && next === item.count) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const reset = async () => {
    setCount(0);
    await storage.setItem(`dl.athkar.${id}`, '0');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        showBack
        title={item.name}
        subtitle={`${item.group} · ${item.count === 0 ? 'unlimited' : `${item.count} counts`}`}
      />
      <View style={{ padding: 16, gap: 12 }}>
        <DhikrCounter
          arabic={item.arabic}
          label={item.transliteration}
          target={item.count}
          count={count}
          onIncrement={bump}
          onReset={reset}
          note={item.note}
        />
        <Pressable
          onPress={() => { haptic.selection(); setShareOpen(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}
        >
          <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>Share this dhikr</Text>
        </Pressable>
      </View>
      <ContentShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        card={{ kind: 'athkar', arabic: item.arabic, meaning: item.note ?? item.transliteration, ref: `Athkar · ${item.name}` }}
        link="https://deenlink.org/tools/athkar"
      />
    </View>
  );
}
