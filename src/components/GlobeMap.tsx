import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { RouteMap } from '@/components/RouteMap';

/**
 * REAL animated globe (pass 23): a WebView-rendered 3D earth (globe.gl via
 * CDN) that spins slowly, with your location and the Kaabah pinned and a
 * glowing great-circle thread between them. Falls back to the SVG globe card
 * when the CDN is unreachable (offline / sandboxed preview).
 */
export function GlobeMap({
  userLoc,
  userName,
  distanceKm,
  bearing,
}: {
  userLoc: { lat: number; lon: number };
  userName: string;
  distanceKm: number;
  bearing: number;
}) {
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}
  #g{width:100%;height:100%}
</style></head>
<body><div id="g"></div>
<script src="https://unpkg.com/globe.gl@2.32.0/dist/globe.gl.min.js"></script>
<script>
(function(){
  var el = document.getElementById('g');
  var started = false;
  function boot(){
    if (started || typeof Globe === 'undefined') return false;
    started = true;
    try {
      var globe = Globe()(el)
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true)
        .atmosphereColor('${isDark ? '#4AE38F' : '#1F8F5C'}')
        .atmosphereAltitude(0.22)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-${isDark ? 'night' : 'blue-marble'}.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .pointOfView({ lat: ${((userLoc.lat + 21.42) / 2).toFixed(2)}, lng: ${((userLoc.lon + 39.83) / 2).toFixed(2)}, altitude: 1.9 }, 0);

      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.55;
      globe.controls().enableZoom = false;

      var YOU = { lat: ${userLoc.lat}, lng: ${userLoc.lon}, name: '${userName.replace(/'/g, '')} — you' };
      var KAABA = { lat: 21.4225, lng: 39.8262, name: 'Makkah — Kaabah' };

      globe.htmlElementsData([YOU, KAABA])
        .htmlElement(function(d){
          var el = document.createElement('div');
          if (d === KAABA) {
            el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-8px)">'
              + '<div style="width:26px;height:30px;background:#171310;border:1.5px solid #D4AF37;border-radius:3px;position:relative;box-shadow:0 0 14px rgba(212,175,55,0.85)">'
              + '<div style="position:absolute;left:-1px;right:-1px;top:9px;height:3px;background:#D4AF37"></div></div>'
              + '<div style="color:#D4AF37;font:700 9px Poppins,Arial;margin-top:3px;white-space:nowrap">MAKKAH</div></div>';
          } else {
            el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">'
              + '<div style="width:14px;height:14px;border-radius:50%;background:#1F8F5C;border:2.5px solid #fff;box-shadow:0 0 12px rgba(31,143,92,0.9)"></div>'
              + '<div style="color:#1F8F5C;font:700 8px Poppins,Arial;margin-top:2px;white-space:nowrap">YOU</div></div>';
          }
          return el;
        });

      globe.pathsData([[{ lat: YOU.lat, lng: YOU.lng }, { lat: KAABA.lat, lng: KAABA.lng }]])
        .pathPointAlt(0.45)
        .pathColor(function(){ return ['rgba(31,143,92,0.9)', 'rgba(212,175,55,0.95)']; })
        .pathStroke(2.6)
        .pathDashLength(0.06)
        .pathDashGap(0.015)
        .pathDashAnimateTime(2600)
        .pathTransitionDuration(0);

      window.__ok = true;
    } catch (e) { window.__fail = true; }
    return true;
  }
  if (!boot()) { var iv = setInterval(function(){ if (boot()) clearInterval(iv); }, 350); setTimeout(function(){ clearInterval(iv); }, 9000); }
  /* if the CDN never boots (offline), tell RN so it can fall back */
  setTimeout(function(){ if (!window.__ok && !window.__fail) { try { window.parent.postMessage('globe-fail', '*'); } catch (e) {} } }, 8000);
})();
</script></body></html>`;

  /* listen for the offline postMessage from the iframe (web) */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = (e: MessageEvent) => { if (e.data === 'globe-fail') setFailed(true); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  if (failed || Platform.OS !== 'web') {
    return <RouteMap distanceKm={distanceKm} fromName={userName} bearing={bearing} userLoc={userLoc} />;
  }

  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.28)' : 'rgba(29,111,66,0.22)', backgroundColor: isDark ? '#0A130E' : '#F2F8F4', overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingTop: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#1F8F5C' }} />
        <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: isDark ? '#4AE38F' : '#1D6F42' }}>
          YOUR THREAD TO THE KA'BAH — LIVE GLOBE
        </T>
        <View style={{ flex: 1 }} />
        <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#E8C96A' }}>{Math.round(distanceKm).toLocaleString()} km · {Math.round(bearing)}°</T>
      </View>
      <View style={{ height: 250 }}>
        {!loaded ? (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 2 }}>
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ fontSize: 9.5, color: isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)' }}>Spinning up the globe…</T>
          </View>
        ) : null}
        {Platform.OS === 'web' ? (
          React.createElement('iframe', {
            srcDoc: html,
            title: 'deenlink-globe',
            onLoad: () => setLoaded(true),
            style: { flex: 1, width: '100%', height: '100%', border: 'none', background: 'transparent' },
          })
        ) : (
          <WebView
            source={{ html }}
            originWhitelist={['*']}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            javaScriptEnabled
            domStorageEnabled={false}
            onLoadEnd={() => setLoaded(true)}
            onMessage={(e) => { if (e.nativeEvent.data === 'globe-fail') setFailed(true); }}
            renderError={() => {
              setFailed(true);
              return <View />;
            }}
            containerStyle={{ flex: 1 }}
            scrollEnabled={false}
            overScrollMode="never"
          />
        )}
      </View>
      <T v="caption" style={{ fontSize: 8.5, color: isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.45)', textAlign: 'center', paddingBottom: 8 }}>
        The dashed line animates from your city to Makkah — drag the globe to explore
      </T>
    </View>
  );
}
