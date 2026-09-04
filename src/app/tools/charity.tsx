import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { stopBubble } from '@/lib/press';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { Image } from 'react-native';
import { fetchNisab } from '@/lib/islamicApi';
import { DPIcon, DeenPointsBuyModal, useDeenPoints } from '@/components/DeenPoints';
import { markGoal } from '@/lib/routine';

/**
 * Donations (pass 34 — full rebuild):
 *  3 categories → amount + currency → simulated payment → shareable receipt.
 *  · Donate to DeenLink — sadaqah jariyah (Quran 2:261 + Muslim 1631)
 *  · Sadaqah — choose the kind of recipients Islam encourages
 *  · Zakat — the 2.5% purification, recipients = the eight asnaf (9:60)
 *  · Agency + processing fee (5%) is deducted and shown on the receipt.
 *  · History screen: every payment, its receipt, and a report flag.
 */

type Cat = 'deenlink' | 'sadaqah' | 'zakat';
type Dono = {
  id: string;
  cat: Cat;
  recipient: string;
  amount: number;
  currency: string;
  feePct: number;
  at: number;
  ref: string;
  reported?: boolean;
};

const K: string[] = [];
void K;

/* pass 39 — "Donate to DeenLink" removed per user; Zakat → Sadaqah */
const CATS: Array<{ id: Cat; icon: string; title: string; sub: string; tint: string; grad: [string, string] }> = [
  {
    /* pass 40 — the Support DeenLink card is BACK (it never should have
     * left; only the inner purpose selector was removed) */
    id: 'deenlink',
    icon: 'seedling',
    title: 'Support DeenLink',
    sub: 'Sadaqah jariyah — keep the app free for every Muslim',
    tint: '#4AE38F',
    grad: ['#0E3B26', '#06140D'],
  },
  {
    id: 'zakat',
    icon: 'balance-scale',
    title: 'Zakat',
    sub: 'The purifying due — 2.5% of qualifying wealth',
    tint: '#E8C96A',
    grad: ['#4A3A12', '#2A2008'],
  },
  {
    id: 'sadaqah',
    icon: 'hand-holding-heart',
    title: 'Sadaqah',
    sub: 'Voluntary charity for those who need it',
    tint: '#5BC8F5',
    grad: ['#123B52', '#0A2334'],
  },
];

const RECIPIENTS: Record<Cat, string[]> = {
  deenlink: [], /* removed as a category — key kept for old receipts */
  sadaqah: ['The poor (fuqara)', 'The needy (masakin)', 'Orphans', 'Widows', 'Food for the hungry', 'Water wells', 'Medical treatment', 'Education', 'Mosques', 'Emergency relief'],
  zakat: ['The poor (fuqara)', 'The needy (masakin)', 'Those employed to collect it', 'New Muslims & hearts to reconcile', 'Freeing captives / those in debt', 'In the cause of Allah', 'Stranded travellers'],
};

const CURRENCIES = ['NGN ₦', 'USD $', 'GBP £', 'EUR €', 'SAR ﷼', 'GHS ₵', 'KES KSh', 'ZAR R', 'AED د.إ', 'CAD $'];
const FEE_PCT = 5;

const store = {
  async load(): Promise<Dono[]> {
    try { return JSON.parse((await storage.getItem('dl.donations.v1')) ?? '[]') as Dono[]; } catch { return []; }
  },
  async save(list: Dono[]) { storage.setItem('dl.donations.v1', JSON.stringify(list)).catch(() => {}); },
};

const fmtDate = (t: number) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function receiptText(d: Dono) {
  const fee = (d.amount * d.feePct) / 100;
  return `DEENLINK DONATION RECEIPT
─────────────────────
Ref:          ${d.ref}
Date:         ${fmtDate(d.at)}
Category:     ${d.cat === 'deenlink' ? 'Donate to DeenLink (sadaqah jariyah)' : d.cat === 'sadaqah' ? 'Sadaqah' : 'Zakat'}
For:          ${d.recipient}
Amount:       ${d.currency} ${d.amount.toLocaleString()}
Fee (${d.feePct}%):  −${d.currency} ${fee.toFixed(2)}
Delivered:    ${d.currency} ${(d.amount - fee).toFixed(2)}
Status:       ✓ Completed (simulated)
─────────────────────
JazakAllahu khairan — may Allah accept it from you.`;
}

/* pass 35 — branded receipt: real logo, watermark, dashed dividers */
function ReceiptCard({ rcpt, d, isDark, fmtDate }: { rcpt: Dono; d: { text: string; subtext: string; faint: string; card: string; cardBorder: string; bgSoft: string }; isDark: boolean; fmtDate: (t: number) => string }) {
  const cat = rcpt.cat;
  const delivered = rcpt.amount - (rcpt.amount * rcpt.feePct) / 100;
  return (
    <View style={{ width: '100%', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: d.card }}>
      {/* pass 40 — dark-green gradient band + subtle 8-point star texture behind the logo */}
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <LinearGradient colors={['#14532D', '#0B1F14', '#06140D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.10, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          {[0, 1].map((r) =>
            [0, 1, 2, 3, 4, 5].map((c) => (
              <View key={`${r}-${c}`} style={{ position: 'absolute', left: 14 + c * 62, top: 8 + r * 44, width: 26, height: 26, borderWidth: 1.4, borderColor: '#E8C96A', transform: [{ rotate: '45deg' }] }} />
            )),
          )}
        </View>
        <ExpoImage source={require('../../../assets/img/logo-export.png')} style={{ width: 52, height: 52, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.8)' }} contentFit="cover" />
        <T v="h3" style={{ marginTop: 8, fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.4 }}>DEENLINK</T>
        <T v="caption" style={{ fontSize: 9, letterSpacing: 1.4, color: '#E8C96A', marginTop: 2 }}>DONATION RECEIPT</T>
      </View>
      {/* watermark */}
      <View style={{ position: 'absolute', top: 120, left: 0, right: 0, bottom: 60, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-18deg' }], opacity: 0.05 }} pointerEvents="none">
        <T v="h1" style={{ fontSize: 44, fontWeight: '900', color: d.text }}>DEENLINK</T>
      </View>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, color: '#E8C96A' }}>REF {rcpt.ref}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: 'rgba(74,227,143,0.14)', paddingHorizontal: 8, paddingVertical: 3 }}>
            <FontAwesome5 name="check" size={8} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>PAID</T>
          </View>
        </View>
        {[
          ['Date', fmtDate(rcpt.at)],
          ['Category', cat === 'deenlink' ? 'DeenLink — sadaqah jariyah' : cat === 'sadaqah' ? 'Sadaqah' : 'Zakat'],
          ['Given to', rcpt.recipient],
        ].map(([k2, v]) => (
          <View key={k2} style={{ flexDirection: 'row', paddingVertical: 6 }}>
            <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>{k2}</T>
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: d.text, maxWidth: '62%', textAlign: 'right' }}>{v}</T>
          </View>
        ))}
        {/* dashed divider */}
        <View style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: d.cardBorder, borderRadius: 1, marginVertical: 8 }} />
        <View style={{ flexDirection: 'row', paddingVertical: 3 }}>
          <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>Amount given</T>
          <T v="caption" style={{ fontSize: 11.5, fontWeight: '900', color: d.text }}>{rcpt.currency} {rcpt.amount.toLocaleString()}</T>
        </View>
        <View style={{ flexDirection: 'row', paddingVertical: 3 }}>
          <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>Agency + processing ({rcpt.feePct}%)</T>
          <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: '#C0392B' }}>−{rcpt.currency} {((rcpt.amount * rcpt.feePct) / 100).toFixed(2)}</T>
        </View>
        <View style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: d.cardBorder, marginTop: 4 }}>
          <T v="caption" style={{ flex: 1, fontSize: 11, fontWeight: '800', color: d.text }}>Delivered to recipient</T>
          <T v="caption" style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#4AE38F' : '#1D6F42' }}>{rcpt.currency} {delivered.toFixed(2)}</T>
        </View>
        <T v="caption" style={{ fontSize: 8.5, color: d.faint, textAlign: 'center', marginTop: 8, lineHeight: 12 }}>
          May Allah accept it from you. Simulated payment — no funds moved.\ndeenlink · Strengthen Your Deen, Every Day
        </T>
      </View>
    </View>
  );
}

export default function Donations() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<'menu' | 'form' | 'paying' | 'done' | 'history'>('menu');
  const [buyPoints, setBuyPoints] = useState(false);
  const dp = useDeenPoints();
  /* pass 35 — zakat calculator sheet */
  const [calc, setCalc] = useState(false);
  const [nisab, setNisab] = useState<{ gold: number; silver: number; rate: string; currency: string } | null>(null);
  const [wealth, setWealth] = useState({ gold: '', silver: '', cash: '', business: '', debts: '' });
  /* pass 39 — live prices, grams entry, no auto-calc */
  const [liveP, setLiveP] = useState<{ gold: number; silver: number } | null>(null);
  const [calcDone, setCalcDone] = useState(false);
  const [cat, setCat] = useState<Cat>('zakat');
  /* pass 39 — recipients are MULTI-select (select all that apply) */
  const [recipients, setRecipients] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [curIdx, setCurIdx] = useState(0);
  const [last, setLast] = useState<Dono | null>(null);
  const [history, setHistory] = useState<Dono[]>([]);
  const [openReceipt, setOpenReceipt] = useState<Dono | null>(null);

  useEffect(() => { store.load().then(setHistory).catch(() => {}); }, []);

  const cur = CURRENCIES[curIdx];
  const amt = Number(amount.replace(/[^0-9.]/g, ''));
  const recipient = recipients.join(', ');
  const valid = amt > 0 && recipients.length > 0;

  const start = (c: Cat) => {
    haptic.selection();
    setCat(c);
    setRecipients([]);
    setAmount('');
    setView('form');
  };

  const toggleRecipient = (r: string) => {
    haptic.selection();
    setRecipients((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  };

  const pay = () => {
    markGoal('charity'); // pass 44 — Today's Goal auto-detect
    if (!valid) return;
    haptic.success();
    setView('paying');
    setTimeout(() => {
      const dono: Dono = {
        id: `d${Date.now()}`,
        cat,
        recipient,
        amount: amt,
        currency: cur.split(' ')[0],
        feePct: FEE_PCT,
        at: Date.now(),
        ref: `DL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      };
      const next = [dono, ...history];
      setHistory(next);
      store.save(next);
      setLast(dono);
      setView('done');
    }, 1600);
  };

  const share = (dono: Dono) => {
    haptic.selection();
    Share.share({ message: receiptText(dono) }).catch(() => {});
  };

  const report = (dono: Dono) => {
    haptic.selection();
    const next = history.map((x) => (x.id === dono.id ? { ...x, reported: true } : x));
    setHistory(next);
    store.save(next);
    setOpenReceipt(null);
  };

  const CAT = useMemo(() => CATS.find((c) => c.id === cat)!, [cat]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Donations" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {view === 'menu' ? (
          <>
            {/* pass 39 — hero rearranged: icon header, ayah, translation, hadith */}
            <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', marginBottom: 14 }}>
              <ExpoImage source={require('../../../assets/img/mecca.jpg')} style={{ width: '100%', height: 258 }} contentFit="cover" />
              <LinearGradient colors={['rgba(6,20,13,0.55)', 'rgba(6,20,13,0.88)', 'rgba(6,20,13,0.96)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 16, justifyContent: 'flex-end' }}>
                {/* icon + title row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.16)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="hand-holding-heart" size={14} color="#E8C96A" />
                  </View>
                  <T v="h3" style={{ fontWeight: '900', fontSize: 15.5, color: '#FFFFFF', flex: 1 }}>Give for the sake of Allah</T>
                </View>
                <T v="bodyS" style={{ fontFamily: 'Amiri-Bold', fontSize: 15.5, lineHeight: 28, color: '#E8C96A', textAlign: 'right' }}>
                  مَّثَلُ الَّذِينَ يُنفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنبَتَتْ سَبْعَ سَنَابِلَ فِي كُلِّ سُنبُلَةٍ مِّائَةُ حَبَّةٍ ۗ وَاللَّهُ يُضَاعِفُ لِمَن يَشَاءُ
                </T>
                <T v="caption" style={{ fontSize: 9.5, color: 'rgba(242,247,243,0.85)', marginTop: 7, lineHeight: 14 }}>
                  “The example of those who spend their wealth in the way of Allah is like a grain that sprouts seven ears; in every ear is a hundred grains. And Allah multiplies for whom He wills.” — Quran 2:261
                </T>
                <View style={{ height: 1, backgroundColor: 'rgba(212,175,55,0.3)', marginVertical: 9 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <FontAwesome5 name="bookmark" size={9} color="rgba(242,247,243,0.6)" />
                  <T v="caption" style={{ fontSize: 9.5, color: 'rgba(242,247,243,0.75)', lineHeight: 14, fontStyle: 'italic', flex: 1 }}>
                    “When a person dies, his deeds end except three: ongoing charity, beneficial knowledge, or a righteous child who prays for him.” — Muslim 1631
                  </T>
                </View>
              </View>
            </View>

            {/* DeenPoints balance chip → purchase modal */}
            <Pressable
              accessibilityLabel="deenpoints balance"
              onPress={() => { haptic.selection(); setBuyPoints(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.06)', paddingHorizontal: 13, paddingVertical: 10, marginBottom: 14 }}
            >
              <DPIcon size={15} />
              <T v="bodyS" style={{ flex: 1, fontWeight: '800', fontSize: 13, color: d.text }}>{dp.points.toLocaleString()} DeenPoints</T>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#E8C96A' }}>GET MORE · ₦1.5/PT</T>
            </Pressable>

            {CATS.map((c) => (
              <Pressable
                key={c.id}
                accessibilityLabel={`donate ${c.title}`}
                onPress={() => start(c.id)}
                style={({ pressed }) => ({
                  borderRadius: 20,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: `${c.tint}44`,
                  marginBottom: 12,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', gap: 14, padding: 16, backgroundColor: isDark ? `${c.tint}0D` : `${c.tint}0A` }}>
                  <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: `${c.tint}1E`, borderWidth: 1, borderColor: `${c.tint}55`, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={c.icon as never} size={18} color={c.tint} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text }}>{c.title}</T>
                    <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 2 }}>{c.sub}</T>
                  </View>
                  <FontAwesome5 name="chevron-right" size={13} color={d.faint} style={{ alignSelf: 'center' }} />
                </View>
              </Pressable>
            ))}

            <Pressable
              accessibilityLabel="donation history"
              onPress={() => { haptic.selection(); setView('history'); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 15, marginTop: 2 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="history" size={14} color={d.subtext} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="body" style={{ fontWeight: '800', fontSize: 13.5, color: d.text }}>History</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{history.length ? `${history.length} payment${history.length > 1 ? 's' : ''} · receipts & reports` : 'No payments yet'}</T>
              </View>
              <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
            </Pressable>

            <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 16, lineHeight: 15, marginHorizontal: 20 }}>
              Payments are simulated in this build. An agency + processing fee of {FEE_PCT}% is deducted from every donation and shown on the receipt.
            </T>
          </>
        ) : null}

        {view === 'form' ? (
          <>
            <Pressable onPress={() => setView('menu')} hitSlop={10} style={{ marginBottom: 12 }}>
              <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '700' }}>‹ Back</T>
            </Pressable>
            {/* pass 39 — dark gradient header with islamic star texture */}
            <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', marginBottom: 16 }}>
              <LinearGradient colors={CAT.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 15 }}>
                {/* 8-point star lattice texture */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.14 }} pointerEvents="none">
                  {[0, 1, 2].map((r) =>
                    [0, 1, 2, 3, 4].map((c) => (
                      <View key={`${r}-${c}`} style={{ position: 'absolute', top: -18 + r * 34, left: -18 + c * 84, width: 34, height: 34, borderWidth: 1.2, borderColor: '#E8C96A', transform: [{ rotate: '45deg' }] }} />
                    )),
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={CAT.icon as never} size={16} color="#E8C96A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h2" style={{ fontWeight: '900', fontSize: 17, color: '#FFFFFF' }}>{CAT.title}</T>
                    <T v="caption" style={{ fontSize: 9.5, color: 'rgba(242,247,243,0.7)', marginTop: 1 }}>{CAT.sub}</T>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {cat === 'zakat' ? (
              <>
                <T v="caption" style={{ fontSize: 10.5, color: d.subtext, lineHeight: 16, marginBottom: 10 }}>
                  Zakat purifies your wealth: 2.5% of savings held for a lunar year above nisab. Choose which of the groups Allah named in Quran 9:60 your zakat should reach.
                </T>
                {/* pass 35 — zakat calculator (IslamicAPI live nisab) */}
                <Pressable
                  accessibilityLabel="calculate my zakat"
                  onPress={() => { haptic.selection(); setCalc(true); setCalcDone(false); fetchNisab('ngn').then((n) => { setNisab({ gold: n.gold.nisab_amount, silver: n.silver.nisab_amount, rate: n.zakat_rate, currency: n.currency }); setLiveP({ gold: n.gold.unit_price, silver: n.silver.unit_price }); }).catch(() => setNisab(null)); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.06)', paddingHorizontal: 13, paddingVertical: 11, marginBottom: 14 }}
                >
                  <FontAwesome5 name="calculator" size={13} color="#E8C96A" />
                  <T v="bodyS" style={{ flex: 1, fontWeight: '800', fontSize: 12.5, color: d.text }}>Calculate my zakat</T>
                  <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
                </Pressable>
              </>
            ) : null}
            {cat === 'sadaqah' ? (
              <T v="caption" style={{ fontSize: 10.5, color: d.subtext, lineHeight: 16, marginBottom: 14 }}>
                Sadaqah is voluntary charity of any amount — given for the pleasure of Allah. Choose who it should reach.
              </T>
            ) : null}

            <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: d.faint, marginBottom: 4 }}>GIVEN TO — SELECT ALL THAT APPLY</T>
            {recipients.length ? (
              <T v="caption" style={{ fontSize: 9.5, color: isDark ? '#4AE38F' : '#1D6F42', marginBottom: 8, fontWeight: '700' }}>{recipients.length} recipient{recipients.length > 1 ? 's' : ''} selected</T>
            ) : (
              <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginBottom: 8 }}>You can choose more than one</T>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {RECIPIENTS[cat].map((r) => {
                const on = recipients.includes(r);
                return (
                  <Pressable
                    key={r}
                    accessibilityLabel={`recipient ${r}`}
                    onPress={() => toggleRecipient(r)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: on ? `${CAT.tint}88` : d.cardBorder, backgroundColor: on ? `${CAT.tint}1A` : 'transparent', paddingHorizontal: 12, paddingVertical: 7 }}
                  >
                    {on ? <FontAwesome5 name="check" size={9} color={CAT.tint} /> : null}
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: on ? CAT.tint : d.subtext }}>{r}</T>
                  </Pressable>
                );
              })}
            </View>

            <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: d.faint, marginBottom: 8 }}>AMOUNT</T>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12 }}>
                <T v="h3" style={{ color: d.faint, fontSize: 15 }}>{cur.split(' ')[1] ?? ''}</T>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={d.faint}
                  style={{ flex: 1, paddingVertical: 13, fontSize: 19, fontWeight: '800', fontFamily: 'Poppins-Medium', color: d.text }}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[10, 50, 100, 500].map((q) => (
                <Pressable key={q} onPress={() => { haptic.selection(); setAmount(String(q)); }} style={{ flex: 1, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', paddingVertical: 8 }}>
                  <T v="caption" style={{ fontSize: 11, fontWeight: '700', color: d.subtext }}>{cur.split(' ')[1] ?? ''}{q}</T>
                </Pressable>
              ))}
            </View>

            <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: d.faint, marginBottom: 8 }}>CURRENCY</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 18, paddingBottom: 2 }}>
              {CURRENCIES.map((c, i) => {
                const on = i === curIdx;
                return (
                  <Pressable key={c} onPress={() => { haptic.selection(); setCurIdx(i); }} style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? `${CAT.tint}88` : d.cardBorder, backgroundColor: on ? `${CAT.tint}1A` : 'transparent', paddingHorizontal: 13, paddingVertical: 7 }}>
                    <T v="caption" style={{ fontSize: 11, fontWeight: '700', color: on ? CAT.tint : d.subtext }}>{c}</T>
                  </Pressable>
                );
              })}
            </ScrollView>

            {valid ? (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row' }}>
                  <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>Agency + processing ({FEE_PCT}%)</T>
                  <T v="caption" style={{ fontSize: 10.5, color: d.subtext }}>−{cur.split(' ')[0]} {((amt * FEE_PCT) / 100).toFixed(2)}</T>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 5 }}>
                  <T v="caption" style={{ flex: 1, fontSize: 10.5, fontWeight: '800', color: d.text }}>Delivered</T>
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{cur.split(' ')[0]} {(amt - (amt * FEE_PCT) / 100).toFixed(2)}</T>
                </View>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="pay donation"
              onPress={pay}
              disabled={!valid}
              style={({ pressed }) => ({ borderRadius: 15, backgroundColor: valid ? CAT.tint : d.cardBorder, alignItems: 'center', paddingVertical: 15, opacity: pressed ? 0.85 : 1 })}
            >
              <T v="bodyS" style={{ fontWeight: '900', fontSize: 14, color: valid ? '#06140D' : d.faint }}>
                {valid ? `Pay ${cur.split(' ')[0]} ${amt.toLocaleString()}` : recipients.length ? 'Choose an amount' : 'Choose at least one recipient'}
              </T>
            </Pressable>
          </>
        ) : null}

        {view === 'paying' ? (
          <View style={{ alignItems: 'center', paddingVertical: 80, gap: 12 }}>
            <ActivityIndicator color={CAT.tint} />
            <T v="bodyS" style={{ color: d.subtext }}>Processing payment…</T>
          </View>
        ) : null}

        {view === 'done' && last ? (
          <View style={{ alignItems: 'center', paddingTop: 20 }}>
            <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: isDark ? 'rgba(74,227,143,0.12)' : 'rgba(29,111,66,0.08)', borderWidth: 1.5, borderColor: isDark ? '#4AE38F' : '#1D6F42', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="check" size={28} color={isDark ? '#4AE38F' : '#1D6F42'} />
            </View>
            <T v="h1" style={{ fontSize: 21, fontWeight: '800', color: d.text, marginTop: 14 }}>JazakAllahu khairan!</T>
            <T v="bodyS" style={{ color: d.subtext, marginTop: 5, textAlign: 'center', lineHeight: 19 }}>
              Your {cat === 'zakat' ? 'zakat' : cat === 'sadaqah' ? 'sadaqah' : 'contribution'} of {last.currency} {last.amount.toLocaleString()} has been received.
            </T>

            {/* pass 35 — branded receipt */}
            <ReceiptCard rcpt={last} d={d} isDark={isDark} fmtDate={fmtDate} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
              <Pressable onPress={() => share(last)} style={{ flex: 1, borderRadius: 14, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', alignItems: 'center', paddingVertical: 13 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: '#fff' }}>Share receipt</T>
              </Pressable>
              <Pressable onPress={() => { haptic.selection(); setView('menu'); }} style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', paddingVertical: 13 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.subtext }}>Done</T>
              </Pressable>
            </View>
          </View>
        ) : null}

        {view === 'history' ? (
          <>
            <Pressable onPress={() => setView('menu')} hitSlop={10} style={{ marginBottom: 12 }}>
              <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '700' }}>‹ Back</T>
            </Pressable>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text, marginBottom: 12 }}>Payment history</T>
            {!history.length ? (
              <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 40 }}>No payments yet — your receipts will appear here.</T>
            ) : (
              history.map((h) => {
                /* pass 40 — guard: old donations may have a category that is
                 * no longer listed; undefined here crashed the history screen
                 * (the "white screen"). */
                const c2 = CATS.find((x) => x.id === h.cat) ?? { icon: 'hand-holding-heart', title: 'Donation', tint: '#E8C96A' };
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => { haptic.selection(); setOpenReceipt(h); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 9 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: `${c2.tint}1E`, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name={c2.icon as never} size={14} color={c2.tint} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="body" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{c2.title} · {h.currency} {h.amount.toLocaleString()}</T>
                      <T v="caption" numberOfLines={1} style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{fmtDate(h.at)} · {h.recipient}</T>
                    </View>
                    {h.reported ? (
                      <T v="caption" style={{ fontSize: 9, color: '#E0A052', fontWeight: '800' }}>REPORTED</T>
                    ) : (
                      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
                    )}
                  </Pressable>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>

      {/* receipt detail + report */}
      <Modal visible={openReceipt != null} transparent animationType="slide" onRequestClose={() => setOpenReceipt(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpenReceipt(null)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <T v="h3" style={{ fontWeight: '800', flex: 1 }}>Receipt</T>
              <Pressable onPress={() => setOpenReceipt(null)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {openReceipt ? <ReceiptCard rcpt={openReceipt} d={d} isDark={isDark} fmtDate={fmtDate} /> : null}
              {openReceipt?.reported ? (
                <T v="caption" style={{ fontSize: 10, color: '#C0392B', marginTop: 10, textAlign: 'center' }}>You flagged this payment for review — our team will look into it.</T>
              ) : null}
              {openReceipt && !openReceipt.reported ? (
                <Pressable onPress={() => { haptic.selection(); report(openReceipt); }} style={{ marginTop: 12, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 }}>
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: '#C0392B' }}>Report this payment</T>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* pass 35 — zakat calculator (live nisab via IslamicAPI) */}
      <Modal visible={calc} transparent animationType="slide" onRequestClose={() => setCalc(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCalc(false)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <FontAwesome5 name="balance-scale" size={14} color="#E8C96A" />
              <T v="h3" style={{ fontWeight: '800', flex: 1, marginLeft: 8 }}>Zakat calculator</T>
              <Pressable onPress={() => setCalc(false)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginBottom: 12, lineHeight: 16 }}>
                {liveP
                  ? `Live prices (IslamicAPI): gold ₦${Math.round(liveP.gold).toLocaleString()}/g · silver ₦${Math.round(liveP.silver).toLocaleString()}/g. Nisab: silver ₦${nisab ? Math.round(nisab.silver).toLocaleString() : '—'} · gold ₦${nisab ? Math.round(nisab.gold).toLocaleString() : '—'}.`
                  : 'Fetching live prices from IslamicAPI… (offline: silver nisab ≈ ₦520,000)'}
              </T>
              {([
                ['cash', 'Cash & bank savings (₦)', 'money-bill-wave'],
                ['gold', 'Gold — grams (auto-valued live)', 'coins'],
                ['silver', 'Silver — grams (auto-valued live)', 'circle-notch'],
                ['business', 'Business goods & stock (₦)', 'store'],
                ['debts', 'Debts owed (−)', 'minus-circle'],
              ] as const).map(([k2, label, icon]) => (
                <View key={k2} style={{ marginBottom: 10 }}>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 5 }}>{label.toUpperCase()}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 12, height: 46 }}>
                    <FontAwesome5 name={icon} size={12} color={d.faint} />
                    <TextInput
                      accessibilityLabel={`zakat field ${k2}`}
                      value={wealth[k2]}
                      onChangeText={(v) => { haptic.selection(); setWealth((w) => ({ ...w, [k2]: v.replace(/[^0-9.]/g, '') })); }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={d.faint}
                      style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 15, color: d.text, paddingVertical: 0 }}
                    />
                    {(k2 === 'gold' || k2 === 'silver') && liveP ? (
                      <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: '#B8860B' }}>× ₦{Math.round(k2 === 'gold' ? liveP.gold : liveP.silver).toLocaleString()}/g</T>
                    ) : null}
                  </View>
                </View>
              ))}
              {(() => {
                const num = (x: string) => parseFloat(x) || 0;
                const pg = liveP?.gold ?? 191313;
                const ps2 = liveP?.silver ?? 2862;
                const goldVal = num(wealth.gold) * pg;
                const silverVal = num(wealth.silver) * ps2;
                const total = num(wealth.cash) + goldVal + silverVal + num(wealth.business) - num(wealth.debts);
                const nis = nisab ? nisab.silver : 520000;
                const due = total >= nis ? total * 0.025 : 0;
                return (
                  <View style={{ borderRadius: 16, borderWidth: 1, borderColor: calcDone && due > 0 ? 'rgba(74,227,143,0.4)' : d.cardBorder, backgroundColor: calcDone && due > 0 ? (isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)') : d.bgSoft, padding: 14, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row' }}>
                      <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>Gold + silver (live value)</T>
                      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text }}>₦{(goldVal + silverVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}</T>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 6 }}>
                      <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>Net wealth</T>
                      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text }}>₦{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</T>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 6 }}>
                      <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>Nisab (silver)</T>
                      <T v="caption" style={{ fontSize: 10.5, fontWeight: '900', color: d.text }}>₦{nis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</T>
                    </View>
                    {calcDone ? (
                      <>
                        <View style={{ flexDirection: 'row', marginTop: 6 }}>
                          <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>Zakat due (2.5%)</T>
                          <T v="caption" style={{ fontSize: 11.5, fontWeight: '900', color: due > 0 ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>₦{due.toLocaleString(undefined, { maximumFractionDigits: 0 })}</T>
                        </View>
                        <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 8, lineHeight: 14 }}>
                          {due > 0 ? 'Your wealth is above nisab — pay 2.5% after one lunar year of ownership.' : total <= 0 ? 'Enter your assets above to calculate.' : 'Below nisab — no zakat is due yet. Alhamdulillah.'}
                        </T>
                        {due > 0 ? (
                          <Pressable
                            onPress={() => { haptic.success(); setAmount(String(Math.round(due))); setCalc(false); }}
                            style={{ marginTop: 12, borderRadius: 13, height: 44, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Pay ₦{Math.round(due).toLocaleString()} zakat now</T>
                          </Pressable>
                        ) : null}
                      </>
                    ) : (
                      <Pressable
                        accessibilityLabel="calculate zakat in sheet"
                        onPress={() => { haptic.medium(); setCalcDone(true); }}
                        style={{ marginTop: 12, borderRadius: 13, height: 44, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                      >
                        <FontAwesome5 name="calculator" size={12} color="#fff" />
                        <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Calculate zakat</T>
                      </Pressable>
                    )}
                  </View>
                );
              })()}
              <View style={{ marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.04)', padding: 12, alignItems: 'center' }}>
                <T v="bodyS" style={{ fontFamily: 'Amiri-Bold', fontSize: 14.5, lineHeight: 26, color: '#E8C96A', textAlign: 'right' }}>خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا</T>
                <T v="caption" style={{ fontSize: 9, color: d.subtext, marginTop: 6, lineHeight: 13, textAlign: 'center' }}>“Take from their wealth a charity to purify them…” — Quran 9:103</T>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DeenPointsBuyModal visible={buyPoints} onClose={() => setBuyPoints(false)} />
    </View>
  );
}
