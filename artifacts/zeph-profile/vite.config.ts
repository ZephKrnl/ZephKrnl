import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

type DiscordSession = {
  username: string;
  avatarUrl: string;
  bannerUrl?: string;
  connections: unknown[];
};
type ViewRecord = {
  viewedAt: string;
  device: string;
  model: string;
  osVersion: string;
  browser: string;
  region: string;
  provider: string;
};
type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  deviceKey: string;
  createdAt: string;
  approved: boolean;
};
type SiteData = { totalViews: number; viewHistory: ViewRecord[]; guestbook: GuestbookEntry[] };

const dataDirectory = path.resolve(import.meta.dirname, '.data');
const dataFile = path.join(dataDirectory, 'site-data.json');

function loadSiteData(): SiteData {
  try {
    return JSON.parse(readFileSync(dataFile, 'utf8')) as SiteData;
  } catch {
    return { totalViews: 0, viewHistory: [], guestbook: [] };
  }
}

function saveSiteData(data: SiteData) {
  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

const discordSessions = new Map<string, DiscordSession>();
const discordStates = new Map<string, number>();
const viewVisitors = new Map<string, number>();
const siteData = loadSiteData();
const adminSessions = new Set<string>();
const profanityTerms = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot'];

function containsProfanity(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  return profanityTerms.some((term) => new RegExp(`(^|\\s)${term}(?=\\s|$)`, 'i').test(normalized));
}
const discordClientId = process.env.DISCORD_CLIENT_ID ?? '1550621385129467975';
const discordRedirectUri = process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:5173/api/discord/callback';

function getDiscordClientSecret() {
  if (process.env.DISCORD_CLIENT_SECRET) return process.env.DISCORD_CLIENT_SECRET;

  try {
    const configPath = path.resolve(import.meta.dirname, '..', '..', 'desktop', 'discord-presence', 'discord-presence.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { clientSecret?: string };
    return config.clientSecret;
  } catch {
    return undefined;
  }
}

function sendJson(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(data));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function getSessionId(request: IncomingMessage) {
  return request.headers.cookie?.match(/zeph_discord_session=([^;]+)/)?.[1];
}

function getVisitorKey(request: IncomingMessage) {
  const ip = getClientIp(request);
  const device = request.headers['user-agent'] ?? 'unknown-device';
  return createHash('sha256').update(`${ip}|${device}`).digest('hex');
}

function getClientIp(request: IncomingMessage) {
  const forwardedIp = request.headers['x-forwarded-for'];
  return typeof forwardedIp === 'string'
    ? forwardedIp.split(',')[0].trim()
    : String(request.headers['x-real-ip'] ?? request.socket.remoteAddress ?? 'unknown');
}

function getClientCategory(request: IncomingMessage) {
  const userAgent = request.headers['user-agent'] ?? '';
  const device = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop';
  const browser = /Edg\//i.test(userAgent) ? 'Edge' : /Chrome\//i.test(userAgent) ? 'Chrome' : /Firefox\//i.test(userAgent) ? 'Firefox' : /Safari\//i.test(userAgent) ? 'Safari' : 'browser';
  const os = /Windows/i.test(userAgent) ? 'Windows' : /Mac OS/i.test(userAgent) ? 'macOS' : /Android/i.test(userAgent) ? 'Android' : /iPhone|iPad/i.test(userAgent) ? 'iOS' : /Linux/i.test(userAgent) ? 'Linux' : 'other OS';
  return `${device} / ${os} / ${browser}`;
}

function getDeviceModel(request: IncomingMessage) {
  const userAgent = request.headers['user-agent'] ?? '';
  const clientHintModel = request.headers['sec-ch-ua-model'];
  if (typeof clientHintModel === 'string' && clientHintModel.trim() && clientHintModel !== '""') {
    return clientHintModel.replace(/^"|"$/g, '');
  }
  const androidModel = userAgent.match(/Android[^;)]*;\s*(?:[a-z]{2}-[A-Z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?[;)]/i)?.[1]?.trim();
  if (androidModel && !/^(wv|浏览器|linux|mobile)$/i.test(androidModel)) return androidModel;
  if (/iPad/i.test(userAgent)) return 'iPad (model hidden)';
  if (/iPhone/i.test(userAgent)) return 'iPhone (model hidden)';
  if (/iPod/i.test(userAgent)) return 'iPod (model hidden)';
  return 'unknown model';
}

function getOsVersion(request: IncomingMessage) {
  const userAgent = request.headers['user-agent'] ?? '';
  const android = userAgent.match(/Android\s([\d.]+)/i)?.[1];
  if (android) return `Android ${android}`;
  const ios = userAgent.match(/OS\s([\d_]+)\s+like Mac OS X/i)?.[1]?.replace(/_/g, '.');
  if (ios) return `iOS ${ios}`;
  if (/Windows NT/i.test(userAgent)) return 'Windows version hidden';
  if (/Mac OS X/i.test(userAgent)) return 'macOS version hidden';
  if (/Linux/i.test(userAgent)) return 'Linux version hidden';
  return 'version hidden';
}

function isPublicIp(ip: string) {
  return Boolean(ip) && ip !== 'unknown' && !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|fc|fd)/i.test(ip);
}

async function getNetworkDetails(request: IncomingMessage) {
  const headerRegion = request.headers['x-vercel-ip-country'] ?? request.headers['cf-ipcountry'];
  const headerProvider = request.headers['x-vercel-ip-asn'] ?? request.headers['x-isp'];
  const details = {
    region: String(headerRegion ?? 'unknown region'),
    provider: String(headerProvider ?? 'unknown provider'),
  };
  if (headerRegion || headerProvider) return details;

  const ip = getClientIp(request);
  const lookupUrl = isPublicIp(ip) ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/';
  try {
    const response = await fetch(lookupUrl, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return details;
    const data = (await response.json()) as {
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      connection?: { isp?: string; org?: string };
    };
    if (!data.success) return details;
    const location = [data.city, data.region, data.country].filter(Boolean).join(', ');
    return {
      region: location || details.region,
      provider: data.connection?.isp ?? data.connection?.org ?? details.provider,
    };
  } catch {
    return details;
  }
}

function isAdmin(request: IncomingMessage) {
  const session = request.headers.cookie?.match(/zeph_admin=([^;]+)/)?.[1];
  return Boolean(session && adminSessions.has(session));
}

function startDiscordPresence(server: {
  httpServer?: { once: (event: 'close', listener: () => void) => void };
}) {
  if (process.env.DISCORD_PRESENCE_AUTO_START === 'false') return;

  const companionDirectory = path.resolve(import.meta.dirname, '..', '..', 'desktop', 'discord-presence');
  const companionProcess = spawn(
    process.execPath,
    [path.join(companionDirectory, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(companionDirectory, 'src', 'index.ts')],
    {
      cwd: companionDirectory,
      env: { ...process.env, DISCORD_PRESENCE_PORT: process.env.DISCORD_PRESENCE_PORT ?? '8765' },
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  companionProcess.once('error', (error) => {
    console.error(`Could not start Discord Rich Presence: ${error.message}`);
  });
  server.httpServer?.once('close', () => {
    if (!companionProcess.killed) companionProcess.kill('SIGTERM');
  });
}

function discordOAuthPlugin() {
  return {
    name: 'zeph-discord-oauth',
    configureServer(server: { httpServer?: { once: (event: 'close', listener: () => void) => void }; middlewares: { use: (handler: (request: IncomingMessage & { url?: string }, response: ServerResponse, next: () => void) => void) => void } }) {
      startDiscordPresence(server);
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');

        if (url.pathname === '/api/admin/login' && request.method === 'POST') {
          const adminPassword = process.env.ADMIN_PASSWORD;
          if (!adminPassword) {
            sendJson(response, 503, { error: 'ADMIN_PASSWORD is not configured.' });
            return;
          }
          const body = JSON.parse(await readBody(request)) as { password?: string };
          if (body.password !== adminPassword) {
            sendJson(response, 401, { error: 'Invalid admin password.' });
            return;
          }
          const session = randomBytes(32).toString('hex');
          adminSessions.add(session);
          response.writeHead(204, { 'Set-Cookie': `zeph_admin=${session}; HttpOnly; SameSite=Strict; Path=/` });
          response.end();
          return;
        }

        if (url.pathname === '/api/admin/views' && request.method === 'GET') {
          if (!isAdmin(request)) {
            sendJson(response, 401, { error: 'Admin authentication required.' });
            return;
          }
          sendJson(response, 200, { total: siteData.totalViews, history: siteData.viewHistory.slice(-100).reverse() });
          return;
        }

        if (url.pathname === '/api/guestbook' && request.method === 'GET') {
          sendJson(response, 200, { entries: siteData.guestbook.filter((entry) => entry.approved).slice(-50) });
          return;
        }

        if (url.pathname === '/api/guestbook' && request.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(request)) as { name?: string; message?: string };
            const name = body.name?.trim().slice(0, 40);
            const message = body.message?.trim().slice(0, 280);
            if (!name || !message) {
              sendJson(response, 400, { error: 'Name and message are required.' });
              return;
            }
            const deviceKey = getVisitorKey(request);
            const cooldownStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recentNote = siteData.guestbook.find((entry) => entry.deviceKey === deviceKey && Date.parse(entry.createdAt) > cooldownStart);
            if (recentNote) {
              sendJson(response, 429, { error: 'You can leave one note per device every 7 days.' });
              return;
            }
            const approved = !containsProfanity(`${name} ${message}`);
            siteData.guestbook.push({ id: randomBytes(12).toString('hex'), name, message, deviceKey, createdAt: new Date().toISOString(), approved });
            saveSiteData(siteData);
            sendJson(response, approved ? 201 : 202, { message: approved ? 'Your note is live.' : 'Your note was held for approval.' });
          } catch {
            sendJson(response, 400, { error: 'Invalid guestbook submission.' });
          }
          return;
        }

        if (url.pathname === '/api/admin/guestbook' && request.method === 'GET') {
          if (!isAdmin(request)) {
            sendJson(response, 401, { error: 'Admin authentication required.' });
            return;
          }
          sendJson(response, 200, { entries: siteData.guestbook.slice().reverse() });
          return;
        }

        if (url.pathname === '/api/admin/guestbook' && request.method === 'PATCH') {
          if (!isAdmin(request)) {
            sendJson(response, 401, { error: 'Admin authentication required.' });
            return;
          }
          try {
            const body = JSON.parse(await readBody(request)) as { id?: string; approved?: boolean };
            const entry = siteData.guestbook.find((candidate) => candidate.id === body.id);
            if (!entry || typeof body.approved !== 'boolean') {
              sendJson(response, 404, { error: 'Guestbook entry not found.' });
              return;
            }
            entry.approved = body.approved;
            saveSiteData(siteData);
            sendJson(response, 200, { entry });
          } catch {
            sendJson(response, 400, { error: 'Invalid moderation request.' });
          }
          return;
        }

        if (url.pathname === '/api/admin/guestbook' && request.method === 'DELETE') {
          if (!isAdmin(request)) {
            sendJson(response, 401, { error: 'Admin authentication required.' });
            return;
          }
          try {
            const body = JSON.parse(await readBody(request)) as { id?: string };
            const entryIndex = siteData.guestbook.findIndex((candidate) => candidate.id === body.id);
            if (entryIndex < 0) {
              sendJson(response, 404, { error: 'Guestbook entry not found.' });
              return;
            }
            siteData.guestbook.splice(entryIndex, 1);
            saveSiteData(siteData);
            response.writeHead(204).end();
          } catch {
            sendJson(response, 400, { error: 'Invalid delete request.' });
          }
          return;
        }

        if (url.pathname === '/api/views' && request.method === 'POST') {
          response.setHeader('Accept-CH', 'Sec-CH-UA-Model');
          const visitorKey = getVisitorKey(request);
          const now = Date.now();
          const lastView = viewVisitors.get(visitorKey);
          if (!lastView || now - lastView >= 24 * 60 * 60 * 1000) {
            viewVisitors.set(visitorKey, now);
            const network = await getNetworkDetails(request);
            siteData.totalViews += 1;
            siteData.viewHistory.push({
              viewedAt: new Date(now).toISOString(),
              device: getClientCategory(request),
              model: getDeviceModel(request),
              osVersion: getOsVersion(request),
              region: network.region,
              provider: network.provider,
              browser: 'approximate',
            });
            saveSiteData(siteData);
          }
          sendJson(response, 200, { views: siteData.totalViews });
          return;
        }

        if (url.pathname === '/api/discord/login') {
          const state = randomBytes(24).toString('hex');
          discordStates.set(state, Date.now());
          response.writeHead(302, {
            Location: `https://discord.com/oauth2/authorize?client_id=${discordClientId}&response_type=code&redirect_uri=${encodeURIComponent(discordRedirectUri)}&scope=identify%20connections&state=${state}`,
          });
          response.end();
          return;
        }

        if (url.pathname === '/api/discord/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const stateCreatedAt = state ? discordStates.get(state) : undefined;
          discordStates.delete(state ?? '');
          if (!stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60 * 1000) {
            sendJson(response, 400, { error: 'Discord authorization state is invalid or expired.' });
            return;
          }
          if (!code) {
            sendJson(response, 400, { error: 'Discord authorization code is missing.' });
            return;
          }
          const secret = getDiscordClientSecret();
          if (!secret) {
            sendJson(response, 500, { error: 'Discord Client Secret is not configured locally.' });
            return;
          }

          const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: discordClientId,
              client_secret: secret,
              grant_type: 'authorization_code',
              code,
              redirect_uri: discordRedirectUri,
            }),
          });
          if (!tokenResponse.ok) {
            sendJson(response, 502, { error: 'Discord token exchange failed.' });
            return;
          }

          const token = (await tokenResponse.json()) as { access_token: string };
          const headers = { Authorization: `Bearer ${token.access_token}` };
          const [userResponse, connectionsResponse] = await Promise.all([
            fetch('https://discord.com/api/users/@me', { headers }),
            fetch('https://discord.com/api/users/@me/connections', { headers }),
          ]);
          const user = (await userResponse.json()) as { id: string; username: string; avatar: string | null; banner?: string | null };
          const connections = connectionsResponse.ok ? await connectionsResponse.json() : [];
          const sessionId = randomBytes(32).toString('hex');
          discordSessions.set(sessionId, {
            username: user.username,
            avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256` : `https://cdn.discordapp.com/embed/avatars/0.png`,
            ...(user.banner ? { bannerUrl: `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=512` } : {}),
            connections,
          });
          response.writeHead(302, {
            Location: '/',
            'Set-Cookie': `zeph_discord_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/`,
          });
          response.end();
          return;
        }

        if (url.pathname === '/api/discord/profile') {
          sendJson(response, 200, { profile: discordSessions.get(getSessionId(request) ?? '') ?? null });
          return;
        }

        next();
      });
    },
  };
}

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    discordOAuthPlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
