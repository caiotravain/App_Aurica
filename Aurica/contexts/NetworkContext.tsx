import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  isConnected: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

  useEffect(() => {
    // Get initial network state
    const getInitialNetworkState = async () => {
      try {
        const state = await NetInfo.fetch();
        setIsConnected(state.isConnected ?? false);
        setIsInternetReachable(state.isInternetReachable);
        setConnectionType(state.type);
        setIsOnline(state.isConnected && state.isInternetReachable === true);
      } catch (error) {
        console.error('Failed to get initial network state:', error);
        // Default to offline if we can't determine the state
        setIsOnline(false);
        setIsConnected(false);
        setIsInternetReachable(false);
      }
    };

    getInitialNetworkState();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('Network state changed:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type
      });

      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable);
      setConnectionType(state.type);
      
      // Consider online only if both connected and internet is reachable
      const online = state.isConnected && state.isInternetReachable === true;
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const value: NetworkContextType = {
    isOnline,
    isConnected,
    connectionType,
    isInternetReachable,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
