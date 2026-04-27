import { Stream } from "./types";
import { makeProxyToken } from "./proxy";

// الترويسات اللازمة للمشغل
const VIXSRC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://vixcloud.co/',
    'Origin': 'https://vixcloud.co'
};

export async function getVixSrcStreams(imdbId: string, type: string, preferredLang?: string): Promise<Stream[]> {
    try {
        // 1. تحديد الرابط بناءً على النوع (فيلم أو مسلسل)
        const baseUrl = "https://vixapi.com/api/source";
        const response = await fetch(`${baseUrl}/${type}/${imdbId}`, {
            headers: VIXSRC_HEADERS
        });

        if (!response.ok) return [];

        const data = await response.json();
        if (!data || !data.data || !data.data.sources) return [];

        const streams: Stream[] = [];

        // 2. معالجة السيرفرات المستخرجة
        for (const source of data.data.sources) {
            const serverUrl = source.file;
            const token = data.data.token;
            const expires = data.data.expires;
            const asn = data.data.asn;
            const canPlayFHD = source.label === '1080p';

            // 3. بناء رابط المشغل النهائي مع دعم اللغة
            const urlObj = new URL(serverUrl);
            const targetLang = preferredLang || 'ar'; 

            urlObj.searchParams.set('token', token);
            urlObj.searchParams.set('expires', expires);
            urlObj.searchParams.set('lang', targetLang);
            
            if (asn) urlObj.searchParams.set('asn', asn);
            if (canPlayFHD) urlObj.searchParams.set('h', '1');

            const finalStreamUrl = urlObj.toString();

            // 4. تشفير الرابط عبر البروكسي المحلي لتجاوز الحجب
            const proxyToken = makeProxyToken(finalStreamUrl, VIXSRC_HEADERS);

            streams.push({
                name: `VixSrc (AR/Multi)`,
                title: `${source.label} - High Speed Server`,
                url: `/proxy/hls/${proxyToken}/playlist.m3u8`,
                behaviorHints: {
                    notWebReady: true,
                    proxyHeaders: {
                        "request": VIXSRC_HEADERS
                    }
                }
            });
        }

        return streams;
    } catch (error) {
        console.error("[VixSrc Error]:", error);
        return [];
    }
}
