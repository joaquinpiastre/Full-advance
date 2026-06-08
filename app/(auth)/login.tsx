import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
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
      <View style={styles.card}>
        <Text style={styles.titulo}>Full Advance</Text>
        <Text style={styles.subtitulo}>Ingresá a tu cuenta</Text>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 14,
    backgroundColor: COLORS.background,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
});
