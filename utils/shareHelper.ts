// utils/shareHelper.ts
export interface ShareData {
    n: string; // Name
    t: string; // Top Song / Anthem
    a: string; // Top Album
    v: string; // Vibe / Archetype
  }
  
  export function encodeShareData(data: ShareData): string {
    const json = JSON.stringify(data);
    try {
      if (typeof window !== 'undefined' && window.btoa) {
        return encodeURIComponent(btoa(encodeURIComponent(json)));
      }
      return encodeURIComponent(Buffer.from(json).toString('base64'));
    } catch (e) {
      return encodeURIComponent(json);
    }
  }
  
  export function decodeShareData(encoded: string): ShareData | null {
    try {
      const decodedUri = decodeURIComponent(encoded);
      let jsonStr = '';
      if (typeof window !== 'undefined' && window.atob) {
        jsonStr = decodeURIComponent(atob(decodedUri));
      } else {
        jsonStr = decodeURIComponent(Buffer.from(decodedUri, 'base64').toString('utf-8'));
      }
      return JSON.parse(jsonStr);
    } catch (e) {
      try {
        return JSON.parse(decodeURIComponent(encoded));
      } catch {
        return null;
      }
    }
  }