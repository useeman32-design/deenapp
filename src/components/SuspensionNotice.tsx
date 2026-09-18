import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { suspensionReason, useBlockedAction } from '@/lib/blockNotice';
import { T } from '@/components/T';

const SUPPORT_MAIL = 'support@deenlink.org';

/**
 * pass 90 — what a suspended account sees.
 *
 * A suspended user keeps signing in and keeps reading (owner: "I should be able
 * to login but he cannot do any of these: posting, comment, like"), so the app
 * says so out loud: a strip on every screen while the suspension lasts, plus
 * the server's own refusal message each time a write is blocked. An open
 * suspension notice also jumps to the support mailbox, which is the one thing
 * the owner asked to keep available.
 */
export function SuspensionNotice() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const { notice, clear } = useBlockedAction();
  const suspended = String(user?.account_status || '').toLowerCase() === 'suspended';
  const reason = suspensionReason(user as never);
  const [dismissed, setDismissed] = useState(false);

  // A new suspension must be visible again even if the old strip was dismissed.
  useEffect(() => {
    if (!suspended) setDismissed(false);
  }, [suspended]);

  const showStrip = suspended && !dismissed;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {showStrip ? (
        <View pointerEvents="box-none" style={{ paddingTop: insets.top + 4, paddingHorizontal: 10 }}>
          <LinearGradient
            colors={['rgba(120,26,26,0.96)', 'rgba(74,16,16,0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,150,150,0.34)',
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              shadowColor: '#000',
              shadowOpacity: 0.28,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <FontAwesome5 name="shield-alt" size={13} color="#FFC9C9" />
            <View style={{ flex: 1 }}>
              <T v="caption" style={{ color: '#fff', fontWeight: '900', fontSize: 11.5, letterSpacing: 0.2 }}>
                Account suspended
              </T>
              <T v="caption" style={{ color: 'rgba(255,235,235,0.86)', fontSize: 10.5, marginTop: 2, lineHeight: 14 }}>
                You can browse DeenLink, but posting, commenting and liking are off.{' '}
                {reason ? `Reason: ${reason}. ` : ''}Contact support for more information.
              </T>
            </View>
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.open(`mailto:${SUPPORT_MAIL}`);
                } else {
                  void Linking.openURL(`mailto:${SUPPORT_MAIL}`).catch(() => router.push('/settings' as never));
                }
              }}
              hitSlop={8}
              style={{
                borderRadius: 9,
                paddingHorizontal: 9,
                paddingVertical: 6,
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.24)',
              }}
            >
              <T v="caption" style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>
                Support
              </T>
            </Pressable>
            <Pressable onPress={() => setDismissed(true)} hitSlop={10} style={{ paddingLeft: 2 }}>
              <T v="caption" style={{ color: 'rgba(255,220,220,0.75)', fontSize: 12 }}>
                ✕
              </T>
            </Pressable>
          </LinearGradient>
        </View>
      ) : null}

      {notice ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 74, alignItems: 'center', paddingHorizontal: 14 }}
        >
          <Pressable
            onPress={clear}
            style={{
              maxWidth: 520,
              width: '100%',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(212,175,55,0.5)',
              backgroundColor: 'rgba(24,17,4,0.94)',
              paddingHorizontal: 13,
              paddingVertical: 11,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              elevation: 8,
            }}
          >
            <FontAwesome5 name="exclamation-triangle" size={13} color="#E8C96A" />
            <T v="bodyS" style={{ flex: 1, color: '#F7EFDC', fontSize: 12, lineHeight: 17 }}>
              {notice.text}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10 }}>
              dismiss
            </T>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
