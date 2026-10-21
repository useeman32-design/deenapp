import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { Alert } from '@/lib/alert';
import {
  deleteAccount,
  previewAccountDeletion,
  type AccountDeletionPreview,
} from '@/api/client';

/**
 * DeleteAccountModal — pass 104.
 *
 * Google Play has required since 31 May 2024 that an app which lets people
 * create an account also lets them delete that account and their data from
 * inside the app. DeenLink had no such flow — Settings only offered "Sign out",
 * which is not deletion — so the app would have been rejected outright.
 *
 * Deliberate design choices:
 *  - The password is asked for FIRST and gates the preview too. Row counts are
 *    information about the account, so a hijacked session must not learn them.
 *  - The preview runs before the typed confirmation, so the user sees exactly
 *    what will go before committing. The numbers come from the server, which
 *    discovers the cascade at runtime, so they stay honest as the schema grows.
 *  - The final step requires typing DELETE, not a single tap. Play's reviewers
 *    look for a confirmation that cannot be triggered accidentally.
 *  - It states plainly what is NOT recoverable, rather than a vague warning.
 */
export function DeleteAccountModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const danger = '#E8726B';
  const field = {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.14)',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.03)',
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13.5,
    color: d.text as string,
  } as const;

  function reset() {
    setPassword('');
    setTyped('');
    setPreview(null);
    setError(null);
    setLoadingPreview(false);
    setDeleting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function runPreview() {
    if (!password.trim()) {
      setError('Enter your password first.');
      return;
    }
    setError(null);
    setLoadingPreview(true);
    const p = await previewAccountDeletion(password);
    setLoadingPreview(false);
    if (!p) {
      setError(
        'Could not check your account. Confirm your password is correct and try again.',
      );
      return;
    }
    haptic.selection();
    setPreview(p);
  }

  async function runDelete() {
    if (typed.trim().toUpperCase() !== 'DELETE') return;
    setError(null);
    setDeleting(true);
    const r = await deleteAccount(password, 'DELETE');
    setDeleting(false);
    if (!r.ok) {
      setError(r.message || 'Could not delete the account. Please try again.');
      return;
    }
    haptic.success();
    reset();
    onClose();
    Alert.alert(
      'Account deleted',
      'Your account and personal data have been removed from DeenLink. This cannot be undone.',
      [
        {
          text: 'Done',
          onPress: () => {
            try {
              router.dismissAll?.();
            } catch {}
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }

  const canDelete =
    preview !== null && password.trim() !== '' && typed.trim().toUpperCase() === 'DELETE';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={close} />
        <View
          style={{
            backgroundColor: d.card as string,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: d.cardBorder as string,
            maxHeight: '88%',
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 9 }}>
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 99,
                backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(20,36,28,0.16)',
              }}
            />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 4, paddingBottom: 30, gap: 14 }}
            showsVerticalScrollIndicator={false}
          >
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  backgroundColor: `${danger}1f`,
                  borderWidth: 1,
                  borderColor: `${danger}44`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FontAwesome5 name="trash-alt" size={14} color={danger} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="body" style={{ color: d.text, fontWeight: '900', fontSize: 15 }}>
                  Delete account
                </T>
                <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
                  Permanent — this cannot be undone
                </T>
              </View>
            </View>

            {/* what happens */}
            <View
              style={{
                borderRadius: 13,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(232,114,107,0.28)' : 'rgba(232,114,107,0.34)',
                backgroundColor: isDark ? 'rgba(232,114,107,0.08)' : 'rgba(232,114,107,0.06)',
                padding: 13,
                gap: 7,
              }}
            >
              <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>
                Deleting removes:
              </T>
              {[
                'Your profile — name, email, username, phone, date of birth, photo and bio',
                'Your posts, comments and replies',
                'Group posts, voice notes, chat messages and media you uploaded',
                'Bookmarks, follows, notifications, goals and learning progress',
                'Scholar documents, if you applied',
                'Your shop orders and DeenPoints history',
              ].map((line) => (
                <View key={line} style={{ flexDirection: 'row', gap: 7, alignItems: 'flex-start' }}>
                  <FontAwesome5
                    name="times"
                    size={9}
                    color={danger}
                    style={{ marginTop: 4, width: 10 }}
                  />
                  <T v="caption" style={{ flex: 1, fontSize: 11.5, color: d.subtext, lineHeight: 16 }}>
                    {line}
                  </T>
                </View>
              ))}
              <T v="caption" style={{ fontSize: 11, color: d.faint, lineHeight: 15, marginTop: 2 }}>
                Messages you sent to other people may remain visible to them, as on any messaging
                app. Your name is replaced with “Deleted User” wherever your content still appears.
              </T>
            </View>

            {/* step 1 — password */}
            <View style={{ gap: 7 }}>
              <T v="caption" style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: d.faint }}>
                STEP 1 · CONFIRM IT IS YOU
              </T>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setPreview(null);
                  setError(null);
                }}
                placeholder="Your password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={d.faint as string}
                style={field}
              />
              <Pressable
                onPress={() => {
                  haptic.light();
                  void runPreview();
                }}
                disabled={loadingPreview}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.16)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)',
                  paddingVertical: 11,
                  opacity: pressed || loadingPreview ? 0.65 : 1,
                })}
              >
                {loadingPreview ? (
                  <ActivityIndicator size="small" color={danger} />
                ) : (
                  <FontAwesome5 name="search" size={11} color={d.subtext as string} />
                )}
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>
                  {loadingPreview ? 'Checking…' : 'Show exactly what will be deleted'}
                </T>
              </Pressable>
            </View>

            {/* step 1 result */}
            {preview ? (
              <View
                style={{
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: d.cardBorder as string,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(20,36,28,0.03)',
                  padding: 13,
                  gap: 9,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { n: preview.rowsAffected, l: 'records' },
                    { n: preview.filesToRemove, l: 'uploaded files' },
                    { n: preview.tablesAffected, l: 'areas of the app' },
                  ].map((s) => (
                    <View
                      key={s.l}
                      style={{
                        flex: 1,
                        borderRadius: 11,
                        borderWidth: 1,
                        borderColor: d.cardBorder as string,
                        backgroundColor: d.card as string,
                        paddingVertical: 9,
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <T v="body" style={{ fontSize: 16, fontWeight: '900', color: danger }}>
                        {s.n}
                      </T>
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center' }}>
                        {s.l}
                      </T>
                    </View>
                  ))}
                </View>
                <T v="caption" style={{ fontSize: 11, color: d.subtext, lineHeight: 15 }}>
                  Counted from your live account just now. Nothing has been changed yet.
                </T>
              </View>
            ) : null}

            {/* step 2 — typed confirmation, only after the preview */}
            {preview ? (
              <View style={{ gap: 7 }}>
                <T v="caption" style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: d.faint }}>
                  STEP 2 · TYPE DELETE TO CONFIRM
                </T>
                <TextInput
                  value={typed}
                  onChangeText={(t) => {
                    setTyped(t);
                    setError(null);
                  }}
                  placeholder="DELETE"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholderTextColor={d.faint as string}
                  style={[
                    field,
                    typed.trim().toUpperCase() === 'DELETE'
                      ? { borderColor: danger, backgroundColor: `${danger}12` }
                      : null,
                  ]}
                />
              </View>
            ) : null}

            {error ? (
              <View style={{ flexDirection: 'row', gap: 7, alignItems: 'flex-start' }}>
                <FontAwesome5 name="exclamation-circle" size={11} color={danger} style={{ marginTop: 3 }} />
                <T v="caption" style={{ flex: 1, fontSize: 11.5, color: danger, lineHeight: 16 }}>
                  {error}
                </T>
              </View>
            ) : null}

            {/* final action */}
            <Pressable
              onPress={() => {
                haptic.medium();
                void runDelete();
              }}
              disabled={!canDelete || deleting}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 13,
                backgroundColor: danger,
                paddingVertical: 13,
                opacity: !canDelete || deleting ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome5 name="trash-alt" size={12} color="#fff" />
              )}
              <T v="bodyS" style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>
                {deleting ? 'Deleting your account…' : 'Permanently delete my account'}
              </T>
            </Pressable>

            <Pressable
              onPress={close}
              style={({ pressed }) => ({
                alignItems: 'center',
                paddingVertical: 9,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.subtext }}>
                Keep my account
              </T>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default DeleteAccountModal;
