import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { apiService, Stakeholder, StakeholderVariable } from '../services/api';
import { VariableForm } from './VariableForm';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from './LoginScreen';

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
  const [currentStep, setCurrentStep] = useState<'stakeholder' | 'variable' | 'form'>('stakeholder');

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
    setCurrentStep('form');
  };

  const handleBack = () => {
    if (currentStep === 'variable') {
      setCurrentStep('stakeholder');
      setSelectedStakeholder(null);
      setVariables([]);
    } else if (currentStep === 'form') {
      setCurrentStep('variable');
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

  const handleFormSubmit = () => {
    // Reset to stakeholder selection after successful submission
    setCurrentStep('stakeholder');
    setSelectedStakeholder(null);
    setSelectedVariable(null);
    setVariables([]);
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
      <View style={styles.header}>
        <Text style={styles.title}>Selecionar Stakeholder</Text>
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

  const renderVariableList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
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
      ) : (
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

  const renderForm = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Adicionar Medida</Text>
      </View>
      
      <Text style={styles.subtitle}>
        {selectedStakeholder?.name} - {selectedVariable?.indicator_variable.variable}
      </Text>
      
      {selectedVariable && (
        <VariableForm
          variable={selectedVariable}
          onSuccess={handleFormSubmit}
        />
      )}
    </View>
  );

  return (
    <View style={styles.screenContainer}>
      {currentStep === 'stakeholder' && renderStakeholderList()}
      {currentStep === 'variable' && renderVariableList()}
      {currentStep === 'form' && renderForm()}
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
    justifyContent: 'space-between',
    marginBottom: 10,
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
    marginRight: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  backButtonText: {
    color: '#2d6122', // Aurica main color
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d6122', // Aurica main color
    marginBottom: 8,
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
});
