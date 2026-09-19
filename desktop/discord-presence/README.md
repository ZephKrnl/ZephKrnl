# Zeph Discord Rich Presence

This is an optional desktop companion for Zeph's profile. It connects to the
Discord desktop application's local IPC socket and publishes a configurable
activity. The website does not load this process, require it, or depend on it.

## One-time Discord setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications)
   and create an application.
2. Copy the application's **Application ID**.
3. In the application's **Rich Presence → Art Assets** section, optionally
   upload an image. Use the asset's key (not its filename) as `largeImageKey`.
4. Keep the Discord desktop app running while using the companion.

The application ID is not a bot token and should not be treated as a secret.
Never put a bot token or other credential in this config.

## Live status watcher

The optional Gateway watcher can receive online, idle, and do-not-disturb
events for a user the bot can see. Create a bot in the same Discord application,
enable the **Presence Intent** under **Bot → Privileged Gateway Intents**, and
invite it to a server shared with the account. Set `gatewayBotToken` and
`gatewayUserId` locally. Never commit the bot token. Discord may still report
Invisible users as offline or omit their presence entirely.

When the companion first starts, Discord may show an authorization dialog. The
companion requests the `identify` and `rpc` permissions so the local website can
show the authorized Discord username and avatar. Discord does not provide a
physical location through Rich Presence, and the local status endpoint remains
bound to `127.0.0.1`.

## Configure and run

From the project root:

```sh
cp desktop/discord-presence/config.example.json desktop/discord-presence/discord-presence.json
```

Edit `discord-presence.json`:

- `clientId` — the Discord application ID.
- `clientSecret` — the Discord application secret, required for authorized profile access. Keep this only in the local config and never publish it.
- `authorizeProfile` — set to `true` to request OAuth profile access. This is disabled by default because Discord may reject the local RPC OAuth endpoint; standard Rich Presence does not require it.
- `details` — the first activity line, such as `Browsing Zeph's profile`.
- `state` — the second activity line, such as `Digital freedom is an illusion.`.
- `largeImageKey` and `largeImageText` — optional Developer Portal art asset.
- `smallImageKey` and `smallImageText` — optional small art asset.
- `showElapsedTime` — show a timer from when the companion starts.
- `buttons` — optional array of up to two `{ "label", "url" }` buttons.

The example points at `https://zephknight.dev`; replace it if the profile is
hosted at a different URL.

Start the companion:

```sh
pnpm install
pnpm --filter @workspace/discord-presence dev
```

You can keep settings outside the repository instead:

```sh
pnpm --filter @workspace/discord-presence dev -- --config /path/to/discord-presence.json
```

For a temporary application ID override:

```sh
DISCORD_CLIENT_ID=123456789012345678 pnpm --filter @workspace/discord-presence dev
```

Stop it with `Ctrl+C`. If Discord is not running, the companion exits with a
clear connection error and the public profile remains unaffected.