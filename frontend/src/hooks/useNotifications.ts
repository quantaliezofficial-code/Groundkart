import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../lib/api/notifications';
import type { NotificationsParams } from '../lib/api/types';
import { useAuth } from '../lib/auth';

export function useNotifications(params: NotificationsParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationsApi.list(params),
    enabled: Boolean(user),
  });
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: Boolean(user),
    // Polled rather than pushed — there's no websocket/SSE channel
    // anywhere in this codebase, so a 30s interval is the simplest way
    // for the badge to reflect something an admin just did without a
    // full page reload.
    refetchInterval: 30_000,
  });
}

function invalidateNotificationViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(notificationId),
    onSuccess: () => invalidateNotificationViews(queryClient),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => invalidateNotificationViews(queryClient),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.delete(notificationId),
    onSuccess: () => invalidateNotificationViews(queryClient),
  });
}

export function useDeleteAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.deleteAll(),
    onSuccess: () => invalidateNotificationViews(queryClient),
  });
}

export function useAdminNotifications(params: NotificationsParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-notifications', params],
    queryFn: () => notificationsApi.adminList(params),
    enabled: user?.role === 'admin',
  });
}

export function useAdminSendNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { user_id: string; type: string; message: string; entity_type?: string; entity_id?: string }) => notificationsApi.adminSend(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });
}
