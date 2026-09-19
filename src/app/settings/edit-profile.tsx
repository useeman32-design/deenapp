import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { T } from '@/components/T';
import { Surface } from '@/components/Surface';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { AvatarPicker, DefaultAvatar, type AvatarPick } from '@/components/AvatarPicker';
import { AqeedahPicker, isOtherOption, useAqeedahOptions } from '@/components/AqeedahPicker';
import { localAsset } from '@/lib/assetUri';

const SECURITY_QUESTIONS = [
  'What is the name of your first school?',
  "What is your mother's maiden name?",
  'What city were you born in?',
  'What is the name of your first pet?',
  'What is your favourite Surah?',
];

/** Tappable row that navigates to a dedicated edit screen. */
function NavRow({ icon, label, value, onPress }: { icon: keyof typeof FontAwesome5.glyphMap; label: string; value?: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={() => { haptic.selection(); onPress(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardSoft, marginBottom: 2 }}>
      <FontAwesome5 name={icon} size={14} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <T v="meta" style={{ letterSpacing: 0.5 }}>{label}</T>
        <T v="bodyS" style={{ fontSize: 14, color: theme.text, marginTop: 1 }} numberOfLines={1}>{value || '—'}</T>
      </View>
      <FontAwesome5 name="chevron-right" size={13} color={theme.subtext} />
    </Pressable>
  );
}

export default function EditProfile() {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [bio, setBio] = useState((user?.bio as string) ?? '');
  const [aqeedah, setAqeedah] = useState((user?.aqeedah as string) ?? '');
  const [aqeedahOther, setAqeedahOther] = useState('');
  const [phone, setPhone] = useState((user?.phone as string) ?? '');
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>((user?.profile_image_url as string) ?? '');
  const [useDefault, setUseDefault] = useState<boolean>(!(user?.profile_image_url));
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [avatarNote, setAvatarNote] = useState<string>('');
  /* pass 94 — the aqeedah list is the admin's, shared with registration */
  const { options: aqeedahList } = useAqeedahOptions();
  const [sq, setSq] = useState<[string, string]>([(user?.security_question as string) || '', (user?.security_question_2 as string) || '']);
  const [sqAnswers, setSqAnswers] = useState<[string, string]>(['', '']);
  const [sqOpen, setSqOpen] = useState<0 | 1 | null>(null);
  const [saved, setSaved] = useState(false);

  const gender = (user?.gender as string) ?? null;

  /* ── pass 94 — the avatar now actually saves, and it shows at once ────────
   * Three ways in, all ending with a URL on the account:
   *   default  → profile_image cleared
   *   library  → the owner's images, picked by SERVER PATH (no upload, instant,
   *              and the same picture on every device)
   *   gallery  → the file is uploaded (web: the DOM File itself)
   * The preview is set BEFORE the request finishes, so a slow network no longer
   * looks like "it did not save". */
  const applyAvatar = async (url: string, note: string) => {
    setAvatarNote('');
    if (!url) {
      setUseDefault(true);
      setPhotoUrl('');
      updateUser({ profile_image_url: '' });
      const res = await api.setProfileAvatar('default');
      if (!res.ok) setAvatarNote(res.message ?? 'Could not restore the default avatar.');
      else haptic.success();
      return;
    }
    setUseDefault(false);
    setPhotoUrl(url); /* immediate preview */
    updateUser({ profile_image_url: url });
    haptic.success();
    if (note) setAvatarNote(note);
  };

  const pickAvatar = async (pick: AvatarPick) => {
    if (pick.kind === 'default') return applyAvatar('', '');
    if (pick.kind === 'server') return applyAvatar(pick.url, '');
    /* library pick: the very same image is on the server, so this is a one-line
       request instead of an upload of the bundled file */
    setUploading(true);
    const res = await api.setProfileAvatar(pick.item.path);
    setUploading(false);
    if (res.ok && res.url) return applyAvatar(res.url, '');
    setAvatarNote(res.message ?? 'Could not save that avatar — try another.');
  };

  const uploadAvatarFile = async (file: File) => {
    setAvatarNote('');
    setUseDefault(false);
    const preview = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
    if (preview) setPhotoUrl(preview);
    setUploading(true);
    const up = await api.uploadProfileImageFile(file);
    setUploading(false);
    if (up.ok && up.url) return applyAvatar(up.url, '');
    setAvatarNote(up.message ?? 'Upload failed — try a smaller JPG or PNG.');
  };

  const pickFromGallery = async () => {
    setAvatarNote('');
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (f) void uploadAvatarFile(f);
      };
      input.click();
      return;
    }
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setAvatarNote('Allow photo access to choose a picture.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (res.canceled) return;
      const asset = res.assets && res.assets[0];
      if (!asset?.uri) return;
      setUseDefault(false);
      setPhotoUrl(asset.uri); /* preview straight from the device */
      setUploading(true);
      const up = await api.uploadProfileImage(asset.uri, asset.fileName || 'avatar.jpg', asset.mimeType || 'image/jpeg');
      setUploading(false);
      if (up.ok && up.url) return applyAvatar(up.url, '');
      setAvatarNote(up.message ?? 'Upload failed — try a smaller JPG or PNG.');
    } catch {
      setAvatarNote('Could not open the gallery on this device.');
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const res = await api.updateProfile({
      bio: bio.trim(),
      aqeedah: (isOtherOption(aqeedah) ? (aqeedahOther.trim() || aqeedah) : aqeedah).trim(),
      phone: phone.trim(),
      ...(sq[0] ? { security_question: sq[0] } : {}),
      ...(sq[0] && sqAnswers[0].trim() ? { security_answer: sqAnswers[0].trim() } : {}),
      ...(sq[1] ? { security_question_2: sq[1] } : {}),
      ...(sq[1] && sqAnswers[1].trim() ? { security_answer_2: sqAnswers[1].trim() } : {}),
    });
    setBusy(false);
    if (res.ok) {
      updateUser({ bio: bio.trim(), aqeedah: (isOtherOption(aqeedah) ? (aqeedahOther.trim() || aqeedah) : aqeedah).trim(), phone: phone.trim() });
      haptic.success();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  };

  const field = { backgroundColor: theme.cardSoft, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 12, fontFamily: 'Poppins-Medium', fontSize: 16, color: theme.text } as const;
  const label = { letterSpacing: 0.6, marginBottom: 6 } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Edit profile" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <Surface solid style={{ padding: 18, gap: 18 }}>
          {/* avatar */}
          <View style={{ alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <Pressable onPress={() => { haptic.selection(); setPickerOpen(true); }} style={{ width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
              {uploading ? (
                <ActivityIndicator color={theme.primary} />
              ) : !useDefault && photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <DefaultAvatar gender={gender} size={96} />
              )}
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Pressable onPress={() => { haptic.selection(); setPickerOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FontAwesome5 name="images" size={11} color={theme.primary} />
                <T v="meta" style={{ color: theme.primary, fontWeight: '700' }}>Choose avatar</T>
              </Pressable>
              <Pressable onPress={() => { haptic.selection(); void pickFromGallery(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FontAwesome5 name="upload" size={11} color={theme.primary} />
                <T v="meta" style={{ color: theme.primary, fontWeight: '700' }}>From gallery</T>
              </Pressable>
            </View>
            {avatarNote ? (
              <T v="caption" style={{ color: '#C0392B', textAlign: 'center', fontSize: 11 }}>{avatarNote}</T>
            ) : uploading ? (
              <T v="caption" style={{ color: theme.subtext, textAlign: 'center', fontSize: 11 }}>Saving your photo…</T>
            ) : null}
          </View>

          {/* name / username / email — dedicated screens */}
          <NavRow icon="user" label="FULL NAME" value={user?.full_name as string} onPress={() => router.push('/settings/edit-name')} />
          <NavRow icon="at" label="USERNAME" value={user?.username ? `@${user.username}` : ''} onPress={() => router.push('/settings/edit-username')} />
          <NavRow icon="envelope" label="EMAIL" value={user?.email as string} onPress={() => router.push('/settings/change-email')} />

          {/* aqeedah — the SAME list registration shows: name + explanation */}
          <View style={{ marginTop: 4 }}>
            <T v="meta" style={label}>AQEEDAH</T>
            <T v="meta" style={{ marginBottom: 10, textTransform: 'none', letterSpacing: 0, lineHeight: 16 }}>The same list you chose from when you registered. Edit it in Admin → Aqeedah &amp; Security and it changes here too.</T>
            <AqeedahPicker
              value={aqeedah}
              other={aqeedahOther}
              setValue={setAqeedah}
              setOther={setAqeedahOther}
              nigeria={String(user?.country ?? '').toLowerCase() === 'nigeria'}
              options={aqeedahList}
            />
          </View>

          {/* phone (optional) */}
          <View style={{ marginTop: 2 }}>
            <T v="meta" style={label}>PHONE NUMBER (OPTIONAL)</T>
            <TextInput value={phone} onChangeText={setPhone} placeholder="Add a phone number" placeholderTextColor={theme.subtext} keyboardType="phone-pad" style={field} />
          </View>

          {/* bio */}
          <View style={{ marginTop: 2 }}>
            <T v="meta" style={label}>BIO</T>
            <TextInput value={bio} onChangeText={setBio} placeholder="Tell others about yourself" placeholderTextColor={theme.subtext} multiline numberOfLines={4} style={{ ...field, minHeight: 90, textAlignVertical: 'top', fontFamily: 'Poppins' }} />
          </View>

          {/* security questions — two dropdowns, each with its answer field */}
          <View style={{ marginTop: 2 }}>
            <T v="meta" style={label}>SECURITY QUESTIONS</T>
            <T v="meta" style={{ marginBottom: 10, textTransform: 'none', letterSpacing: 0, lineHeight: 16 }}>Choose exactly two — used to recover your account if you lose access to your email.</T>
            {([0, 1] as const).map((idx) => (
              <View key={idx} style={{ marginBottom: 16 }}>
                <T v="meta" style={{ marginBottom: 5 }}>QUESTION {idx + 1}</T>
                <Pressable onPress={() => { haptic.selection(); setSqOpen(idx); }} style={{ ...field, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T v="bodyS" style={{ fontSize: 14, color: sq[idx] ? theme.text : theme.subtext, flex: 1 }} numberOfLines={1}>{sq[idx] || 'Select a question'}</T>
                  <FontAwesome5 name="chevron-down" size={12} color={theme.subtext} />
                </Pressable>
                {sq[idx] ? (
                  <TextInput
                    value={sqAnswers[idx]}
                    onChangeText={(t) => { const n: [string, string] = [...sqAnswers]; n[idx] = t; setSqAnswers(n); }}
                    placeholder="Your answer"
                    placeholderTextColor={theme.subtext}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ ...field, marginTop: 8 }}
                  />
                ) : null}
              </View>
            ))}
            <T v="meta" style={{ marginTop: 2 }}>{sq.filter(Boolean).length}/2 selected</T>
          </View>


          <Pressable onPress={save} disabled={busy} style={({ pressed }) => ({
            marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 13, padding: 14, opacity: pressed || busy ? 0.85 : 1 })}>
            <FontAwesome5 name={saved ? 'check' : 'save'} size={14} color="#fff" />
            <T v="button" color="onPrimary">{busy ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</T>
          </Pressable>
        </Surface>
      </ScrollView>

      <AvatarPicker
        visible={pickerOpen}
        gender={gender}
        selectedUrl={useDefault ? null : photoUrl || null}
        onClose={() => setPickerOpen(false)}
        onSelect={pickAvatar}
        onPickFromGallery={() => { void pickFromGallery(); }}
      />

      {/* security-question dropdown (excludes the one picked for the other slot) */}
      <Modal visible={sqOpen !== null} transparent animationType="fade" onRequestClose={() => setSqOpen(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.5)', justifyContent: 'center', padding: 28 }} onPress={() => setSqOpen(null)}>
          <View style={{ borderRadius: 16, backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border, padding: 8, maxHeight: '70%' }}>
            <ScrollView>
              {SECURITY_QUESTIONS.filter((q) => sqOpen !== null && (q === sq[sqOpen] || !sq.includes(q))).map((q) => {
                const on = sqOpen !== null && sq[sqOpen] === q;
                return (
                  <Pressable key={q} onPress={() => { if (sqOpen === null) return; const n: [string, string] = [...sq]; n[sqOpen] = q; setSq(n); setSqOpen(null); haptic.selection(); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 }}>
                    <T v="bodyS" style={{ fontSize: 14, color: theme.text, flex: 1 }}>{q}</T>
                    {on ? <FontAwesome5 name="check" size={13} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
