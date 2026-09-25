import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CrescentLoader } from '@/components/CrescentLoader';
/**
 * pass 28 — buffering overlay for expo-video players.
 * Polls player.status and shows the crescent+star loader only while the active
 * player is actually preparing. Video buffering is intentionally local to the
 * player: it must not raise the global "Slow network" pill on a fast connection.
 */
export function VideoLoader({ player, label = 'Loading video…', active = true }: { player: any; label?: string; active?: boolean }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!player) return;
    const iv = setInterval(() => {
      if (!active) { setLoading(false); return; }
      let st = 'idle';
      try { st = player.status ?? 'idle'; } catch { /* disposed */ }
      /* Once playback has been requested, keep the crescent alive through the
       * idle/loading/ready transition. It must not animate once, disappear,
       * and leave a black frame while the source is still preparing. */
      const buffering = st === 'idle' || st === 'loading' || (st === 'readyToPlay' && !player.isPlaying && player.currentTime === 0 && wantPlay(player));
      setLoading(buffering);
    }, 300);
    return () => clearInterval(iv);
  }, [player, active]);

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
