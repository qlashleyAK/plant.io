import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../src/hooks/useAuth';
import { getServerUrl } from '../src/config';
import { colors, spacing } from '../src/theme';

export default function LoginScreen() {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuthStore();

  const handleLogin = async () => {
    if (!key.trim()) return;
    setLoading(true);
    try {
      const serverUrl = await getServerUrl();
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        Alert.alert('Login Failed', data.error || 'Invalid access key');
        return;
      }
      await setToken(data.token);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Connection Error', err.message || 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>plant.io</Text>
        <Text style={styles.subtitle}>Aeroponic Monitoring System</Text>

        <TextInput
          style={styles.input}
          placeholder="Access key"
          placeholderTextColor={colors.textMuted}
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Connecting...' : 'Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.emerald,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl + spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
