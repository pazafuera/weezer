// utils/shareHelper.ts
export interface ShareData {
    n: string; // Name
    t: string; // Top Song / Anthem
    a: string; // Top Album
    v: string; // Vibe / Archetype
  }
  
  export function encodeShareData(data: ShareData): string {
    if (typeof window === 'undefined') {
      return Buffer.from(JSON.stringify(data)).toString('base64url');
    }
    return btoa(encodeURIComponent(JSON.stringify(data)));
  }
  
  export function decodeShareData(encoded: string): ShareData | null {
    try {
      if (typeof window === 'undefined') {
        return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
      }
      return JSON.parse(decodeURIComponent(atob(encoded)));
    } catch (e) {
      return null;
    }
  }