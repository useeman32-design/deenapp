import { Image, Linking, Modal, Platform, Pressable, Share, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { YouTubeFrame } from '@/components/FeedCard';
import type { Video } from '@/api/types';

export function fmtViews(n?: number | null) {
  if (!n) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

/**
 * Video viewing modal (reels/shorts-style preview).
 * Web: real YouTube iframe. Native (Expo Go): player-style preview with the
 * actual thumbnail + explicit "Watch on YouTube" handoff — Expo Go cannot
 * embed a live YouTube player (would need a dev build + webview library).
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

  return (
    <Modal visible={!!video} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(4,8,6,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        onPress={onClose}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{ width: 330, borderRadius: 26, overflow: 'hidden', backgroundColor: '#0B1512', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {Platform.OS === 'web' && video?.embed_url ? (
            <View style={{ height: 300, backgroundColor: '#07100C', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 302 }}>
                <YouTubeFrame src={String(video.embed_url)} height={208} />
              </View>
              <T v="caption" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 10 }}>
                Now playing on YouTube
              </T>
            </View>
          ) : (
            <View style={{ width: 302 }}>
              {/* Player-style preview: real thumbnail + play */}
              <View style={{ width: 302, height: 170, borderRadius: 14, overflow: 'hidden', backgroundColor: '#07100C', marginBottom: 12 }}>
                {(() => {
                  const th = (video?.thumb as number | string | null | undefined) ?? (video?.poster_url as string | null | undefined);
                  return th ? (
                    <Image
                      source={typeof th === 'number' ? th : { uri: String(th) }}
                      style={{ width: 302, height: 170 }}
                      resizeMode="cover"
                    />
                  ) : null;
                })()}
                <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,10,8,0.42)' }} />
                <Pressable
                  onPress={() => video?.source_url && Linking.openURL(video.source_url).catch(() => {})}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: d.emerald,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: d.emerald,
                      shadowOpacity: 0.55,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 5 },
                      elevation: 8,
                    }}
                  >
                    <FontAwesome5 name="play" size={19} color="#fff" style={{ marginLeft: 3 }} />
                  </View>
                  <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10.5, marginTop: 10, fontWeight: '600' }}>
                    Tap to play
                  </T>
                  {video?.duration ? (
                    <View
                      style={{
                        position: 'absolute',
                        right: 10,
                        bottom: 10,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        borderRadius: 7,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <T v="caption" style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                        {String(video.duration)}
                      </T>
                    </View>
                  ) : null}
                </Pressable>
              </View>
              <Pressable
                onPress={() => video?.source_url && Linking.openURL(video.source_url).catch(() => {})}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: d.gold,
                  borderRadius: 12,
                  paddingVertical: 11,
                }}
              >
                <FontAwesome5 name="youtube" size={14} color="#0B1512" />
                <T v="body" style={{ color: '#0B1512', fontSize: 13, fontWeight: '700' }}>
                  Watch on YouTube
                </T>
              </Pressable>
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
                <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>
                  {fmtViews(video?.like_count)}
                </T>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <FontAwesome5 name="comment" size={14} color="rgba(255,255,255,0.75)" />
                <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>
                  {fmtViews(video?.view_count)}
                </T>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  video &&
                  Share.share({ message: `${video.title ?? 'Daily reminder'} — ${video.source_url ?? ''}` }).catch(() => {})
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <FontAwesome5 name="share-alt" size={14} color="rgba(255,255,255,0.75)" />
                <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>
                  Share
                </T>
              </Pressable>
              <View style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
