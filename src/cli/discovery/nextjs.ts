import fs from "node:fs";
import path from "node:path";

export interface DiscoveredRoute {
  route: string;
  filePath: string;
  label: string;
  section: string;
  isDynamic: boolean;
  params: string[];
}

const PAGE_FILES = new Set(["page.tsx", "page.jsx", "page.ts", "page.js"]);
const PAGE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const PAGES_SKIP = new Set(["_app", "_document", "_error"]);
const NON_ROUTE_FILES = new Set([
  "layout",
  "loading",
  "error",
  "template",
  "not-found",
]);

export async function discoverNextjsRoutes(
  repoPath: string
): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];

  const appDirs = resolveAppDirs(repoPath);
  for (const { absolute, relative } of appDirs) {
    await scanAppDirectory(absolute, relative, [], routes);
  }

  const pagesDirs = resolvePagesDirs(repoPath);
  for (const { absolute, relative } of pagesDirs) {
    await scanPagesDirectory(absolute, relative, [], routes);
  }

  routes.sort((a, b) => a.route.localeCompare(b.route));
  return routes;
}

interface ResolvedDir {
  absolute: string;
  relative: string;
}

function resolveAppDirs(repoPath: string): ResolvedDir[] {
  const candidates = [
    { absolute: path.join(repoPath, "app"), relative: "app" },
    { absolute: path.join(repoPath, "src", "app"), relative: "src/app" },
  ];
  return candidates.filter((c) => dirExists(c.absolute));
}

function resolvePagesDirs(repoPath: string): ResolvedDir[] {
  const candidates = [
    { absolute: path.join(repoPath, "pages"), relative: "pages" },
    { absolute: path.join(repoPath, "src", "pages"), relative: "src/pages" },
  ];
  return candidates.filter((c) => dirExists(c.absolute));
}

function dirExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

async function scanAppDirectory(
  dir: string,
  relativeBase: string,
  segments: string[],
  routes: DiscoveredRoute[]
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const hasPage = entries.some(
    (e) => e.isFile() && PAGE_FILES.has(e.name)
  );

  if (hasPage) {
    const pageFile = entries.find(
      (e) => e.isFile() && PAGE_FILES.has(e.name)
    )!;
    const routeSegments = segments.filter(
      (s) => !isRouteGroup(s) && !isParallelRoute(s)
    );
    const routePath = "/" + routeSegments.join("/");

    if (!routePath.startsWith("/api/") && routePath !== "/api") {
      const filePath = path.join(
        relativeBase,
        ...segments,
        pageFile.name
      );
      const params = extractParams(routeSegments);

      routes.push({
        route: routePath || "/",
        filePath,
        label: generateLabel(routeSegments),
        section: routeSegments[0] || "",
        isDynamic: params.length > 0,
        params,
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (isPrivateFolder(entry.name)) continue;
    if (isParallelRoute(entry.name)) continue;

    await scanAppDirectory(
      path.join(dir, entry.name),
      relativeBase,
      [...segments, entry.name],
      routes
    );
  }
}

async function scanPagesDirectory(
  dir: string,
  relativeBase: string,
  segments: string[],
  routes: DiscoveredRoute[]
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      await scanPagesDirectory(
        path.join(dir, entry.name),
        relativeBase,
        [...segments, entry.name],
        routes
      );
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name);
    if (!PAGE_EXTENSIONS.has(ext)) continue;

    const baseName = path.basename(entry.name, ext);
    if (PAGES_SKIP.has(baseName)) continue;
    if (NON_ROUTE_FILES.has(baseName)) continue;

    const routeSegments =
      baseName === "index" ? [...segments] : [...segments, baseName];

    const routePath = "/" + routeSegments.join("/");
    if (routePath.startsWith("/api/") || routePath === "/api") continue;

    const filePath = path.join(relativeBase, ...segments, entry.name);
    const params = extractParams(routeSegments);

    routes.push({
      route: routePath || "/",
      filePath,
      label: generateLabel(routeSegments),
      section: routeSegments[0] || "",
      isDynamic: params.length > 0,
      params,
    });
  }
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function isParallelRoute(segment: string): boolean {
  return segment.startsWith("@");
}

function isPrivateFolder(name: string): boolean {
  return name.startsWith("_");
}

function extractParams(segments: string[]): string[] {
  const params: string[] = [];
  for (const seg of segments) {
    const optionalCatchAll = seg.match(/^\[\[\.\.\.(\w+)\]\]$/);
    if (optionalCatchAll) {
      params.push(optionalCatchAll[1]);
      continue;
    }
    const catchAll = seg.match(/^\[\.\.\.(\w+)\]$/);
    if (catchAll) {
      params.push(catchAll[1]);
      continue;
    }
    const dynamic = seg.match(/^\[(\w+)\]$/);
    if (dynamic) {
      params.push(dynamic[1]);
    }
  }
  return params;
}

function generateLabel(segments: string[]): string {
  if (segments.length === 0) return "Home";

  const last = segments[segments.length - 1];

  const optionalCatchAll = last.match(/^\[\[\.\.\.(\w+)\]\]$/);
  if (optionalCatchAll) {
    return formatSegment(optionalCatchAll[1]) + " (Catch All)";
  }
  const catchAll = last.match(/^\[\.\.\.(\w+)\]$/);
  if (catchAll) {
    return formatSegment(catchAll[1]) + " (Catch All)";
  }
  const dynamic = last.match(/^\[(\w+)\]$/);
  if (dynamic) {
    const paramName = dynamic[1];
    const parent = segments.length >= 2 ? segments[segments.length - 2] : null;
    if (parent && !parent.startsWith("[")) {
      return singularize(formatSegment(parent)) + " Detail";
    }
    return formatSegment(paramName) + " Detail";
  }

  return formatSegment(last);
}

function formatSegment(segment: string): string {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function singularize(word: string): string {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ses")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}
