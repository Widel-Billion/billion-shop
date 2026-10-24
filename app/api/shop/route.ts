import {env} from 'cloudflare:workers';
import {admin,identity} from '@/lib/shop-auth';
import {imagePathPattern} from '@/lib/product-images';
import {z} from 'zod';
import {totals,type Order} from '@/lib/catalog';
import {transitions,variantStock} from '@/lib/inventory';
import {database,getProducts,getSettings,saveRecord,saveProduct,reserveOrder,updateOrder,ShopError} from '@/lib/shop-db';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const option=z.string().trim().min(1).max(50);
const options=z.array(option).min(1).max(30).refine(values=>new Set(values).size===values.length,'Options dupliquées');
const productSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(150),category:option,price:z.number().min(0).max(100000),oldPrice:z.number().min(0).optional(),image:z.union([z.string().url().refine(v=>v.startsWith('https://')),z.string().regex(imagePathPattern)]),colors:options,sizes:options,stock:z.number().int().min(0),published:z.boolean(),description:z.string().max(5000),badge:z.string().max(30).optional(),variants:z.array(z.object({size:option,color:option,stock:z.number().int().min(0).max(100000),version:z.number().int().min(0)})).min(1).max(300).optional()});
const settingsSchema=z.object({announcement:z.string().max(300),title:z.string().min(1).max(100),subtitle:z.string().max(300),hero:z.union([z.enum(['/images/billion-neon-sneakers-source.jpeg','/images/billion-editorial-first.png']),z.string().url().refine(v=>v.startsWith('https://'))]),logo:z.string().min(1).max(50),accent:z.string().regex(/^#[0-9a-f]{6}$/i),rate:z.number().min(0).max(10000),shipping:z.number().min(0),freeShipping:z.number().min(0),coupon:z.string().min(1).max(30),discount:z.number().min(0).max(100),categories:options,contact:z.string().max(200)});
const orderSchema=z.object({customer:z.object({name:z.string().trim().min(2).max(100),email:z.string().email().max(200),address:z.string().trim().min(5).max(300).default('Retrait sur place'),city:z.string().trim().min(2).max(100).default('Retrait sur place'),phone:z.string().min(6).max(30)}),items:z.array(z.object({id:z.string().max(100),size:option,color:option,qty:z.number().int().min(1).max(99)})).min(1).max(50),coupon:z.string().max(30).default('')});
const statusSchema=z.object({id:z.string().max(100),status:z.string(),tracking:z.string().max(300).default(''),notes:z.string().max(2000).default(''),paid:z.boolean().optional()});
function fail(e:unknown){if(e instanceof z.ZodError)return json({error:'Veuillez vérifier les champs du formulaire et les variantes.'},400);if(e instanceof ShopError)return json({error:e.message},e.status);return json({error:'Le stock ou la commande a changé. Rechargez les données avant de réessayer.'},409);}
export async function GET(r:Request){
 try{const db=await database(),isAdmin=admin(r),owner=identity(r);
  const stmt=isAdmin?db.prepare("SELECT data FROM records WHERE kind='order' ORDER BY rowid DESC"):db.prepare("SELECT data FROM records WHERE kind='order' AND owner=? ORDER BY rowid DESC").bind(owner||'none');
  const rows=await stmt.all<{data:string}>();
  const movements=isAdmin?(await db.prepare('SELECT m.*,i.product_id,i.size,i.color FROM stock_movements m JOIN inventory i ON i.id=m.variant_id ORDER BY m.rowid DESC LIMIT 100').all()).results:[];
  return json({products:(await getProducts(db)).filter(p=>isAdmin||p.published).map(p=>{if(!isAdmin)delete p.archivedVariants;return p;}),settings:await getSettings(db),orders:rows.results.map(v=>{const order=JSON.parse(v.data);if(!isAdmin)delete order.notes;return order;}),movements,admin:isAdmin,user:owner?{id:owner,email:r.headers.get('oai-authenticated-user-email')||''}:null});
 }catch{return json({error:'Le service est temporairement indisponible. Réessayez dans un instant.'},503);}
}
export async function POST(r:Request){
 try{
  if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Origine non autorisée.'},403);
  const b=await r.json() as Record<string,unknown>;
  const owner=identity(r);
  if(['product','settings','status','visibility','delete-product'].includes(String(b.action))&&!admin(r))return json({error:'Accès administrateur requis.'},403);
  const db=await database();
  if(b.action==='visibility'||b.action==='delete-product'){
   const id=z.string().min(1).max(100).parse(b.id);const row=await db.prepare("SELECT data FROM products WHERE id=?").bind(id).first<{data:string}>();if(!row||JSON.parse(row.data).deleted)return json({error:'Produit introuvable.'},404);
   if(b.action==='delete-product')await db.prepare("UPDATE products SET data=json_set(data,'$.published',json('false'),'$.deleted',json('true')) WHERE id=?").bind(id).run();
   else await db.prepare("UPDATE products SET data=json_set(data,'$.published',json(?)) WHERE id=?").bind(JSON.stringify(z.boolean().parse(b.published)),id).run();
   return json({ok:true});
  }
  if(b.action==='product'){const product=productSchema.parse(b.product);if(product.image.startsWith('/api/product-images/')){const key=product.image.slice('/api/product-images/'.length);if(!env.BUCKET||!await env.BUCKET.head('products/'+key))return json({error:'La photo est introuvable. Importez-la à nouveau.'},400);}await saveProduct(db,product,owner);return json({ok:true});}
  if(b.action==='settings'){await saveRecord(db,'settings','settings','admin',settingsSchema.parse(b.settings)).run();return json({ok:true});}
  if(b.action==='status'){
   const input=statusSchema.parse(b),row=await db.prepare("SELECT data FROM records WHERE id=? AND kind='order'").bind(input.id).first<{data:string}>();
   if(!row)return json({error:'Commande introuvable.'},404);
   const order:Order=JSON.parse(row.data);
   if(input.status!==order.status&&!(transitions[order.status]||[]).includes(input.status))throw new ShopError('Ce changement de statut n’est pas autorisé.',400);
   const changed=order.status!==input.status;
   const release=changed&&!order.stockReleased&&['Annulée','Retournée'].includes(input.status);
   if(input.paid&&!order.paidAt){if(input.status!=='Retirée')throw new ShopError('Confirmez le retrait avant de confirmer l’encaissement.',400);order.paidAt=new Date().toISOString();order.payment='Reçu au retrait sur place';}
   order.status=input.status;order.tracking=input.tracking;order.notes=input.notes;
   if(changed)order.history.push({status:input.status,date:new Date().toISOString()});
   if(release)order.stockReleased=true;
   await updateOrder(db,row.data,order,release,owner);return json({ok:true});
  }
  if(b.action==='newsletter'){
   const email=z.string().email().max(200).parse(b.email);
   if(b.consent!==true)return json({error:'Votre consentement est nécessaire.'},400);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.toLowerCase())))).map(v=>v.toString(16).padStart(2,'0')).join('');
   await saveRecord(db,'newsletter-'+digest,'newsletter',owner,{email,consent:true,date:new Date().toISOString()}).run();return json({ok:true});
  }
  if(b.action==='order'){
   const input=orderSchema.parse(b),catalog=await getProducts(db);
   const items=input.items.map(i=>{const p=catalog.find(p=>p.id===i.id&&p.published);if(!p||variantStock(p,i.size,i.color)<i.qty)throw new ShopError('Cette variante n’est plus disponible dans la quantité souhaitée.');return {...i,name:p.name,price:p.price};});
   const config=await getSettings(db);
   if(input.coupon&&input.coupon.trim().toUpperCase()!==config.coupon.toUpperCase())return json({error:'Code promotionnel invalide.'},400);
   const date=new Date().toISOString();
   const order:Order={id:'BS-'+crypto.randomUUID().slice(0,8).toUpperCase(),created:date,owner:owner||'guest-'+crypto.randomUUID(),customer:input.customer,items,...totals(items,config,input.coupon),status:'Nouvelle',currency:'HTG',payment:'À régler au retrait sur place',history:[{status:'Nouvelle',date}],stockReleased:false};
   await reserveOrder(db,order);return json({order},201);
  }
  return json({error:'Action inconnue.'},400);
 }catch(e){return fail(e);}
}


