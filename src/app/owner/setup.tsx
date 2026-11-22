import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Choice, Field, TextField } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { LoadingScreen } from '@/components/StatusScreens';
import { loadOwnerData, saveOwnerData } from '@/features/owner/ownerData';
import { Coords } from '@/lib/geo';
import { describeArea, findAddress, getCurrentCoords } from '@/lib/location';
import { errorMessage, useSession } from '@/lib/session';
import { colors, font, spacing } from '@/theme';

type LocationState =
  | { status: 'detecting' }
  | { status: 'found'; coords: Coords; area: string | null }
  | { status: 'denied' }
  | { status: 'unavailable' };

async function detectPlace(): Promise<LocationState> {
  const result = await getCurrentCoords();
  if (!result.ok) return { status: result.reason };
  return { status: 'found', coords: result.coords, area: await describeArea(result.coords) };
}

// First-time setup: the minimum we need to send a vet. Saved for next time.
export default function OwnerSetup() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [hasTransport, setHasTransport] = useState<boolean | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: 'detecting' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill anything already saved.
  useEffect(() => {
    if (!userId) return;
    loadOwnerData(userId)
      .then((d) => {
        setFullName(d.fullName);
        setPhone(d.phone);
        setAddress(d.address);
        setHasTransport(d.hasTransport);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoaded(true));
  }, [userId]);

  // Detect on open and on every "Volver a detectar" (which bumps detectAttempt).
  const [detectAttempt, setDetectAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    detectPlace().then((l) => {
      if (!cancelled) setLocation(l);
    });
    return () => {
      cancelled = true;
    };
  }, [detectAttempt]);

  function detectLocation() {
    setLocation({ status: 'detecting' });
    setDetectAttempt((n) => n + 1);
  }

  async function submit() {
    if (!userId) return;
    setError(null);

    if (!fullName.trim()) return setError('Escribí tu nombre.');
    if (phone.replace(/\D/g, '').length < 8) return setError('Escribí un teléfono válido, con código de área.');
    if (hasTransport === null) return setError('Contanos si tenés cómo trasladar a tu mascota.');

    setSaving(true);
    try {
      let coords = location.status === 'found' ? location.coords : null;
      if (!coords && address.trim()) coords = await findAddress(address);
      if (!coords) {
        throw new Error(
          Platform.OS === 'web'
            ? 'Necesitamos tu ubicación. Permití el acceso a la ubicación en el navegador y tocá "Volver a detectar".'
            : 'No pudimos ubicarte. Permití el acceso a la ubicación o escribí una dirección más completa.',
        );
      }
      await saveOwnerData(userId, { fullName, phone, address, coords, hasTransport });
      router.replace('/owner/confirm');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <LoadingScreen />;

  return (
    <Screen
      scroll
      footer={<PrimaryButton size="normal" label={saving ? 'Guardando…' : 'Guardar y continuar'} onPress={submit} disabled={saving} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Antes de buscar ayuda</Text>
        <Text style={styles.subtitle}>Lo pedimos una sola vez. La próxima, es un solo toque.</Text>
      </View>

      <Field label="Tu nombre">
        <TextField value={fullName} onChangeText={setFullName} placeholder="Nombre y apellido" autoComplete="name" textContentType="name" />
      </Field>

      <Field label="Tu teléfono" hint="El veterinario te va a llamar a este número.">
        <TextField
          value={phone}
          onChangeText={setPhone}
          placeholder="11 1234-5678"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
      </Field>

      <Field label="Tu ubicación">
        <Card>
          <LocationStatus location={location} />
          {location.status !== 'detecting' ? (
            <SecondaryButton
              label="Volver a detectar"
              onPress={detectLocation}
            />
          ) : null}
        </Card>
      </Field>

      <Field label="Dirección o referencia (opcional)" hint="Piso, depto, timbre… ayuda al veterinario a encontrarte.">
        <TextField value={address} onChangeText={setAddress} placeholder="Ej: Av. Siempre Viva 742, 3° B" />
      </Field>

      <Field label="¿Tenés cómo trasladar a tu mascota?" hint="Si no, solo te contactamos con veterinarios que van a domicilio.">
        <Choice
          options={[
            { value: true, label: 'Sí, puedo ir' },
            { value: false, label: 'No, que venga' },
          ]}
          value={hasTransport}
          onChange={setHasTransport}
        />
      </Field>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function LocationStatus({ location }: { location: LocationState }) {
  switch (location.status) {
    case 'detecting':
      return (
        <View style={styles.row}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.body}>Detectando tu ubicación…</Text>
        </View>
      );
    case 'found':
      return <Text style={styles.body}>📍 {location.area ? `Estás en ${location.area}` : 'Ubicación detectada'}</Text>;
    case 'denied':
      return (
        <Text style={styles.body}>
          No tenemos permiso para ver tu ubicación. Activalo en la configuración del teléfono, o escribí tu dirección abajo.
        </Text>
      );
    case 'unavailable':
      return <Text style={styles.body}>No pudimos detectar tu ubicación. Probá de nuevo o escribí tu dirección abajo.</Text>;
  }
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: font.body,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.text,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
  },
});
