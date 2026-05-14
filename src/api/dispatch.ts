import { api } from './client';

export interface DispatchStats {
  dispatchedToday: number;
  avgResponseTimeMin: number;
  platformAcceptanceRate: number;
  byPlatform: Array<{ platform: string; count: number; acceptanceRate: number }>;
}

export interface DispatchRecord {
  _id: string;
  postId: string;
  platform: string;
  language: string;
  response: string;
  status: 'sent' | 'accepted' | 'rejected' | 'pending';
  dispatchedAt: string;
}

export const dispatchApi = {
  getStats: () =>
    api.get<DispatchStats>('/dispatch/stats').then((r) => r.data),

  list: (params?: { page?: number; limit?: number }) =>
    api.get<{ data: DispatchRecord[]; total: number }>('/dispatch', { params }).then((r) => r.data),
};
