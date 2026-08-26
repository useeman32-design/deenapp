import { Text, View } from 'react-native';
import { formatGregorian, formatHijri, HIJRI_WEEKDAYS, hijriDate } from '@/lib/prayer';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

const HOLIDAYS = [
  { title: 'Eid al-Adha 1447', hijri: '10 Dhu al-Hijjah 1447', date: new Date('2026-05-27T00:00:00') },
  { title: 'Hijri New Year 1448', hijri: '1 Muharram 1448', date: new Date('2026-06-26T00:00:00') },
  { title: 'Prophet’s Birthday (Mawlid)', hijri: '12 Rabi al-Awwal 1448', date: new Date('2026-08-25T00:00:00') },
  { title: 'Laylat al-Qadr (est.)', hijri: '27 Ramadan 1448', date: new Date('2027-03-09T00:00:00') },
  { title: 'Eid al-Fitr 1448', hijri: '1 Shawwal 1448', date: new Date('2027-03-20T00:00:00') },
];

export default function CalendarScreen() {
  const { theme } = useTheme();
  const now = new Date();
  const h = hijriDate(now);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Islamic Calendar" />
      <View style={{ padding: 16 }}>
        <Card style={{ backgroundColor: theme.primary, borderColor: 'transparent', alignItems: 'center', paddingVertical: 26 }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' }}>
            {HIJRI_WEEKDAYS[h.weekday].toUpperCase()}
          </Text>
          <Text style={{ fontFamily: 'Poppins-Bold', color: '#fff', fontSize: 29, fontWeight: '800', marginTop: 6 }}>{formatHijri(now)}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 8 }}>{formatGregorian(now)}</Text>
        </Card>

        <Text style={{ fontSize: 15.5, fontWeight: '800', color: theme.text, marginTop: 22, marginBottom: 10 }}>
          Hijri Holidays
        </Text>
        {HOLIDAYS.map((ev) => {
          const days = Math.ceil((ev.date.getTime() - now.getTime()) / 86400000);
          return (
            <Card key={ev.title} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{ev.title}</Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>{ev.hijri}</Text>
              </View>
              <View
                style={{
                  backgroundColor: days >= 0 ? theme.primarySoft : 'transparent',
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: days >= 0 ? 'transparent' : theme.border,
                }}
              >
                <Text style={{ color: days >= 0 ? theme.primary : theme.subtext, fontWeight: '800', fontSize: 12 }}>
                  {days > 0 ? `in ${days}d` : days === 0 ? 'today' : 'passed'}
                </Text>
              </View>
            </Card>
          );
        })}
        <Text style={{ color: theme.subtext, fontSize: 11.5, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
          Dates are approximate (Umm al-Qura) — confirm locally by moon sighting. Syncs with your /calendar API
          when wired.
        </Text>
      </View>
    </View>
  );
}
