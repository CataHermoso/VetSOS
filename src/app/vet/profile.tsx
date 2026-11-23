import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Choice, Field, TextField } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { LoadingScreen } from '@/components/StatusScreens';
import { ServiceMode } from '@/features/emergency/types';
import { VetProfile, doesHomeVisits, hasClinic, loadVet, saveVetProfile } from '@/features/vet/vetData';
import { Coords } from '@/lib/geo';
import { findAddress, getCurrentCoords } from '@/lib/location';
import { errorMessage, useSession } from '@/lib/session';
import { colors, font, spacing } from '@/theme';

const digits = (s: string) => s.replace(/\D/g, '');
const toAmount = (s: string): number | null => (digits(s) ? Number(digits(s)) : null);
const fromAmount = (n: number | null) => (n === null ? '' : String(n));

// How the vet works, what they charge and where they get paid.
// Everything the owner and the matching need, filled in once.
export default function VetProfileScreen() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [license, setLicense] = useState('');
  const [mode, setMode] = useState<ServiceMode>('both');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicCoords, setClinicCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [maxKm, setMaxKm] = useState('10');
  const [base, setBase] = useState('');
  const [homeExtra, setHomeExtra] = useState('');
  const [nightExtra, setNightExtra] = useState('');
  const [appointmentPrice, setAppointmentPrice] = useState('');
  const [alias, setAlias] = useState('');
  const [cbu, setCbu] = useState('');
  const [holder, setHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadVet(userId)
      .then(({ profile: p }) => {
        setFullName(p.fullName);
        setPhone(p.phone);
        setLicense(p.licenseNumber);
        setMode(p.serviceMode);
        setClinicAddress(p.clinicAddress);
        setClinicCoords(p.clinicCoords);
        setMaxKm(String(p.maxHomeKm));
        setBase(fromAmount(p.prices.base));
        setHomeExtra(fromAmount(p.prices.homeExtra));
        setNightExtra(fromAmount(p.prices.nightExtra));
        setAppointmentPrice(fromAmount(p.prices.appointment));
        setAlias(p.bank.alias);
        setCbu(p.bank.cbuCvu);
        setHolder(p.bank.holder);
        setBankName(p.bank.bankName);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoaded(true));
  }, [userId]);

  async function locateClinicHere() {
    setLocating(true);
    setError(null);
    const result = await getCurrentCoords();
    setLocating(false);
    if (result.ok) setClinicCoords(result.coords);
    else setError('No pudimos detectar tu ubicación. Permití el acceso a la ubicación y probá de nuevo.');
  }

  async function submit() {
    if (!userId) return;
    setError(null);

    const clinic = hasClinic(mode);
    const home = doesHomeVisits(mode);
    const km = Number(digits(maxKm));

    if (!fullName.trim()) return setError('Escribí tu nombre.');
    if (digits(phone).length < 8) return setError('Escribí un teléfono válido, con código de área.');
    if (!license.trim()) return setError('Escribí tu número de matrícula.');
    if (clinic && !clinicAddress.trim()) return setError('Escribí la dirección de tu consultorio.');
    if (home && (!km || km > 100)) return setError('La distancia máxima para domicilios tiene que ser entre 1 y 100 km.');
    if (!toAmount(base)) return setError('Escribí el precio de la consulta de urgencia.');
    if (!alias.trim() && !digits(cbu)) return setError('Escribí tu alias o tu CBU/CVU para que te puedan pagar.');
    if (alias.trim() && !/^[a-zA-Z0-9.-]{6,20}$/.test(alias.trim()))
      return setError('El alias tiene entre 6 y 20 letras, números, puntos o guiones.');
    if (digits(cbu) && digits(cbu).length !== 22) return setError('El CBU/CVU tiene 22 números.');
    if (!holder.trim()) return setError('Escribí el nombre del titular de la cuenta.');

    setSaving(true);
    try {
      let coords = clinicCoords;
      if (clinic && !coords) coords = await findAddress(clinicAddress);
      if (clinic && !coords) {
        throw new Error(
          Platform.OS === 'web'
            ? 'No pudimos ubicar el consultorio desde el navegador. Si estás ahí, tocá "Estoy en el consultorio".'
            : 'No encontramos esa dirección. Agregá la localidad, o si estás ahí tocá "Estoy en el consultorio".',
        );
      }

      const profile: VetProfile = {
        fullName,
        phone,
        licenseNumber: license,
        serviceMode: mode,
        clinicAddress,
        clinicCoords: coords,
        maxHomeKm: km || 10,
        prices: { base: toAmount(base), homeExtra: toAmount(homeExtra) ?? 0, nightExtra: toAmount(nightExtra) ?? 0, appointment: toAmount(appointmentPrice) },
        bank: { alias, cbuCvu: cbu, holder, bankName },
      };
      await saveVetProfile(userId, profile);
      if (router.canGoBack()) router.back();
      else router.replace('/vet');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <LoadingScreen />;

  const clinic = hasClinic(mode);
  const home = doesHomeVisits(mode);

  return (
    <Screen
      scroll
      footer={
        <>
          {/* Shown above the button: the form is long and an error at the bottom would be missed. */}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton size="normal" label={saving ? 'Guardando…' : 'Guardar perfil'} onPress={submit} disabled={saving} />
        </>
      }
    >
      <Section title="Tus datos" />
      <Field label="Nombre">
        <TextField value={fullName} onChangeText={setFullName} placeholder="Ej: Dra. Laura Méndez" autoComplete="name" textContentType="name" />
      </Field>
      <Field label="Teléfono" hint="El dueño de la mascota te va a llamar a este número.">
        <TextField
          value={phone}
          onChangeText={setPhone}
          placeholder="11 1234-5678"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
      </Field>
      <Field label="Matrícula" hint="Por ahora no la verificamos.">
        <TextField value={license} onChangeText={setLicense} placeholder="Ej: MP 12345" autoCapitalize="characters" />
      </Field>

      <Section title="Cómo atendés" />
      <Field label="¿Dónde atendés las urgencias?">
        <Choice
          options={[
            { value: 'home', label: 'A domicilio' },
            { value: 'clinic', label: 'Consultorio' },
            { value: 'both', label: 'Ambos' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Field>
      <Text style={styles.note}>
        {mode === 'home'
          ? 'Solo te llegan urgencias donde vas vos a la casa.'
          : mode === 'clinic'
            ? 'Solo te llegan dueños que pueden llevar a su mascota a tu consultorio.'
            : 'Si el dueño tiene cómo moverse, va a tu consultorio. Si no, vas vos.'}
      </Text>

      {clinic ? (
        <Field label="Dirección del consultorio">
          <TextField
            value={clinicAddress}
            onChangeText={(t) => {
              setClinicAddress(t);
              setClinicCoords(null); // new address → locate it again
            }}
            placeholder="Calle, número y localidad"
          />
          <Card>
            {locating ? (
              <View style={styles.row}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.body}>Detectando…</Text>
              </View>
            ) : (
              <Text style={styles.body}>
                {clinicCoords ? '📍 Consultorio ubicado en el mapa' : 'Lo ubicamos con la dirección al guardar.'}
              </Text>
            )}
            <SecondaryButton label="Estoy en el consultorio: usar mi ubicación" onPress={locateClinicHere} />
          </Card>
        </Field>
      ) : null}

      {home ? (
        <Field label="Distancia máxima para domicilios (km)">
          <TextField value={maxKm} onChangeText={setMaxKm} keyboardType="number-pad" placeholder="10" />
        </Field>
      ) : null}

      <Section title="Precios" hint="El dueño los ve como precio de referencia antes de llamarte." />
      <Field label="Consulta de urgencia">
        <TextField value={base} onChangeText={setBase} keyboardType="number-pad" placeholder="$ 20000" />
      </Field>
      {home ? (
        <Field label="Extra por ir a domicilio" hint="Dejalo vacío si no cobrás extra.">
          <TextField value={homeExtra} onChangeText={setHomeExtra} keyboardType="number-pad" placeholder="$ 0" />
        </Field>
      ) : null}
      <Field label="Recargo nocturno / fin de semana" hint="Dejalo vacío si no cobrás recargo.">
        <TextField value={nightExtra} onChangeText={setNightExtra} keyboardType="number-pad" placeholder="$ 0" />
      </Field>
      <Field label="Consulta con turno" hint="Lo que cobrás por un turno programado (sin urgencia). Dejalo vacío si no das turnos.">
        <TextField value={appointmentPrice} onChangeText={setAppointmentPrice} keyboardType="number-pad" placeholder="$ 15000" />
      </Field>

      <Section title="Datos para cobrar" hint="Al terminar, el dueño ve estos datos para transferirte." />
      <Field label="Alias">
        <TextField value={alias} onChangeText={setAlias} placeholder="mi.alias.mp" autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="CBU / CVU (opcional si pusiste alias)">
        <TextField value={cbu} onChangeText={setCbu} keyboardType="number-pad" placeholder="22 números" />
      </Field>
      <Field label="Titular de la cuenta">
        <TextField value={holder} onChangeText={setHolder} placeholder="Nombre y apellido" />
      </Field>
      <Field label="Banco o billetera (opcional)">
        <TextField value={bankName} onChangeText={setBankName} placeholder="Ej: Mercado Pago" />
      </Field>
    </Screen>
  );
}

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.note}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: font.subtitle + 2,
    fontWeight: '800',
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
