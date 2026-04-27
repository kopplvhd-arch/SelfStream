export const config = {
  tmdbApiKey: process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY_HERE",
  vixsrcDomain: "vixsrc.to",
  vixcloudDomain: "vixcloud.co"
};

export const AVAILABLE_LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' }, // أصبحت العربية هي الخيار الأول والافتراضي
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' }
  // تم حذف الإيطالية نهائياً من هنا لضمان عدم ظهورها في الواجهة
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
    // قمنا بتعديل هذه الدالة لتجبر الإضافة على استخدام العربية حتى لو كان الرابط قديماً
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    return {
      vixEnabled: true, 
      vixLang: 'ar',    // إجبار العربية للصوت
      cinemacityEnabled: true, 
      cinemacityLang: 'ar', // إجبار العربية للترجمة
      animeunityEnabled: parsed.animeunityEnabled === true
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
export const DEFAULT_CONFIG: UserConfig = {
  vixEnabled: true,
  vixLang: 'ar', // إجبار المحرك الأول على العربية
  cinemacityEnabled: true, // إجبار تشغيل المحرك المعطل (سينما سيتي)
  cinemacityLang: 'ar', // إجبار المحرك الثاني على العربية
  animeunityEnabled: false
};

export function decodeConfig(token: string): UserConfig {
  try {
    // هذه الحركة ستجعل الإضافة تتجاهل أي رابط إيطالي قديم وتطبق العربي غصب
    return {
      vixEnabled: true,
      vixLang: 'ar', 
      cinemacityEnabled: true, 
      cinemacityLang: 'ar',
      animeunityEnabled: false
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

