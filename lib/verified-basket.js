// Price truth: current, barcode-specific, per store. Aggregate basket quotations are discovery hints only.
export const barcode = value => String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');
export const money = value => {
  if (value === null || value === undefined || value === '') return null;
  const v = Number(value);
  return Number.isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
};
const txt = value => String(value ?? '').trim();
const keypart = value => txt(value).normalize('NFKC').trim().toLocaleLowerCase('he');
const rowsOf = value => {
  if (Array.isArray(value)) return value;
  for (const k of ['results','rows','data','items','prices']) {
    if (Array.isArray(value?.[k])) return value[k];
    if (value?.[k] && value[k] !== value) { const child=rowsOf(value[k]); if (child.length) return child; }
  }
  return [];
};
export const extractRows = rowsOf;
export function storeIdentity(row) {
  const s = row?.store && typeof row.store === 'object' ? {...row,...row.store}:row;
  const chain = keypart(s?.chain ?? s?.chain_key ?? s?.chain_name ?? s?.retailer_name);
  const branch = keypart(s?.store_id ?? s?.store_code ?? s?.branch_id);
  return {chain,branch,city:keypart(s?.city),name:keypart(s?.store_name ?? s?.branch_name ?? s?.name)};
}
export function sameStore(a,b) {
  const x=storeIdentity(a), y=storeIdentity(b);
  // Never match branches solely by the name of a chain or by city.
  if (!x.chain || !y.chain || x.chain!==y.chain) return false;
  if (x.branch && y.branch) return x.branch===y.branch;
  return !!(x.name && y.name && x.name===y.name && x.city && y.city && x.city===y.city);
}
export function currentPrice(row, expectedBarcode) {
  const sourceBarcode=barcode(row?.item_code_bare ?? row?.item_code ?? row?.barcode ?? row?.ean);
  if (!sourceBarcode || sourceBarcode!==barcode(expectedBarcode)) return null;
  if (row?.last_seen_date != null && txt(row.last_seen_date)) return null;
  if (row?.available===false || row?.missing===true) return null;
  // Weighted goods cannot be treated as one packaged unit without an explicit unit basis.
  if ([true,1,'1','true'].includes(row?.is_weighted ?? row?.b_is_weighted ?? row?.bIsWeighted)) return null;
  return money(row?.item_price ?? row?.unit_price ?? row?.price);
}
export function assembleVerifiedStores(candidates, requestedItems, sourceRows, {allowStaleDays=7,now=new Date()}={}) {
  const selected=[];
  for (const store of candidates) {
    const details=[];
    for (const item of requestedItems) {
      const choices=[];
      for (const {row,source,priority=10} of sourceRows) {
        if (!sameStore(store,row)) continue;
        const unit=currentPrice(row,item.item_code);
        if (unit==null) continue;
        const asOf=txt(row.as_of ?? row.price_update_date ?? row.updated_at);
        if (asOf) {
          const time=Date.parse(asOf);
          if (Number.isFinite(time) && (now.getTime()-time)>allowStaleDays*86400000) continue;
          if (Number.isFinite(time) && time>now.getTime()+86400000) continue;
        }
        choices.push({unit,source,priority,asOf,productName:txt(row.item_name ?? row.product_name)});
      }
      choices.sort((a,b)=>a.priority-b.priority||Date.parse(b.asOf||0)-Date.parse(a.asOf||0));
      const match=choices[0] ?? null;
      const qty=Math.min(99,Math.max(1,Number(item.quantity)||1));
      details.push({item_code:barcode(item.item_code),name:txt(item.name),qty,unit:match?.unit??null,total:match?Math.round(match.unit*qty*100)/100:null,verified:!!match,source:match?.source??null,asOf:match?.asOf??null,sourceItemName:match?.productName??null});
    }
    const missing=details.filter(x=>!x.verified).length;
    const subtotal=Math.round(details.reduce((sum,x)=>sum+(x.total??0),0)*100)/100;
    selected.push({...store,details,matched:details.length-missing,missing,price:missing===0?subtotal:null,verifiedTotal:missing===0?subtotal:null,partialSubtotal:subtotal,coverage:details.length?Math.round((details.length-missing)/details.length*100):0,priceStatus:missing===0?'verified':'incomplete'});
  }
  return selected.sort((a,b)=>a.missing-b.missing||(a.verifiedTotal??Infinity)-(b.verifiedTotal??Infinity));
}
export function mergeSourceRows(rawResults) {
  const results=[];
  for (const result of rawResults) for(const row of rowsOf(result?.data)) results.push({row,source:result.source,priority:result.priority});
  return results;
}

// Branches found directly in market rows are authoritative; do not borrow a branch's price
// from basket summaries or a same-named branch of another chain.
export function storesFromMarketRows(sourceRows) {
  const byId = new Map();
  for (const {row} of sourceRows) {
    const chain = String(row.chain ?? row.chain_key ?? '').trim();
    const store_id = String(row.store_id ?? row.store_code ?? '').trim();
    if (!chain || !store_id) continue;
    const key = `${chain.toLowerCase()}::${store_id}`;
    const candidate = {
      chain, chain_name: row.chain_name ?? row.retailer_name ?? chain,
      store_id, store_name: row.store_name ?? row.branch_name ?? store_id,
      city: row.city ?? '', address: row.address ?? row.store_address ?? '',
      latitude: row.latitude ?? row.lat ?? null, longitude: row.longitude ?? row.lon ?? null,
      as_of: row.as_of ?? null,
    };
    if (!byId.has(key)) byId.set(key, candidate);
  }
  return [...byId.values()];
}
export function priceDiagnostics(items, sourceRows, storeRows) {
  return items.map(item => {
    const relevant = sourceRows.filter(x=>barcode(x.row.item_code_bare??x.row.item_code??x.row.barcode)===barcode(item.item_code));
    const valid = relevant.filter(x=>currentPrice(x.row,item.item_code)!=null);
    const matchedBranches = storeRows.filter(s=>valid.some(x=>sameStore(s,x.row))).length;
    return {item_code:barcode(item.item_code),sourceRows:relevant.length,validRows:valid.length,matchedBranches};
  });
}
