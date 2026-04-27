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
    const allStreams: any[] = [];
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

        if (type === 'movie' && id.startsWith('tmdb:')) tmdbId = id.split(':')[1];
        else if (type === 'series') {
            const parts = id.split(':');
            if (parts[0] === 'tmdb') { tmdbId = parts[1]; season = parts[2]; episode = parts[3]; }
            else if (parts[0].startsWith('tt')) { tmdbId = parts[0]; season = parts[1]; episode = parts[2]; }
        }

        let mediaTitle = '';
        try {
            const TMDB_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
            const lang = 'ar';
            const url = tmdbId.startsWith('tt') 
                ? `https://themoviedb.org{tmdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=${lang}`
                : `https://themoviedb.org{type === 'series' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}&language=${lang}`;
            const resp = await fetch(url);
            const data = await resp.json() as any;
            const r = data?.movie_results?.[0] || data?.tv_results?.[0] || data;
            mediaTitle = r?.title || r?.name || '';
        } catch { }

        const vixStreams = await getVixSrcStreams(tmdbId, season, episode, 'ar');
        for (const s of vixStreams) {
            s.name = 'VixSrc 🇸🇦';
            s.title = `🎬 ${mediaTitle}\n🔊 صوت عربي/إنجليزي`;
        }
        allStreams.push(...vixStreams);

        try {
            const ccStreams = await getCinemaCityStreams(type, tmdbId, season ? parseInt(season) : 1, episode ? parseInt(episode) : 1);
            for (const s of ccStreams) {
                s.name = 'CinemaCity 🇸🇦';
                s.title = `🎬 ${mediaTitle}\n💬 ترجمة عربية محقونة`;
            }
            allStreams.push(...ccStreams);
        } catch (err) {}
    } catch (err) { }
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
