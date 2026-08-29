import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * useHeading (pass 18) — a REAL compass heading for the qibla screen.
 *
 *  · native (iOS/Android): expo-sensors Magnetometer + Accelerometer,
 *    tilt-compensated azimuth, smoothed (EMA) over ~6 samples.
 *  · web: DeviceOrientation — iOS `webkitCompassHeading` (true north,
 *    permission-gated) or absolute `alpha` (Android Chrome). Safari
 *    desktop / laptops without sensors → status 'none'.
 *  · always: a manual offset the user can dial in, so the screen still
 *    works with no magnetometer at all.
 *
 * Heading convention: 0 = the top of the phone points (magnetic) north,
 * increasing clockwise, 0–360.
 */

export type HeadingState = {
  /** smoothed heading in degrees (magnetic), null until first sample */
  heading: number | null;
  /** where the number came from */
  source: 'magnetometer' | 'deviceorientation' | 'none';
  /** true when the web browser needs a user gesture to grant motion sensors */
  needsPermission: boolean;
  /** manual correction in degrees the user dialled in */
  manualOffset: number;
  /** heading + manual offset, wrapped to 0–360 */
  corrected: number | null;
  setManualOffset: (d: number) => void;
  /** web only: call from a tap to request iOS motion permission */
  requestPermission: () => void;
  /** absolute sensor availability (best-effort) */
  available: boolean;
};

const wrap = (d: number) => ((d % 360) + 360) % 360;

export function useHeading(): HeadingState {
  const [heading, setHeading] = useState<number | null>(null);
  const [source, setSource] = useState<'magnetometer' | 'deviceorientation' | 'none'>('none');
  const [needsPermission, setNeedsPermission] = useState(false);
  const [manualOffset, setManualOffset] = useState(0);
  const smooth = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // ---- native: tilt-compensated magnetometer ----
      const subs: Array<{ remove: () => void }> = [];
      import('expo-sensors')
        .then(({ Magnetometer, Accelerometer }) => {
          Magnetometer.setUpdateInterval(100);
          Accelerometer.setUpdateInterval(100);
          let mag = { x: 0, y: 0, z: 0 };
          let acc = { x: 0, y: 0, z: 0 };
          const gotMag = { v: false };
          const gotAcc = { v: false };

          const recompute = () => {
            if (!gotMag.v || !gotAcc.v) return;
            // tilt compensation (roll/pitch from gravity, then rotate the mag vector)
            const roll = Math.atan2(acc.y, acc.z);
            const pitch = Math.atan(-acc.x / (acc.y * Math.sin(roll) + acc.z * Math.cos(roll) || 1e-9));
            const by = mag.y * Math.cos(roll) - mag.z * Math.sin(roll);
            const bx = mag.x * Math.cos(pitch) + mag.y * Math.sin(pitch) * Math.sin(roll) + mag.z * Math.sin(pitch) * Math.cos(roll);
            let h = (Math.atan2(by, bx) * 180) / Math.PI;
            h = wrap(-h + 180); // sensor axes → compass convention (top of phone)
            if (!isFinite(h)) return;
            smooth.current = smooth.current == null ? h : smooth.current + ((((h - smooth.current + 540) % 360) - 180) * 0.3);
            setHeading(wrap(smooth.current));
            setSource('magnetometer');
          };

          subs.push(
            Magnetometer.addListener((m) => {
              mag = m;
              gotMag.v = true;
              recompute();
            }),
          );
          subs.push(
            Accelerometer.addListener((a) => {
              acc = a;
              gotAcc.v = true;
              recompute();
            }),
          );
        })
        .catch(() => {
          /* sensors unavailable → manual mode */
        });
      return () => {
        subs.forEach((s) => s.remove());
      };
    }

    // ---- web ----
    const w = window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
    };
    const doe = w.DeviceOrientationEvent;
    if (doe?.requestPermission) {
      setNeedsPermission(true); // iOS 13+ — needs a tap
    }

    const onOrient = (e: DeviceOrientationEvent) => {
      const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      let h: number | null = null;
      if (typeof ev.webkitCompassHeading === 'number') {
        h = ev.webkitCompassHeading; // true north, already clockwise
      } else if (typeof e.alpha === 'number') {
        h = wrap(360 - e.alpha); // absolute alpha (Chrome Android, absolute orientation)
      }
      if (h == null || !isFinite(h)) return;
      smooth.current = smooth.current == null ? h : smooth.current + ((((h - smooth.current + 540) % 360) - 180) * 0.4);
      setHeading(wrap(smooth.current));
      setSource('deviceorientation');
      setNeedsPermission(false);
    };

    window.addEventListener('deviceorientationabsolute' as never, onOrient as never, true);
    window.addEventListener('deviceorientation', onOrient as never, true);
    const probe = setTimeout(() => {
      // if no sample after 2s, we stay in manual mode
      setSource((s) => (s === 'none' ? 'none' : s));
    }, 2000);
    return () => {
      clearTimeout(probe);
      window.removeEventListener('deviceorientationabsolute' as never, onOrient as never, true);
      window.removeEventListener('deviceorientation', onOrient as never, true);
    };
  }, []);

  const requestPermission = () => {
    const w = window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } };
    try {
      w.DeviceOrientationEvent?.requestPermission?.()
        .then((r) => {
          if (r !== 'granted') setNeedsPermission(false);
        })
        .catch(() => setNeedsPermission(false));
    } catch {}
  };

  return {
    heading,
    source,
    needsPermission,
    manualOffset,
    corrected: heading == null ? null : wrap(heading + manualOffset),
    setManualOffset,
    requestPermission,
    available: source !== 'none' || heading != null,
  };
}

/** Signed smallest difference a−b, in (−180, 180]. */
export const angleDelta = (a: number, b: number): number => ((((a - b) % 360) + 540) % 360) - 180;
