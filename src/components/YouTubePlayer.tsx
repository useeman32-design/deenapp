import { Platform } from 'react-native';

/**
 * In-app YouTube playback (pass 14).
 *  · Native — react-native-webview (bundled in Expo Go) rendering the YouTube
 *    embed with inline playback (playsinline=1 + allowsInlineMediaPlayback),
 *    so videos play INSIDE the app instead of handing off to the YouTube app.
 *  · Web — handled by the existing <iframe> (YouTubeFrame in FeedCard);
 *    this component is only used on native.
 */
export function YouTubePlayer({ embedUrl, height = 210, borderRadius = 12 }: { embedUrl: string; height?: number; borderRadius?: number }) {
  if (Platform.OS === 'web') {
    // Web callers should use YouTubeFrame; fall back to a simple iframe.
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
  const src = `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}playsinline=1&rel=0&modestbranding=1&autoplay=0`;
  const { WebView } = require('react-native-webview');
  return (
    <WebView
      source={{ uri: src }}
      style={{ width: '100%', height, borderRadius, backgroundColor: '#000' }}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled={false}
      originWhitelist={['*']}
      containerStyle={{ overflow: 'hidden', borderRadius }}
    />
  );
}
