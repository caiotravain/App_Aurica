import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { apiService, Stakeholder, StakeholderVariable, SignReportData, API_BASE_URL } from '../services/api';
import { useNetwork } from '../contexts/NetworkContext';
import { SignatureCapture, SignatureCaptureRef } from './SignatureCapture';

interface ReportSignatureModalProps {
  visible: boolean;
  onClose: () => void;
  stakeholder: Stakeholder | null;
  variables: StakeholderVariable[];
}

export const ReportSignatureModal: React.FC<ReportSignatureModalProps> = ({
  visible,
  onClose,
  stakeholder,
  variables,
}) => {
  const [responsavelNome, setResponsavelNome] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'photo' | 'gallery' | null>(null);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const signatureRef = React.useRef<SignatureCaptureRef>(null);
  const { isOnline } = useNetwork();

  // Get all variables with their last measures
  const variablesWithMeasures = variables.filter(
    (v) => v.latest_data && v.latest_data.value
  );

  useEffect(() => {
    if (!visible) {
      // Reset form when modal closes
      setResponsavelNome('');
      setSignatureImage(null);
      setSignatureMode(null);
      setHasDrawnSignature(false);
    }
  }, [visible]);

  const handlePickSignature = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Precisamos de permissão para acessar a galeria para selecionar a assinatura.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const base64Image = `data:image/jpeg;base64,${asset.base64}`;
          setSignatureImage(base64Image);
          setSignatureMode('gallery');
        } else if (asset.uri) {
          // Read file and convert to base64
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64' as any,
          });
          const base64Image = `data:image/jpeg;base64,${base64}`;
          setSignatureImage(base64Image);
          setSignatureMode('gallery');
        }
      }
    } catch (error) {
      console.error('Error picking signature:', error);
      Alert.alert('Erro', 'Falha ao selecionar assinatura. Tente novamente.');
    }
  };

  const handleTakeSignaturePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Precisamos de permissão para acessar a câmera para tirar foto da assinatura.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const base64Image = `data:image/jpeg;base64,${asset.base64}`;
          setSignatureImage(base64Image);
          setSignatureMode('photo');
        } else if (asset.uri) {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64' as any,
          });
          const base64Image = `data:image/jpeg;base64,${base64}`;
          setSignatureImage(base64Image);
          setSignatureMode('photo');
        }
      }
    } catch (error) {
      console.error('Error taking signature photo:', error);
      Alert.alert('Erro', 'Falha ao tirar foto da assinatura. Tente novamente.');
    }
  };

  const handleSignatureChange = (hasSignature: boolean) => {
    setHasDrawnSignature(hasSignature);
  };

  const handleSignatureClear = () => {
    setHasDrawnSignature(false);
  };


  const handleSubmit = async () => {
    if (!stakeholder) {
      Alert.alert('Erro', 'Stakeholder não selecionado');
      return;
    }

    if (!responsavelNome.trim()) {
      Alert.alert('Erro', 'Por favor, insira o nome do responsável');
      return;
    }

    // Get signature from drawing if in draw mode
    let finalSignature = signatureImage;
    if (signatureMode === 'draw' && signatureRef.current) {
      if (!signatureRef.current.hasSignature()) {
        Alert.alert('Erro', 'Por favor, desenhe uma assinatura');
        return;
      }
      try {
        finalSignature = await signatureRef.current.getSignatureData();
        if (!finalSignature) {
          Alert.alert('Erro', 'Falha ao processar assinatura. Tente novamente.');
          return;
        }
      } catch (error) {
        console.error('Error getting signature data:', error);
        Alert.alert('Erro', 'Falha ao capturar assinatura. Tente novamente.');
        return;
      }
    }

    if (!finalSignature) {
      Alert.alert('Erro', 'Por favor, adicione uma assinatura');
      return;
    }

    if (!isOnline) {
      Alert.alert(
        'Sem Conexão',
        'É necessário estar online para gerar e assinar o relatório.'
      );
      return;
    }

    try {
      setIsLoading(true);

      const signData: SignReportData = {
        company: stakeholder.company.id,
        stakeholder: stakeholder.id,
        responsavel_nome: responsavelNome.trim(),
        assinatura: finalSignature,
      };

      console.log('Submitting signature data:', {
        company: signData.company,
        stakeholder: signData.stakeholder,
        responsavel_nome: signData.responsavel_nome,
        assinatura_format: signData.assinatura?.substring(0, 50) + '...',
        signature_mode: signatureMode,
      });

      const result = await apiService.signReport(signData);

      if (result.error) {
        let errorMessage = result.error;
        if (result.details) {
          // Show detailed validation errors
          const detailsStr = typeof result.details === 'string' 
            ? result.details 
            : JSON.stringify(result.details, null, 2);
          errorMessage = `${result.error}\n\nDetalhes: ${detailsStr}`;
        }
        Alert.alert('Erro', errorMessage);
        
        // If it's a signature format error, suggest using photo/gallery
        if (errorMessage.includes('assinatura') || errorMessage.includes('image') || errorMessage.includes('format')) {
          Alert.alert(
            'Dica',
            'O formato de assinatura desenhada pode não ser aceito. Tente usar a opção "Tirar Foto" ou "Escolher da Galeria" para uma melhor compatibilidade.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Success - open PDF if available
        if (result.pdf_url) {
          try {
            // Construct full URL if it's a relative URL
            const fullUrl = result.pdf_url.startsWith('http')
              ? result.pdf_url
              : `${API_BASE_URL}${result.pdf_url.startsWith('/') ? '' : '/'}${result.pdf_url}`;

            console.log('Opening PDF at:', fullUrl);

            // Open the PDF URL in browser/PDF viewer
            const supported = await Linking.canOpenURL(fullUrl);
            if (supported) {
              await Linking.openURL(fullUrl);
              Alert.alert(
                'Sucesso',
                result.message || 'Relatório assinado e gerado com sucesso! O PDF foi aberto no navegador.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      onClose();
                    },
                  },
                ]
              );
            } else {
              Alert.alert(
                'Sucesso',
                result.message || 'Relatório assinado e gerado com sucesso!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      onClose();
                    },
                  },
                ]
              );
            }
          } catch (linkError) {
            console.error('Error opening PDF:', linkError);
            Alert.alert(
              'Sucesso',
              result.message || 'Relatório assinado e gerado com sucesso!',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    onClose();
                  },
                },
              ]
            );
          }
        } else {
          Alert.alert(
            'Sucesso',
            result.message || 'Relatório assinado e gerado com sucesso!',
            [
              {
                text: 'OK',
                onPress: () => {
                  onClose();
                },
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error signing report:', error);
      Alert.alert('Erro', 'Falha ao assinar relatório. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Assinar Visita</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#7f8c8d" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            scrollEnabled={signatureMode !== 'draw'}
          >
            {/* Last Measures Section */}
            {variablesWithMeasures.length > 0 && (
              <>
                {signatureMode === 'draw' ? (
                  <TouchableOpacity
                    style={styles.measuresMinimizedBar}
                    onPress={() => {
                      setSignatureMode(null);
                      setSignatureImage(null);
                      setHasDrawnSignature(false);
                    }}
                  >
                    <Ionicons name="chevron-up" size={20} color="#2d6122" />
                    <Text style={styles.minimizedBarText}>
                      Últimas Medidas ({variablesWithMeasures.length})
                    </Text>
                    <Ionicons name="close" size={18} color="#7f8c8d" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.measuresSection}>
                    <Text style={styles.sectionTitle}>Últimas Medidas Coletadas</Text>
                    <Text style={styles.sectionSubtitle}>
                      {variablesWithMeasures.length} variável(is) com medidas
                    </Text>
                    <ScrollView 
                      style={styles.measuresScrollBox}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      {variablesWithMeasures.map((variable) => (
                        <View key={variable.id} style={styles.measureItem}>
                          <View style={styles.measureHeader}>
                            <Text style={styles.measureVariableName}>
                              {variable.indicator_variable.variable}
                            </Text>
                   
                          </View>
                          <View style={styles.measureDetails}>
                            <Text style={styles.measureValue}>
                              {variable.latest_data?.value}
                            </Text>
                            {variable.latest_data?.measurement_date && (
                              <Text style={styles.measureDate}>
                                Data: {variable.latest_data.measurement_date}
                              </Text>
                            )}
                            {variable.latest_data?.created_at && (
                              <Text style={styles.measureCreatedAt}>
                                Coletado em: {variable.latest_data.created_at}
                              </Text>
                            )}
                            {variable.latest_data?.has_attachments && (
                              <View style={styles.attachmentIndicator}>
                                <Ionicons name="document-attach" size={14} color="#2d6122" />
                                <Text style={styles.attachmentText}>Com anexo</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {/* Responsável Nome */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Nome do Responsável <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={responsavelNome}
                onChangeText={setResponsavelNome}
                placeholder="Digite o nome do responsável"
                placeholderTextColor="#999"
                editable={!isLoading}
              />
            </View>

            {/* Signature Section */}
            <View style={styles.signatureSection}>
              <Text style={styles.label}>
                Assinatura <Text style={styles.required}>*</Text>
              </Text>
              {signatureImage && signatureMode !== 'draw' ? (
                <View style={styles.signaturePreview}>
                  <Image
                    source={{ uri: signatureImage }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={styles.removeSignatureButton}
                    onPress={() => {
                      setSignatureImage(null);
                      setSignatureMode(null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    <Text style={styles.removeSignatureText}>Remover</Text>
                  </TouchableOpacity>
                </View>
              ) : signatureMode === 'draw' ? (
                <View style={styles.drawSignatureContainer}>
                  <SignatureCapture
                    ref={signatureRef}
                    onSignatureChange={handleSignatureChange}
                    onClear={handleSignatureClear}
                    width={Dimensions.get('window').width - 80}
                    height={200}
                  />
                  <TouchableOpacity
                    style={styles.changeSignatureButton}
                    onPress={() => {
                      setSignatureMode(null);
                      setSignatureImage(null);
                      setHasDrawnSignature(false);
                    }}
                  >
                    <Text style={styles.changeSignatureText}>Escolher outro método</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={() => setSignatureMode('draw')}
                    disabled={isLoading}
                  >
                    <Ionicons name="create-outline" size={24} color="#2d6122" />
                    <Text style={styles.signatureButtonText}>Desenhar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={handleTakeSignaturePhoto}
                    disabled={isLoading}
                  >
                    <Ionicons name="camera" size={24} color="#2d6122" />
                    <Text style={styles.signatureButtonText}>Tirar Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={handlePickSignature}
                    disabled={isLoading}
                  >
                    <Ionicons name="image" size={24} color="#2d6122" />
                    <Text style={styles.signatureButtonText}>Galeria</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading || !isOnline}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Assinar e Gerar Relatório
                </Text>
              )}
            </TouchableOpacity>

            {!isOnline && (
              <Text style={styles.offlineWarning}>
                É necessário estar online para gerar o relatório.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    width: '100%',
    height: '100%',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d6122',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  measuresSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  measuresMinimizedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  minimizedBarText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#2d6122',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d6122',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 12,
  },
  measuresScrollBox: {
    maxHeight: 300,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    padding: 8,
  },
  measureItem: {
    backgroundColor: '#fafbfa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  measureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  measureVariableName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#2d6122',
  },
  qualityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  qualityBadgeHigh: {
    backgroundColor: '#d4edda',
  },
  qualityBadgeMedium: {
    backgroundColor: '#fff3cd',
  },
  qualityBadgeLow: {
    backgroundColor: '#f8d7da',
  },
  qualityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2d6122',
  },
  measureDetails: {
    gap: 4,
  },
  measureValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d6122',
    marginBottom: 4,
  },
  measureDate: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  measureCreatedAt: {
    fontSize: 11,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  attachmentText: {
    fontSize: 11,
    color: '#2d6122',
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d6122',
    marginBottom: 8,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#fafbfa',
    color: '#2d6122',
  },
  signatureSection: {
    marginBottom: 20,
  },
  signatureButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  signatureButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8f0',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#e8f5e8',
    gap: 8,
  },
  signatureButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d6122',
  },
  signaturePreview: {
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fafbfa',
  },
  signatureImage: {
    width: '100%',
    height: 150,
    marginBottom: 12,
  },
  removeSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  removeSignatureText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#2d6122',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#a0b8a0',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  offlineWarning: {
    textAlign: 'center',
    color: '#e74c3c',
    fontSize: 12,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  drawSignatureContainer: {
    marginBottom: 12,
  },
  changeSignatureButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeSignatureText: {
    color: '#2d6122',
    fontSize: 14,
    fontWeight: '500',
  },
});

