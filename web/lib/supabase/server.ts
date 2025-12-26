import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = hasSupabaseConfig
  ? createClient(supabaseUrl as string, serviceRoleKey as string, {
      auth: { persistSession: false },
    })
  : null;

export const supabaseReader =
  supabaseUrl && anonKey
    ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    : supabaseAdmin;
