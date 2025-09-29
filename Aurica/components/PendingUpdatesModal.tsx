import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { offlineQueueManager } from '../services/offlineQueueManager';
import { PendingUpdate } from '../services/offlineStorage';

interface PendingUpdatesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PendingUpdatesModal: React.FC<PendingUpdatesModalProps> = ({ visible, onClose }) => {
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPendingUpdates();
    }
  }, [visible]);

  const loadPendingUpdates = async () => {
    try {
      setIsLoading(true);
      const updates = await offlineQueueManager.getPendingUpdates();
      setPendingUpdates(updates);
    } catch (error) {
      console.error('Failed to load pending updates:', error);
      Alert.alert('Erro', 'Falha ao carregar atualizações pendentes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setIsProcessing(true);
      const result = await offlineQueueManager.processQueue();
      
      if (result.successCount > 0) {
        Alert.alert(
          'Sucesso',
          `${result.successCount} atualização(ões) enviada(s) com sucesso!`
        );
      }
      
      if (result.failureCount > 0) {
        Alert.alert(
          'Aviso',
          `${result.failureCount} atualização(ões) falharam. Verifique sua conexão.`
        );
      }
      
      // Reload the list
      await loadPendingUpdates();
    } catch (error) {
      console.error('Failed to process queue:', error);
      Alert.alert('Erro', 'Falha ao processar fila de atualizações');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Confirmar',
      'Tem certeza que deseja remover todas as atualizações pendentes? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await offlineQueueManager.clearAllPending();
              await loadPendingUpdates();
              Alert.alert('Sucesso', 'Todas as atualizações pendentes foram removidas');
            } catch (error) {
              console.error('Failed to clear pending updates:', error);
              Alert.alert('Erro', 'Falha ao remover atualizações pendentes');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Atualizações Pendentes</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.processButton]}
            onPress={handleProcessQueue}
            disabled={isProcessing || pendingUpdates.length === 0}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionButtonText}>Enviar Agora</Text>
            )}
          </TouchableOpacity>

          {pendingUpdates.length > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={handleClearAll}
            >
              <Text style={styles.actionButtonText}>Limpar Tudo</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2d6122" />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        ) : pendingUpdates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma atualização pendente</Text>
            <Text style={styles.emptySubtext}>
              Todas as suas medidas foram enviadas com sucesso!
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.listContainer}>
            {pendingUpdates.map((update) => (
              <View key={update.id} style={styles.updateItem}>
                <View style={styles.updateHeader}>
                  <Text style={styles.updateId}>#{update.id}</Text>
                  <Text style={styles.updateDate}>
                    {formatDate(update.created_at)}
                  </Text>
                </View>
                
                <View style={styles.updateDetails}>
                  <Text style={styles.updateLabel}>Valor:</Text>
                  <Text style={styles.updateValue}>{update.value}</Text>
                </View>
                
                <View style={styles.updateDetails}>
                  <Text style={styles.updateLabel}>Data da Medição:</Text>
                  <Text style={styles.updateValue}>{update.measurement_date}</Text>
                </View>
                
                {update.file_description && (
                  <View style={styles.updateDetails}>
                    <Text style={styles.updateLabel}>Descrição:</Text>
                    <Text style={styles.updateValue}>{update.file_description}</Text>
                  </View>
                )}
                
                {update.photo_uri && (
                  <View style={styles.updateDetails}>
                    <Text style={styles.updateLabel}>Foto:</Text>
                    <Text style={styles.updateValue}>Anexada</Text>
                  </View>
                )}
                
                {update.retry_count > 0 && (
                  <View style={styles.updateDetails}>
                    <Text style={styles.updateLabel}>Tentativas:</Text>
                    <Text style={styles.updateValue}>{update.retry_count}/3</Text>
                  </View>
                )}
                
                {update.last_error && (
                  <View style={styles.updateDetails}>
                    <Text style={styles.updateLabel}>Último Erro:</Text>
                    <Text style={styles.updateError}>{update.last_error}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2d6122',
    paddingTop: 60,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  processButton: {
    backgroundColor: '#2d6122',
  },
  clearButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d6122',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
    padding: 20,
  },
  updateItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d6122',
  },
  updateDate: {
    fontSize: 12,
    color: '#666',
  },
  updateDetails: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  updateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    width: 120,
  },
  updateValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  updateError: {
    fontSize: 14,
    color: '#e74c3c',
    flex: 1,
    fontStyle: 'italic',
  },
});
