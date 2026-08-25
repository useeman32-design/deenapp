import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '@/api/client';
import type { Video } from '@/api/mocks';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';
import { ChevronRightIcon, PlayIcon } from '@/components/Icons';

export default function Videos() {
  const { theme } = useTheme();
  const [items, setItems] = useState<Video[]>([]);

  useEffect(() => {
    api.videos().then(setItems);
  }, []);

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Daily Videos" subtitle="Lectures & reminders" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => open(v.url)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 16,
                padding: 12,
                marginBottom: 9,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={{
                width: 92,
                height: 60,
                borderRadius: 12,
                backgroundColor: v.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlayIcon size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13.5 }}>{v.title}</Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 3 }}>
                {v.teacher} · {v.duration}
              </Text>
            </View>
            <ChevronRightIcon size={16} color={theme.subtext} />
          </Pressable>
        ))}
        <Text style={{ color: theme.subtext, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
          Demo list — connects to your /videos endpoint. In-app playback ships with react-native-video in v1.1.
        </Text>
      </ScrollView>
    </View>
  );
}
