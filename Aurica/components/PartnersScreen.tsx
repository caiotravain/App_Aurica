import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { apiService, Stakeholder } from '../services/api';

// Extended interface for UI purposes
interface ExtendedStakeholder extends Stakeholder {
  tag?: string;
  type?: string;
}

export const PartnersScreen: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isOnline } = useNetwork();
  const [stakeholders, setStakeholders] = useState<ExtendedStakeholder[]>([]);
  const [filteredStakeholders, setFilteredStakeholders] = useState<ExtendedStakeholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadStakeholders();
    }
  }, [isAuthenticated]);

  const loadStakeholders = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getStakeholders();
      
      // Extend stakeholders with tag and type for UI
      const extendedData: ExtendedStakeholder[] = data.map((stakeholder) => ({
        ...stakeholder,
        tag: 'Scala', // Default tag, can be replaced with actual data from API
        type: 'farm', // Default type, can be replaced with actual data from API
      }));
      
      setStakeholders(extendedData);
      setFilteredStakeholders(extendedData);
      
      if (data.length === 0 && isOnline) {
        Alert.alert('Erro', 'Falha ao carregar stakeholders');
      }
    } catch (error) {
      console.error('Error loading stakeholders:', error);
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
      const filtered = stakeholders.filter(
        (stakeholder) =>
          stakeholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stakeholder.company.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStakeholders(filtered);
    }
  }, [searchQuery, stakeholders]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStakeholders();
    setIsRefreshing(false);
  };

  const handleStakeholderPress = (stakeholder: ExtendedStakeholder) => {
    // Handle navigation or action when a stakeholder card is pressed
    console.log('Stakeholder selected:', stakeholder);
    // You can add navigation logic here
  };

  const handleProfilePress = () => {
    // Handle profile menu press
    console.log('Profile menu pressed');
    // You can add a dropdown menu or navigation logic here
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B4D3E" />
        <Text style={styles.loadingText}>Verificando autenticação...</Text>
      </View>
    );
  }

  // Show empty state if not authenticated (you might want to show login screen instead)
  if (!isAuthenticated) {
    return null;
  }

  const renderStakeholderCard = ({ item }: { item: ExtendedStakeholder }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleStakeholderPress(item)}
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
          {item.name}
        </Text>
        <View style={styles.tagContainer}>
          <Text style={styles.tagText}>{item.tag || 'Scala'}</Text>
        </View>
      </View>

      {/* Action */}
      <View style={styles.actionContainer}>
        <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Parceiros</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfilePress}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={28} color="#95A5A6" />
            <Ionicons name="chevron-down" size={16} color="#95A5A6" style={styles.chevronDown} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#95A5A6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar stakeholder ou empresa..."
            placeholderTextColor="#95A5A6"
          />
        </View>

        {/* Sub-header */}
        <Text style={styles.subHeader}>
          Escolha o stakeholder para adicionar medidas
        </Text>
      </View>

      {/* List Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1B4D3E" />
          <Text style={styles.loadingText}>Carregando stakeholders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStakeholders}
          renderItem={renderStakeholderCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#1B4D3E']}
              tintColor="#1B4D3E"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Nenhum stakeholder encontrado para a busca'
                  : 'Nenhum stakeholder encontrado'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginTop: 30,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B4D3E',
    fontFamily: 'System', // Will use system default, can be changed to Inter or Roboto if available
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  chevronDown: {
    marginLeft: 4,
  },
  searchContainer: {
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C3E50',
    padding: 0,
  },
  subHeader: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
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
    marginBottom: 8,
    fontFamily: 'System',
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
    fontFamily: 'System',
  },
  actionContainer: {
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7F8C8D',
    fontFamily: 'System',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    fontFamily: 'System',
  },
});

