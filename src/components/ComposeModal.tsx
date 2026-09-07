import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function ComposeModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (body: string) => void;
}) {
  const { theme } = useTheme();
  const [text, setText] = useState('');

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    onSubmit(body);
    setText('');
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800', marginBottom: 14 }}>
            Create New Post
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Share a reminder, ayah or thought…"
            placeholderTextColor={theme.subtext}
            multiline
            style={{
              backgroundColor: theme.background,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              minHeight: 100,
              color: theme.text,
              fontSize: 16 /*15*/,
              textAlignVertical: 'top',
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 14,
                padding: 13,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.subtext, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!text.trim()}
              style={{
                flex: 1,
                backgroundColor: theme.primary,
                borderRadius: 14,
                padding: 13,
                alignItems: 'center',
                opacity: text.trim() ? 1 : 0.5,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Post</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
