import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = 'http://127.0.0.1:5173';
const login = await fetch(base + '/signin-with-chatgpt?return_to=%2Fadmin', {redirect: 'manual'});
const cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
async function shop(auth = true) {
  const response = await fetch(base + '/api/shop', {headers: auth ? {cookie} : {}});
  assert.equal(response.status, 200);
  return response.json();
}
async function post(body) {
  const response = await fetch(base + '/api/shop', {method: 'POST', headers: {cookie, origin: base, 'content-type': 'application/json'}, body: JSON.stringify(body)});
  return {status: response.status, data: await response.json().catch(() => ({error: 'Non-JSON response'}))};
}
async function upload(bytes, type = 'image/png', headers = {cookie, origin: base}) {
  const form = new FormData();
  if (bytes !== null) form.append('photo', new Blob([bytes], {type}), 'same-name.png');
  const response = await fetch(base + '/api/product-images', {method: 'POST', headers, body: form});
  return {status: response.status, data: await response.json().catch(() => ({error: 'Non-JSON response'}))};
}
const initial = await shop();
assert(initial.admin, 'Local mock admin sign-in required');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VxkAAAAASUVORK5CYII=', 'base64');
assert.equal((await upload(png, 'image/png', {origin: base})).status, 403);
assert.equal((await upload(png, 'image/png', {origin: base, 'oai-authenticated-user-id': 'fake', 'oai-authenticated-user-email': initial.user.email})).status, 403);
assert.equal((await upload(png, 'image/png', {cookie, origin: 'https://foreign.example'})).status, 403);
assert.equal((await upload(null)).status, 400);
assert.equal((await upload(new Uint8Array())).status, 400);
assert.equal((await upload(Buffer.from('<script>alert(1)</script>'))).status, 415);
assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')).status, 415);
assert.equal((await upload(png, 'image/jpeg')).status, 415);
assert.equal((await upload(new Uint8Array(8 * 1024 * 1024 + 1))).status, 413);
const saved = await upload(png);
assert.equal(saved.status, 201, JSON.stringify(saved.data));
const url = saved.data.url;
assert.match(url, /^\/api\/product-images\/[0-9a-f-]+\.png$/);
const duplicate = await upload(png);
assert.equal(duplicate.status, 201);
assert.notEqual(duplicate.data.url, url, 'Same filename must not overwrite another photo');
const jpeg = fs.readFileSync('public/images/billion-neon-sneakers-source.jpeg');
const savedJpeg = await upload(jpeg, 'image/jpeg');
assert.equal(savedJpeg.status, 201, JSON.stringify(savedJpeg.data));
for (const [path, expected, type] of [[url, png, 'image/png'], [savedJpeg.data.url, jpeg, 'image/jpeg']]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), type);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('cache-control'), /immutable/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
}
assert.equal((await fetch(base + '/api/product-images/not-an-image.svg')).status, 404);
assert.equal((await fetch(base + '/api/product-images/' + crypto.randomUUID() + '.png')).status, 404);
const id = 'qa-photo-' + Date.now();
let product = {...initial.products[0], id, name: 'QA import photo', image: url, sizes: ['Unique'], colors: ['Noir'], variants: [{size: 'Unique', color: 'Noir', stock: 0, version: 0}], archivedVariants: undefined, stock: 0, published: true};
try {
  assert.equal((await post({action: 'product', product})).status, 200);
  assert.equal((await shop(false)).products.find(p => p.id === id).image, url);
  product = (await shop()).products.find(p => p.id === id);
  assert.equal((await post({action: 'product', product: {...product, price: 1700}})).status, 200);
  assert.equal((await shop(false)).products.find(p => p.id === id).image, url);
  product = (await shop()).products.find(p => p.id === id);
  for (const image of ['data:image/png;base64,AAAA', 'blob:https://example.com/test', 'javascript:alert(1)', '/api/shop', '/api/product-images/' + crypto.randomUUID() + '.png']) {
    assert.equal((await post({action: 'product', product: {...product, image}})).status, 400, image);
  }
  assert.equal((await post({action: 'product', product: {...product, image: initial.products[0].image}})).status, 200, 'Existing HTTPS images stay supported');
  product = (await shop()).products.find(p => p.id === id);
  assert.equal((await post({action: 'product', product: {...product, image: savedJpeg.data.url}})).status, 200);
  assert.equal((await shop(false)).products.find(p => p.id === id).image, savedJpeg.data.url);
} finally {
  await post({action: 'delete-product', id});
}
console.log('PASS admin-only image upload, origin, file validation, size limit, unique keys, public image bytes/headers, persistent product replacement and legacy HTTPS support.');
