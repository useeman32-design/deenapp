import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAllAthkar } from '@/lib/liveAthkar';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { DhikrCounter } from '@/components/DhikrCounter';
import { TopBar } from '@/components/TopBar';
import { ContentShareSheet } from '@/components/ContentShareSheet';
import { GlassPlayerBar } from '@/components/GlassPlayerBar';
import { haptic } from '@/lib/haptics';

export default function AtharDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useAllAthkar();
  const item = list.find((a) => a.id === id);
  const { theme } = useTheme();
  const [count, setCount] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  /* pass 22: guided session — same glass player design; play auto-counts */
  const [session, setSession] = useState(false);

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

  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      const meta = list.find((a) => a.id === id);
      setCount((c) => {
        const next = c + 1;
        void storage.setItem(`dl.athkar.${id}`, String(next));
        if (meta && meta.count > 0 && next >= meta.count) {
          setSession(false);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        return next;
      });
    }, 1600);
    return () => clearInterval(iv);
  }, [session, id]);

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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
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
      </ScrollView>
      {(session || count > 0) ? (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 18 }}>
          <GlassPlayerBar
            compact
            player={null}
            playing={session}
            title={item.transliteration}
            arabic={''}
            subtitle={item.count > 0 ? `${Math.min(count, item.count)} / ${item.count} · ${item.group}` : `${count} · ${item.group}`}
            onToggle={() => {
              haptic.selection();
              setSession((v) => !v);
            }}
            frac={item.count > 0 ? Math.min(1, count / item.count) : 0}
            right={
              <Pressable onPress={reset} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="undo" size={11} color={theme.subtext} />
              </Pressable>
            }
          />
        </View>
      ) : null}

      <ContentShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        card={{ kind: 'athkar', arabic: item.arabic, meaning: item.note ?? item.transliteration, ref: `Athkar · ${item.name}` }}
        link="https://deenlink.org/tools/athkar"
      />
    </View>
  );
}
