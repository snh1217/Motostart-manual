export const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://motostart-manual.vercel.app";

export const buildUrl = (
  path: string,
  params?: Record<string, string | number | undefined>
) => {
  const url = new URL(path, WEB_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

export const fetchJson = async <T,>(
  url: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};
