import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api/client';
import type { Video } from '@/api/types';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { ChevronRightIcon, PlayIcon } from '@/components/Icons';

export default function Videos() {
  const { theme } = useTheme();
  const [items, setItems] = useState<Video[]>([]);

  useEffect(() => {
    api.videos().then(setItems);
  }, []);

  const open = (url?: string | null) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Daily Videos" subtitle="Lectures & reminders" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => open(v.source_url)}
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
                backgroundColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlayIcon size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T v="bodyS" style={{ fontWeight: '700', lineHeight: 17 }}>
                {v.title ?? 'Video'}
              </T>
              <T v="caption" style={{ marginTop: 3 }}>
                {[v.duration, v.view_count ? `${v.view_count.toLocaleString()} views` : null].filter(Boolean).join(' · ') || 'DeenLink'}
              </T>
              {v.description ? <T v="caption" style={{ marginTop: 2, lineHeight: 15 }}>{v.description}</T> : null}
            </View>
            <ChevronRightIcon size={16} color={theme.subtext} />
          </Pressable>
        ))}
        <T v="caption" style={{ textAlign: 'center', marginTop: 6 }}>
          {api.isLive() ? 'From deenlink.org' : 'Offline — demo list. In-app playback ships in v1.1.'}
        </T>
      </ScrollView>
    </View>
  );
}
