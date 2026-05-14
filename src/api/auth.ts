import { api } from './client';
import type { LoginResponse, AuthUser } from '../types/api';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout'),

  me: () =>
    api.get<AuthUser>('/auth/me').then((r) => r.data),
};
