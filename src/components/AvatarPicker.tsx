import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { MALE_AVATARS_ITEMS, FEMALE_AVATARS_ITEMS, type AvatarItem } from '@/data/avatars';

/* pass 94b — WEB-FIRST: the server library (/img/profile/…) only exists once the
 * API repo is deployed, so on the web preview every tile was a blank box. The
 * same images are bundled in the app, so the grid renders the BUNDLED picture
 * and the tap still records the server path (avatar_path) — nothing looks broken
 * before the deploy, and the server copy takes over afterwards. */
const BY_NAME = new Map<string, AvatarItem>(
  [...MALE_AVATARS_ITEMS, ...FEMALE_AVATARS_ITEMS].map((a) => [a.name, a]),
);
function bundledFor(url: string): AvatarItem | undefined {
  if (!url) return undefined;
  const name = decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');
  return BY_NAME.get(name);
}
import { profileAvatars, selectProfileAvatar, type ProfileAvatar } from '@/api/client';

/** Gendered default avatars — male silhouette / female hijab (inline SVG, no network).
 * pass 83-27 — react-native-svg primitives (raw lowercase svg DOM tags crash Expo Go
 * native: "View config getter callback for component circle must be a function"). */
export function DefaultAvatar({ gender, size = 96 }: { gender?: string | null; size?: number }) {
  const female = (gender ?? '').toLowerCase().startsWith('f');
  const bg = female ? '#F3D9E4' : '#D8E6F3';
  const fg = female ? '#8C4A6B' : '#33556E';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {female ? (
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* hijab */}
          <Path d="M50 16c-16 0-27 12-27 28 0 10 3 17 3 24 0 8-4 12-4 16h56c0-4-4-8-4-16 0-7 3-14 3-24 0-16-11-28-27-28z" fill={fg} />
          <Circle cx="50" cy="44" r="15" fill="#F6E2D5" />
          <Path d="M35 40c0-10 7-17 15-17s15 7 15 17c0 3-1 5-1 5 0-9-6-14-14-14s-14 5-14 14c0 0-1-2-1-5z" fill={fg} />
          <Circle cx="44" cy="45" r="1.8" fill="#3A2A2A" />
          <Circle cx="56" cy="45" r="1.8" fill="#3A2A2A" />
          <Path d="M46 53q4 3 8 0" stroke="#3A2A2A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </Svg>
      ) : (
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* male silhouette */}
          <Circle cx="50" cy="38" r="17" fill={fg} />
          <Path d="M22 88c0-16 13-26 28-26s28 10 28 26z" fill={fg} />
          <Circle cx="44" cy="37" r="2" fill="#fff" />
          <Circle cx="56" cy="37" r="2" fill="#fff" />
        </Svg>
      )}
    </View>
  );
}

/** What the picker hands back: a library image (bundle + server path), a plain
 *  URL from the server list, or null for the gendered default. */
export type AvatarPick =
  | { kind: 'default' }
  | { kind: 'library'; item: AvatarItem }
  | { kind: 'server'; url: string };

type Props = {
  visible: boolean;
  gender?: string | null;
  /** currently saved URL, so the right tile shows as selected */
  selectedUrl?: string | null;
  onClose: () => void;
  onSelect: (pick: AvatarPick) => void;
  /** the "upload from gallery" row; hidden when the screen cannot upload */
  onPickFromGallery?: () => void;
};

export function AvatarPicker({ visible, gender, selectedUrl, onClose, onSelect, onPickFromGallery }: Props) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const g = (gender ?? '').toLowerCase();
  const isFemale = g.startsWith('f');
  const isMale = g.startsWith('m');
  /* pass 50 — a male account sees only male avatars, a female account only
   * female avatars. The tab switcher is shown only when gender is unknown. */
  const locked = isFemale || isMale;
  const startTab = isFemale ? 'female' : 'male';
  const [tab, setTab] = useState<'male' | 'female'>(startTab);
  const [remote, setRemote] = useState<ProfileAvatar[] | null>(null);
  const [remoteBusy, setRemoteBusy] = useState<number | null>(null);
  useEffect(() => {
    if (!visible) return;
    profileAvatars(gender || undefined)
      .then((rows) => setRemote(rows && rows.length ? rows : null))
      .catch(() => setRemote(null));
  }, [visible, gender]);
  const list = useMemo(
    () => (locked ? (isFemale ? FEMALE_AVATARS_ITEMS : MALE_AVATARS_ITEMS) : tab === 'male' ? MALE_AVATARS_ITEMS : FEMALE_AVATARS_ITEMS),
    [locked, isFemale, tab],
  );
  const defaultOn = !selectedUrl;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.62)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ maxHeight: '84%', backgroundColor: isDark ? '#0C1712' : '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: d.cardBorder, padding: 16, paddingBottom: 28 }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
          </View>
          <T v="h3" style={{ fontWeight: '800', fontSize: 16, color: d.text, marginBottom: 4 }}>Choose an avatar</T>
          <T v="caption" style={{ color: d.faint, fontSize: 11, marginBottom: 12 }}>Pick a profile picture, or use your default.</T>

          {/* default option */}
          <Pressable
            onPress={() => { haptic.selection(); onSelect({ kind: 'default' }); onClose(); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: defaultOn ? 'rgba(212,175,55,0.6)' : d.cardBorder, backgroundColor: defaultOn ? 'rgba(212,175,55,0.1)' : d.card, marginBottom: 12 }}
          >
            <DefaultAvatar gender={gender} size={44} />
            <View style={{ flex: 1 }}>
              <T v="body" style={{ fontWeight: '700', fontSize: 13, color: d.text }}>Use default avatar</T>
              <T v="caption" style={{ color: d.faint, fontSize: 10.5 }}>{isFemale ? 'Hijab avatar' : 'Male avatar'}</T>
            </View>
            {defaultOn ? <FontAwesome5 name="check-circle" size={16} color="#E8C96A" /> : null}
          </Pressable>

          {/* gallery (owner: "local Image adding from gallery") */}
          {onPickFromGallery ? (
            <Pressable
              onPress={() => { haptic.selection(); onClose(); onPickFromGallery(); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, marginBottom: 12 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212,175,55,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="image" size={16} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="body" style={{ fontWeight: '700', fontSize: 13, color: d.text }}>Upload from gallery</T>
                <T v="caption" style={{ color: d.faint, fontSize: 10.5 }}>Use a photo from this device</T>
              </View>
              {remoteBusy === -1 ? <ActivityIndicator size="small" color="#E8C96A" /> : <FontAwesome5 name="chevron-right" size={12} color={d.faint} />}
            </Pressable>
          ) : null}

          {/* tabs — only when we don't know the account's gender */}
          {!locked && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['male', 'female'] as const).map((t) => {
                const on = tab === t;
                return (
                  <Pressable key={t} onPress={() => { haptic.selection(); setTab(t); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: on ? 'rgba(212,175,55,0.6)' : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.12)' : d.card, alignItems: 'center' }}>
                    <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: on ? '#E8C96A' : d.subtext, textTransform: 'capitalize' }}>{t}</T>
                  </Pressable>
                );
              })}
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {remote
                ? remote.map((avatar) => {
                    const on = selectedUrl === avatar.url;
                    const local = bundledFor(avatar.url);
                    return (
                      <Pressable
                        key={avatar.id}
                        disabled={remoteBusy === avatar.id}
                        onPress={async () => {
                          haptic.selection();
                          setRemoteBusy(avatar.id);
                          const result = await selectProfileAvatar(avatar.id);
                          setRemoteBusy(null);
                          if (result.ok && result.url) onSelect({ kind: 'server', url: result.url });
                          else onSelect({ kind: 'server', url: avatar.url });
                          onClose();
                        }}
                        style={{ width: 74, height: 74, borderRadius: 37, overflow: 'hidden', borderWidth: 2, borderColor: on ? '#E8C96A' : avatar.locked ? '#B8870B' : 'transparent', backgroundColor: d.card, opacity: remoteBusy === avatar.id ? 0.55 : 1 }}
                      >
                        <ExpoImage source={local ? local.src : { uri: avatar.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        <View style={{ position: 'absolute', right: 2, bottom: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: avatar.locked ? '#B8870B' : '#1D6F42', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesome5 name={avatar.locked ? 'lock' : 'check'} size={9} color="#fff" />
                        </View>
                        {remoteBusy === avatar.id ? (
                          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                            <ActivityIndicator color="#fff" />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                : list.map((item, i) => {
                    const on = !!selectedUrl && selectedUrl.includes(item.name);
                    return (
                      <Pressable key={i} onPress={() => { haptic.selection(); onSelect({ kind: 'library', item }); onClose(); }} style={{ width: 74, height: 74, borderRadius: 37, overflow: 'hidden', borderWidth: 2, borderColor: on ? '#E8C96A' : 'transparent', backgroundColor: d.card }}>
                        <ExpoImage source={item.src} style={{ width: '100%', height: '100%', backgroundColor: d.card }} contentFit="cover" transition={200} />
                      </Pressable>
                    );
                  })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
