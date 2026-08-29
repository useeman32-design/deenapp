import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import * as api from '@/api/client';
import type { Scholar } from '@/api/types';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { Surface } from '@/components/Surface';
import { VerificationBadge } from '@/components/VerificationBadge';
import { TopBar } from '@/components/TopBar';
import { HelpIcon } from '@/components/Icons';

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function Scholars() {
  const { theme } = useTheme();
  const [items, setItems] = useState<Scholar[]>([]);
  const [openAsk, setOpenAsk] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api.scholars().then(setItems);
  }, []);

  const send = async (id: number) => {
    if (!draft.trim() && !title.trim()) return;
    await api.submitQuestion({ scholar_id: id, title: title.trim() || draft.slice(0, 60), details: draft.trim() });
    setSent((m) => ({ ...m, [id]: true }));
    setOpenAsk(null);
    setTitle('');
    setDraft('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Ask a Scholar" subtitle="Guided answers, verified scholars" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items.map((s) => (
          <Surface key={s.id} style={{ padding: 14, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: theme.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <T v="h3" color="primary" style={{ fontFamily: 'Poppins-Bold' }}>
                  {initialsOf(s.display_name ?? 'Scholar')}
                </T>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <T v="h3">{s.display_name ?? 'Scholar'}</T>
                  <VerificationBadge type="green" size={13} />
                </View>
                <T v="caption" style={{ marginTop: 2 }}>
                  {[s.madhhab, s.fields_of_knowledge].filter(Boolean).join(' · ') || 'Scholar'}
                </T>
              </View>
            </View>

            {sent[s.id] ? (
              <View style={{ marginTop: 12, backgroundColor: theme.accentSoft, borderRadius: 12, padding: 12 }}>
                <T v="caption" color="accent" style={{ fontWeight: '700' }}>
                  Question sent — the scholar will reply soon.
                </T>
              </View>
            ) : openAsk === s.id ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Subject (optional)"
                  placeholderTextColor={theme.subtext}
                  style={{
                    backgroundColor: theme.cardSoft,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontFamily: 'Poppins-Medium',
                    fontSize: 16 /*13.5*/,
                    color: theme.text,
                  }}
                />
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Write your question…"
                  placeholderTextColor={theme.subtext}
                  multiline
                  numberOfLines={4}
                  style={{
                    backgroundColor: theme.cardSoft,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                    paddingHorizontal: 12,
                    paddingTop: 10,
                    fontFamily: 'Poppins',
                    fontSize: 16 /*13.5*/,
                    color: theme.text,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setOpenAsk(null);
                      setTitle('');
                      setDraft('');
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderWidth: 1.2,
                      borderColor: theme.border,
                      borderRadius: 12,
                      padding: 11,
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <T v="button" color="subtext">Cancel</T>
                  </Pressable>
                  <Pressable
                    onPress={() => send(s.id)}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: theme.primary,
                      borderRadius: 12,
                      padding: 11,
                      alignItems: 'center',
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <T v="button" color="onPrimary">Send question</T>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setOpenAsk(s.id);
                  setTitle('');
                  setDraft('');
                }}
                style={({ pressed }) => ({
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  backgroundColor: theme.primarySoft,
                  borderRadius: 12,
                  padding: 11,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <HelpIcon size={14} color={theme.primary} />
                <T v="button" color="primary" style={{ fontSize: 13 }}>Ask a question</T>
              </Pressable>
            )}
          </Surface>
        ))}
        <T v="caption" style={{ textAlign: 'center', marginTop: 4 }}>
          {api.isLive() ? '' : 'Offline — showing demo scholars.'}
        </T>
      </ScrollView>
    </View>
  );
}
