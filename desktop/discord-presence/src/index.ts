import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { Client as GatewayClient, Events, GatewayIntentBits } from 'discord.js';
import { Client } from '@xhayper/discord-rpc';

type PresenceButton = {
  label: string;
  url: string;
};

type PresenceConfig = {
  clientId: string;
  clientSecret?: string;
  authorizeProfile?: boolean;
  gatewayBotToken?: string;
  gatewayUserId?: string;
  details?: string;
  state?: string;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  showElapsedTime?: boolean;
  buttons?: PresenceButton[];
};

const DEFAULT_DETAILS = "Browsing Zeph's profile";
const DEFAULT_STATE = 'Digital freedom is an illusion.';
const DEFAULT_STATUS_PORT = 8765;
type DiscordStatus = 'online' | 'idle' | 'dnd' | 'offline';
type DiscordProfile = {
  username: string;
  avatarUrl: string;
  bannerUrl?: string;
};
type DiscordActivity = {
  name: string;
  details?: string;
  state?: string;
  imageUrl?: string;
  trackUrl?: string;
  startedAt?: number;
  endsAt?: number;
};
let publishStatus: () => void = () => undefined;

function printHelp() {
  console.log(`
Zeph Discord Rich Presence

Usage:
  pnpm --filter @workspace/discord-presence dev -- --config ./discord-presence.json
  DISCORD_CLIENT_ID=... pnpm --filter @workspace/discord-presence dev

Options:
  --config <path>       Read activity settings from a JSON file.
  --client-id <id>      Override the Discord application ID.
  --help                Show this help.

The Discord desktop client must already be running. See README.md for setup.
`);
}

function getOption(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : undefined;
}

function isValidClientId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

function validateButton(button: unknown, index: number): PresenceButton {
  if (!button || typeof button !== 'object') {
    throw new Error(`buttons[${index}] must be an object.`);
  }

  const candidate = button as Partial<PresenceButton>;
  if (!candidate.label || !candidate.url) {
    throw new Error(`buttons[${index}] needs both label and url.`);
  }

  try {
    const url = new URL(candidate.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`buttons[${index}].url must be an http(s) URL.`);
  }

  return { label: candidate.label, url: candidate.url };
}

async function findDefaultConfigPath(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), 'discord-presence.json'),
    path.resolve(process.cwd(), 'desktop/discord-presence/discord-presence.json'),
  ];

  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  return candidates[0];
}

async function loadConfig(configPath: string, clientIdOverride?: string): Promise<PresenceConfig> {
  let fileConfig: Partial<PresenceConfig> = {};

  try {
    const raw = await readFile(configPath, 'utf8');
    fileConfig = JSON.parse(raw) as Partial<PresenceConfig>;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw new Error(`Could not read ${configPath}: ${(error as Error).message}`);
    }
  }

  const clientId = clientIdOverride ?? process.env.DISCORD_CLIENT_ID ?? fileConfig.clientId;
  if (!isValidClientId(clientId)) {
    throw new Error(
      `Missing or invalid Discord application ID. Copy config.example.json to discord-presence.json and set clientId, or use DISCORD_CLIENT_ID.`,
    );
  }

  const buttons = fileConfig.buttons?.map(validateButton);
  if (buttons && buttons.length > 2) {
    throw new Error('Discord supports at most two activity buttons.');
  }
  return {
    clientId,
    clientSecret: fileConfig.clientSecret,
    authorizeProfile: fileConfig.authorizeProfile ?? false,
    gatewayBotToken: fileConfig.gatewayBotToken,
    gatewayUserId: fileConfig.gatewayUserId,
    details: fileConfig.details ?? DEFAULT_DETAILS,
    state: fileConfig.state ?? DEFAULT_STATE,
    largeImageKey: fileConfig.largeImageKey,
    largeImageText: fileConfig.largeImageText,
    smallImageKey: fileConfig.smallImageKey,
    smallImageText: fileConfig.smallImageText,
    showElapsedTime: fileConfig.showElapsedTime ?? true,
    buttons,
  };
}

function startStatusServer(
  port: number,
  getStatus: () => DiscordStatus,
  getProfile: () => DiscordProfile | null,
  getActivity: () => DiscordActivity | null,
): Server {
  const statusClients = new Set<() => void>();
  const server = createServer((request, response) => {
    if (request.url === '/events') {
      response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
      });
      const publish = () => response.write(`data: ${JSON.stringify({ status: getStatus(), profile: getProfile(), activity: getActivity() })}\n\n`);
      statusClients.add(publish);
      publish();
      request.on('close', () => statusClients.delete(publish));
      return;
    }

    if (request.url !== '/status') {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ status: getStatus(), profile: getProfile(), activity: getActivity() }));
  });

  publishStatus = () => statusClients.forEach((publish) => publish());

  server.listen(port, '127.0.0.1', () => {
    console.log(`Presence status available at http://127.0.0.1:${port}/status`);
  });
  return server;
}

function createActivity(config: PresenceConfig) {
  return {
    details: config.details,
    state: config.state,
    assets: {
      large_image: config.largeImageKey,
      large_text: config.largeImageText,
      small_image: config.smallImageKey,
      small_text: config.smallImageText,
    },
    timestamps: config.showElapsedTime ? { start: Date.now() } : undefined,
    buttons: config.buttons,
  };
}

function normalizeStatus(value: unknown): DiscordStatus {
  return value === 'idle' || value === 'dnd' || value === 'offline' ? value : 'online';
}

async function getSpotifyArtwork(trackId: string | undefined) {
  if (!trackId) return undefined;

  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${trackId}`)}`);
    if (!response.ok) return undefined;
    const data = (await response.json()) as { thumbnail_url?: string };
    return data.thumbnail_url;
  } catch {
    return undefined;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    printHelp();
    return;
  }

  const configOption = getOption(args, '--config');
  const configPath = configOption
    ? path.resolve(configOption)
    : await findDefaultConfigPath();
  const config = await loadConfig(configPath, getOption(args, '--client-id'));
  const client = new Client({ clientId: config.clientId, clientSecret: config.clientSecret });
  let gatewayStatus: DiscordStatus | null = null;
  let gatewayActivity: DiscordActivity | null = null;
  let gateway: GatewayClient | undefined;
  const gatewayEnabled = Boolean(config.gatewayBotToken && config.gatewayUserId);
  const statusPort = Number(process.env.DISCORD_PRESENCE_PORT ?? DEFAULT_STATUS_PORT);
  let presenceStatus: DiscordStatus = 'offline';
  let discordProfile: DiscordProfile | null = null;
  const statusServer = startStatusServer(
    statusPort,
    () => gatewayEnabled ? (gatewayStatus ?? (client.isConnected ? presenceStatus : 'offline')) : (client.isConnected ? presenceStatus : 'offline'),
    () => client.isConnected ? discordProfile : null,
    () => gatewayActivity,
  );
  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await client.destroy();
    } finally {
      statusServer.close();
      console.log('Discord Rich Presence stopped.');
    }
  };

  process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

  client.on('ready', () => {
    presenceStatus = normalizeStatus(client.user?.presence?.status);
    if (client.user) {
      void client.user.fetchUser(client.user.id).then((user) => {
        const banner = (user as typeof user & { banner?: string | null }).banner;
        discordProfile = {
          username: user.username,
          avatarUrl: user.avatarUrl,
          ...(banner
            ? { bannerUrl: `https://cdn.discordapp.com/banners/${user.id}/${banner}.png?size=512` }
            : {}),
        };
      }).catch((error: Error) => {
        console.error(`Could not load authorized Discord profile: ${error.message}`);
      });
    }
    client.user?.setActivity(createActivity(config));
    void client.subscribe('CURRENT_USER_UPDATE').catch((error: Error) => {
      console.error(`Discord status updates unavailable: ${error.message}`);
    });
    console.log(`Discord Rich Presence active: ${config.details} — ${config.state}`);
    publishStatus();
  });
  client.on('CURRENT_USER_UPDATE', (data) => {
    const update = data as { presence?: { status?: string }; status?: string };
    presenceStatus = normalizeStatus(update.presence?.status ?? update.status);
    publishStatus();
  });
  client.on('disconnected', () => {
    presenceStatus = 'offline';
    discordProfile = null;
    publishStatus();
  });
  client.on('error', (error) => {
    console.error(`Discord RPC error: ${(error as Error).message}`);
  });

  if (config.gatewayBotToken && config.gatewayUserId) {
    gateway = new GatewayClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences] });
    gateway.once(Events.ClientReady, () => {
      console.log('Discord Gateway presence watcher active.');
      void gateway!.users.fetch(config.gatewayUserId!).then((user) => {
        discordProfile = {
          username: user.username,
          avatarUrl: user.displayAvatarURL({ extension: 'png', size: 512 }),
        };
        publishStatus();
      }).catch((error: Error) => {
        console.error(`Could not load Discord profile: ${error.message}`);
      });
      for (const guild of gateway!.guilds.cache.values()) {
        const presence = guild.presences.cache.get(config.gatewayUserId!);
        if (presence) {
          gatewayStatus = normalizeStatus(presence.status);
          console.log(`Discord Gateway initial status: ${gatewayStatus}`);
          break;
        }
      }
    });
    gateway.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
      if (newPresence.userId !== config.gatewayUserId) return;
      gatewayStatus = normalizeStatus(newPresence.status);
      const listeningActivity = newPresence.activities.find((activity) => activity.type === 2 || activity.name.toLowerCase() === 'spotify');
      gatewayActivity = listeningActivity
        ? {
            name: listeningActivity.name,
            details: listeningActivity.details ?? undefined,
            state: listeningActivity.state ?? undefined,
            ...(listeningActivity.syncId && listeningActivity.name.toLowerCase() === 'spotify'
              ? { trackUrl: `https://open.spotify.com/track/${listeningActivity.syncId}` }
              : {}),
            ...(listeningActivity.timestamps?.start ? { startedAt: listeningActivity.timestamps.start.getTime() } : {}),
            ...(listeningActivity.timestamps?.end ? { endsAt: listeningActivity.timestamps.end.getTime() } : {}),
          }
        : null;
      if (gatewayActivity && listeningActivity?.name.toLowerCase() === 'spotify') {
        const activity = gatewayActivity;
        void getSpotifyArtwork(listeningActivity.syncId ?? undefined).then((imageUrl) => {
          if (!gatewayActivity || gatewayActivity.details !== activity.details) return;
          gatewayActivity = imageUrl ? { ...activity, imageUrl } : activity;
          publishStatus();
        });
      }
      console.log(`Discord Gateway status: ${gatewayStatus}`);
      publishStatus();
    });
    gateway.login(config.gatewayBotToken).catch((error: Error) => {
      gatewayStatus = null;
      console.error(`Discord Gateway watcher failed: ${error.message}`);
    });
  }

  try {
    if (config.authorizeProfile) {
      await client.login({ scopes: ['identify', 'rpc'], prompt: 'consent', useRPCToken: true });
    } else {
      await client.login();
    }
  } catch (error) {
    await shutdown();
    throw new Error(
      `Could not connect to Discord. Make sure the Discord desktop app is running and IPC is enabled. ${(error as Error).message}`,
    );
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});