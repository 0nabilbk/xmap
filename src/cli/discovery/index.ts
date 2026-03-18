import fs from "node:fs";
import path from "node:path";
import { discoverNextjsRoutes, type DiscoveredRoute } from "./nextjs.js";

export type Framework = "nextjs" | "unknown";

export type { DiscoveredRoute };

export async function detectFramework(repoPath: string): Promise<Framework> {
  const configNames = [
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
  ];

  for (const name of configNames) {
    if (fileExists(path.join(repoPath, name))) return "nextjs";
  }

  const appDirCandidates = [
    path.join(repoPath, "app"),
    path.join(repoPath, "src", "app"),
  ];
  const pagesDirCandidates = [
    path.join(repoPath, "pages"),
    path.join(repoPath, "src", "pages"),
  ];

  const hasAppDir = appDirCandidates.some(dirExists);
  const hasPagesDir = pagesDirCandidates.some(dirExists);

  if (hasAppDir || hasPagesDir) return "nextjs";

  return "unknown";
}

export async function discoverRoutes(
  repoPath: string
): Promise<{ framework: Framework; routes: DiscoveredRoute[] }> {
  const framework = await detectFramework(repoPath);

  switch (framework) {
    case "nextjs":
      return { framework, routes: await discoverNextjsRoutes(repoPath) };
    case "unknown":
      return { framework, routes: [] };
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function dirExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
