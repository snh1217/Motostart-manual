import "server-only";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { hasSupabaseConfig, supabaseAdmin } from "../supabase/server";

export type UserLoginCode = {
  id: string;
  name: string;
  code: string;
  memo?: string;
  active?: boolean;
};

export type LoginCodes = {
  adminLoginToken?: string;
  userCodes?: UserLoginCode[];
  loginToken?: string;
};

const CODES_PATH = path.join(process.cwd(), "data", "login_codes.json");
const ADMIN_ROW_ID = "admin-login";

const normalizeCode = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeUserCodes = (value: unknown) => {
  if (!Array.isArray(value)) return [] as UserLoginCode[];
  const entries: UserLoginCode[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Partial<UserLoginCode>;
    const name = normalizeCode(record.name);
    const code = normalizeCode(record.code);
    if (!name || !code) return;
    const id = normalizeCode(record.id) ?? `user-${index + 1}`;
    const memo = normalizeCode(record.memo);
    const active = typeof record.active === "boolean" ? record.active : true;
    entries.push({ id, name, code, memo, active });
  });
  return entries;
};

const ensureUserCodeIds = (codes: UserLoginCode[]) =>
  codes.map((entry) => ({
    ...entry,
    id: normalizeCode(entry.id) ?? randomUUID(),
    active: typeof entry.active === "boolean" ? entry.active : true,
  }));

const readLoginCodesFromFile = async (): Promise<LoginCodes> => {
  try {
    const raw = await fs.readFile(CODES_PATH, "utf8");
    const parsed = JSON.parse(raw) as LoginCodes;
    const userCodes = normalizeUserCodes(parsed.userCodes);
    const legacyLoginToken = normalizeCode(parsed.loginToken);
    return {
      adminLoginToken: normalizeCode(parsed.adminLoginToken),
      userCodes:
        userCodes.length > 0
          ? userCodes
          : legacyLoginToken
          ? [{ id: "legacy", name: "legacy", code: legacyLoginToken, active: true }]
          : [],
    };
  } catch {
    return {};
  }
};

const readLoginCodesFromDb = async (): Promise<LoginCodes | null> => {
  if (!hasSupabaseConfig || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("login_codes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return null;

  const rows = data ?? [];
  const adminRow = rows.find(
    (row) => row.role === "admin" && row.active !== false
  );
  const userCodes = rows
    .filter((row) => row.role !== "admin")
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      code: String(row.code),
      memo: row.memo ?? undefined,
      active: row.active !== false,
    }));

  return {
    adminLoginToken: adminRow?.code ? String(adminRow.code) : undefined,
    userCodes,
  };
};

export const readLoginCodes = async (): Promise<LoginCodes> => {
  if (hasSupabaseConfig && supabaseAdmin) {
    const dbCodes = await readLoginCodesFromDb();
    if (dbCodes) return dbCodes;
  }
  return readLoginCodesFromFile();
};

export const resolveLoginCodes = async (): Promise<LoginCodes> => {
  const stored = await readLoginCodes();
  const envLoginToken = normalizeCode(process.env.LOGIN_TOKEN);
  const fallbackUserCodes =
    envLoginToken && (!stored.userCodes || stored.userCodes.length === 0)
      ? [{ id: "env-user", name: "env", code: envLoginToken, active: true }]
      : [];
  return {
    userCodes: stored.userCodes?.length ? stored.userCodes : fallbackUserCodes,
    adminLoginToken:
      stored.adminLoginToken ??
      normalizeCode(process.env.ADMIN_LOGIN_TOKEN) ??
      normalizeCode(process.env.ADMIN_TOKEN),
  };
};

const writeLoginCodesToDb = async (codes: LoginCodes) => {
  if (!hasSupabaseConfig || !supabaseAdmin) return false;

  const userCodes = ensureUserCodeIds(normalizeUserCodes(codes.userCodes ?? []));
  const adminLoginToken = normalizeCode(codes.adminLoginToken);
  const now = new Date().toISOString();

  if (userCodes.length > 0) {
    const payload = userCodes.map((entry) => ({
      id: entry.id,
      role: "user",
      name: entry.name,
      code: entry.code,
      memo: entry.memo ?? null,
      active: entry.active !== false,
      updated_at: now,
    }));
    const { error } = await supabaseAdmin
      .from("login_codes")
      .upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  const userIds = userCodes.map((entry) => entry.id);
  if (userIds.length > 0) {
    const formatted = userIds.map((id) => `"${id}"`).join(",");
    const { error } = await supabaseAdmin
      .from("login_codes")
      .delete()
      .eq("role", "user")
      .not("id", "in", `(${formatted})`);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("login_codes")
      .delete()
      .eq("role", "user");
    if (error) throw new Error(error.message);
  }

  if (adminLoginToken) {
    const { error } = await supabaseAdmin
      .from("login_codes")
      .upsert(
        {
          id: ADMIN_ROW_ID,
          role: "admin",
          name: "admin",
          code: adminLoginToken,
          memo: null,
          active: true,
          updated_at: now,
        },
        { onConflict: "id" }
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("login_codes")
      .delete()
      .eq("id", ADMIN_ROW_ID);
    if (error) throw new Error(error.message);
  }

  return true;
};

export const writeLoginCodes = async (codes: LoginCodes) => {
  if (hasSupabaseConfig && supabaseAdmin) {
    const ok = await writeLoginCodesToDb(codes);
    if (ok) return;
  }

  await fs.mkdir(path.dirname(CODES_PATH), { recursive: true });
  const userCodes = ensureUserCodeIds(normalizeUserCodes(codes.userCodes ?? []));
  const payload = {
    adminLoginToken: normalizeCode(codes.adminLoginToken),
    userCodes,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(CODES_PATH, JSON.stringify(payload, null, 2));
};
