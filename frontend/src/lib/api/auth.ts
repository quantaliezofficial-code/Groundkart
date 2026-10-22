import { api } from './client';
import type { AccessTokenResponse, SignupResponse, UserMe } from './types';

export const authApi = {
  signup: (name: string, email: string, password: string, phone: string) =>
    api.post<SignupResponse>('/api/v1/auth/signup', { name, email, password, phone }, { skipAuth: true }),

  login: (loginId: string, password: string) =>
    api.post<AccessTokenResponse>('/api/v1/auth/login', { login_id: loginId, password }, { skipAuth: true, skipRefreshRetry: true }),

  logout: () => api.post<void>('/api/v1/auth/logout', undefined, { skipRefreshRetry: true }),

  me: () => api.get<UserMe>('/api/v1/users/me'),

  deleteAccount: () => api.delete<void>('/api/v1/users/me'),
};
