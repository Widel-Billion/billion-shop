import assert from 'node:assert/strict';
import fs from 'node:fs';import ts from 'typescript';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'}),cookie=login.headers.get('set-cookie')?.split(';')[0]||'';
async function get(auth=true){const r=await fetch(base+'/api/shop',{headers:auth?{cookie}:{}});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d}
async function post(body,auth=true){const r=await fetch(base+'/api/shop',{method:'POST',headers:{'content-type':'application/json',origin:base,...(auth?{cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
const initial=await get();assert(initial.admin);const again=await get();assert.equal(initial.products[0].price,again.products[0].price,'demo price migration must be idempotent');
const id='qa-pickup-'+Date.now(),product={...initial.products[0],id,name:'QA retrait gourdes',price:2500,oldPrice:undefined,sizes:['Unique'],colors:['Noir'],variants:[{size:'Unique',color:'Noir',stock:2,version:0}],archivedVariants:undefined,stock:2,published:true};
assert.equal((await post({action:'product',product})).status,200);
assert.equal((await post({action:'visibility',id,published:false},false)).status,403);
assert.equal((await post({action:'delete-product',id},false)).status,403);
assert.equal((await post({action:'visibility',id,published:false})).status,200);assert(!(await get(false)).products.some(p=>p.id===id));assert((await get()).products.some(p=>p.id===id&&!p.published));
const customer={name:'Client QA',email:'qa@example.test',phone:'00000000'},items=[{id,size:'Unique',color:'Noir',qty:1}];
assert.equal((await post({action:'order',customer,items})).status,409);
assert.equal((await post({action:'visibility',id,published:true})).status,200);
const response=await post({action:'order',customer,items});assert.equal(response.status,201,JSON.stringify(response));const order=response.data.order;assert.equal(order.currency,'HTG');assert.equal(order.total,2500);assert.equal(order.shipping,0);assert.match(order.payment,/retrait/);assert.equal(order.customer.address,'Retrait sur place');
assert.equal((await post({action:'status',id:order.id,status:'Nouvelle',paid:true})).status,400);
for(const status of ['Confirmée','En préparation','Prête pour retrait','Retirée'])assert.equal((await post({action:'status',id:order.id,status,paid:status==='Retirée'})).status,200,status);
const received=(await get()).orders.find(o=>o.id===order.id);assert(received.paidAt);assert.match(received.payment,/Reçu/);
assert.equal((await post({action:'status',id:order.id,status:'Retirée',paid:true})).status,200);assert.equal((await get()).orders.find(o=>o.id===order.id).paidAt,received.paidAt);
assert.equal((await post({action:'delete-product',id})).status,200);assert(!(await get()).products.some(p=>p.id===id));assert(!(await get(false)).products.some(p=>p.id===id));assert((await get()).orders.find(o=>o.id===order.id).items.some(i=>i.name==='QA retrait gourdes'));
assert.equal((await post({action:'product',product})).status,404);
await post({action:'status',id:order.id,status:'Retournée'});
console.log('PASS demo gourde prices idempotent, product hide/show/delete authorized, deleted product not resurrected, historical orders retained, pickup with no card or shipping, receipt recorded once');
const source=ts.transpileModule(fs.readFileSync('lib/analytics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;const {localDay,salesSeries,range}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(localDay('2026-10-19T02:00:00Z'),'2026-10-18');assert.deepEqual(range('2026-10-18','week'),{from:'2026-10-12',to:'2026-10-18'});
const orders=[{currency:'HTG',paidAt:'2026-10-19T02:00:00Z',total:2500,status:'Retirée'},{currency:'HTG',paidAt:'2026-10-19T02:00:00Z',total:700,status:'Retournée'},{currency:'USD',paidAt:'2026-10-19T02:00:00Z',total:100,status:'Retirée'},{currency:'HTG',total:900,status:'Nouvelle'}];
for(const p of ['day','week','month'])assert.equal(salesSeries(orders,'2026-10-18',p).total,2500);assert.equal(salesSeries(orders,'2026-10-19','day').total,0);assert.equal(salesSeries(orders,'2026-10-18','day').data.find(d=>d.key==='22').amount,2500);
assert.equal(salesSeries([], '2026-02-10','month').data.length,28);console.log('PASS calendar, Haiti timezone, day/week/month totals, pending/refunded/USD orders excluded');
