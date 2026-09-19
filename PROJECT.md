# Zeph Profile Site

Personal profile site with a media-backed landing page, social links, Discord OAuth profile sync, and an optional Discord Gateway presence watcher.

## Development

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
$env:ADMIN_PASSWORD = "choose-a-private-password"
pnpm --dir artifacts/zeph-profile dev
```

The public profile runs at `http://localhost:5173/`.

## Production database

The profile analytics and guestbook SQL tables are defined in `lib/db`. Set
`DATABASE_URL` for the API server, then push the schema before starting it:

```powershell
$env:DATABASE_URL = "postgresql://..."
corepack pnpm --filter @workspace/db push
corepack pnpm --filter @workspace/api-server typecheck
```

Guestbook submissions are limited to one note per device every seven days and
remain pending until approved through the admin flow.

Press `Shift+D` on the profile to open the private view history. Set
`ADMIN_PASSWORD` before starting the dev server and replace the example value
with your own password. Do not commit the password or put it in a tracked file.

## Discord integration

- Discord OAuth stores the authorized profile session in the local development server.
- The Gateway watcher reports online, idle, do-not-disturb, and offline events through the local status bridge.
- Keep `desktop/discord-presence/discord-presence.json` local. It is ignored by Git and contains private credentials.
- A hosted deployment needs a separate backend for OAuth secrets and Gateway credentials; GitHub Pages alone cannot run those server processes.

## Main locations

- `artifacts/zeph-profile/src/App.tsx` - profile UI and status display
- `artifacts/zeph-profile/src/index.css` - profile styling
- `artifacts/zeph-profile/public/assets/` - profile media
- `desktop/discord-presence/src/index.ts` - Discord Rich Presence and Gateway watcher
- `desktop/discord-presence/discord-presence.json` - local Discord configuration
