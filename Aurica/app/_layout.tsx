import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { AuthProvider } from '../contexts/AuthContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import { offlineQueueManager } from '../services/offlineQueueManager';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Start auto-processing when the app starts
    offlineQueueManager.startAutoProcessing();
    
    return () => {
      // Clean up when the app unmounts
      offlineQueueManager.stopAutoProcessing();
    };
  }, []);

  return (
    <NetworkProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
          <OfflineIndicator />
        </ThemeProvider>
      </AuthProvider>
    </NetworkProvider>
  );
}
