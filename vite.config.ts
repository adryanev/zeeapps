import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const SERVICE_WORKER_VERSION_TOKEN = "__DUNIA_ZEE_CACHE_VERSION__";
const buildVersion = resolveBuildVersion(process.env.DUNIA_ZEE_BUILD_VERSION);
const appBasePath = resolveAppBasePath(process.env.DUNIA_ZEE_BASE_PATH);

export default defineConfig({
  base: appBasePath,
  define: {
    __DUNIA_ZEE_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  plugins: [stampServiceWorkerVersion(buildVersion)],
});

export function resolveAppBasePath(rawBasePath: string | undefined): string {
  const normalizedBasePath = rawBasePath?.trim() || "/";
  if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(normalizedBasePath)) {
    throw new Error("DUNIA_ZEE_BASE_PATH must start and end with a slash and contain URL-safe segments.");
  }

  return normalizedBasePath;
}

function resolveBuildVersion(rawBuildVersion: string | undefined): string {
  const normalizedBuildVersion = rawBuildVersion?.trim() ?? "";
  if (/^[A-Za-z0-9._-]+$/.test(normalizedBuildVersion)) {
    return normalizedBuildVersion;
  }

  return `build-${Date.now().toString(36)}`;
}

function stampServiceWorkerVersion(version: string): Plugin {
  return {
    name: "dunia-zee-service-worker-version",
    apply: "build",
    closeBundle() {
      const serviceWorkerPath = resolve(process.cwd(), "dist/service-worker.js");
      const source = readFileSync(serviceWorkerPath, "utf8");
      if (!source.includes(SERVICE_WORKER_VERSION_TOKEN)) {
        throw new Error("The service worker cache-version token is missing from the build output.");
      }

      writeFileSync(
        serviceWorkerPath,
        source.replaceAll(SERVICE_WORKER_VERSION_TOKEN, version),
        "utf8",
      );
    },
  };
}
