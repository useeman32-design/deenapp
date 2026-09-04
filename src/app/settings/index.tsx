import { useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Share, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { DeenPointsBuyModal } from '@/components/DeenPoints';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const deenPointsLogo = require('../../../assets/img/deenpoints.png');

/**
 * Settings — every row now DOES something or opens its own sheet (user request).
 * Added: Join Premium + Socials. DeenPoints opens the buy modal; Share uses the
 * native share sheet; Notifications / Privacy / About / Premium / Socials each
 * open a real bottom sheet.
 */

const APP_VERSION = '1.0.0';
const SITE = 'https://useeman32-design.github.io/deenapp/';

/* Socials — the handles below are placeholders; update with the real DeenLink
 * profiles. Each opens in the browser / native app. */
const SOCIALS: Array<{ id: string; label: string; handle: string; icon: string; brand?: boolean; tint: string; url: string }> = [
  { id: 'x', label: 'X (Twitter)', handle: '@deenlink', icon: 'twitter', brand: true, tint: '#1DA1F2', url: 'https://x.com/deenlink' },
  { id: 'ig', label: 'Instagram', handle: '@deenlink', icon: 'instagram', brand: true, tint: '#E1306C', url: 'https://instagram.com/deenlink' },
  { id: 'fb', label: 'Facebook', handle: 'DeenLink', icon: 'facebook', brand: true, tint: '#1877F2', url: 'https://facebook.com/deenlink' },
  { id: 'yt', label: 'YouTube', handle: 'DeenLink', icon: 'youtube', brand: true, tint: '#FF0000', url: 'https://youtube.com/@deenlink' },
  { id: 'wa', label: 'WhatsApp', handle: 'DeenLink', icon: 'whatsapp', brand: true, tint: '#25D366', url: 'https://wa.me/' },
];

const PREMIUM_TIERS = [
  { id: 'm', label: 'Monthly', price: '₦1,500', per: '/month', note: 'Full premium access', best: false },
  { id: 'y', label: 'Yearly', price: '₦12,000', per: '/year', note: '2 months free', best: true },
];

export default function SettingsScreen() {
  const { theme, mode, setMode, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const deenpoints = (user?.deenpoints_balance as number) ?? 0;

  const [sheet, setSheet] = useState<null | 'premium' | 'notif' | 'privacy' | 'about' | 'socials'>(null);
  const [dpOpen, setDpOpen] = useState(false);
  const [notif, setNotif] = useState({ prayer: true, community: true, ai: false });
  const [priv, setPriv] = useState({ dm: true, showOnline: true, personalized: true });
  const [signOutOpen, setSignOutOpen] = useState(false);

  const persist = (key: string, val: unknown) => { storage.setItem(key, JSON.stringify(val)).catch(() => {}); };

  const shareApp = async () => {
    haptic.selection();
    try {
      await Share.share({ message: `DeenLink — your deen, connected. Qur'an, prayer, learning & a Muslim community. ${SITE}` });
    } catch {
      Alert.alert('Share', SITE);
    }
  };

  const Row = ({ icon, label, desc, tint, onPress, image }: { icon: string; label: string; desc: string; tint: string; onPress: () => void; image?: number }) => (
    <Pressable
      onPress={() => { haptic.selection(); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${tint}18`, borderWidth: 1, borderColor: `${tint}44`, alignItems: 'center', justifyContent: 'center' }}>
        {image ? <Image source={image} style={{ width: 20, height: 20 }} resizeMode="contain" /> : <FontAwesome5 name={icon as never} size={13} color={tint} />}
      </View>
      <View style={{ flex: 1 }}>
        <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13 }}>{label}</T>
        <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>{desc}</T>
      </View>
      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
    </Pressable>
  );

  const Divider = () => <View style={{ height: 1, backgroundColor: d.cardBorder, marginLeft: 60 }} />;

  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
    <Switch value={on} onValueChange={(v) => { haptic.selection(); onChange(v); }} trackColor={{ false: d.bgSoft, true: isDark ? '#1F8F5C' : '#1D6F42' }} thumbColor="#fff" />
  );

  const SettingToggleRow = ({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ flex: 1 }}>
        <T v="bodyS" style={{ fontSize: 13, fontWeight: '700', color: d.text }}>{label}</T>
        <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{desc}</T>
      </View>
      <Toggle on={on} onChange={onChange} />
    </View>
  );

  /* reusable bottom sheet */
  const Sheet = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: Math.max(insets.bottom, 24), maxHeight: '84%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <T v="h3" style={{ fontWeight: '800', flex: 1, color: d.text }}>{title}</T>
        <Pressable onPress={() => setSheet(null)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="times" size={12} color={d.subtext} />
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </View>
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
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>Settings</T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>Account, appearance & more</T>
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
            <T v="body" style={{ color: d.text, fontWeight: '800', fontSize: 13.5 }}>{(user?.full_name as string) || 'DeenLink User'}</T>
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>@{(user?.username as string) || 'deenlink_user'}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 }}>
            <Image source={deenPointsLogo} style={{ width: 13, height: 13 }} resizeMode="contain" />
            <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 11 }}>{deenpoints.toLocaleString()}</T>
          </View>
        </View>

        {/* settings list */}
        <View style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 18, overflow: 'hidden' }}>
          <Row icon="crown" label="Join Premium" desc="Ad-free, offline & exclusive tools" tint="#E8C96A" onPress={() => setSheet('premium')} />
          <Divider />
          <Row icon="moon" label="Appearance" desc={mode === 'dark' ? 'Dark mode on' : 'Light mode on'} tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={() => setMode((mode === 'dark' ? 'light' : 'dark') as ThemeMode)} />
          <Divider />
          <Row icon="user-edit" label="Edit Profile" desc="Name, bio, aqeedah & photo" tint="#5BC8F5" onPress={() => router.push('/settings/edit-profile')} />
          <Divider />
          <Row icon="gift" image={deenPointsLogo} label="DeenPoints" desc="Buy points & see your balance" tint={d.gold} onPress={() => setDpOpen(true)} />
          <Divider />
          <Row icon="bell" label="Notifications" desc="Prayer, community & AI alerts" tint="#E8C96A" onPress={() => setSheet('notif')} />
          <Divider />
          <Row icon="shield-alt" label="Privacy & Safety" desc="Messages, visibility & personalization" tint="#FF7B7B" onPress={() => setSheet('privacy')} />
          <Divider />
          <Row icon="share-alt" label="Share DeenLink" desc="Invite friends to the community" tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={shareApp} />
          <Divider />
          <Row icon="hashtag" label="Socials" desc="Follow DeenLink online" tint="#5BC8F5" onPress={() => setSheet('socials')} />
          <Divider />
          <Row icon="info-circle" label="About DeenLink" desc="Version & credits" tint={d.subtext as string} onPress={() => setSheet('about')} />
          <Divider />
          <Row icon="sign-out-alt" label="Sign out" desc="End session on this device" tint="#FF7B7B" onPress={() => setSignOutOpen(true)} />
        </View>

        <T v="caption" style={{ color: d.faint, textAlign: 'center', fontSize: 10, marginTop: 16 }}>
          DeenLink v{APP_VERSION} · made with ihsan
        </T>
      </ScrollView>

      {/* DeenPoints buy modal (reused) */}
      <DeenPointsBuyModal visible={dpOpen} onClose={() => setDpOpen(false)} />

      {/* PREMIUM */}
      <Modal visible={sheet === 'premium'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheet(null)} />
          <Sheet title="DeenLink Premium">
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.05)', padding: 15, marginBottom: 12 }}>
              <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.text, marginBottom: 8 }}>What you get</T>
              {['Ad-free experience', 'Offline Mushaf & audio', 'Exclusive wallpapers & tools', 'Priority AI answers', 'Premium badge on your profile'].map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                  <FontAwesome5 name="check-circle" size={11} color="#E8C96A" />
                  <T v="caption" style={{ fontSize: 11.5, color: d.subtext }}>{f}</T>
                </View>
              ))}
            </View>
            {PREMIUM_TIERS.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => { haptic.selection(); Alert.alert('Premium checkout', 'In-app purchases are coming soon. We will notify you when checkout opens.'); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1.5, borderColor: t.best ? 'rgba(212,175,55,0.6)' : d.cardBorder, backgroundColor: t.best ? (isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.05)') : 'transparent', padding: 14, marginBottom: 8 }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '800', color: d.text }}>{t.label}</T>
                    {t.best ? <View style={{ borderRadius: 6, backgroundColor: 'rgba(212,175,55,0.2)', paddingHorizontal: 6, paddingVertical: 1 }}><T v="caption" style={{ fontSize: 8, fontWeight: '900', color: '#E8C96A' }}>BEST</T></View> : null}
                  </View>
                  <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 2 }}>{t.note}</T>
                </View>
                <T v="bodyS" style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#E8C96A' : '#8C6D1F' }}>{t.price}<T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{t.per}</T></T>
              </Pressable>
            ))}
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 6 }}>Checkout opens soon. Premium never includes fatwas — those stay free with the scholars.</T>
          </Sheet>
        </View>
      </Modal>

      {/* NOTIFICATIONS */}
      <Modal visible={sheet === 'notif'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheet(null)} />
          <Sheet title="Notifications">
            <SettingToggleRow label="Prayer reminders" desc="Adhan & next-prayer alerts" on={notif.prayer} onChange={(v) => { const nx = { ...notif, prayer: v }; setNotif(nx); persist('dl.notif', nx); }} />
            <Divider />
            <SettingToggleRow label="Community alerts" desc="Replies, mentions & follows" on={notif.community} onChange={(v) => { const nx = { ...notif, community: v }; setNotif(nx); persist('dl.notif', nx); }} />
            <Divider />
            <SettingToggleRow label="DeenLink AI tips" desc="Occasional AI feature updates" on={notif.ai} onChange={(v) => { const nx = { ...notif, ai: v }; setNotif(nx); persist('dl.notif', nx); }} />
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 12, lineHeight: 14 }}>Prayer alerts play in-app when a prayer time enters. Background notifications arrive with the DeenLink mobile build.</T>
          </Sheet>
        </View>
      </Modal>

      {/* PRIVACY & SAFETY */}
      <Modal visible={sheet === 'privacy'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheet(null)} />
          <Sheet title="Privacy & Safety">
            <SettingToggleRow label="Allow direct messages" desc="Let others message you" on={priv.dm} onChange={(v) => { const nx = { ...priv, dm: v }; setPriv(nx); persist('dl.priv', nx); }} />
            <Divider />
            <SettingToggleRow label="Show online status" desc="Others can see when you're active" on={priv.showOnline} onChange={(v) => { const nx = { ...priv, showOnline: v }; setPriv(nx); persist('dl.priv', nx); }} />
            <Divider />
            <SettingToggleRow label="Personalized content" desc="Tailor feed & suggestions" on={priv.personalized} onChange={(v) => { const nx = { ...priv, personalized: v }; setPriv(nx); persist('dl.priv', nx); }} />
            <Pressable onPress={() => { haptic.selection(); Alert.alert('Blocked accounts', 'Manage blocked accounts from a profile’s report menu.'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder }}>
              <FontAwesome5 name="ban" size={13} color="#FF7B7B" />
              <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: d.text }}>Blocked accounts</T>
              <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
            </Pressable>
          </Sheet>
        </View>
      </Modal>

      {/* SOCIALS */}
      <Modal visible={sheet === 'socials'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheet(null)} />
          <Sheet title="Follow DeenLink">
            {SOCIALS.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => { haptic.selection(); Linking.openURL(s.url).catch(() => {}); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${s.tint}18`, borderWidth: 1, borderColor: `${s.tint}44`, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={s.icon as never} size={14} color={s.tint} brand={s.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ fontSize: 13, fontWeight: '700', color: d.text }}>{s.label}</T>
                  <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{s.handle}</T>
                </View>
                <FontAwesome5 name="external-link-alt" size={10} color={d.faint} />
              </Pressable>
            ))}
            <Pressable onPress={() => { haptic.selection(); Linking.openURL(SITE).catch(() => {}); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder }}>
              <FontAwesome5 name="globe" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: d.text }}>Visit the DeenLink website</T>
              <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
            </Pressable>
          </Sheet>
        </View>
      </Modal>

      {/* ABOUT */}
      <Modal visible={sheet === 'about'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheet(null)} />
          <Sheet title="About DeenLink">
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: isDark ? 'rgba(46,204,113,0.16)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <FontAwesome5 name="star-and-crescent" size={22} color={isDark ? '#4AE38F' : '#1D6F42'} />
              </View>
              <T v="h3" style={{ fontWeight: '900', color: d.text }}>DeenLink</T>
              <T v="caption" style={{ fontSize: 11, color: d.faint, marginTop: 2 }}>Version {APP_VERSION}</T>
              <T v="caption" style={{ fontSize: 11.5, color: d.subtext, textAlign: 'center', marginTop: 10, lineHeight: 18, paddingHorizontal: 8 }}>
                Strengthen your deen, every day — Qur'an, prayer, learning, tafsir and a Muslim community in one place.
              </T>
            </View>
            <Pressable onPress={() => { haptic.selection(); Linking.openURL(SITE).catch(() => {}); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder }}>
              <FontAwesome5 name="globe" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: d.text }}>Website & links</T>
              <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
            </Pressable>
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 12, lineHeight: 14 }}>Made with ihsan. Quran & tafsir texts via quranapi.pages.dev. For rulings, consult a qualified scholar.</T>
          </Sheet>
        </View>
      </Modal>
      <ConfirmDialog
        visible={signOutOpen}
        title="Log out?"
        message="Are you sure you want to log out of DeenLink on this device?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        tone="danger"
        icon="sign-out-alt"
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => { setSignOutOpen(false); logout(); try { router.dismissAll?.(); } catch {} router.replace('/(auth)/login'); }}
      />
    </View>
  );
}
