import { Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

/**
 * LanguageUnavailable — pass 104.
 *
 * The owner's instruction: "every place that we have language picker if a
 * certain language is not available just show not available instead of faking
 * it."
 *
 * Before this, three separate screens each failed that test in their own way:
 *  - the Qur'an reader caught a failed translation-pack load and set an empty
 *    map, so the pill still read "UR" while only Arabic rendered;
 *  - the prophet histories offered an EN/HA pill for all 51 prophets when only
 *    26 have any Hausa content, so HA produced an empty card headed
 *    "TAUSAYIN LABARI (HAUSA)" with nothing in it;
 *  - per-ayah gaps rendered literally nothing, indistinguishable from a bug.
 *
 * One shared panel keeps the wording and look identical everywhere, so "not
 * available" always means the same thing to the reader.
 */

/** Human-readable language names, incl. the ones only known by code. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ha: 'Hausa',
  yo: 'Yorùbá',
  fr: 'Français',
  bn: 'বাংলা',
  ur: 'اردو',
  ar: 'Arabic',
};

export function languageName(idOrName: string): string {
  return LANGUAGE_NAMES[idOrName] ?? idOrName;
}

type Props = {
  /** Language id ('ha') or a display name ('Hausa'). */
  language: string;
  /** What the language is missing for — "this surah", "this prophet", "this book". */
  scope?: string;
  /** True when the content may exist but could not be fetched right now. */
  loadFailed?: boolean;
  /** Optional way out, e.g. switch back to English. */
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

export function LanguageUnavailable({
  language,
  scope,
  loadFailed = false,
  actionLabel,
  onAction,
  compact = false,
}: Props) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const name = languageName(language);
  const tint = '#E8C96A';

  const title = loadFailed
    ? `${name} could not be loaded`
    : `${name} is not available${scope ? ` for ${scope}` : ''}`;

  const body = loadFailed
    ? 'The translation pack did not download. Check your connection and try again — your other languages are unaffected.'
    : `We do not have a ${name} translation here yet. Rather than show you the wrong language or an empty page, nothing is substituted.`;

  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <FontAwesome5 name="language" size={9} color={d.faint as string} />
        <T v="caption" style={{ fontSize: 9.5, color: d.faint, fontStyle: 'italic' }}>
          {loadFailed ? `${name} failed to load` : `No ${name} here`}
        </T>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(232,201,102,0.30)' : 'rgba(232,201,102,0.45)',
        backgroundColor: isDark ? 'rgba(232,201,102,0.07)' : 'rgba(232,201,102,0.06)',
        padding: 15,
        gap: 9,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            backgroundColor: `${tint}1f`,
            borderWidth: 1,
            borderColor: `${tint}44`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FontAwesome5 name="language" size={12} color={tint} />
        </View>
        <T v="bodyS" style={{ flex: 1, fontSize: 13, fontWeight: '900', color: d.text }}>
          {title}
        </T>
      </View>

      <T v="caption" style={{ fontSize: 11.5, color: d.subtext, lineHeight: 17 }}>
        {body}
      </T>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.16)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)',
            paddingHorizontal: 13,
            paddingVertical: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <FontAwesome5 name="exchange-alt" size={10} color={tint} />
          <T v="bodyS" style={{ fontSize: 11.5, fontWeight: '800', color: d.text }}>
            {actionLabel}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Small dimmed marker for a picker option that has no content. Keeps the option
 * visible — so the reader learns the language exists but is not covered here —
 * while making it obvious it will not deliver anything.
 */
export function UnavailableDot({ color = '#E8C96A' }: { color?: string }) {
  return (
    <View
      style={{
        width: 5,
        height: 5,
        borderRadius: 99,
        backgroundColor: color,
        opacity: 0.85,
        marginLeft: 3,
        marginTop: -6,
      }}
    />
  );
}

export default LanguageUnavailable;
