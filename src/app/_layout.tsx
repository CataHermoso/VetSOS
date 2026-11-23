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
        <Stack.Screen name="owner/emergency" options={{ headerShown: false }} />
        <Stack.Screen name="owner/setup" options={{ title: 'Tus datos' }} />
        <Stack.Screen name="owner/confirm" options={{ title: 'Emergencia' }} />
        <Stack.Screen name="owner/search" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="owner/accepted" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="owner/payment" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="vet/index" options={{ title: 'Modo veterinario' }} />
        <Stack.Screen name="vet/profile" options={{ title: 'Mi perfil' }} />
        <Stack.Screen name="vet/offer" options={{ headerShown: false, gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="vet/case" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="vet/finish" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </SessionProvider>
  );
}
