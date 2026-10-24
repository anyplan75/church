"use client";

import { useMemo, useState } from "react";
import { filterByName } from "@/map/church-search";
import { assignStewardAction } from "@/server/place/actions";

const FIELD = "min-w-0 flex-1 rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

/** 교회 이름과 모들 이름을 따로 보여 주고, 그 자리에서 관리자를 지정합니다. */
export function ManagerAssign({
  churches,
  gatherings,
}: {
  churches: readonly { id: string; name: string }[];
  gatherings: readonly { id: string; name: string }[];
}) {
  const [churchQuery, setChurchQuery] = useState("");
  const [gatheringQuery, setGatheringQuery] = useState("");
  const churchRows = useMemo(() => filterByName(churches, churchQuery), [churches, churchQuery]);
  const gatheringRows = useMemo(() => filterByName(gatherings, gatheringQuery), [gatherings, gatheringQuery]);

  return (
    <section className="grid gap-4 rounded-3xl bg-[#fffaf3] p-4" data-testid="manager-assign">
      <h2 className="text-lg font-semibold leading-snug">교회·모들 관리자 지정</h2>
      <p className="leading-relaxed text-[#5c5148]">교회 이름과 모들 이름을 따로 찾습니다. 그 이름 옆에서 관리자를 지정합니다. 등급은 고르지 않습니다.</p>
      <div className="grid gap-2">
        <h3 className="font-semibold">교회</h3>
        <input
          value={churchQuery}
          onChange={(event) => setChurchQuery(event.target.value)}
          placeholder="교회 이름"
          aria-label="교회 이름"
          data-testid="manager-church-search"
          className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
        />
        <NameList kind="church" query={churchQuery} rows={churchRows} empty="교회 이름을 적으면 그 교회가 나옵니다." />
      </div>
      <div className="grid gap-2">
        <h3 className="font-semibold">모들</h3>
        <input
          value={gatheringQuery}
          onChange={(event) => setGatheringQuery(event.target.value)}
          placeholder="모들 이름"
          aria-label="모들 이름"
          data-testid="manager-gathering-search"
          className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
        />
        <NameList kind="gathering" query={gatheringQuery} rows={gatheringRows} empty="모들 이름을 적으면 그 모들이 나옵니다." />
      </div>
    </section>
  );
}

function NameList({
  kind,
  query,
  rows,
  empty,
}: {
  kind: "church" | "gathering";
  query: string;
  rows: readonly { id: string; name: string }[];
  empty: string;
}) {
  if (!query.trim()) return <p className="leading-relaxed text-[#5c5148]">{empty}</p>;
  if (rows.length === 0) return <p className="leading-relaxed text-[#5c5148]">그 이름의 항목이 없습니다.</p>;
  return (
    <ul className="grid max-h-80 list-none gap-2 overflow-y-auto" data-testid={kind === "church" ? "manager-church-list" : "manager-gathering-list"}>
      {rows.map((row) => (
        <li key={row.id} className="grid gap-2 rounded-2xl bg-white px-3 py-3 sm:flex sm:items-center sm:justify-between">
          <p className="font-semibold">{row.name}</p>
          <form action={assignStewardAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="placeId" value={row.id} />
            <input name="email" type="email" required placeholder="관리자 이메일" aria-label={`${row.name} 관리자 이메일`} className={FIELD} />
            <button type="submit" className="rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
              관리자 지정
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
