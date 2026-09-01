import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export interface ViewerSummary {
  stats: {
    totalPosts:     number;
    todayPosts:     number;
    pendingReviews: number;
    misinfoRate:    number;
  };
  labels:    Array<{ label: string; count: number }>;
  platforms: Array<{ platform: string; count: number }>;
  recentPosts: Array<{
    content:    string;
    platform:   string;
    language:   string;
    ingestedAt: string;
    label:      string;
    confidence: number;
  }>;
  connectors: Array<{
    platform:     string;
    status:       'active' | 'degraded' | 'waiting';
    eventsPerMin: number;
    lastEventAt:  string;
  }>;
}

export function createViewerApi(token: string) {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json', 'X-View-Token': token },
  });

  return {
    verify:     () => client.get<{ valid: boolean }>('/viewer/verify').then((r) => r.data),
    getSummary: () => client.get<ViewerSummary>('/viewer/summary').then((r) => r.data),
  };
}
