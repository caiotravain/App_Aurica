import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiService, Stakeholder, StakeholderVariable } from '../services/api';
import { LoginScreen } from './LoginScreen';
import { VariableForm } from './VariableForm';

export const MeasuresScreen: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [filteredStakeholders, setFilteredStakeholders] = useState<Stakeholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [variables, setVariables] = useState<StakeholderVariable[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<StakeholderVariable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'stakeholder' | 'variable'>('stakeholder');

  useEffect(() => {
    if (isAuthenticated) {
      loadStakeholders();
    }
  }, [isAuthenticated]);

  const loadStakeholders = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getStakeholders();
      setStakeholders(data);
      setFilteredStakeholders(data);
    } catch (error) {
      console.error('Error loading stakeholders:', error);
      Alert.alert('Erro', 'Falha ao carregar stakeholders');
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
      const data = await apiService.getStakeholderVariables(stakeholderId);
      setVariables(data);
    } catch (error) {
      console.error('Error loading variables:', error);
      Alert.alert('Erro', 'Falha ao carregar variáveis');
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
    }
  };

  const getCurrentVariableIndex = () => {
    if (!selectedVariable) return -1;
    return variables.findIndex(v => v.id === selectedVariable.id);
  };

  const handleNextVariable = () => {
    const currentIndex = getCurrentVariableIndex();
    if (currentIndex >= 0 && currentIndex < variables.length - 1) {
      setSelectedVariable(variables[currentIndex + 1]);
    }
  };

  const handlePreviousVariable = () => {
    const currentIndex = getCurrentVariableIndex();
    if (currentIndex > 0) {
      setSelectedVariable(variables[currentIndex - 1]);
    }
  };

  const handleFormSubmit = () => {
    // Automatically go to next variable after successful submission
    const currentIndex = getCurrentVariableIndex();
    if (currentIndex >= 0 && currentIndex < variables.length - 1) {
      // Go to next variable
      setSelectedVariable(variables[currentIndex + 1]);
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

  const renderStakeholderList = () => (
    <View style={styles.container}>
      <View style={styles.mainHeader}>
        <Text style={styles.mainTitle}>Parceiros</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
      </View>
      
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar stakeholder ou empresa..."
          placeholderTextColor="#999"
        />
      </View>
      
      <Text style={styles.subtitle}>Escolha o stakeholder para adicionar medidas</Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Carregando stakeholders...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {filteredStakeholders.map((stakeholder) => (
            <TouchableOpacity
              key={stakeholder.id}
              style={styles.stakeholderCard}
              onPress={() => handleStakeholderSelect(stakeholder)}
            >
              <Text style={styles.stakeholderName}>{stakeholder.name}</Text>
              <Text style={styles.companyName}>{stakeholder.company.name}</Text>
            </TouchableOpacity>
          ))}
          
          {filteredStakeholders.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Nenhum stakeholder encontrado para a busca' : 'Nenhum stakeholder encontrado'}
              </Text>
            </View>
          )}
        </ScrollView>
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
                  onPress={() => setSelectedVariable(null)}
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
                    {currentIndex + 1} / {variables.length}
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
            {variables.map((variable) => (
              <TouchableOpacity
                key={variable.id}
                style={styles.variableCard}
                onPress={() => handleVariableSelect(variable)}
              >
                <View style={styles.variableHeader}>
                  <Text style={styles.variableTitle}>{variable.indicator_variable.variable}</Text>
                  <Text style={styles.sdgNumber}>SDG {variable.indicator_variable.indicator.sdg.sdg_number}</Text>
                </View>
                
                <Text style={styles.indicatorTitle}>{variable.indicator_variable.indicator.title}</Text>
                
                <View style={styles.variableInfo}>
                  <Text style={styles.unitText}>
                    Unidade: {variable.indicator_variable.unit || 'N/A'}
                  </Text>
                  <Text style={styles.typeText}>
                    Tipo: {variable.indicator_variable.response_type}
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
                
                <View style={styles.statusContainer}>
                  <Text style={[
                    styles.statusText,
                    { color: variable.status === 'active' ? '#27ae60' : '#e74c3c' }
                  ]}>
                    {variable.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            
            {variables.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhuma variável encontrada</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#f0f8f0', // Light green background
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
    paddingTop: 10,
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingTop: 10,
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
});
