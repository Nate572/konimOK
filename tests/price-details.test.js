import test from 'node:test';
import assert from 'node:assert/strict';
import {basketDetails,detailsSummary,normalizePromotionRows} from '../lib/price-details.js';
const basket=[{name:'שמפו',barcode:'07290001',qty:2},{name:'חלב',barcode:'7290002',qty:1}];
test('normalizes barcode zeros, computes line totals using source unit price',()=>{
 const details=basketDetails({raw:{items:[{item_code:'7290001',item_price:12.5},{item_code:'7290002',item_price:6}]}},basket);
 assert.equal(details[0].total,25);assert.equal(details[1].unit,6);assert.equal(detailsSummary(details).sum,31);
});
test('missing detail remains unknown; no invented prices',()=>{
 const details=basketDetails({raw:{items:[{item_code:'7290002',item_price:6}]}},basket);
 assert.equal(details[0].total,null);assert.equal(details[0].verified,false);assert.equal(detailsSummary(details).complete,false);
});
test('explicit line total is preferred over unit multiplication',()=>{
 const details=basketDetails({raw:{products:[{barcode:'7290001',price:15,total:24}]}},basket);
 assert.equal(details[0].total,24);
});
test('promotion normalization supports arrays and results',()=>{
 assert.equal(normalizePromotionRows({results:[{id:1}]}).length,1);
 assert.equal(normalizePromotionRows({rows:[{id:2}]}).length,1);
});
