import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * pass 83-31 — iOS add-to-home-screen prompt (owner request).
 *
 * On iPhone/iPad Safari (no standalone display = running in the browser tab)
 * we show a small dismissible sheet explaining "Share → Add to Home Screen".
 * iOS gives web apps NO programmatic install API, so this is the honest
 * native-feeling pattern. Dismissal persists for 30 days.
 */

const DISMISS_KEY = 'dl.pwa.ios.dismissed.v1';
const DISMISS_DAYS = 30;

function isIosSafari(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  /* already installed? */
  const mq = window.matchMedia?.('(display-mode: standalone)');
  const standalone = (window as unknown as { navigator?: { standalone?: boolean } }).navigator?.standalone === true || (mq ? mq.matches : false);
  return !standalone;
}

export function IosPwaPrompt() {
  const { theme, isDark } = useTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;
    let dead = false;
    void storage.getItem(DISMISS_KEY).then((v) => {
      if (dead) return;
      const until = Number(v ?? '0');
      if (until && Date.now() < until) return;
      setTimeout(() => { if (!dead) setShow(true); }, 2600); /* let the first screen settle */
    }).catch(() => {
      setTimeout(() => { if (!dead) setShow(true); }, 2600);
    });
    return () => { dead = true; };
  }, []);

  const dismiss = () => {
    haptic.light();
    setShow(false);
    try { void storage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000)); } catch {}
  };

  if (!show) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={dismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,7,5,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={dismiss} />
        <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, padding: 18, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: isDark ? 'rgba(46,204,113,0.16)' : 'rgba(29,111,66,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="mobile-alt" size={17} color={isDark ? '#4AE38F' : '#1D6F42'} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="body" style={{ fontWeight: '900', fontSize: 14, color: theme.text }}>Add DeenLink to your Home Screen</T>
              <T v="caption" style={{ color: theme.subtext, fontSize: 11, marginTop: 2 }}>Works like an app — full screen, no browser bars.</T>
            </View>
            <Pressable onPress={dismiss} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="times" size={12} color={theme.subtext} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, borderRadius: 13, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, padding: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(29,111,66,0.04)' }}>
            <FontAwesome5 name="share" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="bodyS" style={{ flex: 1, fontSize: 12, lineHeight: 18, color: theme.text }}>
              Tap the <T v="bodyS" style={{ fontWeight: '900', fontSize: 12, color: isDark ? '#4AE38F' : '#1D6F42' }}>Share</T> button in Safari{'' }
              (the square with the arrow), scroll down and choose{' '}
              <T v="bodyS" style={{ fontWeight: '900', fontSize: 12, color: isDark ? '#4AE38F' : '#1D6F42' }}>“Add to Home Screen”</T>.
            </T>
          </View>
          <Pressable onPress={dismiss} style={{ marginTop: 14, borderRadius: 13, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', paddingVertical: 12, alignItems: 'center' }}>
            <T v="button" style={{ fontSize: 12.5 }}>Got it</T>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
