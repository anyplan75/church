import type { Department, SupplyStatus } from "./types";

const PHOTO_LIMIT = 1_200_000;

export function oneLine(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export function isItemPhoto(value: string): boolean {
  return /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value) && value.length > 32 && value.length <= PHOTO_LIMIT;
}

export function isSupplyStatus(value: string): value is SupplyStatus {
  return value === "have" || value === "need" || value === "requested";
}

export function resolveDepartment(
  departments: readonly Department[],
  departmentId: string,
  newName: string,
): { departments: Department[]; id: string } | null {
  const typed = oneLine(newName, 40);
  if (typed) {
    const existing = departments.find((department) => department.name.toLocaleLowerCase("ko") === typed.toLocaleLowerCase("ko"));
    if (existing) return { departments: departments.slice(), id: existing.id };
    const created = { id: crypto.randomUUID(), name: typed };
    return { departments: [...departments, created], id: created.id };
  }
  const found = departments.find((department) => department.id === departmentId);
  if (!found) return null;
  return { departments: departments.slice(), id: found.id };
}
