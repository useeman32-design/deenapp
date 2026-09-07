import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { goBack } from '@/lib/navigation';
import { haptic } from '@/lib/haptics';
import { DP_KEY, DP_DEFAULT, DPIcon, RewardModal } from '@/components/DeenPoints';
import { storage } from '@/lib/storage';
import { deenpointsHistory, isLive, pointsQuote, type PointsEvent, type PointsPricing } from '@/api/client';
import { buyDeenPoints, settlePendingPayment } from '@/lib/flutterwave';

/**
 * pass 69 — DeenPoints wallet: live balance, real ledger history, and buying
 * points through Flutterwave (inline modal on web, hosted page on native).
 * Pricing comes from quote_deenpoints.php (₦ per point × FX when outside NGN).
 */
const PRESETS = [500, 1000, 2500, 5000];

const eventLabel = (e: PointsEvent): string => {
  const t = String(e.event_type || '').toLowerCase();
  if (t.includes('purchase') || t.includes('deenpoints_purchase')) return 'Points purchase';
  if (t.includes('checkin') || t.includes('check_in')) return 'Daily check-in';
  if (t.includes('unlock')) return 'Course unlock';
  if (t.includes('question') || t.includes('ask')) return 'Ask a Scholar';
  if (t.includes('admin')) return 'DeenLink adjustment';
  if (t.includes('reward')) return 'Reward';
  if (t.includes('quiz')) return 'Quiz';
  return String(e.event_type || 'Activity').replace(/_/g, ' ');
};

const fmtDate = (dt: string) => {
  const d = new Date(String(dt || '').replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export default function DeenPointsScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const green = isDark ? '#4AE38F' : '#0E7A46';

  const [balance, setBalance] = useState<number | null>(null);
  const [events, setEvents] = useState<PointsEvent[]>([]);
  const [pricing, setPricing] = useState<PointsPricing | null>(null);
  const [points, setPoints] = useState(1000);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  /* pass 82 — ledger pagination + shared reward modal */
  const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [reward, setReward] = useState<{ amount: number; title: string } | null>(null);

  const pull = useCallback(() => {
    if (!isLive()) {
      storage.getItem(DP_KEY).then((r) => {
        const n = r ? parseInt(r, 10) : NaN;
        setBalance(Number.isFinite(n) ? n : DP_DEFAULT);
      }).catch(() => setBalance(DP_DEFAULT));
      return;
    }
    deenpointsHistory(20, 0).then((r) => {
      if (r) { setBalance(r.balance); setEvents(r.events); setHasMore(r.hasMore); storage.setItem(DP_KEY, String(r.balance)).catch(() => {}); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    pull();
    if (isLive()) { pointsQuote().then(setPricing).catch(() => {}); }
  }, [pull]);

  /* native: the user may be coming back from the hosted checkout page */
  useFocusEffect(useCallback(() => {
    pull();
    void (async () => {
      const settled = await settlePendingPayment();
      if (settled?.verified) {
        setNotice({ ok: true, text: settled.balance != null ? `Payment confirmed — balance ${settled.balance} pts 🎉` : 'Payment confirmed 🎉' });
        pull();
      } else if (settled && !settled.verified) {
        setNotice({ ok: false, text: 'No completed payment found yet. If you just paid, pull down or reopen this screen in a moment.' });
      }
    })();
  }, [pull]));

  const loadMore = () => {
    if (moreBusy) return;
    setMoreBusy(true);
    deenpointsHistory(20, events.length).then((r) => {
      if (r) {
        setEvents((prev) => {
          const seen = new Set(prev.map((x) => `${x.created_at}|${x.event_type}|${x.delta}`));
          return [...prev, ...r.events.filter((e) => !seen.has(`${e.created_at}|${e.event_type}|${e.delta}`))];
        });
        setHasMore(r.hasMore);
      }
    }).catch(() => {}).finally(() => setMoreBusy(false));
  };

  const pricePer = pricing?.price_per_point_ngn ?? 1.5;
  const rate = pricing?.rate_ngn_to_currency ?? 1;
  const ccy = pricing?.currency ?? 'NGN';
  const amount = points * pricePer * (ccy === 'NGN' ? 1 : rate);
  const money = `${ccy === 'NGN' ? '₦' : ccy === 'USD' ? '$' : ''}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}${ccy !== 'NGN' && ccy !== 'USD' ? ` ${ccy}` : ''}`;

  const buy = async () => {
    if (busy) return;
    const pts = custom ? parseInt(custom, 10) : points;
    if (!pts || pts < 100) { setNotice({ ok: false, text: 'Minimum purchase is 100 DeenPoints.' }); return; }
    haptic.light();
    setBusy(true);
    setNotice(null);
    const r = await buyDeenPoints(pts).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setNotice({ ok: false, text: r?.message ?? 'Could not start the payment.' }); return; }
    if (r.verified) {
      setNotice({ ok: true, text: r.balance != null ? `Payment confirmed — balance ${r.balance} pts 🎉` : 'Payment confirmed 🎉' });
      if (pts >= 2500) setReward({ amount: Math.floor(pts * 0.1), title: 'Bulk top-up bonus earned!' }); /* +10% server-granted */
      pull();
    }
    else { setNotice({ ok: true, text: r.message ?? 'Finish the payment — your points land after verification.' }); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={green} />
        </Pressable>
        <T v="h2" style={{ flex: 1, fontWeight: '800', fontSize: 17, color: d.text }}>DeenPoints</T>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
        {/* pass 80 — hero art */}
        <Image source={require('../../../assets/img/deenpoints_banner.jpg')} style={{ width: '100%', height: 132, borderRadius: 18 }} resizeMode="cover" />

        {/* balance card */}
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.25)', backgroundColor: isDark ? 'rgba(46,204,113,0.08)' : 'rgba(14,122,70,0.06)', padding: 16 }}>
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: d.faint }}>YOUR BALANCE</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 }}>
            <DPIcon size={26} />
            {balance === null ? <ActivityIndicator size="small" color={green} /> : (
              <T v="h1" style={{ fontSize: 30, fontWeight: '900', color: d.text }}>{balance.toLocaleString()}</T>
            )}
            <T v="caption" style={{ fontSize: 11, color: d.faint, marginTop: 8 }}>pts</T>
          </View>
          <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 8, lineHeight: 15 }}>
            Earn points daily (check-in, Qur'an, dhikr, quizzes) or top up below. Spend them on course unlocks and priority scholar questions.
          </T>
        </View>

        {/* pass 80 — offers (real, server-enforced) */}
        <View>
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: d.faint, marginBottom: 9 }}>OFFERS</T>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.35)' : 'rgba(184,134,11,0.3)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(184,134,11,0.06)', padding: 13 }}>
              <FontAwesome5 name="fire" size={16} color={isDark ? '#D4AF37' : '#B8860B'} />
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>7-day streak · +20 bonus</T>
                <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 2, lineHeight: 15 }}>Check in 7 days in a row — every 7th day pays +20 on top of your daily +5.</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.07)' : 'rgba(14,122,70,0.05)', padding: 13 }}>
              <FontAwesome5 name="gem" size={16} color={green} />
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>Bulk top-up · +10% points</T>
                <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 2, lineHeight: 15 }}>Buy 2,500 DeenPoints or more and 10% extra lands free with your purchase.</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13 }}>
              <FontAwesome5 name="book-reader" size={16} color={green} />
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>Learn & earn</T>
                <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 2, lineHeight: 15 }}>Quizzes +10 · finishing lessons +20 · dhikr & Qur'an goals keep the streak alive.</T>
              </View>
            </View>
          </View>
        </View>

        {/* buy */}
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 16, gap: 12 }}>
          <T v="bodyS" style={{ fontWeight: '800', fontSize: 13.5, color: d.text }}>Buy DeenPoints</T>
          {/* pass 82 — selectable price cards with the real DeenPoints coin */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {[500, 1000, 2500, 5000, 10000, 20000].map((p) => {
              const on = !custom && points === p;
              const ngn = p * pricePer;
              return (
                <Pressable
                  key={p}
                  onPress={() => { haptic.selection(); setCustom(''); setPoints(p); }}
                  accessibilityLabel={`buy ${p} deenpoints`}
                  style={({ pressed }) => ({ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 11, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1.5, borderColor: on ? (isDark ? 'rgba(74,227,143,0.6)' : 'rgba(29,111,66,0.5)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(14,122,70,0.08)') : 'transparent', opacity: pressed ? 0.8 : 1 })}
                >
                  <DPIcon size={24} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyS" style={{ fontWeight: '900', fontSize: 13.5, color: on ? green : d.text }}>{p.toLocaleString()} pts</T>
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>₦{ngn.toLocaleString(undefined, { maximumFractionDigits: 0 })}{p >= 2500 ? ' · +10% bonus' : ''}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)' }}>
            <FontAwesome5 name="edit" size={10} color={d.faint} />
            <TextInput
              value={custom}
              onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, ''))}
              placeholder="Custom amount (min 100)"
              placeholderTextColor={d.faint}
              keyboardType="number-pad"
              style={{ flex: 1, fontSize: 13, color: d.text, paddingVertical: 11 }}
            />
          </View>
          {((custom ? parseInt(custom, 10) || 0 : points) >= 2500) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(14,122,70,0.07)', paddingHorizontal: 11, paddingVertical: 8 }}>
              <FontAwesome5 name="gift" size={11} color={green} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: green }}>
                Bulk bonus active — you receive {Math.floor((custom ? parseInt(custom, 10) || 0 : points) * 1.1).toLocaleString()} pts (+10%)
              </T>
            </View>
          ) : null}
          <Pressable
            onPress={() => { void buy(); }}
            disabled={busy || !isLive()}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 13, paddingVertical: 13, backgroundColor: busy || !isLive() ? d.bgSoft : green, opacity: pressed ? 0.85 : 1 })}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="bolt" size={12} color="#fff" />}
            <T v="bodyS" style={{ fontWeight: '900', fontSize: 13, color: busy || !isLive() ? d.faint : '#fff' }}>
              {!isLive() ? 'Demo mode — connect to buy' : busy ? 'Opening checkout…' : `Pay ${money}`}
            </T>
          </Pressable>
          {isLive() ? (
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', lineHeight: 14 }}>
              ₦{pricePer}/point · secured by Flutterwave · card, bank transfer, USSD & mobile money
            </T>
          ) : null}
          {notice ? (
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: notice.ok ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : 'rgba(255,90,90,0.4)', backgroundColor: notice.ok ? (isDark ? 'rgba(46,204,113,0.10)' : 'rgba(14,122,70,0.06)') : 'rgba(255,90,90,0.07)', padding: 11 }}>
              <T v="caption" style={{ fontSize: 11, lineHeight: 16, color: notice.ok ? green : '#FF6B6B' }}>{notice.text}</T>
            </View>
          ) : null}
        </View>

        {/* history */}
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 16, gap: 4 }}>
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: d.faint, marginBottom: 8 }}>HISTORY</T>
          {!isLive() ? (
            <T v="caption" style={{ fontSize: 11, color: d.faint, paddingVertical: 10 }}>Point history is available on the live app.</T>
          ) : events.length === 0 ? (
            <T v="caption" style={{ fontSize: 11, color: d.faint, paddingVertical: 10 }}>No activity yet — do your daily check-in to earn your first points.</T>
          ) : events.map((e, i) => (
            <View key={`${e.created_at}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.06)' }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: e.delta >= 0 ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.08)') : 'rgba(255,90,90,0.10)' }}>
                <FontAwesome5 name={e.delta >= 0 ? 'plus' : 'minus'} size={10} color={e.delta >= 0 ? green : '#FF6B6B'} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bodyS" style={{ fontSize: 12, fontWeight: '700', color: d.text }}>{eventLabel(e)}</T>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{fmtDate(e.created_at)}</T>
              </View>
              <T v="caption" style={{ fontSize: 12, fontWeight: '900', color: e.delta >= 0 ? green : '#FF6B6B' }}>{e.delta >= 0 ? '+' : ''}{e.delta}</T>
            </View>
          ))}
          {isLive() && hasMore ? (
            <Pressable onPress={loadMore} disabled={moreBusy} accessibilityLabel="load more history"
              style={{ marginTop: 8, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
              {moreBusy ? <ActivityIndicator size="small" color={green} /> : <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: green }}>Load more</T>}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* pass 82 — same celebration modal as the daily check-in */}
      <RewardModal visible={!!reward} amount={reward?.amount ?? 0} title={reward?.title ?? ''} onClose={() => { setReward(null); pull(); }} />
    </View>
  );
}
