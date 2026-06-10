import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { login } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const { setUsuario } = useAuthStore();

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Completá todos los campos');
      return;
    }
    setCargando(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      setUsuario(res.data.usuario, res.data.token);
      const rol = res.data.usuario.rol;
      if (rol === 'admin') router.replace('/(admin)');
      else if (rol === 'repartidor') router.replace('/(repartidor)');
      else if (rol === 'preventista') router.replace('/(preventista)');
    } catch (e: any) {
      const msg = e?.response?.data?.error
        ?? (e?.code === 'ECONNABORTED' ? 'No se pudo conectar al servidor (timeout)' : 'No se pudo iniciar sesión');
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Franja azul superior */}
      <View style={styles.topBar} />

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/bimbo-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Card de login */}
      <View style={styles.card}>
        <Text style={styles.titulo}>Bienvenido</Text>
        <Text style={styles.subtitulo}>Ingresá a tu cuenta para continuar</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={COLORS.textLight}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={cargando}>
          {cargando
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Ingresar</Text>}
        </TouchableOpacity>
      </View>

      {/* Franja azul inferior */}
      <View style={styles.bottomBar} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: COLORS.secondary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: COLORS.secondary,
  },
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 120,
  },
  card: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderTopWidth: 4,
    borderTopColor: COLORS.primary,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 12,
    backgroundColor: COLORS.background,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
});
