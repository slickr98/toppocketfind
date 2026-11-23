const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const campaigns = JSON.parse(fs.readFileSync('api/tracking-campaigns.json'));

async function setup({query='',referrer='',privacy=false,excluded=false}={}) {
  const calls=[];
  const handlers={};
  const stored=new Map(excluded?[['tpf_analytics_exclude','1']]:[]);
  const context={URL,URLSearchParams,location:{search:query,pathname:'/',hostname:'www.toppocketfind.ca',origin:'https://www.toppocketfind.ca',href:'https://www.toppocketfind.ca/'+query},
    navigator:{globalPrivacyControl:privacy},window:{addEventListener:(name,handler)=>handlers['window:'+name]=handler},
    document:{referrer,addEventListener:(name,handler)=>handlers[name]=handler},
    localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
    fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>campaigns};}};
  vm.runInNewContext(fs.readFileSync('js/analytics.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return{calls,handlers,stored,context};
}
test('anonymous payload discards raw URLs and carries only registered ad labels',async()=>{
  const {calls,handlers}=await setup({query:'?utm_source=kijiji&utm_campaign=coin-collection&email=private@example.com',referrer:'https://www.kijiji.ca/v-ad/private'});
  assert.equal(calls.length,2);
  const sent=calls[1];assert.equal(sent.options.credentials,'omit');assert.equal(sent.options.referrerPolicy,'no-referrer');
  assert.deepEqual(JSON.parse(sent.options.body),{event:'page_view',page:'/',source:'kijiji',campaign:'coin-collection'});
  const anchor={href:'https://www.toppocketfind.ca/products/1982-regina-centennial-silver-dollar.html'};
  handlers.click({target:{closest:()=>anchor}});
  assert.equal(JSON.parse(calls[2].options.body).event,'product_click');
  assert.equal(new URL(anchor.href).searchParams.get('utm_campaign'),'coin-collection');
  assert.ok(calls.every(call=>!JSON.stringify(call).includes('private@example.com')));
});
test('privacy signals and own-device exclusion make no analytics requests',async()=>{
  for(const options of [{privacy:true},{excluded:true},{query:'?analytics=off'}]){
    const {calls}=await setup(options);assert.equal(calls.length,0);
  }
  const {calls,stored}=await setup({excluded:true,query:'?analytics=on'});
  assert.equal(stored.has('tpf_analytics_exclude'),false);assert.equal(calls.length,2);
});
test('unregistered campaign text is never sent to analytics',async()=>{
  const {calls}=await setup({query:'?utm_source=facebook&utm_campaign=private@example.com'});
  assert.equal(JSON.parse(calls[1].options.body).campaign,'');
});
