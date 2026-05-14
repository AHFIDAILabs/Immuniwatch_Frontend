import { api } from './client';
import type { User, UserRole } from '../types/api';

export const usersApi = {
  list: () => api.get<User[]>('/users').then((r) => r.data),

  get: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),

  invite: (body: { name: string; email: string; role: UserRole; password: string }) =>
    api.post<User>('/users', body).then((r) => r.data),

  update: (id: string, body: { name?: string; role?: UserRole; active?: boolean }) =>
    api.patch<User>(`/users/${id}`, body).then((r) => r.data),

  feedbackStats: (id: string) =>
    api.get<{ overrides: number; rejections: number; total: number; lastContributedAt: string | null }>(
      `/users/${id}/feedback-stats`,
    ).then((r) => r.data),
};
