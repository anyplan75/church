import { mutationUser, updateDb } from "./app-db";
import { isItemPhoto, isSupplyStatus, oneLine, resolveDepartment } from "./supplies";
import type { SupplyStatus } from "./types";

export async function registerSupply(input: {
  name: string;
  photo: string;
  departmentId: string;
  newDepartment: string;
  status: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = mutationUser("mutate.inventory");
  if (!auth.ok) return auth;
  const name = oneLine(input.name, 40);
  if (!name) return { ok: false, message: "이름을 한 줄로 적어 주세요." };
  if (!isItemPhoto(input.photo)) return { ok: false, message: "사진을 먼저 찍어 주세요." };
  const status = input.status;
  if (!isSupplyStatus(status)) return { ok: false, message: "있는 것, 필요한 것, 요청 중 하나를 골라 주세요." };

  let saved = false;
  updateDb((db) => {
    const resolved = resolveDepartment(db.departments, input.departmentId, input.newDepartment);
    if (!resolved) return;
    db.departments = resolved.departments;
    db.supplies.push({
      id: crypto.randomUUID(),
      departmentId: resolved.id,
      name,
      photo: input.photo,
      status,
    });
    saved = true;
  });
  if (!saved) return { ok: false, message: "부서를 고르거나 새로 적어 주세요." };
  return { ok: true };
}

export async function moveSupply(id: string, status: SupplyStatus): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = mutationUser("mutate.inventory");
  if (!auth.ok) return auth;
  if (!isSupplyStatus(status)) return { ok: false, message: "옮길 곳을 골라 주세요." };
  updateDb((db) => {
    const item = db.supplies.find((supply) => supply.id === id);
    if (item) item.status = status;
  });
  return { ok: true };
}

export async function removeSupply(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = mutationUser("mutate.inventory");
  if (!auth.ok) return auth;
  updateDb((db) => {
    db.supplies = db.supplies.filter((supply) => supply.id !== id);
  });
  return { ok: true };
}
