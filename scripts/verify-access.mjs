import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// This harness targets only a local production Worker, behind the trusted identity boundary.
// No fake identities are sent to the live Site.
const base = 'http://127.0.0.1:5174';
const roles = {
  admin: {'oai-authenticated-user-id': 'qa_admin', 'oai-authenticated-user-email': 'seedy@sites.test'},
  alice: {'oai-authenticated-user-id': 'qa_customer_a', 'oai-authenticated-user-email': 'alice@example.test'},
  bob: {'oai-authenticated-user-id': 'qa_customer_b', 'oai-authenticated-user-email': 'bob@example.test'},
  anonymous: {},
};
async function get(role) {
  const response = await fetch(base + '/api/shop', {headers: roles[role]});
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.match(response.headers.get('cache-control'), /no-store/);
  return result;
}
async function post(body, role = 'admin') {
  const response = await fetch(base + '/api/shop', {method: 'POST', headers: {...roles[role], origin: base, 'content-type': 'application/json'}, body: JSON.stringify(body)});
  return {status: response.status, data: await response.json()};
}
const initial = await get('admin');
assert.equal(initial.admin, true);
for (const role of ['anonymous', 'alice', 'bob']) {
  const data = await get(role);
  assert.equal(data.admin, false, role);
  assert.equal(data.movements.length, 0);
  assert(data.products.every(product => product.published && !product.archivedVariants));
  assert.equal(data.user?.id ?? null, roles[role]['oai-authenticated-user-id'] ?? null);
  for (const action of ['product', 'settings', 'status', 'visibility', 'delete-product']) {
    assert.equal((await post({action, role: 'admin', admin: true}, role)).status, 403, role + ' ' + action);
  }
  const photo = await fetch(base + '/api/product-images', {method: 'POST', headers: {...roles[role], origin: base}, body: new FormData()});
  assert.equal(photo.status, 403);
}
for (const role of ['anonymous', 'alice', 'bob', 'admin']) {
  const response = await fetch(base + '/admin', {headers: roles[role]});
  assert.equal(response.status, 200);
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  assert(!html.includes('Menu des sections'), 'No privileged navigation before authorization');
  if (role === 'admin') assert(html.includes('Vérification de l’accès'), 'Authorized server page reaches the authenticated app');
  else {
    assert(html.includes('Accès réservé.'));
    assert(!html.includes('Encaissements HTG'));
    assert(!html.includes('Visualiser le site'));
    if (role !== 'anonymous') assert(html.includes('compte client'));
    else assert(html.includes('/signin-with-chatgpt?return_to=%2Fadmin'));
  }
}
assert.equal((await fetch(base + '/account', {headers: roles.alice})).status, 200);
const id = 'qa-access-' + Date.now();
const product = {...initial.products[0], id, name: 'QA isolation des comptes', price: 10, published: false, sizes: ['Unique'], colors: ['Noir'], archivedVariants: undefined, variants: [{size: 'Unique', color: 'Noir', stock: 2, version: 0}], stock: 2};
const orderIds = [];
try {
  assert.equal((await post({action: 'product', product})).status, 200);
  assert(!(await get('alice')).products.some(p => p.id === id));
  assert.equal((await post({action: 'visibility', id, published: true})).status, 200);
  for (const role of ['alice', 'bob']) {
    const result = await post({action: 'order', owner: 'qa_admin', role: 'admin', admin: true, items: [{id, size: 'Unique', color: 'Noir', qty: 1}], customer: {name: 'Client QA', email: 'seedy@sites.test', phone: '00000000'}}, role);
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.data.order.owner, roles[role]['oai-authenticated-user-id']);
    orderIds.push(result.data.order.id);
    assert.equal((await post({action: 'status', id: result.data.order.id, status: 'Confirmée', notes: 'PRIVATE QA NOTE'})).status, 200);
  }
  const alice = await get('alice'), bob = await get('bob'), anonymous = await get('anonymous'), admin = await get('admin');
  assert(alice.orders.some(o => o.id === orderIds[0]));
  assert(!alice.orders.some(o => o.id === orderIds[1]));
  assert(bob.orders.some(o => o.id === orderIds[1]));
  assert(!bob.orders.some(o => o.id === orderIds[0]));
  assert(alice.orders.every(o => o.owner === 'qa_customer_a' && !('notes' in o)));
  assert(bob.orders.every(o => o.owner === 'qa_customer_b' && !('notes' in o)));
  assert.equal(anonymous.orders.length, 0);
  assert(orderIds.every(id => admin.orders.some(o => o.id === id && o.notes === 'PRIVATE QA NOTE')));
  assert.equal(alice.admin, false, 'A checkout email must never grant admin access');
} finally {
  for (const id of orderIds) await post({action: 'status', id, status: 'Annulée'});
  await post({action: 'delete-product', id});
}
const compiled = ts.transpileModule(fs.readFileSync('lib/access-policy.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {isAdministrator, accountOrders} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
assert(isAdministrator('admin-id', 'Admin@Example.test', 'admin@example.test'));
assert(!isAdministrator('', 'admin@example.test', 'admin@example.test'));
assert(!isAdministrator('customer-id', 'customer@example.test', 'admin@example.test'));
assert(!isAdministrator('any-id', 'customer@example.test', ''));
const alice = {id: 'A', owner: 'alice'}, bob = {id: 'B', owner: 'bob'}, guest = {id: 'G', owner: 'guest-local'};
assert.deepEqual(accountOrders([alice, bob], [alice, bob, guest], 'alice'), [alice]);
assert.deepEqual(accountOrders([alice, bob], [alice, bob, guest], 'bob'), [bob]);
assert.deepEqual(accountOrders([alice, bob], [alice, bob, guest], null), [guest]);
assert.deepEqual(accountOrders([alice, bob], [], 'other-admin'), []);
console.log('PASS anonymous/client/admin gates, all protected mutations, uploads, account route, owner isolation, local-session filtering and checkout email cannot elevate privileges.');
