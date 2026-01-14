Diagnosis Trees (Supabase)

1) Apply schema
- Run `web/supabase/migrations/20260114_diagnosis_trees.sql`.
- Run `web/supabase/migrations/20260114_cases_diagnosis_fields.sql`.

2) RLS policy
- The policy uses `auth.jwt() ->> 'role' = 'admin'`.
- Update this to match your auth model (profiles.is_admin, JWT claim, etc).

3) Env variables
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (reader)
- `SUPABASE_SERVICE_ROLE_KEY` (admin write)

4) Fallback
- If the DB is empty or unreachable, `/diagnosis` uses JSON trees in
  `web/data/diagnosis/trees`.

5) Admin
- `/admin/diagnosis` uses the admin token to call `/api/diagnosis/trees`.
- Uploading a tree increments `version` on the same `tree_id`.
