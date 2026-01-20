import { GMBAccount, GMBLocation, Review } from "../types";

/**
 * GOOGLE MY BUSINESS SERVICE
 * Note: These endpoints require an OAuth2 token with 'https://www.googleapis.com/auth/business.manage' scope.
 * We use a CORS proxy (corsproxy.io) to allow direct browser access to Google My Business management endpoints,
 * as they do not support official CORS for client-side-only origins.
 */
const CORS_PROXY = 'https://corsproxy.io/?';
const ACCOUNT_BASE_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const BUSINESS_BASE_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const REVIEWS_BASE_URL = 'https://mybusiness.googleapis.com/v4';

export class GMBService {
  private accessToken: string | null = null;

  setToken(token: string) {
    this.accessToken = token;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    if (!this.accessToken) throw new Error("Authentication token is missing. Please reconnect your Google account.");
    
    // Wrap the URL in the CORS proxy
    const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
    
    try {
      const response = await fetch(proxiedUrl, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GMB API Error] ${response.status} at ${url}`, errorText);
        
        let errorMessage = `GMB API Error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (err: any) {
      console.error(`[GMB Service] Fetch failed for ${url}:`, err);
      if (err.message === 'Failed to fetch') {
        throw new Error("Connectivity Blocked: The request failed to reach Google. Check your internet or try again in a moment.");
      }
      throw err;
    }
  }

  async getAccounts(): Promise<GMBAccount[]> {
    const data = await this.fetchWithAuth(ACCOUNT_BASE_URL);
    return data.accounts?.map((acc: any) => ({
      name: acc.name, // accounts/{accountId}
      accountName: acc.accountName,
      type: acc.type
    })) || [];
  }

  async getLocations(accountName: string): Promise<GMBLocation[]> {
    // accountName is in form "accounts/{accountId}"
    const url = `${BUSINESS_BASE_URL}/${accountName}/locations?readMask=name,title`;
    const data = await this.fetchWithAuth(url);
    
    // The Reviews API (v4) expects the full path: accounts/{accountId}/locations/{locationId}
    // But the Business Information API (v1) returns name as just "locations/{locationId}"
    return data.locations?.map((loc: any) => ({
      name: `${accountName}/${loc.name}`, 
      title: loc.title,
      locationName: loc.name
    })) || [];
  }

  async getReviews(fullLocationPath: string): Promise<Review[]> {
    // fullLocationPath should be "accounts/{accountId}/locations/{locationId}"
    const url = `${REVIEWS_BASE_URL}/${fullLocationPath}/reviews`;
    console.log(`[GMB] Fetching reviews from: ${url}`);
    
    const data = await this.fetchWithAuth(url);
    return data.reviews?.map((rev: any) => ({
      id: rev.reviewId,
      author: rev.reviewer?.displayName || "Google User",
      rating: this.parseRating(rev.starRating),
      text: rev.comment || "",
      date: rev.createTime || new Date().toISOString(),
      source: 'gmb' as const,
      url: `https://search.google.com/local/reviews?placeid=${fullLocationPath.split('/').pop()}`
    })) || [];
  }

  private parseRating(rating: string): number {
    switch(rating) {
      case 'FIVE': return 5;
      case 'FOUR': return 4;
      case 'THREE': return 3;
      case 'TWO': return 2;
      case 'ONE': return 1;
      default: return 0;
    }
  }
}

export const gmbService = new GMBService();