import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { apiService, Stakeholder, StakeholderVariable } from '../services/api';
import { offlineStorageService, PendingUpdate } from '../services/offlineStorage';
import { LoginScreen } from './LoginScreen';
import { ReportSignatureModal } from './ReportSignatureModal';
import { VariableForm } from './VariableForm';

export const MeasuresScreen: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { isOnline } = useNetwork();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [filteredStakeholders, setFilteredStakeholders] = useState<Stakeholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [variables, setVariables] = useState<StakeholderVariable[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<StakeholderVariable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'stakeholder' | 'variable'>('stakeholder');
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAllVariables, setShowAllVariables] = useState(false);
  const [variableSearchQuery, setVariableSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedMaterialThemes, setSelectedMaterialThemes] = useState<Set<string>>(new Set());
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStakeholders();
    }
  }, [isAuthenticated]);

  const loadStakeholders = async () => {
    try {
      setIsLoading(true);
      const { cached, fresh } = await apiService.getStakeholders();
      
      // Show cached data immediately
      setStakeholders(cached);
      setFilteredStakeholders(cached);
      
      // Update with fresh data when available (background)
      fresh.then(freshData => {
        if (freshData.length > 0 || cached.length === 0) {
          setStakeholders(freshData);
          setFilteredStakeholders(freshData);
        }
      }).catch(err => {
        console.error('Error updating with fresh stakeholders:', err);
      });
      
      if (cached.length === 0 && isOnline) {
        // Only show alert if we're online and got no cached data
        Alert.alert('Erro', 'Falha ao carregar stakeholders');
      }
    } catch (error) {
      console.error('Error loading stakeholders:', error);
      // Don't show alert for offline errors, data might be cached
      if (isOnline) {
        Alert.alert('Erro', 'Falha ao carregar stakeholders');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Filter stakeholders based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStakeholders(stakeholders);
    } else {
      const filtered = stakeholders.filter(stakeholder =>
        stakeholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stakeholder.company.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStakeholders(filtered);
    }
  }, [searchQuery, stakeholders]);

  const loadVariables = async (stakeholderId: number) => {
    try {
      setIsLoading(true);
      const result = await apiService.getStakeholderVariables(stakeholderId);
      const cached: StakeholderVariable[] = result.cached;
      const fresh: Promise<StakeholderVariable[]> = result.fresh;
      
      // Show cached data immediately
      setVariables(cached);
      
      // Update with fresh data when available (background)
      fresh.then((freshData: StakeholderVariable[]) => {
        if (freshData.length > 0 || cached.length === 0) {
          setVariables(freshData);
        }
      }).catch(err => {
        console.error('Error updating with fresh variables:', err);
      });
      
      // Load pending updates to check for offline-sent variables
      try {
        const updates = await offlineStorageService.getPendingUpdates();
        setPendingUpdates(updates);
      } catch (error) {
        console.error('Error loading pending updates:', error);
        setPendingUpdates([]);
      }
      
      if (cached.length === 0 && isOnline) {
        // Only show alert if we're online and got no cached data
        Alert.alert('Erro', 'Falha ao carregar variáveis');
      }
    } catch (error) {
      console.error('Error loading variables:', error);
      // Only show alert if online
      if (isOnline) {
        Alert.alert('Erro', 'Falha ao carregar variáveis');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStakeholderSelect = async (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    await loadVariables(stakeholder.id);
    setCurrentStep('variable');
  };

  const handleVariableSelect = (variable: StakeholderVariable) => {
    setSelectedVariable(variable);
    // Don't change step, stay in variable list to show form as card
  };

  const handleBack = () => {
    if (currentStep === 'variable') {
      setCurrentStep('stakeholder');
      setSelectedStakeholder(null);
      setVariables([]);
      setSelectedVariable(null);
      setShowAllVariables(false);
      setVariableSearchQuery('');
    }
  };

  // Helper function to check if a date string is today
  const isDateToday = (dateStr: string): boolean => {
    if (!dateStr) return false;
    
    try {
      const dateOnly = dateStr.trim().split(' ')[0].split('T')[0];
      
      let year: number, month: number, day: number;
      
      // Check if it's DD/MM/YYYY format
      if (dateOnly.includes('/')) {
        const parts = dateOnly.split('/');
        if (parts.length !== 3) return false;
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } 
      // Check if it's YYYY-MM-DD format
      else if (dateOnly.includes('-')) {
        const parts = dateOnly.split('-');
        if (parts.length !== 3) return false;
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        return false;
      }
      
      // Validate parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return false;
      }
      
      // Get today's date in local timezone
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth() + 1; // getMonth() returns 0-11
      const todayDay = today.getDate();
      
      // Compare year, month, and day in local timezone
      return year === todayYear && month === todayMonth && day === todayDay;
    } catch (error) {
      console.error('Error parsing date:', error, dateStr);
      return false;
    }
  };

  // Check if a variable has a measurement today (using local timezone)
  // This checks both latest_data and pending offline updates
  const hasMeasurementToday = (variable: StakeholderVariable): boolean => {
    // First check latest_data from server
    if (variable.latest_data?.measurement_date) {
      if (isDateToday(variable.latest_data.measurement_date)) {
        return true;
      }
    }

    // Then check pending offline updates for this variable
    const pendingForVariable = pendingUpdates.filter(
      update => update.stakeholder_variable_id === variable.id
    );
    
    for (const update of pendingForVariable) {
      if (isDateToday(update.measurement_date)) {
        return true;
      }
    }

    return false;
  };

  // Get unique material themes from variables
  const availableMaterialThemes = useMemo(() => {
    const themes = new Set<string>();
    variables.forEach(variable => {
      const theme = variable.indicator_variable.material_theme;
      if (theme && theme.trim() !== '') {
        themes.add(theme);
      }
    });
    return Array.from(themes).sort();
  }, [variables]);

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
      'renda_salario_digno': 'Renda digna e salário digno',
      'residuos': 'Resíduos',
      'saude_solo': 'Saúde do solo',
      'saude_bem_estar_animal': 'Saúde e bem-estar animal',
      'saude_seguranca_trabalho': 'Saúde e segurança do trabalho',
      'trabalho_forcado': 'Trabalho forçado ou análogo ao escravo',
      'bem_estar_animal': 'Bem-Estar Animal',
      'gestao': 'Gestão',
      'infraestrutura': 'Infraestrutura',
      'qualidade_leite': 'Qualidade do Leite',
      'fauna': 'Fauna Silvestre',
      'flora': 'Flora Nativa',
      'recursos_hidricos': 'Recursos Hídricos',
      'mudancas_climaticas': 'Mudanças Climáticas',
      'poluicao': 'Poluição',
      'conservacao': 'Conservação',
      'restauracao': 'Restauração Ecológica',
      'sustentabilidade': 'Sustentabilidade',
      'economia_circular': 'Economia Circular',
      'eficiencia_energetica': 'Eficiência Energética',
      'energias_renovaveis': 'Energias Renováveis',
      'gestao_ambiental': 'Gestão Ambiental',
      'compliance_ambiental': 'Compliance Ambiental',
      'impacto_ambiental': 'Impacto Ambiental',
      'monitoramento': 'Monitoramento Ambiental',
      'relatorios_ambientais': 'Relatórios Ambientais',
    };
    return themeNames[theme] || theme;
  };

  // Toggle material theme selection
  const toggleMaterialTheme = (theme: string) => {
    const newSelected = new Set(selectedMaterialThemes);
    if (newSelected.has(theme)) {
      newSelected.delete(theme);
    } else {
      newSelected.add(theme);
    }
    setSelectedMaterialThemes(newSelected);
  };

  // Select all material themes
  const selectAllMaterialThemes = () => {
    setSelectedMaterialThemes(new Set(availableMaterialThemes));
  };

  // Deselect all material themes
  const deselectAllMaterialThemes = () => {
    setSelectedMaterialThemes(new Set());
  };

  // Filter variables based on "todos" checkbox, search query, and material themes - using useMemo for proper re-rendering
  const filteredVariables = useMemo(() => {
    let filtered = variables;
    
    // First filter by date (if "todos" is unchecked)
    if (!showAllVariables) {
      // Only show variables that don't have a measurement today
      filtered = filtered.filter(variable => !hasMeasurementToday(variable));
    }
    
    // Then filter by material themes (if any are selected)
    if (selectedMaterialThemes.size > 0) {
      filtered = filtered.filter(variable => {
        const theme = variable.indicator_variable.material_theme || '';
        return selectedMaterialThemes.has(theme);
      });
    }
    
    // Finally filter by search query
    if (variableSearchQuery.trim() !== '') {
      const query = variableSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(variable => {
        const variableName = variable.indicator_variable.variable.toLowerCase();
        const indicatorTitle = variable.indicator_variable.indicator.title.toLowerCase();
        return variableName.includes(query) || indicatorTitle.includes(query);
      });
    }
    
    console.log('Filtering variables:', {
      showAll: showAllVariables,
      selectedThemes: selectedMaterialThemes.size,
      searchQuery: variableSearchQuery,
      total: variables.length,
      filtered: filtered.length,
      pendingUpdates: pendingUpdates.length,
      today: new Date().toLocaleDateString('pt-BR')
    });
    return filtered;
  }, [variables, showAllVariables, variableSearchQuery, selectedMaterialThemes, pendingUpdates]);

  const getCurrentVariableIndex = () => {
    if (!selectedVariable) return -1;
    return filteredVariables.findIndex(v => v.id === selectedVariable.id);
  };

  const handleNextVariable = () => {
    const currentIndex = getCurrentVariableIndex();
    if (currentIndex >= 0 && currentIndex < filteredVariables.length - 1) {
      setSelectedVariable(filteredVariables[currentIndex + 1]);
    }
  };

  const handlePreviousVariable = () => {
    const currentIndex = getCurrentVariableIndex();
    if (currentIndex > 0) {
      setSelectedVariable(filteredVariables[currentIndex - 1]);
    }
  };

  const handleFormSubmit = async () => {
    // Refresh variables to get updated data
    if (selectedStakeholder) {
      await loadVariables(selectedStakeholder.id);
      // Wait a bit for state to update and filteredVariables to recalculate
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Automatically go to next variable after successful submission
    const currentIndex = getCurrentVariableIndex();
    if (currentIndex >= 0 && currentIndex < filteredVariables.length - 1) {
      // Go to next variable
      setSelectedVariable(filteredVariables[currentIndex + 1]);
    } else {
      // No more variables, go back to variable list (deselect)
      setSelectedVariable(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (selectedStakeholder) {
      await loadVariables(selectedStakeholder.id);
    } else {
      await loadStakeholders();
      // Also reload pending updates when refreshing stakeholders list
      try {
        const updates = await offlineStorageService.getPendingUpdates();
        setPendingUpdates(updates);
      } catch (error) {
        console.error('Error loading pending updates:', error);
      }
    }
    setIsRefreshing(false);
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Verificando autenticação...</Text>
      </View>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const renderStakeholderCard = ({ item }: { item: Stakeholder }) => (
    <TouchableOpacity
      style={styles.stakeholderCardNew}
      onPress={() => handleStakeholderSelect(item)}
      activeOpacity={0.7}
    >
      {/* Leading Icon */}
      <View style={styles.iconContainer}>
        <View style={styles.iconBadge}>
          <Ionicons name="leaf" size={24} color="#FFFFFF" />
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.administrator || item.name}
        </Text>
        {item.administrator && (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.name}
          </Text>
        )}
        <View style={styles.tagContainer}>
          <Text style={styles.tagText}>Scala</Text>
        </View>
      </View>

      {/* Action */}
      <View style={styles.actionContainer}>
        <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
      </View>
    </TouchableOpacity>
  );

  const renderStakeholderList = () => (
    <View style={styles.stakeholderListContainer}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerTop}>
          <Text style={styles.mainTitleNew}>Parceiros</Text>
          <View style={styles.profileMenuContainer}>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => setShowProfileMenu(!showProfileMenu)}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={28} color="#95A5A6" />
              <Ionicons 
                name={showProfileMenu ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#95A5A6" 
                style={styles.chevronDown} 
              />
            </TouchableOpacity>
            {showProfileMenu && (
              <View style={styles.profileMenu}>
                <TouchableOpacity
                  style={styles.logoutButtonNew}
                  onPress={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.logoutButtonTextNew}>Sair</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainerNew}>
          <Ionicons name="search" size={20} color="#95A5A6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInputNew}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar parceiro ou empresa..."
            placeholderTextColor="#95A5A6"
          />
        </View>

        {/* Sub-header */}
        <Text style={styles.subHeaderNew}>
          Escolha o parceiro para adicionar medidas
        </Text>
      </View>

      {/* List Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2d6122" />
          <Text style={styles.loadingText}>Carregando parceiros...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStakeholders}
          renderItem={renderStakeholderCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContentNew}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#2d6122']}
              tintColor="#2d6122"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Nenhum parceiro encontrado para a busca'
                  : 'Nenhum parceiro encontrado'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderVariableList = () => {
    const currentIndex = getCurrentVariableIndex();
    const hasNext = currentIndex >= 0 && currentIndex < variables.length - 1;
    const hasPrevious = currentIndex > 0;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={28} color="#2d6122" />
          </TouchableOpacity>
          <Text style={styles.title}>Variáveis</Text>
        </View>
        
        <Text style={styles.subtitle}>
          {selectedStakeholder?.name} - {selectedStakeholder?.company.name}
        </Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Carregando variáveis...</Text>
          </View>
        ) : selectedVariable ? (
          // Show form card when variable is selected
          <View style={styles.formCardWrapper}>
            <View style={styles.formCardContainer}>
              <View style={styles.formCardHeader}>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={async () => {
                    // Refresh variables when closing the form
                    if (selectedStakeholder) {
                      await loadVariables(selectedStakeholder.id);
                    }
                    setSelectedVariable(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#7f8c8d" />
                </TouchableOpacity>
            
                <View style={styles.navigationButtons}>
                  <TouchableOpacity
                    style={[styles.navButton, !hasPrevious && styles.navButtonDisabled]}
                    onPress={handlePreviousVariable}
                    disabled={!hasPrevious}
                  >
                    <Ionicons 
                      name="chevron-back" 
                      size={20} 
                      color={hasPrevious ? "#2d6122" : "#ccc"} 
                    />
                  </TouchableOpacity>
                  <Text style={styles.variableCounter}>
                    {currentIndex + 1} / {filteredVariables.length}
                  </Text>
                  <TouchableOpacity
                    style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
                    onPress={handleNextVariable}
                    disabled={!hasNext}
                  >
                    <Ionicons 
                      name="chevron-forward" 
                      size={20} 
                      color={hasNext ? "#2d6122" : "#ccc"} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <VariableForm
                variable={selectedVariable}
                onSuccess={handleFormSubmit}
              />
            </View>
          </View>
        ) : (
          // Show variable list when no variable is selected
          <ScrollView
            style={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
          >


            {/* Generate Report Button */}
            {variables.length > 0 && (
              <TouchableOpacity
                style={styles.generateReportButton}
                onPress={() => setShowReportModal(true)}
              >
                <Ionicons name="document-text" size={24} color="#ffffff" />
                <Text style={styles.generateReportButtonText}>
                  Gerar Relatório e Assinar Visita
                </Text>
              </TouchableOpacity>
            )}
            {/* Search and Filter Row */}
            <View style={styles.searchFilterRow}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={16} color="#95A5A6" style={styles.searchIconSmall} />
                <TextInput
                  style={styles.searchInputSmall}
                  value={variableSearchQuery}
                  onChangeText={setVariableSearchQuery}
                  placeholder="Buscar variável..."
                  placeholderTextColor="#95A5A6"
                />
                {variableSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setVariableSearchQuery('')}
                    style={styles.clearSearchButton}
                  >
                    <Ionicons name="close-circle" size={18} color="#95A5A6" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="filter" 
                  size={20} 
                  color={(showAllVariables || selectedMaterialThemes.size > 0) ? "#2d6122" : "#95A5A6"} 
                />
              </TouchableOpacity>
            </View>
            {filteredVariables.map((variable) => (
              <TouchableOpacity
                key={variable.id}
                style={styles.variableCard}
                onPress={() => handleVariableSelect(variable)}
              >
                <View style={styles.variableHeader}>
                  <Text style={styles.variableTitle}>{variable.indicator_variable.variable}</Text>
                </View>
                
                <Text style={styles.indicatorTitle}>{variable.indicator_variable.indicator.title}</Text>
                
                <View style={styles.variableInfo}>
                  <Text style={styles.unitText}>
                    {/* if binario dont appear unit */}
                    {variable.indicator_variable.response_type !== 'binário' ? `Unidade: ${variable.indicator_variable.unit || 'N/A'}` : ''}
                  </Text>
                  <Text style={styles.typeText}>
                    {/* if binario appear multiple choice */}
                    {variable.indicator_variable.response_type === 'binário' ? `Múltipla Escolha` : `Tipo: ${variable.indicator_variable.response_type}`}
                  </Text>
                </View>
                
                {variable.latest_data && (
                  <View style={styles.latestData}>
                    <Text style={styles.latestDataLabel}>Última medida:</Text>
                    <Text style={styles.latestDataValue}>
                      {variable.latest_data.value} ({variable.latest_data.measurement_date})
                    </Text>
                  </View>
                )}
                
               
              </TouchableOpacity>
            ))}
            
            {filteredVariables.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {showAllVariables 
                    ? 'Nenhuma variável encontrada' 
                    : 'Todas as variáveis já têm medida hoje'}
                </Text>
              </View>
            )}
            
            {/* Footer */}
            {filteredVariables.length > 0 && (
              <View style={styles.variableListFooter}>
                <Text style={styles.footerText}>
                  {filteredVariables.length} {filteredVariables.length === 1 ? 'variável encontrada' : 'variáveis encontradas'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screenContainer}>
      {currentStep === 'stakeholder' && renderStakeholderList()}
      {currentStep === 'variable' && renderVariableList()}
      
      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Todos Checkbox */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Mostrar todas as variáveis</Text>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setShowAllVariables(!showAllVariables)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, showAllVariables && styles.checkboxChecked]}>
                    {showAllVariables && (
                      <Ionicons name="checkmark" size={18} color="#ffffff" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Mostrar todas as variáveis (incluindo as que já têm medida hoje)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Material Themes Section */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionTitle}>Temas Materiais</Text>
                  <View style={styles.filterActions}>
                    <TouchableOpacity
                      onPress={selectAllMaterialThemes}
                      style={styles.filterActionButton}
                    >
                      <Text style={styles.filterActionText}>Selecionar Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={deselectAllMaterialThemes}
                      style={styles.filterActionButton}
                    >
                      <Text style={styles.filterActionText}>Limpar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {availableMaterialThemes.length > 0 ? (
                  availableMaterialThemes.map((theme) => {
                    const isSelected = selectedMaterialThemes.has(theme);
                    return (
                      <TouchableOpacity
                        key={theme}
                        style={styles.themeItem}
                        onPress={() => toggleMaterialTheme(theme)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                          {isSelected && (
                            <Ionicons name="checkmark" size={18} color="#ffffff" />
                          )}
                        </View>
                        <Text style={[styles.themeItemText, isSelected && styles.themeItemTextSelected]}>
                          {getMaterialThemeDisplayName(theme)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.noThemesText}>Nenhum tema material disponível</Text>
                )}
              </View>

              {/* Apply Button - Inside ScrollView but positioned higher */}
              <View style={styles.modalFooterInside}>
                <TouchableOpacity
                  style={styles.modalApplyButton}
                  onPress={() => setShowFilterModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalApplyButtonText}>Aplicar Filtros</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Report Signature Modal */}
      <ReportSignatureModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        stakeholder={selectedStakeholder}
        variables={variables}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  stakeholderListContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
    paddingTop: 10,
    minHeight: 50, // Consistent height across all headers
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingTop: 15,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#2d6122',
    fontWeight: '500',
    shadowColor: '#2d6122',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 30,

  },
  backButtonText: {
    color: '#2d6122', // Aurica main color
    fontSize: 30,
    fontWeight: '500',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d6122', // Aurica main color
  },
  mainTitleNew: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d6122', // Aurica main color - same as Variáveis header
  },
  headerSection: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingTop: 30, // Match container padding (20) + header paddingTop (10) = 30
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 50, // Match the height of Variáveis header (paddingTop comes from headerSection)
  },
  profileMenuContainer: {
    position: 'relative',
    zIndex: 10,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  chevronDown: {
    marginLeft: 4,
  },
  profileMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  logoutButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC3545',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    gap: 8,
  },
  logoutButtonTextNew: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainerNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF1F3',
    borderRadius: 30,
    paddingHorizontal: 16,
    marginBottom: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInputNew: {
    flex: 1,
    fontSize: 16,
    color: '#2C3E50',
    padding: 0,
  },
  subHeaderNew: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  listContentNew: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stakeholderCardNew: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 16,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7E9F7A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#7F8C8D',
    marginBottom: 8,
  },
  tagContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2E7D32',
  },
  actionContainer: {
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d6122', // Aurica main color

  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  listContainer: {
    flex: 1,
  },
  formCardWrapper: {
    flex: 1,
  },
  stakeholderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#2d6122',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  stakeholderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d6122', // Aurica main color
    marginBottom: 5,
  },
  companyName: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  variableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#2d6122',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  variableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  variableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d6122', // Aurica main color
    flex: 1,
  },
  sdgNumber: {
    fontSize: 12,
    color: '#2d6122', // Aurica main color
    backgroundColor: '#e8f5e8', // Light green background
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  indicatorTitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 15,
    lineHeight: 20,
  },
  variableInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  unitText: {
    fontSize: 12,
    color: '#95a5a6',
  },
  typeText: {
    fontSize: 12,
    color: '#95a5a6',
  },
  latestData: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  latestDataLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  latestDataValue: {
    fontSize: 14,
    color: '#2d6122', // Aurica main color
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  variableListFooter: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    marginTop: 10,
    backgroundColor: '#FAFAFA',
  },
  footerText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#dc3545',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  formCardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#2d6122',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
    backgroundColor: '#fafbfa',
  },
  closeButton: {
    padding: 4,
  },
  formCardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#2d6122',
    marginLeft: 12,
  },
  navigationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f8f0',
    marginHorizontal: 4,
  },
  navButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  variableCounter: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  generateReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d6122',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#2d6122',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    gap: 12,
  },
  generateReportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 8,
    marginTop: 8,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF1F3',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 36,
  },
  searchIconSmall: {
    marginRight: 8,
  },
  searchInputSmall: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    padding: 0,
  },
  clearSearchButton: {
    marginLeft: 4,
    padding: 2,
  },
  filterButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    maxHeight: '90%',
    minHeight: 500,
    width: '100%',
    paddingBottom: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#ffffff',
  },
  modalFooterInside: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    marginTop: 0,
  },
  modalApplyButton: {
    backgroundColor: '#2d6122',
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: 28,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  filterActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF1F3',
  },
  filterActionText: {
    fontSize: 13,
    color: '#2d6122',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#95A5A6',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#2d6122',
    borderColor: '#2d6122',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#2C3E50',
    flex: 1,
    lineHeight: 22,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  themeItemText: {
    fontSize: 16,
    color: '#2C3E50',
    flex: 1,
    lineHeight: 22,
  },
  themeItemTextSelected: {
    color: '#2d6122',
    fontWeight: '500',
  },
  noThemesText: {
    fontSize: 14,
    color: '#95A5A6',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});
