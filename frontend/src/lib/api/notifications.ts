import { api } from './client';
import type { ApiNotification, NotificationsParams } from './types';

export const notificationsApi = {
  list: (params: NotificationsParams = {}) =>
    api.get<ApiNotification[]>('/api/v1/notifications', { query: { ...params } }),

  getUnreadCount: () => api.get<{ unread_count: number }>('/api/v1/notifications/unread-count'),

  markRead: (notificationId: string) =>
    api.post<ApiNotification>(`/api/v1/notifications/${notificationId}/read`, {}),

  markAllRead: () => api.post<{ marked_read: number }>('/api/v1/notifications/read-all', {}),

  delete: (notificationId: string) => api.delete<void>(`/api/v1/notifications/${notificationId}`),

  deleteAll: () => api.delete<void>('/api/v1/notifications'),

  adminList: (params: NotificationsParams = {}) =>
    api.get<ApiNotification[]>('/api/v1/admin/notifications', { query: { ...params } }),

  adminSend: (body: { user_id: string; type: string; message: string; entity_type?: string; entity_id?: string }) =>
    api.post<ApiNotification>('/api/v1/admin/notifications/send', body),
};
