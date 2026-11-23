import {NextResponse} from 'next/server';
import {assembleVerifiedStores,extractRows,mergeSourceRows,barcode} from '../../../lib/verified-basket.js';
export const dynamic='force-dynamic';
export const maxDuration=60;
const OVER='https://www.over.org.il';
const fetchJSON=async(url,options={})=>{
  const res=await fetch(url,{...options,signal:AbortSignal.timeout(11000),cache:'no-store'});
  if(!res.ok)throw Error(`HTTP ${res.status}`);
  return res.json();
};
const pieces=(arr,n)=>Array.from({length:Math.ceil(arr.length/n)},(_,i)=>arr.slice(i*n,(i+1)*n));
const optionalSecondary=async(items,city)=>{
  // Optional licensed adapter. Response: {results:[{chain,store_id,city,item_code,item_price,as_of}]}.
  const endpoint=process.env.SECONDARY_PRICE_API_URL;
  if(!endpoint)return null;
  const parsed=new URL(endpoint);
  if(parsed.protocol!=='https:')throw Error('Secondary provider must use HTTPS');
  const apiKey=process.env.SECONDARY_PRICE_API_KEY;
  return fetchJSON(parsed.toString(),{method:'POST',headers:{'content-type':'application/json',...(apiKey?{'authorization':`Bearer ${apiKey}`}:{})},body:JSON.stringify({items,city})});
};
export async function POST(request){
  let body;
  try{body=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const city=String(body.city??'').trim().slice(0,80);
  if(!city||!Array.isArray(body.items)||body.items.length<1||body.items.length>40)return NextResponse.json({error:'יש לספק עיר ו-1 עד 40 מוצרים'},{status:400});
  const items=body.items.map(x=>({item_code:barcode(x.item_code),quantity:Math.min(99,Math.max(1,Number(x.quantity)||1)),name:String(x.name??'').slice(0,180)}));
  if(items.some(x=>!x.item_code))return NextResponse.json({error:'חסר ברקוד לפריט'},{status:400});
  const distinct=[...new Set(items.map(x=>x.item_code))];
  const failures=[];
  let candidates=[];
  try{
    const basket=await fetchJSON(`${OVER}/api/prices/basket`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({city,top:30,items:items.map(({item_code,quantity})=>({item_code,quantity}))})});
    candidates=extractRows(basket).map(x=>x.store&&typeof x.store==='object'?{...x,...x.store}:x);
  }catch(e){failures.push(`איתור סניפים: ${e.message}`)}
  const loaded=[];
  // Market prices per barcode and physical branch. The aggregate basket number is never used as a verified total.
  await Promise.all(pieces(distinct,8).map(async codes=>{
    const url=new URL('/api/prices/table/prices_market',OVER);
    url.searchParams.set('item_code',codes.join(','));url.searchParams.set('city',city);
    url.searchParams.set('current','true');url.searchParams.set('limit','1000');
    try{
      let offset=0;
      for(let page=0;page<3;page++){
        url.searchParams.set('offset',String(offset));
        const data=await fetchJSON(url.toString());
        loaded.push({data,source:'OVER · מחיר סניף רשמי',priority:1});
        const count=extractRows(data).length;
        if(!data.has_more || !count)break;
        offset+=count;
      }
    }catch(e){failures.push(`מחירי פריטים: ${e.message}`)}
  }));
  let secondaryEnabled=false;
  if(process.env.SECONDARY_PRICE_API_URL){
    try{const data=await optionalSecondary(items,city);loaded.push({data,source:'מקור מחירים משלים',priority:2});secondaryEnabled=true}
    catch(e){failures.push(`מקור משלים: ${e.message}`)}
  }
  const rows=mergeSourceRows(loaded);
  if(!candidates.length){
    const byStore=new Map();
    for(const {row} of rows){const chain=String(row.chain??row.chain_key??row.chain_name??'');const id=String(row.store_id??row.store_code??'');if(!chain||!id)continue;const key=`${chain}:${id}`;if(!byStore.has(key))byStore.set(key,{chain:row.chain??row.chain_name,chain_name:row.chain_name??row.chain,store_id:id,store_name:row.store_name,city:row.city,address:row.address,latitude:row.latitude,longitude:row.longitude,as_of:row.as_of})}
    candidates=[...byStore.values()].slice(0,60);
  }
  const stores=assembleVerifiedStores(candidates,items,rows);
  const complete=stores.filter(x=>x.missing===0).length;
  return NextResponse.json({results:stores,meta:{city,items:items.length,storesChecked:stores.length,completeStores:complete,verifiedSourceRows:rows.length,secondaryEnabled,failures,calculation:'sum_of_verified_item_prices',pricesIncludePromotions:false}},{status:stores.length?200:503,headers:{'Cache-Control':'no-store'}});
}
