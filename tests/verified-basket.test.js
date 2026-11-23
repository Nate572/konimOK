import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleVerifiedStores,currentPrice,sameStore,mergeSourceRows} from '../lib/verified-basket.js';
const now=new Date('2026-11-23T18:00:00Z');
const stores=[{chain:'ramilevi',store_id:'12',store_name:'מרכז',city:'חיפה'},{chain:'ramilevi',store_id:'13',store_name:'צפון',city:'חיפה'}];
const items=[{item_code:'7290001',quantity:2,name:'חלב'},{item_code:'7290002',quantity:1,name:'נייר טואלט'},{item_code:'7290003',quantity:1,name:'שמפו'}];
const R=(store_id,item_code,item_price,extra={})=>({chain:'ramilevi',store_id,city:'חיפה',item_code,item_price,as_of:'2026-11-22',...extra});
test('primary 2/3 + secondary 1/3: complete basket has auditable item totals',()=>{
 const result=assembleVerifiedStores(stores,items,[{row:R('12','7290001',7.5),source:'official',priority:1},{row:R('12','7290002',29),source:'official',priority:1},{row:R('12','7290003',12),source:'secondary',priority:2}],{now});
 assert.equal(result[0].price,56);assert.equal(result[0].missing,0);assert.deepEqual(result[0].details.map(x=>x.source),['official','official','secondary']);
});
test('only some items resolved: no misleading full-basket price',()=>{
 const result=assembleVerifiedStores(stores,items,[{row:R('12','7290001',7.5),source:'official',priority:1}],{now});
 assert.equal(result[0].price,null);assert.equal(result[0].partialSubtotal,15);assert.equal(result[0].missing,2);
});
test('do not borrow other branches prices even same chain and city',()=>{
 assert.equal(sameStore(stores[0],R('13','7290001',7)),false);
 assert.equal(assembleVerifiedStores([stores[0]],items,[{row:R('13','7290001',7),source:'official'}],{now})[0].matched,0);
});
test('reject wrong barcode, stale, ended and weighted records',()=>{
 assert.equal(currentPrice(R('12','7290002',6),'7290001'),null);
 assert.equal(currentPrice(R('12','7290001',6,{last_seen_date:'2026-11-21'}),'7290001'),null);
 assert.equal(currentPrice(R('12','7290001',6,{bIsWeighted:1}),'7290001'),null);
 const result=assembleVerifiedStores([stores[0]],items,[{row:R('12','7290001',6,{as_of:'2026-10-01'}),source:'official'}],{now});
 assert.equal(result[0].matched,0);
});
test('prefer official value over competing secondary quote, not lowest unverified',()=>{
 const result=assembleVerifiedStores([stores[0]],items,[{row:R('12','7290001',8),source:'official',priority:1},{row:R('12','7290001',3),source:'secondary',priority:2}],{now});
 assert.equal(result[0].details[0].unit,8);
});
test('provider parser reads nested results',()=>{
 assert.equal(mergeSourceRows([{data:{data:{results:[R('12','7290001',7)]}},source:'x'}]).length,1);
});
