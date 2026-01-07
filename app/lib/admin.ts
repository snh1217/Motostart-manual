import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { buildUrl, fetchJson } from "@/lib/api";

const TOKEN_KEY = "admin_token";
const ROLE_KEY = "admin_role";

export type AdminRole = "admin" | "user" | null;

export type AdminAuthState = {
  token: string | null;
  role: AdminRole;
  loading: boolean;
  login: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

export const useAdminAuth = (): AdminAuthState => {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedRole = await SecureStore.getItemAsync(ROLE_KEY);
        setToken(storedToken ?? null);
        setRole((storedRole as AdminRole) ?? null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const login = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return false;
    try {
      const response = await fetchJson<{
        ok: boolean;
        role?: string;
        adminToken?: string | null;
      }>(buildUrl("/api/auth/login"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });

      const nextRole = (response.role as AdminRole) ?? null;
      const nextToken = response.adminToken ?? (nextRole === "admin" ? trimmed : null);
      if (nextToken) {
        await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
        setToken(nextToken);
      }
      if (nextRole) {
        await SecureStore.setItemAsync(ROLE_KEY, nextRole);
        setRole(nextRole);
      }
      return nextRole === "admin";
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(buildUrl("/api/auth/logout"), { method: "POST" });
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(ROLE_KEY);
      setToken(null);
      setRole(null);
    }
  }, []);

  return { token, role, loading, login, logout };
};
