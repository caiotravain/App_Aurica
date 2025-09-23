import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    const result = await login({ username: username.trim(), password });
    
    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Invalid credentials');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Logo/Header */}
          {/* <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.title}>Aurica</Text>
            </View>
            <Text style={styles.subtitle}>Dados que geram impactos</Text>
            <Text style={styles.description}>
              Reúna todos seus dados e indicadores ESG em um só lugar
            </Text>
          </View> */}

          {/* Login Form */}
          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>Bem Vindo!</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Usuário</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Insira seu usuário"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Acessar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8f0', // Light green background
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#2d6122',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#e8f5e8',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#2d6122', // Aurica main color
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 20,
    color: '#4a7c59', // Medium green
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: '#6b8e6b', // Soft green
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#2d6122',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#2d6122', // Aurica main color
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d6122', // Aurica main color
    marginBottom: 12,
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
  loginButton: {
    backgroundColor: '#2d6122', // Aurica main color
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#2d6122',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#a0b8a0',
    shadowOpacity: 0.1,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
