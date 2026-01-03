import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const filePath = path.resolve(process.cwd(), "data", "login_codes.json");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const normalize = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const main = async () => {
  let parsed = {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.warn("login_codes.json not found, using env tokens only.");
      parsed = {};
    } else {
      throw error;
    }
  }

  const envLoginToken = normalize(process.env.LOGIN_TOKEN);
  const envAdminLoginToken = normalize(
    process.env.ADMIN_LOGIN_TOKEN ?? process.env.ADMIN_TOKEN
  );

  const userCodes = Array.isArray(parsed.userCodes) ? parsed.userCodes : [];
  const legacyLoginToken = normalize(parsed.loginToken) ?? envLoginToken;
  const adminLoginToken = normalize(parsed.adminLoginToken) ?? envAdminLoginToken;

  let upserted = 0;

  if (userCodes.length === 0 && legacyLoginToken) {
    userCodes.push({
      id: "legacy",
      name: "legacy",
      code: legacyLoginToken,
      active: true,
    });
  }

  for (const entry of userCodes) {
    const payload = {
      id: normalize(entry.id) ?? `user-${Math.random().toString(36).slice(2)}`,
      role: "user",
      name: normalize(entry.name) ?? "Unnamed",
      code: normalize(entry.code) ?? "",
      memo: normalize(entry.memo) ?? null,
      active: typeof entry.active === "boolean" ? entry.active : true,
      updated_at: new Date().toISOString(),
    };

    if (!payload.code) {
      console.warn(`skip empty code for ${payload.name}`);
      continue;
    }

    const { error } = await supabase
      .from("login_codes")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error(`failed ${payload.id}: ${error.message}`);
    } else {
      upserted += 1;
    }
  }

  if (adminLoginToken) {
    const adminPayload = {
      id: "admin-login",
      role: "admin",
      name: "admin",
      code: adminLoginToken,
      memo: null,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("login_codes")
      .upsert(adminPayload, { onConflict: "id" });
    if (error) {
      console.error(`failed admin: ${error.message}`);
    } else {
      upserted += 1;
    }
  }

  console.log(`done: ${upserted} rows upserted`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
