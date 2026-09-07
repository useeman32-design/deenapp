import { Redirect } from 'expo-router';

/** The old daily-videos list now lives in the reels feed (/videos). */
export default function VideosRedirect() {
  return <Redirect href="/videos" />;
}
