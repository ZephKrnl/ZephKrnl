import { boolean, index, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const viewRecords = pgTable(
	"view_records",
	{
		id: serial("id").primaryKey(),
		viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
		visitorKey: varchar("visitor_key", { length: 64 }).notNull(),
		device: varchar("device", { length: 120 }).notNull(),
		model: varchar("model", { length: 120 }).notNull(),
		osVersion: varchar("os_version", { length: 80 }).notNull(),
		browser: varchar("browser", { length: 80 }).notNull(),
		region: varchar("region", { length: 180 }).notNull(),
		provider: varchar("provider", { length: 180 }).notNull(),
	},
	(table) => [index("view_records_visitor_key_idx").on(table.visitorKey), index("view_records_viewed_at_idx").on(table.viewedAt)],
);

export const guestbookEntries = pgTable(
	"guestbook_entries",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 40 }).notNull(),
		message: varchar("message", { length: 280 }).notNull(),
		deviceKey: varchar("device_key", { length: 64 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		approved: boolean("approved").default(false).notNull(),
	},
	(table) => [index("guestbook_device_key_idx").on(table.deviceKey), index("guestbook_created_at_idx").on(table.createdAt)],
);