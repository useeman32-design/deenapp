import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { MALE_AVATARS, FEMALE_AVATARS } from '@/data/avatars';

/** Gendered default avatars — male silhouette / female hijab (inline SVG, no network). */
export function DefaultAvatar({ gender, size = 96 }: { gender?: string | null; size?: number }) {
  const female = (gender ?? '').toLowerCase().startsWith('f');
  const bg = female ? '#F3D9E4' : '#D8E6F3';
  const fg = female ? '#8C4A6B' : '#33556E';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {female ? (
        <svg width={size} height={size} viewBox="0 0 100 100">
          {/* hijab */}
          <path d="M50 16c-16 0-27 12-27 28 0 10 3 17 3 24 0 8-4 12-4 16h56c0-4-4-8-4-16 0-7 3-14 3-24 0-16-11-28-27-28z" fill={fg} />
          <circle cx="50" cy="44" r="15" fill="#F6E2D5" />
          <path d="M35 40c0-10 7-17 15-17s15 7 15 17c0 3-1 5-1 5 0-9-6-14-14-14s-14 5-14 14c0 0-1-2-1-5z" fill={fg} />
          <circle cx="44" cy="45" r="1.8" fill="#3A2A2A" />
          <circle cx="56" cy="45" r="1.8" fill="#3A2A2A" />
          <path d="M46 53q4 3 8 0" stroke="#3A2A2A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 100 100">
          {/* male silhouette */}
          <circle cx="50" cy="38" r="17" fill={fg} />
          <path d="M22 88c0-16 13-26 28-26s28 10 28 26z" fill={fg} />
          <circle cx="44" cy="37" r="2" fill="#fff" />
          <circle cx="56" cy="37" r="2" fill="#fff" />
        </svg>
      )}
    </View>
  );
}

type Props = {
  visible: boolean;
  gender?: string | null;
  selected?: string | number | null;
  onClose: () => void;
  /** source = a require()d avatar, or null to use the gendered default */
  onSelect: (source: number | null) => void;
};

export function AvatarPicker({ visible, gender, selected, onClose, onSelect }: Props) {
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
  const list = useMemo(
    () => (locked ? (isFemale ? FEMALE_AVATARS : MALE_AVATARS) : (tab === 'male' ? MALE_AVATARS : FEMALE_AVATARS)),
    [locked, isFemale, tab],
  );

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
            onPress={() => { haptic.selection(); onSelect(null); onClose(); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: selected == null ? 'rgba(212,175,55,0.6)' : d.cardBorder, backgroundColor: selected == null ? 'rgba(212,175,55,0.1)' : d.card, marginBottom: 12 }}
          >
            <DefaultAvatar gender={gender} size={44} />
            <View style={{ flex: 1 }}>
              <T v="body" style={{ fontWeight: '700', fontSize: 13, color: d.text }}>Use default avatar</T>
              <T v="caption" style={{ color: d.faint, fontSize: 10.5 }}>{(gender ?? '').toLowerCase().startsWith('f') ? 'Hijab avatar' : 'Male avatar'}</T>
            </View>
            {selected == null ? <FontAwesome5 name="check-circle" size={16} color="#E8C96A" /> : null}
          </Pressable>

          {/* tabs — only when we don't know the account's gender */}
          {!locked && <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['male', 'female'] as const).map((t) => {
              const on = tab === t;
              return (
                <Pressable key={t} onPress={() => { haptic.selection(); setTab(t); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: on ? 'rgba(212,175,55,0.6)' : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.12)' : d.card, alignItems: 'center' }}>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: on ? '#E8C96A' : d.subtext, textTransform: 'capitalize' }}>{t}</T>
                </Pressable>
              );
            })}
          </View>}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {list.map((src, i) => {
                const on = selected === src;
                return (
                  <Pressable
                    key={i}
                    onPress={() => { haptic.selection(); onSelect(src); onClose(); }}
                    style={{ width: 74, height: 74, borderRadius: 37, overflow: 'hidden', borderWidth: 2, borderColor: on ? '#E8C96A' : 'transparent', backgroundColor: d.card }}
                  >
                    <ExpoImage source={src} style={{ width: '100%', height: '100%', backgroundColor: d.card }} contentFit="cover" transition={200} />
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
