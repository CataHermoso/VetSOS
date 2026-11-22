import { Coords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

export type OwnerData = {
  fullName: string;
  phone: string;
  address: string;
  coords: Coords | null;
  hasTransport: boolean | null;
};

/** True when everything needed to start an emergency is saved. */
export function isOwnerSetupComplete(d: OwnerData | null): d is OwnerData & { coords: Coords; hasTransport: boolean } {
  return Boolean(d && d.fullName.trim() && d.phone.trim() && d.coords && d.hasTransport !== null);
}

export async function loadOwnerData(userId: string): Promise<OwnerData> {
  const [profile, settings] = await Promise.all([
    supabase.from('profiles').select('full_name, phone').eq('id', userId).maybeSingle(),
    supabase.from('owner_settings').select('address, lat, lng, has_transport').eq('profile_id', userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (settings.error) throw settings.error;

  const s = settings.data;
  return {
    fullName: profile.data?.full_name ?? '',
    phone: profile.data?.phone ?? '',
    address: s?.address ?? '',
    coords: s?.lat != null && s?.lng != null ? { lat: s.lat, lng: s.lng } : null,
    hasTransport: s?.has_transport ?? null,
  };
}

export async function saveOwnerData(userId: string, d: OwnerData): Promise<void> {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: d.fullName.trim(), phone: d.phone.trim() })
    .eq('id', userId);
  if (profileError) throw profileError;

  const { error: settingsError } = await supabase.from('owner_settings').upsert({
    profile_id: userId,
    address: d.address.trim() || null,
    lat: d.coords?.lat ?? null,
    lng: d.coords?.lng ?? null,
    has_transport: d.hasTransport,
  });
  if (settingsError) throw settingsError;
}

/** Quick change of the transport answer from the confirm screen. */
export async function saveTransport(userId: string, hasTransport: boolean): Promise<void> {
  const { error } = await supabase
    .from('owner_settings')
    .update({ has_transport: hasTransport })
    .eq('profile_id', userId);
  if (error) throw error;
}
