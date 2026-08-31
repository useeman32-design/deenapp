import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';
import { KAABA } from '@/lib/prayer';

/**
 * pass 33 — QiblaLeaflet: a REAL slippy map (Leaflet + OpenStreetMap tiles)
 * drawing the great-circle line from the user's live location to the Kaaba.
 * react-native-webview is not supported on the web export, so on web we
 * inject Leaflet into the page and mount the map on a plain DOM node
 * (react-native-web Views forward refs to real divs). The offline
 * equirectangular QiblaMap stays on the screen as the no-network fallback.
 */

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

export function QiblaLeaflet({ userLoc, userName, distanceKm }: { userLoc: { lat: number; lon: number }; userName: string; distanceKm: number }) {
  const { isDark } = useTheme();
  const ref = useRef<View>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');

  useEffect(() => {
    if (Platform.OS !== 'web') { setState('failed'); return; }
    let map: any = null;
    let dead = false;
    loadLeaflet()
      .then((L) => {
        if (dead) return;
        const node = ref.current as unknown as HTMLDivElement | null;
        if (!node) return;
        const you: [number, number] = [userLoc.lat, userLoc.lon];
        const kaaba: [number, number] = [KAABA.latitude, KAABA.longitude];
        map = L.map(node, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12 }).addTo(map);
        L.circleMarker(you, { radius: 7, color: '#1D6F42', fillColor: '#4AE38F', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup((userName || 'Your location').replace(/</g, ''));
        L.marker(kaaba, {
          icon: L.divIcon({
            className: 'dl-kaaba-pin',
            html: '<div style="width:26px;height:26px;border-radius:50%;background:#000;border:2.5px solid #D4AF37;display:flex;align-items:center;justify-content:center;font-size:13px">🕋</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        }).addTo(map).bindPopup('Masjid al-Haram · Kaaba');
        /* great-circle path — 64 intermediate points */
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
        L.polyline(pts, { color: '#D4AF37', weight: 3, dashArray: '8 6' }).addTo(map).bindTooltip(`${Math.round(distanceKm)} km to Makkah`);
        map.fitBounds(L.latLngBounds(pts).pad(0.25));
        setTimeout(() => { if (!dead) map.invalidateSize(); }, 350);
        setState('ok');
      })
      .catch(() => { if (!dead) setState('failed'); });
    return () => { dead = true; try { map?.remove(); } catch {} };
  }, [userLoc.lat, userLoc.lon, userName, distanceKm]);

  if (state === 'failed')
    return (
      <View style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(242,247,243,0.14)' : 'rgba(20,36,28,0.12)', alignItems: 'center' }}>
        <T v="caption" style={{ textAlign: 'center' }}>Interactive map needs a connection — the world map below still shows your qibla line.</T>
      </View>
    );

  return (
    <View
      ref={ref}
      style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(242,247,243,0.14)' : 'rgba(20,36,28,0.12)', height: 250, backgroundColor: isDark ? '#0A100D' : '#F2F6F3' }}
    />
  );
}
