import { apiService, MeasureData } from './api';
import { offlineStorageService, PendingUpdate } from './offlineStorage';

export interface QueueProcessingResult {
  successCount: number;
  failureCount: number;
  totalProcessed: number;
  errors: Array<{ updateId: number; error: string }>;
}

class OfflineQueueManager {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(result: QueueProcessingResult) => void> = [];

  constructor() {
    // Initialize the offline storage service
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await offlineStorageService.initialize();
    } catch (error) {
      console.error('Failed to initialize offline queue manager:', error);
    }
  }

  // Add listener for queue processing results
  addListener(listener: (result: QueueProcessingResult) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  private notifyListeners(result: QueueProcessingResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in queue processing listener:', error);
      }
    });
  }

  // Start automatic processing when online
  startAutoProcessing(): void {
    if (this.processingInterval) {
      return; // Already started
    }

    // Process immediately
    this.processQueue();

    // Then process every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 30000);
  }

  // Stop automatic processing
  stopAutoProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Process the entire queue
  async processQueue(): Promise<QueueProcessingResult> {
    if (this.isProcessing) {
      console.log('Queue processing already in progress, skipping...');
      return { successCount: 0, failureCount: 0, totalProcessed: 0, errors: [] };
    }

    this.isProcessing = true;
    const result: QueueProcessingResult = {
      successCount: 0,
      failureCount: 0,
      totalProcessed: 0,
      errors: []
    };

    try {
      console.log('Starting queue processing...');
      
      const pendingUpdates = await offlineStorageService.getPendingUpdates();
      result.totalProcessed = pendingUpdates.length;

      if (pendingUpdates.length === 0) {
        console.log('No pending updates to process');
        return result;
      }

      console.log(`Processing ${pendingUpdates.length} pending updates...`);

      // Process updates in batches to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < pendingUpdates.length; i += batchSize) {
        const batch = pendingUpdates.slice(i, i + batchSize);
        await this.processBatch(batch, result);
        
        // Small delay between batches
        if (i + batchSize < pendingUpdates.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Queue processing completed: ${result.successCount} success, ${result.failureCount} failures`);
      
    } catch (error) {
      console.error('Error during queue processing:', error);
    } finally {
      this.isProcessing = false;
      this.notifyListeners(result);
    }

    return result;
  }

  // Process a batch of updates
  private async processBatch(batch: PendingUpdate[], result: QueueProcessingResult): Promise<void> {
    const promises = batch.map(update => this.processUpdate(update, result));
    await Promise.allSettled(promises);
  }

  // Process a single update
  private async processUpdate(update: PendingUpdate, result: QueueProcessingResult): Promise<void> {
    try {
      console.log(`Processing update ID: ${update.id}`);

      // Convert PendingUpdate back to MeasureData
      const measureData: MeasureData = {
        stakeholder_variable_id: update.stakeholder_variable_id,
        value: update.value,
        measurement_date: update.measurement_date,
        file_description: update.file_description || undefined,
        photo: update.photo_uri ? {
          uri: update.photo_uri,
          type: update.photo_type || 'image/jpeg',
          name: update.photo_name || 'photo.jpg'
        } : undefined
      };

      // Attempt to send the update
      const apiResult = await apiService.updateMeasureData(measureData);

      if (apiResult.success) {
        // Success - remove from queue
        await offlineStorageService.removeUpdate(update.id);
        result.successCount++;
        console.log(`Successfully processed update ID: ${update.id}`);
      } else {
        // Failure - increment retry count and keep in queue for next attempt
        const newRetryCount = update.retry_count + 1;
        
        // Update retry count and error (unlimited retries as long as there's network)
        await offlineStorageService.updateRetryCount(
          update.id, 
          newRetryCount, 
          apiResult.error
        );
        result.failureCount++;
        result.errors.push({
          updateId: update.id,
          error: apiResult.error || 'Unknown error'
        });
        console.log(`Retry attempt ${newRetryCount} for update ID: ${update.id}`);
      }
    } catch (error) {
      console.error(`Error processing update ID: ${update.id}`, error);
      
      // Increment retry count and keep in queue for next attempt (unlimited retries)
      const newRetryCount = update.retry_count + 1;
      
      await offlineStorageService.updateRetryCount(
        update.id, 
        newRetryCount, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      result.failureCount++;
      result.errors.push({
        updateId: update.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log(`Retry attempt ${newRetryCount} for update ID: ${update.id} (error: ${error instanceof Error ? error.message : 'Unknown error'})`);
    }
  }

  // Get pending updates count
  async getPendingCount(): Promise<number> {
    try {
      return await offlineStorageService.getPendingUpdatesCount();
    } catch (error) {
      console.error('Failed to get pending count:', error);
      return 0;
    }
  }

  // Get all pending updates
  async getPendingUpdates(): Promise<PendingUpdate[]> {
    try {
      return await offlineStorageService.getPendingUpdates();
    } catch (error) {
      console.error('Failed to get pending updates:', error);
      return [];
    }
  }

  // Clear all pending updates (use with caution)
  async clearAllPending(): Promise<void> {
    try {
      await offlineStorageService.clearAllUpdates();
      console.log('Cleared all pending updates');
    } catch (error) {
      console.error('Failed to clear all pending updates:', error);
      throw error;
    }
  }

  // Queue a new update
  async queueUpdate(measureData: MeasureData): Promise<number> {
    try {
      return await offlineStorageService.queueUpdate(measureData);
    } catch (error) {
      console.error('Failed to queue update:', error);
      throw error;
    }
  }
}

export const offlineQueueManager = new OfflineQueueManager();
