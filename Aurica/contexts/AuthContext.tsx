import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { apiService, LoginCredentials } from '../services/api';
import { offlineStorageService } from '../services/offlineStorage';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const CREDENTIALS_KEY = 'aurica_credentials';
const USERNAME_KEY = 'aurica_username';
const AUTH_STATE_KEY = 'aurica_auth_state';
const LAST_LOGIN_KEY = 'aurica_last_login';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start as loading to check stored credentials

  // Check for stored credentials on app start
  useEffect(() => {
    loadStoredCredentials();
  }, []);

  const loadStoredCredentials = async () => {
    try {
      setIsLoading(true);
      
      // Check network status
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable === true;
      
      // Try to get stored authentication state
      const storedAuthState = await SecureStore.getItemAsync(AUTH_STATE_KEY);
      const storedUsername = await SecureStore.getItemAsync(USERNAME_KEY);
      const storedPassword = await SecureStore.getItemAsync(CREDENTIALS_KEY);
      
      if (storedAuthState === 'true' && storedUsername && storedPassword) {
        if (isOnline) {
          // Online: Try to verify with server
          try {
            const credentials: LoginCredentials = {
              username: storedUsername,
              password: storedPassword,
            };
            
            const result = await apiService.login(credentials);
            
            if (result.success) {
              setIsAuthenticated(true);
              await storeAuthState(true);
              return;
            } else {
              // Credentials invalid, clear them
              await clearStoredCredentials();
              setIsAuthenticated(false);
            }
          } catch (error) {
            console.error('Login verification failed:', error);
            // If network error but we have stored auth, allow offline access
            if (error instanceof Error && (error.message.includes('network') || error.message.includes('Network'))) {
              console.log('Network error, allowing offline access');
              setIsAuthenticated(true);
              return;
            }
            // Other errors, clear and deny
            await clearStoredCredentials();
            setIsAuthenticated(false);
          }
        } else {
          // Offline: Allow access if previously authenticated
          console.log('Offline mode: allowing access with stored credentials');
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error loading stored credentials:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const storeCredentials = async (username: string, password: string) => {
    try {
      await SecureStore.setItemAsync(USERNAME_KEY, username);
      await SecureStore.setItemAsync(CREDENTIALS_KEY, password);
      await storeAuthState(true);
    } catch (error) {
      console.error('Error storing credentials:', error);
    }
  };

  const storeAuthState = async (authenticated: boolean) => {
    try {
      await SecureStore.setItemAsync(AUTH_STATE_KEY, authenticated ? 'true' : 'false');
      if (authenticated) {
        await SecureStore.setItemAsync(LAST_LOGIN_KEY, new Date().toISOString());
      }
    } catch (error) {
      console.error('Error storing auth state:', error);
    }
  };

  const clearStoredCredentials = async () => {
    try {
      await SecureStore.deleteItemAsync(USERNAME_KEY);
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
      await SecureStore.deleteItemAsync(AUTH_STATE_KEY);
      await SecureStore.deleteItemAsync(LAST_LOGIN_KEY);
    } catch (error) {
      console.error('Error clearing stored credentials:', error);
    }
  };

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
      // Check network status first
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable === true;
      
      if (!isOnline) {
        // Offline: Check stored auth state
        const storedAuthState = await SecureStore.getItemAsync(AUTH_STATE_KEY);
        if (storedAuthState === 'true') {
          setIsAuthenticated(true);
          return;
        } else {
          setIsAuthenticated(false);
          return;
        }
      }
      
      // Online: Add timeout to prevent hanging
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Auth check timeout')), 5000);
      });
      
      const authPromise = apiService.checkAuth();
      const isAuth = await Promise.race([authPromise, timeoutPromise]);
      
      setIsAuthenticated(isAuth);
      
      // If auth check fails but we have stored credentials, allow offline access
      if (!isAuth) {
        const storedAuthState = await SecureStore.getItemAsync(AUTH_STATE_KEY);
        if (storedAuthState === 'true') {
          // Network might be unstable, allow offline access
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      
      // On error, check if we have stored auth state for offline access
      try {
        const storedAuthState = await SecureStore.getItemAsync(AUTH_STATE_KEY);
        if (storedAuthState === 'true') {
          // Allow offline access if previously authenticated
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      
      // Check network status
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable === true;
      
      if (isOnline) {
        // Online: Try to login with server
        const result = await apiService.login(credentials);
        
        if (result.success) {
          setIsAuthenticated(true);
          // Store credentials for persistent login
          await storeCredentials(credentials.username, credentials.password);
          
          // Fetch and cache report types after successful login
          try {
            const reportTypesResponse = await apiService.getReportTypes();
            if (reportTypesResponse.report_types) {
              await offlineStorageService.cacheReportTypes(reportTypesResponse.report_types);
              console.log('Report types cached successfully');
            }
          } catch (error) {
            console.error('Failed to fetch and cache report types:', error);
            // Don't fail login if report types fetch fails
          }
          
          return { success: true };
        } else {
          return { success: false, error: result.error || 'Login failed' };
        }
      } else {
        // Offline: Check if credentials match stored ones
        const storedUsername = await SecureStore.getItemAsync(USERNAME_KEY);
        const storedPassword = await SecureStore.getItemAsync(CREDENTIALS_KEY);
        
        if (storedUsername === credentials.username && storedPassword === credentials.password) {
          // Credentials match stored ones, allow offline login
          setIsAuthenticated(true);
          await storeAuthState(true);
          return { success: true };
        } else {
          // Credentials don't match or no stored credentials
          return { 
            success: false, 
            error: 'No network connection. Please use previously saved credentials or connect to the internet.' 
          };
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      
      // Check if it's a network error
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable === true;
      
      // Check error message for network-related errors
      const isNetworkError = error instanceof Error && (
        error.message.includes('network') || 
        error.message.includes('Network') ||
        error.message.includes('fetch') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('timeout') ||
        error.message.includes('Network request failed')
      );
      
      if (!isOnline || isNetworkError) {
        // Offline or network error: Try to match stored credentials
        try {
          const storedUsername = await SecureStore.getItemAsync(USERNAME_KEY);
          const storedPassword = await SecureStore.getItemAsync(CREDENTIALS_KEY);
          
          if (storedUsername === credentials.username && storedPassword === credentials.password) {
            setIsAuthenticated(true);
            await storeAuthState(true);
            return { success: true };
          }
        } catch (e) {
          // Ignore errors in offline fallback
        }
      }
      
      // Return appropriate error message
      if (!isOnline || isNetworkError) {
        return { 
          success: false, 
          error: 'No network connection. Please use previously saved credentials or connect to the internet.' 
        };
      }
      
      return { success: false, error: 'Login failed. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await apiService.logout();
      setIsAuthenticated(false);
      // Clear stored credentials on logout
      await clearStoredCredentials();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
