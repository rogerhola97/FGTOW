import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city").notNull(),
  productType: text("product_type").notNull(),
  budget: text("budget"),
  message: text("message").notNull(),
  consent: integer("consent", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull().default("website"),
  status: text("status").notNull().default("new"),
});
