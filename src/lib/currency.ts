import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fxQuote, isLive } from '@/api/client';

/* pass 80 — display currency by account country.
 * Nigeria → NGN, other countries → their Flutterwave currency when the
 * server has an FX rate, else USD. Every price in the app renders through
 * fmt() so a shopper always sees their own currency. Payments still charge
 * authoritatively server-side (init_shop / init_premium / deenpoints init),
 * which resolve the SAME currency from the same country field. */

const FX_KEY = 'dl.fxquote.v1';

const SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: '₵', KES: 'KSh', ZAR: 'R',
  TZS: 'TSh', UGX: 'USh', RWF: 'RF', XOF: 'CFA', XAF: 'FCFA', CAD: 'C$',
  AUD: 'A$', SAR: 'SR', AED: 'AED', PKR: 'Rs', INR: '₹', MYR: 'RM', IDR: 'Rp',
};

export type FxQuote = { ccy: string; rate: number };
const FALLBACK: FxQuote = { ccy: 'USD', rate: 1 };

export function symbolFor(ccy: string): string { return SYMBOLS[ccy] || `${ccy} `; }

export function formatMoney(usd: number, q: FxQuote): string {
  const v = usd * q.rate;
  const sym = symbolFor(q.ccy);
  // No-decimal currencies (IDR/RWF/XOF-style) look cleaner without cents.
  const noDec = q.ccy === 'IDR' || q.ccy === 'RWF' || q.ccy === 'XOF' || q.ccy === 'XAF';
  return `${sym}${noDec ? Math.round(v).toLocaleString() : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** App-wide hook: resolves once per session, cached in storage for instant paint. */
export function useCurrency(): { fx: FxQuote; fmt: (usd: number) => string } {
  const [fx, setFx] = useState<FxQuote>(FALLBACK);
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(FX_KEY);
        if (cached && on) setFx(JSON.parse(cached));
      } catch { /* cold start */ }
      if (!isLive()) return;
      try {
        const d = await fxQuote();
        if (d?.currency) {
          const q: FxQuote = { ccy: d.currency, rate: d.rate };
          if (on) setFx(q);
          await AsyncStorage.setItem(FX_KEY, JSON.stringify(q));
        }
      } catch { /* keep cached/USD */ }
    })();
    return () => { on = false; };
  }, []);
  const fmt = useCallback((usd: number) => formatMoney(usd, fx), [fx]);
  return { fx, fmt };
}
