import { router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { currentEmergency } from '@/features/emergency/currentEmergency';
import { MOCK_KNOWN_CLINICS, MockScenario } from '@/features/emergency/mockVets';
import { REJECT_REASON_TEXT, SearchState } from '@/features/emergency/types';
import { useEmergencySearch } from '@/features/emergency/useEmergencySearch';
import { formatSeconds } from '@/lib/format';
import { formatKm } from '@/lib/geo';
import { colors, font, radius, spacing } from '@/theme';

export default function SearchScreen() {
  const [emergency] = useState(currentEmergency.get);

  if (!emergency) {
    return (
      <MessageScreen
        title="Falta tu ubicación"
        message="Volvé a tocar Emergencia veterinaria."
        actionLabel="Volver al inicio"
        onAction={() => router.dismissTo('/owner')}
      />
    );
  }

  return (
    <Search
      lat={emergency.coords.lat}
      lng={emergency.coords.lng}
      hasTransport={emergency.hasTransport}
      scenario={emergency.scenario}
    />
  );
}

function Search({ lat, lng, hasTransport, scenario }: { lat: number; lng: number; hasTransport: boolean; scenario: MockScenario }) {
  const { state, tryNext, expandRadius, stop } = useEmergencySearch({ coords: { lat, lng }, hasTransport }, scenario);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // A vet accepted → go to the "help is on the way" screen.
  useEffect(() => {
    if (state?.phase === 'accepted') {
      currentEmergency.setAccepted(state.vet, state.distanceKm);
      router.replace('/owner/accepted');
    }
  }, [state]);

  function cancel() {
    stop();
    currentEmergency.clear();
    router.dismissTo('/owner');
  }

  const cancelArea = confirmCancel ? (
    <View style={styles.cancelBox}>
      <Text style={styles.cancelQuestion}>¿Cancelar la búsqueda?</Text>
      <View style={styles.cancelRow}>
        <View style={styles.flex}>
          <SecondaryButton label="Sí, cancelar" onPress={cancel} />
        </View>
        <View style={styles.flex}>
          <SecondaryButton label="No, seguir" onPress={() => setConfirmCancel(false)} />
        </View>
      </View>
    </View>
  ) : (
    <SecondaryButton label="Cancelar búsqueda" onPress={() => setConfirmCancel(true)} />
  );

  return (
    <Screen scroll footer={<Footer state={state} onTryNext={tryNext} onExpand={expandRadius} cancelArea={cancelArea} />}>
      <PhaseBody state={state} />
    </Screen>
  );
}

function PhaseBody({ state }: { state: SearchState | null }) {
  if (!state || state.phase === 'accepted') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  switch (state.phase) {
    case 'contacting':
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.kicker}>Buscando veterinario…</Text>
          <Text style={styles.title}>Contactando a {state.vet.name}</Text>
          <Text style={styles.muted}>A {formatKm(state.distanceKm)} de vos</Text>
          <View style={styles.timer}>
            <Text style={styles.timerText}>Esperando respuesta · {formatSeconds(state.secondsLeft)}</Text>
          </View>
          <Text style={styles.small}>Todavía no está confirmado. Te avisamos apenas responda.</Text>
        </View>
      );

    case 'rejected':
      return (
        <View style={styles.center}>
          <Text style={styles.kicker}>No pudo atender</Text>
          <Text style={styles.title}>{state.vet.name}</Text>
          <Card>
            <Text style={styles.body}>{REJECT_REASON_TEXT[state.reason]}</Text>
          </Card>
          <Text style={styles.small}>Tus datos ya están cargados: no tenés que repetir nada.</Text>
        </View>
      );

    case 'none_left':
      return (
        <View style={styles.listBody}>
          <Text style={styles.kicker}>Sin respuesta en {state.radiusKm} km</Text>
          <Text style={styles.title}>Por ahora ningún veterinario pudo atender</Text>
          {state.lastRejection ? (
            <Text style={styles.muted}>
              Último contacto: {state.lastRejection.vet.name}. {REJECT_REASON_TEXT[state.lastRejection.reason]}
            </Text>
          ) : null}
          {state.nextRadiusKm === null ? <KnownClinics /> : null}
        </View>
      );
  }
}

function Footer({
  state,
  onTryNext,
  onExpand,
  cancelArea,
}: {
  state: SearchState | null;
  onTryNext: () => void;
  onExpand: () => void;
  cancelArea: ReactNode;
}) {
  if (state?.phase === 'rejected') {
    return (
      <>
        <PrimaryButton size="normal" label="Probar con el siguiente" onPress={onTryNext} />
        {cancelArea}
      </>
    );
  }
  if (state?.phase === 'none_left') {
    return state.nextRadiusKm !== null ? (
      <>
        <PrimaryButton size="normal" label={`Ampliar búsqueda a ${state.nextRadiusKm} km`} onPress={onExpand} />
        {cancelArea}
      </>
    ) : (
      <SecondaryButton label="Volver al inicio" onPress={() => router.dismissTo('/owner')} />
    );
  }
  return <>{cancelArea}</>;
}

/** Help outside the network, so nobody is ever left with nowhere to go. */
function KnownClinics() {
  return (
    <View style={styles.clinics}>
      <Text style={styles.sectionTitle}>Guardias veterinarias cercanas</Text>
      <Text style={styles.small}>No son parte de la red, pero podés llamarlas directamente.</Text>
      {MOCK_KNOWN_CLINICS.map((c) => (
        <Pressable
          key={c.phone}
          accessibilityRole="button"
          onPress={() => Linking.openURL(`tel:${c.phone.replace(/\D/g, '')}`)}
          style={({ pressed }) => [styles.clinic, pressed && styles.pressed]}
        >
          <View style={styles.flex}>
            <Text style={styles.clinicName}>{c.name}</Text>
            <Text style={styles.clinicArea}>{c.area}</Text>
          </View>
          <Text style={styles.callLink}>Llamar</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    minHeight: 420,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  listBody: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  kicker: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.text,
    textAlign: 'center',
  },
  muted: {
    fontSize: font.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  small: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  timer: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timerText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: font.small,
  },
  cancelBox: {
    gap: spacing.sm,
  },
  cancelQuestion: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  cancelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  clinics: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.subtitle,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  clinic: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  clinicName: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
  },
  clinicArea: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  callLink: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.primary,
  },
});
