import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNetwork } from '../contexts/NetworkContext';
import { apiService, MeasureData, StakeholderVariable } from '../services/api';
import { PhotoPicker } from './PhotoPickerExpoGo';

interface VariableFormProps {
  variable: StakeholderVariable;
  onSuccess: () => void;
}

export const VariableForm: React.FC<VariableFormProps> = ({ variable, onSuccess }) => {
  const [value, setValue] = useState('');
  const [measurementDate, setMeasurementDate] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<{ uri: string; type: string; name: string } | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const { isOnline } = useNetwork();

  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  React.useEffect(() => {
    // Set default date to today
    setMeasurementDate(getCurrentDate());
  }, []);

  const handleSubmit = async () => {
    if (!value.trim()) {
      Alert.alert('Erro', 'Por favor, insira um valor para a medida');
      return;
    }

    if (!measurementDate) {
      Alert.alert('Erro', 'Por favor, selecione uma data de medição');
      return;
    }

    try {
      setIsLoading(true);

      const measureData: MeasureData = {
        stakeholder_variable_id: variable.id,
        value: value.trim(),
        measurement_date: measurementDate,
        file_description: fileDescription.trim() || undefined,
        photo: selectedPhoto,
      };

      const result = await apiService.updateMeasureData(measureData, isOnline);

      if (result.success) {
        if (result.queued) {
          Alert.alert(
            'Salvo Offline',
            'Medida salva localmente e será enviada quando a conexão for restaurada.',
            [
              {
                text: 'OK',
                onPress: onSuccess,
              },
            ]
          );
        } else {
          Alert.alert(
            'Sucesso',
            'Medida adicionada com sucesso!',
            [
              {
                text: 'OK',
                onPress: onSuccess,
              },
            ]
          );
        }
      } else {
        Alert.alert('Erro', result.error || 'Falha ao adicionar medida');
      }
    } catch (error) {
      console.error('Error submitting measure:', error);
      Alert.alert('Erro', 'Falha ao adicionar medida. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const handlePhotoSelected = (photo: { uri: string; type: string; name: string }) => {
    setSelectedPhoto(photo);
  };

  const handlePhotoRemoved = () => {
    setSelectedPhoto(undefined);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Variable Information */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Informações da Variável</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Variável:</Text>
            <Text style={styles.infoValue}>{variable.indicator_variable.variable}</Text>
          </View>
  
          {variable.current_value && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Valor Atual:</Text>
              <Text style={styles.infoValue}>{variable.current_value} {variable.indicator_variable.unit || ''}</Text>
            </View>
          )}
          
          {variable.target_value && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Valor Meta:</Text>
              <Text style={styles.infoValue}>{variable.target_value} {variable.indicator_variable.unit || ''}</Text>
            </View>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Nova Medida</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Valor {variable.indicator_variable.unit ? `(${variable.indicator_variable.unit})` : ''}
              <Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={`Insira o valor${variable.indicator_variable.unit ? ` em ${variable.indicator_variable.unit}` : ''}`}
              placeholderTextColor="#999"
              keyboardType={variable.indicator_variable.response_type === 'quantitativo' ? 'numeric' : 'default'}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Data da Medição<Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={measurementDate}
              onChangeText={setMeasurementDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              editable={!isLoading}
            />
            <Text style={styles.helpText}>
              Formato: YYYY-MM-DD (ex: {getCurrentDate()})
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Descrição do Arquivo (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={fileDescription}
              onChangeText={setFileDescription}
              placeholder="Descreva o arquivo anexado ou fonte dos dados"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              editable={!isLoading}
            />
          </View>

          {/* Photo Picker */}
          <PhotoPicker
            onPhotoSelected={handlePhotoSelected}
            onPhotoRemoved={handlePhotoRemoved}
            selectedPhoto={selectedPhoto}
            disabled={isLoading}
          />
        </View>


        {/* Offline Status */}
        {!isOnline && (
          <View style={styles.offlineStatus}>
            <Text style={styles.offlineText}>
              📱 Sem conexão - A medida será salva localmente
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {!isOnline ? 'Salvar Offline' : 'Adicionar Medida'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#2d6122',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#2d6122',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d6122', // Aurica main color
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7f8c8d',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#2d6122', // Aurica main color
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d6122', // Aurica main color
    marginBottom: 8,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: '#fafbfa',
    color: '#2d6122', // Aurica main color
    fontWeight: '500',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
  },
  submitButton: {
    backgroundColor: '#2d6122', // Aurica main color
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2d6122',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#a0b8a0',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  offlineStatus: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  offlineText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
