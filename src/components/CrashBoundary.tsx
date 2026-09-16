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
 *
 * pass 88 — LAZY-CHUNK ERRORS ARE NOT FATAL (owner: opening the image picker /
 * posting a photo showed "DeenLink hit a problem", and posting again worked).
 * On the web build every `await import()` is a Metro *chunk*; if that chunk has
 * not finished registering, Metro's guarded require throws
 * `Requiring unknown module …` and reports it through ErrorUtils BEFORE our own
 * try/catch ever sees it — so the app looked crashed while the code had already
 * handled the failure. Those errors are self-healing (the chunk is registered a
 * moment later), so they are logged and swallowed here instead of taking over
 * the UI. Anything genuinely broken still shows the report screen.
 */
type Props = { children: React.ReactNode };
type State = { error: string | null };

/** Errors that resolve themselves on the next attempt — never show a screen. */
export const isRecoverableJsError = (msg: string): boolean =>
  /Requiring unknown module|Cannot find module|Loading (?:chunk|CSS chunk)[\s\S]*failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|could not evaluate the module|ChunkLoadError/i.test(
    String(msg || ''),
  );

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
          const msg = String(error?.stack || error?.message || error);
          if (isRecoverableJsError(msg)) {
            /* lazy chunk not registered yet — let the app keep running and let
             * the caller's own catch() do its job (pass 88). */
            try { console.warn('[DeenLink] deferred module not loaded yet:', msg); } catch { /* noop */ }
            return;
          }
          try {
            this.setState({ error: msg });
          } catch { /* noop */ }
          // Hand it back to RN so normal dev behaviour is preserved.
          try { this.previousHandler?.(error, isFatal); } catch { /* noop */ }
        });
      } catch { /* noop */ }
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const msg = String((error as Error)?.stack || (error as Error)?.message || error);
    if (isRecoverableJsError(msg)) {
      try { console.warn('[DeenLink] ignored recoverable error:', msg); } catch { /* noop */ }
      return;
    }
    const comp = String(info?.componentStack || '');
    this.setState({ error: comp ? `${msg}\n\n— component stack —${comp}` : msg });
  }

  /** Web: a hard reload re-fetches every chunk — the fix for load races. */
  private reload(): void {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') { window.location.reload(); return; }
    } catch { /* noop */ }
    this.setState({ error: null });
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.wrap}>
        <Text style={s.title}>DeenLink hit a problem</Text>
        <Text style={s.sub}>
          Please screenshot this screen and send it to the developer — it tells us exactly what failed.
          Reloading usually clears it.
        </Text>
        <ScrollView style={s.scroll}>
          <Text selectable style={s.err}>{error}</Text>
        </ScrollView>
        <Text style={s.meta}>{Platform.OS} · {String(Platform.Version)}</Text>
        <View style={s.row}>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null })} activeOpacity={0.8}>
            <Text style={s.btnTxt}>Try to continue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnAlt]} onPress={() => this.reload()} activeOpacity={0.8}>
            <Text style={s.btnTxt}>Reload the app</Text>
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
  row: { flexDirection: 'row', marginTop: 12, gap: 10 },
  btn: { flex: 1, backgroundColor: '#1D6F42', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnAlt: { backgroundColor: '#12432C', borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)' },
  btnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
