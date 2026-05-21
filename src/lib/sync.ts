import Dexie, { type EntityTable } from 'dexie';
import { supabase } from './supabase';

type SyncAction = {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  payload: any;
  match?: Record<string, any>; // for update/delete
  timestamp: number;
};

export const offlineDb = new Dexie('offlineDb') as Dexie & {
  syncQueue: EntityTable<SyncAction, 'id'>;
  settings: EntityTable<{key: string, value: string}, 'key'>;
};

offlineDb.version(1).stores({
  syncQueue: 'id, timestamp',
  settings: 'key'
});

export const saveSessionToken = async (token: string) => {
    await offlineDb.settings.put({ key: 'sb_token', value: token });
    if ((window as any).AndroidInterface) {
        try {
            (window as any).AndroidInterface.saveSessionToken(token);
        } catch (e) {
            console.error("AndroidInterface.saveSessionToken failed", e);
        }
    }
};

// Queue handling
export const enqueueSyncAction = async (action: Omit<SyncAction, 'id' | 'timestamp'>) => {
  const newAction: SyncAction = {
    ...action,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
  };
  
  await offlineDb.syncQueue.put(newAction);

  if ((window as any).AndroidInterface) {
      try {
          (window as any).AndroidInterface.saveSyncAction(JSON.stringify(newAction));
      } catch (e) {
          console.error("AndroidInterface.saveSyncAction failed", e);
      }
  }

  // If we're online, try to process immediately
  if (navigator.onLine) {
    processSyncQueue();
  }
};

export const getSyncQueue = async (): Promise<SyncAction[]> => {
  try {
    return await offlineDb.syncQueue.toArray();
  } catch {
    return [];
  }
};

export const clearSyncQueue = async () => {
  await offlineDb.syncQueue.clear();
};

// Caching handling
export const setCachedData = (key: string, data: any) => {
  localStorage.setItem(`cache_${key}`, JSON.stringify(data));
};

export const getCachedData = <T = any>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(`cache_${key}`) || '[]');
  } catch {
    return [];
  }
};

export const executeOrEnqueue = async (
  action: { type: 'insert' | 'update' | 'delete', table: string, payload: any, match?: any },
  optimisticUpdate: () => void,
  retryFetch: () => Promise<void>
) => {
  // Always run optimistic update immediately for premium instant UX
  optimisticUpdate();

  try {
    if (!navigator.onLine) {
      throw new Error('Offline');
    }

    if (action.type === 'insert') {
      const { error } = await supabase.from(action.table).insert(action.payload);
      if (error) {
         if (error.code === '23505') {
            console.log("Duplicate key violation on optimistic insert, ignoring...");
         } else {
            throw error;
         }
      }
    } else if (action.type === 'update') {
      let query = supabase.from(action.table).update(action.payload);
      if (action.match) {
        Object.keys(action.match).forEach(k => { query = query.eq(k, action.match[k]) });
      }
      const { error } = await query;
      if (error) throw error;
    } else if (action.type === 'delete') {
      let query = supabase.from(action.table).delete();
      if (action.match) {
        Object.keys(action.match).forEach(k => { query = query.eq(k, action.match[k]) });
      }
      const { error } = await query;
      if (error) throw error;
    }
    
    // Attempt to refetch but handle any potential fetch exceptions elegantly
    try {
      await retryFetch();
    } catch (refetchErr) {
      console.warn('Refetch after successful write failed (likely network drop):', refetchErr);
    }
  } catch (err: any) {
    if (
      err.message === 'Offline' || 
      err.message?.includes('Failed to fetch') || 
      err.message?.includes('fetch') || 
      err.message?.includes('Network') || 
      err.name === 'TypeError'
    ) {
      console.warn('Network issue detected, queuing action:', err);
      // It's a network error, enqueue the sync action for later
      await enqueueSyncAction(action);
    } else {
      // Non-network error, revert by fetching latest and throw
      try {
        await retryFetch();
      } catch (refetchErr) {
        console.warn('Revert refetch failed:', refetchErr);
      }
      throw err;
    }
  }
};

let isSyncing = false;

export const processSyncQueue = async () => {
  if (isSyncing) {
    console.log("processSyncQueue is already running, skipping concurrent run.");
    return;
  }
  if (!navigator.onLine) return;

  isSyncing = true;
  try {
    // Reconciliation between Dexie (HTML5) and Android SharedPreferences
    if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.getSyncActions === 'function') {
        try {
            const androidActionsStr = (window as any).AndroidInterface.getSyncActions();
            const androidActions = JSON.parse(androidActionsStr) || [];
            const androidIds = new Set(androidActions.map((a: any) => a.id));
            
            const dexieQueue = await getSyncQueue();
            const alreadyProcessedIds: string[] = [];
            for (const action of dexieQueue) {
                if (!androidIds.has(action.id)) {
                    alreadyProcessedIds.push(action.id);
                }
            }
            if (alreadyProcessedIds.length > 0) {
                console.log("Removing already processed offline actions from Dexie to prevent duplication:", alreadyProcessedIds);
                await offlineDb.syncQueue.bulkDelete(alreadyProcessedIds);
            }
        } catch (reconcileErr) {
            console.error("Failed to reconcile Dexie queue with Android native queue:", reconcileErr);
        }
    }

    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} offline actions...`);

    const successfullySynced: string[] = [];

    for (const action of queue) {
      try {
        if (action.type === 'insert') {
          const { error } = await supabase.from(action.table).insert(action.payload);
          if (error) {
             if (error.code === '23505') {
                 console.log("Duplicate key violation, ignoring since we already created it.", action.id);
             } else {
                 throw error;
             }
          }
        } else if (action.type === 'update') {
          let query = supabase.from(action.table).update(action.payload);
          if (action.match) {
            Object.keys(action.match).forEach(key => { query = query.eq(key, action.match![key]) });
          }
          const { error } = await query;
          if (error) throw error;
        } else if (action.type === 'delete') {
          let query = supabase.from(action.table).delete();
          if (action.match) {
            Object.keys(action.match).forEach(key => { query = query.eq(key, action.match![key]) });
          }
          const { error } = await query;
          if (error) throw error;
        }
        successfullySynced.push(action.id);
      } catch (err) {
        console.error(`Failed to sync action:`, action, err);
        // We keep it in queue if failed
      }
    }

    if (successfullySynced.length > 0) {
        await offlineDb.syncQueue.bulkDelete(successfullySynced);
        if ((window as any).AndroidInterface) {
            try {
                (window as any).AndroidInterface.removeSyncAction(JSON.stringify(successfullySynced));
            } catch (e) {
                console.error("AndroidInterface.removeSyncAction failed", e);
            }
        }
        // Trigger a global reload event or state to refresh data in the UI
        window.dispatchEvent(new CustomEvent('sync_completed'));
    }
  } catch (syncErr) {
    console.error("Error inside processSyncQueue:", syncErr);
  } finally {
    isSyncing = false;
  }
};
