// @ts-nocheck
import { addonBuilder } from "stremio-addon-sdk";
import { getVixSrcStreams } from "./vixsrc";

// 1. إعداد المانيفست (تأكد أن idPrefixes تحتوي على tt)
const manifest = {
    id: "community.selfstream.vix",
    version: "1.1.0",
    name: "SelfStream VixSrc",
    description: "Multi-language streams from VixSrc (Arabic Support)",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"], // ضروري جداً لظهور الإضافة في الأفلام
    catalogs: []
};

const builder = new addonBuilder(manifest);

// 2. معالج الستريم (Stream Handler)
builder.defineStreamHandler(async (arg) => {
    try {
        console.log(`[Addon] Requesting streams for ID: ${arg.id}`);

        // استدعاء الدالة المصلحة
        const streams = await getVixSrcStreams(arg.id, arg.type);

        return {
            streams: streams,
            cacheMaxAge: 3600 // ساعة واحدة كاش
        };
    } catch (e) {
        console.error("[Addon Error]:", e);
        return { streams: [] };
    }
});

export default builder.getInterface();
