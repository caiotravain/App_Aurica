// API service for communicating with Django server
// For Expo Go, use your computer's network IP address instead of localhost
// Replace '192.168.1.100' with your actual IP address (run 'ipconfig' on Windows to find it)
const API_BASE_URL = 'http://bc1ebe247967.ngrok-free.app'; // Django development server URL

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
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  // Get CSRF token from Django
  private async getCSRFToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseURL}/login/`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const html = await response.text();
        // Extract CSRF token from the HTML form
        const csrfMatch = html.match(/name=['"]csrfmiddlewaretoken['"] value=['"]([^'"]+)['"]/);
        return csrfMatch ? csrfMatch[1] : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      return null;
    }
  }

  // Login method that sends credentials to Django
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // First, get the CSRF token
      const csrfToken = await this.getCSRFToken();
      
      if (!csrfToken) {
        return {
          success: false,
          error: 'Unable to get security token. Please refresh and try again.',
        };
      }

      const formData = new FormData();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      formData.append('csrfmiddlewaretoken', csrfToken);

      const response = await fetch(`${this.baseURL}/login/`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies for session management
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // Django expects this for AJAX requests
          'X-CSRFToken': csrfToken, // Include CSRF token in header
        },
      });

      if (response.ok) {
        // Check if we were redirected to home page (successful login)
        const finalUrl = response.url;
        if (finalUrl.includes('/') && !finalUrl.includes('/login/')) {
          return {
            success: true,
            message: 'Login successful',
          };
        } else {
          // Still on login page, check for error messages
          const text = await response.text();
          if (text.includes('Invalid username or password')) {
            return {
              success: false,
              error: 'Invalid username or password',
            };
          }
        }
      }

      return {
        success: false,
        error: 'Login failed. Please check your credentials.',
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
      const response = await fetch(`${this.baseURL}/stakeholders/api/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      console.log('Stakeholders API response status:', response.status);
      console.log('Stakeholders API response headers:', response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('Stakeholders API response data:', data);
        return data.stakeholders || [];
      } else {
        const errorText = await response.text();
        console.error('Stakeholders API error response:', errorText);
        return [];
      }
    } catch (error) {
      console.error('Get stakeholders error:', error);
      return [];
    }
  }

  // Get stakeholder variables for a specific stakeholder
  async getStakeholderVariables(stakeholderId: number): Promise<StakeholderVariable[]> {
    try {
      const response = await fetch(`${this.baseURL}/stakeholders/get-stakeholder-variables/?stakeholder_id=${stakeholderId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.variables || [];
      }
      return [];
    } catch (error) {
      console.error('Get stakeholder variables error:', error);
      return [];
    }
  }

  // Update measure data for a stakeholder variable
  async updateMeasureData(measureData: MeasureData): Promise<{ success: boolean; error?: string }> {
    try {
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

      const response = await fetch(`${this.baseURL}/update-data/`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': csrfToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { success: data.success, error: data.error };
      } else {
        const data = await response.json();
        return { success: false, error: data.error || 'Failed to update measure data' };
      }
    } catch (error) {
      console.error('Update measure data error:', error);
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }
}

export const apiService = new ApiService();
