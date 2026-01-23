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
import { apiService, Stakeholder, StakeholderVariable, SignReportData, API_BASE_URL, ReportType } from '../services/api';
import { useNetwork } from '../contexts/NetworkContext';
import { SignatureCapture, SignatureCaptureRef } from './SignatureCapture';
import { signatureStorageService } from '../services/signatureStorage';
import { formatCpf, validateCpf, getCpfValidationError, cleanCpf } from '../utils/cpfValidation';
import { offlineStorageService } from '../services/offlineStorage';
import { generateDesviosReportFromOfflineData } from '../services/offlineDesviosReportService';
import * as Sharing from 'expo-sharing';

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
  const [responsavelCpf, setResponsavelCpf] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [userSignatureImage, setUserSignatureImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'photo' | 'gallery' | null>(null);
  const [userSignatureMode, setUserSignatureMode] = useState<'draw' | 'photo' | 'gallery' | 'saved' | null>(null);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [hasDrawnUserSignature, setHasDrawnUserSignature] = useState(false);
  const [hasSavedSignature, setHasSavedSignature] = useState(false);
  const [saveUserSignature, setSaveUserSignature] = useState(false);
  const [isResponsavelSignatureCollapsed, setIsResponsavelSignatureCollapsed] = useState(false);
  const [isUserSignatureCollapsed, setIsUserSignatureCollapsed] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Variables, 2: Responsável, 3: User
  const [selectedMaterialThemes, setSelectedMaterialThemes] = useState<Set<string>>(new Set());
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const signatureRef = React.useRef<SignatureCaptureRef>(null);
  const userSignatureRef = React.useRef<SignatureCaptureRef>(null);
  const { isOnline } = useNetwork();

  // Get all variables with their last measures
  const allVariablesWithMeasures = variables.filter(
    (v) => v.latest_data && v.latest_data.value
  );

  // Get unique material themes from variables with measures
  const availableMaterialThemes = React.useMemo(() => {
    const themes = new Set<string>();
    allVariablesWithMeasures.forEach(variable => {
      const theme = variable.indicator_variable.material_theme;
      if (theme && theme.trim() !== '') {
        themes.add(theme);
      }
    });
    return Array.from(themes).sort();
  }, [allVariablesWithMeasures]);

  // Filter variables by selected material themes
  const variablesWithMeasures = React.useMemo(() => {
    if (selectedMaterialThemes.size === 0) {
      return allVariablesWithMeasures;
    }
    return allVariablesWithMeasures.filter(variable => 
      variable.indicator_variable.material_theme && 
      selectedMaterialThemes.has(variable.indicator_variable.material_theme)
    );
  }, [allVariablesWithMeasures, selectedMaterialThemes]);

  // Helper function to get material theme display name
  const getMaterialThemeDisplayName = (theme: string): string => {
    const themeNames: { [key: string]: string } = {
      'aquisicao_animais_racao': 'Aquisição de Animais e Ração',
      'cuidado_bem_estar_animal': 'Cuidado e Bem-Estar Animal',
      'emissoes_gases_efeito_estufa': 'Emissões de Gases de Efeito Estufa',
      'gestao_agua': 'Gestão de Água',
      'bem-estar_animal': 'Bem-Estar Animal',
      'gestao_energia': 'Gestão de Energia',
      'impactos_cadeia_suprimentos_animal': 'Impactos Ambientais e Sociais da Cadeia de Suprimentos Animal',
      'metricas_atividade': 'Métricas de Atividade',
      'saude_seguranca_forca_trabalho': 'Saúde e Segurança da Força de Trabalho',
      'seguranca_alimentar': 'Segurança Alimentar',
      'uso_antibioticos': 'Uso de Antibióticos na Produção Animal',
      'uso_solo_impactos_ecologicos': 'Uso do Solo e Impactos Ecológicos',
      'adaptacao_resiliencia_climatica': 'Adaptação e resiliência climática',
      'agua_efluentes': 'Água e efluentes',
      'biodiversidade': 'Biodiversidade',
      'comunidades_locais': 'Comunidades Locais',
      'conversao_ecossistemas': 'Conversão de ecossistemas naturais',
      'emissoes': 'Emissões',
      'inocuidade_alimentos': 'Inocuidade dos alimentos',
      'praticas_empregaticias': 'Práticas empregatícias',
      'rastreabilidade_fornecedores': 'Rastreabilidade da cadeia de fornecedores',
    };
    return themeNames[theme] || theme;
  };

  // Load saved user signature and report types on mount
  useEffect(() => {
    const loadSavedSignature = async () => {
      try {
        const saved = await signatureStorageService.getUserSignature();
        if (saved) {
          setUserSignatureImage(saved);
          setUserSignatureMode('saved');
          setHasSavedSignature(true);
        }
      } catch (error) {
        console.error('Error loading saved signature:', error);
      }
    };
    
    const loadReportTypes = async () => {
      try {
        const cachedTypes = await offlineStorageService.getCachedReportTypes();
        if (cachedTypes && cachedTypes.length > 0) {
          setReportTypes(cachedTypes);
          // Set first report type as default
          if (cachedTypes.length > 0) {
            setSelectedReportType(cachedTypes[0].id);
          }
        } else {
          // If no cached types, try to fetch from API
          if (isOnline) {
            try {
              const response = await apiService.getReportTypes();
              if (response.report_types && response.report_types.length > 0) {
                setReportTypes(response.report_types);
                setSelectedReportType(response.report_types[0].id);
                // Cache them
                await offlineStorageService.cacheReportTypes(response.report_types);
              }
            } catch (error) {
              console.error('Error fetching report types:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading report types:', error);
      }
    };
    
    loadSavedSignature();
    loadReportTypes();
  }, [isOnline]);

  useEffect(() => {
    if (!visible) {
      // Reset form when modal closes
      setCurrentStep(1);
      setResponsavelNome('');
      setResponsavelCpf('');
      setSignatureImage(null);
      setUserSignatureImage(null);
      setSignatureMode(null);
      setUserSignatureMode(null);
      setHasDrawnSignature(false);
      setHasDrawnUserSignature(false);
      setSaveUserSignature(false);
      setSelectedMaterialThemes(new Set());
      // Reload saved signature
      signatureStorageService.getUserSignature().then((saved) => {
        if (saved) {
          setUserSignatureImage(saved);
          setUserSignatureMode('saved');
          setHasSavedSignature(true);
        } else {
          setHasSavedSignature(false);
        }
      });
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

  const handleUserSignatureChange = (hasSignature: boolean) => {
    setHasDrawnUserSignature(hasSignature);
  };

  const handleUserSignatureClear = () => {
    setHasDrawnUserSignature(false);
  };

  const handlePickUserSignature = async () => {
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
          setUserSignatureImage(base64Image);
          setUserSignatureMode('gallery');
        } else if (asset.uri) {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64' as any,
          });
          const base64Image = `data:image/jpeg;base64,${base64}`;
          setUserSignatureImage(base64Image);
          setUserSignatureMode('gallery');
        }
      }
    } catch (error) {
      console.error('Error picking user signature:', error);
      Alert.alert('Erro', 'Falha ao selecionar assinatura. Tente novamente.');
    }
  };

  const handleTakeUserSignaturePhoto = async () => {
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
          setUserSignatureImage(base64Image);
          setUserSignatureMode('photo');
        } else if (asset.uri) {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64' as any,
          });
          const base64Image = `data:image/jpeg;base64,${base64}`;
          setUserSignatureImage(base64Image);
          setUserSignatureMode('photo');
        }
      }
    } catch (error) {
      console.error('Error taking user signature photo:', error);
      Alert.alert('Erro', 'Falha ao tirar foto da assinatura. Tente novamente.');
    }
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

    // Get responsavel signature - check both image and drawn signature (even if collapsed)
    let finalSignature = signatureImage;
    
    // If we have a drawn signature (even if section is collapsed), try to get it from the ref
    if ((signatureMode === 'draw' || hasDrawnSignature) && signatureRef.current) {
      if (signatureRef.current.hasSignature()) {
        try {
          const drawnSignature = await signatureRef.current.getSignatureData();
          if (drawnSignature) {
            finalSignature = drawnSignature;
          }
        } catch (error) {
          console.error('Error getting signature data:', error);
          // If we have signatureImage as fallback, continue with that
          if (!finalSignature) {
            Alert.alert('Erro', 'Falha ao capturar assinatura do responsável. Tente novamente.');
            return;
          }
        }
      }
    }

    if (!finalSignature) {
      Alert.alert('Erro', 'Por favor, adicione uma assinatura do responsável');
      return;
    }

    // Get user signature - check both image and drawn signature (even if collapsed)
    let finalUserSignature = userSignatureImage;
    
    // If we have a drawn signature (even if section is collapsed), try to get it from the ref
    if ((userSignatureMode === 'draw' || hasDrawnUserSignature) && userSignatureRef.current) {
      if (userSignatureRef.current.hasSignature()) {
        try {
          const drawnUserSignature = await userSignatureRef.current.getSignatureData();
          if (drawnUserSignature) {
            finalUserSignature = drawnUserSignature;
            // Update state so we have it for saving
            setUserSignatureImage(drawnUserSignature);
          }
        } catch (error) {
          console.error('Error getting user signature data:', error);
          // If we have userSignatureImage as fallback, continue with that
        }
      }
    }
    
    // If user signature mode is 'saved' but we don't have the image, try to load it
    if (userSignatureMode === 'saved' && !finalUserSignature) {
      try {
        const saved = await signatureStorageService.getUserSignature();
        if (saved) {
          finalUserSignature = saved;
        }
      } catch (error) {
        console.error('Error loading saved user signature:', error);
      }
    }

    // Validate user signature is required
    if (!finalUserSignature && !hasDrawnUserSignature) {
      Alert.alert('Erro', 'Por favor, adicione uma assinatura do responsável da empresa');
      return;
    }

    // Always save user signature if it exists (unless it's already saved and unchanged)
    // This ensures the latest used signature is always saved for future use
    if (finalUserSignature) {
      try {
        await signatureStorageService.saveUserSignature(finalUserSignature);
        console.log('User signature saved automatically on submit');
        // Update mode to saved so it's marked as saved
        setUserSignatureMode('saved');
        setHasSavedSignature(true);
      } catch (error) {
        console.error('Error saving user signature:', error);
        // Don't block submission if saving fails
      }
    }

    // Check if this is a desvios report - can be generated offline
    const isDesviosReport = selectedReportType === 'desvios';

    // For non-desvios reports, require online connection
    if (!isDesviosReport && !isOnline) {
      Alert.alert(
        'Sem Conexão',
        'É necessário estar online para gerar e assinar o relatório.'
      );
      return;
    }

    try {
      setIsLoading(true);

      // Ensure user signature is provided (required)
      if (!finalUserSignature) {
        Alert.alert('Erro', 'Por favor, adicione uma assinatura do responsável da empresa');
        setIsLoading(false);
        return;
      }

      // Validate CPF if provided
      if (responsavelCpf.trim()) {
        const cpfValidationError = getCpfValidationError(responsavelCpf);
        if (cpfValidationError) {
          Alert.alert('CPF Inválido', cpfValidationError);
          setIsLoading(false);
          return;
        }
      }

      // Generate desvios report offline
      if (isDesviosReport) {
        try {
          console.log('Starting offline desvios report generation...');
          
          // Check signature sizes and warn if too large
          const responsavelSigSize = finalSignature.length;
          const usuarioSigSize = finalUserSignature.length;
          const totalSigSize = responsavelSigSize + usuarioSigSize;
          
          if (totalSigSize > 1000 * 1024) { // More than 1MB total
            console.warn(`Large signature images detected (${Math.round(totalSigSize / 1024)}KB). PDF generation may be slow.`);
          }

          const { uri, filename } = await generateDesviosReportFromOfflineData(
            stakeholder.id,
            responsavelNome.trim(),
            responsavelCpf.trim() ? cleanCpf(responsavelCpf) : undefined,
            undefined, // usuarioNome - could be added if available
            finalSignature,
            finalUserSignature
          );

          console.log('PDF generated successfully, attempting to share...');

          // Share the PDF
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Compartilhar Relatório de Desvios',
            });
          }

          Alert.alert(
            'Sucesso',
            'Relatório de desvios gerado com sucesso! O PDF foi salvo e está disponível para compartilhamento.',
            [
              {
                text: 'OK',
                onPress: () => {
                  onClose();
                },
              },
            ]
          );
        } catch (error) {
          console.error('Error generating offline desvios report:', error);
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          
          // Provide more helpful error messages
          let userMessage = `Falha ao gerar relatório de desvios: ${errorMessage}`;
          
          if (errorMessage.includes('timeout')) {
            userMessage = 'A geração do PDF está demorando muito. Isso pode acontecer se as imagens de assinatura forem muito grandes. Tente novamente ou use assinaturas menores.';
          } else if (errorMessage.includes('signature') || errorMessage.includes('image')) {
            userMessage = 'Erro ao processar as assinaturas. Verifique se as imagens não são muito grandes e tente novamente.';
          }
          
          Alert.alert('Erro', userMessage);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // For other report types, use server-side generation
      const signData: SignReportData = {
        company: stakeholder.company.id,
        stakeholder: stakeholder.id,
        responsavel_nome: responsavelNome.trim(),
        responsavel_cpf: responsavelCpf.trim() ? cleanCpf(responsavelCpf) : undefined,
        assinatura: finalSignature,
        assinatura_usuario: finalUserSignature,
        report_type: selectedReportType || undefined,
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

          {/* Step Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, currentStep === 1 && styles.tabActive]}
              onPress={() => setCurrentStep(1)}
            >
              <Text style={[styles.tabText, currentStep === 1 && styles.tabTextActive]}>
                Medidas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, currentStep === 2 && styles.tabActive]}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={[styles.tabText, currentStep === 2 && styles.tabTextActive]}>
                Propriedade
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, currentStep === 3 && styles.tabActive]}
              onPress={() => setCurrentStep(3)}
            >
              <Text style={[styles.tabText, currentStep === 3 && styles.tabTextActive]}>
                {stakeholder?.company?.name || 'Empresa'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={currentStep !== 2 || signatureMode !== 'draw'}
          >
            {/* Step 1: Last Measures */}
            {currentStep === 1 && (
              <View style={styles.stepContent}>
                {allVariablesWithMeasures.length > 0 ? (
                  <>
                    {/* Material Theme Filter */}
                    {availableMaterialThemes.length > 0 && (
                      <View style={styles.filterSection}>
                        <Text style={styles.filterLabel}>Filtrar por Tema Material:</Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={styles.filterScrollView}
                        >
                          {availableMaterialThemes.map((theme) => {
                            const isSelected = selectedMaterialThemes.has(theme);
                            return (
                              <TouchableOpacity
                                key={theme}
                                style={[
                                  styles.filterChip,
                                  isSelected && styles.filterChipSelected
                                ]}
                                onPress={() => {
                                  const newSet = new Set(selectedMaterialThemes);
                                  if (isSelected) {
                                    newSet.delete(theme);
                                  } else {
                                    newSet.add(theme);
                                  }
                                  setSelectedMaterialThemes(newSet);
                                }}
                              >
                                <Text style={[
                                  styles.filterChipText,
                                  isSelected && styles.filterChipTextSelected
                                ]}>
                                  {getMaterialThemeDisplayName(theme)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                        {selectedMaterialThemes.size > 0 && (
                          <TouchableOpacity
                            style={styles.clearFilterButton}
                            onPress={() => setSelectedMaterialThemes(new Set())}
                          >
                            <Text style={styles.clearFilterText}>Limpar Filtros</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    
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
                    {variablesWithMeasures.length === 0 && selectedMaterialThemes.size > 0 && (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                          Nenhuma medida encontrada para os temas selecionados
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>Nenhuma medida coletada ainda</Text>
                  </View>
                )}
              </View>
            )}

            {/* Step 2: Responsável Signature */}
            {currentStep === 2 && (
              <View style={styles.stepContent}>
                {/* Responsável Nome */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    Nome do Responsável da Propriedade <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={responsavelNome}
                    onChangeText={setResponsavelNome}
                    placeholder="Digite o nome do responsável da propriedade"
                    placeholderTextColor="#999"
                    editable={!isLoading}
                  />
                </View>

                {/* Responsável CPF */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    CPF do Responsável da Propriedade
                  </Text>
                  <TextInput
                    style={[styles.input, cpfError ? styles.inputError : null]}
                    value={responsavelCpf}
                    onChangeText={(text) => {
                      // Format CPF as user types
                      const formatted = formatCpf(text);
                      setResponsavelCpf(formatted);
                      // Validate and set error
                      const error = getCpfValidationError(formatted);
                      setCpfError(error);
                    }}
                    placeholder="000.000.000-00"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    editable={!isLoading}
                    maxLength={14} // 000.000.000-00 = 14 characters
                  />
                  {cpfError ? (
                    <Text style={styles.errorText}>{cpfError}</Text>
                  ) : null}
                </View>

                {/* Responsável Signature Section */}
                <View style={styles.signatureSection}>
                  <Text style={styles.label}>
                    Assinatura do Responsável da Propriedade <Text style={styles.required}>*</Text>
                  </Text>
                  {signatureImage ? (
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
                          setHasDrawnSignature(false);
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                        <Text style={styles.removeSignatureText}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  ) : signatureMode === 'draw' && !signatureImage ? (
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
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={handleTakeSignaturePhoto}
                        disabled={isLoading}
                      >
                        <Ionicons name="camera" size={24} color="#2d6122" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={handlePickSignature}
                        disabled={isLoading}
                      >
                        <Ionicons name="image" size={24} color="#2d6122" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Step 3: User Signature */}
            {currentStep === 3 && (
              <View style={styles.stepContent}>
                <View style={styles.signatureSection}>
                  <Text style={styles.label}>
                    Assinatura do Responsável da {stakeholder?.company?.name || 'Empresa'} <Text style={styles.required}>*</Text>
                  </Text>
                  {userSignatureImage ? (
                    <View style={styles.signaturePreview}>
                      <Image
                        source={{ uri: userSignatureImage }}
                        style={styles.signatureImage}
                        resizeMode="contain"
                      />
                      <View style={styles.signatureActions}>
                        <TouchableOpacity
                          style={styles.removeSignatureButton}
                          onPress={() => {
                            setUserSignatureImage(null);
                            setUserSignatureMode(null);
                            setHasDrawnUserSignature(false);
                          }}
                        >
                          <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                          <Text style={styles.removeSignatureText}>Remover</Text>
                        </TouchableOpacity>
                        {userSignatureMode !== 'saved' && (
                          <TouchableOpacity
                            style={styles.saveSignatureButton}
                            onPress={async () => {
                              if (userSignatureImage) {
                                try {
                                  await signatureStorageService.saveUserSignature(userSignatureImage);
                                  setUserSignatureMode('saved');
                                  setHasSavedSignature(true);
                                  Alert.alert('Sucesso', 'Assinatura salva com sucesso!');
                                } catch (error) {
                                  Alert.alert('Erro', 'Falha ao salvar assinatura');
                                }
                              }
                            }}
                          >
                            <Ionicons name="save-outline" size={20} color="#2d6122" />
                            <Text style={styles.saveSignatureText}>Salvar</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : userSignatureMode === 'draw' && !userSignatureImage ? (
                    <View style={styles.drawSignatureContainer}>
                      <SignatureCapture
                        ref={userSignatureRef}
                        onSignatureChange={handleUserSignatureChange}
                        onClear={handleUserSignatureClear}
                        width={Dimensions.get('window').width - 80}
                        height={200}
                      />
                      <TouchableOpacity
                        style={styles.changeSignatureButton}
                        onPress={() => {
                          setUserSignatureMode(null);
                          setUserSignatureImage(null);
                          setHasDrawnUserSignature(false);
                        }}
                      >
                        <Text style={styles.changeSignatureText}>Escolher outro método</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.signatureButtons}>
                      {hasSavedSignature && (
                        <TouchableOpacity
                          style={styles.signatureButton}
                          onPress={async () => {
                            const saved = await signatureStorageService.getUserSignature();
                            if (saved) {
                              setUserSignatureImage(saved);
                              setUserSignatureMode('saved');
                            }
                          }}
                          disabled={isLoading}
                        >
                          <Ionicons name="checkmark-circle" size={24} color="#2d6122" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={() => setUserSignatureMode('draw')}
                        disabled={isLoading}
                      >
                        <Ionicons name="create-outline" size={24} color="#2d6122" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={handleTakeUserSignaturePhoto}
                        disabled={isLoading}
                      >
                        <Ionicons name="camera" size={24} color="#2d6122" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={handlePickUserSignature}
                        disabled={isLoading}
                      >
                        <Ionicons name="image" size={24} color="#2d6122" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Navigation Buttons */}
            <View style={styles.navigationContainer}>
              {currentStep > 1 && (
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => setCurrentStep(currentStep - 1)}
                  disabled={isLoading}
                >
                  <Ionicons name="chevron-back" size={20} color="#2d6122" />
                  <Text style={styles.navButtonText}>Anterior</Text>
                </TouchableOpacity>
              )}
              {currentStep < 3 && (
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonPrimary]}
                  onPress={async () => {
                    // Validate before moving to next step
                    if (currentStep === 2) {
                      if (!responsavelNome.trim()) {
                        Alert.alert('Erro', 'Por favor, insira o nome do responsável da propriedade');
                        return;
                      }
                      
                      // Capture drawn signature if it exists
                      let finalSignature = signatureImage;
                      if ((signatureMode === 'draw' || hasDrawnSignature) && signatureRef.current) {
                        if (signatureRef.current.hasSignature()) {
                          try {
                            const drawnSignature = await signatureRef.current.getSignatureData();
                            if (drawnSignature) {
                              finalSignature = drawnSignature;
                              setSignatureImage(drawnSignature);
                              setSignatureMode('gallery'); // Change mode so it shows as preview if user goes back
                            }
                          } catch (error) {
                            console.error('Error capturing signature:', error);
                            // Continue with validation even if capture fails
                          }
                        }
                      }
                      
                      if (!finalSignature && !hasDrawnSignature) {
                        Alert.alert('Erro', 'Por favor, adicione uma assinatura do responsável da propriedade');
                        return;
                      }
                    }
                    setCurrentStep(currentStep + 1);
                  }}
                  disabled={isLoading}
                >
                  <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>Próximo</Text>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            {!isOnline && currentStep === 3 && (
              <Text style={styles.offlineWarning}>
                É necessário estar online para gerar o relatório.
              </Text>
            )}

            {/* Report Type Selection - Only on last step */}
            {currentStep === 3 && reportTypes.length > 0 && (
              <View style={styles.reportTypeSection}>
                <Text style={styles.label}>
                  Tipo de Relatório <Text style={styles.required}>*</Text>
                </Text>
                {reportTypes.map((reportType) => (
                  <TouchableOpacity
                    key={reportType.id}
                    style={[
                      styles.reportTypeOption,
                      selectedReportType === reportType.id && styles.reportTypeOptionSelected
                    ]}
                    onPress={() => setSelectedReportType(reportType.id)}
                  >
                    <View style={styles.reportTypeRadio}>
                      {selectedReportType === reportType.id && (
                        <View style={styles.reportTypeRadioSelected} />
                      )}
                    </View>
                    <View style={styles.reportTypeInfo}>
                      <Text style={[
                        styles.reportTypeName,
                        selectedReportType === reportType.id && styles.reportTypeNameSelected
                      ]}>
                        {reportType.name}
                      </Text>
                      <Text style={styles.reportTypeDescription}>
                        {reportType.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Submit Button - Only on last step, below everything */}
            {currentStep === 3 && (
              <View style={styles.submitButtonContainer}>
                <TouchableOpacity
                  style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading || (!isOnline && selectedReportType !== 'desvios') || !selectedReportType}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      Assinar e Gerar Relatório
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
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
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
    minHeight: 50, // Match the height of Variáveis header
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
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
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
    maxHeight: 500,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    padding: 8,
  },
  filterSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d6122',
    marginBottom: 12,
  },
  filterScrollView: {
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF1F3',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  filterChipSelected: {
    backgroundColor: '#e8f5e8',
    borderColor: '#2d6122',
    borderWidth: 2,
  },
  filterChipText: {
    fontSize: 13,
    color: '#7f8c8d',
    fontWeight: '500',

  },
  filterChipTextSelected: {
    color: '#2d6122',
    fontWeight: '600',
  },
  clearFilterButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  clearFilterText: {
    fontSize: 12,
    color: '#2d6122',
    fontWeight: '500',
    textDecorationLine: 'underline',
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
  optional: {
    color: '#7f8c8d',
    fontSize: 12,
    fontWeight: 'normal',
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
  inputError: {
    borderColor: '#e74c3c',
    backgroundColor: '#fef5f5',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  signatureSection: {
    marginBottom: 20,
  },
  signatureSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  collapseButton: {
    padding: 4,
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
  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  saveSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  saveSignatureText: {
    fontSize: 14,
    color: '#2d6122',
    fontWeight: '500',
  },
  submitButtonContainer: {
    width: '98%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  submitButton: {
    backgroundColor: '#2d6122',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
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
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2d6122',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7f8c8d',
  },
  tabTextActive: {
    color: '#2d6122',
    fontWeight: '600',
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8f5e8',
    marginTop: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2d6122',
    backgroundColor: 'transparent',
    gap: 8,
  },
  navButtonPrimary: {
    backgroundColor: '#2d6122',
    borderColor: '#2d6122',
    marginLeft: 'auto',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d6122',
  },
  navButtonTextPrimary: {
    color: '#fff',
  },
  reportTypeSection: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  reportTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  reportTypeOptionSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0f8f0',
  },
  reportTypeRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2E7D32',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTypeRadioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2E7D32',
  },
  reportTypeInfo: {
    flex: 1,
  },
  reportTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reportTypeNameSelected: {
    color: '#2E7D32',
  },
  reportTypeDescription: {
    fontSize: 13,
    color: '#666',
  },
});


