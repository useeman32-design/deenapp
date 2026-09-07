import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CrescentLoader } from '@/components/CrescentLoader';
import { netBus } from '@/lib/net';

/**
 * pass 28 — buffering overlay for expo-video players (web).
 * Polls player.status: shows the crescent+star loader ("Loading video…") while the media
 * buffers and reports the global slow-network pill. Renders null when idle.
 */
export function VideoLoader({ player, label = 'Loading video…' }: { player: any; label?: string }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!player) return;
    let netOn = false;
    let visibleFor = 0;
    const iv = setInterval(() => {
      let st = 'idle';
      try { st = player.status ?? 'idle'; } catch { /* disposed */ }
      const buffering = st === 'loading' || (st === 'readyToPlay' && !player.isPlaying && player.currentTime === 0 && wantPlay(player));
      setLoading(buffering);
      if (buffering) {
        visibleFor += 0.3;
        if (!netOn && visibleFor > 1.2) { netOn = true; netBus.slow(true); }
      } else {
        visibleFor = 0;
        if (netOn) { netOn = false; netBus.slow(false); }
      }
    }, 300);
    return () => { clearInterval(iv); if (netOn) netBus.slow(false); };
  }, [player]);

  if (!loading || !player) return null;
  /* pass 40 — animated crescent + star replaces the plain spinner */
  return (
    <View pointerEvents="none" style={S.wrap}>
      <View style={S.pill}>
        <CrescentLoader size={26} color="#E8C96A" />
        <Text style={S.txt}>{label}</Text>
      </View>
    </View>
  );
}

/* players created paused look idle until first play() — don't flag them */
function wantPlay(player: any): boolean {
  try { return Boolean(player.loop || player.playbackRate > 0) || player.currentTime > 0 || isPlaying(player); } catch { return false; }
}
function isPlaying(player: any): boolean {
  try { return Boolean(player.isPlaying); } catch { return false; }
}

const S = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(8,14,11,0.72)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  txt: { color: '#F2E9D8', fontSize: 11.5, fontFamily: 'Poppins-SemiBold' },
});
