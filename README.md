# VetSOS 🐾

App that connects pet owners in an emergency with vets who volunteer to be on call.

- Spec and roadmap: [docs/SPEC.md](docs/SPEC.md)
- Stack: React Native + Expo (TypeScript), Expo Router. Supabase comes in milestone 2.

## Supabase setup (once)

1. In [supabase.com](https://supabase.com) → **New project** (region: São Paulo is the closest to Argentina). Save the database password somewhere safe.
2. **Authentication → Sign In / Providers** → turn on **Allow anonymous sign-ins** → Save.
3. **SQL Editor → New query** → paste all of [supabase/migrations/20261122000000_profiles_and_vets.sql](supabase/migrations/20261122000000_profiles_and_vets.sql) → **Run**.
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

## Checks

```powershell
npm run typecheck
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
  theme.ts          Colors, spacing, font sizes (white + violet)
docs/SPEC.md        Product spec
```
