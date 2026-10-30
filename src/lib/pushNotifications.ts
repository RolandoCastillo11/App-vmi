// Sistema de Notificaciones Push Nativas (Web Push / Service Worker Notifications)

export interface AppNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function requestPushNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return Notification.permission;
  }
}

export function getPushPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function sendLocalPushNotification(payload: AppNotificationPayload): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await requestPushNotificationPermission();
  }

  if (permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || `vmi-notif-${Date.now()}`,
    data: { url: payload.url || '/' },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(payload.title, options);
        return true;
      }
    }
    new Notification(payload.title, options);
    return true;
  } catch (err) {
    console.warn('Aviso al mostrar notificación push:', err);
    return false;
  }
}

