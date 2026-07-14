/**
 * OG Metadata Fetcher
 * Server-side fetches Open Graph title, description, and image from a target URL
 * Used to serve rich Facebook / Twitter / LinkedIn link previews for shortlinks
 */

const fetch = require('node-fetch');

// Cache: code -> { title, description, image, siteName, fetchedAt }
const ogCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract OG / meta value from raw HTML string
 */
function extractMeta(html, propertyName) {
  const metaRegex = /<meta\s+([^>]+)>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const attrsStr = match[1];
    const propertyMatch = attrsStr.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = attrsStr.match(/content=["']([^"']*)["']/i);
    
    if (propertyMatch && contentMatch) {
      const prop = propertyMatch[1].toLowerCase();
      if (prop === propertyName.toLowerCase()) {
        return decodeHtmlEntities(contentMatch[1].trim());
      }
    }
  }
  
  if (propertyName.toLowerCase() === 'og:title') {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return decodeHtmlEntities(titleMatch[1].trim());
    }
  }
  
  return '';
}

/**
 * Fetch Open Graph metadata (title, description, image, siteName) from a URL
 * Returns null on failure
 */
async function fetchOgMeta(targetUrl) {
  if (!targetUrl || !targetUrl.startsWith('http')) return null;

  // Return cached if fresh
  if (ogCache.has(targetUrl)) {
    const cached = ogCache.get(targetUrl);
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached;
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) return null;

    // Only read first 150KB to avoid memory issues on large pages while ensuring we get all metadata
    const textRaw = await response.text();
    const html = textRaw.substring(0, 150000);

    // Extract title
    const title = extractMeta(html, 'og:title');

    // Extract description
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description');

    // Extract image
    let image = extractMeta(html, 'og:image') ||
                extractMeta(html, 'og:image:url') ||
                extractMeta(html, 'twitter:image') ||
                extractMeta(html, 'msapplication-TileImage');

    // If no image metadata, fallback to the first img in HTML body
    if (!image) {
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        image = imgMatch[1];
      }
    }

    // If og:image is relative, make it absolute
    if (image && !image.startsWith('http')) {
      try {
        const baseUrl = new URL(targetUrl);
        image = new URL(image, baseUrl.origin).href;
      } catch (_) {
        image = '';
      }
    }

    // Extract site name
    const siteName = extractMeta(html, 'og:site_name');

    const meta = {
      title: title || 'Shared Link',
      description: description || 'Click the link to view the full content.',
      image: image || '',
      siteName: siteName || '',
      fetchedAt: Date.now(),
      sourceUrl: targetUrl
    };

    ogCache.set(targetUrl, meta);
    return meta;
  } catch (err) {
    console.error('[OG Fetcher] Failed to fetch metadata from:', targetUrl, err.message);
    return null;
  }
}

/**
 * Clear the OG cache for a specific URL (useful after link update)
 */
function clearOgCache(targetUrl) {
  if (targetUrl) ogCache.delete(targetUrl);
  else ogCache.clear();
}

module.exports = { fetchOgMeta, clearOgCache };
