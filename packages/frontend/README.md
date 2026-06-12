# Frontend — Litopys Productivity Journal

React Native (Expo) mobile app for logging daily productivity notes and viewing AI-generated reports.

## Stack

| Component | Technology |
|-----------|-----------|
| Framework | React Native + Expo SDK |
| Navigation | Expo Router (file-based) |
| Local storage | SQLite via `expo-sqlite` |
| Internationalisation | `i18n-js` (English / Ukrainian) |
| API communication | Custom typed fetch wrappers (`api-client/`) |

## Running

```bash
npm install

# Copy environment template
cp .env.example .env
# In __DEV__ mode the backend URL is auto-detected from Expo Metro's host,
# so EXPO_PUBLIC_API_URL is only needed for production builds.

npx expo start
```

- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Scan the QR code with Expo Go on a physical device

> The device and the backend must be on the same local network. In `__DEV__` mode the app automatically uses the IP address where Metro is running — no manual URL configuration needed.

## Environment variables

Create `packages/frontend/.env`:

```env
# Used in production builds only (auto-detected from Metro in dev mode)
EXPO_PUBLIC_API_URL=http://<your-backend-ip>:8000

# Set to 'development' to use /auth/dev-login (skips OTP)
EXPO_PUBLIC_APP_ENV=development
```

`EXPO_PUBLIC_*` variables are baked into the JS bundle at build time, not at runtime.

## Authentication

Passwordless email OTP flow:

1. User enters email → `POST /auth/send-code`
2. User enters 6-digit code → `POST /auth/verify-code` → returns a JWT `access_token` + `refresh_token`
3. Tokens are stored in the OS secure store (`expo-secure-store`), not plain SQLite
4. All subsequent API requests go through `apiFetch`, which adds `Authorization: Bearer <access_token>` and transparently refreshes via `POST /auth/refresh` on a 401

In `development` mode (`EXPO_PUBLIC_APP_ENV=development`) the app calls `POST /auth/dev-login` instead, skipping OTP entirely — useful for testing without a Resend account.

## Screens

```
app/
├── login.tsx              # Email + OTP entry (or dev-login)
├── onboarding.tsx         # Goal creation after first login
├── (tabs)/
│   ├── index.tsx          # Today's notes — list of goals with entry form
│   ├── goal/
│   │   └── [id].tsx       # Goal detail + full entry history
│   ├── summary/
│   │   ├── week/index.tsx   # Weekly report view
│   │   ├── month/index.tsx  # Monthly report view
│   │   └── year/index.tsx   # Yearly report view
│   └── settings.tsx       # Language toggle, logout, sync controls
```

## Local-first sync model

All data is written to SQLite first. The backend is an optional sync target.

```
User action
    │
    ▼
SQLite (local)
    │
    └─ [manual] sync button       ──► push unsynced goals & entries
                                               │
                                         backend stores,
                                         generates embeddings
```

### Sync operations (`hooks/useSync.ts`)

| Function | Description |
|----------|-------------|
| `sync()` | Push all unsynced goals and entries to backend |
| `pushChanges()` | Same as sync without updating the sync timestamp |
| `pullGoals()` | Fetch all goals from backend and upsert locally |
| `pullEntries()` | Fetch all entries from backend and upsert locally |
| `pullReport(period, ...)` | Fetch an existing report and cache it locally |
| `syncReports(period)` | Pull all reports of a period type not cached locally |

### Data flow — creating an entry

1. Entry is saved to local SQLite (`is_synced = 0`, no `remote_id`)
2. On next `pushChanges()`, entry is `POST /entries` to backend
3. Backend embeds the note text and stores in PostgreSQL
4. Local entry is updated with `remote_id` and `is_synced = 1`

## API client

Typed wrappers in `api-client/` handle all backend communication:

| File | Resource |
|------|---------|
| `config.ts` | `BASE_URL` — auto-detects host in dev, uses env var in prod |
| `client.ts` | `apiFetch` — Bearer auth + automatic token refresh on 401 |
| `auth-store.ts` | JWT access/refresh token storage (`expo-secure-store`) |
| `goals.ts` | `createGoal`, `listGoals` |
| `entries.ts` | `createEntry`, `listEntries` |
| `reports.ts` | `fetchReport`, `requestReport`, `listReports` |

All resource functions call `apiFetch`, which attaches the Bearer token automatically — no `userId` argument needed.

## Internationalisation

Translations live in `i18n/locales/`:
- `en.json` — English (default)
- `uk.json` — Ukrainian

Language is stored in the backend user profile and synced on login. The user can switch language from Settings.

## Database schema (SQLite)

```
goals        id · remote_id · title · description · is_synced
entries      id · remote_id · goal_id · date_note · note
             productivity_score · is_synced
reports      period_type · period_key · period_start · period_end
             avg_productivity · active_days · data (JSON)
sync_meta    key · value  (stores user_remote_id, last_sync_at)
```
