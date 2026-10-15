import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const signin=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'});
const cookie=signin.headers.get('set-cookie')?.split(';')[0]||'';
async function get(auth=true){const r=await fetch(base+'/api/shop',{headers:auth?{cookie}:{}});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
async function post(body,auth=true,origin=base){const r=await fetch(base+'/api/shop',{method:'POST',headers:{'content-type':'application/json',origin,...(auth?{cookie}:{})},body:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:r.status,data};}
const initial=await get();assert.equal(initial.admin,true,'Local ADMIN_EMAIL must be seedy@sites.test');
const id='qa-'+Date.now(),product={...initial.products[0],id,name:'QA — produit de validation',stock:3,price:50,colors:['Sable','Noir'],sizes:['S','M']};
assert.equal((await post({action:'product',product},false)).status,403);console.log('PASS unauthorized admin rejected');
assert.equal((await post({action:'product',product},true,'https://other.example')).status,403);console.log('PASS foreign origin rejected');
assert.equal((await post({action:'product',product})).status,200);
assert((await get(false)).products.some(p=>p.id===id));console.log('PASS create product and public catalog');
const customer={name:'Client Test',email:'test@example.test',phone:'0000000000',address:'Adresse de démonstration 01',city:'Ville Test'},items=[{id,size:'M',color:'Noir',qty:2}];
assert.equal((await post({action:'order',customer,items:[{...items[0],size:'XXL'}]})).status,409);console.log('PASS invalid variant rejected');
assert.equal((await post({action:'order',customer,items,coupon:'INVALID'})).status,400);console.log('PASS invalid coupon rejected');
const aggregate=await post({action:'order',customer,items:[{id,size:'S',color:'Sable',qty:2},{id,size:'M',color:'Noir',qty:2}]});assert.equal(aggregate.status,409);assert.equal((await get()).products.find(p=>p.id===id).stock,3);console.log('PASS aggregate stock guard and transaction rollback');
const checkout=await post({action:'order',customer,items,coupon:initial.settings.coupon});assert.equal(checkout.status,201,JSON.stringify(checkout.data));
const order=checkout.data.order;assert.equal(order.subtotal,100);assert.equal(order.discount,100*initial.settings.discount/100);assert.equal(order.total,100-order.discount+initial.settings.shipping);assert.match(order.payment,/En attente/);assert.equal(order.items[0].size,'M');assert.equal(order.items[0].color,'Noir');console.log('PASS checkout, coupon, exact variant, pending payment');
const after=await get();assert.equal(after.products.find(p=>p.id===id).stock,1);assert(after.orders.some(o=>o.id===order.id));console.log('PASS stock decrement and admin order list');
assert.equal((await post({action:'order',customer,items})).status,409);assert.equal((await get()).products.find(p=>p.id===id).stock,1);console.log('PASS overselling prevented');
assert.equal((await post({action:'status',id:order.id,status:'Confirmée',notes:'Internal QA note',tracking:'TEST-01'})).status,200);
const updated=await get();assert.equal(updated.orders.find(o=>o.id===order.id).status,'Confirmée');assert.equal(updated.orders.find(o=>o.id===order.id).history.length,2);console.log('PASS order status and history');
assert.equal((await get(false)).orders.length,0);console.log('PASS anonymous cannot read orders');
const changed={...initial.settings,subtitle:'Prévisualisation de validation QA'};assert.equal((await post({action:'settings',settings:changed})).status,200);assert.equal((await get(false)).settings.subtitle,changed.subtitle);assert.equal((await post({action:'settings',settings:initial.settings})).status,200);console.log('PASS homepage changes and restoration');
assert.equal((await post({action:'newsletter',email:'qa@example.test',consent:false})).status,400);assert.equal((await post({action:'newsletter',email:'qa@example.test',consent:true})).status,200);console.log('PASS newsletter consent');
await post({action:'product',product:{...product,stock:1,published:false}});assert(!(await get(false)).products.some(p=>p.id===id));console.log('PASS archive product');
console.log('ALL API CHECKS PASSED');


