import * as SQLite from 'expo-sqlite';
import { MeasureData } from './api';

export interface PendingUpdate {
  id: number;
  stakeholder_variable_id: number;
  value: string;
  measurement_date: string;
  file_description?: string;
  photo_uri?: string;
  photo_type?: string;
  photo_name?: string;
  created_at: string;
  retry_count: number;
  last_error?: string;
}

class OfflineStorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.db = await SQLite.openDatabaseAsync('aurica_offline.db');
      
      // Create pending_updates table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_updates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          stakeholder_variable_id INTEGER NOT NULL,
          value TEXT NOT NULL,
          measurement_date TEXT NOT NULL,
          file_description TEXT,
          photo_uri TEXT,
          photo_type TEXT,
          photo_name TEXT,
          created_at TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT
        );
      `);

      // Create index for faster queries
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_pending_updates_created_at 
        ON pending_updates(created_at);
      `);

      this.isInitialized = true;
      console.log('Offline storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
      throw error;
    }
  }

  async queueUpdate(measureData: MeasureData): Promise<number> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const now = new Date().toISOString();
      
      const result = await this.db.runAsync(
        `INSERT INTO pending_updates (
          stakeholder_variable_id, value, measurement_date, 
          file_description, photo_uri, photo_type, photo_name, 
          created_at, retry_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          measureData.stakeholder_variable_id,
          measureData.value,
          measureData.measurement_date,
          measureData.file_description || null,
          measureData.photo?.uri || null,
          measureData.photo?.type || null,
          measureData.photo?.name || null,
          now
        ]
      );

      console.log(`Queued update with ID: ${result.lastInsertRowId}`);
      return result.lastInsertRowId as number;
    } catch (error) {
      console.error('Failed to queue update:', error);
      throw error;
    }
  }

  async getPendingUpdates(): Promise<PendingUpdate[]> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM pending_updates 
         ORDER BY created_at ASC`
      );
      
      return result as PendingUpdate[];
    } catch (error) {
      console.error('Failed to get pending updates:', error);
      throw error;
    }
  }

  async getPendingUpdatesCount(): Promise<number> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.getFirstAsync(
        `SELECT COUNT(*) as count FROM pending_updates`
      );
      
      return (result as any)?.count || 0;
    } catch (error) {
      console.error('Failed to get pending updates count:', error);
      return 0;
    }
  }

  async removeUpdate(updateId: number): Promise<void> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(
        `DELETE FROM pending_updates WHERE id = ?`,
        [updateId]
      );
      
      console.log(`Removed update with ID: ${updateId}`);
    } catch (error) {
      console.error('Failed to remove update:', error);
      throw error;
    }
  }

  async updateRetryCount(updateId: number, retryCount: number, lastError?: string): Promise<void> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(
        `UPDATE pending_updates 
         SET retry_count = ?, last_error = ? 
         WHERE id = ?`,
        [retryCount, lastError || null, updateId]
      );
      
      console.log(`Updated retry count for update ID: ${updateId}`);
    } catch (error) {
      console.error('Failed to update retry count:', error);
      throw error;
    }
  }

  async clearAllUpdates(): Promise<void> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(`DELETE FROM pending_updates`);
      console.log('Cleared all pending updates');
    } catch (error) {
      console.error('Failed to clear all updates:', error);
      throw error;
    }
  }

  async getUpdatesByStakeholderVariable(stakeholderVariableId: number): Promise<PendingUpdate[]> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM pending_updates 
         WHERE stakeholder_variable_id = ? 
         ORDER BY created_at ASC`,
        [stakeholderVariableId]
      );
      
      return result as PendingUpdate[];
    } catch (error) {
      console.error('Failed to get updates by stakeholder variable:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export const offlineStorageService = new OfflineStorageService();
