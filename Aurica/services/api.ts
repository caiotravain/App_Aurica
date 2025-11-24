// API service for communicating with Django server
// For Expo Go, use your computer's network IP address instead of localhost
// Replace '192.168.1.100' with your actual IP address (run 'ipconfig' on Windows to find it)
export const API_BASE_URL = 'https://1a016bb27a7a.ngrok-free.app'; // Django development server URL

import NetInfo from '@react-native-community/netinfo';
import { offlineQueueManager } from './offlineQueueManager';
import { offlineStorageService } from './offlineStorage';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Stakeholder {
  id: number;
  name: string;
  company: {
    id: number;
    name: string;
  };
}

export interface StakeholderVariable {
  id: number;
  status: string;
  current_value: string;
  target_value: string;
  indicator_variable: {
    variable: string;
    unit: string;
    response_type: string;
    indicator: {
      title: string;
      sdg: {
        sdg_number: number;
        title: string;
      };
    };
  };
  latest_data?: {
    value: string;
    measurement_date: string;
    data_quality: string;
    has_attachments: boolean;
    file_description?: string;
    created_at: string;
  };
}

export interface MeasureData {
  stakeholder_variable_id: number;
  value: string;
  measurement_date: string;
  file_description?: string;
  photo?: {
    uri: string;
    type: string;
    name: string;
  };
}

export interface SignReportData {
  company: number;
  stakeholder: number;
  responsavel_nome: string;
  assinatura: string; // Base64 encoded image
}

export interface SignReportResponse {
  message?: string;
  pdf_url?: string;
  pdf_method?: string;
  relatorio_id?: number;
  warning?: string;
  error?: string;
  details?: any;
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  get baseUrl(): string {
    return this.baseURL;
  }

  // Get CSRF token from Django
  private async getCSRFToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseURL}/login/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; ReactNative/1.0)',
          'Referer': this.baseURL,
        },
      });
      console.log('CSRF token response status:', response.status);
      console.log('CSRF token response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const html = await response.text();
        console.log('CSRF token HTML length:', html.length);
        
        // Try multiple patterns to extract CSRF token
        let csrfMatch = html.match(/name=['"]csrfmiddlewaretoken['"] value=['"]([^'"]+)['"]/);
        if (!csrfMatch) {
          csrfMatch = html.match(/csrfmiddlewaretoken['"] value=['"]([^'"]+)['"]/);
        }
        if (!csrfMatch) {
          csrfMatch = html.match(/value=['"]([^'"]+)['"] name=['"]csrfmiddlewaretoken['"]/);
        }
        
        if (csrfMatch) {
          console.log('CSRF token found:', csrfMatch[1]);
          return csrfMatch[1];
        } else {
          console.log('CSRF token not found in HTML');
          console.log('HTML preview:', html.substring(0, 500));
          return null;
        }
      } else {
        console.log('Failed to fetch CSRF token, status:', response.status);
        const errorText = await response.text();
        console.log('Error response:', errorText);
        return null;
      }
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      return null;
    }
  }

  // Login method that sends credentials to Django
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      console.log('Starting login process for user:', credentials.username);
      
      // First, get the CSRF token
      const csrfToken = await this.getCSRFToken();
      
      if (!csrfToken) {
        console.log('Failed to get CSRF token');
        return {
          success: false,
          error: 'Unable to get security token. Please refresh and try again.',
        };
      }

      console.log('CSRF token obtained, proceeding with login');

      const formData = new FormData();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      formData.append('csrfmiddlewaretoken', csrfToken);
      formData.append('privacy_policy', 'on'); // Accept privacy policy

      console.log('Sending login request to:', `${this.baseURL}/login/`);

      const response = await fetch(`${this.baseURL}/login/`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies for session management
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // Django expects this for AJAX requests
          'X-CSRFToken': csrfToken, // Include CSRF token in header
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; ReactNative/1.0)',
          'Referer': this.baseURL,
        },
      });

      console.log('Login response status:', response.status);
      console.log('Login response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Login response URL:', response.url);

      if (response.status === 403) {
        const errorText = await response.text();
        console.log('403 Forbidden response:', errorText);
        return {
          success: false,
          error: 'Access forbidden. This might be a CSRF token issue. Please try again.',
        };
      }

      if (response.ok) {
        // Check if this is a JSON response (AJAX request)
        const contentType = response.headers.get('content-type');
        console.log('Response content type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          // Handle JSON response from Django
          const data = await response.json();
          console.log('JSON response data:', data);
          
          if (data.success) {
            return {
              success: true,
              message: data.message || 'Login successful',
            };
          } else {
            return {
              success: false,
              error: data.error || 'Login failed',
            };
          }
        } else {
          // Handle HTML response (fallback)
          const finalUrl = response.url;
          console.log('Final URL after login:', finalUrl);
          
          if (finalUrl.includes('/') && !finalUrl.includes('/login/')) {
            return {
              success: true,
              message: 'Login successful',
            };
          } else {
            // Still on login page, check for error messages
            const text = await response.text();
            console.log('Response text length:', text.length);
            
            if (text.includes('Invalid username or password')) {
              return {
                success: false,
                error: 'Invalid username or password',
              };
            }
            
            // Check for other error messages
            if (text.includes('CSRF')) {
              return {
                success: false,
                error: 'Security token error. Please try again.',
              };
            }
          }
        }
      }
      
      console.log('Login response not ok, status:', response.status);
      const errorText = await response.text();
      console.log('Error response text:', errorText.substring(0, 500));
      
      return {
        success: false,
        error: `Login failed with status ${response.status}. Please check your credentials.`,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  // Check if user is authenticated
  async checkAuth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Referer': this.baseURL,
        },
      });

      // If we get redirected to login, user is not authenticated
      return response.ok && !response.url.includes('/login/');
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  }

  // Logout method
  async logout(): Promise<void> {
    try {
      // First, get the CSRF token
      const csrfToken = await this.getCSRFToken();
      
      if (!csrfToken) {
        console.error('Unable to get CSRF token for logout');
        return;
      }

      const formData = new FormData();
      formData.append('csrfmiddlewaretoken', csrfToken);

      await fetch(`${this.baseURL}/logout/`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': csrfToken,
          'Referer': this.baseURL,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Get user profile (if needed)
  async getUserProfile(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseURL}/api/user/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Referer': this.baseURL,
        },
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  // Get accessible stakeholders for the current user
  async getStakeholders(): Promise<Stakeholder[]> {
    try {
      // Check network status
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable === true;

      if (!isOnline) {
        // Offline: Return cached stakeholders
        console.log('Offline: Loading stakeholders from cache');
        const cached = await offlineStorageService.getCachedStakeholders();
        return cached;
      }

      // Online: Fetch from server
      const response = await fetch(`${this.baseURL}/stakeholders/api/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': this.baseURL,
        },
      });

      console.log('Stakeholders API response status:', response.status);
      console.log('Stakeholders API response headers:', response.headers);

      if (response.ok) {
        const data = await response.json();
        const stakeholders = data.stakeholders || [];
        console.log('Stakeholders API response data:', stakeholders);
        
        // Cache the stakeholders
        try {
          await offlineStorageService.cacheStakeholders(stakeholders);
        } catch (cacheError) {
          console.error('Failed to cache stakeholders:', cacheError);
        }
        
        return stakeholders;
      } else {
        const errorText = await response.text();
        console.error('Stakeholders API error response:', errorText);
        
        // Fallback to cache on error
        const cached = await offlineStorageService.getCachedStakeholders();
        return cached;
      }
    } catch (error) {
      console.error('Get stakeholders error:', error);
      
      // On error, try to return cached data
      try {
        const cached = await offlineStorageService.getCachedStakeholders();
        if (cached.length > 0) {
          console.log('Using cached stakeholders due to error');
          return cached;
        }
      } catch (cacheError) {
        console.error('Failed to get cached stakeholders:', cacheError);
      }
      
      return [];
    }
  }

  // Get stakeholder variables for a specific stakeholder
  async getStakeholderVariables(stakeholderId: number): Promise<StakeholderVariable[]> {
    try {
      // Check network status
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable === true;

      if (!isOnline) {
        // Offline: Return cached variables
        console.log(`Offline: Loading variables for stakeholder ${stakeholderId} from cache`);
        const cached = await offlineStorageService.getCachedStakeholderVariables(stakeholderId);
        return cached;
      }

      // Online: Fetch from server
      const response = await fetch(`${this.baseURL}/stakeholders/get-stakeholder-variables/?stakeholder_id=${stakeholderId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': this.baseURL,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const variables = data.variables || [];
        
        // Cache the variables
        try {
          await offlineStorageService.cacheStakeholderVariables(stakeholderId, variables);
        } catch (cacheError) {
          console.error('Failed to cache stakeholder variables:', cacheError);
        }
        
        return variables;
      }
      
      // Fallback to cache on error
      const cached = await offlineStorageService.getCachedStakeholderVariables(stakeholderId);
      return cached;
    } catch (error) {
      console.error('Get stakeholder variables error:', error);
      
      // On error, try to return cached data
      try {
        const cached = await offlineStorageService.getCachedStakeholderVariables(stakeholderId);
        if (cached.length > 0) {
          console.log(`Using cached variables for stakeholder ${stakeholderId} due to error`);
          return cached;
        }
      } catch (cacheError) {
        console.error('Failed to get cached stakeholder variables:', cacheError);
      }
      
      return [];
    }
  }

  // Update measure data for a stakeholder variable with offline support
  async updateMeasureData(measureData: MeasureData, isOnline: boolean = true): Promise<{ success: boolean; error?: string; queued?: boolean }> {
    // If offline, queue the update
    if (!isOnline) {
      try {
        const queueId = await offlineQueueManager.queueUpdate(measureData);
        return { 
          success: true, 
          error: undefined, 
          queued: true 
        };
      } catch (error) {
        console.error('Failed to queue update:', error);
        return { 
          success: false, 
          error: 'Failed to save update offline. Please try again.' 
        };
      }
    }

    // If online, proceed with normal API call
    return this.updateMeasureDataOnline(measureData);
  }

  // Update measure data for a stakeholder variable (online only)
  async updateMeasureDataOnline(measureData: MeasureData): Promise<{ success: boolean; error?: string }> {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Update measure data attempt ${attempt}/${maxRetries}`);
        
        // First, get the CSRF token
        const csrfToken = await this.getCSRFToken();
        
        if (!csrfToken) {
          return {
            success: false,
            error: 'Unable to get security token. Please refresh and try again.',
          };
        }

        const formData = new FormData();
        formData.append('stakeholder_variable', measureData.stakeholder_variable_id.toString());
        formData.append('value', measureData.value);
        formData.append('measurement_date', measureData.measurement_date);
        formData.append('csrfmiddlewaretoken', csrfToken);
        
        if (measureData.file_description) {
          formData.append('file_description', measureData.file_description);
        }

        // Add photo file if provided
        if (measureData.photo) {
          console.log('Uploading photo:', measureData.photo);
          
          // Create a proper file object for React Native
          const photoFile = {
            uri: measureData.photo.uri,
            type: measureData.photo.type,
            name: measureData.photo.name,
          };
          
          // Append the photo file to FormData
          formData.append('photo_file', photoFile as any);
        }

        // Add timeout for file uploads (longer timeout for retries)
        const controller = new AbortController();
        const timeoutDuration = attempt === 1 ? 60000 : 90000; // 60s first attempt, 90s retry
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        console.log(`Making request to ${this.baseURL}/update-data/`);
        const response = await fetch(`${this.baseURL}/update-data/`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': csrfToken,
            'Referer': this.baseURL,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log(`Response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log('Update successful:', data);
          return { success: data.success, error: data.error };
        } else {
          const data = await response.json();
          console.log('Update failed:', data);
          return { success: false, error: data.error || 'Failed to update measure data' };
        }
      } catch (error) {
        lastError = error;
        console.error(`Update measure data error (attempt ${attempt}):`, error);
        
        // If this is not the last attempt, wait a bit before retrying
        if (attempt < maxRetries) {
          console.log(`Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }
    }

    // If we get here, all retries failed
    console.error('All retry attempts failed. Last error:', lastError);
    
    if (lastError && lastError.name === 'AbortError') {
      return { success: false, error: 'Upload timeout. The image may be too large. Please try with a smaller image.' };
    }
    
    if (lastError && lastError.message && lastError.message.includes('Network request failed')) {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
    
    if (lastError && lastError.message && lastError.message.includes('fetch')) {
      return { success: false, error: 'Connection error. Please check your internet connection and try again.' };
    }
    
    // Handle specific network errors
    if (lastError && lastError.message && (lastError.message.includes('timeout') || lastError.message.includes('TIMEOUT'))) {
      return { success: false, error: 'Request timeout. Please try again with a smaller image.' };
    }
    
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }

  // Sign report and generate PDF
  async signReport(signData: SignReportData): Promise<SignReportResponse> {
    try {
      // Get CSRF token
      const csrfToken = await this.getCSRFToken();
      
      if (!csrfToken) {
        return {
          error: 'Unable to get security token. Please refresh and try again.',
        };
      }

      const response = await fetch(`${this.baseURL}/api/reports/sign/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': this.baseURL,
        },
        credentials: 'include',
        body: JSON.stringify(signData),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // If response is not JSON, get text
          const text = await response.text();
          console.error('Sign report error response (non-JSON):', text);
          return {
            error: `Failed to sign report (Status: ${response.status})`,
            details: text,
          };
        }
        console.error('Sign report error response:', errorData);
        return {
          error: errorData.error || 'Failed to sign report',
          details: errorData.details,
        };
      }
    } catch (error) {
      console.error('Sign report error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }
}

export const apiService = new ApiService();
