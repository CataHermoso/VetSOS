import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Choice } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { LoadingScreen, MessageScreen } from '@/components/StatusScreens';
import { config } from '@/config';
import { currentEmergency } from '@/features/emergency/currentEmergency';
import { MockScenario } from '@/features/emergency/mockVets';
import { loadOwnerData, saveTransport } from '@/features/owner/ownerData';
import { Coords } from '@/lib/geo';
import { describeArea, getCurrentCoords } from '@/lib/location';
import { errorMessage, useSession } from '@/lib/session';
import { colors, font, spacing } from '@/theme';

type Place = { coords: Coords; area: string | null; source: 'gps' | 'saved' };

/** Saved transport answer + where the owner is now (GPS, or the saved location as fallback). */
async function findPlace(userId: string): Promise<{ hasTransport: boolean | null; place: Place }> {
  const saved = await loadOwnerData(userId);
  const gps = await getCurrentCoords();
  if (gps.ok) {
    return { hasTransport: saved.hasTransport, place: { coords: gps.coords, area: await describeArea(gps.coords), source: 'gps' } };
  }
  if (saved.coords) {
    return { hasTransport: saved.hasTransport, place: { coords: saved.coords, area: saved.address || null, source: 'saved' } };
  }
  throw new Error('No pudimos saber dónde estás. Permití el acceso a la ubicación.');
}

// "Estás en X · Transporte: Sí" + one big button.
// Location is re-detected every time: you're not always at home.
export default function ConfirmEmergency() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [place, setPlace] = useState<Place | null>(null);
  const [hasTransport, setHasTransport] = useState<boolean | null>(null);
  const [scenario, setScenario] = useState<MockScenario>('normal');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    findPlace(userId)
      .then((r) => {
        if (cancelled) return;
        setHasTransport(r.hasTransport);
        setPlace(r.place);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  function retry() {
    setError(null);
    setPlace(null);
    setAttempt((n) => n + 1);
  }

  const start = useCallback(() => {
    if (!place || hasTransport === null || started.current) return;
    started.current = true;
    currentEmergency.start({ coords: place.coords, hasTransport, scenario });
    router.replace('/owner/search');
  }, [place, hasTransport, scenario]);

  // If the confirm screen is turned off in config, go straight to searching.
  useEffect(() => {
    if (!config.showConfirmScreen && place && hasTransport !== null) start();
  }, [place, hasTransport, start]);

  async function changeTransport(value: boolean) {
    setHasTransport(value);
    if (userId) saveTransport(userId, value).catch(() => {}); // the search uses the on-screen value anyway
  }

  if (error) {
    return <MessageScreen title="Falta tu ubicación" message={error} actionLabel="Reintentar" onAction={retry} />;
  }
  if (!config.showConfirmScreen) return <LoadingScreen />;

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label="PEDIR AYUDA AHORA"
            hint="Contactamos al veterinario más cercano"
            onPress={start}
            disabled={!place || hasTransport === null}
          />
          <SecondaryButton label="Editar mis datos" onPress={() => router.push('/owner/setup')} />
        </>
      }
    >
      <View style={styles.body}>
        <Card>
          <Text style={styles.cardLabel}>Ubicación</Text>
          {place ? (
            <>
              <Text style={styles.cardValue}>
                📍 {place.area ? `Estás en ${place.area}` : 'Ubicación detectada'}
              </Text>
              {place.source === 'saved' ? (
                <Text style={styles.note}>No pudimos detectarte ahora; usamos tu ubicación guardada.</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.row}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.cardValue}>Detectando…</Text>
            </View>
          )}
        </Card>

        <Card>
          <Text style={styles.cardLabel}>¿Podés trasladar a tu mascota?</Text>
          <Choice
            options={[
              { value: true, label: 'Sí, puedo ir' },
              { value: false, label: 'No, que venga' },
            ]}
            value={hasTransport}
            onChange={changeTransport}
          />
        </Card>

        {__DEV__ ? (
          <Card>
            <Text style={styles.cardLabel}>Simulación (solo en desarrollo)</Text>
            <Choice
              options={[
                { value: 'normal', label: 'Alguien acepta' },
                { value: 'nobody', label: 'Nadie atiende' },
              ]}
              value={scenario}
              onChange={setScenario}
            />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  cardLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: font.subtitle,
    fontWeight: '600',
    color: colors.text,
  },
  note: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
