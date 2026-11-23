# VetSOS 🐾

App that connects pet owners in an emergency with vets who volunteer to be on call.

- Spec and roadmap: [docs/SPEC.md](docs/SPEC.md)
- Stack: React Native + Expo (TypeScript), Expo Router, Supabase (database, anonymous login, realtime).

## Supabase setup (once)

1. In [supabase.com](https://supabase.com) → **New project** (region: São Paulo is the closest to Argentina). Save the database password somewhere safe.
2. **Authentication → Sign In / Providers** → turn on **Allow anonymous sign-ins** → Save.
3. **SQL Editor → New query** → paste all of each file in [supabase/migrations/](supabase/migrations/), **in order**, and **Run** each one:
   1. `20261122000000_profiles_and_vets.sql` — profiles, owner settings, vets
   2. `20261123000000_emergencies_and_offers.sql` — emergencies, offers to vets, matching and the accept lock
   3. `20261124000000_payment_details.sql` — what the owner sees to pay once the vet finishes
4. Click **Connect** (top of the project) → **Framework** → pick **Expo React Native** in the Framework dropdown (or any framework: the URL and key are the same, only the variable prefix changes) → copy the URL and the publishable key into `.env.local` (copy `.env.example` if it doesn't exist). `.env.local` is never committed.
5. Restart `npx expo start`.

## Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. In this folder, run:

   ```powershell
   npx expo start
   ```

3. Scan the QR code in the terminal with the iPhone **Camera** app → it opens in Expo Go.
   - Phone and computer must be on the **same Wi-Fi**. If Windows asks about the firewall for Node.js, allow it on private networks.
   - If it can't connect, use `npx expo start --tunnel` instead.
4. Edit a file and save: the app reloads on the phone by itself.

## Run it in the browser

```powershell
npm run web
```

## Try a real emergency with two devices

Each device (or browser) is a different anonymous user.

1. **Vet** (e.g. the computer's browser): pick "Soy veterinario/a", fill in the profile, switch to **Disponible**, and keep the app open.
2. **Owner** (e.g. the iPhone): pick "Tengo una mascota" → EMERGENCIA → on the confirm screen keep **Reales** → PEDIR AYUDA AHORA.
3. The vet gets the emergency within a few seconds. Accept or reject and watch the owner's screen.

Vets only get emergencies within range (10 km, then 30 / 50 if the owner widens the search) and compatible with how they work. In one browser, `localhost:8081` and `127.0.0.1:8081` count as two separate users.

## Checks

```powershell
npm run typecheck
```

```powershell
npm run lint
```

```powershell
npx expo-doctor
```

## Project structure

```
src/
  app/              Screens (every file is a route — Expo Router)
    _layout.tsx     Navigation stack
    index.tsx       Role picker (temporary until logins exist)
    owner/          Pet owner screens
    vet/            Vet screens
  components/       Shared UI (buttons, screen layout)
  features/         Logic per area: emergency (search, prices), owner, vet
  lib/              Supabase client, session, location, maps, formatting
  config.ts         Open settings (answer time, radius steps, night hours)
  theme.ts          Colors, spacing, font sizes (white + violet)
supabase/migrations Database tables and server functions (run in the SQL Editor)
docs/SPEC.md        Product spec
```
