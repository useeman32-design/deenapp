import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { AuthShell, AuthHeading, AuthField, AuthPrimaryButton, AuthGoogleButton, AuthOrDivider, AuthSwitchLine } from '@/components/AuthShell';
import { OtpVerify } from '@/components/OtpVerify';
import { checkUsernameAvailable, checkEmailAvailable } from '@/api/client';

/**
 * pass 41 — FULL signup rebuild.
 *  · CHOOSE screen — user account vs scholar account (+ Google / Gmail path)
 *  · USER form — name, email, username with LIVE availability, gender, country
 *    (Nigeria → tribe chips Hausa/Igbo/Yoruba/General), aqeedah with short
 *    descriptions (Sunni/Sufi/Shia/Athari/Other ≤10 chars), password + confirm
 *    with a live checkmark requirement list
 *  · SCHOLAR form — 3 steps: basic → qualifications → verification (uploads,
 *    dawah links, ONE verification method, terms + privacy agreement)
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

const AQEEDAH: Array<{ id: string; desc: string; descNG?: string }> = [
  { id: 'Sunni', desc: 'Ahlus-Sunnah wal-Jama\u2019ah — the Qur\u2019an, the Sunnah and the way of the righteous predecessors.', descNG: 'Ahlus-Sunnah wal-Jama\u2019ah — the Qur\u2019an, the Sunnah and the way of the righteous predecessors. Izala and Salafiyya fall under Sunni.' },
  { id: 'Sufi', desc: 'Tasawwuf — purifying the heart and soul. Tijaniyya and Qadiriyya fall here.' },
  { id: 'Shia', desc: 'The school of the Ahl al-Bayt — belief in the Imamate and the leadership of the Prophet\u2019s \ufdfa household after him.' },
  { id: 'Athari', desc: 'The creed of the salaf — affirmation of the texts without speculative interpretation.' },
  { id: 'Other', desc: 'Describe your aqeedah in your own words (max 10 characters).' },
];

const KNOWLEDGE_FIELDS = ['Tawhid', 'Fiqh', 'Aqeedah', 'Tafsir', 'Quran', 'Seerah', 'Hadith'];
const MADHHABS = ['Hanafi', 'Maliki', 'Shafi\u2019i', 'Hanbali', 'Other'];
const YEARS = ['1–3', '4–7', '8–15', '16–25', '25+'];
const VERIFY_METHODS: Array<{ id: 'documents' | 'letter' | 'links'; icon: string; title: string; sub: string }> = [
  { id: 'documents', icon: 'file-alt', title: 'Proof of qualifications', sub: 'Certificates, ijazahs or degrees from your institute' },
  { id: 'letter', icon: 'envelope-open-text', title: 'Recommendation letter', sub: 'A letter from a recognized scholar or organization' },
  { id: 'links', icon: 'link', title: 'Dawah platforms', sub: 'Verified links to your lectures, TV/radio or big platforms' },
];

const usernameValid = (u: string) => /^[a-z0-9._]{3,20}$/i.test(u);

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
  const reqs = [
    { label: 'At least 6 characters', ok: password.length >= 6 },
    { label: 'Contains a letter', ok: /[A-Za-z]/.test(password) },
    { label: 'Contains a number', ok: /[0-9]/.test(password) },
  ];
  return (
    <View>
      <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" icon="lock" secure />
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
                    <T v="bodyS" style={{ flex: 1, fontSize: 13.5, fontWeight: on ? '800' : '600', color: isDark ? '#F2F7F3' : '#14241C' }}>{c.name}</T>
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

function AqeedahPicker({ value, other, setValue, setOther, nigeria }: { value: string; other: string; setValue: (v: string) => void; setOther: (v: string) => void; nigeria: boolean }) {
  const { isDark } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Label>Aqeedah</Label>
      <View style={{ gap: 7 }}>
        {AQEEDAH.map((a) => {
          const on = value === a.id;
          const desc = nigeria && a.descNG ? a.descNG : a.desc;
          return (
            <Pressable
              key={a.id}
              accessibilityLabel={`aqeedah ${a.id}`}
              onPress={() => { haptic.selection(); setValue(a.id); }}
              style={{ borderRadius: 14, borderWidth: 1.5, borderColor: on ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)', backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : isDark ? 'rgba(2,59,42,0.5)' : 'rgba(255,255,255,0.7)', paddingHorizontal: 13, paddingVertical: 10 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name={on ? 'check-circle' : 'circle'} size={13} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'} />
                <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>{a.id}</T>
              </View>
              <T v="caption" style={{ fontSize: 10.5, lineHeight: 15.5, color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(20,36,28,0.6)', marginLeft: 21, marginTop: 3 }}>{desc}</T>
              {a.id === 'Other' && on ? (
                <TextInput
                  value={other}
                  onChangeText={(t) => setOther(t.slice(0, 10))}
                  placeholder="Max 10 characters"
                  placeholderTextColor={isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'}
                  maxLength={10}
                  style={{ marginLeft: 21, marginTop: 8, borderRadius: 11, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(20,36,28,0.16)', backgroundColor: isDark ? 'rgba(3,36,24,0.6)' : 'rgba(255,255,255,0.8)', paddingHorizontal: 11, height: 40, fontFamily: 'Poppins-Medium', fontSize: 14, color: isDark ? '#F2F7F3' : '#14241C' }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
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
  const { register } = useAuth();
  const router = useRouter();

  const [screen, setScreen] = useState<'choose' | 'form' | 'gmail'>('choose');
  const [accountType, setAccountType] = useState<'user' | 'scholar'>('user');
  const [gmailName, setGmailName] = useState('Demo User');
  const [gmailEmail, setGmailEmail] = useState('demo@gmail.com');
  const [busy, setBusy] = useState(false);
  /* pass 44 — email OTP step shown after the account is created */
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
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
  const [aqeedahOther, setAqeedahOther] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  /* scholar fields */
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [fieldsOther, setFieldsOther] = useState('');
  const [madhhab, setMadhhab] = useState<string | null>(null);
  const [institute, setInstitute] = useState('');
  const [years, setYears] = useState<string | null>(null);
  const [teachers, setTeachers] = useState('');
  const [proofName, setProofName] = useState<string | null>(null);
  const [letterName, setLetterName] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState('');
  const [method, setMethod] = useState<'documents' | 'letter' | 'links' | null>(null);
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
    if (!em || !em.includes('@')) { setEState('idle'); return; }
    setEState('checking');
    const t = setTimeout(() => {
      checkEmailAvailable(em).then((r) => setEState(r.available ? 'ok' : 'taken'));
    }, 400);
    return () => clearTimeout(t);
  }, [email]);

  const pwOk = password.length >= 6 && /[A-Za-z]/.test(password) && /[0-9]/.test(password) && password === confirm;

  const pickUpload = async (which: 'proof' | 'letter') => {
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const res = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false });
      const asset = res.assets?.[0];
      if (!asset) return;
      haptic.success();
      const nm = (asset.fileName ?? 'document.jpg').slice(0, 40);
      if (which === 'proof') setProofName(nm); else setLetterName(nm);
    } catch {
      setError('Could not open the file picker');
    }
  };

  const aqeedahValue = aqeedah === 'Other' ? (aqeedahOther.trim() || 'Other') : aqeedah;

  const doRegister = async (data: { full_name: string; username: string; email: string; password: string }) => {
    setBusy(true); setError('');
    /* DB enum: 'male'/'female' lowercase */
    const res = await register({ ...data, aqeedah: aqeedahValue, country: country || undefined, gender: gender ? gender.toLowerCase() : undefined });
    if (res.ok) { setBusy(false); setOtpEmail(data.email); } // pass 44 — show the 6-digit OTP step
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
    if (!country) return setError('Please select your country');
    if (phone.replace(/\D/g, '').length < 7) return setError('Please enter a valid phone number');
    if (!pwOk) return setError('Password does not meet the requirements');
    setError(''); haptic.medium(); setStep(2);
  };

  const nextStep2 = () => {
    if (!fields.length) return setError('Select at least one field of knowledge');
    if (!madhhab) return setError('Please select your madhhab');
    if (!aqeedah) return setError('Please select your aqeedah');
    if (!institute.trim()) return setError('Please enter the institute you studied at');
    if (!years) return setError('Please select your years of experience');
    setError(''); haptic.medium(); setStep(3);
  };

  const submitScholar = async () => {
    if (busy) return;
    if (!method) return setError('Choose ONE verification method');
    if (method === 'documents' && !proofName) return setError('Please upload your proof of qualifications');
    if (method === 'letter' && !letterName) return setError('Please upload a recommendation letter');
    if (method === 'links' && !links.length) return setError('Please add at least one dawah platform link');
    if (!agree) return setError('Please agree to the Terms and Privacy Policy');
    setError('');
    setBusy(true);
    const allFields = fieldsOther.trim() ? [...fields, fieldsOther.trim()] : fields;
    const res = await register({
      full_name: fullName.trim(), username, email: email.trim(), password,
      aqeedah: aqeedahValue, country: country || undefined,
    });
    if (res.ok) {
      /* keep the scholar application for the verification team */
      await storage.setItem(`dl.scholar.app.${username}`, JSON.stringify({
        account: 'scholar', display_name: displayName.trim(), phone, fields: allFields,
        madhhab, institute: institute.trim(), years, teachers: teachers.trim(),
        method, proof: proofName, letter: letterName, links, at: Date.now(),
      })).catch(() => {});
      Alert.alert('Application received', 'Jazakallahu khairan! Your scholar application is under review — you can use DeenLink as a user in the meantime.');
      router.replace('/(tabs)');
    } else {
      setError(res.message || 'Something went wrong');
      setBusy(false);
    }
  };

  const toggleField = (f: string) => setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  /* ── CHOOSE screen ── */
  const ChooseScreen = (
    <View style={{ paddingBottom: 10 }}>
      <BackHeader onBack={() => router.back()} title="Create your account" />
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
            <T v="h3" style={{ fontSize: 14.5, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>{o.title}</T>
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
      <AuthSwitchLine text="Already have an account?" actionLabel="Sign In" onAction={() => router.back()} />
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

      <AqeedahPicker value={aqeedah} other={aqeedahOther} setValue={setAqeedah} setOther={setAqeedahOther} nigeria={nigeria} />
    </>
  );

  /* ── USER form ── */
  const UserForm = (
    <View style={{ paddingBottom: 10 }}>
      <BackHeader onBack={() => setScreen('choose')} title="User account" />
      <AuthHeading title="Create your account" sub="It takes less than a minute, inshaAllah" />

      <AuthField label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Aminu Abubakar" icon="user" autoCap="words" />
      <AuthField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" icon="envelope" keyboard="email-address" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6, marginBottom: 13, minHeight: 16 }}>
        {eState === 'checking' ? (
          <><ActivityIndicator size="small" color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)'} /><T v="caption" style={{ fontSize: 10, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)' }}>Checking email…</T></>
        ) : eState === 'ok' ? (
          <><FontAwesome5 name="check-circle" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} /><T v="caption" style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#4AE38F' : '#1D6F42' }}>Email available</T></>
        ) : eState === 'taken' ? (
          <><FontAwesome5 name="times-circle" size={11} color="#FF7B7B" /><T v="caption" style={{ fontSize: 10, fontWeight: '700', color: '#FF7B7B' }}>Already registered — sign in instead</T></>
        ) : null}
      </View>

      {IdentityBlock}

      <PasswordBlock password={password} confirm={confirm} setPassword={setPassword} setConfirm={setConfirm} />

      {error ? <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>{error}</T> : null}
      <AuthPrimaryButton label="Sign Up" busy={busy} onPress={submitUser} />

      <AuthOrDivider />
      <AuthGoogleButton onDemo={() => { haptic.medium(); setGmailName(fullName.trim() || 'Demo User'); setGmailEmail(email.includes('@') ? email.trim() : 'demo@gmail.com'); setScreen('gmail'); }} />
      <AuthSwitchLine text="Already have an account?" actionLabel="Sign In" onAction={() => router.back()} />
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

  const UploadRow = ({ icon, title, sub, name, onPick, onClear, required }: { icon: string; title: string; sub: string; name: string | null; onPick: () => void; onClear: () => void; required: boolean }) => (
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
          <CountryPicker value={country} onPick={(c) => setCountry(c)} />
          <AuthField label="Phone" value={phone} onChangeText={(v) => setPhone(v.replace(/[^0-9+\s]/g, '').slice(0, 16))} placeholder="+234 800 000 0000" icon="phone" keyboard="phone-pad" />
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
              {fieldsOther.trim() ? <Chip label={fieldsOther.trim()} on onPress={() => {}} tint="#D4AF37" /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 }}>
              <View style={{ flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)', backgroundColor: isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)', paddingHorizontal: 12, height: 42, justifyContent: 'center' }}>
                <TextInput value={fieldsOther} onChangeText={setFieldsOther} placeholder="Others — type and press Add" placeholderTextColor={isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'} style={{ fontFamily: 'Poppins-Medium', fontSize: 13.5, color: isDark ? '#F2F7F3' : '#14241C', paddingVertical: 0 }} />
              </View>
              <Pressable
                onPress={() => { if (fieldsOther.trim()) { haptic.light(); setFieldsOther(''); } }}
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

          <AqeedahPicker value={aqeedah} other={aqeedahOther} setValue={setAqeedah} setOther={setAqeedahOther} nigeria={nigeria} />

          <AuthField label="Institute studied at" value={institute} onChangeText={setInstitute} placeholder="e.g. Islamic University of Madinah" icon="university" autoCap="words" />

          <View style={{ marginBottom: 13 }}>
            <Label>Years of experience</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {YEARS.map((y) => <Chip key={y} label={`${y} yrs`} on={years === y} onPress={() => setYears(y)} />)}
            </View>
          </View>

          <AuthField label="Teachers' names (optional)" value={teachers} onChangeText={setTeachers} placeholder="e.g. Sheikh Ahmad, Ustadh Yusuf" icon="chalkboard-teacher" autoCap="words" />

          {error ? <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>{error}</T> : null}
          <AuthPrimaryButton label="Continue" busy={false} onPress={nextStep2} />
        </>
      ) : (
        <>
          <AuthHeading title="Verification" sub="Choose ONE method — our team reviews every application" />

          <View style={{ marginBottom: 14 }}>
            {VERIFY_METHODS.map((m) => {
              const on = method === m.id;
              return (
                <Pressable key={m.id} accessibilityLabel={`verify by ${m.title}`} onPress={() => { haptic.selection(); setMethod(m.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1.5, borderColor: on ? 'rgba(212,175,55,0.55)' : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)', backgroundColor: on ? 'rgba(212,175,55,0.09)' : isDark ? 'rgba(2,59,42,0.5)' : 'rgba(255,255,255,0.7)', paddingHorizontal: 13, paddingVertical: 11, marginBottom: 8 }}>
                  <FontAwesome5 name={on ? 'check-circle' : 'circle'} size={15} color={on ? '#D4AF37' : isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>{m.title}</T>
                    <T v="caption" style={{ fontSize: 9.5, color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)', marginTop: 1 }}>{m.sub}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <UploadRow icon="file-alt" title="Proof of qualifications" sub="Certificate, ijazah or degree image" name={proofName} onPick={() => pickUpload('proof')} onClear={() => setProofName(null)} required={method === 'documents'} />
          <UploadRow icon="envelope-open-text" title="Recommendation letter" sub="From a recognized scholar or organization" name={letterName} onPick={() => pickUpload('letter')} onClear={() => setLetterName(null)} required={method === 'letter'} />

          <View style={{ marginBottom: 13 }}>
            <Label>Links to dawah platforms</Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)', backgroundColor: isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)', paddingHorizontal: 12, height: 42, justifyContent: 'center' }}>
                <TextInput value={linkDraft} onChangeText={setLinkDraft} placeholder="youtube.com/@yourdawah…" placeholderTextColor={isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'} autoCapitalize="none" style={{ fontFamily: 'Poppins-Medium', fontSize: 13.5, color: isDark ? '#F2F7F3' : '#14241C', paddingVertical: 0 }} />
              </View>
              <Pressable onPress={() => { if (linkDraft.trim()) { haptic.light(); setLinks((l) => [...l, linkDraft.trim()]); setLinkDraft(''); } }} style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="plus" size={13} color="#fff" />
              </Pressable>
            </View>
            {links.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                {links.map((l, i) => (
                  <View key={`${l}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(91,200,245,0.45)', backgroundColor: 'rgba(91,200,245,0.09)', paddingHorizontal: 10, paddingVertical: 5 }}>
                    <FontAwesome5 name="link" size={9} color="#5BC8F5" />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#F2F7F3' : '#14241C', maxWidth: 170 }} numberOfLines={1}>{l}</T>
                    <Pressable hitSlop={8} onPress={() => { haptic.light(); setLinks((ls) => ls.filter((_, j) => j !== i)); }}><FontAwesome5 name="times" size={9} color="#FF7B7B" /></Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

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
            onVerified={() => { setOtpEmail(null); router.replace('/(tabs)'); }}
            onCancel={() => { setOtpEmail(null); router.replace('/(tabs)'); }}
          />
        </Modal>
      ) : null}
    </>
  );
}
