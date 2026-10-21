import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import {
  applyLocation,
  detectLocationChange,
  onLocationChange,
  refreshLocation,
  useCurrentGpsLocation,
  watchLocation,
  type Loc,
} from '@/lib/location';

/* ── pass 102 — CHANGE LOCATION ─────────────────────────────────────────────
 *
 * Owner: "Changing location to a new location showing a modal To change
 * location is not working currently in Kano but it's still showing Gusau."
 *
 * Root cause: lib/location.ts already had applyLocation(), detectLocationChange()
 * and watchLocation(), but NOTHING in the app ever called them. Both location
 * pills ran `resolveLocation()`, which returns the CACHED fix — so a member who
 * moved states kept seeing the old city permanently, with no way to change it.
 *
 * This adds the missing UI + a global host:
 *   · tapping the location pill opens this sheet
 *   · "Use my current location" forces a fresh GPS fix and reverse-geocodes it
 *   · a city search (Open-Meteo geocoding, no API key) covers the case where
 *     GPS is denied, unavailable, or simply wrong
 *   · the pass-38 auto-detect prompt is now actually wired: when the device
 *     moves >15 km from the saved location we ask before switching — the app
 *     never changes prayer times silently.
 */

/*
 * PASS 103 — places the member has already declined to switch to.
 *
 * Without this the foreground re-check below would re-ask every single time he
 * unlocked his phone: he taps "Keep Kano", backgrounds the app, comes back,
 * and gets the same question again. One decline per place is enough; the set is
 * module state, so it clears when the app reloads and he is asked again on a
 * genuinely new session. Keyed on the reverse-geocoded name because that is
 * what he actually said no to, and it is stable where raw coordinates are not.
 */
const dismissedPlaces = new Set<string>();
const placeKey = (l: Loc | null) => (l ? (l.name || '').trim().toLowerCase() : '');

type GeoHit = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

const label = (h: GeoHit) =>
  [h.name, h.admin1, h.country].filter(Boolean).join(', ');

/** Free geocoder — no key, no account, returns lat/lon we can store directly. */
async function searchCities(q: string): Promise<GeoHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?count=12&language=en&format=json&name=' +
    encodeURIComponent(query);
  const r = await fetch(url);
  if (!r.ok) throw new Error('geocoding http ' + r.status);
  const j = (await r.json()) as { results?: GeoHit[] };
  return Array.isArray(j.results) ? j.results : [];
}

/* ── global open/close handle (same pattern as LoginModalHost) ── */
type OpenFn = () => void;
let openHandler: OpenFn | null = null;

/** Open the change-location sheet from anywhere in the app. */
export function openLocationModal(): void {
  if (openHandler) openHandler();
}

/** Reactive current location — every screen that shows a place name uses this,
 *  so one change updates home, prayer, month table and qibla together. */
export function useLocation(): Loc | null {
  const [loc, setLoc] = useState<Loc | null>(null);
  useEffect(() => {
    const off = onLocationChange(setLoc);
    void refreshLocation();
    return off;
  }, []);
  return loc;
}

export function LocationModalHost() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [visible, setVisible] = useState(false);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [busy, setBusy] = useState<'gps' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [prompt, setPrompt] = useState<Loc | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setBusy(null);
    const off = onLocationChange(setLoc);
    void refreshLocation();
    return () => {
      alive.current = false;
      off();
    };
  }, []);

  /* register the global opener */
  useEffect(() => {
    openHandler = () => {
      haptic.selection();
      setError('');
      setQ('');
      setResults(null);
      setVisible(true);
    };
    return () => {
      openHandler = null;
    };
  }, []);

  /* pass 38's auto-detect, finally connected: ask before switching. */
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    const check = () => {
      void detectLocationChange().then((candidate) => {
        if (cancelled || !candidate || !alive.current) return;
        if (dismissedPlaces.has(placeKey(candidate))) return;
        setPrompt(candidate);
      });
    };
    check();
    try {
      stop = watchLocation((candidate) => {
        if (!alive.current) return;
        if (dismissedPlaces.has(placeKey(candidate))) return;
        setPrompt(candidate);
      });
    } catch {
      stop = null;
    }
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [loc?.latitude, loc?.longitude]);

  /*
   * PASS 103 — re-check when the app comes back to the foreground.
   *
   * The effect above only runs on mount and when the saved location changes,
   * and watchLocation() needs a live JS thread: both Android and iOS suspend
   * the app in the background, so the watcher stops. The realistic case —
   * a member drives from Kano to Kadura, locks the phone, opens DeenLink
   * two hours later for prayer times — would therefore never prompt, because
   * nothing re-ran while the app was suspended.
   *
   * Same idiom as lib/feedSync.ts: AppState on native, document visibility on
   * web (where detectLocationChange() returns null anyway, so this is a no-op
   * there and only the manual sheet works).
   */
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void detectLocationChange().then((candidate) => {
        if (cancelled || !candidate || !alive.current) return;
        if (dismissedPlaces.has(placeKey(candidate))) return;
        setPrompt(candidate);
      });
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    let onVis: (() => void) | null = null;
    if (typeof document !== 'undefined') {
      onVis = () => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVis);
    }
    return () => {
      cancelled = true;
      sub.remove();
      if (onVis && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, []);

  /* debounced city search */
  useEffect(() => {
    if (!visible) return;
    const needle = q.trim();
    if (needle.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchCities(needle)
        .then((rows) => {
          if (alive.current) setResults(rows);
        })
        .catch(() => {
          if (alive.current) {
            setResults([]);
            setError('City search is unavailable right now. Try "Use my current location".');
          }
        })
        .finally(() => {
          if (alive.current) setSearching(false);
        });
    }, 350);
    return () => clearTimeout(t);
  }, [q, visible]);

  const useGps = useCallback(async () => {
    setBusy('gps');
    setError('');
    try {
      await useCurrentGpsLocation();
      haptic.success();
      setVisible(false);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Could not read your location. Pick your city below instead.',
      );
    } finally {
      if (alive.current) setBusy(null);
    }
  }, []);

  const choose = useCallback(async (hit: GeoHit | Loc) => {
    setBusy('save');
    setError('');
    try {
      const next: Loc =
        'latitude' in hit && 'name' in hit && !('id' in hit)
          ? (hit as Loc)
          : {
              latitude: (hit as GeoHit).latitude,
              longitude: (hit as GeoHit).longitude,
              name: label(hit as GeoHit),
            };
      await applyLocation(next);
      haptic.success();
      setPrompt(null);
      setVisible(false);
    } catch {
      setError('That location could not be saved. Please try again.');
    } finally {
      if (alive.current) setBusy(null);
    }
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setPrompt(null);
  }, []);

  return (
    <>
      {/* ── passive "you seem to have moved" prompt ── */}
      <Modal
        visible={!!prompt && !visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPrompt(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 340,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: d.cardBorder,
              backgroundColor: d.card,
              padding: 20,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
              }}
            >
              <FontAwesome5
                name="map-marker-alt"
                size={14}
                color={isDark ? '#4AE38F' : '#1D6F42'}
              />
              <T v="body" style={{ fontSize: 14.5, fontWeight: '900', color: d.text, flex: 1 }}>
                New location detected
              </T>
            </View>
            <T v="caption" style={{ fontSize: 12, color: d.subtext, lineHeight: 17 }}>
              You appear to be in <T v="caption" style={{ fontSize: 12, fontWeight: '900', color: d.text }}>{prompt?.name}</T>. Update your
              prayer times? Nothing changes until you confirm.
            </T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => {
                  haptic.selection();
                  const k = placeKey(prompt);
                  if (k) dismissedPlaces.add(k);
                  setPrompt(null);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 11,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.subtext }}>
                  Keep {loc?.name ? loc.name.split(',')[0] : 'current'}
                </T>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!prompt) return;
                  haptic.selection();
                  void choose(prompt);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '900', color: '#fff' }}>
                  Update
                </T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── the change-location sheet ── */}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.62)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={close} />
          <View
            style={{
              maxHeight: '86%',
              backgroundColor: isDark ? '#0C1712' : '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: d.cardBorder,
              padding: 16,
              paddingBottom: Platform.OS === 'ios' ? 28 : 20,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 4.5,
                  borderRadius: 3,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
                }}
              />
            </View>

            <T v="h3" style={{ fontWeight: '800', fontSize: 16, color: d.text, marginBottom: 3 }}>
              Change location
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginBottom: 12 }}>
              Prayer times, qibla direction and the monthly timetable all follow this.
            </T>

            {/* current */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: d.cardBorder,
                backgroundColor: d.card,
                padding: 11,
                marginBottom: 10,
              }}
            >
              <FontAwesome5 name="map-pin" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7, color: d.faint }}>
                  CURRENT LOCATION
                </T>
                <T v="bodyS" numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: d.text }}>
                  {loc?.name ?? 'Not set'}
                </T>
                {loc && !loc.isFallback ? (
                  <T v="caption" style={{ fontSize: 10, color: d.faint }}>
                    {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
                  </T>
                ) : null}
                {loc?.isFallback ? (
                  <T v="caption" style={{ fontSize: 10, color: '#C0392B', fontWeight: '700' }}>
                    Default — set your real location below
                  </T>
                ) : null}
              </View>
            </View>

            {/* GPS */}
            <Pressable
              onPress={() => {
                void useGps();
              }}
              disabled={busy !== null}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                borderRadius: 13,
                backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
                padding: 13,
                marginBottom: 12,
                opacity: pressed || busy ? 0.85 : 1,
              })}
            >
              {busy === 'gps' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome5 name="crosshairs" size={14} color="#fff" />
              )}
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>
                  {busy === 'gps' ? 'Locating you…' : 'Use my current location'}
                </T>
                <T v="caption" style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
                  Reads GPS now and finds your city name
                </T>
              </View>
            </Pressable>

            {/* manual search */}
            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7, color: d.faint, marginBottom: 6 }}>
              OR SEARCH FOR YOUR CITY
            </T>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: d.cardBorder,
                backgroundColor: d.card,
                paddingHorizontal: 11,
                marginBottom: 8,
              }}
            >
              <FontAwesome5 name="search" size={12} color={d.faint} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="e.g. Kano, Kaduna, Gusau…"
                placeholderTextColor={d.faint}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 9,
                  fontSize: 15,
                  color: d.text,
                  fontFamily: 'Poppins-Medium',
                }}
              />
              {q ? (
                <Pressable onPress={() => setQ('')} hitSlop={8}>
                  <FontAwesome5 name="times-circle" size={13} color={d.faint} />
                </Pressable>
              ) : null}
            </View>

            {error ? (
              <T v="caption" style={{ fontSize: 11, color: '#C0392B', fontWeight: '700', marginBottom: 8, lineHeight: 15 }}>
                {error}
              </T>
            ) : null}

            <ScrollView
              style={{ maxHeight: 250 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {searching ? (
                <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
                  <T v="caption" style={{ fontSize: 11, color: d.faint }}>
                    Searching…
                  </T>
                </View>
              ) : results && results.length === 0 ? (
                <T v="caption" style={{ fontSize: 11.5, color: d.faint, textAlign: 'center', paddingVertical: 18 }}>
                  No city matched “{q.trim()}”. Try a different spelling.
                </T>
              ) : (results ?? []).map((hit) => {
                const isCurrent =
                  !!loc &&
                  Math.abs(loc.latitude - hit.latitude) < 0.05 &&
                  Math.abs(loc.longitude - hit.longitude) < 0.05;
                return (
                  <Pressable
                    key={`${hit.id}-${hit.latitude.toFixed(3)}`}
                    disabled={busy !== null}
                    onPress={() => {
                      haptic.selection();
                      void choose(hit);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isCurrent ? 'rgba(212,175,55,0.6)' : d.cardBorder,
                      backgroundColor: pressed ? theme.cardSoft : d.card,
                      padding: 11,
                      marginBottom: 7,
                      opacity: busy ? 0.6 : 1,
                    })}
                  >
                    <FontAwesome5
                      name="map-marker-alt"
                      size={12}
                      color={isCurrent ? '#D4AF37' : isDark ? '#4AE38F' : '#1D6F42'}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyS" numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: d.text }}>
                        {hit.name}
                      </T>
                      <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint }}>
                        {[hit.admin1, hit.country].filter(Boolean).join(' · ') || '—'}
                      </T>
                    </View>
                    {isCurrent ? (
                      <FontAwesome5 name="check-circle" size={13} color="#D4AF37" />
                    ) : (
                      <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
                    )}
                  </Pressable>
                );
              })}
              {!searching && !results ? (
                <T v="caption" style={{ fontSize: 11.5, color: d.faint, textAlign: 'center', paddingVertical: 18, lineHeight: 17 }}>
                  Type a city name to set it manually — useful when GPS is off or
                  inaccurate indoors.
                </T>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
