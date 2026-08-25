import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { KAABA, distanceKm, qiblaDirection } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { Compass } from '@/components/Compass';
import { GradientButton } from '@/components/GradientButton';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { RouteMap } from '@/components/RouteMap';
import { CheckCircleIcon, GearIcon } from '@/components/Icons';

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
        <T v="caption">Locating you…</T>
      </View>
    );
  }

  const bearing = qiblaDirection(loc);
  const km = distanceKm(loc, KAABA);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        title="Qibla finder"
        right={
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <GearIcon size={17} color={theme.subtext} />
          </View>
        }
      />
      <View style={{ alignItems: 'center', padding: 18, paddingTop: 10 }}>
        <T v="display" style={{ fontSize: 36 }}>
          {aligned ? '0°' : `${Math.round(bearing)}°`}
        </T>
        <T v="caption" style={{ marginTop: 3 }}>
          {aligned ? 'Aligned' : 'from North'}
        </T>

        <View style={{ marginTop: 14 }}>
          <Compass bearing={bearing} aligned={aligned} size={240} />
        </View>

        {aligned ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
              backgroundColor: theme.primarySoft,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 9,
            }}
          >
            <CheckCircleIcon size={17} color={theme.primary} />
            <T v="bodyS" color="primary" style={{ fontWeight: '700' }}>
              You are facing the Qibla
            </T>
          </View>
        ) : (
          <T v="caption" style={{ marginTop: 14, textAlign: 'center', lineHeight: 18 }}>
            Rotate your phone slowly until the needle points up
          </T>
        )}

        <GradientButton
          label={aligned ? 'Done' : 'Check alignment'}
          onPress={() => setAligned((a) => !a)}
          style={{ width: '100%', marginTop: 18 }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary }} />
          <T v="caption">Accuracy: High</T>
        </View>
      </View>

      <View style={{ paddingHorizontal: 18, marginTop: 8 }}>
        <T v="h3" style={{ marginBottom: 10 }}>Direction to Makkah</T>
        <RouteMap distanceKm={km} fromName={loc.name} bearing={bearing} />
      </View>
    </View>
  );
}
