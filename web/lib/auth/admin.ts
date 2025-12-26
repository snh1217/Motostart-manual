import "server-only";

export const isReadOnlyMode = () => process.env.READ_ONLY_MODE === "1";

export const isAdminAuthorized = (request: Request) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return false;
  return value === token;
};
