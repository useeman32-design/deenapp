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

const CATS: Array<{ id: Cat; icon: string; title: string; sub: string; tint: string; grad: [string, string] }> = [
  {
    id: 'deenlink',
    icon: 'seedling',
    title: 'Donate to DeenLink',
    sub: 'A sadaqah jariyah — continuous reward',
    tint: '#4AE38F',
    grad: ['#0E3B26', '#08251A'],
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
  deenlink: ['App development & maintenance', 'Free Islamic content', 'Servers & streaming', 'Wherever most needed'],
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

export default function Donations() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<'menu' | 'form' | 'paying' | 'done' | 'history'>('menu');
  const [cat, setCat] = useState<Cat>('deenlink');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [curIdx, setCurIdx] = useState(0);
  const [last, setLast] = useState<Dono | null>(null);
  const [history, setHistory] = useState<Dono[]>([]);
  const [openReceipt, setOpenReceipt] = useState<Dono | null>(null);

  useEffect(() => { store.load().then(setHistory).catch(() => {}); }, []);

  const cur = CURRENCIES[curIdx];
  const amt = Number(amount.replace(/[^0-9.]/g, ''));
  const valid = amt > 0 && !!recipient;

  const start = (c: Cat) => {
    haptic.selection();
    setCat(c);
    setRecipient('');
    setAmount('');
    setView('form');
  };

  const pay = () => {
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
      <TopBar title="Donations" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {view === 'menu' ? (
          <>
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
                {c.id === 'deenlink' ? (
                  <View style={{ padding: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: d.cardBorder, backgroundColor: d.card }}>
                    <T v="bodyS" style={{ fontFamily: 'Amiri', fontSize: 15, lineHeight: 25, color: isDark ? '#E8C96A' : '#8C6D1F', textAlign: 'right' }}>
                      مَّثَلُ الَّذِينَ يُنفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنبَتَتْ سَبْعَ سَنَابِلَ فِي كُلِّ سُنبُلَةٍ مِّائَةُ حَبَّةٍ
                    </T>
                    <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 6, lineHeight: 16 }}>
                      “The example of those who spend their wealth in the way of Allah is like a grain that sprouts seven ears; in every ear is a hundred grains.” — Quran 2:261
                    </T>
                    <T v="caption" style={{ fontSize: 10.5, color: d.subtext, marginTop: 6, lineHeight: 16, fontStyle: 'italic' }}>
                      “When a person dies, his deeds end except three: ongoing charity, beneficial knowledge, or a righteous child who prays for him.” — Muslim 1631
                    </T>
                  </View>
                ) : null}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${CAT.tint}1E`, borderWidth: 1, borderColor: `${CAT.tint}55`, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={CAT.icon as never} size={16} color={CAT.tint} />
              </View>
              <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>{CAT.title}</T>
            </View>

            {cat === 'zakat' ? (
              <T v="caption" style={{ fontSize: 10.5, color: d.subtext, lineHeight: 16, marginBottom: 14 }}>
                Zakat purifies your wealth: 2.5% of savings held for a lunar year above nisab. Choose which of the groups Allah named in Quran 9:60 your zakat should reach.
              </T>
            ) : null}
            {cat === 'sadaqah' ? (
              <T v="caption" style={{ fontSize: 10.5, color: d.subtext, lineHeight: 16, marginBottom: 14 }}>
                Sadaqah is voluntary charity of any amount — given for the pleasure of Allah. Choose who it should reach.
              </T>
            ) : null}

            <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: d.faint, marginBottom: 8 }}>GIVEN TO</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {RECIPIENTS[cat].map((r) => {
                const on = recipient === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => { haptic.selection(); setRecipient(r); }}
                    style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? `${CAT.tint}88` : d.cardBorder, backgroundColor: on ? `${CAT.tint}1A` : 'transparent', paddingHorizontal: 12, paddingVertical: 7 }}
                  >
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
                {valid ? `Pay ${cur.split(' ')[0]} ${amt.toLocaleString()}` : 'Choose recipients & amount'}
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

            {/* receipt */}
            <View style={{ width: '100%', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: d.card, padding: 16, marginTop: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FontAwesome5 name="receipt" size={13} color="#E8C96A" />
                <T v="caption" style={{ fontWeight: '800', letterSpacing: 0.6, fontSize: 10, color: '#E8C96A' }}>RECEIPT · {last.ref}</T>
              </View>
              {[
                ['Date', fmtDate(last.at)],
                ['Category', cat === 'deenlink' ? 'DeenLink (sadaqah jariyah)' : cat === 'sadaqah' ? 'Sadaqah' : 'Zakat'],
                ['Given to', last.recipient],
                ['Amount', `${last.currency} ${last.amount.toLocaleString()}`],
                [`Fee (${last.feePct}%)`, `−${last.currency} ${((last.amount * last.feePct) / 100).toFixed(2)}`],
                ['Delivered', `${last.currency} ${(last.amount - (last.amount * last.feePct) / 100).toFixed(2)}`],
                ['Status', '✓ Completed (simulated)'],
              ].map(([k2, v]) => (
                <View key={k2} style={{ flexDirection: 'row', paddingVertical: 5, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
                  <T v="caption" style={{ flex: 1, fontSize: 10.5, color: d.faint }}>{k2}</T>
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: d.text, maxWidth: '62%', textAlign: 'right' }}>{v}</T>
                </View>
              ))}
            </View>

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
                const c2 = CATS.find((x) => x.id === h.cat)!;
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
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }} onPress={() => setOpenReceipt(null)}>
          <Pressable onPress={(e) => stopBubble(e)} style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: (insets.bottom ?? 0) + 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <FontAwesome5 name="receipt" size={14} color="#E8C96A" />
              <T v="h3" style={{ fontWeight: '800', flex: 1, marginLeft: 8 }}>Receipt · {openReceipt?.ref}</T>
              <Pressable onPress={() => setOpenReceipt(null)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            {openReceipt ? <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 19, color: d.subtext, fontFamily: 'Poppins-Regular' }}>{receiptText(openReceipt).split('\n').slice(1, -1).join('\n')}</T> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => openReceipt && share(openReceipt)} style={{ flex: 1, borderRadius: 13, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', alignItems: 'center', paddingVertical: 12 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12, color: '#fff' }}>Share</T>
              </Pressable>
              <Pressable
                onPress={() => openReceipt && !openReceipt.reported && report(openReceipt)}
                disabled={openReceipt?.reported}
                style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: openReceipt?.reported ? d.cardBorder : 'rgba(224,160,82,0.5)', backgroundColor: openReceipt?.reported ? 'transparent' : 'rgba(224,160,82,0.1)', alignItems: 'center', paddingVertical: 12 }}
              >
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12, color: openReceipt?.reported ? d.faint : '#E0A052' }}>{openReceipt?.reported ? 'Reported' : 'Report payment'}</T>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
