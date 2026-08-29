import { Platform } from 'react-native';

/**
 * In-app YouTube playback (pass 16).
 * Native — react-native-webview with an HTML iframe source: the reliable way
 * to get true inline playback (YouTube blocks bare embed URLs in some
 * webviews with "Video unavailable"; an iframe document with
 * allowsInlineMediaPlayback + dom storage plays inline).
 * Web — plain iframe (existing behavior).
 */
export function YouTubePlayer({ embedUrl, height = 210, borderRadius = 12 }: { embedUrl: string; height?: number; borderRadius?: number }) {
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1`}
        title="DeenLink video"
        style={{ width: '100%', height, border: 'none', borderRadius, display: 'block', background: '#000' } as never}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  const id = (embedUrl.split('/embed/')[1] ?? '').split(/[?&]/)[0];
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;background:#000;overflow:hidden}iframe{width:100%;height:100%;border:0}</style></head><body>
  <iframe src="https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1&autoplay=0" title="DeenLink video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
  </body></html>`;

  const { WebView } = require('react-native-webview');
  return (
    <WebView
      source={{ html }}
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
  );
}
