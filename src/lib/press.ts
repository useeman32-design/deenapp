import { Platform } from 'react-native';

/**
 * pass 34f — stop tap-bubbling on BOTH platforms.
 *
 * react-native-web press events BUBBLE (a tap on a card inside a modal
 * backdrop would also fire the backdrop's onPress), and the event object
 * carries stopPropagation(). Native press events DON'T bubble and the event
 * object has NO stopPropagation — calling it crashed the screen on tap in
 * Expo Go. Always route taps through this helper.
 */
export function stopBubble(e: unknown) {
  if (Platform.OS !== 'web') return;
  try {
    (e as { stopPropagation?: () => void })?.stopPropagation?.();
  } catch {}
}
