import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ATHKAR } from '@/data/athkar';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { DhikrCounter } from '@/components/DhikrCounter';
import { TopBar } from '@/components/TopBar';

export default function AtharDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = ATHKAR.find((a) => a.id === id);
  const { theme } = useTheme();
  const [count, setCount] = useState(0);

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
      <View style={{ padding: 16 }}>
        <DhikrCounter
          arabic={item.arabic}
          label={item.transliteration}
          target={item.count}
          count={count}
          onIncrement={bump}
          onReset={reset}
          note={item.note}
        />
      </View>
    </View>
  );
}
