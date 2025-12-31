"use client";

import { useEffect } from "react";

type AppContext = {
  adminToken?: string;
  platform?: string;
  appVersion?: string;
  pushToken?: string;
  userId?: string;
};

declare global {
  interface Window {
    __APP_CONTEXT__?: AppContext;
    ReactNativeWebView?: { postMessage: (payload: string) => void };
  }
}

const applyContext = (context?: AppContext) => {
  if (!context?.adminToken) return;
  try {
    localStorage.setItem("adminToken", context.adminToken);
    window.dispatchEvent(new Event("admin-token-changed"));
  } catch {
    // Ignore localStorage failures.
  }
};

const syncPushToken = async (token: string) => {
  try {
    const cachedToken = localStorage.getItem("cached_push_token");
    const cachedUserId = localStorage.getItem("cached_user_id");
    const contextUserId =
      typeof window.__APP_CONTEXT__?.userId === "string"
        ? window.__APP_CONTEXT__?.userId
        : null;
    const currentUserId = contextUserId ?? "anonymous";

    if (cachedToken === token && cachedUserId === currentUserId) return;

    const context = window.__APP_CONTEXT__;
    const payload = {
      token,
      platform: context?.platform,
      appVersion: context?.appVersion,
    };

    const response = await fetch("/api/push/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      localStorage.setItem("cached_push_token", token);
      localStorage.setItem("cached_user_id", currentUserId);
    }
  } catch {
    // Ignore network failures.
  }
};

const applyMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return;
  const message = payload as { type?: string; value?: string; source?: string };
  if (message.source !== "app") return;
  if (message.type === "adminToken" && message.value) {
    applyContext({ adminToken: message.value });
  }
  if (message.type === "pushToken" && message.value) {
    try {
      localStorage.setItem("pushToken", message.value);
      void syncPushToken(message.value);
    } catch {
      // Ignore localStorage failures.
    }
  }
};

export default function AppBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as AppContext | undefined;
      applyContext(detail);
    };

    const messageHandler = (event: MessageEvent) => {
      if (event.origin && event.origin !== window.location.origin && event.origin !== "null") {
        return;
      }
      try {
        const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        applyMessage(payload);
      } catch {
        // Ignore invalid payloads.
      }
    };

    applyContext(window.__APP_CONTEXT__);

    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: "requestAdminToken" })
      );
    }

    window.addEventListener("app-context", handler);
    window.addEventListener("message", messageHandler);
    return () => {
      window.removeEventListener("app-context", handler);
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  return null;
}
