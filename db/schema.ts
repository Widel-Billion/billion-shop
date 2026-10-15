// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const products=sqliteTable('products',{id:text('id').primaryKey(),data:text('data').notNull(),stock:integer('stock').notNull()},t=>[check('stock_nonnegative',sql`${t.stock} >= 0`)]);
export const records=sqliteTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),owner:text('owner').notNull(),data:text('data').notNull()});
