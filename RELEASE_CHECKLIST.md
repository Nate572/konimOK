# V7 staging verification — DO NOT call production ready without live provider check

1. Install dependencies and run `npm run build` and `node --test tests/*.test.js`.
2. On Vercel production/preview with configured Firebase auth, compare three real barcodes in a known city.
3. Inspect Network -> POST /api/verified-basket -> Response -> `meta.diagnostic`:
   - `sourceRows` > 0 per barcode means OVER returned raw prices.
   - `validRows` > 0 means usable current data.
   - `matchedBranches` > 0 means at least one store matched.
4. Expand a resulting store, cross-check item_code, store_id, `item_price`, and as_of against /api/prices/table/prices_market for the same barcode and city.
5. Verify all requested lines and exact arithmetic before calling a basket complete.
6. Check mobile and desktop production URLs are identical and use same deployment.
7. For general-category product search, this version still requires concrete barcodes. No substitutions without explicit user approval.

A live production check was unavailable during creation of this staging patch.
