import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNetwork } from '../contexts/NetworkContext';
import { offlineQueueManager } from '../services/offlineQueueManager';
import { PendingUpdatesModal } from './PendingUpdatesModal';

interface OfflineIndicatorProps {
  onPress?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onPress }) => {
  const { isOnline } = useNetwork();
  const [pendingCount, setPendingCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Update pending count when network status changes
    const updatePendingCount = async () => {
      try {
        const count = await offlineQueueManager.getPendingCount();
        setPendingCount(count);
        setIsVisible(!isOnline || count > 0);
      } catch (error) {
        console.error('Failed to get pending count:', error);
      }
    };

    updatePendingCount();

    // Listen for queue processing results
    const removeListener = offlineQueueManager.addListener((result) => {
      updatePendingCount();
    });

    return () => {
      removeListener();
    };
  }, [isOnline]);

  useEffect(() => {
    if (isVisible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, fadeAnim]);

  if (!isVisible) {
    return null;
  }

  const getStatusText = () => {
    if (!isOnline) {
      return pendingCount > 0 
        ? `${pendingCount} medida(s) aguardando envio`
        : 'Sem conexão com a internet';
    } else if (pendingCount > 0) {
      return `${pendingCount} medida(s) pendente(s)`;
    }
    return '';
  };

  const getStatusColor = () => {
    if (!isOnline) {
      return '#FF6B6B'; // Red for offline
    } else if (pendingCount > 0) {
      return '#4ECDC4'; // Teal for syncing
    }
    return '#4ECDC4';
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (pendingCount > 0) {
      setShowModal(true);
    }
  };

  return (
    <>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={[styles.indicator, { backgroundColor: getStatusColor() }]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={styles.content}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{getStatusText()}</Text>
            {pendingCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{pendingCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
      
      <PendingUpdatesModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  indicator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  countBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
