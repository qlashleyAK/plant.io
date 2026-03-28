import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/hooks/useAuth';
import { colors } from '../src/theme';

export default function RootLayout() {
  const { loadToken } = useAuthStore();

  useEffect(() => {
    loadToken();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}
