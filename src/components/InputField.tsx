import { useState, type ComponentType } from 'react';
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { EyeIcon, EyeOffIcon } from '@/components/Icons';

/**
 * DeenLink text field: label above, leading icon, optional show/hide
 * for passwords, inline error state.
 */
export function InputField({
  label,
  value,
  onChangeText,
  icon,
  secure = false,
  error,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  returnKeyType = 'next',
  onEndEditing,
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  icon?: ComponentType<{ size?: number; color?: string }>;
  secure?: boolean;
  error?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  returnKeyType?: 'default' | 'next' | 'done';
  onEndEditing?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, isDark } = useTheme();
  const [show, setShow] = useState(false);
  const Icon = icon;

  return (
    <View style={style}>
      {label ? <T v="meta" uppercase style={{ marginBottom: 7 }}>{label}</T> : null}
      <View
        style={{
          position: 'relative',
          borderRadius: 14,
          borderWidth: 1.2,
          borderColor: error ? theme.danger : theme.border,
          backgroundColor: isDark ? '#0A1B14' : '#FAF8F2',
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.subtext}
          secureTextEntry={secure && !show}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onEndEditing={onEndEditing}
          style={{
            fontFamily: 'Poppins-Medium',
            fontSize: 14,
            fontWeight: '500',
            color: theme.text,
            paddingLeft: icon ? 44 : 15,
            paddingRight: secure ? 44 : 15,
            paddingVertical: 13,
          }}
        />
        {Icon ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 14, top: 13 }}>
            <Icon size={17} color={theme.subtext} />
          </View>
        ) : null}
        {secure ? (
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} style={{ position: 'absolute', right: 14, top: 13 }}>
            {show ? <EyeOffIcon size={17} color={theme.subtext} /> : <EyeIcon size={17} color={theme.subtext} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <T v="caption" color="danger" style={{ marginTop: 6 }}>{error}</T> : null}
    </View>
  );
}
