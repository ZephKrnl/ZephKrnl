import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { Router } from "express";
import { db } from "@workspace/db";
import { guestbookEntries, viewRecords } from "@workspace/db/schema";

const router = Router();
const adminSessions = new Set<string>();
const cooldownMs = 7 * 24 * 60 * 60 * 1000;
const profanityTerms = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot'];

function containsProfanity(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return profanityTerms.some((term) => new RegExp(`(^|\\s)${term}(?=\\s|$)`, "i").test(normalized));
}

type RequestLike = { headers: Record<string, string | string[] | undefined>; ip?: string };

function header(request: RequestLike, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getClientIp(request: RequestLike) {
  return header(request, "x-forwarded-for").split(",")[0].trim() || header(request, "x-real-ip") || request.ip || "unknown";
}

function getDeviceKey(request: RequestLike) {
  return createHash("sha256").update(`${getClientIp(request)}|${header(request, "user-agent") || "unknown-device"}`).digest("hex");
}

function getDevice(request: RequestLike) {
  const userAgent = header(request, "user-agent");
  const type = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? "mobile" : "desktop";
  const browser = /Edg\//i.test(userAgent) ? "Edge" : /Chrome\//i.test(userAgent) ? "Chrome" : /Firefox\//i.test(userAgent) ? "Firefox" : /Safari\//i.test(userAgent) ? "Safari" : "browser";
  const os = /Windows/i.test(userAgent) ? "Windows" : /Mac OS/i.test(userAgent) ? "macOS" : /Android/i.test(userAgent) ? "Android" : /iPhone|iPad/i.test(userAgent) ? "iOS" : /Linux/i.test(userAgent) ? "Linux" : "other OS";
  return `${type} / ${os} / ${browser}`;
}

function isAdmin(request: { headers: Record<string, string | string[] | undefined> }) {
  const cookie = header(request, "cookie").match(/zeph_admin=([^;]+)/)?.[1];
  return Boolean(cookie && adminSessions.has(cookie));
}

function requireAdmin(request: Parameters<typeof isAdmin>[0], response: { status: (status: number) => { json: (data: unknown) => unknown } }) {
  if (isAdmin(request)) return true;
  response.status(401).json({ error: "Admin authentication required." });
  return false;
}

router.post("/admin/login", (request, response) => {
  if (!process.env.ADMIN_PASSWORD || request.body?.password !== process.env.ADMIN_PASSWORD) {
    response.status(401).json({ error: "Invalid admin password." });
    return;
  }
  const session = randomBytes(32).toString("hex");
  adminSessions.add(session);
  response.status(204).setHeader("Set-Cookie", `zeph_admin=${session}; HttpOnly; SameSite=Strict; Path=/`).end();
});

router.post("/views", async (request, response, next) => {
  try {
    const visitorKey = getDeviceKey(request);
    const recent = await db.select({ id: viewRecords.id }).from(viewRecords).where(and(eq(viewRecords.visitorKey, visitorKey), gt(viewRecords.viewedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))).limit(1);
    if (recent.length === 0) {
      await db.insert(viewRecords).values({ visitorKey, device: getDevice(request), model: "unknown model", osVersion: "version hidden", browser: "approximate", region: "unknown region", provider: "unknown provider" });
    }
    const [{ total }] = await db.select({ total: count() }).from(viewRecords);
    response.json({ views: Number(total) });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/views", async (request, response, next) => {
  if (!requireAdmin(request, response)) return;
  try {
    const [{ total }] = await db.select({ total: count() }).from(viewRecords);
    const history = await db.select().from(viewRecords).orderBy(desc(viewRecords.viewedAt)).limit(100);
    response.json({ total: Number(total), history });
  } catch (error) {
    next(error);
  }
});

router.get("/guestbook", async (_request, response, next) => {
  try {
    const entries = await db.select().from(guestbookEntries).where(eq(guestbookEntries.approved, true)).orderBy(guestbookEntries.createdAt).limit(50);
    response.json({ entries });
  } catch (error) {
    next(error);
  }
});

router.post("/guestbook", async (request, response, next) => {
  try {
    const name = typeof request.body?.name === "string" ? request.body.name.trim().slice(0, 40) : "";
    const message = typeof request.body?.message === "string" ? request.body.message.trim().slice(0, 280) : "";
    if (!name || !message) {
      response.status(400).json({ error: "Name and message are required." });
      return;
    }
    const deviceKey = getDeviceKey(request);
    const recent = await db.select({ id: guestbookEntries.id }).from(guestbookEntries).where(and(eq(guestbookEntries.deviceKey, deviceKey), gt(guestbookEntries.createdAt, new Date(Date.now() - cooldownMs)))).limit(1);
    if (recent.length > 0) {
      response.status(429).json({ error: "You can leave one note per device every 7 days." });
      return;
    }
    const approved = !containsProfanity(`${name} ${message}`);
    await db.insert(guestbookEntries).values({ name, message, deviceKey, approved });
    response.status(approved ? 201 : 202).json({ message: approved ? "Your note is live." : "Your note was held for approval." });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/guestbook", async (request, response, next) => {
  if (!requireAdmin(request, response)) return;
  try {
    response.json({ entries: await db.select().from(guestbookEntries).orderBy(desc(guestbookEntries.createdAt)) });
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/guestbook", async (request, response, next) => {
  if (!requireAdmin(request, response)) return;
  try {
    const id = Number(request.body?.id);
    if (!Number.isInteger(id) || typeof request.body?.approved !== "boolean") {
      response.status(400).json({ error: "Invalid moderation request." });
      return;
    }
    const [entry] = await db.update(guestbookEntries).set({ approved: request.body.approved }).where(eq(guestbookEntries.id, id)).returning();
    if (!entry) {
      response.status(404).json({ error: "Guestbook entry not found." });
      return;
    }
    response.json({ entry });
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/guestbook", async (request, response, next) => {
  if (!requireAdmin(request, response)) return;
  try {
    const id = Number(request.body?.id);
    if (!Number.isInteger(id)) {
      response.status(400).json({ error: "Invalid delete request." });
      return;
    }
    const deleted = await db.delete(guestbookEntries).where(eq(guestbookEntries.id, id)).returning({ id: guestbookEntries.id });
    if (deleted.length === 0) {
      response.status(404).json({ error: "Guestbook entry not found." });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
