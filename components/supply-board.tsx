"use client";

import { useRef, useState } from "react";
import { useChurch } from "@/components/church-state";
import { readItemPhoto } from "@/lib/item-photo";
import { can } from "@/lib/roles";
import { moveSupply, registerSupply, removeSupply } from "@/lib/supply-actions";
import { SUPPLY_STATUSES, type Supply, type SupplyStatus } from "@/lib/types";

export function SupplyBoard() {
  const { ready, user, db } = useChurch();
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [status, setStatus] = useState<SupplyStatus | "">("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready || !user || !db) return null;
  const editable = can(user.roles, "mutate.inventory");
  const departments = db.departments;
  const selectedDepartment = departmentId || departments[0]?.id || "";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage("");
    try {
      setPhoto(await readItemPhoto(file));
    } catch (error) {
      setPhoto("");
      setMessage(error instanceof Error ? error.message : "사진을 읽지 못했습니다.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!photo) {
      setMessage("사진을 먼저 찍어 주세요.");
      return;
    }
    setBusy(true);
    const result = await registerSupply({
      name,
      photo,
      departmentId: selectedDepartment,
      newDepartment,
      status,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPhoto("");
    setName("");
    setNewDepartment("");
    setStatus("");
    setMessage("");
    if (cameraRef.current) cameraRef.current.value = "";
    if (albumRef.current) albumRef.current.value = "";
  }

  return (
    <div className="page">
      <p className="text-sm font-semibold text-gold">부서</p>
      <h1 className="mt-1 font-serif text-4xl">물품</h1>
      <p className="mt-2 text-muted">부서에 지금 있는 것, 앞으로 필요한 것, 요청이 들어온 것을 한 화면에서 봅니다.</p>
      {message ? <p className="mt-4 text-sm text-wine">{message}</p> : null}

      {editable ? (
        <form onSubmit={submit} className="card mt-6 p-5">
          <h2 className="font-serif text-2xl">사진으로 등록</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-dashed border-line bg-white">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="등록할 물품" className="max-h-80 w-full object-contain" />
            ) : (
              <p className="px-6 py-16 text-center text-muted">사진이 먼저입니다. 카메라로 찍거나 앨범에서 고르세요.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()}>
              카메라로 찍기
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => albumRef.current?.click()}>
              앨범에서 고르기
            </button>
            {photo ? (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setPhoto("");
                  setName("");
                  setStatus("");
                }}
              >
                사진 다시 고르기
              </button>
            ) : null}
          </div>
          <input ref={cameraRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void onFile(event.target.files?.[0])} />
          <input ref={albumRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => void onFile(event.target.files?.[0])} />

          {photo ? (
            <div className="mt-5 space-y-4">
              <label className="field">
                <span>이름</span>
                <input className="input" value={name} maxLength={40} required placeholder="한 줄 이름" onChange={(event) => setName(event.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">
                  <span>부서</span>
                  <select className="select" value={selectedDepartment} onChange={(event) => setDepartmentId(event.target.value)}>
                    {departments.length === 0 ? <option value="">부서 없음</option> : null}
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>새 부서</span>
                  <input className="input" value={newDepartment} maxLength={40} placeholder="없으면 여기에 적기" onChange={(event) => setNewDepartment(event.target.value)} />
                </label>
              </div>
              <fieldset>
                <legend className="text-sm text-muted">어디에 둘까요</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUPPLY_STATUSES.map((item) => (
                    <label key={item.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${status === item.id ? "border-pine bg-pine-soft font-semibold text-pine" : "border-line"}`}>
                      <input className="sr-only" type="radio" name="status" value={item.id} checked={status === item.id} required onChange={() => setStatus(item.id)} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "저장 중" : "등록"}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {SUPPLY_STATUSES.map((column) => (
          <section key={column.id} className="card p-4">
            <h2 className="font-serif text-2xl">{column.label}</h2>
            <SupplyList
              items={db.supplies.filter((item) => item.status === column.id)}
              departmentName={(id) => departments.find((department) => department.id === id)?.name ?? "부서"}
              editable={editable}
              onMove={(id, next) => void moveSupply(id, next)}
              onRemove={(id) => {
                if (window.confirm("이 물품을 지울까요?")) void removeSupply(id);
              }}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function SupplyList({
  items,
  departmentName,
  editable,
  onMove,
  onRemove,
}: {
  items: Supply[];
  departmentName: (id: string) => string;
  editable: boolean;
  onMove: (id: string, status: SupplyStatus) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return <p className="mt-4 text-muted">아직 없습니다.</p>;
  return (
    <div className="mt-4 space-y-4">
      {items.map((item) => (
        <article key={item.id} className="overflow-hidden rounded-2xl border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.photo} alt={item.name} className="h-40 w-full object-cover" />
          <div className="p-3">
            <h3 className="font-serif text-xl">{item.name}</h3>
            <p className="text-sm text-muted">{departmentName(item.departmentId)}</p>
            {editable ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {SUPPLY_STATUSES.filter((status) => status.id !== item.status).map((status) => (
                  <button key={status.id} type="button" className="btn btn-quiet btn-small" onClick={() => onMove(item.id, status.id)}>
                    {status.label}
                  </button>
                ))}
                <button type="button" className="btn btn-quiet btn-small text-wine" onClick={() => onRemove(item.id)}>
                  삭제
                </button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
