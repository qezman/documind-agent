// Required env vars for this service. Fails fast on startup if missing
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  GEMINI_API_KEY: required("GEMINI_API_KEY"),
  PORT: parseInt(process.env.PORT ?? "3003", 10),

  // Role scope in documind-gitops/manifests/agent/rbac.yaml.
  TARGET_NAMESPACE: process.env.TARGET_NAMESPACE ?? "documind",
};
