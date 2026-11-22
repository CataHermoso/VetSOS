# VetSOS 🐾

App that connects pet owners in an emergency with vets who volunteer to be on call.

- Spec and roadmap: [docs/SPEC.md](docs/SPEC.md)
- Stack: React Native + Expo (TypeScript), Expo Router. Supabase comes in milestone 2.

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
