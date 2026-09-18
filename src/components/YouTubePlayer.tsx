import { Image, Platform, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useMediaGate } from '@/lib/mediaBus';
import { T } from '@/components/T';

/**
 * In-app YouTube playback (pass 16).
 * Native — react-native-webview with an HTML iframe source: the reliable way
 * to get true inline playback (YouTube blocks bare embed URLs in some
 * webviews with "Video unavailable"; an iframe document with
 * allowsInlineMediaPlayback + dom storage plays inline).
 * Web — plain iframe (existing behavior).
 *
 * pass 90 — the embed itself cannot be commanded ("pause that iframe" is not
 * a thing we can send into a YouTube document reliably), so playback is
 * controlled by MOUNTING: the media gate keeps this surface allowed only while
 * its screen is focused, the app is foreground, the browser tab is visible and
 * the card is actually on screen. The moment any of that stops being true the
 * embed unmounts — sound dies with it — and the poster returns with a play
 * button. It also cannot play over another video: only one surface holds the
 * speaker at a time.
 */
function ytId(url: string): string {
  const raw = String(url || '');
  const m =
    raw.match(/\/embed\/([A-Za-z0-9_-]{6,20})/) ||
    raw.match(/[?&]v=([A-Za-z0-9_-]{6,20})/) ||
    raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,20})/);
  return m ? m[1] : '';
}

export function YouTubePlayer({
  embedUrl,
  height = 210,
  borderRadius = 12,
  gateKey,
}: {
  embedUrl: string;
  height?: number;
  borderRadius?: number;
  /** Distinguishes several embeds on one screen (defaults to the URL). */
  gateKey?: string;
}) {
  const key = `yt:${gateKey || embedUrl}`;
  const { hostRef, allowed, start } = useMediaGate(key);
  const id = ytId(embedUrl);

  const frame =
    Platform.OS === 'web' ? (
      <iframe
        src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1&autoplay=1`}
        title="DeenLink video"
        style={
          {
            width: '100%',
            height,
            border: 'none',
            borderRadius,
            display: 'block',
            background: '#000',
          } as never
        }
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    ) : (
      (() => {
        const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;background:#000;overflow:hidden}iframe{width:100%;height:100%;border:0}</style></head><body>
  <iframe src="https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1&autoplay=1" title="DeenLink video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
  </body></html>`;
        const { WebView } = require('react-native-webview');
        return (
          <View>
            <WebView
              /* pass 83-36 — owner: the inline player "refused to be clicked". A bare
               * html source loads from a NULL origin (about:blank) and YouTube BLOCKS
               * embed playback for unknown origins. baseUrl gives the WebView a real
               * https origin, so the iframe is allowed to play. */
              source={{ html, baseUrl: 'https://deenlink.org' }}
              style={{ width: '100%', height, borderRadius, backgroundColor: '#000' }}
              containerStyle={{ overflow: 'hidden', borderRadius }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              mixedContentCompatibilityMode
              setSupportMultipleWindows={false}
            />
          </View>
        );
      })()
    );

  return (
    <View ref={hostRef as never} style={{ width: '100%', height, backgroundColor: '#000', borderRadius, overflow: 'hidden' }}>
      {allowed ? (
        frame
      ) : (
        <Pressable
          onPress={start}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07100C' }}
        >
          {id ? (
            <Image
              source={{ uri: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.55 }}
              resizeMode="cover"
            />
          ) : null}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.28)',
            }}
          >
            <FontAwesome5 name="play" size={15} color="#fff" />
          </View>
          <T v="caption" style={{ position: 'absolute', bottom: 8, color: 'rgba(255,255,255,0.7)', fontSize: 9.5, letterSpacing: 0.4 }}>
            TAP TO PLAY
          </T>
        </Pressable>
      )}
    </View>
  );
}
