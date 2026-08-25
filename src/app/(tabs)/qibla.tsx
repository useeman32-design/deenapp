import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { KAABA, distanceKm, qiblaDirection } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { Compass } from '@/components/Compass';
import { GradientButton } from '@/components/GradientButton';
import { TopBar } from '@/components/TopBar';
import { CheckCircleIcon, GearIcon, PinIcon } from '@/components/Icons';

export default function Qibla() {
  const { theme } = useTheme();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [aligned, setAligned] = useState(false);

  useEffect(() => {
    resolveLocation().then((l) => {
      setLoc(l);
      setAligned(false);
    });
  }, []);

  if (!loc) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.subtext, fontSize: 13 }}>Locating you…</Text>
      </View>
    );
  }

  const bearing = qiblaDirection(loc);
  const km = distanceKm(loc, KAABA);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        title="Qibla Finder"
        right={
          <View>
            <GearIcon size={20} color={theme.subtext} />
          </View>
        }
      />
      <View style={{ alignItems: 'center', padding: 18, paddingTop: 22 }}>
        <Text style={{ color: theme.heading, fontSize: 32, fontWeight: '800' }}>
          {aligned ? '0°' : `${Math.round(bearing)}°`}
        </Text>
        <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 3 }}>
          {aligned ? 'Aligned' : 'from North'}
        </Text>

        <View style={{ marginTop: 16 }}>
          <Compass bearing={bearing} aligned={aligned} size={246} />
        </View>

        {aligned ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <CheckCircleIcon size={18} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 15 }}>You are facing the Qibla</Text>
          </View>
        ) : (
          <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 14, textAlign: 'center', lineHeight: 18 }}>
            Rotate your phone slowly until the green needle points up
          </Text>
        )}

        <GradientButton
          label={aligned ? 'Done' : 'Check Alignment'}
          onPress={() => setAligned((a) => !a)}
          style={{ width: '100%', marginTop: 18 }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary }} />
          <Text style={{ color: theme.subtext, fontSize: 11.5 }}>Accuracy: High</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 18, marginTop: 6 }}>
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <PinIcon size={18} color={theme.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 11 }}>
              <Text style={{ color: theme.heading, fontWeight: '800', fontSize: 13.5 }}>Kaaba</Text>
              <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 2 }}>Makkah, Saudi Arabia</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: theme.heading, fontWeight: '800', fontSize: 13.5 }}>{loc.name}</Text>
              <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 2 }}>Your location</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: theme.subtext, fontSize: 12.5 }}>Distance to the Kaaba</Text>
            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 13.5 }}>
              {Math.round(km).toLocaleString()} km
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
