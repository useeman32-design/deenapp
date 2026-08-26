import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { T } from '@/components/T';
import { Surface } from '@/components/Surface';
import { TopBar } from '@/components/TopBar';
import { CheckIcon } from '@/components/Icons';

export default function EditProfile() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState((user?.full_name as string) ?? '');
  const [username, setUsername] = useState((user?.username as string) ?? '');
  const [bio, setBio] = useState((user?.bio as string) ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (!fullName.trim() || !username.trim()) {
      Alert.alert('Missing fields', 'Name and username are required.');
      return;
    }
    setBusy(true);
    const res = await api.updateProfile({
      full_name: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
    });
    setBusy(false);
    if (res.ok) {
      Alert.alert('Saved', 'Your profile was updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } else if (api.isLive()) {
      Alert.alert('Could not save', res.message ?? 'Check your connection and try again.');
    } else {
      Alert.alert('Saved locally', 'You are offline — changes will sync when the API is reachable.');
      router.back();
    }
  };

  const field = {
    backgroundColor: theme.cardSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: theme.text,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Edit profile" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <Surface style={{ padding: 18, gap: 14 }}>
          <View>
            <T v="meta" style={{ letterSpacing: 0.6, marginBottom: 6 }}>FULL NAME</T>
            <TextInput value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor={theme.subtext} style={field} />
          </View>
          <View>
            <T v="meta" style={{ letterSpacing: 0.6, marginBottom: 6 }}>USERNAME</T>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={theme.subtext}
              style={field}
            />
          </View>
          <View>
            <T v="meta" style={{ letterSpacing: 0.6, marginBottom: 6 }}>BIO</T>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="A few words about you…"
              placeholderTextColor={theme.subtext}
              multiline
              numberOfLines={4}
              style={{ ...field, minHeight: 90, textAlignVertical: 'top', fontFamily: 'Poppins' }}
            />
          </View>

          <Pressable
            onPress={save}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: theme.primary,
              borderRadius: 13,
              padding: 14,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <CheckIcon size={16} color="#fff" />
            <T v="button" color="onPrimary">{busy ? 'Saving…' : 'Save changes'}</T>
          </Pressable>
        </Surface>
      </ScrollView>
    </View>
  );
}
