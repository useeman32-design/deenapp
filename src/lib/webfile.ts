/* pass 83-2 — web file picking via a plain DOM <input type="file">.
 * expo-image-picker is NEVER loaded on web: evaluating its web module froze
 * the app (pass-82 incident) and crashed the group-photo button on the
 * pass-81b live bundle. Native keeps the expo pickers via lazy import. */

export function pickWebFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      inp.style.position = 'fixed';
      inp.style.opacity = '0';
      inp.style.pointerEvents = 'none';
      document.body.appendChild(inp);
      let done = false;
      const finish = (f: File | null) => {
        if (done) return;
        done = true;
        window.removeEventListener('focus', onFocus);
        inp.remove();
        resolve(f);
      };
      const onFocus = () => {
        /* Dialog closed. Give `change` a tick to fire first (it wins when a
         * file was chosen); otherwise treat as cancel on browsers without a
         * `cancel` event. */
        setTimeout(() => finish(null), 400);
      };
      inp.addEventListener('change', () => finish(inp.files?.[0] ?? null));
      inp.addEventListener('cancel', () => finish(null));
      window.addEventListener('focus', onFocus);
      inp.click();
    } catch {
      resolve(null);
    }
  });
}

export function fileToDataUri(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(f);
  });
}
