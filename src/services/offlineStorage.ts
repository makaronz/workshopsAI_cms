/**
 * Offline Storage Service
 * IndexedDB implementation for offline questionnaire data storage and sync
 */

interface QuestionnaireData {
  answers: Record<string, any>;
  consent?: {
    ai_processing: boolean;
    data_processing: boolean;
    anonymous_sharing: boolean;
  };
  language: 'pl' | 'en';
  lastSaved: string;
  version?: number;
}

interface SyncQueueItem {
  id: string;
  questionnaireId: string;
  action: 'save' | 'submit' | 'consent';
  data: any;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

interface StorageConfig {
  dbName?: string;
  dbVersion?: number;
  storeName?: string;
  syncStoreName?: string;
  maxRetries?: number;
}

const defaultConfig: StorageConfig = {
  dbName: 'workshopsai_questionnaire',
  dbVersion: 1,
  storeName: 'questionnaires',
  syncStoreName: 'sync_queue',
  maxRetries: 3,
};

export class OfflineStorage {
  private config: StorageConfig;
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        this.config.dbName!,
        this.config.dbVersion!,
      );

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(new Error('Failed to initialize offline storage'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('Offline storage initialized');
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create questionnaire store
        if (!db.objectStoreNames.contains(this.config.storeName!)) {
          const questionnaireStore = db.createObjectStore(
            this.config.storeName!,
            {
              keyPath: 'questionnaireId',
            },
          );
          questionnaireStore.createIndex('lastSaved', 'lastSaved', {
            unique: false,
          });
          questionnaireStore.createIndex('version', 'version', {
            unique: false,
          });
        }

        // Create sync queue store
        if (!db.objectStoreNames.contains(this.config.syncStoreName!)) {
          const syncStore = db.createObjectStore(this.config.syncStoreName!, {
            keyPath: 'id',
          });
          syncStore.createIndex('questionnaireId', 'questionnaireId', {
            unique: false,
          });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  /**
   * Save questionnaire data to IndexedDB
   */
  async saveQuestionnaireData(
    questionnaireId: string,
    data: QuestionnaireData,
  ): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName!],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.storeName!);

      const record = {
        questionnaireId,
        ...data,
        version: (data.version || 0) + 1,
      };

      const request = store.put(record);

      request.onerror = () => {
        console.error('Failed to save questionnaire data:', request.error);
        reject(new Error('Failed to save data'));
      };

      request.onsuccess = () => {
        console.log('Questionnaire data saved locally');
        resolve();
      };
    });
  }

  /**
   * Get questionnaire data from IndexedDB
   */
  async getQuestionnaireData(
    questionnaireId: string,
  ): Promise<QuestionnaireData | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName!],
        'readonly',
      );
      const store = transaction.objectStore(this.config.storeName!);

      const request = store.get(questionnaireId);

      request.onerror = () => {
        console.error('Failed to get questionnaire data:', request.error);
        reject(new Error('Failed to retrieve data'));
      };

      request.onsuccess = () => {
        const result = request.result;
        resolve(result || null);
      };
    });
  }

  /**
   * Delete questionnaire data from IndexedDB
   */
  async deleteQuestionnaireData(questionnaireId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName!],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.storeName!);

      const request = store.delete(questionnaireId);

      request.onerror = () => {
        console.error('Failed to delete questionnaire data:', request.error);
        reject(new Error('Failed to delete data'));
      };

      request.onsuccess = () => {
        console.log('Questionnaire data deleted locally');
        resolve();
      };
    });
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(
    item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'status'>,
  ): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.syncStoreName!],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.syncStoreName!);

      const syncItem: SyncQueueItem = {
        ...item,
        id: `${item.questionnaireId}-${item.action}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
      };

      const request = store.add(syncItem);

      request.onerror = () => {
        console.error('Failed to add to sync queue:', request.error);
        reject(new Error('Failed to queue sync item'));
      };

      request.onsuccess = () => {
        console.log('Item added to sync queue');
        resolve();
      };
    });
  }

  /**
   * Get pending items from sync queue
   */
  async getPendingSyncItems(
    questionnaireId?: string,
  ): Promise<SyncQueueItem[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.syncStoreName!],
        'readonly',
      );
      const store = transaction.objectStore(this.config.syncStoreName!);

      let request: IDBRequest;

      if (questionnaireId) {
        const index = store.index('questionnaireId');
        request = index.getAll(questionnaireId);
      } else {
        request = store.getAll();
      }

      request.onerror = () => {
        console.error('Failed to get sync queue items:', request.error);
        reject(new Error('Failed to retrieve sync items'));
      };

      request.onsuccess = () => {
        const items = request.result.filter(
          (item: SyncQueueItem) => item.status === 'pending',
        );
        resolve(items);
      };
    });
  }

  /**
   * Update sync queue item status
   */
  async updateSyncItemStatus(
    id: string,
    status: SyncQueueItem['status'],
    error?: string,
  ): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.syncStoreName!],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.syncStoreName!);

      const getRequest = store.get(id);

      getRequest.onerror = () => {
        reject(new Error('Failed to get sync item'));
      };

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error('Sync item not found'));
          return;
        }

        const updatedItem = {
          ...item,
          status,
          retryCount:
            status === 'failed' ? item.retryCount + 1 : item.retryCount,
          error: error || item.error,
        };

        const updateRequest = store.put(updatedItem);

        updateRequest.onerror = () => {
          reject(new Error('Failed to update sync item'));
        };

        updateRequest.onsuccess = () => {
          resolve();
        };
      };
    });
  }

  /**
   * Remove completed sync items
   */
  async cleanupCompletedSyncItems(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.syncStoreName!],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.syncStoreName!);
      const index = store.index('status');

      const request = index.openCursor(IDBKeyRange.only('completed'));

      request.onerror = () => {
        reject(new Error('Failed to cleanup sync items'));
      };

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    used: number;
    available: number;
    questionnaireCount: number;
    pendingSyncItems: number;
  }> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage
          .estimate()
          .then(estimate => {
            resolve({
              used: estimate.usage || 0,
              available: estimate.quota
                ? estimate.quota - (estimate.usage || 0)
                : 0,
              questionnaireCount: 0, // Will be updated below
              pendingSyncItems: 0, // Will be updated below
            });
          })
          .catch(reject);
      } else {
        resolve({
          used: 0,
          available: 0,
          questionnaireCount: 0,
          pendingSyncItems: 0,
        });
      }
    }).then(async stats => {
      // Get actual counts
      const [questionnaireCount, pendingSyncItems] = await Promise.all([
        this.getQuestionnaireCount(),
        this.getPendingSyncItemCount(),
      ]);

      return {
        ...stats,
        questionnaireCount,
        pendingSyncItems,
      };
    });
  }

  /**
   * Clear all stored data
   */
  async clearAllData(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName!, this.config.syncStoreName!],
        'readwrite',
      );

      transaction.oncomplete = () => {
        console.log('All offline data cleared');
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to clear data'));
      };

      const questionnaireStore = transaction.objectStore(
        this.config.storeName!,
      );
      questionnaireStore.clear();

      const syncStore = transaction.objectStore(this.config.syncStoreName!);
      syncStore.clear();
    });
  }

  /**
   * Check if offline storage is available
   */
  static isSupported(): boolean {
    return 'indexedDB' in window;
  }

  /**
   * Sync pending items with server
   */
  async syncPendingItems(apiEndpoint: string): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const pendingItems = await this.getPendingSyncItems();
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of pendingItems) {
      if (item.retryCount >= (this.config.maxRetries || 3)) {
        await this.updateSyncItemStatus(
          item.id,
          'failed',
          'Max retries exceeded',
        );
        failed++;
        errors.push(
          `${item.action} for ${item.questionnaireId}: Max retries exceeded`,
        );
        continue;
      }

      try {
        await this.updateSyncItemStatus(item.id, 'syncing');

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: item.action,
            questionnaireId: item.questionnaireId,
            data: item.data,
          }),
        });

        if (response.ok) {
          await this.updateSyncItemStatus(item.id, 'completed');
          successful++;
        } else {
          throw new Error(`Server responded with ${response.status}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await this.updateSyncItemStatus(item.id, 'failed', errorMessage);
        failed++;
        errors.push(
          `${item.action} for ${item.questionnaireId}: ${errorMessage}`,
        );
      }
    }

    // Cleanup completed items
    await this.cleanupCompletedSyncItems();

    return { successful, failed, errors };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  private async getQuestionnaireCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName!],
        'readonly',
      );
      const store = transaction.objectStore(this.config.storeName!);

      const request = store.count();

      request.onerror = () =>
        reject(new Error('Failed to count questionnaires'));
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async getPendingSyncItemCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(
        [this.config.syncStoreName!],
        'readonly',
      );
      const store = transaction.objectStore(this.config.syncStoreName!);
      const index = store.index('status');

      const request = index.count('pending');

      request.onerror = () =>
        reject(new Error('Failed to count pending items'));
      request.onsuccess = () => resolve(request.result);
    });
  }
}

// Export a singleton instance
export const offlineStorage = new OfflineStorage();
