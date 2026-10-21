import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Modal, Platform, Pressable, Share, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { silenceMedia } from '@/lib/mediaBus';
import { stopBubble } from '@/lib/press';
import type { Video } from '@/api/types';

export function fmtViews(n?: number | null) {
  if (!n) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/**
 * The daily-video viewer stays inside DeenLink for both local uploads and
 * YouTube sources. Local files use expo-video's engine with DeenLink controls
 * (not nativeControls), while YouTube is rendered in the inline WebView/iframe
 * player. The frame uses contain rather than cover so portrait and landscape
 * videos are both shown without cropping.
 */
export function VideoModal({
  video,
  liked,
  onLike,
  onClose,
}: {
  video: Video | null;
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const d = theme.dash;
  const isEmbed = !!video?.embed_url;
  const localSrc = typeof video?.source_url === 'string' ? String(video.source_url) : '';
  const canPlayInline = !isEmbed && localSrc !== '';
  const player = useVideoPlayer(
    canPlayInline ? { uri: localSrc, useCaching: true } : null,
    (p) => {
      p.loop = false;
      p.muted = false;
    },
  );

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);
  const [frameWidth, setFrameWidth] = useState(302);
  const [barWidth, setBarWidth] = useState(270);
  const [error, setError] = useState('');
  /* pass 102 - the poster shown over the player before playback starts. The
   * server generates a RANDOM FRAME from the uploaded video
   * (api/lib/video_process.php -> dl_video_generate_random_thumbnail, stored on
   * videos.poster_url). Where a video predates that, or the host has no ffmpeg,
   * we generate one on-device from the loaded asset instead, so the modal is
   * never a black box. */
  const [autoThumb, setAutoThumb] = useState<unknown>(null);
  const videoKey = video?.id ?? 0;

  /* pass 102 - the poster frame. The server picks a RANDOM FRAME from the
   * uploaded video (api/lib/video_process.php ->
   * dl_video_generate_random_thumbnail, stored on videos.poster_url); when a
   * video predates that, or the host has no ffmpeg, `autoThumb` below is
   * generated on-device from the loaded asset instead. Declared here, above the
   * effects, because the fallback effect reads it. */
  const thumb = (video?.thumb as number | string | null | undefined) ?? (video?.poster_url as string | null | undefined);
  const posterSource = thumb
    ? typeof thumb === 'number'
      ? thumb
      : { uri: String(thumb) }
    : autoThumb ?? null;

  /* Keep the in-app controls synchronized with expo-video. */
  useEffect(() => {
    if (!canPlayInline) return;
    const add = player.addListener as unknown as (
      event: string,
      callback: (payload: any) => void,
    ) => { remove: () => void };
    const playingSub = add('playingChange', (payload) => {
      setPlaying(!!payload?.isPlaying);
    });
    const statusSub = add('statusChange', (payload) => {
      const status = String(payload?.status ?? '');
      if (status === 'playToEnd') {
        setEnded(true);
        setPlaying(false);
      } else if (status === 'readyToPlay') {
        setError('');
      } else if (status === 'error') {
        setError('This video could not be played in the app.');
        setPlaying(false);
      }
    });
    const timeSub = add('timeUpdate', (payload) => {
      const current = Number(payload?.currentTime ?? 0);
      const total = Number(payload?.duration ?? 0);
      setPosition(Number.isFinite(current) ? current : 0);
      if (Number.isFinite(total) && total > 0) setDuration(total);
    });
    const sourceSub = add('sourceLoad', (payload) => {
      const track = payload?.availableVideoTracks?.[0];
      const width = Number(track?.width ?? 0);
      const height = Number(track?.height ?? 0);
      if (width > 0 && height > 0) setAspect(width / height);
    });
    /* Some web engines do not emit timeUpdate until interaction. */
    const poll = setInterval(() => {
      try {
        const current = Number(player.currentTime ?? 0);
        const total = Number(player.duration ?? 0);
        const nativePlayer = player as unknown as { videoWidth?: number; videoHeight?: number };
        const width = Number(nativePlayer.videoWidth ?? 0);
        const height = Number(nativePlayer.videoHeight ?? 0);
        if (width > 0 && height > 0) setAspect(width / height);
        if (Number.isFinite(current)) setPosition(current);
        if (Number.isFinite(total) && total > 0) setDuration(total);
      } catch {
        /* player is being released */
      }
    }, 400);
    return () => {
      playingSub.remove();
      statusSub.remove();
      timeSub.remove();
      sourceSub.remove();
      clearInterval(poll);
    };
  }, [canPlayInline, player]);

  /* A daily click starts the local video immediately, but never hands it to a
   * browser or native full-screen player. */
  useEffect(() => {
    setPlaying(false);
    setEnded(false);
    setPosition(0);
    setDuration(0);
    setAspect(16 / 9);
    setError('');
    if (!video || !canPlayInline) return;
    const t = setTimeout(() => {
      try {
        player.play();
      } catch {
        setError('Tap play to start this video.');
      }
    }, 120);
    return () => clearTimeout(t);
  }, [videoKey, canPlayInline, player]);

  useEffect(() => {
    if (!video) {
      try {
        player.pause();
      } catch {}
      silenceMedia();
    }
  }, [video, player]);

  /* pass 102 - on-device poster fallback. dl_video_generate_random_thumbnail()
   * needs ffmpeg, and plenty of shared hosts disable exec(), so an upload can
   * legitimately arrive with no poster_url. expo-video can pull a frame straight
   * out of the loaded asset (Android/iOS only), which keeps the promise of "a
   * random thumbnail picked from the uploaded video" even then. Best-effort:
   * any failure just leaves the player's own first frame. */
  useEffect(() => {
    setAutoThumb(null);
    if (!canPlayInline || thumb) return;
    if (Platform.OS === 'web') return;
    let alive = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const gen = (player as unknown as {
            generateThumbnailsAsync?: (times: number | number[]) => Promise<unknown[]>;
          }).generateThumbnailsAsync;
          if (typeof gen !== 'function') return;
          const total = Number(player.duration ?? 0);
          const at = total > 2 ? total * (0.2 + Math.random() * 0.5) : 0.4;
          const shots = await gen.call(player, [at]);
          if (alive && shots?.length) setAutoThumb(shots[0]);
        } catch {
          /* no thumbnail - the video still plays */
        }
      })();
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [canPlayInline, thumb, videoKey, player]);

  const togglePlayback = () => {
    if (!canPlayInline) return;
    try {
      if (ended || (duration > 0 && position >= duration - 0.25)) {
        player.currentTime = 0;
        setPosition(0);
        setEnded(false);
      }
      if (playing) player.pause();
      else player.play();
    } catch {
      setError('This video could not be played in the app.');
    }
  };

  const seek = (x: number) => {
    if (!canPlayInline || duration <= 0) return;
    const next = clamp01(x / Math.max(1, barWidth)) * duration;
    try {
      player.currentTime = next;
      setPosition(next);
      setEnded(false);
    } catch {}
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try {
      player.muted = next;
    } catch {}
  };

  const maxHeight = Dimensions.get('window').height * 0.58;
  const frameHeight = aspect < 0.9
    ? Math.min(maxHeight, frameWidth / Math.max(0.1, aspect))
    : Math.min(230, frameWidth / Math.max(0.1, aspect));


  return (
    <Modal visible={!!video} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(4,8,6,0.94)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        onPress={onClose}
      >
        {/* pass 102 - "when i clicked play its still disappearing". The card was
            a plain <View> relying on onStartShouldSetResponder to stop the
            backdrop's onPress={onClose}. That responder never claims on web, so a
            tap anywhere on the card - the play button, the seek bar, the title -
            bubbled to the backdrop and closed the modal. The card is now a
            Pressable with a no-op handler (it owns the touch), and the web event
            is stopped explicitly. Only a genuine backdrop tap or the X closes it. */}
        <Pressable
          onPress={stopBubble}
          onStartShouldSetResponder={() => true}
          style={{
            width: 330,
            maxHeight: '94%',
            borderRadius: 26,
            overflow: 'hidden',
            backgroundColor: '#0B1512',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
            <T v="caption" numberOfLines={1} style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '700' }}>
              {isEmbed ? 'YouTube · playing in DeenLink' : 'Daily video · playing in DeenLink'}
            </T>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
              <FontAwesome5 name="times" size={15} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>

          {isEmbed ? (
            <View style={{ width: 302, height: 220, alignSelf: 'center', backgroundColor: '#000' }}>
              <YouTubePlayer embedUrl={String(video?.embed_url)} height={220} autoStart />
            </View>
          ) : (
            <View
              onLayout={(event) => setFrameWidth(Math.max(240, event.nativeEvent.layout.width))}
              style={{ width: 302, height: frameHeight, alignSelf: 'center', backgroundColor: '#000', overflow: 'hidden' }}
            >
              {canPlayInline ? (
                <>
                  <VideoView
                    style={{ width: '100%', height: '100%' }}
                    player={player}
                    contentFit="contain"
                    /* pass 102 - THIS IS THE FIX for "it hands off to the
                     * native/browser player". expo-video's `nativeControls`
                     * DEFAULTS TO true, so merely omitting the prop left the
                     * platform controls switched ON underneath DeenLink's own
                     * overlay: a tap could hit the native bar and its fullscreen
                     * button and leave the app player entirely. Every native
                     * affordance is now explicitly off. */
                    nativeControls={false}
                    fullscreenOptions={{ enable: false }}
                    buttonOptions={{
                      showPlayPause: false,
                      showNext: false,
                      showPrevious: false,
                      showSeekForward: false,
                      showSeekBackward: false,
                      showSettings: false,
                      showSubtitles: false,
                    }}
                  />
                  {/* pass 102 - "it should have the thumbnail that i told you, a
                      random thumbnail picked from the uploaded video". Shown over
                      the player until playback actually starts, so the modal opens
                      on a real frame instead of black, and stays up while the file
                      buffers. pointerEvents="none" keeps every tap on the play
                      button underneath it. */}
                  {!playing && posterSource ? (
                    <ExpoImage
                      source={posterSource}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                      contentFit="contain"
                      transition={200}
                      pointerEvents="none"
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={playing ? 'Pause video' : ended ? 'Replay video' : 'Play video'}
                    onPress={togglePlayback}
                    style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {!playing ? (
                      <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={ended ? 'redo' : 'play'} size={20} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                  {error ? (
                    <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,10,8,0.7)', padding: 20 }} pointerEvents="none">
                      <FontAwesome5 name="exclamation-circle" size={22} color="#FFB0B0" />
                      <T v="caption" style={{ color: '#fff', fontSize: 11, textAlign: 'center', marginTop: 9 }}>{error}</T>
                    </View>
                  ) : null}
                  <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, bottom: 9 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7 }}>
                      <Pressable onPress={togglePlayback} hitSlop={7}>
                        <FontAwesome5 name={playing ? 'pause' : ended ? 'redo' : 'play'} size={12} color="#fff" />
                      </Pressable>
                      <Pressable
                        onPress={(event) => seek(event.nativeEvent.locationX)}
                        onLayout={(event) => setBarWidth(Math.max(1, event.nativeEvent.layout.width))}
                        style={{ flex: 1, height: 14, justifyContent: 'center' }}
                      >
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                          <View style={{ height: 4, width: `${duration ? clamp01(position / duration) * 100 : 0}%`, backgroundColor: '#4AE38F' }} />
                        </View>
                      </Pressable>
                      <T v="caption" style={{ color: 'rgba(255,255,255,0.82)', fontSize: 9, minWidth: 62, textAlign: 'right' }}>
                        {mmss(position)} / {duration ? mmss(duration) : '--:--'}
                      </T>
                      <Pressable onPress={toggleMute} hitSlop={7}>
                        <FontAwesome5 name={muted ? 'volume-mute' : 'volume-up'} size={12} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {thumb ? <Image source={typeof thumb === 'number' ? thumb : { uri: String(thumb) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
                  <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,10,8,0.42)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="ban" size={19} color="rgba(255,255,255,0.78)" />
                    <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10.5, marginTop: 10, fontWeight: '600' }}>Video unavailable in the app</T>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', gap: 10 }}>
            <T v="body" style={{ color: '#fff', fontSize: 14.5, fontWeight: '700', lineHeight: 19 }}>
              {video?.title ?? 'Daily reminder'}
            </T>
            {video?.description ? (
              <T v="caption" style={{ color: 'rgba(255,255,255,0.58)', fontSize: 11.5, lineHeight: 16 }}>
                {video.description}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 }}>
              <Pressable hitSlop={8} onPress={onLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <FontAwesome5 name="heart" size={15} color={liked ? '#FF5A5A' : 'rgba(255,255,255,0.75)'} />
                <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>{fmtViews(video?.like_count)}</T>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <FontAwesome5 name="comment" size={14} color="rgba(255,255,255,0.75)" />
                <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>{fmtViews(video?.view_count)}</T>
              </View>
              <Pressable hitSlop={8} onPress={() => video && Share.share({ message: `${video.title ?? 'Daily reminder'} — ${video.source_url ?? ''}` }).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <FontAwesome5 name="share-alt" size={14} color="rgba(255,255,255,0.75)" />
                <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>Share</T>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
