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

export function go(path: string): never {
  const target = `${pageBase()}${path.startsWith("/") ? path : `/${path}`}`;
  if (typeof window !== "undefined") window.location.assign(target);
  throw new Error("NAV");
}
