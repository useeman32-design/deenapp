import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { T } from '@/components/T';
import { Surface } from '@/components/Surface';
import { TopBar } from '@/components/TopBar';
import { CheckIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';

/**
 * Edit profile (pass 18) — mirrors the web profile edit modal
 * (web/profile/index.html): Full Name, Username, Bio, Aqeedah,
 * Phone Number, Email (read-only), Privacy: hide charity balance.
 * All inputs use fontSize 16 so iOS Safari never focus-zooms.
 */
export default function EditProfile() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState((user?.full_name as string) ?? '');
  const [username, setUsername] = useState((user?.username as string) ?? '');
  const [bio, setBio] = useState((user?.bio as string) ?? '');
  const [aqeedah, setAqeedah] = useState((user?.aqeedah as string) ?? '');
  const [phone, setPhone] = useState((user?.phone as string) ?? '');
  const [hideCharity, setHideCharity] = useState(Boolean(user?.hide_charity_balance));
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>((user?.profile_image_url as string) ?? '');
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    if (uploading) return;
    try {
      const ImagePicker = await import('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
      const asset = res.assets?.[0];
      if (!asset) return;
      haptic.selection();
      setUploading(true);
      const name = (asset.fileName ?? 'profile.jpg').slice(0, 40);
      const type = asset.mimeType ?? 'image/jpeg';
      const up = await api.uploadProfileImage(asset.uri, name, type);
      setUploading(false);
      if (up.ok && up.url) {
        setPhotoUrl(up.url);
        haptic.success();
        Alert.alert('Photo updated', 'Your profile photo was saved.');
      } else if (api.isLive()) {
        Alert.alert('Could not upload', up.message ?? 'Check your connection and try again.');
      } else {
        Alert.alert('Offline', 'Photo upload needs a connection to the DeenLink API.');
      }
    } catch {
      setUploading(false);
      Alert.alert('Could not open the photo picker');
    }
  };

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
      aqeedah: aqeedah.trim(),
      phone: phone.trim(),
      hide_charity_balance: hideCharity,
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
    fontSize: 16,
    color: theme.text,
  } as const;

  const label = { letterSpacing: 0.6, marginBottom: 6 } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Edit profile" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <Surface style={{ padding: 18, gap: 14 }}>
          {/* profile photo */}
          <View style={{ alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <Pressable onPress={pickPhoto} disabled={uploading} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} /> : <FontAwesome5 name="user" size={30} color={theme.subtext} />}
              {uploading ? <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View> : null}
            </Pressable>
            <Pressable onPress={pickPhoto} disabled={uploading} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <FontAwesome5 name="camera" size={11} color={theme.primary} />
              <T v="meta" style={{ color: theme.primary, fontWeight: '700' }}>{uploading ? 'Uploading…' : 'Change photo'}</T>
            </Pressable>
          </View>
          <View>
            <T v="meta" style={label}>FULL NAME</T>
            <TextInput value={fullName} onChangeText={setFullName} placeholder="Enter your full name" placeholderTextColor={theme.subtext} style={field} />
          </View>
          <View>
            <T v="meta" style={label}>USERNAME</T>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={theme.subtext}
              style={field}
            />
          </View>
          <View>
            <T v="meta" style={label}>BIO</T>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about yourself"
              placeholderTextColor={theme.subtext}
              multiline
              numberOfLines={4}
              style={{ ...field, minHeight: 90, textAlignVertical: 'top', fontFamily: 'Poppins' }}
            />
          </View>
          <View>
            <T v="meta" style={label}>AQEEDAH</T>
            <TextInput value={aqeedah} onChangeText={setAqeedah} placeholder="e.g. Sunni" placeholderTextColor={theme.subtext} style={field} />
          </View>
          <View>
            <T v="meta" style={label}>PHONE NUMBER</T>
            <TextInput value={phone} onChangeText={setPhone} placeholder="Enter your phone number" placeholderTextColor={theme.subtext} keyboardType="phone-pad" style={field} />
          </View>
          <View>
            <T v="meta" style={label}>EMAIL</T>
            <TextInput
              value={(user?.email as string) ?? ''}
              placeholder="Current email"
              editable={false}
              placeholderTextColor={theme.subtext}
              style={{ ...field, color: theme.subtext }}
            />
            <T v="meta" style={{ marginTop: 5 }}>Email can only be changed from the website (verify &amp; change).</T>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <T v="body">Hide charity balance</T>
              <T v="meta" style={{ marginTop: 2 }}>Privacy setting — others can't see your balance.</T>
            </View>
            <Switch
              value={hideCharity}
              onValueChange={setHideCharity}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
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
