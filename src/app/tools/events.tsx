import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '@/api/client';
import type { EventItem } from '@/api/mocks';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

const KIND_ICON: Record<EventItem['kind'], string> = {
  Holiday: '🌙',
  Lecture: '🎙️',
  Community: '🤝',
  Study: '📚',
};

export default function Events() {
  const { theme } = useTheme();
  const [items, setItems] = useState<EventItem[]>([]);
  useEffect(() => {
    api.events().then(setItems);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar showBack title="Islamic Events" subtitle="Lectures, gatherings & holidays" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items.map((ev) => (
          <Card key={ev.id} style={{ marginBottom: 9, flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: ev.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 19 }}>{KIND_ICON[ev.kind]}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{ev.title}</Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 3 }}>
                🗓 {ev.date} · 📍 {ev.location}
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
