
export type ReviewSource = 'gmb' | 'trustpilot' | 'tripadvisor' | 'getyourguide' | 'manual';

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface Subscription {
  tier: SubscriptionTier;
  status: 'active' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd: string;
}

export interface UserUsage {
  chatsToday: number;
  importsToday: number;
  lastResetDate: string; // ISO Date string (YYYY-MM-DD)
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string; // ISO format
  source: ReviewSource;
  url?: string; // Link to original review
  tags?: string[]; // Optional tags for internal workflow
  assignedTo?: string; // Team member assigned to this review
}

export interface LinkedAccounts {
  gmb?: { locationId: string; title: string; accountId: string; lastSync?: string; importCount?: number };
  trustpilot?: { url: string; lastSync?: string; importCount?: number };
  tripadvisor?: { url: string; lastSync?: string; importCount?: number };
  getyourguide?: { url: string; lastSync?: string; importCount?: number };
}

export interface GMBAccount {
  name: string;
  accountName: string;
  type: string;
}

export interface GMBLocation {
  name: string;
  title: string;
  locationName: string;
}

export interface Theme {
  name: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  frequency: number;
  description: string;
}

export interface Location {
  id: string;
  name: string;
  linkedAccounts: LinkedAccounts;
  reviews: Review[];
  archivedReviews?: Review[];
  lastAnalysis?: AnalysisResult;
  updatedAt: string;
  isSyncing?: boolean; 
  syncStage?: 'scraping' | 'analyzing' | 'idle';
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  locations: Location[];
  subscription?: Subscription;
  usage?: UserUsage; // Daily usage tracking
  createdAt?: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, { chats: number; reviews: number }> = {
  free: { chats: 5, reviews: 50 },
  basic: { chats: 20, reviews: 200 },
  pro: { chats: 100, reviews: 1000 },
  enterprise: { chats: 1000, reviews: 10000 }
};

export interface AnalysisResult {
  overview: string;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    score: number;
  };
  themes: Theme[];
  recommendations: string[];
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type DateFilterRange = 'all' | '7d' | '30d';
