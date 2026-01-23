import { Review, ReviewSource } from "../types";
import dotenv from "dotenv";
const CORS_PROXY = 'https://corsproxy.io/?';
const APIFY_BASE = 'https://api.apify.com/v2';
const getApifyToken = () => {
  return process.env.APIFY_API_KEY;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cleanUrl = (url: string): string => {
  try {
    const u = new URL(url);
    u.search = ""; 
    u.hash = "";
    let cleaned = u.toString();
    return cleaned.endsWith('/') ? cleaned.slice(0, -1) : cleaned;
  } catch (e) {
    return url;
  }
};

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 2000): Promise<Response> => {
  const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
  try {
    const response = await fetch(proxiedUrl, options);
    if (!response.ok && [502, 503, 504].includes(response.status) && retries > 0) {
      await delay(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      await delay(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
};

/**
 * Normalizes raw scraper items into Review objects
 */
const normalizeItems = (items: any[], source: string, originalUrl: string): Review[] => {
  let normalizedItems = Array.isArray(items) ? items : [];
  
  if (normalizedItems.length > 0) {
    const flattenedReviews: any[] = [];
    normalizedItems.forEach((item: any) => {
      const hasText = !!(item.text || item.comment || item.reviewBody || item.message);
      const hasRating = item.rating !== undefined || item.stars !== undefined || item.score !== undefined;
      if (hasText || hasRating) {
        flattenedReviews.push(item);
      } else if (item.reviews && Array.isArray(item.reviews)) {
        flattenedReviews.push(...item.reviews);
      } else if (item.data && item.data.reviews && Array.isArray(item.data.reviews)) {
        flattenedReviews.push(...item.data.reviews);
      }
    });
    if (flattenedReviews.length > 0) normalizedItems = flattenedReviews;
  }

  return normalizedItems.map((item: any) => {
    const author = item.author?.fullName || item.author?.name || item.name || item.author || 
                   item.user?.username || item.authorName || item.reviewerName || 
                   item.author_name || 'Valued Customer';
    
    let rawRating = item.rating || item.stars || item.score || item.ratingValue || item.starRating || 5;
    let rating = typeof rawRating === 'string' ? parseFloat(rawRating) : rawRating;
    
    if (typeof rawRating === 'string' && isNaN(rating)) {
      const wordMap: any = { 'FIVE': 5, 'FOUR': 4, 'THREE': 3, 'TWO': 2, 'ONE': 1 };
      rating = wordMap[rawRating.toUpperCase()] || 5;
    }
    
    if (rating > 10) rating = rating / 10;
    else if (rating > 5) rating = rating / 2;
    
    const rawText = item.text || item.comment || item.message || item.reviewBody || 
                 item.description || item.reviewText || item.content || "";
    
    const text = rawText.trim() || "[Rating Only]";
    const date = item.publishedDate || item.created || item.date || item.publishedAt || 
                 item.createdDate || item.review_date || new Date().toISOString();
    const reviewUrl = item.url || item.reviewUrl || item.link || originalUrl;

    return {
      id: item.reviewId || item.id || `${source}-${Math.random().toString(36).substr(2, 9)}`,
      author,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      text,
      date,
      source: source as ReviewSource,
      url: reviewUrl
    };
  });
};

export const fetchRealExternalReviews = async (
  url: string, 
  source: 'trustpilot' | 'tripadvisor' | 'gmb' | 'getyourguide',
  onProgress?: (reviews: Review[]) => void
): Promise<Review[]> => {
  const token = getApifyToken();
  const cleanedUrl = cleanUrl(url);
  
  let actorId = '';
  let input: any = {};
  const defaultProxy = { useApifyProxy: true };

  if (source === 'trustpilot') {
    actorId = 'apify~trustpilot-scraper';
    input = { startUrls: [{ url: cleanedUrl }], maxReviews: 40, sortBy: 'recent', proxyConfiguration: defaultProxy };
  } else if (source === 'tripadvisor') {
    actorId = 'maxcopell~tripadvisor-reviews';
    input = { startUrls: [{ url: cleanedUrl }], maxItems: 40, includeReviews: true, proxyConfiguration: defaultProxy };
  } else if (source === 'getyourguide') {
    actorId = 'jupri~get-your-guide-scraper';
    const idMatch = cleanedUrl.match(/[t](\d+)$/) || cleanedUrl.match(/[t](\d+)\//) || cleanedUrl.match(/-t(\d+)/);
    const activityId = idMatch ? idMatch[1] : cleanedUrl;
    const query = activityId.includes('/reviews') ? activityId : `${activityId}/reviews`;
    input = { query: query, limit: 40 };
  } else if (source === 'gmb') {
    actorId = 'apify~google-maps-scraper';
    input = { startUrls: [{ url: cleanedUrl }], maxReviews: 40, scrapeReviews: true, proxyConfiguration: defaultProxy };
  }

  try {
    const startUrl = `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`;
    const runResponse = await fetchWithRetry(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!runResponse.ok) throw new Error("Sync Failed to Start");

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    let isFinished = false;
    let attempts = 0;
    let hasSentProgress = false;

    while (!isFinished && attempts < 60) {
      attempts++;
      await delay(6000);

      const statusUrl = `${APIFY_BASE}/actor-runs/${runId}?token=${token}`;
      const checkResponse = await fetchWithRetry(statusUrl, { method: 'GET' });
      const checkData = await checkResponse.json();
      const status = checkData.data.status;

      // Check dataset even if not finished to provide "Live Sync" feel
      if (!hasSentProgress || attempts % 2 === 0) {
        const datasetUrl = `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}`;
        const partialResponse = await fetchWithRetry(datasetUrl, { method: 'GET' });
        if (partialResponse.ok) {
          const items = await partialResponse.json();
          const reviews = normalizeItems(items, source, url);
          if (reviews.length > 0 && onProgress) {
            onProgress(reviews);
            hasSentProgress = true;
          }
        }
      }

      if (status === 'SUCCEEDED') isFinished = true;
      else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) isFinished = true;
    }

    const finalResponse = await fetchWithRetry(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}`, { method: 'GET' });
    const finalItems = await finalResponse.json();
    return normalizeItems(finalItems, source, url);
    
  } catch (error: any) {
    throw new Error(error.message);
  }
};