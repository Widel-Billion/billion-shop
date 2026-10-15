// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const products=sqliteTable('products',{id:text('id').primaryKey(),data:text('data').notNull(),stock:integer('stock').notNull()},t=>[check('stock_nonnegative',sql`${t.stock} >= 0`)]);
export const records=sqliteTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),owner:text('owner').notNull(),data:text('data').notNull()});

export const inventory=sqliteTable('inventory',{
 id:text('id').primaryKey(),
 productId:text('product_id').notNull().references(()=>products.id),
 size:text('size').notNull(),color:text('color').notNull(),
 stock:integer('stock').notNull(),version:integer('version').notNull().default(0),
 active:integer('active').notNull().default(1),
},t=>[check('variant_stock_nonnegative',sql`${t.stock} >= 0`)]);
export const movements=sqliteTable('stock_movements',{
 id:text('id').primaryKey(),variantId:text('variant_id').notNull().references(()=>inventory.id),
 delta:integer('delta').notNull(),reason:text('reason').notNull(),
 created:text('created').notNull(),actor:text('actor').notNull(),orderId:text('order_id'),
});
