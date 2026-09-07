import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';
import { KAABA } from '@/lib/prayer';

/**
 * QiblaLeaflet (pass 39) — the qibla map, SATELLITE edition:
 *  · Esri World Imagery tiles (satellite) instead of street OSM
 *  · FIRST visit: every tile is downloaded and SAVED (localStorage data-URLs);
 *    every visit after that the saved map paints instantly — no network, no
 *    "offline map" fallback. The Offline/world-map path is gone for good.
 *  · react-native-webview is unusable on the web export, so on web we inject
 *    Leaflet into the page; on native the same satellite mosaic renders in a
 *    WebView (QiblaNativeSat below) with its own tile cache.
 */

const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR = 'Esri, Maxar, Earthstar Geographics';
const TILE_KEY = (url: string) => `dl.tile.${url.slice(-40)}`;

let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as unknown as { L?: any; __dlLeaflet?: Promise<any> };
  if (w.L) return Promise.resolve(w.L);
  if (w.__dlLeaflet) return w.__dlLeaflet;
  w.__dlLeaflet = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => (w.L ? resolve(w.L) : reject(new Error('leaflet loaded but missing')));
    js.onerror = () => reject(new Error('leaflet failed to load'));
    document.head.appendChild(js);
    setTimeout(() => reject(new Error('leaflet timeout')), 12000);
  });
  return w.__dlLeaflet;
}

/* great-circle points user → kaaba */
function gcPoints(you: [number, number], kaaba: [number, number]): Array<[number, number]> {
  const toR = Math.PI / 180;
  const l1 = you[0] * toR, g1 = you[1] * toR, l2 = kaaba[0] * toR, g2 = kaaba[1] * toR;
  const d = 2 * Math.asin(Math.sqrt(Math.sin((l2 - l1) / 2) ** 2 + Math.cos(l1) * Math.cos(l2) * Math.sin((g2 - g1) / 2) ** 2));
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 64; i++) {
    const a = i / 64;
    if (d === 0) { pts.push(you); continue; }
    const A = Math.sin((1 - a) * d) / Math.sin(d), B = Math.sin(a * d) / Math.sin(d);
    const x = A * Math.cos(l1) * Math.cos(g1) + B * Math.cos(l2) * Math.cos(g2);
    const y = A * Math.cos(l1) * Math.sin(g1) + B * Math.cos(l2) * Math.sin(g2);
    const z = A * Math.sin(l1) + B * Math.sin(l2);
    pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / toR, Math.atan2(y, x) / toR]);
  }
  return pts;
}

export function QiblaLeaflet({ userLoc, userName, distanceKm, height = 250 }: { userLoc: { lat: number; lon: number }; userName: string; distanceKm: number; height?: number }) {
  const { isDark } = useTheme();
  const ref = useRef<View>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  /* pass 39 — did the saved tiles answer? (cache hit = instant map) */
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') { setState('failed'); return; }
    let map: any = null;
    let dead = false;
    let anyCached = false;
    loadLeaflet()
      .then((L) => {
        if (dead) return;
        const node = ref.current as unknown as HTMLDivElement | null;
        if (!node) return;

        /* pass 39 — satellite tiles with a SAVING cache layer: first load
         * downloads each tile and stores it; later loads paint from storage. */
        const SatCache = L.TileLayer.extend({
          createTile(coords: any, done: (err: unknown, tile: HTMLImageElement) => void) {
            const tile = document.createElement('img');
            const url = this.getTileUrl(coords);
            const key = TILE_KEY(url);
            let cached: string | null = null;
            try { cached = localStorage.getItem(key); } catch { cached = null; }
            if (cached) {
              anyCached = true;
              tile.src = cached;
              setTimeout(() => done(null, tile), 0);
            } else {
              fetch(url, { mode: 'cors' })
                .then((r) => r.blob())
                .then((b) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(b); }))
                .then((dataUrl) => {
                  try { localStorage.setItem(key, dataUrl); } catch { /* quota — keep painting anyway */ }
                  tile.src = dataUrl;
                  done(null, tile);
                })
                .catch(() => { tile.src = url; done(null, tile); });
            }
            return tile;
          },
        });
        (L as any).satCache = function satCache(url: string, opts: Record<string, unknown>) { return new (SatCache as any)(url, opts); };

        const you: [number, number] = [userLoc.lat, userLoc.lon];
        const kaaba: [number, number] = [KAABA.latitude, KAABA.longitude];
        map = L.map(node, { zoomControl: true, attributionControl: true });
        (L as any).satCache(SAT_URL, { maxZoom: 17, attribution: SAT_ATTR }).addTo(map);
        L.circleMarker(you, { radius: 7, color: '#1D6F42', fillColor: '#4AE38F', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup((userName || 'Your location').replace(/</g, ''));
        L.marker(kaaba, {
          icon: L.divIcon({
            className: 'dl-kaaba-pin',
            html: '<div style="width:26px;height:26px;border-radius:50%;background:#000;border:2.5px solid #D4AF37;display:flex;align-items:center;justify-content:center;font-size:13px">🕋</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        }).addTo(map).bindPopup('Masjid al-Haram · Kaaba');
        const pts = gcPoints(you, kaaba);
        L.polyline(pts, { color: '#D4AF37', weight: 3, dashArray: '8 6' }).addTo(map).bindTooltip(`${Math.round(distanceKm)} km to Makkah`);
        map.fitBounds(L.latLngBounds(pts).pad(0.25));
        setTimeout(() => {
          if (dead) return;
          map.invalidateSize();
          setFromCache(anyCached);
        }, 400);
        setState('ok');
      })
      .catch(() => { if (!dead) setState('failed'); });
    return () => { dead = true; try { map?.remove(); } catch {} };
  }, [userLoc.lat, userLoc.lon, userName, distanceKm]);

  if (state === 'failed')
    return (
      <NativeOrMessage height={height} userLoc={userLoc} userName={userName} distanceKm={distanceKm} />
    );

  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(242,247,243,0.14)' : 'rgba(20,36,28,0.12)', height, backgroundColor: isDark ? '#0A100D' : '#F2F6F3' }}>
      <View ref={ref} style={{ flex: 1 }} />
      {state === 'ok' ? (
        <View style={{ position: 'absolute', top: 8, left: 8, borderRadius: 999, backgroundColor: 'rgba(3,10,6,0.62)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fromCache ? '#4AE38F' : '#E8C96A' }} />
          <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: fromCache ? '#4AE38F' : '#E8C96A', letterSpacing: 0.4 }}>
            {fromCache ? 'SAVED MAP · SATELLITE' : 'SATELLITE · SAVING…'}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/* native fallback message (web-only component) */
function NativeOrMessage({ height }: { height: number; userLoc: { lat: number; lon: number }; userName: string; distanceKm: number }) {
  const { isDark } = useTheme();
  return (
    <View style={{ height, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(242,247,243,0.14)' : 'rgba(20,36,28,0.12)', alignItems: 'center', justifyContent: 'center' }}>
      <T v="caption" style={{ textAlign: 'center' }}>Loading the saved satellite map…</T>
    </View>
  );
}
