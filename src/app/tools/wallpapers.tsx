import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '@/api/client';
import type { Wallpaper } from '@/api/mocks';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';

export default function Wallpapers() {
  const { theme } = useTheme();
  const [items, setItems] = useState<Wallpaper[]>([]);
  const [sel, setSel] = useState<Wallpaper | null>(null);

  useEffect(() => {
    api.wallpapers().then(setItems);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Islamic Wallpapers" subtitle="Dhikr art for your phone" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {items.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => setSel(w)}
              style={{
                width: '48%',
                aspectRatio: 9 / 13,
                borderRadius: 18,
                backgroundColor: w.from,
                justifyContent: 'center',
                alignItems: 'center',
                margin: 1,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 22, textAlign: 'center', padding: 10 }}>
                {w.arabic}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, marginTop: 6 }}>{w.caption}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: theme.subtext, fontSize: 11.5, textAlign: 'center', marginTop: 14 }}>
          Demo art — in production this lists your /wallpapers images (from deenlink.org/wallpapper).
        </Text>
      </ScrollView>

      <Modal transparent visible={!!sel} animationType="fade" onRequestClose={() => setSel(null)}>
        {sel ? (
          <Pressable
            onPress={() => setSel(null)}
            style={{ flex: 1, backgroundColor: sel.from, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: 'Amiri', color: '#fff', fontSize: 40, textAlign: 'center', padding: 24 }}>{sel.arabic}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 10 }}>{sel.caption}</Text>
            <View
              style={{
                marginTop: 44,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12.5 }}>Tap anywhere to close · save-to-gallery in v1.1</Text>
            </View>
          </Pressable>
        ) : null}
      </Modal>
    </View>
  );
}
