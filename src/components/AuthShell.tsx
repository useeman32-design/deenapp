import { ReactNode, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { DeenLogo } from '@/components/DeenLogo';
import { haptic } from '@/lib/haptics';

const bgDark = require('../../assets/img/auth-bg-dark.jpg');
const bgLight = require('../../assets/img/auth-bg-light.jpg');

/**
 * Shared shell for the login / register redesign (pass 12):
 * full-bleed brand background (user-supplied art) · DeenLink emblem +
 * wordmark · tagline. Children render inside a keyboard-aware scroll.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { isDark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#03180F' : '#F6F1E7' }}>
      <Image source={isDark ? bgDark : bgLight} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} resizeMode="cover" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 54, paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* brand */}
          <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
            <DeenLogo size={74} color={isDark ? '#4AE38F' : '#1D6F42'} accent={isDark ? '#D4AF37' : '#B8860B'} />
            <T v="h2" style={{ marginTop: 12, fontSize: 24, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C', letterSpacing: 0.2 }}>
              DeenLink
            </T>
            <T v="caption" style={{ marginTop: 3, fontSize: 11.5, color: isDark ? 'rgba(242,247,243,0.62)' : 'rgba(20,36,28,0.6)', letterSpacing: 0.3 }}>
              Strengthen Your Deen, Every Day
            </T>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Headline block: real DeenLink logo + slogan, then "Welcome back!" + line. */
export function AuthHeading({ title, sub }: { title: string; sub: string }) {
  const { isDark } = useTheme();
  return (
    <View style={{ marginTop: 30, marginBottom: 18 }}>
      {/* real DeenLink logo (from deenlink.org) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Image
          source={require('../../assets/img/logo-badge.png')}
          style={{ width: 58, height: 59 }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <T v="caption" style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: isDark ? '#D4AF37' : '#B8860B' }}>
            DEENLINK
          </T>
          <T v="caption" style={{ fontSize: 11.5, marginTop: 2, color: isDark ? 'rgba(242,247,243,0.65)' : 'rgba(20,36,28,0.65)' }}>
            All-in-one islamic app
          </T>
        </View>
      </View>
      <T v="h1" style={{ fontSize: 21, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>
        {title}
      </T>
      <T v="bodyS" style={{ marginTop: 4, fontSize: 12.5, color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(20,36,28,0.6)' }}>
        {sub}
      </T>
    </View>
  );
}

/**
 * Design-system input: rounded field with leading icon, small-caps label and
 * optional trailing eye toggle. 16px text — no iOS auto-zoom.
 */
export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure,
  autoCap,
  keyboard,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  icon: string;
  secure?: boolean;
  autoCap?: 'none' | 'sentences' | 'words';
  keyboard?: 'email-address' | 'default';
}) {
  const { isDark } = useTheme();
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const hidden = secure && !show;
  return (
    <View style={{ marginBottom: 13 }}>
      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)', marginBottom: 6 }}>
        {label.toUpperCase()}
      </T>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: focus ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(20,36,28,0.12)',
          backgroundColor: isDark ? 'rgba(2,59,42,0.85)' : 'rgba(255,255,255,0.92)',
          paddingHorizontal: 14,
          height: 50,
        }}
      >
        <FontAwesome5 name={icon} size={14} color={focus ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.4)'} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? 'rgba(242,247,243,0.32)' : 'rgba(20,36,28,0.32)'}
          secureTextEntry={hidden}
          autoCapitalize={autoCap ?? 'none'}
          autoCorrect={false}
          keyboardType={keyboard ?? 'default'}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            width: 0,
            fontFamily: 'Poppins-Medium',
            fontSize: 16,
            color: isDark ? '#F2F7F3' : '#14241C',
            paddingVertical: 0,
          }}
        />
        {secure ? (
          <Pressable onPress={() => { haptic.selection(); setShow((v) => !v); }} hitSlop={8} style={{ padding: 3 }}>
            <FontAwesome5 name={show ? 'eye' : 'eye-slash'} size={14} color={isDark ? 'rgba(242,247,243,0.45)' : 'rgba(20,36,28,0.45)'} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Primary emerald action (Sign In / Sign Up). */
export function AuthPrimaryButton({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.medium(); onPress(); }}
      disabled={busy}
      style={({ pressed }) => ({
        height: 52,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
        opacity: pressed ? 0.88 : busy ? 0.7 : 1,
        shadowColor: isDark ? '#1F8F5C' : '#1D6F42',
        shadowOpacity: 0.4,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      })}
    >
      <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
        {busy ? 'Just a moment…' : label}
      </T>
    </Pressable>
  );
}

/** The white "Sign in with Google" pill — demo sign-in while FORCE_DEMO is on. */
export function AuthGoogleButton({ onDemo }: { onDemo: () => void }) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.light(); onDemo(); }}
      style={({ pressed }) => ({
        height: 50,
        borderRadius: 25,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        backgroundColor: isDark ? '#F5F5F5' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(20,36,28,0.12)',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <FontAwesome5 name="google" size={15} color="#DB4437" brand />
      <T v="body" style={{ color: '#1F2937', fontWeight: '700', fontSize: 13.5 }}>
        Sign in with Google
      </T>
    </Pressable>
  );
}

/** Hairline · OR · hairline divider. */
export function AuthOrDivider() {
  const { isDark } = useTheme();
  const line = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.12)';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: line }} />
      <T v="caption" style={{ color: isDark ? 'rgba(242,247,243,0.45)' : 'rgba(20,36,28,0.45)', fontWeight: '700', fontSize: 10.5, letterSpacing: 1 }}>
        OR
      </T>
      <View style={{ flex: 1, height: 1, backgroundColor: line }} />
    </View>
  );
}

/** Bottom switch line: "Don't have an account? Sign Up". */
export function AuthSwitchLine({ text, actionLabel, onAction }: { text: string; actionLabel: string; onAction: () => void }) {
  const { isDark } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
      <T v="caption" style={{ color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)', fontSize: 12 }}>
        {text}
      </T>
      <Pressable
        onPress={() => { haptic.selection(); onAction(); }}
        hitSlop={8}
      >
        <T v="caption" style={{ color: isDark ? '#D4AF37' : '#B8860B', fontWeight: '800', fontSize: 12.5, marginLeft: 5 }}>
          {actionLabel}
        </T>
      </Pressable>
    </View>
  );
}
