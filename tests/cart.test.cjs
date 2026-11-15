const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const coin = JSON.parse(fs.readFileSync('api/coins.json')).products[0];
async function setup(initial = '[]') {
  const values = new Map([['tpf_cart', initial]]);
  const window = new EventTarget();
  const document = new EventTarget(); document.hidden = true;
  const context = {window, document, localStorage: {getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v)},
    Event, AbortSignal, setInterval: () => {}, fetch: async url => ({ok: true, json: async () => url === '/api/coins.json' ? {products:[coin]} : {products:[{id:'coin-001',quantityAvailable:3}],checkoutReady:false}})};
  vm.runInNewContext(fs.readFileSync('js/shop.js','utf8'), context);
  await window.tpfShop.ready;
  await window.tpfShop.refreshStock();
  return {shop: window.tpfShop, context, values};
}
test('quantity accumulates to stock cap, totals in cents, remove frees bag space', async () => {
  const {shop} = await setup();
  shop.add('coin-001', 1); shop.add('coin-001', 2);
  assert.equal(shop.get()[0].qty, 3);
  assert.equal(shop.get()[0].priceCents * shop.get()[0].qty, 16485);
  assert.throws(() => shop.add('coin-001', 1));
  shop.setQuantity('coin-001', 2); shop.add('coin-001', 1);
  assert.equal(shop.get()[0].qty, 3);
  shop.setQuantity('coin-001', 0); assert.equal(shop.get().length, 0);
});
test('bad local data and manipulated prices are normalized', async () => {
  for (const text of ('[null]|{}|invalid').split('|')) {
    const {shop} = await setup(text); assert.equal(shop.get().length, 0);
  }
  const {shop} = await setup(JSON.stringify([{id:'coin-001',qty:999,priceCents:1,title:'fake',maxQty:999}]));
  assert.equal(shop.get()[0].qty, 3); assert.equal(shop.get()[0].priceCents, 5495);
  assert.equal(shop.get()[0].title, coin.title);
});
test('live stock refresh clamps existing bag and handles sold out', async () => {
  const {shop,context} = await setup(); shop.add('coin-001', 3);
  context.fetch = async () => ({ok:true,json:async()=>({products:[{id:'coin-001',quantityAvailable:1}],checkoutReady:true,paymentMode:'live'})});
  await shop.refreshStock(); assert.equal(shop.get()[0].qty,1); assert.equal(shop.checkoutReady(),true);
  context.fetch = async () => ({ok:true,json:async()=>({products:[{id:'coin-001',quantityAvailable:0}],checkoutReady:true,paymentMode:'live'})});
  await shop.refreshStock(); assert.equal(shop.get().length,0); assert.throws(()=>shop.add('coin-001',1));
});
test('slow stock requests are shared, disable checkout while pending, and recover', async () => {
  const {shop,context} = await setup();
  await shop.refreshStock();
  let finish, requests = 0;
  context.fetch = () => { requests++; return new Promise(resolve => { finish = resolve; }); };
  const first = shop.refreshStock();
  const second = shop.refreshStock();
  assert.equal(requests, 1);
  assert.equal(shop.stockStatus().checking, true);
  assert.equal(shop.checkoutReady(), false);
  finish({ok:true,json:async()=>({products:[{id:'coin-001',quantityAvailable:3}],checkoutReady:true,paymentMode:'test'})});
  await Promise.all([first,second]);
  assert.equal(shop.stockStatus().checking, false);
  assert.equal(shop.stockStatus().paymentMode, 'test');
  assert.equal(shop.checkoutReady(), true);
});
test('unavailable backend never claims checkout is ready', async () => {
  const {shop,context} = await setup(); context.fetch = async()=>{throw new Error('offline')};
  await shop.refreshStock(); assert.equal(shop.checkoutReady(),false);
  shop.add('coin-001',1); assert.equal(shop.get()[0].qty,1);
});
