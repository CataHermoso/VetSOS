import 'react-native-url-polyfill/auto';
import './storage';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False until the keys are in .env.local (see README). */
export const isSupabaseConfigured = Boolean(url && key);

// localStorage doesn't exist while Expo pre-renders web pages on the computer.
const storage = typeof localStorage !== 'undefined' ? localStorage : undefined;

export const supabase = createClient(
  url ?? 'https://not-configured.supabase.co',
  key ?? 'not-configured',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// On phones, only refresh the login while the app is open.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
