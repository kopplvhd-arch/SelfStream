const { addonBuilder } = require('stremio-addon-sdk');
import { getVixSrcStreams } from './vixsrc';
import { getVixCloudStreams } from './vixcloud';
import { getCinemaCityStreams } from './cinemacity';
import { decodeProxyToken, makeProxyToken } from './proxy';
import { decodeConfig, UserConfig, DEFAULT_CONFIG } from './config';
import { request } from 'undici';
import { pipeline } from 'stream/promises';
const express = require('express');
import { generateLandingPage } from './landing';

const manifest = {
    id: 'org.selfstream.arabic',
    version: '1.2.0',
    name: 'SelfStream Arabic 🇸🇦',
    description: 'الإصدار العربي لدعم الأفلام والمسلسلات والأنمي مع الترجمة والدبلجة العربية',
    logo: 'https://dpdns.org',
    resources: ['stream'],
    types: ['movie', 'series', 'anime'],
    idPrefixes: ['tmdb:', 'tt', 'kitsu:'],
    catalogs: []
};

const builder = new addonBuilder(manifest as any);

async function handleStream(type: string, id: string, userConfig: UserConfig): Promise<any[]> {
    let allStreams: any[] = [];
    try {
        if (id && id.startsWith('kitsu:')) {
            const parts = id.split(':');
            const streams = await getVixCloudStreams(parts[1], parts[2] || '1');
            allStreams.push(...streams);
            return allStreams;
        }

        let tmdbId = id;
        let season: string | undefined;
        let episode: string | undefined;

        // 1. Safe Data Handling for IDs
        const parts = id.split(':');
        if (type === 'movie') {
            tmdbId = parts[0] === 'tmdb' ? parts[1] : parts[0];
        } else if (type === 'series') {
            if (parts[0] === 'tmdb') { 
                tmdbId = parts[1]; 
                season = parts[2]; 
                episode = parts[3]; 
            } else if (parts[0].startsWith('tt')) { 
                tmdbId = parts[0]; 
                season = parts[1]; 
                episode = parts[2]; 
            }
        }

        let mediaTitle = '';
        try {
            const TMDB_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
            const lang = 'ar';
            // 2. Fixed TMDB API URL formatting
            const url = tmdbId.startsWith('tt') 
                ? `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=${lang}`
                : `https://api.themoviedb.org/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}&language=${lang}`;
            
            const resp = await fetch(url);
            const data = await resp.json() as any;
            const r = data?.movie_results?.[0] || data?.tv_results?.[0] || data;
            mediaTitle = r?.title || r?.name || '';
        } catch { }

        // Fetch & Wrap VixSrc Streams
        try {
            const vixStreams = await getVixSrcStreams(tmdbId, season, episode, 'ar');
            for (const s of vixStreams) {
                s.name = 'VixSrc 🇸🇦';
                s.title = `🎬 ${mediaTitle}\n🔊 صوت عربي/إنجليزي`;
                
                // 3. Proxy Integrity Wrapping
                if (s.url) {
                    const token = makeProxyToken({ u: s.url, h: s.headers || {} });
                    // Use absolute URL if possible based on deployment, or relative if Stremio is configured to resolve it
                    s.url = `/proxy/hls/manifest.m3u8?token=${token}`; 
                }
            }
            allStreams.push(...vixStreams);
        } catch(err) { console.error("VixSrc Error", err); }

        // Fetch & Wrap CinemaCity Streams
        try {
            const ccStreams = await getCinemaCityStreams(type, tmdbId, season ? parseInt(season) : 1, episode ? parseInt(episode) : 1);
            for (const s of ccStreams) {
                s.name = 'CinemaCity 🇸🇦';
                s.title = `🎬 ${mediaTitle}\n💬 ترجمة عربية محقونة`;
                
                // 3. Proxy Integrity Wrapping
                if (s.url) {
                    const token = makeProxyToken({ u: s.url, h: s.headers || {} });
                    s.url = `/proxy/hls/manifest.m3u8?token=${token}`;
                }
            }
            allStreams.push(...ccStreams);
        } catch (err) { console.error("CinemaCity Error", err); }

        // 4. Strict Language Priority & Filtering
        allStreams = allStreams.filter(s => {
            const meta = `${s.title || ''} ${s.name || ''}`.toLowerCase();
            return !meta.includes('ita') && !meta.includes('italian') && !meta.includes('إيطالي');
        });

        allStreams.sort((a, b) => {
            const metaA = `${a.title || ''} ${a.name || ''}`.toLowerCase();
            const metaB = `${b.title || ''} ${b.name || ''}`.toLowerCase();
            
            const scoreA = (metaA.includes('ar') || metaA.includes('عربي') || metaA.includes('arabic')) ? 2 : 
                           (metaA.includes('en') || metaA.includes('english') || metaA.includes('إنجليزي')) ? 1 : 0;
                           
            const scoreB = (metaB.includes('ar') || metaB.includes('عربي') || metaB.includes('arabic')) ? 2 : 
                           (metaB.includes('en') || metaB.includes('english') || metaB.includes('إنجليزي')) ? 1 : 0;
                           
            return scoreB - scoreA; // الفرز التنازلي لإعطاء الأولوية القصوى للعربية
        });

    } catch (err) { 
        console.error("Global handleStream error", err);
    }
    return allStreams;
}

builder.defineStreamHandler(async (args: any) => {
    return { streams: await handleStream(args.type, args.id, DEFAULT_CONFIG) };
});

const app = express();
app.set('trust proxy', true);

app.get('/', async (req: any, res: any) => {
    const configToken = req.query.token || "";
    const userConfig = configToken ? decodeConfig(configToken) : DEFAULT_CONFIG;
    res.send(generateLandingPage(userConfig, manifest, configToken));
});

app.get('/manifest.json', (req: any, res: any) => res.json(manifest));
app.get('/:token/manifest.json', (req: any, res: any) => res.json(manifest));

app.get('/:token/stream/:type/:id.json', async (req: any, res: any) => {
    const userConfig = decodeConfig(req.params.token);
    const streams = await handleStream(req.params.type, req.params.id, userConfig);
    res.json({ streams });
});

app.get('/proxy/hls/manifest.m3u8', async (req: any, res: any) => {
    const token = req.query.token;
    if (!token) return res.status(400).send("No token");
    const decoded = decodeProxyToken(token as string);
    // تصحيح الأخطاء هنا باستخدام u و h
    try {
        const { body } = await request(decoded.u, { headers: decoded.h });
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        await pipeline(body, res);
    } catch (e) { res.status(500).send("Proxy error"); }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Addon active on port ${PORT}`));
