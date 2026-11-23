import test from 'node:test';
import assert from 'node:assert/strict';
import {validateActivity} from '../lib/activity.js';
test('accepts known events and bounded counts',()=>{
 assert.deepEqual(validateActivity({type:'login',status:'success'}),{type:'login',status:'success'});
 assert.deepEqual(validateActivity({type:'basket_comparison',status:'error',count:4}),{type:'basket_comparison',status:'error',count:4});
});
test('rejects unknown events, huge counts, invalid status',()=>{
 assert.equal(validateActivity({type:'admin_override',status:'success'}),null);
 assert.equal(validateActivity({type:'product_search',status:'success',count:9999}),null);
 assert.equal(validateActivity({type:'login',status:'maybe'}),null);
});
test('only allowlisted fields are persisted',()=>{
 assert.deepEqual(validateActivity({type:'product_search',status:'success',q:'private search',address:'home',count:2}),{type:'product_search',status:'success',count:2});
});
