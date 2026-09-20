import { useEffect, useMemo, useRef, useState } from 'react';
import { goBack } from '@/lib/navigation';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { AuthShell, AuthHeading, AuthField, AuthPrimaryButton, AuthGoogleButton, AuthOrDivider, AuthSwitchLine } from '@/components/AuthShell';
import { OtpVerify } from '@/components/OtpVerify';
import { checkUsernameAvailable, checkEmailAvailable, registerScholar, restoreSession, scholarApply,} from '@/api/client';
import { AqeedahPicker, isOtherOption, useAqeedahOptions } from '@/components/AqeedahPicker';

/**
 * pass 41 — FULL signup rebuild.
 *  · CHOOSE screen — user account vs scholar account (+ Google / Gmail path)
 *  · USER form — name, email, username with LIVE availability, gender, country
 *    (Nigeria → tribe chips Hausa/Igbo/Yoruba/General), aqeedah with short
 *    descriptions (Sunni/Sufi/Shia/Athari/Other ≤10 chars), password + confirm
 *    with a live checkmark requirement list
 *  · SCHOLAR form — 3 steps: basic → qualifications → verification (uploads,
 *    proof of qualification OR a recommendation letter, terms + privacy agreement)
 *  · GMAIL — skips name/email/password → "Complete your info" screen
 */

/* ── static option data ─────────────────────────────────────────────────── */

const COUNTRIES: Array<{ name: string; flag: string }> = [
  { name: 'Nigeria', flag: '🇳🇬' },
  { name: 'Afghanistan', flag: '🇦🇫' }, { name: 'Albania', flag: '🇦🇱' }, { name: 'Algeria', flag: '🇩🇿' }, { name: 'Andorra', flag: '🇦🇩' }, { name: 'Angola', flag: '🇦🇴' }, { name: 'Antigua and Barbuda', flag: '🇦🇬' }, { name: 'Argentina', flag: '🇦🇷' }, { name: 'Armenia', flag: '🇦🇲' }, { name: 'Australia', flag: '🇦🇺' }, { name: 'Austria', flag: '🇦🇹' }, { name: 'Azerbaijan', flag: '🇦🇿' },
  { name: 'Bahamas', flag: '🇧🇸' }, { name: 'Bahrain', flag: '🇧🇭' }, { name: 'Bangladesh', flag: '🇧🇩' }, { name: 'Barbados', flag: '🇧🇧' }, { name: 'Belarus', flag: '🇧🇾' }, { name: 'Belgium', flag: '🇧🇪' }, { name: 'Belize', flag: '🇧🇿' }, { name: 'Benin', flag: '🇧🇯' }, { name: 'Bhutan', flag: '🇧🇹' }, { name: 'Bolivia', flag: '🇧🇴' }, { name: 'Bosnia and Herzegovina', flag: '🇧🇦' }, { name: 'Botswana', flag: '🇧🇼' }, { name: 'Brazil', flag: '🇧🇷' }, { name: 'Brunei', flag: '🇧🇳' }, { name: 'Bulgaria', flag: '🇧🇬' }, { name: 'Burkina Faso', flag: '🇧🇫' }, { name: 'Burundi', flag: '🇧🇮' },
  { name: 'Cabo Verde', flag: '🇨🇻' }, { name: 'Cambodia', flag: '🇰🇭' }, { name: 'Cameroon', flag: '🇨🇲' }, { name: 'Canada', flag: '🇨🇦' }, { name: 'Central African Republic', flag: '🇨🇫' }, { name: 'Chad', flag: '🇹🇩' }, { name: 'Chile', flag: '🇨🇱' }, { name: 'China', flag: '🇨🇳' }, { name: 'Colombia', flag: '🇨🇴' }, { name: 'Comoros', flag: '🇰🇲' }, { name: 'Congo (DRC)', flag: '🇨🇩' }, { name: 'Congo (Republic)', flag: '🇨🇬' }, { name: 'Costa Rica', flag: '🇨🇷' }, { name: "Côte d'Ivoire", flag: '🇨🇮' }, { name: 'Croatia', flag: '🇭🇷' }, { name: 'Cuba', flag: '🇨🇺' }, { name: 'Cyprus', flag: '🇨🇾' }, { name: 'Czechia', flag: '🇨🇿' },
  { name: 'Denmark', flag: '🇩🇰' }, { name: 'Djibouti', flag: '🇩🇯' }, { name: 'Dominica', flag: '🇩🇲' }, { name: 'Dominican Republic', flag: '🇩🇴' },
  { name: 'Ecuador', flag: '🇪🇨' }, { name: 'Egypt', flag: '🇪🇬' }, { name: 'El Salvador', flag: '🇸🇻' }, { name: 'Equatorial Guinea', flag: '🇬🇶' }, { name: 'Eritrea', flag: '🇪🇷' }, { name: 'Estonia', flag: '🇪🇪' }, { name: 'Eswatini', flag: '🇸🇿' }, { name: 'Ethiopia', flag: '🇪🇹' },
  { name: 'Fiji', flag: '🇫🇯' }, { name: 'Finland', flag: '🇫🇮' }, { name: 'France', flag: '🇫🇷' },
  { name: 'Gabon', flag: '🇬🇦' }, { name: 'Gambia', flag: '🇬🇲' }, { name: 'Georgia', flag: '🇬🇪' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'Ghana', flag: '🇬🇭' }, { name: 'Greece', flag: '🇬🇷' }, { name: 'Grenada', flag: '🇬🇩' }, { name: 'Guatemala', flag: '🇬🇹' }, { name: 'Guinea', flag: '🇬🇳' }, { name: 'Guinea-Bissau', flag: '🇬🇼' }, { name: 'Guyana', flag: '🇬🇾' },
  { name: 'Haiti', flag: '🇭🇹' }, { name: 'Honduras', flag: '🇭🇳' }, { name: 'Hungary', flag: '🇭🇺' },
  { name: 'Iceland', flag: '🇮🇸' }, { name: 'India', flag: '🇮🇳' }, { name: 'Indonesia', flag: '🇮🇩' }, { name: 'Iran', flag: '🇮🇷' }, { name: 'Iraq', flag: '🇮🇶' }, { name: 'Ireland', flag: '🇮🇪' }, { name: 'Israel', flag: '🇮🇱' }, { name: 'Italy', flag: '🇮🇹' },
  { name: 'Jamaica', flag: '🇯🇲' }, { name: 'Japan', flag: '🇯🇵' }, { name: 'Jordan', flag: '🇯🇴' },
  { name: 'Kazakhstan', flag: '🇰🇿' }, { name: 'Kenya', flag: '🇰🇪' }, { name: 'Kiribati', flag: '🇰🇮' }, { name: 'Kuwait', flag: '🇰🇼' }, { name: 'Kyrgyzstan', flag: '🇰🇬' },
  { name: 'Laos', flag: '🇱🇦' }, { name: 'Latvia', flag: '🇱🇻' }, { name: 'Lebanon', flag: '🇱🇧' }, { name: 'Lesotho', flag: '🇱🇸' }, { name: 'Liberia', flag: '🇱🇷' }, { name: 'Libya', flag: '🇱🇾' }, { name: 'Liechtenstein', flag: '🇱🇮' }, { name: 'Lithuania', flag: '🇱🇹' }, { name: 'Luxembourg', flag: '🇱🇺' },
  { name: 'Madagascar', flag: '🇲🇬' }, { name: 'Malawi', flag: '🇲🇼' }, { name: 'Malaysia', flag: '🇲🇾' }, { name: 'Maldives', flag: '🇲🇻' }, { name: 'Mali', flag: '🇲🇱' }, { name: 'Malta', flag: '🇲🇹' }, { name: 'Marshall Islands', flag: '🇲🇭' }, { name: 'Mauritania', flag: '🇲🇷' }, { name: 'Mauritius', flag: '🇲🇺' }, { name: 'Mexico', flag: '🇲🇽' }, { name: 'Micronesia', flag: '🇫🇲' }, { name: 'Moldova', flag: '🇲🇩' }, { name: 'Monaco', flag: '🇲🇨' }, { name: 'Mongolia', flag: '🇲🇳' }, { name: 'Montenegro', flag: '🇲🇪' }, { name: 'Morocco', flag: '🇲🇦' }, { name: 'Mozambique', flag: '🇲🇿' }, { name: 'Myanmar', flag: '🇲🇲' },
  { name: 'Namibia', flag: '🇳🇦' }, { name: 'Nauru', flag: '🇳🇷' }, { name: 'Nepal', flag: '🇳🇵' }, { name: 'Netherlands', flag: '🇳🇱' }, { name: 'New Zealand', flag: '🇳🇿' }, { name: 'Nicaragua', flag: '🇳🇮' }, { name: 'Niger', flag: '🇳🇪' }, { name: 'North Korea', flag: '🇰🇵' }, { name: 'North Macedonia', flag: '🇲🇰' }, { name: 'Norway', flag: '🇳🇴' },
  { name: 'Oman', flag: '🇴🇲' },
  { name: 'Pakistan', flag: '🇵🇰' }, { name: 'Palau', flag: '🇵🇼' }, { name: 'Palestine', flag: '🇵🇸' }, { name: 'Panama', flag: '🇵🇦' }, { name: 'Papua New Guinea', flag: '🇵🇬' }, { name: 'Paraguay', flag: '🇵🇾' }, { name: 'Peru', flag: '🇵🇪' }, { name: 'Philippines', flag: '🇵🇭' }, { name: 'Poland', flag: '🇵🇱' }, { name: 'Portugal', flag: '🇵🇹' },
  { name: 'Qatar', flag: '🇶🇦' },
  { name: 'Romania', flag: '🇷🇴' }, { name: 'Russia', flag: '🇷🇺' }, { name: 'Rwanda', flag: '🇷🇼' },
  { name: 'Saint Kitts and Nevis', flag: '🇰🇳' }, { name: 'Saint Lucia', flag: '🇱🇨' }, { name: 'Saint Vincent', flag: '🇻🇨' }, { name: 'Samoa', flag: '🇼🇸' }, { name: 'San Marino', flag: '🇸🇲' }, { name: 'São Tomé and Príncipe', flag: '🇸🇹' }, { name: 'Saudi Arabia', flag: '🇸🇦' }, { name: 'Senegal', flag: '🇸🇳' }, { name: 'Serbia', flag: '🇷🇸' }, { name: 'Seychelles', flag: '🇸🇨' }, { name: 'Sierra Leone', flag: '🇸🇱' }, { name: 'Singapore', flag: '🇸🇬' }, { name: 'Slovakia', flag: '🇸🇰' }, { name: 'Slovenia', flag: '🇸🇮' }, { name: 'Solomon Islands', flag: '🇸🇧' }, { name: 'Somalia', flag: '🇸🇴' }, { name: 'South Africa', flag: '🇿🇦' }, { name: 'South Korea', flag: '🇰🇷' }, { name: 'South Sudan', flag: '🇸🇸' }, { name: 'Spain', flag: '🇪🇸' }, { name: 'Sri Lanka', flag: '🇱🇰' }, { name: 'Sudan', flag: '🇸🇩' }, { name: 'Suriname', flag: '🇸🇷' }, { name: 'Sweden', flag: '🇸🇪' }, { name: 'Switzerland', flag: '🇨🇭' }, { name: 'Syria', flag: '🇸🇾' },
  { name: 'Tajikistan', flag: '🇹🇯' }, { name: 'Tanzania', flag: '🇹🇿' }, { name: 'Thailand', flag: '🇹🇭' }, { name: 'Timor-Leste', flag: '🇹🇱' }, { name: 'Togo', flag: '🇹🇬' }, { name: 'Tonga', flag: '🇹🇴' }, { name: 'Trinidad and Tobago', flag: '🇹🇹' }, { name: 'Tunisia', flag: '🇹🇳' }, { name: 'Türkiye', flag: '🇹🇷' }, { name: 'Turkmenistan', flag: '🇹🇲' }, { name: 'Tuvalu', flag: '🇹🇻' },
  { name: 'Uganda', flag: '🇺🇬' }, { name: 'Ukraine', flag: '🇺🇦' }, { name: 'United Arab Emirates', flag: '🇦🇪' }, { name: 'United Kingdom', flag: '🇬🇧' }, { name: 'United States', flag: '🇺🇸' }, { name: 'Uruguay', flag: '🇺🇾' }, { name: 'Uzbekistan', flag: '🇺🇿' },
  { name: 'Vanuatu', flag: '🇻🇺' }, { name: 'Vatican City', flag: '🇻🇦' }, { name: 'Venezuela', flag: '🇻🇪' }, { name: 'Vietnam', flag: '🇻🇳' },
  { name: 'Yemen', flag: '🇾🇪' },
  { name: 'Zambia', flag: '🇿🇲' }, { name: 'Zimbabwe', flag: '🇿🇼' },
  { name: 'Other', flag: '🌍' },
];
const TRIBES = ['Hausa', 'Igbo', 'Yoruba', 'General'];
const GENDERS = ['Male', 'Female'];

const KNOWLEDGE_FIELDS = ['Tawhid', 'Fiqh', 'Aqeedah', 'Tafsir', 'Quran', 'Seerah', 'Hadith'];
const MADHHABS = ['Hanafi', 'Maliki', 'Shafi\u2019i', 'Hanbali', 'Other'];
/* pass 92 — owner: "at final stage am getting years of study must be between 1
 * and 80". The chips carried RANGE LABELS, and submitScholar sent
 * Number('1–3') → NaN → "NaN" → (int) on the server → 0 → that exact error, so
 * no scholar account could ever be created from the app. Each chip now carries
 * a numeric value (the floor of its range, never an overstatement) plus the
 * label it displays. */
const YEARS: Array<{ label: string; n: number }> = [
  { label: '1–3', n: 1 },
  { label: '4–7', n: 4 },
  { label: '8–15', n: 8 },
  { label: '16–25', n: 16 },
  { label: '25+', n: 25 },
];
const usernameValid = (u: string) => /^[a-z0-9._]{3,20}$/i.test(u);

/** pass 93 — a picked document: the web File (when there is one) or a native
 *  uri, plus the name and mime the picker reported. */
export type ProofDoc = { name: string; uri?: string; file?: unknown; mimeType?: string };

/** The symbol set the server accepts (api/lib/password_policy.php). */
export const DL_PW_SPECIAL =
  /[-!@#$%^&*()_+=|{}[\]:;"'<>,.?/~`\\]/;

/** Every rule from the checklist satisfied (used by both sign-up paths). */
export const dlPasswordOk = (pw: string) =>
  pw.length >= 8 &&
  /[A-Z]/.test(pw) &&
  /[a-z]/.test(pw) &&
  /[0-9]/.test(pw) &&
  DL_PW_SPECIAL.test(pw);

/* ── small shared pieces ────────────────────────────────────────────────── */

function Label({ children }: { children: string }) {
  const { isDark } = useTheme();
  return (
    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)', marginBottom: 6 }}>
      {children.toUpperCase()}
    </T>
  );
}

function Chip({ on, label, onPress, tint }: { on: boolean; label: string; onPress: () => void; tint?: string }) {
  const { isDark } = useTheme();
  const c = tint ?? (isDark ? '#4AE38F' : '#1D6F42');
  return (
    <Pressable
      onPress={() => { haptic.selection(); onPress(); }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1.5,
        borderColor: on ? c : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)',
        backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.15)' : 'rgba(29,111,66,0.09)') : isDark ? 'rgba(2,59,42,0.6)' : 'rgba(255,255,255,0.85)',
        paddingHorizontal: 13, paddingVertical: 7,
      }}
    >
      {on ? <FontAwesome5 name="check" size={9} color={c} /> : null}
      <T v="caption" style={{ color: on ? c : isDark ? 'rgba(242,247,243,0.75)' : 'rgba(20,36,28,0.75)', fontWeight: '700', fontSize: 11.5 }}>{label}</T>
    </Pressable>
  );
}

/** username + LIVE availability indicator */
function UsernameField({ value, onChange, state }: { value: string; onChange: (v: string) => void; state: 'idle' | 'checking' | 'ok' | 'taken' }) {
  const { isDark } = useTheme();
  return (
    <View style={{ marginBottom: 13 }}>
      <Label>Username</Label>
      <AuthField label="" value={value} onChangeText={(v) => onChange(v.replace(/[^A-Za-z0-9._]/g, '').toLowerCase())} placeholder="e.g. aminu.abubakar" icon="at" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6, minHeight: 16 }}>
        {state === 'checking' ? (
          <>
            <ActivityIndicator size="small" color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)'} />
            <T v="caption" style={{ fontSize: 10, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)' }}>Checking availability…</T>
          </>
        ) : state === 'ok' ? (
          <>
            <FontAwesome5 name="check-circle" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#4AE38F' : '#1D6F42' }}>Available</T>
          </>
        ) : state === 'taken' ? (
          <>
            <FontAwesome5 name="times-circle" size={11} color="#FF7B7B" />
            <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: '#FF7B7B' }}>Not available — try another</T>
          </>
        ) : (
          <T v="caption" style={{ fontSize: 10, color: isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.4)' }}>3–20 characters · letters, numbers, . _</T>
        )}
      </View>
    </View>
  );
}

/** password + live checkmark requirement list */
function PasswordBlock({ password, setPassword, confirm, setConfirm, showConfirm = true }: { password: string; setPassword: (v: string) => void; confirm: string; setConfirm: (v: string) => void; showConfirm?: boolean }) {
  const { isDark } = useTheme();
  /* pass 90 — owner: "we don't have special characters check in the check of
   * password". The list existed but asked for 6 characters and any letter,
   * while the API (api/lib/password_policy.php) requires 8, an uppercase
   * letter, a lowercase letter, a number AND a real symbol — so a password
   * that looked valid was rejected by the server with a message the checklist
   * never mentioned. The list below is the same five rules the server checks. */
  const reqs = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One uppercase letter (A–Z)', ok: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a–z)', ok: /[a-z]/.test(password) },
    { label: 'One number (0–9)', ok: /[0-9]/.test(password) },
    { label: 'One special character (!@#$…)', ok: DL_PW_SPECIAL.test(password) },
  ];
  return (
    <View>
      <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="8+ chars · Aa · 0 · !" icon="lock" secure />
      {showConfirm ? <AuthField label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Re-enter your password" icon="lock" secure /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13, marginTop: -3 }}>
        {reqs.map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, borderColor: r.ok ? 'rgba(74,227,143,0.45)' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.12)', backgroundColor: r.ok ? 'rgba(46,204,113,0.1)' : 'transparent', paddingHorizontal: 9, paddingVertical: 5 }}>
            <FontAwesome5 name={r.ok ? 'check-circle' : 'circle'} size={10} color={r.ok ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'} />
            <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: r.ok ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)' }}>{r.label}</T>
          </View>
        ))}
        {showConfirm && confirm.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, borderColor: confirm === password ? 'rgba(74,227,143,0.45)' : 'rgba(255,123,123,0.4)', backgroundColor: confirm === password ? 'rgba(46,204,113,0.1)' : 'rgba(255,123,123,0.08)', paddingHorizontal: 9, paddingVertical: 5 }}>
            <FontAwesome5 name={confirm === password ? 'check-circle' : 'times-circle'} size={10} color={confirm === password ? (isDark ? '#4AE38F' : '#1D6F42') : '#FF7B7B'} />
            <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: confirm === password ? (isDark ? '#4AE38F' : '#1D6F42') : '#FF7B7B' }}>Passwords match</T>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** pass 92 — the live availability row shown under an email field. */
function EmailStatusRow({ state }: { state: 'idle' | 'checking' | 'ok' | 'taken' }) {
  const { isDark } = useTheme();
  if (state === 'idle') return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6, marginBottom: 13, minHeight: 16 }}>
      {state === 'checking' ? (
        <><ActivityIndicator size="small" color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)'} /><T v="caption" style={{ fontSize: 10, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)' }}>Checking email…</T></>
      ) : state === 'ok' ? (
        <><FontAwesome5 name="check-circle" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} /><T v="caption" style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#4AE38F' : '#1D6F42' }}>Email available</T></>
      ) : (
        <><FontAwesome5 name="times-circle" size={11} color="#FF7B7B" /><T v="caption" style={{ fontSize: 10, fontWeight: '700', color: '#FF7B7B' }}>Already registered — sign in instead</T></>
      )}
    </View>
  );
}

function CountryPicker({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const cur = COUNTRIES.find((c) => c.name === value);
  const filtered = q.trim() ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())) : COUNTRIES;
  return (
    <View style={{ marginBottom: 13 }}>
      <Label>Country</Label>
      <Pressable
        accessibilityLabel="country picker"
        onPress={() => { haptic.selection(); setOpen(true); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)', backgroundColor: isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)', paddingHorizontal: 14, height: 50 }}
      >
        <T v="bodyS" style={{ fontSize: 17 }}>{cur?.flag ?? '🌍'}</T>
        <T v="bodyS" style={{ flex: 1, fontSize: 15, color: isDark ? '#F2F7F3' : '#14241C', fontWeight: '600' }}>{value || 'Select your country'}</T>
        <FontAwesome5 name="chevron-down" size={12} color={isDark ? 'rgba(242,247,243,0.45)' : 'rgba(20,36,28,0.45)'} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <Pressable onStartShouldSetResponder={() => true} style={{ maxHeight: '70%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: isDark ? '#07140D' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.2)', padding: 16 }}>
            <T v="h3" style={{ fontWeight: '800', marginBottom: 10 }}>Select your country</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)', backgroundColor: isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)', paddingHorizontal: 12, height: 44, marginBottom: 10 }}>
              <FontAwesome5 name="search" size={13} color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)'} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search countries…" placeholderTextColor={isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.4)'} style={{ flex: 1, fontSize: 14, color: isDark ? '#F2F7F3' : '#14241C', padding: 0 }} />
              {q ? <Pressable onPress={() => setQ('')}><FontAwesome5 name="times-circle" size={14} color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)'} /></Pressable> : null}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 4 }}>
              {filtered.length === 0 ? <T v="caption" style={{ textAlign: 'center', marginTop: 20, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)' }}>No country matches “{q}”</T> : null}
              {filtered.map((c) => {
                const on = c.name === value;
                return (
                  <Pressable key={c.name} onPress={() => { haptic.selection(); onPick(c.name); setOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}>
                    <T v="bodyS" style={{ fontSize: 17 }}>{c.flag}</T>
                    <T numberOfLines={1} ellipsizeMode="tail" v="bodyS" style={{ flex: 1, fontSize: 13.5, fontWeight: on ? '800' : '600', color: isDark ? '#F2F7F3' : '#14241C' }}>{c.name}</T>
                    {on ? <FontAwesome5 name="check" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const { isDark } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 2 }}>
      <Pressable onPress={onBack} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(2,59,42,0.7)' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.1)', marginRight: 12 }}>
        <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#F2F7F3' : '#14241C'} />
      </Pressable>
      <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)' }}>{title.toUpperCase()}</T>
    </View>
  );
}

/* ── the screen ─────────────────────────────────────────────────────────── */

export default function Register() {
  const { isDark } = useTheme();
  const { register, login, adoptSession, updateUser } = useAuth();
  const router = useRouter();
  /* the password used for this signup, so a link-verified email can sign in */
  const lastPassword = useRef('');

  const [screen, setScreen] = useState<'choose' | 'form' | 'gmail'>('choose');
  const [accountType, setAccountType] = useState<'user' | 'scholar'>('user');
  const [gmailName, setGmailName] = useState('Demo User');
  const [gmailEmail, setGmailEmail] = useState('demo@gmail.com');
  const [busy, setBusy] = useState(false);
  /* pass 44 — email OTP step shown after the account is created */
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  /* pass 88 — how the verification mail was actually delivered (the server tells
   * us): 'otp' = the 6-digit code email went out, 'link' = the code mail failed
   * so a one-tap link went out instead, 'none' = nothing could be sent. The
   * screen must say whichever is TRUE, not always "enter the code". */
  const [otpDelivery, setOtpDelivery] = useState<"otp" | "link" | "none">("otp");
  /* pass 88 — a scholar signup continues into the SAME verification step, with
   * its own note, instead of an Alert that swallowed it ("scholar … vanishes"). */
  const [scholarNote, setScholarNote] = useState<string | null>(null);
  const [error, setError] = useState('');

  /* shared fields */
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [uState, setUState] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [eState, setEState] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [gender, setGender] = useState<string | null>(null);
  const [country, setCountry] = useState('');
  const [tribe, setTribe] = useState<string | null>(null);
  const [aqeedah, setAqeedah] = useState('Sunni');
  /* pass 94 — the same list Edit profile uses, straight from the admin */
  const { options: aqeedahList } = useAqeedahOptions();
  const [aqeedahOther, setAqeedahOther] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  /* scholar fields */
  const [step, setStep] = useState(1);
  /* pass 96 — owner: "in registrations we will add date of birth for every new
   * registration". A plain YYYY-MM-DD box with live checks beats a native picker
   * here: it behaves the same on every platform, and the server validates it
   * again before the row is written. */
  const [dob, setDob] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [fieldsOther, setFieldsOther] = useState('');
  /* pass 92 — owner: "in field of knowledge when adding other its not adding".
   * The typed text became a chip by itself and the ＋ button CLEARED the input,
   * so nothing was ever committed. Added fields now live in this array: they
   * stay as removable chips, they survive step changes, and they are sent as
   * `other_field`. */
  const [otherFields, setOtherFields] = useState<string[]>([]);
  const [madhhab, setMadhhab] = useState<string | null>(null);
  const [institute, setInstitute] = useState('');
  const [years, setYears] = useState<{ label: string; n: number } | null>(null);
  const [teachers, setTeachers] = useState('');
  const [proofName, setProofName] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<ProofDoc | null>(null);
  const [letterFile, setLetterFile] = useState<ProofDoc | null>(null);
  const [letterName, setLetterName] = useState<string | null>(null);
  /* pass 90 — owner: "remove the dawah platforms from there, links to dawah
   * platforms are not required" and "proof of qualification or a
   * recommendation letter — one is enough". The method chooser and the links
   * field are deleted; either upload satisfies the application. */
  const pendingApply = useRef<{
    payload: Parameters<typeof scholarApply>[0];
    sent: boolean;
  } | null>(null);
  /* pass 91 — the one-shot scholar sign-up keeps ITS payload here for the
   * documented retry path (account already exists → attach documents to it
   * after the code is verified, when a session finally exists). */
  const scholarRetry = useRef<Parameters<typeof scholarApply>[0] | null>(null);
  const [agree, setAgree] = useState(false);

  const nigeria = country === 'Nigeria';

  /* username live availability (debounced) */
  useEffect(() => {
    if (!username) { setUState('idle'); return; }
    if (!usernameValid(username)) { setUState('taken'); return; }
    setUState('checking');
    const t = setTimeout(() => {
      checkUsernameAvailable(username).then((r) => setUState(r.available ? 'ok' : 'taken'));
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  /* email live availability (debounced, real backend) */
  useEffect(() => {
    const em = email.trim();
    // Only check availability once the address is COMPLETE and valid — otherwise
    // it flashes "already registered" while the user is still typing.
    const complete = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(em);
    if (!complete) { setEState('idle'); return; }
    setEState('checking');
    const t = setTimeout(() => {
      checkEmailAvailable(em).then((r) => setEState(r.available ? 'ok' : 'taken'));
    }, 400);
    return () => clearTimeout(t);
  }, [email]);

  const pwOk = dlPasswordOk(password) && password === confirm;

  const pickUpload = async (which: 'proof' | 'letter') => {
    try {
      if (Platform.OS === 'web') {
        /* pass 83-2 — web uses a plain file input; never load the native picker */
        const { pickWebFile } = require('@/lib/webfile');
        const f = (await pickWebFile('image/*')) as File | null;
        if (!f) return;
        haptic.success();
        /* pass 93 — owner: "i uploaded both its not working even with one" and
         * the server answered "Please provide at least one method of
         * verification". A DOM File has NEITHER `.uri` NOR `.dataUrl`, so the
         * old code stored the NAME and dropped the file itself: the chip showed
         * "uploaded", the request carried no attachment, and the server quite
         * correctly said no document arrived. The File object is kept and is
         * what gets appended to the multipart body. */
        const nm = String(f.name || 'document.jpg').slice(0, 40);
        const doc: ProofDoc = { file: f, name: String(f.name || 'document.jpg') };
        if (which === 'proof') { setProofName(nm); setProofFile(doc); }
        else { setLetterName(nm); setLetterFile(doc); }
        return;
      }
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const res = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false });
      const asset = res.assets?.[0];
      if (!asset) return;
      haptic.success();
      const nm = (asset.fileName ?? 'document.jpg').slice(0, 40);
      if (which === 'proof') { setProofName(nm); setProofFile(asset.uri ? { uri: asset.uri, name: asset.fileName ?? 'proof.jpg', mimeType: asset.mimeType ?? undefined } : null); }
      else { setLetterName(nm); setLetterFile(asset.uri ? { uri: asset.uri, name: asset.fileName ?? 'letter.jpg', mimeType: asset.mimeType ?? undefined } : null); }
    } catch {
      setError('Could not open the file picker');
    }
  };

  const aqeedahValue = isOtherOption(aqeedah) ? (aqeedahOther.trim() || aqeedah) : aqeedah;

  /* validated here for a clear inline message, and again on the server */
  const dobError = (() => {
    const v = dob.trim();
    if (v === '') return 'Date of birth is required';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Use the format YYYY-MM-DD';
    const d = new Date(`${v}T00:00:00`);
    if (Number.isNaN(d.getTime())) return 'That date does not exist';
    const today = new Date();
    if (d > today) return 'Date of birth cannot be in the future';
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    if (age < 13) return 'You must be at least 13 years old to register';
    if (age > 120) return 'Please check the year';
    return '';
  })();

  const doRegister = async (data: { full_name: string; username: string; email: string; password: string }) => {
    setBusy(true); setError('');
    lastPassword.current = data.password;
    /* DB enum: 'male'/'female' lowercase */
    if (dobError) { setError(dobError); setBusy(false); return; }
    const res = await register({ ...data, aqeedah: aqeedahValue, country: country || undefined, gender: gender ? gender.toLowerCase() : undefined, date_of_birth: dob.trim() });
    if (res.ok) {
      setBusy(false);
      setOtpDelivery(res.emailDelivery ?? "otp");
      setOtpEmail(data.email); /* pass 44 — show the 6-digit OTP step */
    }
    else { setError(res.message || 'Something went wrong'); setBusy(false); }
  };

  const submitUser = () => {
    if (busy) return;
    if (!fullName.trim()) return setError('Please enter your full name');
    if (!email.includes('@')) return setError('Please enter a valid email');
    if (eState === 'taken') return setError('This email is already registered — please sign in or use another email');
    if (uState !== 'ok') return setError('Please choose an available username');
    if (!gender) return setError('Please select your gender');
    if (!country) return setError('Please select your country');
    if (nigeria && !tribe) return setError('Please select your tribe');
    if (!pwOk) return setError('Password does not meet the requirements');
    void doRegister({ full_name: fullName.trim(), username, email: email.trim(), password });
  };

  const submitGmail = () => {
    if (busy) return;
    if (uState !== 'ok') return setError('Please choose an available username');
    if (!gender) return setError('Please select your gender');
    if (!country) return setError('Please select your country');
    if (nigeria && !tribe) return setError('Please select your tribe');
    void doRegister({ full_name: gmailName, username, email: gmailEmail, password: 'demo1234' });
  };

  const nextStep1 = () => {
    if (!fullName.trim()) return setError('Please enter your full name');
    if (!displayName.trim()) return setError('Please enter a display name (e.g. Sheikh Muhammad)');
    if (uState !== 'ok') return setError('Please choose an available username');
    if (!email.includes('@')) return setError('Please enter a valid email');
    /* pass 92 — owner: "the email checking should be realtime as the normal user
     * registration is checking if that email exists". The check already ran for
     * this form (shared state) but its result was never rendered and never
     * enforced, so a scholar could push an email that was already registered
     * all the way to the last step. */
    if (eState === 'taken')
      return setError('This email is already registered — sign in instead, or use another email');
    if (eState === 'checking') return setError('Checking that email — one moment');
    if (!country) return setError('Please select your country');
    if (phone.replace(/\D/g, '').length < 7) return setError('Please enter a valid phone number');
    if (!pwOk) return setError('Password does not meet the requirements');
    setError(''); haptic.medium(); setStep(2);
  };

  const nextStep2 = () => {
    if (eState === 'taken')
      return setError('This email is already registered — sign in instead, or use another email');
    if (!fields.length && !otherFields.length && !fieldsOther.trim())
      return setError('Select at least one field of knowledge');
    if (!madhhab) return setError('Please select your madhhab');
    if (!aqeedah) return setError('Please select your aqeedah');
    if (!institute.trim()) return setError('Please enter the institute you studied at');
    if (!years) return setError('Please select your years of experience');
    setError(''); haptic.medium(); setStep(3);
  };

  const submitScholar = async () => {
    if (busy) return;
    if (eState === 'taken')
      return setError('This email is already registered — sign in instead, or use another email');
    if (!proofName && !letterName)
      return setError(
        'Upload either your proof of qualifications or a recommendation letter — one is enough',
      );
    if (!gender) return setError('Please select your gender');
    if (!agree) return setError('Please agree to the Terms and Privacy Policy');
    setError('');
    setBusy(true);
    /* pass 92 — anything typed in "Others" but not yet committed is committed
     * now, so a custom field of knowledge can never be silently dropped again. */
    const typedOther = fieldsOther.trim();
    const others =
      typedOther && !otherFields.some((x) => x.toLowerCase() === typedOther.toLowerCase())
        ? [...otherFields, typedOther]
        : otherFields;
    if (!fields.length && !others.length) {
      setBusy(false);
      return setError('Select at least one field of knowledge (or add your own)');
    }
    const allFields = fields;
    const draft = {
      account: 'scholar', display_name: displayName.trim(), phone, fields: allFields,
      madhhab, institute: institute.trim(), years: years?.label, teachers: teachers.trim(),
      proof: proofName, letter: letterName, at: Date.now(),
    };
    /* a local copy is still kept — if the network dies mid-request he does not
     * have to retype anything, and the verification team has a record */
    await storage.setItem(`dl.scholar.app.${username}`, JSON.stringify(draft)).catch(() => {});
    const payload = {
      display_name: displayName.trim() || fullName.trim(), phone: phone || undefined,
      fields: allFields, other_field: others.join(', ') || undefined,
      madhhab: madhhab ?? undefined, institute: institute.trim(), years: years ? years.n : undefined,
      teachers: teachers.trim(), aqeedah: aqeedahValue,
      proof: proofFile, letter: letterFile,
    };
    /* pass 91 — ONE request that creates the account, the `pending` scholars row
     * and both documents (api/auth/register_scholar.php). The old flow posted
     * the documents to scholar_apply.php BEFORE there was a session, which
     * always answered "Not logged in" and left the account without a scholars
     * row: visible in Users Management, missing from Scholars Management. */
    const res = await registerScholar({
      full_name: fullName.trim(), display_name: displayName.trim(), email: email.trim(),
      username, password, gender: gender?.toLowerCase(), country: country || undefined,
      phone: phone || undefined, aqeedah: aqeedahValue,
      fields: allFields, other_field: others.join(', ') || undefined,
      madhhab: madhhab ?? undefined, institute: institute.trim(),
      years: years ? years.n : undefined, teachers: teachers.trim(),
      proof: proofFile, letter: letterFile,
    });
    if (res.ok) {
      scholarRetry.current = null;
      pendingApply.current = null;
      await storage.removeItem(`dl.scholar.app.${username}`).catch(() => {});
      setScholarNote(
        'Your scholar application is with the verification team — they review it after your email is confirmed.',
      );
      setOtpDelivery(res.emailDelivery);
      setBusy(false);
      setOtpEmail(email.trim());
      return;
    }
    /* the server refused: keep every field typed and both picked files in memory
     * so pressing "Submit application" again is the whole retry */
    const fieldError = Object.values(res.errors ?? {})[0];
    const taken =
      /already (taken|registered)/i.test(res.message ?? '') ||
      Object.keys(res.errors ?? {}).some((k) => /username|email/i.test(k));
    if (taken) {
      /* the account exists (an earlier attempt got through, or he already has an
       * account) — verify it and attach the documents immediately afterwards */
      scholarRetry.current = payload;
      setScholarNote(
        'This email or username already has an account. Enter the code below — your documents are attached right after confirmation.',
      );
      setOtpDelivery('otp');
      setBusy(false);
      setOtpEmail(email.trim());
      return;
    }
    setError(fieldError || res.message || 'We could not submit your application. Please try again.');
    setBusy(false);
  };

  const toggleField = (f: string) => setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  /** Commit whatever is typed in the "Others" box into the chip list. */
  const addOtherField = () => {
    const v = fieldsOther.trim();
    if (!v) return;
    if (v.length > 60) return setError('A custom field of knowledge must be 60 characters or less');
    setOtherFields((cur) =>
      cur.some((x) => x.toLowerCase() === v.toLowerCase()) ? cur : [...cur, v],
    );
    setFieldsOther('');
    setError('');
    haptic.light();
  };
  const removeOtherField = (v: string) => {
    setOtherFields((cur) => cur.filter((x) => x !== v));
    haptic.selection();
  };

  /* ── CHOOSE screen ── */
  const ChooseScreen = (
    <View style={{ paddingBottom: 10 }}>
      <BackHeader onBack={() => goBack(router, '/(auth)/login')} title="Create your account" />
      <AuthHeading title="Join DeenLink" sub="Choose your account type — you can apply as a scholar at any time" />

      {([
        { id: 'user', icon: 'user', title: 'User account', sub: 'Pray, learn, quiz and join the community', tint: isDark ? '#4AE38F' : '#1D6F42' },
        { id: 'scholar', icon: 'user-graduate', title: 'Scholar account', sub: 'Answer questions and teach — verified in 3 steps', tint: '#D4AF37' },
      ] as const).map((o) => (
        <Pressable
          key={o.id}
          accessibilityLabel={`continue as ${o.id}`}
          onPress={() => { haptic.medium(); setAccountType(o.id); setScreen('form'); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, borderWidth: 1.5, borderColor: `${o.tint}55`, backgroundColor: `${o.tint}12`, padding: 15, marginBottom: 11, opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: `${o.tint}22`, borderWidth: 1, borderColor: `${o.tint}55`, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={o.icon} size={17} color={o.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <T numberOfLines={1} ellipsizeMode="tail" v="h3" style={{ fontSize: 14.5, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>{o.title}</T>
            <T v="caption" style={{ fontSize: 10.5, color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(20,36,28,0.6)', marginTop: 2 }}>{o.sub}</T>
          </View>
          <FontAwesome5 name="chevron-right" size={13} color={isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.4)'} />
        </Pressable>
      ))}

      <AuthOrDivider />
      <AuthGoogleButton onDemo={() => {
        haptic.medium();
        setGmailName('Demo User');
        setGmailEmail('demo@gmail.com');
        setAccountType('user');
        setScreen('gmail');
      }} />
      <AuthSwitchLine text="Already have an account?" actionLabel="Sign In" onAction={() => goBack(router, '/(auth)/login')} />
    </View>
  );

  /* ── identity + faith block shared by user form and gmail ── */
  const IdentityBlock = (
    <>
      <UsernameField value={username} onChange={setUsername} state={uState} />

      <View style={{ marginBottom: 13 }}>
        <Label>Gender</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {GENDERS.map((g) => <Chip key={g} label={g} on={gender === g} onPress={() => setGender(g)} />)}
        </View>
      </View>

      <CountryPicker value={country} onPick={(c) => { setCountry(c); setTribe(null); }} />

      {nigeria ? (
        <View style={{ marginBottom: 13 }}>
          <Label>Tribe</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TRIBES.map((t) => <Chip key={t} label={t} on={tribe === t} onPress={() => setTribe(t)} />)}
          </View>
        </View>
      ) : null}

      <AqeedahPicker value={aqeedah} other={aqeedahOther} setValue={setAqeedah} setOther={setAqeedahOther} nigeria={nigeria} options={aqeedahList} />
    </>
  );

  /* ── USER form ── */
  const UserForm = (
    <View style={{ paddingBottom: 10 }}>
      <BackHeader onBack={() => setScreen('choose')} title="User account" />
      <AuthHeading title="Create your account" sub="It takes less than a minute, inshaAllah" />

      <AuthField label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Aminu Abubakar" icon="user" autoCap="words" />
      <AuthField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" icon="envelope" keyboard="email-address" />
      <EmailStatusRow state={eState} />

      {IdentityBlock}

      <AuthField label="Date of birth" value={dob} onChangeText={(v) => setDob(v.replace(/[^0-9-]/g, '').slice(0, 10))} placeholder="YYYY-MM-DD" icon="birthday-cake" />
      {dob && dobError ? (
        <T v="caption" style={{ color: '#FF9B6A', fontSize: 11.5, marginTop: -6, marginBottom: 10 }}>{dobError}</T>
      ) : (
        <T v="caption" style={{ fontSize: 10.5, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)', marginTop: -6, marginBottom: 10 }}>
          Used for your age in the app — never shown on your profile.
        </T>
      )}

      <PasswordBlock password={password} confirm={confirm} setPassword={setPassword} setConfirm={setConfirm} />

      {error ? <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>{error}</T> : null}
      <AuthPrimaryButton label="Sign Up" busy={busy} onPress={submitUser} />

      <AuthOrDivider />
      <AuthGoogleButton onDemo={() => { haptic.medium(); setGmailName(fullName.trim() || 'Demo User'); setGmailEmail(email.includes('@') ? email.trim() : 'demo@gmail.com'); setScreen('gmail'); }} />
      <AuthSwitchLine text="Already have an account?" actionLabel="Sign In" onAction={() => goBack(router, '/(auth)/login')} />
    </View>
  );

  /* ── GMAIL complete-your-info ── */
  const GmailScreen = (
    <View style={{ paddingBottom: 10 }}>
      <BackHeader onBack={() => setScreen('choose')} title="Gmail sign-up" />
      <AuthHeading title="Complete your info" sub={`Signed in with Gmail as ${gmailEmail} — just a few details left`} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(212,175,55,0.08)', paddingHorizontal: 13, paddingVertical: 10, marginBottom: 15 }}>
        <FontAwesome5 name="google" size={14} color="#D4AF37" />
        <View style={{ flex: 1 }}>
          <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>{gmailName}</T>
          <T v="caption" style={{ fontSize: 10, color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)' }}>{gmailEmail} · verified</T>
        </View>
        <FontAwesome5 name="check-circle" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
      </View>

      {IdentityBlock}

      <AuthField label="Date of birth" value={dob} onChangeText={(v) => setDob(v.replace(/[^0-9-]/g, '').slice(0, 10))} placeholder="YYYY-MM-DD" icon="birthday-cake" />
      {dob && dobError ? (
        <T v="caption" style={{ color: '#FF9B6A', fontSize: 11.5, marginTop: -6, marginBottom: 10 }}>{dobError}</T>
      ) : (
        <T v="caption" style={{ fontSize: 10.5, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)', marginTop: -6, marginBottom: 10 }}>
          Used for your age in the app — never shown on your profile.
        </T>
      )}

      {error ? <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>{error}</T> : null}
      <AuthPrimaryButton label="Create my account" busy={busy} onPress={submitGmail} />
    </View>
  );

  /* ── SCHOLAR form (3 steps) ── */
  const StepDots = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 2 }}>
      {([1, 2, 3] as const).map((n, i) => {
        const on = step === n;
        const done = step > n;
        return (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on || done ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(255,255,255,0.18)' : 'rgba(20,36,28,0.18)', backgroundColor: done ? (isDark ? '#4AE38F' : '#1D6F42') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={done ? 'check' : 'circle'} size={done ? 9 : 6} color={done ? '#FFFFFF' : isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.4)'} />
              </View>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)' }}>
                {['BASIC', 'QUALIFICATIONS', 'VERIFICATION'][n - 1]}
              </T>
            </View>
            {i < 2 ? <View style={{ flex: 1, height: 1.5, borderRadius: 1, backgroundColor: done ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.35)') : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.12)' }} /> : null}
          </View>
        );
      })}
    </View>
  );

  const UploadRow = ({ icon, title, sub, name, onPick, onClear, required }: { icon: string; title: string; sub: string; name: string | null; onPick: () => void; onClear: () => void; required?: boolean }) => (
    <View style={{ marginBottom: 11 }}>
      <Label>{title}</Label>
      {name ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(74,227,143,0.45)', backgroundColor: 'rgba(46,204,113,0.09)', paddingHorizontal: 13, paddingVertical: 10 }}>
          <FontAwesome5 name="file-image" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="bodyS" style={{ flex: 1, fontSize: 12, fontWeight: '700', color: isDark ? '#F2F7F3' : '#14241C' }} numberOfLines={1}>{name}</T>
          <FontAwesome5 name="check-circle" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <Pressable onPress={onClear} hitSlop={8}><FontAwesome5 name="times" size={11} color="#FF7B7B" /></Pressable>
        </View>
      ) : (
        <Pressable accessibilityLabel={title} onPress={onPick} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(20,36,28,0.2)', backgroundColor: isDark ? 'rgba(3,36,24,0.4)' : 'rgba(255,255,255,0.55)', paddingHorizontal: 13, paddingVertical: 13 }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={icon} size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyS" style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#F2F7F3' : '#14241C' }}>Tap to upload</T>
            <T v="caption" style={{ fontSize: 9.5, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)', marginTop: 1 }}>{sub}</T>
          </View>
        </Pressable>
      )}
    </View>
  );

  const ScholarForm = (
    <View style={{ paddingBottom: 10 }}>
      <BackHeader onBack={() => (step === 1 ? setScreen('choose') : (haptic.light(), setStep(step - 1)))} title={step === 1 ? 'Scholar · step 1 of 3' : step === 2 ? 'Scholar · step 2 of 3' : 'Scholar · step 3 of 3'} />
      {StepDots}

      {step === 1 ? (
        <>
          <AuthHeading title="Basic information" sub="Who you are — name, contact and password" />
          <AuthField label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Muhammad Abubakar" icon="user" autoCap="words" />
          <AuthField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder='e.g. "Sheikh Muhammad"' icon="id-badge" autoCap="words" />
          <UsernameField value={username} onChange={setUsername} state={uState} />
          <AuthField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" icon="envelope" keyboard="email-address" />
          <EmailStatusRow state={eState} />
          <CountryPicker value={country} onPick={(c) => setCountry(c)} />
          <AuthField label="Phone" value={phone} onChangeText={(v) => setPhone(v.replace(/[^0-9+\s]/g, '').slice(0, 16))} placeholder="+234 800 000 0000" icon="phone" keyboard="phone-pad" />
          {/* pass 91 — the server requires a gender for scholar accounts; this
              form never asked for one, so every submission was rejected with
              "Please select a valid gender" before anything else was looked at. */}
          <View style={{ marginBottom: 13 }}>
            <Label>Gender</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GENDERS.map((g) => <Chip key={g} label={g} on={gender === g} onPress={() => setGender(g)} />)}
            </View>
          </View>
          <PasswordBlock password={password} confirm={confirm} setPassword={setPassword} setConfirm={setConfirm} />
          {error ? <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>{error}</T> : null}
          <AuthPrimaryButton label="Continue" busy={false} onPress={nextStep1} />
        </>
      ) : step === 2 ? (
        <>
          <AuthHeading title="Qualifications" sub="What you teach and where you studied" />
          <View style={{ marginBottom: 13 }}>
            <Label>Fields of knowledge</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {KNOWLEDGE_FIELDS.map((f) => <Chip key={f} label={f} on={fields.includes(f)} onPress={() => toggleField(f)} />)}
              {otherFields.map((f) => (
                <Chip key={`other-${f}`} label={`${f} ✕`} on onPress={() => removeOtherField(f)} tint="#D4AF37" />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 }}>
              <View style={{ flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)', backgroundColor: isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)', paddingHorizontal: 12, height: 42, justifyContent: 'center' }}>
                <TextInput value={fieldsOther} onChangeText={setFieldsOther} onSubmitEditing={addOtherField} returnKeyType="done" placeholder="Others — type and press ＋" placeholderTextColor={isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'} style={{ fontFamily: 'Poppins-Medium', fontSize: 13.5, color: isDark ? '#F2F7F3' : '#14241C', paddingVertical: 0 }} />
              </View>
              <Pressable
                accessibilityLabel="add field of knowledge"
                onPress={addOtherField}
                style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', alignItems: 'center', justifyContent: 'center' }}
              >
                <FontAwesome5 name="plus" size={13} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={{ marginBottom: 13 }}>
            <Label>Madhhab</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MADHHABS.map((m) => <Chip key={m} label={m} on={madhhab === m} onPress={() => setMadhhab(m)} />)}
            </View>
          </View>

          <AqeedahPicker value={aqeedah} other={aqeedahOther} setValue={setAqeedah} setOther={setAqeedahOther} nigeria={nigeria} options={aqeedahList} />

          <AuthField label="Institute studied at" value={institute} onChangeText={setInstitute} placeholder="e.g. Islamic University of Madinah" icon="university" autoCap="words" />

          <View style={{ marginBottom: 13 }}>
            <Label>Years of experience</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {YEARS.map((y) => <Chip key={y.label} label={`${y.label} yrs`} on={years?.label === y.label} onPress={() => setYears(y)} />)}
            </View>
          </View>

          <AuthField label="Teachers' names (optional)" value={teachers} onChangeText={setTeachers} placeholder="e.g. Sheikh Ahmad, Ustadh Yusuf" icon="chalkboard-teacher" autoCap="words" />

          {error ? <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>{error}</T> : null}
          <AuthPrimaryButton label="Continue" busy={false} onPress={nextStep2} />
        </>
      ) : (
        <>
          <AuthHeading
            title="Verification"
            sub="Upload your certificates or a recommendation letter — one is enough, and our team reviews every application"
          />

          <UploadRow icon="file-alt" title="Proof of qualifications" sub="Certificate, ijazah or degree image — or send a letter below instead" name={proofName} onPick={() => pickUpload('proof')} onClear={() => { setProofName(null); setProofFile(null); }} />
          <UploadRow icon="envelope-open-text" title="Recommendation letter" sub="From a recognized scholar or organization — or send your certificates above" name={letterName} onPick={() => pickUpload('letter')} onClear={() => { setLetterName(null); setLetterFile(null); }} />

                    <Pressable onPress={() => { haptic.selection(); setAgree(!agree); }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14 }}>
            <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: agree ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(20,36,28,0.2)', backgroundColor: agree ? (isDark ? '#4AE38F' : '#1D6F42') : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              {agree ? <FontAwesome5 name="check" size={10} color="#fff" /> : null}
            </View>
            <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Poppins-Regular', color: isDark ? 'rgba(242,247,243,0.7)' : 'rgba(20,36,28,0.7)' }}>
              I agree to the <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Terms of Service</Text> and the <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Privacy Policy</Text>, and I confirm my qualifications are genuine.
            </Text>
          </Pressable>

          {error ? <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>{error}</T> : null}
          <AuthPrimaryButton label="Submit application" busy={busy} onPress={submitScholar} />
        </>
      )}
    </View>
  );

  return (
    <>
      <AuthShell>
        {screen === 'choose' ? ChooseScreen : screen === 'gmail' ? GmailScreen : accountType === 'scholar' ? ScholarForm : UserForm}
      </AuthShell>
      {otpEmail ? (
        <Modal visible transparent animationType="fade">
          <OtpVerify
            email={otpEmail}
            delivery={otpDelivery}
            note={scholarNote}
            onVerified={(u) => {
              setOtpEmail(null);
              setScholarNote(null);
              /* pass 91 — the normal path no longer needs a retry at all: the
               * account, the `pending` scholars row and the documents are all
               * created by ONE request before the code screen appears. What is
               * left here is the documented edge case (the email/username
               * already had an account), where the documents are attached now
               * that a session exists — and the outcome is SHOWN, never
               * swallowed. */
              const retryPayload = scholarRetry.current;
              if (accountType === 'scholar' && retryPayload) {
                void scholarApply({
                  ...retryPayload,
                  years: retryPayload.years,
                })
                  .then((out) => {
                    const ok =
                      out.ok || /already a verified scholar/i.test(out.message || '');
                    if (ok) {
                      scholarRetry.current = null;
                      pendingApply.current = null;
                      void storage.removeItem(`dl.scholar.app.${username}`).catch(() => {});
                    } else {
                      Alert.alert(
                        'Documents not uploaded',
                        out.message ||
                          'We could not attach your documents to this account. Open Scholars → Apply as scholar and send them again — everything you typed is still on this device.',
                      );
                    }
                  })
                  .catch(() =>
                    Alert.alert(
                      'Documents not uploaded',
                      'Check your connection and send them again from Scholars → Apply as scholar.',
                    ),
                  );
              }
              if (u) {
                /* verify_otp minted the session — adopt it */
                void adoptSession(u)
                  .then(() => router.replace('/(tabs)'))
                  .finally(() => {
                    /* pass 90 — the scholar row only exists on the server from
                     * this moment (register → upload → OTP). The session the OTP
                     * minted was created BEFORE it, so without one refresh the
                     * new scholar lands in the app with no tag, no level and no
                     * My Questions button — exactly the report. */
                    if (accountType === 'scholar') {
                      void restoreSession()
                        .then(({ user: fresh }) => {
                          if (fresh) updateUser(fresh);
                        })
                        .catch(() => {});
                    }
                  });
              } else {
                /* verified via the email LINK in another tab: sign in normally */
                void login(otpEmail, lastPassword.current).then((r) => {
                  if (r.ok) router.replace('/(tabs)');
                });
              }
            }}
            /* pass 66-night — cancel must NOT sign anyone in. It returns to the
             * form with every field kept, so the email can be corrected and the
             * signup resubmitted (the pending row is reused server-side). */
            onCancel={() => setOtpEmail(null)}
          />
        </Modal>
      ) : null}
    </>
  );
}
