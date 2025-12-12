import * as SecureStore from 'expo-secure-store';

const USER_SIGNATURE_KEY = 'aurica_user_signature';

/**
 * Service for storing and retrieving user signature securely
 */
class SignatureStorageService {
  /**
   * Save user signature to secure storage
   * @param signature Base64 encoded signature image (data:image/png;base64,...)
   */
  async saveUserSignature(signature: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_SIGNATURE_KEY, signature);
      console.log('User signature saved successfully');
    } catch (error) {
      console.error('Error saving user signature:', error);
      throw new Error('Failed to save user signature');
    }
  }

  /**
   * Get user signature from secure storage
   * @returns Base64 encoded signature image or null if not found
   */
  async getUserSignature(): Promise<string | null> {
    try {
      const signature = await SecureStore.getItemAsync(USER_SIGNATURE_KEY);
      return signature;
    } catch (error) {
      console.error('Error getting user signature:', error);
      return null;
    }
  }

  /**
   * Check if user has a saved signature
   * @returns true if signature exists, false otherwise
   */
  async hasUserSignature(): Promise<boolean> {
    try {
      const signature = await this.getUserSignature();
      return signature !== null && signature.length > 0;
    } catch (error) {
      console.error('Error checking user signature:', error);
      return false;
    }
  }

  /**
   * Delete user signature from secure storage
   */
  async deleteUserSignature(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(USER_SIGNATURE_KEY);
      console.log('User signature deleted successfully');
    } catch (error) {
      console.error('Error deleting user signature:', error);
      throw new Error('Failed to delete user signature');
    }
  }
}

export const signatureStorageService = new SignatureStorageService();

