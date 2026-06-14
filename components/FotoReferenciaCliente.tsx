import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Alert, ActivityIndicator, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { subirFotoReferenciaCliente } from '../services/api';
import { urlFoto } from '../constants';
import { Cliente } from '../types';

type Props = {
  cliente: Cliente;
  color: string;
  onActualizado?: (uri: string) => void;
};

export default function FotoReferenciaCliente({ cliente, color, onActualizado }: Props) {
  const [uri, setUri] = useState(cliente.foto_referencia_uri);
  const [visible, setVisible] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    setUri(cliente.foto_referencia_uri);
  }, [cliente.id, cliente.foto_referencia_uri]);

  const subirDesde = async (origen: 'camara' | 'galeria') => {
    try {
      let result;
      if (origen === 'camara') {
        const permiso = await ImagePicker.requestCameraPermissionsAsync();
        if (permiso.status !== 'granted') {
          Alert.alert('Permiso de cámara', 'Necesitás permitir el acceso a la cámara.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      } else {
        const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permiso.status !== 'granted') {
          Alert.alert('Permiso de galería', 'Necesitás permitir el acceso a la galería.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
      }
      if (result.canceled) return;
      const localUri = result.assets[0].uri;

      setSubiendo(true);
      const form = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(localUri)).blob();
        form.append('foto', blob, 'referencia.jpg');
      } else {
        form.append('foto', { uri: localUri, type: 'image/jpeg', name: 'referencia.jpg' } as any);
      }
      const res = await subirFotoReferenciaCliente(cliente.id, form);
      setUri(res.data.uri);
      onActualizado?.(res.data.uri);
    } catch {
      Alert.alert('Error', 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const elegirOrigen = () => {
    Alert.alert('Foto del local', '¿De dónde la sacás?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cámara', onPress: () => subirDesde('camara') },
      { text: 'Galería', onPress: () => subirDesde('galeria') },
    ]);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.thumb, { borderColor: color }]}
        onPress={() => (uri ? setVisible(true) : elegirOrigen())}
        disabled={subiendo}
      >
        {subiendo ? (
          <ActivityIndicator color={color} size="small" />
        ) : uri ? (
          <Image source={{ uri: urlFoto(uri) }} style={styles.thumbImg} />
        ) : (
          <Text style={[styles.mas, { color }]}>+</Text>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.cerrar} onPress={() => setVisible(false)}>
            <Text style={styles.cerrarTexto}>✕</Text>
          </TouchableOpacity>
          {uri && (
            <Image source={{ uri: urlFoto(uri) }} style={styles.fullImg} resizeMode="contain" />
          )}
          <TouchableOpacity
            style={[styles.btnCambiar, { backgroundColor: color }]}
            onPress={elegirOrigen}
            disabled={subiendo}
          >
            {subiendo ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnCambiarTexto}>Cambiar foto</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  thumbImg: { width: '100%', height: '100%' },
  mas: { fontSize: 24, fontWeight: '700', lineHeight: 26 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  fullImg: { width: '100%', height: '75%' },
  cerrar: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
  cerrarTexto: { color: '#fff', fontSize: 28, fontWeight: '700' },
  btnCambiar: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  btnCambiarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
