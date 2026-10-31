import { Image, Linking, Platform, Pressable, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import { registerMediaStop, useMediaGate } from '@/lib/mediaBus';
import { youtubeId } from '@/lib/youtube';
import { T } from '@/components/T';

/** A single, identifiable YouTube embed. Playback is owned by the global media
 * gate; unmounting the iframe/WebView stops it when off-screen or interrupted. */
export function YouTubePlayer({
  embedUrl, height = 210, borderRadius = 12, gateKey, autoStart = false,
}: {
  embedUrl: string; height?: number; borderRadius?: number; gateKey?: string; autoStart?: boolean;
}) {
  const id = youtubeId(embedUrl);
  const key = `yt:${gateKey || id || embedUrl}`;
  const { hostRef, allowed, start } = useMediaGate(key);
  const frameRef = useRef<any>(null);
  useEffect(() => {
    if (autoStart && id) start();
  }, [autoStart, start, id]);
  useEffect(() => registerMediaStop(key, () => {
    try {
      const command = JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] });
      if (Platform.OS === 'web') frameRef.current?.contentWindow?.postMessage(command, '*');
      else frameRef.current?.injectJavaScript(`document.querySelector('iframe')?.contentWindow?.postMessage(${JSON.stringify(command)}, '*');true;`);
    } catch { /* unmounting the frame is the hard stop */ }
  }), [key]);

  const nativeIdentity = 'https://org.deenlink.app';
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : nativeIdentity;
  const params = `playsinline=1&rel=0&autoplay=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`;
  const embed = id ? `https://www.youtube.com/embed/${id}?${params}` : '';
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{width:100%;height:100%;margin:0;background:#000}iframe{width:100%;height:100%;border:0}</style></head><body><iframe src="${embed.replace(/&/g, '&amp;')}" title="YouTube video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></body></html>`;
  const { WebView } = Platform.OS !== 'web' ? require('react-native-webview') : { WebView: null };

  return (
    <View ref={hostRef as never} style={{ width: '100%' }}>
      <View style={{ width: '100%', height: Math.max(200, height), backgroundColor: '#000', borderRadius: Platform.OS === 'web' ? borderRadius : 0, overflow: Platform.OS === 'web' ? 'hidden' : 'visible' }}>
        {allowed && id ? Platform.OS === 'web' ? (
          <iframe ref={frameRef} src={embed} title="DeenLink YouTube video" style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#000' } as never}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <WebView ref={frameRef} source={{ html, baseUrl: `${nativeIdentity}/` }} style={{ width: '100%', height: Math.max(200, height), backgroundColor: '#000' }}
            containerStyle={{ backgroundColor: '#000' }} androidLayerType="hardware" allowsFullscreenVideo allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false} javaScriptEnabled domStorageEnabled originWhitelist={['*']} setSupportMultipleWindows={false} />
        ) : (
          <Pressable onPress={() => { if (id) start(); }} disabled={!id} accessibilityRole="button" accessibilityLabel="Play YouTube video"
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07100C' }}>
            {id ? <Image source={{ uri: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.55 }} resizeMode="cover" /> : null}
            <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}><FontAwesome5 name={id ? 'play' : 'exclamation'} size={15} color="#fff" /></View>
            <T v="caption" style={{ position: 'absolute', bottom: 8, color: '#fff', fontSize: 10 }}>{id ? 'TAP TO PLAY' : 'Video link unavailable'}</T>
          </Pressable>
        )}
      </View>
      {id ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(`https://www.youtube.com/watch?v=${id}`).catch(() => {}); }} style={{ paddingVertical: 7, alignItems: 'flex-end' }}>
        <T v="caption" style={{ color: '#90CBA7', fontSize: 10 }}>If unavailable, open on YouTube ↗</T>
      </Pressable> : null}
    </View>
  );
}
