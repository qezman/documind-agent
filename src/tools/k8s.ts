// Read-only diagnostic tools. Every function here is a READ, never a  write

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";

const execAsync = promisify(exec);

// Kubernetes resource names are lowercase alphanumerics and hyphens only
// (RFC 1123). Reject anything else before it reaches a shell command.
function sanitizeName(name: string): string {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid resource name: "${name}"`);
  }
  return name;
}

export async function listPods(): Promise<string> {
  const { stdout } = await execAsync(
    `kubectl get pods -n ${env.TARGET_NAMESPACE} -o wide`,
  );
  return stdout;
}

export async function getPodLogs(podName: string, lines = 50): Promise<string> {
  const safeName = sanitizeName(podName);
  const safeLines = Math.min(Math.max(lines, 1), 200);
  const { stdout } = await execAsync(
    `kubectl logs -n ${env.TARGET_NAMESPACE} ${safeName} --tail=${safeLines}`,
  );
  return stdout;
}

export async function describePod(podName: string): Promise<string> {
  const safeName = sanitizeName(podName);
  const { stdout } = await execAsync(
    `kubectl describe pod -n ${env.TARGET_NAMESPACE} ${safeName}`,
  );
  return stdout;
}

export async function queryLoki(logqlQuery: string): Promise<string> {
  const url =
    `http://loki.loki.svc.cluster.local:3100/loki/api/v1/query_range` +
    `?query=${encodeURIComponent(logqlQuery)}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Loki query failed: ${res.status} ${res.statusText}`);
  }
  return JSON.stringify(await res.json());
}
