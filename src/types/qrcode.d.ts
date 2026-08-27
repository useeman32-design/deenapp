declare module 'qrcode' {
  interface QRModules {
    size: number;
    get(x: number, y: number): boolean;
  }
  interface QRCodeObject {
    modules: QRModules;
    version: number;
    errorCorrectionLevel: { value: number; name: string };
    maskPattern: number;
  }
  export function create(text: string, opts?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; margin?: number }): QRCodeObject;
}
