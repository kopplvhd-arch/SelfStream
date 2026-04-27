import * as cheerio from 'cheerio';
import { request } from 'undici';
import { config } from './config';
import { makeProxyToken, VIXCLOUD_HEADERS } from './proxy';

const ANIMEMAPPING_BASE = Buffer.from('aHR0cHM6Ly9hbmltZW1hcHBpbmcuc3RyZW1pby5kcGRucy5vcmc=', 'base64').toString();
const AU_BASE = 'https://www.animeunity.so';
const AU_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

// تعديل Headers ليكون عاماً ولا يظهر كإيطالي
const ARABIC_HEADERS = {
    ...VIXCLOUD_HEADERS,
    'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function resolveFromMapping(kitsuId: string, episodeNum: string): Promise<string | null> {
    try {
        const ep = parseInt(episodeNum) || 1;
        const url = `${ANIMEMAPPING_BASE}/kitsu/${kitsuId}?ep=${ep}`;
        console.log(`[VixCloud] Fetching mapping: ${url}`);
        const { body, statusCode } = await request(url, { headers: { 'Accept': 'application/json' } });
        if (statusCode !== 200) return null;
        const data: any = await body.json();
        
        const auMapping = data?.mappings?.animeunity;
        if (auMapping) {
            const paths = Array.isArray(auMapping) ? auMapping : [auMapping];
            for (const item of paths) {
                const path = typeof item === 'string' ? item : (item?.path || item?.url || item?.href || null);
                if (path) return path;
            }
        }
        return null;
    } catch (err: any) { return null; }
}

async function resolveEpisodeFromMapping(kitsuId: string, episodeNum: string): Promise<number> {
    try {
        const ep = parseInt(episodeNum) || 1;
        const url = `${ANIMEMAPPING_BASE}/kitsu/${kitsuId}?ep=${ep}`;
        const { body, statusCode } = await request(url, { headers: { 'Accept': 'application/json' } });
        if (statusCode !== 200) return ep;
        const data: any = await body.json();
        const fromKitsu = data?.kitsu?.episode;
        if (fromKitsu && typeof fromKitsu === 'number' && fromKitsu > 0) return fromKitsu;
        return ep;
    } catch { return parseInt(episodeNum) || 1; }
}

// تعديل البحث ليفضل العناوين العربية إن وجدت في Kitsu
async function getKitsuTitle(kitsuId: string): Promise<string | null> {
    try {
        const { body, statusCode } = await request(`https://kitsu.io/api/edge/anime/${kitsuId}`);
        if (statusCode !== 200) return null;
        const data: any = await body.json();
        const attr = data?.data?.attributes;
        return attr?.titles?.ar || attr?.titles?.en || attr?.canonicalTitle || null;
    } catch { return null; }
}

export async function getVixCloudStreams(kitsuId: string, episode: string): Promise<any[]> {
    try {
        const title = await getKitsuTitle(kitsuId);
        const animePath = await resolveFromMapping(kitsuId, episode);
        const epNum = await resolveEpisodeFromMapping(kitsuId, episode);

        if (!animePath) return [];

        // هنا نقوم بتغيير الوصف الذي يظهر في ستريميو للعربية
        return [{
            name: "SelfStream 🇸🇦",
            title: `📺 أنمي: ${title || 'غير معروف'}\n🔢 حلقة رقم: ${epNum}\n🔗 جودة VixCloud 🤌`,
            url: `/proxy/hls/manifest.m3u8?token=${makeProxyToken(animePath, ARABIC_HEADERS)}`
        }];
    } catch (e) { return []; }
}
