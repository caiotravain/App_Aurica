import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface PhotoPickerProps {
  onPhotoSelected: (photo: { uri: string; type: string; name: string }) => void;
  onPhotoRemoved: () => void;
  selectedPhoto?: { uri: string; type: string; name: string };
  disabled?: boolean;
}

export const PhotoPicker: React.FC<PhotoPickerProps> = ({
  onPhotoSelected,
  onPhotoRemoved,
  selectedPhoto,
  disabled = false,
}) => {
  const [showModal, setShowModal] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaLibraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaLibraryStatus !== 'granted') {
      Alert.alert(
        'Permissões Necessárias',
        'Precisamos de permissão para acessar a câmera e galeria para adicionar fotos às medidas.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const photo = {
          uri: asset.uri,
          type: 'image/jpeg',
          name: `measurement_${Date.now()}.jpg`,
        };
        onPhotoSelected(photo);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Erro', 'Falha ao tirar foto. Tente novamente.');
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const photo = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `measurement_${Date.now()}.jpg`,
        };
        onPhotoSelected(photo);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erro', 'Falha ao selecionar imagem. Tente novamente.');
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Remover Foto',
      'Tem certeza que deseja remover esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: onPhotoRemoved },
      ]
    );
  };

  const showPhotoOptions = () => {
    if (disabled) return;
    setShowModal(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Foto da Medição (Opcional)</Text>
      
      {selectedPhoto ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: selectedPhoto.uri }} style={styles.photo} />
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={removePhoto}
              disabled={disabled}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Remover</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.changeButton]}
              onPress={showPhotoOptions}
              disabled={disabled}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Alterar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addPhotoButton, disabled && styles.disabledButton]}
          onPress={showPhotoOptions}
          disabled={disabled}
        >
          <Ionicons name="camera-outline" size={32} color="#2d6122" />
          <Text style={styles.addPhotoText}>Adicionar Foto</Text>
          <Text style={styles.addPhotoSubtext}>Toque para tirar ou selecionar uma foto</Text>
        </TouchableOpacity>
      )}

      {/* Photo Options Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar Foto</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#2d6122" />
              <Text style={styles.modalOptionText}>Tirar Foto</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={24} color="#2d6122" />
              <Text style={styles.modalOptionText}>Escolher da Galeria</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d6122',
    marginBottom: 8,
  },
  addPhotoButton: {
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#fafbfa',
  },
  disabledButton: {
    opacity: 0.5,
  },
  addPhotoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d6122',
    marginTop: 8,
    marginBottom: 4,
  },
  addPhotoSubtext: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  photoContainer: {
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fafbfa',
  },
  photo: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  photoActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  removeButton: {
    backgroundColor: '#dc3545',
  },
  changeButton: {
    backgroundColor: '#2d6122',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: width * 0.8,
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d6122',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#2d6122',
    marginLeft: 12,
    fontWeight: '500',
  },
  modalCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
});
