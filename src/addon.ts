const { addonBuilder } = require('stremio-addon-sdk');
import { getVixSrcStreams } from './vixsrc';
import { getVixCloudStreams } from './vixcloud';
// إعادة تفعيل CinemaCity لدعم الترجمة العربية
import { getCinemaCityStreams } from './cinemacity';
import { decodeProxyToken, resolveUrl, makeProxyToken, getAddonBase } from './proxy';
import { decodeConfig, UserConfig, DEFAULT_CONFIG } from './config';
import { request } from 'undici';
import { pipeline } from 'stream/promises';
const express = require('express');
import { generateLandingPage } from './landing';

// خريطة اللغات - تأكدنا من وجود العربية
const LABEL_TO_LANG: Record<string, string> = {
    'arabic': 'ar', 'العربية': 'ar', 'ar': 'ar',
    'english': 'en', 'en': 'en',
    // ... باقي اللغات تبقى كما هي
};

const manifest = {
    id: 'org.selfstream.arabic',
    version: '1.2.0',
    name: 'SelfStream Arabic 🇸🇦', // اسم الإضافة في ستريميو
    description: 'الإصدار العربي لدعم الأفلام والمسلسلات والأنمي مع الترجمة والدبلجة العربية',
    logo: 'https://icv.stremio.dpdns.org/prisonmike.png',
    resources: ['stream'],
    types: ['movie', 'series', 'anime'],
    idPrefixes: ['tmdb:', 'tt', 'kitsu:'],
    catalogs: []
};

const builder = new addonBuilder(manifest as any);

async function handleStream(type: string, id: string, userConfig: UserConfig): Promise<any[]> {
    const allStreams: any[] = [];
    try {
        if (id && id.startsWith('kitsu:')) {
            const parts = id.split(':');
            const kitsuId = parts[1];
            const episodeNum = parts[2] || '1';
            const streams = await getVixCloudStreams(kitsuId, episodeNum);
            allStreams.push(...streams);
            return allStreams;
        }

        if (type === 'movie' || type === 'series') {
            let tmdbId = id;
            let season: string | undefined;
            let episode: string | undefined;

            if (type === 'movie' && id.startsWith('tmdb:')) tmdbId = id.split(':')[1];
            else if (type === 'series') {
                const parts = id.split(':');
                if (parts[0] === 'tmdb') { tmdbId = parts[1]; season = parts[2]; episode = parts[3]; }
                else if (parts[0].startsWith('tt')) { tmdbId = parts[0]; season = parts[1]; episode = parts[2]; }
            }

            // جلب العناوين باللغة العربية دائماً من TMDB
            let mediaTitle = '';
            try {
                const TMDB_KEY = Buffer.from('MTg2NWY0M2EwNTQ5Y2E1MGQzNDFkZDlhYjhiMjlmNDk=', 'base64').toString();
                const tmdbType = type === 'series' ? 'tv' : 'movie';
                const lang = 'ar'; // إجبار اللغة العربية للعنوان
                const url = tmdbId.startsWith('tt') 
                    ? `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=${lang}`
                    : `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${TMDB_KEY}&language=${lang}`;
                const resp = await fetch(url);
                const data = await resp.json() as any;
                const r = data?.movie_results?.[0] || data?.tv_results?.[0] || data;
                mediaTitle = r?.title || r?.name || '';
            } catch { /* fallback */ }

            // ── VixSrc ──
            const vixStreams = await getVixSrcStreams(tmdbId, season, episode, 'ar');
            for (const s of vixStreams) {
                s.name = 'VixSrc 🇸🇦';
                s.title = `🎬 ${mediaTitle}\n🔊 صوت عربي/إنجليزي`;
            }
            allStreams.push(...vixStreams);

            // ── CinemaCity (تمت إعادة التفعيل للترجمة) ──
            try {
                const ccStreams = await getCinemaCityStreams(type, tmdbId, season ? parseInt(season) : 1, episode ? parseInt(episode) : 1);
                for (const s of ccStreams) {
                    s.name = 'CinemaCity 🇸🇦';
                    s.title = `🎬 ${mediaTitle}\n💬 ترجمة عربية محقونة`;
                }
                allStreams.push(...ccStreams);
            } catch (err) {}
        }
    } catch (err) { console.error("Handler error:", err); }
    return allStreams;
}

// تعديل المعالج ليعمل دائماً بالإعدادات الافتراضية (العربية)
builder.defineStreamHandler(async (args: any) => {
    return { streams: await handleStream(args.type, args.id, DEFAULT_CONFIG) };
});
// ... باقي الكود التقني
const addonInterface = builder.getInterface();
const app = express();
app.set('trust proxy', true);

app.get('/', async (req: any, res: any) => {
    const configToken = req.query.token || "";
    const userConfig = configToken ? decodeConfig(configToken) : DEFAULT_CONFIG;
    res.send(generateLandingPage(userConfig, manifest, configToken));
});

app.get('/:token/manifest.json', (req: any, res: any) => {
    const userConfig = decodeConfig(req.params.token);
    res.json(manifest);
});

app.get('/manifest.json', (req: any, res: any) => {
    res.json(manifest);
});

app.get('/:token/stream/:type/:id.json', async (req: any, res: any) => {
    const userConfig = decodeConfig(req.params.token);
    const streams = await handleStream(req.params.type, req.params.id, userConfig);
    res.json({ streams });
});

app.get('/proxy/hls/manifest.m3u8', async (req: any, res: any) => {
    const token = req.query.token;
    if (!token) return res.status(400).send("No token");
    const { url, headers } = decodeProxyToken(token);
    try {
        const { body } = await request(url, { headers });
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        await pipeline(body, res);
    } catch (e) { res.status(500).send("Proxy error"); }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Addon active on port ${PORT}`));
