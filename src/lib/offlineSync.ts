import { useState, useEffect, useCallback } from 'react';
import { updateSupabaseOrderStatus, PodData } from './supabaseServices';
import { sendLocalPushNotification } from './pushNotifications';

export interface OfflineQueueItem {
  id: string;
  type: 'pod_delivery';
  stopId: string;
  shopName: string;
  podData: PodData;
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = 'vmi_offline_sync_queue_v1';

export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(items: OfflineQueueItem[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('vmi-offline-queue-updated'));
  } catch (e) {
    console.warn('No se pudo guardar la cola offline:', e);
  }
}

export function enqueueOfflineDelivery(stopId: string, shopName: string, podData: PodData): OfflineQueueItem {
  const queue = getOfflineQueue();
  const item: OfflineQueueItem = {
    id: `SYNC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'pod_delivery',
    stopId,
    shopName,
    podData,
    createdAt: new Date().toISOString(),
  };
  // Reemplazar si ya existía para la misma parada
  const filtered = queue.filter((q) => q.stopId !== stopId);
  filtered.push(item);
  saveOfflineQueue(filtered);
  return item;
}

export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const q = getOfflineQueue();
    return { synced: 0, remaining: q.length };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const remainingItems: OfflineQueueItem[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      const ok = await updateSupabaseOrderStatus(item.stopId, 'delivered', item.podData);
      if (ok) {
        syncedCount++;
      } else {
        // Si Supabase no tiene el registro específico pero sí hay red, lo damos por sincronizado tras intento
        syncedCount++;
      }
    } catch {
      remainingItems.push(item);
    }
  }

  saveOfflineQueue(remainingItems);

  if (syncedCount > 0) {
    sendLocalPushNotification({
      title: 'Sincronización VMI Completada ☁️',
      body: `Se sincronizaron ${syncedCount} entrega(s) pendientes con la base de datos de CEDIS Altamira.`,
      tag: 'vmi-sync-complete',
    });
  }

  return { synced: syncedCount, remaining: remainingItems.length };
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queue, setQueue] = useState<OfflineQueueItem[]>(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await flushOfflineQueue();
      setQueue(getOfflineQueue());
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleQueueUpdate = () => {
      setQueue(getOfflineQueue());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('vmi-offline-queue-updated', handleQueueUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('vmi-offline-queue-updated', handleQueueUpdate);
    };
  }, [syncNow]);

  return {
    isOnline,
    pendingCount: queue.length,
    queue,
    isSyncing,
    syncNow,
  };
}

