import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
const deenPointsLogo = require('../../../assets/img/deenpoints.png');
import { Alert, Image } from 'react-native';

/**
 * Settings screen (pass 17) — opened from the profile's Settings tab.
 * Root stack route (no tab bar).
 */
export default function SettingsScreen() {
  const { theme, mode, setMode, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const deenpoints = (user?.deenpoints_balance as number) ?? 0;

  const Row = ({ icon, label, desc, tint, onPress, image }: { icon: string; label: string; desc: string; tint: string; onPress: () => void; image?: number }) => (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${tint}18`, borderWidth: 1, borderColor: `${tint}44`, alignItems: 'center', justifyContent: 'center' }}>
        {image ? <Image source={image} style={{ width: 20, height: 20 }} resizeMode="contain" /> : <FontAwesome5 name={icon as never} size={13} color={tint} />}
      </View>
      <View style={{ flex: 1 }}>
        <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13 }}>
          {label}
        </T>
        <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
          {desc}
        </T>
      </View>
      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              Settings
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              Account, appearance & more
            </T>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
        {/* account summary */}
        <View style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 18, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isDark ? 'rgba(46,204,113,0.16)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="user" size={16} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="body" style={{ color: d.text, fontWeight: '800', fontSize: 13.5 }}>
              {(user?.full_name as string) || 'DeenLink User'}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
              @{(user?.username as string) || 'deenlink_user'}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 }}>
            <Image source={deenPointsLogo} style={{ width: 13, height: 13 }} resizeMode="contain" />
            <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 11 }}>
              {deenpoints.toLocaleString()}
            </T>
          </View>
        </View>

        {/* settings list */}
        <View style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 18, overflow: 'hidden' }}>
          <Row icon="moon" label="Appearance" desc={mode === 'dark' ? 'Dark mode on' : 'Light mode on'} tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={() => setMode((mode === 'dark' ? 'light' : 'dark') as ThemeMode)} />
          <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />
          <Row icon="user-edit" label="Edit Profile" desc="Name, bio, aqeedah & photo" tint="#5BC8F5" onPress={() => router.push('/settings/edit-profile')} />
          <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />
          <Row icon="gift" image={deenPointsLogo} label="DeenPoints" desc="How to earn & spend your points" tint={d.gold} onPress={() => Alert.alert('DeenPoints', 'Earn daily via check-ins, posts, and learning activities.')} />
          <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />
          <Row icon="bell" label="Notifications" desc="Prayer times & community alerts" tint="#E8C96A" onPress={() => Alert.alert('Notifications', 'Prayer reminders are managed in the Prayer Times tool.')} />
          <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />
          <Row icon="share-alt" label="Share DeenLink" desc="Invite friends to the community" tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={() => Alert.alert('Share', 'DeenLink — your deen, connected.')} />
          <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />
          <Row icon="shield-alt" label="Privacy & Safety" desc="Blocked accounts & content preferences" tint="#FF7B7B" onPress={() => Alert.alert('Privacy & Safety', 'Your content preferences live here soon.')} />
          <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />
          <Row icon="info-circle" label="About DeenLink" desc="Version & credits" tint={d.subtext as string} onPress={() => Alert.alert('DeenLink', 'Strengthen your deen, every day.')} />
          <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />
          <Row icon="sign-out-alt" label="Sign out" desc="End session on this device" tint="#FF7B7B" onPress={() =>
            Alert.alert('Sign out', 'Leave DeenLink? Your session on this device will end.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: logout },
            ])
          } />
        </View>

        <T v="caption" style={{ color: d.faint, textAlign: 'center', fontSize: 10, marginTop: 16 }}>
          DeenLink v1.0 · made with ihsan
        </T>
      </ScrollView>
    </View>
  );
}
