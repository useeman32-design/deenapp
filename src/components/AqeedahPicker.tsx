import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { aqeedahOptions, type AqeedahOption } from '@/api/client';

/* ── pass 94 — ONE aqeedah list, shared by registration and Edit profile ──────
 *
 * The owner: "make it display the listing of aqeedah just like how it is in the
 * registrations page, the aqeedah name and its explanation … both the
 * registrations and edit profile will share same thing." So there is exactly one
 * component and exactly one source: the admin's list (Admin → Aqeedah &
 * Security) served by /api/aqeedah/list.php. The bundled copy below is only the
 * offline fallback — the same five options the app shipped with, so a device
 * with no network still sees a full picker.
 */

export const BUNDLED_AQEEDAH: AqeedahOption[] = [
  {
    id: -1,
    name: 'Sunni',
    description:
      'Ahlus-Sunnah wal-Jama\u2019ah — the Qur\u2019an, the Sunnah and the way of the righteous predecessors.',
    description_ng:
      'Ahlus-Sunnah wal-Jama\u2019ah — the Qur\u2019an, the Sunnah and the way of the righteous predecessors. Izala and Salafiyya fall under Sunni.',
  },
  {
    id: -2,
    name: 'Sufi',
    description: 'Tasawwuf — purifying the heart and soul. Tijaniyya and Qadiriyya fall here.',
    description_ng: '',
  },
  {
    id: -3,
    name: 'Shia',
    description:
      'The school of the Ahl al-Bayt — belief in the Imamate and the leadership of the Prophet\u2019s \uFDFA household after him.',
    description_ng: '',
  },
  {
    id: -4,
    name: 'Athari',
    description: 'The creed of the salaf — affirmation of the texts without speculative interpretation.',
    description_ng: '',
  },
  {
    id: -5,
    name: 'Other',
    description: 'Describe your aqeedah in your own words (max 10 characters).',
    description_ng: '',
  },
];

/* one fetch per app run, shared by every screen that shows the picker */
let cache: AqeedahOption[] | null = null;
let inflight: Promise<AqeedahOption[] | null> | null = null;

export function useAqeedahOptions(): { options: AqeedahOption[]; fromServer: boolean } {
  const [options, setOptions] = useState<AqeedahOption[]>(cache ?? BUNDLED_AQEEDAH);
  const [fromServer, setFromServer] = useState<boolean>(!!cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    inflight = inflight ?? aqeedahOptions();
    inflight
      .then((list) => {
        if (!list || !list.length) return;
        cache = list;
        if (alive) {
          setOptions(list);
          setFromServer(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
    return () => {
      alive = false;
    };
  }, []);
  return { options, fromServer };
}

/** The one option that must stay last and must ask for the user's own wording. */
export const isOtherOption = (name: string) => name.trim().toLowerCase() === 'other';

export function AqeedahPicker({
  value,
  other,
  setValue,
  setOther,
  nigeria,
  options,
  showDescriptions = true,
  lockedUntil = null,
}: {
  value: string;
  other: string;
  setValue: (v: string) => void;
  setOther: (v: string) => void;
  nigeria: boolean;
  options: AqeedahOption[];
  /** pass 96 — registration shows the explanation under each name; Edit profile
   *  shows the names only (owner: "the aqeedah section in edit profile remove
   *  that description that you added"). */
  showDescriptions?: boolean;
  /** pass 96 — when the member already changed his aqeedah inside the last
   *  week, the list is shown but not tappable, and the reason is stated with
   *  the exact date it opens again. */
  lockedUntil?: string | null;
}) {
  const { isDark } = useTheme();
  const locked = !!lockedUntil;
  const lockedDate = locked
    ? new Date(String(lockedUntil).replace(' ', 'T')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <View style={{ gap: 7 }}>
      {locked ? (
        <View
          style={{
            borderRadius: 13,
            borderWidth: 1,
            borderColor: 'rgba(232,201,106,0.55)',
            backgroundColor: isDark ? 'rgba(232,201,106,0.08)' : 'rgba(212,175,55,0.08)',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <FontAwesome5 name="lock" size={11} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>
              Aqeedah changes once a week
            </T>
          </View>
          <T v="caption" style={{ fontSize: 10.5, lineHeight: 15, color: isDark ? 'rgba(242,247,243,0.7)' : 'rgba(20,36,28,0.7)', marginTop: 4 }}>
            You changed it recently. You can change it again on {lockedDate}.
          </T>
        </View>
      ) : null}
      {options.map((a) => {
        const on = value === a.name;
        const desc = nigeria && a.description_ng ? a.description_ng : a.description;
        return (
          <View key={`${a.id}-${a.name}`}>
            <Pressable
              accessibilityLabel={`aqeedah ${a.name}`}
              disabled={locked}
              onPress={() => {
                haptic.selection();
                setValue(a.name);
              }}
              style={{
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: on
                  ? isDark
                    ? '#4AE38F'
                    : '#1D6F42'
                  : isDark
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(20,36,28,0.14)',
                backgroundColor: on
                  ? isDark
                    ? 'rgba(46,204,113,0.12)'
                    : 'rgba(29,111,66,0.07)'
                  : isDark
                    ? 'rgba(2,59,42,0.5)'
                    : 'rgba(255,255,255,0.7)',
                paddingHorizontal: 13,
                paddingVertical: 10,
                opacity: locked && !on ? 0.5 : 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesome5
                  name={on ? 'check-circle' : 'circle'}
                  size={13}
                  color={on ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'}
                />
                <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C' }}>
                  {a.name}
                </T>
              </View>
              {showDescriptions && desc ? (
                <T
                  v="caption"
                  style={{
                    fontSize: 10.5,
                    lineHeight: 15.5,
                    color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(20,36,28,0.6)',
                    marginLeft: 21,
                    marginTop: 3,
                  }}
                >
                  {desc}
                </T>
              ) : null}
              {isOtherOption(a.name) && on ? (
                <TextInput
                  value={other}
                  editable={!locked}
                  onChangeText={(t) => setOther(t.slice(0, 40))}
                  placeholder="Your own aqeedah — up to 40 characters"
                  placeholderTextColor={isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)'}
                  maxLength={40}
                  style={{
                    marginLeft: 21,
                    marginTop: 8,
                    borderRadius: 11,
                    borderWidth: 1.5,
                    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(20,36,28,0.16)',
                    backgroundColor: isDark ? 'rgba(3,36,24,0.6)' : 'rgba(255,255,255,0.8)',
                    paddingHorizontal: 11,
                    height: 40,
                    fontFamily: 'Poppins-Medium',
                    fontSize: 14,
                    color: isDark ? '#F2F7F3' : '#14241C',
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
