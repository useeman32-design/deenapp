import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Native-only haptics (no-op on web). Failures are always swallowed. */
const can = () => Platform.OS !== 'web';

export const haptic = {
  light: () => {
    if (can()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium: () => {
    if (can()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success: () => {
    if (can()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  selection: () => {
    if (can()) Haptics.selectionAsync().catch(() => {});
  },
};
