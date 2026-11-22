# VetSOS — MVP spec

> Living document. Last updated: 2026-11-22.
> App UI language: Spanish (rioplatense, "vos").

## 1. What it is

A mobile app that connects a pet owner with an emergency **with a vet who has volunteered to be on call** from wherever they are (home, asleep, out). Vets don't have to sit in a clinic waiting for cases; owners get help in a few taps.

Pitch line: *"Los veterinarios ofrecen guardias de urgencia sin tener que quedarse en una clínica esperando pacientes."*

## 2. Tech stack

| Piece | Choice | Why |
|---|---|---|
| App | **React Native + Expo** (TypeScript) | One codebase for iPhone, Android **and web** (the July demo comes from the same code). |
| Testing on iPhone | **Expo Go** app | Scan a QR from the dev server, runs on your phone. No Mac, no Apple developer account needed to start. |
| Backend | **Supabase** (free tier) | Postgres database, login (incl. anonymous login), realtime updates, server functions. |
| Maps | Native maps view + "open in Google Maps / Apple Maps" | Free; no paid map API needed for the MVP. |
| Calls | Normal phone call via `tel:` link | Free. No Twilio. |

Known limit: alerts that wake a vet while the app is **closed** (push notifications) need a development build later, which on iPhone requires an Apple Developer account (USD 99/year). For the MVP, the vet gets the alert in the app while it's open.

## 3. Design rules

- White + violet, clean "medical" look. Red only for warnings.
- **One main action per screen.**
- Emergency = as few taps as possible. Never tell the owner help is confirmed until a vet accepts.
- No feature, cost or complexity until we know we need it.

## 4. MVP scope

**In:**
- Owner: emergency button, first-time setup, search, tracking, cancel, reject handling, payment screen.
- Vet: profile (how they work + prices + bank details), available/unavailable switch, incoming emergency with Accept/Reject, close the case + payment, back on call or end shift.
- Matching by distance + how the vet works (home visits / clinic).

**Out (later):** appointments ("Sacar turno" shows as "Próximamente"), card / Mercado Pago payments, case history, live location sharing, scheduled shifts, push notifications when the app is closed, vet license verification, app store release.

## 5. Owner flow

1. Home: big **"EMERGENCIA VETERINARIA"** button. Small: "Sacar turno" (próximamente), "Perfil".
2. **First time only** — minimal setup: name, phone, location (GPS pin, movable, or typed address), *"¿Tenés cómo trasladar a tu mascota?"* Sí / No. Saved for next time. No email/password: anonymous account.
3. **Confirm screen** (configurable, to validate with vets later): *"Estás en {zona} · Transporte: Sí"* + big **"Pedir ayuda ahora"**. Location is re-detected each time; transport can be changed right there.
4. **Searching screen**: "Buscando veterinario…" + who is being contacted + **Cancelar**.
5. If a vet **rejects / doesn't answer**: show the reason + **"Probar con el siguiente"** (owner taps it; not automatic).
6. If **nobody is left**: "Por ahora ningún veterinario pudo atender" → **Ampliar búsqueda** (bigger radius) → still nobody: list of known emergency clinics to call directly.
7. **Accepted**: vet name, prices, **Llamar** button (`tel:`), meeting point on a small map (owner's home or vet's clinic) with "Abrir en Maps".
8. **Payment screen** (when the vet closes the case): final amount, bank details (alias / CBU / CVU, account holder, bank), **Copiar alias**.

## 6. Vet flow

1. Profile: name, phone, license number (matrícula, entered only, not verified in MVP), how they work (**home visits / clinic only / both**), clinic address if any, max distance for home visits, prices (base emergency fee, home visit extra, night/weekend surcharge), bank details.
2. Home: big switch **Disponible / No disponible**. Location taken when switched on.
3. **Incoming emergency** (full screen, sound): distance, whether the owner has transport, area, owner's first name. **Aceptar** / **Rechazar**.
   - Reject reasons: *"Ocupado, en 30 min puedo"* / *"No disponible hoy"* / *"Muy lejos"*.
   - No answer within the time limit = counts as not answered, move on.
4. **Accepted** → automatically **Ocupado** (gets no new requests). Sees owner phone + **Llamar**, location + "Abrir en Maps".
5. **Finalizar atención** → enter final amount → owner sees payment screen.
6. **Pago realizado** (when the transfer arrives) — or close with payment still **pendiente** without marking it paid.
7. *"¿Querés volver a estar disponible?"* → **Volver a guardia** / **Terminar mi guardia**.

## 7. Matching rules (defaults, all configurable)

- Candidates: vets who are `available`, within radius, and compatible:
  - owner has **no transport** → only vets who do home visits.
  - owner has transport → any (clinic vets: owner goes to the clinic).
- Order: nearest first.
- One vet offered at a time. Answer time limit: **45 s** (TBD).
- A vet is never offered the same emergency twice. "Ocupado 30 min" hides them for 30 min; "No disponible hoy" sets them unavailable.
- **Lock:** accepting is atomic on the server — a vet can only have one active emergency, and an emergency only one vet.
- Default radius 10 km → "Ampliar búsqueda" goes to 30 km → 50 km (TBD).

## 8. Data model (first draft)

- `profiles` — id, role (`owner` | `vet`), name, phone.
- `owner_settings` — profile_id, default location, has_transport.
- `vets` — profile_id, license_number, service_mode (`home` | `clinic` | `both`), clinic_address/location, max_home_km, prices (base, home_extra, night_extra), bank (alias, cbu_cvu, holder, bank_name), status (`offline` | `available` | `busy`), snoozed_until, last_location.
- `emergencies` — id, owner_id, location, has_transport, status, assigned_vet_id, radius_km, final_amount, payment_status (`none` | `pending` | `paid`), timestamps.
- `emergency_offers` — emergency_id, vet_id, sent_at, response (`accepted` | `rejected` | `timeout`), reason.

**Emergency status:** `searching` → `offered` → `accepted` → `finished` · or `cancelled` · or `no_vets`.
Care, payment and vet availability are **three separate states**; the UI makes them feel like one simple flow.

## 9. Open questions (decide while building / ask vets later)

- Keep the confirm screen (step 5.3) or go straight to searching?
- Answer time limit and radius values.
- Would vets accept emergencies while asleep? Which alert would they trust?
- When does a case need sending to a fully equipped clinic, and how do we show that?
- Competitors: do vets know / use VetYa, VetGuardia, Veturno, HappyPaws? What works, what's missing?

## 10. Competitors (to review)

- **VetYa / Vetpresta** — closest: 24/7 emergencies with GPS, vets set hours and prices and accept cases. Apps "coming soon". *Owner is downloading it to compare features.*
- **HappyPaws** — home-visit vets, explicitly **no** emergencies.
- **VetGuardia**, **Veturno** — directories of clinics on call (call / WhatsApp).

## 11. Build milestones

1. **Setup** — Expo project, runs on iPhone via Expo Go, base theme (white/violet), navigation.
2. **Supabase** — project, tables, anonymous login, owner/vet role pick.
3. **Owner flow (mock data)** — every owner screen, with fake vets.
4. **Vet flow (mock data)** — every vet screen.
5. **Real matching** — realtime offers, accept/reject, timeout, lock.
6. **Close & pay** — final amount, payment screen, "Pago realizado", back on call.
7. **Polish & test** — two phones running a full emergency end-to-end.
8. **Web build** — same app running in the browser for the July demo (QR → open link).
