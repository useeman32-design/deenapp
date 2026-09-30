import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string, fallback: Date): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return fallback;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function dateBounds(): { minimum: Date; maximum: Date } {
  const today = new Date();
  const maximum = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate(), 12, 0, 0, 0);
  const minimum = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate(), 12, 0, 0, 0);
  return { minimum, maximum };
}

function displayDate(value: string): string {
  const { maximum } = dateBounds();
  const date = parseIsoDate(value, maximum);
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

export function DateOfBirthPicker({
  value,
  onChange,
  error,
  hint = 'Used for your age in the app — never shown on your profile.',
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  const { isDark, theme } = useTheme();
  const d = theme.dash;
  const [open, setOpen] = useState(false);
  const bounds = useMemo(dateBounds, []);
  const [draft, setDraft] = useState(() => parseIsoDate(value, bounds.maximum));
  const text = isDark ? '#F2F7F3' : '#14241C';
  const muted = isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)';
  const border = d.cardBorder;
  const background = isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)';

  const openPicker = () => {
    haptic.selection();
    setDraft(parseIsoDate(value, bounds.maximum));
    setOpen(true);
  };

  const selectNativeDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (!selected) return;
    setDraft(selected);
    if (Platform.OS === 'android') {
      onChange(isoDate(selected));
      setOpen(false);
    }
  };

  const webInputStyle = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: text,
    fontSize: 14,
    fontFamily: 'inherit',
    padding: 0,
  } as unknown as React.CSSProperties;

  return (
    <View style={{ marginBottom: 13 }}>
      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: muted, marginBottom: 6 }}>
        DATE OF BIRTH
      </T>

      {Platform.OS === 'web' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: border, backgroundColor: background, paddingHorizontal: 14, height: 50 }}>
          <FontAwesome5 name="birthday-cake" size={14} color={muted} />
          <input
            type="date"
            value={value}
            min={isoDate(bounds.minimum)}
            max={isoDate(bounds.maximum)}
            aria-label="Date of birth"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
            style={webInputStyle}
          />
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Date of birth"
          onPress={openPicker}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: border, backgroundColor: background, paddingHorizontal: 14, height: 50 }}
        >
          <FontAwesome5 name="birthday-cake" size={14} color={muted} />
          <T v="bodyS" style={{ flex: 1, fontSize: 14, color: value ? text : muted, fontWeight: value ? '600' : '500' }}>
            {value ? displayDate(value) : 'Select your date of birth'}
          </T>
          <FontAwesome5 name="calendar-alt" size={14} color={muted} />
        </Pressable>
      )}

      {hint ? <T v="caption" style={{ fontSize: 10.5, color: muted, marginTop: 5 }}>{hint}</T> : null}
      {error ? <T v="caption" style={{ color: '#FF9B6A', fontSize: 11.5, marginTop: 4 }}>{error}</T> : null}

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          minimumDate={bounds.minimum}
          maximumDate={bounds.maximum}
          onChange={selectNativeDate}
        />
      ) : null}

      {Platform.OS === 'ios' && open ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,7,5,0.55)' }} onPress={() => setOpen(false)}>
            <Pressable onStartShouldSetResponder={() => true} style={{ backgroundColor: isDark ? '#07140D' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <T v="h3" style={{ color: text, fontWeight: '800' }}>Select your date of birth</T>
                <Pressable onPress={() => setOpen(false)} hitSlop={10}><FontAwesome5 name="times" size={15} color={muted} /></Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={bounds.minimum}
                maximumDate={bounds.maximum}
                themeVariant={isDark ? 'dark' : 'light'}
                textColor={text}
                accentColor={isDark ? '#4AE38F' : '#1D6F42'}
                onChange={selectNativeDate}
                style={{ alignSelf: 'stretch' }}
              />
              <Pressable onPress={() => { onChange(isoDate(draft)); setOpen(false); }} style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', height: 46, marginTop: 8 }}>
                <T v="bodyS" style={{ color: isDark ? '#062118' : '#FFFFFF', fontWeight: '900' }}>Use this date</T>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
