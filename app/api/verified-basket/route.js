import {NextResponse} from 'next/server';
import {assembleVerifiedStores,extractRows,mergeSourceRows,barcode,storesFromMarketRows,priceDiagnostics} from '../../../lib/verified-basket.js';
export const dynamic='force-dynamic';
export const maxDuration=60;
const OVER='https://www.over.org.il';
const MAX_PAGES=8;
const PAGE_SIZE=1000;
async function fetchJSON(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!response.ok) throw Error(`HTTP ${response.status}`);
  const data=await response.json();
  if(!data || typeof data!=='object') throw Error('Invalid provider payload');
  return data;
}
async function optionalSecondary(items,city){
  const endpoint=process.env.SECONDARY_PRICE_API_URL;
  if(!endpoint) return null;
  const parsed=new URL(endpoint);
  if(parsed.protocol!=='https:') throw Error('Secondary provider requires HTTPS');
  const apiKey=process.env.SECONDARY_PRICE_API_KEY;
  return fetchJSON(parsed.toString(),{method:'POST',headers:{'content-type':'application/json',...(apiKey?{'authorization':`Bearer ${apiKey}`}:{})},body:JSON.stringify({items,city})});
}
async function loadBarcode(code,city) {
  const url=new URL('/api/prices/table/prices_market',OVER);
  url.searchParams.set('item_code',code);
  url.searchParams.set('city',city);
  url.searchParams.set('current','true');
  url.searchParams.set('limit',String(PAGE_SIZE));
  let offset=0;const pages=[];
  for(let page=0;page<MAX_PAGES;page++){
    url.searchParams.set('offset',String(offset));
    const data=await fetchJSON(url.toString());
    const rows=extractRows(data);
    pages.push({data,source:'OVER · פרסום הרשתות',priority:1});
    if(data.has_more!==true || rows.length===0) break;
    offset+=rows.length;
  }
  return pages;
}
export async function POST(request){
  let body;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const city=String(body.city??'').trim().slice(0,80);
  if(!city||!Array.isArray(body.items)||body.items.length<1||body.items.length>40)return NextResponse.json({error:'יש לספק עיר ו-1 עד 40 מוצרים'},{status:400});
  const items=body.items.map(x=>({item_code:barcode(x.item_code),quantity:Math.min(99,Math.max(1,Number(x.quantity)||1)),name:String(x.name??'').slice(0,180)}));
  if(items.some(x=>!x.item_code))return NextResponse.json({error:'אחד המוצרים ללא ברקוד תקין'},{status:400});
  const distinct=[...new Set(items.map(x=>x.item_code))];
  const loaded=[];const errors=[];
  // Bounded concurrency; every barcode is queried independently to prevent truncated batches.
  for(let i=0;i<distinct.length;i+=4){
    const batch=distinct.slice(i,i+4);
    const settled=await Promise.allSettled(batch.map(code=>loadBarcode(code,city)));
    settled.forEach((result,index)=>{
      if(result.status==='fulfilled')loaded.push(...result.value);
      else errors.push({item_code:batch[index],error:result.reason?.message||'Upstream error'});
    });
  }
  let secondaryEnabled=false;
  if(process.env.SECONDARY_PRICE_API_URL){
    try{const data=await optionalSecondary(items,city);loaded.push({data,source:'מורשה · מקור משלים',priority:2});secondaryEnabled=true}
    catch(e){errors.push({source:'secondary',error:e.message})}
  }
  const rows=mergeSourceRows(loaded);
  // Use prices_market itself as the authoritative list of stores.
  const branches=storesFromMarketRows(rows);
  const stores=assembleVerifiedStores(branches,items,rows);
  const complete=stores.filter(s=>s.missing===0).length;
  const diagnostic=priceDiagnostics(items,rows,branches);
  const payload={results:stores,meta:{city,items:items.length,storesChecked:stores.length,completeStores:complete,verifiedSourceRows:rows.length,secondaryEnabled,diagnostic,errors,calculation:'sum_of_verified_item_prices',pricesIncludePromotions:false}};
  if(errors.length&&rows.length===0)return NextResponse.json({...payload,error:'לא ניתן לשלוף מחירים מאומתים מהמקור כרגע'}, {status:502,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json(payload,{headers:{'Cache-Control':'no-store'}});
}
