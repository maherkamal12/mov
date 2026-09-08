import * as cheerio from "cheerio";

const BASE_URL = "https://a.qfilm.tv";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
  Referer: `${BASE_URL}/`,
};

export interface VideoSource {
  server: string;
  label: string;
  url: string;
  type: "mp4" | "hls";
}

/** Get the list of player servers for a movie from the embed page. */
export async function getServerList(vid: string): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/embed.php?vid=${vid}`, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return [];

  const html = await res.text();
  const urls: string[] = [];

  // <option value="https://...">سيرفر 1</option>
  const optionRe = /<option\s+value="(https?:\/\/[^"]+)"\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = optionRe.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  // Fallback: iframe src inside the wrapper
  if (urls.length === 0) {
    const $ = cheerio.load(html);
    $("iframe").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("http")) urls.push(src);
    });
  }

  return urls;
}

/**
 * Fetch a third-party embed page and pull out a direct video file URL.
 * These hosts store an unencrypted `file: "..."` inside their player config.
 */
export async function extractDirectUrl(
  embedUrl: string
): Promise<{ url: string; type: "mp4" | "hls" } | null> {
  try {
    const res = await fetch(embedUrl, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Patterns used by most Dood/Vidmoly/Mp4Plus style players:
    //   file:"https://x/v.mp4"   file: 'https://x/master.m3u8'   sources:[{file:"..."}]
    const patterns = [
      /file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i,
      /["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i,
      /["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i,
      /src\s*=\s*["'](https?:\/\/[^"'\s]+\.(?:mp4|m3u8)[^"'\s]*)["']/i,
    ];

    for (const re of patterns) {
      const match = html.match(re);
      if (match?.[1]) {
        const url = match[1].replace(/\\\//g, "/").trim();
        if (/^https?:\/\//i.test(url)) {
          return { url, type: url.includes(".m3u8") ? "hls" : "mp4" };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Build a clean, ad-free list of direct playable sources for a movie. */
export async function getVideoSources(
  vid: string
): Promise<VideoSource[]> {
  const servers = await getServerList(vid);
  const sources: VideoSource[] = [];

  const results = await Promise.all(
    servers.map(async (serverUrl, index) => {
      const direct = await extractDirectUrl(serverUrl);
      return direct ? { serverUrl, direct, index } : null;
    })
  );

  for (const r of results) {
    if (!r) continue;
    // Skip duplicates that point at the same file
    if (sources.some((s) => s.url === r.direct.url)) continue;
    sources.push({
      server: r.serverUrl,
      label: `سيرفر ${sources.length + 1}`,
      url: r.direct.url,
      type: r.direct.type,
    });
  }

  // Prefer mp4 (native playback, no extra library needed) first
  sources.sort((a, b) => (a.type === b.type ? 0 : a.type === "mp4" ? -1 : 1));

  return sources;
}
