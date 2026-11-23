// Deliberately keep activity logs free of search text, products, addresses and IPs.
export const EVENT_TYPES = Object.freeze(['login', 'product_search', 'item_comparison', 'basket_comparison']);
export const EVENT_STATUSES = Object.freeze(['success', 'error']);
export function validateActivity(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (!EVENT_TYPES.includes(body.type) || !EVENT_STATUSES.includes(body.status)) return null;
  const count = body.count == null ? null : Number(body.count);
  if (count !== null && (!Number.isInteger(count) || count < 0 || count > 500)) return null;
  return {type:body.type,status:body.status,...(count !== null ? {count} : {})};
}
