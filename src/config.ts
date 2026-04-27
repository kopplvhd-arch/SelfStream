export const config = {
  tmdbApiKey: process.env.TMDB_API_KEY || "1865f43a0549ca50d341dd9ab8b29f49",
  vixsrcDomain: "vixsrc.to",
  vixcloudDomain: "vixcloud.co"
};

export const AVAILABLE_LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' }
];

export interface UserConfig {
  vixEnabled: boolean;
  vixLang: string;
  cinemacityEnabled: boolean;
  cinemacityLang: string;
  animeunityEnabled: boolean;
}

export const DEFAULT_CONFIG: UserConfig = {
  vixEnabled: true,
  vixLang: 'ar',
  cinemacityEnabled: true, 
  cinemacityLang: 'ar',
  animeunityEnabled: false
};

export function encodeConfig(cfg: UserConfig): string {
  return Buffer.from(JSON.stringify(cfg)).toString('base64url');
}

export function decodeConfig(token: string): UserConfig {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    return {
      vixEnabled: parsed.vixEnabled !== false, // تفعيل افتراضي ما لم يطلب إيقافه
      vixLang: 'ar', // إجبار اللغة العربية دائماً
      cinemacityEnabled: true, // إجبار تفعيل سينما سيتي
      cinemacityLang: 'ar', // إجبار اللغة العربية لسينما سيتي
      animeunityEnabled: parsed.animeunityEnabled === true
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
