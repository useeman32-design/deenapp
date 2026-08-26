import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { storage } from '@/lib/storage';
import * as api from '@/api/client';
import { T } from '@/components/T';
import { Surface } from '@/components/Surface';
import { VerificationBadge } from '@/components/VerificationBadge';
import {
  BellIcon,
  ChevronRightIcon,
  FlameIcon,
  GiftIcon,
  InfoIcon,
  LogOutIcon,
  MoonStarIcon,
  PinIcon,
  RefreshIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
  type IconProps,
} from '@/components/Icons';

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function Profile() {
  const { theme, mode, setMode } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [checkin, setCheckin] = useState<'idle' | 'done' | 'already'>('idle');

  const name = (user?.full_name as string) || (user?.username as string) || 'Muslim';
  const badge = (user?.verification_badge as string) || '';
  const username = (user?.username as string) || '';
  const deenpoints = (user?.deenpoints_balance as number) ?? 0;

  const doCheckIn = async () => {
    const k = 'dl.checkin.date';
    const today = new Date().toISOString().slice(0, 10);
    const last = (await storage.getItem(k)) || '';
    if (last === today) {
      setCheckin('already');
      return;
    }
    await storage.setItem(k, today);
    // Best-effort sync with the backend; local count always works offline.
    await api.dailyCheckin().catch(() => {});
    setCheckin('done');
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Leave DeenLink? Your session on this device will end.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const resetProgress = () => {
    Alert.alert('Reset progress', 'Clears check-in history and quiz records on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await storage.removeItem('dl.checkin.date');
          await storage.removeItem('dl.quiz.best');
        },
      },
    ]);
  };

  const Row = ({
    icon: Icon,
    label,
    desc,
    danger,
    onPress,
  }: {
    icon: (p: IconProps) => React.ReactNode;
    label: string;
    desc?: string;
    danger?: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: danger ? theme.dangerSoft : theme.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color={danger ? theme.danger : theme.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <T v="bodyS" style={{ fontWeight: '700', color: danger ? theme.danger : theme.text }}>{label}</T>
        {desc ? <T v="caption" style={{ marginTop: 1 }}>{desc}</T> : null}
      </View>
      <ChevronRightIcon size={15} color={theme.subtext} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <Surface style={{ borderRadius: 22, padding: 18, alignItems: 'center' }}>
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: theme.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T v="display" color="primary" style={{ fontSize: 26, fontFamily: 'Poppins-Bold' }}>
              {initialsOf(name)}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <T v="h1" style={{ fontSize: 19 }}>{name}</T>
            {badge ? <VerificationBadge type={badge as 'blue' | 'green' | 'gold'} size={15} /> : null}
          </View>
          <T v="caption" style={{ marginTop: 2 }}>{username ? `@${username}` : 'Member'}</T>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, alignSelf: 'stretch' }}>
            <View style={{ flex: 1, backgroundColor: theme.cardSoft, borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <GiftIcon size={18} color={theme.accent} />
              <T v="h2" style={{ marginTop: 4 }}>{deenpoints.toLocaleString()}</T>
              <T v="caption" style={{ marginTop: 1 }}>DeenPoints</T>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.cardSoft, borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <FlameIcon size={18} color={theme.accent} />
              <T v="h2" style={{ marginTop: 4 }}>3</T>
              <T v="caption" style={{ marginTop: 1 }}>Day streak</T>
            </View>
          </View>

          <Pressable
            onPress={doCheckIn}
            style={({ pressed }) => ({
              marginTop: 12,
              alignSelf: 'stretch',
              backgroundColor: checkin === 'done' ? theme.accentSoft : theme.primary,
              borderRadius: 13,
              padding: 13,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <T v="button" color={checkin === 'done' ? 'accent' : 'onPrimary'}>
              {checkin === 'done'
                ? 'Checked in ✓  +1 point'
                : checkin === 'already'
                  ? 'Already checked in today'
                  : 'Daily check-in  ·  +1 DeenPoint'}
            </T>
          </Pressable>
        </Surface>

        {/* Account */}
        <T v="h3" style={{ marginTop: 22, marginBottom: 4 }}>Account</T>
        <Surface style={{ borderRadius: 18 }}>
          <Row icon={UserIcon} label="Edit profile" desc="Name, username & bio" onPress={() => router.push('/settings/edit-profile')} />
          <Row icon={PinIcon} label="Prayer location" desc="Where you pray" onPress={() => router.push('/tools/prayer')} />
        </Surface>

        {/* Preferences */}
        <T v="h3" style={{ marginTop: 18, marginBottom: 4 }}>Preferences</T>
        <Surface style={{ borderRadius: 18 }}>
          <Row
            icon={mode === 'dark' ? MoonStarIcon : SunIcon}
            label="Appearance"
            desc={mode === 'dark' ? 'Dark mode on' : 'Light mode on'}
            onPress={() => setMode((mode === 'dark' ? 'light' : 'dark') as ThemeMode)}
          />
          <Row icon={BellIcon} label="Notifications" desc="Adhan reminders" onPress={() => router.push('/tools/prayer')} />
          <Row icon={RefreshIcon} label="Reset progress" onPress={resetProgress} />
        </Surface>

        {/* Support */}
        <T v="h3" style={{ marginTop: 18, marginBottom: 4 }}>Support</T>
        <Surface style={{ borderRadius: 18 }}>
          <Row
            icon={ShieldIcon}
            label="Privacy"
            onPress={() => Alert.alert('Privacy', 'Your data stays on your device and your DeenLink account. We never sell it.')}
          />
          <Row
            icon={InfoIcon}
            label="Help & FAQ"
            onPress={() => Alert.alert('Help', 'Questions? Email support@deenlink.org — the community is here for you.')}
          />
          <Row
            icon={InfoIcon}
            label="About DeenLink"
            desc="Version 1.0"
            onPress={() => Alert.alert('DeenLink', 'Your deen, connected. v1.0')}
          />
        </Surface>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => ({
            marginTop: 20,
            borderRadius: 14,
            borderWidth: 1.2,
            borderColor: theme.danger,
            padding: 13,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LogOutIcon size={16} color={theme.danger} />
            <T v="button" color="danger">Sign out</T>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}
