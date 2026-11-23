// Provider responses can vary. Never invent unit prices when detail rows are missing.
const numberOrNull = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const normalizedBarcode = value => String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');
const rowsFrom = data => {
  if (Array.isArray(data)) return data;
  for (const key of ['items','products','item_details','basket_items','details','breakdown','prices','rows']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};
export function basketDetails(store, basketItems) {
  const raw = store.raw ?? store;
  const rows = rowsFrom(raw);
  const byBarcode = new Map();
  for (const row of rows) {
    const id = normalizedBarcode(row.item_code_bare ?? row.item_code ?? row.barcode ?? row.ean);
    if (id) byBarcode.set(id, row);
  }
  return basketItems.map(item => {
    const row = byBarcode.get(normalizedBarcode(item.barcode));
    const quantity = Math.max(1, Number(item.qty) || 1);
    const explicitLine = row ? numberOrNull(row.line_total ?? row.total_price ?? row.total ?? row.subtotal ?? row.extended_price) : null;
    const unit = row ? numberOrNull(row.item_price ?? row.unit_price ?? row.price ?? row.price_per_unit) : null;
    const total = explicitLine ?? (unit == null ? null : Math.round(unit * quantity * 100) / 100);
    const missing = row?.missing === true || row?.available === false || row?.found === false;
    return {name: item.name, barcode: item.barcode, qty:quantity, unit, total, missing, verified: Boolean(row) && !missing && total != null};
  });
}
export function detailsSummary(details) {
  const priced = details.filter(x => x.verified);
  return {known:priced.length, count:details.length, sum:priced.reduce((a,x)=>a+x.total,0), complete:priced.length === details.length};
}
export function normalizePromotionRows(payload) {
  if (Array.isArray(payload)) return payload;
  return rowsFrom(payload?.data ?? payload?.results ?? payload);
}
