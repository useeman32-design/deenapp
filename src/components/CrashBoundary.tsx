import React from 'react';
import { Platform, ScrollView, Text, View, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * pass 51 — crash visibility for RELEASE builds.
 *
 * In a release APK a thrown JS error shows no red screen: the app simply dies.
 * That made the "shows the logo, then terminates" report impossible to diagnose
 * remotely. This boundary catches render errors AND installs a global JS error
 * handler, then renders the real stack on screen so it can be screenshotted.
 *
 * It cannot catch native crashes (those happen before JS runs) — but it covers
 * every JS-level failure, which is where a silent death usually comes from.
 */
type Props = { children: React.ReactNode };
type State = { error: string | null };

export class CrashBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  private previousHandler: ((error: Error, isFatal?: boolean) => void) | null = null;

  componentDidMount(): void {
    const g = globalThis as unknown as {
      ErrorUtils?: {
        setGlobalHandler?: (h: (error: Error, isFatal?: boolean) => void) => void;
        getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
      };
    };
    const utils = g.ErrorUtils;
    if (utils && typeof utils.setGlobalHandler === 'function') {
      try { this.previousHandler = utils.getGlobalHandler?.() ?? null; } catch { this.previousHandler = null; }
      try {
        utils.setGlobalHandler((error: Error, isFatal?: boolean) => {
          try {
            this.setState({ error: String(error?.stack || error?.message || error) });
          } catch { /* noop */ }
          // Hand it back to RN so normal dev behaviour is preserved.
          try { this.previousHandler?.(error, isFatal); } catch { /* noop */ }
        });
      } catch { /* noop */ }
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const msg = String((error as Error)?.stack || (error as Error)?.message || error);
    const comp = String(info?.componentStack || '');
    this.setState({ error: comp ? `${msg}\n\n— component stack —${comp}` : msg });
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.wrap}>
        <Text style={s.title}>DeenLink hit a problem</Text>
        <Text style={s.sub}>
          Please screenshot this screen and send it to the developer — it tells us exactly what failed.
        </Text>
        <ScrollView style={s.scroll}>
          <Text selectable style={s.err}>{error}</Text>
        </ScrollView>
        <Text style={s.meta}>{Platform.OS} · {String(Platform.Version)}</Text>
        <View style={s.row}>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null })} activeOpacity={0.8}>
            <Text style={s.btnTxt}>Try to continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B1F17', padding: 18, paddingTop: 60 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  sub: { color: '#9FD8BE', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  scroll: { flex: 1, backgroundColor: '#06130E', borderRadius: 12, padding: 12 },
  err: { color: '#FFC9C9', fontSize: 11, lineHeight: 16, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  meta: { color: '#7FA98F', fontSize: 11, marginTop: 8 },
  row: { flexDirection: 'row', marginTop: 12 },
  btn: { flex: 1, backgroundColor: '#1D6F42', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
