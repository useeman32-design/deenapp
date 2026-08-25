import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import type { Scholar } from '@/api/mocks';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

export default function Scholars() {
  const { theme } = useTheme();
  const [items, setItems] = useState<Scholar[]>([]);
  const [openAsk, setOpenAsk] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.scholars().then(setItems);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Ask a Scholar" subtitle="Get guided answers" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items.map((s) => (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={s.name} color={s.color} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{s.name}</Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
                  {s.mizhab} · {s.expertise}
                </Text>
              </View>
            </View>

            {sent[s.id] ? (
              <Text style={{ color: theme.primary, fontSize: 12.5, fontWeight: '600', marginTop: 12 }}>
                ✅ Question sent — the scholar will reply soon (demo).
              </Text>
            ) : openAsk === s.id ? (
              <View style={{ marginTop: 12 }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Write your question…"
                  placeholderTextColor={theme.subtext}
                  multiline
                  style={{
                    backgroundColor: theme.background,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    minHeight: 70,
                    color: theme.text,
                    fontSize: 14,
                    textAlignVertical: 'top',
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => {
                      setOpenAsk(null);
                      setDraft('');
                    }}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      padding: 11,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.subtext, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (draft.trim()) {
                        setSent((m) => ({ ...m, [s.id]: true }));
                        setOpenAsk(null);
                        setDraft('');
                      }
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: theme.primary,
                      borderRadius: 12,
                      padding: 11,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Send question</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setOpenAsk(s.id);
                  setDraft('');
                }}
                style={{
                  marginTop: 12,
                  backgroundColor: theme.primarySoft,
                  borderRadius: 12,
                  padding: 11,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>✍️ Ask a question</Text>
              </Pressable>
            )}
          </Card>
        ))}
        <Text style={{ color: theme.subtext, fontSize: 11.5, textAlign: 'center', marginTop: 4 }}>
          Demo — questions wire to your /scholars/ask endpoint when ready.
        </Text>
      </ScrollView>
    </View>
  );
}
