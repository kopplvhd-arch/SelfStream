/**
 * CinemaCity Scraper — Arabic Optimized
 * CDN URLs expire quickly, so we use a lazy proxy for playback.
 */
import * as cheerio from 'cheerio';

const MAIN_URL = 'https://cinemacity.cc';

const _b = (s: string) => Buffer.from(s, 'base64').toString();

const HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': `dle_user_id=${_b('MzI3Mjk=')}; dle_password=${_b('ODk0MTcxYzZhOGRhYjE4ZWU1OTRkNWM2NTIwMDlhMzU=')};`,
    'Referer': MAIN_URL + '/'
};

export const CINEMACITY_HEADERS = HEADERS;

const atobPolyfill = (str: string): string => {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let output = '';
        str = String(str).replace(/[=]+$/, '');
        if (str.length % 4 === 1) return '';
        for (let bc = 0, bs = 0, buffer: any, i = 0; (buffer = str.charAt(i++)); ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4) ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))) : 0) {
            buffer = chars.indexOf(buffer);
        }
        return output;
    } catch { return ''; }
};

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { headers: HEADERS });
    return await res.text();
}

function matchJsonArray(text: string, key: string): RegExpMatchArray | null {
    const keyPattern = new RegExp(`${key}\\s*:\\s*\\[`);
    const keyMatch = keyPattern.exec(text);
    if (!keyMatch) return null;
    const startIdx = keyMatch.index! + keyMatch[0].length - 1;
    let depth = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < text.length; i++) {
        if (text[i] === '[') depth++;
        else if (text[i] === ']') depth--;
        if (depth === 0) { endIdx = i + 1; break; }
    }
    if (depth !== 0) return null;
    const arrayStr = text.substring(startIdx, endIdx);
    const result = [arrayStr, arrayStr] as unknown as RegExpMatchArray;
    result.index = keyMatch.index;
    result.input = text;
    return result;
}

function extractFileData(html: string): any {
    const $ = cheerio.load(html);
    let fileData: any = null;
    $('script').each((_i: number, el: any) => {
        if (fileData) return;
        const scriptHtml = $(el).html();
        if (!scriptHtml || !scriptHtml.includes('atob')) return;
        const regex = /atob\s*\(\s*(['"])(.*?)\1\s*\)/g;
        let match;
        while ((match = regex.exec(scriptHtml)) !== null) {
            const decoded = atobPolyfill(match[2]);
            const fileMatch = decoded.match(/file\s*:\s*(['"])(.*?)\1/s) || matchJsonArray(decoded, 'file') || matchJsonArray(decoded, 'sources');
            if (fileMatch) {
                let raw = fileMatch[2] || fileMatch[1];
                try {
                    if (raw.startsWith('[') || raw.startsWith('{')) {
                        raw = raw.replace(/\\(?![u"\\\/bfnrt])/g, '');
                        fileData = JSON.parse(raw);
                    } else { fileData = raw; }
                } catch { fileData = raw; }
            }
        }
    });
    return fileData;
}

export interface SubtitleTrack { label: string; url: string; }

function parseSubtitles(subtitleStr: string): SubtitleTrack[] {
    if (!subtitleStr || typeof subtitleStr !== 'string') return [];
    const tracks: SubtitleTrack[] = [];
    const parts = subtitleStr.split(/,(?=\[)/);
    for (const part of parts) {
        const match = part.match(/^\[([^\]]+)\](https?:\/\/.+)$/);
        if (match) { tracks.push({ label: match[1], url: match[2].replace(/\\\/\//g, '/') }); }
    }
    return tracks;
}

function pickStream(fileData: any, type: string, season: number = 1, episode: number = 1): string | null {
    if (typeof fileData === 'string') return fileData.startsWith('//') ? 'https:' + fileData : fileData;
    if (!Array.isArray(fileData)) return null;

    if (type === 'movie' || fileData.every((x: any) => x && typeof x === 'object' && 'file' in x && !('folder' in x))) {
        const url = fileData[0]?.file || null;
        return url && url.startsWith('//') ? 'https:' + url : url;
    }

    let selectedSeasonFolder: any[] | null = null;
    for (const s of fileData) {
        if (!s || !s.folder) continue;
        const seasonRegex = new RegExp(`(?:season|s)\\s*0*${season}\\b`, 'i');
        if (seasonRegex.test(s.title || '')) { selectedSeasonFolder = s.folder; break; }
    }
    if (!selectedSeasonFolder) selectedSeasonFolder = fileData[0]?.folder || null;
    if (!selectedSeasonFolder) return null;

    let selectedEpisodeFile: string | null = null;
    for (const e of selectedSeasonFolder) {
        if (!e || !e.file) continue;
        const epRegex = new RegExp(`(?:episode|e)\\s*0*${episode}\\b`, 'i');
        if (epRegex.test(e.title || '')) { selectedEpisodeFile = e.file; break; }
    }
    if (!selectedEpisodeFile) selectedEpisodeFile = selectedSeasonFolder[episode - 1]?.file || selectedSeasonFolder[0]?.file || null;

    return selectedEpisodeFile && selectedEpisodeFile.startsWith('//') ? 'https:' + selectedEpisodeFile : selectedEpisodeFile;
}

function pickSubtitleStr(fileData: any, type: string, season: number = 1, episode: number = 1): string {
    if (!Array.isArray(fileData)) return '';
    if (type === 'movie' || fileData.every((x: any) => x && typeof x === 'object' && 'file' in x && !('folder' in x))) {
        return fileData[0]?.subtitle || '';
    }

    let selectedSeasonFolder: any[] | null = null;
    for (const s of fileData) {
        if (!s || !s.folder) continue;
        const seasonRegex = new RegExp(`(?:season|s)\\s*0*${season}\\b`, 'i');
        if (seasonRegex.test(s.title || '')) { selectedSeasonFolder = s.folder; break; }
    }
    if (!selectedSeasonFolder) return '';

    let selectedSubtitle: string = '';
    for (const e of selectedSeasonFolder) {
        if (!e || !e.subtitle) continue;
        const epRegex = new RegExp(`(?:episode|e)\\s*0*${episode}\\b`, 'i');
        if (epRegex.test(e.title || '')) { selectedSubtitle = e.subtitle; break; }
    }
    return selectedSubtitle || selectedSeasonFolder[episode - 1]?.subtitle || '';
}

export async function getCinemaCityStreams(type: string, id: string, season?: number, episode?: number): Promise<any[]> {
    try {
        const searchUrl = `${MAIN_URL}/index.php?do=search&subaction=search&story=${id}`;
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);
        const link = $('.berit-title a').first().attr('href');
        if (!link) return [];

        const pageHtml = await fetchText(link);
        const fileData = extractFileData(pageHtml);
        if (!fileData) return [];

        const streamUrl = pickStream(fileData, type, season, episode);
        const subtitleStr = pickSubtitleStr(fileData, type, season, episode);
        if (!streamUrl) return [];

        return [{
            name: 'CinemaCity 🤌',
            title: `🎬 High Quality Stream\n💬 Arabic Subtitles Support`,
            url: streamUrl,
            subtitles: parseSubtitles(subtitleStr)
        }];
    } catch (e) {
        console.error('[CinemaCity] Error:', e);
        return [];
    }
}
