import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider } from '@/lib/session';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerBackTitle: 'Volver',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="owner/index" options={{ headerShown: false }} />
        <Stack.Screen name="owner/emergency" options={{ title: 'Emergencia' }} />
        <Stack.Screen name="vet/index" options={{ title: 'Modo veterinario' }} />
      </Stack>
    </SessionProvider>
  );
}
