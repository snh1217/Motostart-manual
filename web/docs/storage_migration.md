# Supabase Storage Migration

## Goal
Move `web/public/manuals/splits/*.pdf` to Supabase Storage to avoid large assets on Vercel.

## Setup
1) Create a Storage bucket named `manuals`.
2) Mark the bucket as Public.
3) Set env vars (local or CI).

```powershell
$env:SUPABASE_URL="https://<project>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
$env:MANUALS_BUCKET="manuals"
$env:MANUALS_LOCAL_DIR="C:\\path\\to\\web\\public\\manuals\\splits"
```

## Run
```powershell
cd web
node scripts/migrate_manuals_to_storage.mjs
```

## Vercel env vars
```
MANUALS_BASE_URL=https://<project>.supabase.co/storage/v1/object/public/manuals
```

PDF links will be generated from `MANUALS_BASE_URL`.

## CORS (Required for fetch-based PDF viewers)
If you use pdf.js or any fetch-based viewer, set Allowed Origins in Supabase Storage:
- `https://<your-app>.vercel.app`
- `http://localhost:3000`

### Vercel Preview note
Preview deployments use random subdomains, which may cause CORS errors. Use Production URL or add a proxy endpoint if needed.

## Cache busting
If you overwrite PDFs with the same filename, set:
- `MANUALS_CACHE_BUST=2025-01-01`

This appends `?v=...` to manual URLs.
