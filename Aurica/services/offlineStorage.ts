import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { MeasureData, Stakeholder, StakeholderVariable } from './api';

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

      // Create stakeholders table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS stakeholders (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          administrator TEXT,
          company_id INTEGER NOT NULL,
          company_name TEXT NOT NULL,
          cached_at TEXT NOT NULL
        );
      `);

      // Create stakeholder_variables table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS stakeholder_variables (
          id INTEGER PRIMARY KEY,
          stakeholder_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          current_value TEXT,
          target_value TEXT,
          variable TEXT NOT NULL,
          unit TEXT,
          response_type TEXT NOT NULL,
          indicator_title TEXT NOT NULL,
          sdg_number INTEGER NOT NULL,
          sdg_title TEXT NOT NULL,
          latest_value TEXT,
          latest_measurement_date TEXT,
          latest_data_quality TEXT,
          latest_has_attachments INTEGER DEFAULT 0,
          latest_file_description TEXT,
          latest_created_at TEXT,
          cached_at TEXT NOT NULL,
          FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id)
        );
      `);

      // Create indexes for faster queries
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_pending_updates_created_at 
        ON pending_updates(created_at);
      `);
      
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_stakeholder_variables_stakeholder_id 
        ON stakeholder_variables(stakeholder_id);
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
      
      // If there's a photo, copy it to a permanent location
      let photoUri = measureData.photo?.uri || null;
      let photoType = measureData.photo?.type || null;
      let photoName = measureData.photo?.name || null;
      
      if (measureData.photo?.uri) {
        try {
          // Create a permanent directory for offline photos
          const offlinePhotosDir = `${FileSystem.documentDirectory}offline_photos/`;
          const dirInfo = await FileSystem.getInfoAsync(offlinePhotosDir);
          
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(offlinePhotosDir, { intermediates: true });
          }
          
          // Generate a unique filename
          const timestamp = Date.now();
          const extension = photoName?.split('.').pop() || 'jpg';
          const permanentFileName = `photo_${timestamp}.${extension}`;
          const permanentUri = `${offlinePhotosDir}${permanentFileName}`;
          
          // Copy the photo to permanent location
          await FileSystem.copyAsync({
            from: measureData.photo.uri,
            to: permanentUri,
          });
          
          console.log(`Copied photo from ${measureData.photo.uri} to ${permanentUri}`);
          photoUri = permanentUri;
        } catch (photoError) {
          console.error('Failed to copy photo to permanent location:', photoError);
          // Continue with original URI if copy fails (might already be permanent)
        }
      }
      
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
          photoUri,
          photoType,
          photoName,
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
      // Get the update to check if it has a photo that needs cleanup
      const update = await this.db.getFirstAsync(
        `SELECT photo_uri FROM pending_updates WHERE id = ?`,
        [updateId]
      ) as { photo_uri?: string } | null;
      
      // Delete the photo file if it exists and is in our offline_photos directory
      if (update?.photo_uri && update.photo_uri.includes('offline_photos/')) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(update.photo_uri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(update.photo_uri, { idempotent: true });
            console.log(`Deleted photo file: ${update.photo_uri}`);
          }
        } catch (photoError) {
          console.error('Failed to delete photo file:', photoError);
          // Continue with update removal even if photo deletion fails
        }
      }
      
      // Remove the update from database
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

  // Stakeholders methods
  async cacheStakeholders(stakeholders: Stakeholder[]): Promise<void> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Clear existing stakeholders
      await this.db.runAsync(`DELETE FROM stakeholders`);
      
      // Insert new stakeholders
      const now = new Date().toISOString();
      for (const stakeholder of stakeholders) {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO stakeholders (id, name, administrator, company_id, company_name, cached_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            stakeholder.id,
            stakeholder.name,
            stakeholder.administrator || null,
            stakeholder.company.id,
            stakeholder.company.name,
            now
          ]
        );
      }
      
      console.log(`Cached ${stakeholders.length} stakeholders`);
    } catch (error) {
      console.error('Failed to cache stakeholders:', error);
      throw error;
    }
  }

  async getCachedStakeholders(): Promise<Stakeholder[]> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM stakeholders ORDER BY name ASC`
      );
      
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        administrator: row.administrator || undefined,
        company: {
          id: row.company_id,
          name: row.company_name,
        },
      })) as Stakeholder[];
    } catch (error) {
      console.error('Failed to get cached stakeholders:', error);
      return [];
    }
  }

  // Stakeholder variables methods
  async cacheStakeholderVariables(stakeholderId: number, variables: StakeholderVariable[]): Promise<void> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Clear existing variables for this stakeholder
      await this.db.runAsync(`DELETE FROM stakeholder_variables WHERE stakeholder_id = ?`, [stakeholderId]);
      
      // Insert new variables
      const now = new Date().toISOString();
      for (const variable of variables) {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO stakeholder_variables (
            id, stakeholder_id, status, current_value, target_value,
            variable, unit, response_type, indicator_title,
            sdg_number, sdg_title,
            latest_value, latest_measurement_date, latest_data_quality,
            latest_has_attachments, latest_file_description, latest_created_at,
            cached_at
          )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            variable.id,
            stakeholderId,
            variable.status,
            variable.current_value || null,
            variable.target_value || null,
            variable.indicator_variable.variable,
            variable.indicator_variable.unit || null,
            variable.indicator_variable.response_type,
            variable.indicator_variable.indicator.title,
            variable.indicator_variable.indicator.sdg.sdg_number,
            variable.indicator_variable.indicator.sdg.title,
            variable.latest_data?.value || null,
            variable.latest_data?.measurement_date || null,
            variable.latest_data?.data_quality || null,
            variable.latest_data?.has_attachments ? 1 : 0,
            variable.latest_data?.file_description || null,
            variable.latest_data?.created_at || null,
            now
          ]
        );
      }
      
      console.log(`Cached ${variables.length} variables for stakeholder ${stakeholderId}`);
    } catch (error) {
      console.error('Failed to cache stakeholder variables:', error);
      throw error;
    }
  }

  async getCachedStakeholderVariables(stakeholderId: number): Promise<StakeholderVariable[]> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM stakeholder_variables 
         WHERE stakeholder_id = ? 
         ORDER BY variable ASC`,
        [stakeholderId]
      );
      
      return result.map((row: any) => ({
        id: row.id,
        status: row.status,
        current_value: row.current_value || '',
        target_value: row.target_value || '',
        indicator_variable: {
          variable: row.variable,
          unit: row.unit || '',
          response_type: row.response_type,
          indicator: {
            title: row.indicator_title,
            sdg: {
              sdg_number: row.sdg_number,
              title: row.sdg_title,
            },
          },
        },
        latest_data: row.latest_value ? {
          value: row.latest_value,
          measurement_date: row.latest_measurement_date || '',
          data_quality: row.latest_data_quality || '',
          has_attachments: row.latest_has_attachments === 1,
          file_description: row.latest_file_description || undefined,
          created_at: row.latest_created_at || '',
        } : undefined,
      })) as StakeholderVariable[];
    } catch (error) {
      console.error('Failed to get cached stakeholder variables:', error);
      return [];
    }
  }

  async clearAllCache(): Promise<void> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(`DELETE FROM stakeholders`);
      await this.db.runAsync(`DELETE FROM stakeholder_variables`);
      console.log('Cleared all cached data');
    } catch (error) {
      console.error('Failed to clear cache:', error);
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
