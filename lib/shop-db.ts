import {env} from 'cloudflare:workers';
import {seed,defaults,currentCampaign,type Product,type Settings,type Order} from './catalog';
import {distributeStock,variantKey,type Variant} from './inventory';
export class ShopError extends Error {constructor(message:string,public status=409){super(message);}}
type InventoryRow={id:string;product_id:string;size:string;color:string;stock:number;version:number;active:number};
export async function database(){
 const db=env.DB;if(!db)throw new ShopError('Base indisponible.',503);
 await db.batch(seed.map(p=>db.prepare('INSERT OR IGNORE INTO products(id,data,stock) VALUES(?,?,?)').bind(p.id,JSON.stringify(p),p.stock)));
 await db.prepare("UPDATE products SET data=json_set(data,'$.image',?) WHERE id='veste' AND json_extract(data,'$.image')=?").bind(seed.find(p=>p.id==='veste')!.image,'https://images.unsplash.com/photo-1548624149-f322eea883ca?auto=format&fit=crop&w=1100&q=85').run();
 // Backfill idempotent du catalogue existant, en conservant la quantité totale restante.
 const missing=await db.prepare('SELECT id,data,stock FROM products p WHERE NOT EXISTS(SELECT 1 FROM inventory i WHERE i.product_id=p.id)').all<{id:string;data:string;stock:number}>();
 for(const row of missing.results){const p:Product=JSON.parse(row.data);await db.batch(distributeStock(p.sizes,p.colors,row.stock).map(v=>db.prepare('INSERT OR IGNORE INTO inventory(id,product_id,size,color,stock,version,active) VALUES(?,?,?,?,?,0,1)').bind(variantKey(p.id,v.size,v.color),p.id,v.size,v.color,v.stock)));}
 return db;
}
export async function getSettings(db:D1Database):Promise<Settings>{const row=await db.prepare("SELECT data FROM records WHERE id='settings'").first<{data:string}>();return currentCampaign(row?JSON.parse(row.data):defaults);}
export async function getProducts(db:D1Database):Promise<Product[]>{
 const [rows,inventory]=await Promise.all([db.prepare('SELECT id,data FROM products').all<{id:string;data:string}>(),db.prepare('SELECT * FROM inventory').all<InventoryRow>()]);
 return rows.results.map(r=>{const variants=inventory.results.filter(v=>v.product_id===r.id&&v.active===1).map(({size,color,stock,version})=>({size,color,stock,version}));return {...JSON.parse(r.data),stock:variants.reduce((a,v)=>a+v.stock,0),variants,archivedVariants:inventory.results.filter(v=>v.product_id===r.id&&v.active===0).map(({size,color,stock,version})=>({size,color,stock,version}))};});
}
export function saveRecord(db:D1Database,id:string,kind:string,owner:string,data:unknown){return db.prepare('INSERT INTO records(id,kind,owner,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id,kind,owner,JSON.stringify(data));}
export function stockTotal(db:D1Database,id:string){return db.prepare('UPDATE products SET stock=(SELECT COALESCE(SUM(stock),0) FROM inventory WHERE product_id=? AND active=1) WHERE id=?').bind(id,id);}
export function movement(db:D1Database,id:string,delta:number,reason:string,actor:string,orderId:string|null=null){return db.prepare('INSERT INTO stock_movements(id,variant_id,delta,reason,created,actor,order_id) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,delta,reason,new Date().toISOString(),actor,orderId);}
export async function saveProduct(db:D1Database,p:Product,actor:string){
 const existing=await db.prepare('SELECT * FROM inventory WHERE product_id=?').bind(p.id).all<InventoryRow>();
 if(existing.results.some(v=>v.active)&&!p.variants)throw new ShopError('Rechargez le produit avant de modifier les stocks.');
 const variants=p.variants||distributeStock(p.sizes,p.colors,p.stock);
 const keys=new Set(variants.map(v=>variantKey(p.id,v.size,v.color)));
 if(variants.length!==p.sizes.length*p.colors.length||keys.size!==variants.length||variants.some(v=>!p.sizes.includes(v.size)||!p.colors.includes(v.color)))throw new ShopError('Renseignez un stock pour chaque combinaison de taille et couleur.',400);
 const removed=existing.results.filter(v=>v.active&&!keys.has(v.id));
 if(removed.some(v=>v.stock>0))throw new ShopError('Mettez à zéro le stock des variantes à retirer avant de modifier leurs tailles ou couleurs.',400);
 const total=variants.reduce((a,v)=>a+v.stock,0);
 const {variants:_,archivedVariants:__,...metadata}=p;
 const statements:D1PreparedStatement[]=[db.prepare('INSERT INTO products(id,data,stock) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,stock=excluded.stock').bind(p.id,JSON.stringify({...metadata,stock:total}),total)];
 for(const v of variants){const id=variantKey(p.id,v.size,v.color),old=existing.results.find(v=>v.id===id);
  if(old){if(old.active&&old.version!==v.version)throw new ShopError('Le stock a changé pendant votre édition. Rechargez le produit pour conserver les dernières ventes.');statements.push(db.prepare('UPDATE inventory SET stock=CASE WHEN version=? THEN ? ELSE -1 END,active=1,version=version+1 WHERE id=?').bind(old.version,v.stock,id));}
  else statements.push(db.prepare('INSERT INTO inventory(id,product_id,size,color,stock,version,active) VALUES(?,?,?,?,?,0,1)').bind(id,p.id,v.size,v.color,v.stock));
  if(!old||old.stock!==v.stock)statements.push(movement(db,id,v.stock-(old?.stock||0),'Ajustement administrateur',actor));
 }
 for(const old of removed)statements.push(db.prepare('UPDATE inventory SET stock=CASE WHEN version=? THEN stock ELSE -1 END,active=0,version=version+1 WHERE id=?').bind(old.version,old.id));
 await db.batch(statements);
}
export async function reserveOrder(db:D1Database,order:Order){
 const statements:D1PreparedStatement[]=[];
 for(const id of new Set(order.items.map(i=>i.id)))statements.push(db.prepare("UPDATE products SET stock=CASE WHEN json_extract(data,'$.published')=1 THEN stock ELSE -1 END WHERE id=?").bind(id));
 for(const i of order.items){const id=variantKey(i.id,i.size,i.color);statements.push(db.prepare('UPDATE inventory SET stock=CASE WHEN active=1 THEN stock-? ELSE -1 END,version=version+1 WHERE id=?').bind(i.qty,id),movement(db,id,-i.qty,'Commande',order.owner,order.id));}
 for(const id of new Set(order.items.map(i=>i.id)))statements.push(stockTotal(db,id));
 statements.push(db.prepare("INSERT INTO records(id,kind,owner,data) VALUES(?,'order',?,?)").bind(order.id,order.owner,JSON.stringify(order)));
 await db.batch(statements);
}
export async function updateOrder(db:D1Database,oldData:string,order:Order,release:boolean,actor:string){
 const statements:D1PreparedStatement[]=[db.prepare('UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=?').bind(oldData,JSON.stringify(order),order.id)];
 if(release){for(const i of order.items){const id=variantKey(i.id,i.size,i.color);statements.push(db.prepare('UPDATE inventory SET stock=stock+?,version=version+1 WHERE id=?').bind(i.qty,id),movement(db,id,i.qty,'Réintégration — '+order.status,actor,order.id));}for(const id of new Set(order.items.map(i=>i.id)))statements.push(stockTotal(db,id));}
 await db.batch(statements);
}


