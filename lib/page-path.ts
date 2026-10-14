export function pageBase(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

export function cleanPath(pathname: string): string {
  const base = pageBase();
  let path = pathname || "/";
  if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
  path = path.split("?")[0] || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

export function navigationTarget(path: string, pathname = "/", base = pageBase()): string {
  const raw = path.startsWith("/") ? path : `/${path}`;
  const slashed = pathname.endsWith("/") ? withDirectorySlash(raw) : raw;
  return `${base}${slashed}`;
}

function withDirectorySlash(path: string): string {
  const hashAt = path.indexOf("#");
  const hash = hashAt === -1 ? "" : path.slice(hashAt);
  const beforeHash = hashAt === -1 ? path : path.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const pathname = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt === -1 ? "" : beforeHash.slice(queryAt);
  const directory = pathname === "/" || pathname.endsWith("/") ? pathname : `${pathname}/`;
  return `${directory}${query}${hash}`;
}

export function go(path: string): never {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const target = navigationTarget(path, pathname);
  if (typeof window !== "undefined") window.location.assign(target);
  throw new Error("NAV");
}
