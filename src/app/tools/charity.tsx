import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

const AMOUNTS = [5000, 10000, 25000, 50000];

export default function Charity() {
  const { theme } = useTheme();
  const [amount, setAmount] = useState<number | null>(10000);
  const [zakat, setZakat] = useState('');
  const zakatResult = zakat !== '' && !Number.isNaN(Number(zakat)) ? Number(zakat) * 0.025 : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Donation & Charity" subtitle="“The hand that gives is the upper hand” ﷺ" />
      <View style={{ padding: 16 }}>
        <Card style={{ backgroundColor: theme.primary, borderColor: 'transparent' }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Sadaqah Jariyah</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, lineHeight: 20 }}>
            Give once and keep receiving reward as long as people benefit — knowledge, Qur’ans, and support for
            scholars and orphans.
          </Text>
        </Card>

        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text, marginTop: 20, marginBottom: 10 }}>
          Choose an amount (₦)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AMOUNTS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAmount(a)}
              style={{
                flex: 1,
                minWidth: '42%',
                backgroundColor: amount === a ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: amount === a ? theme.primary : theme.border,
                borderRadius: 14,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: amount === a ? '#fff' : theme.text, fontWeight: '700', fontSize: 13.5 }}>
                ₦{a.toLocaleString()}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={zakat}
          onChangeText={setZakat}
          keyboardType="numeric"
          placeholder="Zakat calculator — enter wealth (₦)"
          placeholderTextColor={theme.subtext}
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: theme.text,
            fontSize: 14,
            marginTop: 18,
          }}
        />
        {zakatResult !== null ? (
          <Card
            style={{
              marginTop: 10,
              backgroundColor: theme.primarySoft,
              borderColor: 'transparent',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }}>Zakat due (2.5%)</Text>
            <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '800' }}>
              ₦{zakatResult.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
          </Card>
        ) : null}

        <Pressable
          style={{
            backgroundColor: theme.primary,
            borderRadius: 14,
            padding: 15,
            alignItems: 'center',
            marginTop: 22,
            opacity: amount ? 1 : 0.5,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5 }}>
            Donate{amount ? ` ₦${amount.toLocaleString()}` : ''} · Paystack
          </Text>
        </Pressable>
        <Text style={{ color: theme.subtext, fontSize: 11.5, textAlign: 'center', marginTop: 10, lineHeight: 16 }}>
          Payments via Paystack/Flutterwave — wire into your PHP /donations endpoint when ready.
        </Text>
      </View>
    </View>
  );
}
