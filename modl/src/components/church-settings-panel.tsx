"use client";

import { useMemo, useState } from "react";
import { ChurchFileField } from "@/components/church-file-field";
import type { ChurchRecord } from "@/map/church-sheet";
import type { JejuCity } from "@/map/region";
import { importChurchSheetAction, removeChurchAction, saveChurchAction } from "@/server/map/church-actions";

const FIELD = "w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug";

function regionLine(region: JejuCity | null): string {
  return region ?? "";
}

export function ChurchSettingsPanel({ churches }: { churches: ChurchRecord[] }) {
  const [city, setCity] = useState<"all" | JejuCity>("all");
  const counts = useMemo(
    () => ({
      jeju: churches.filter((church) => church.region === "제주시").length,
      seogwipo: churches.filter((church) => church.region === "서귀포시").length,
    }),
    [churches],
  );
  const shown = city === "all" ? churches : churches.filter((church) => church.region === city);

  return (
    <section className="grid gap-4">
      <p className="leading-relaxed text-[#4b5563]">
        지역은 주소에 제주시 또는 서귀포시가 하나만 있을 때 채웁니다. 애매하면 비워 둡니다.
      </p>
      <p className="leading-relaxed">
        제주시 {counts.jeju}곳 · 서귀포시 {counts.seogwipo}곳
      </p>
      <div role="tablist" aria-label="교회 지역" className="flex flex-wrap gap-2">
        {(
          [
            ["all", "전체"],
            ["제주시", "제주시"],
            ["서귀포시", "서귀포시"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={city === id}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${city === id ? "bg-[#111827] text-white" : "bg-white text-[#475569]"}`}
            onClick={() => setCity(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <form action={saveChurchAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="font-semibold leading-snug">교회 추가</h2>
        <label className="grid gap-1">
          <span className="font-semibold">교회이름</span>
          <input name="name" required className={FIELD} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">담임목사</span>
          <input name="pastorName" className={FIELD} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">주소</span>
          <input name="address" className={FIELD} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">전화번호</span>
          <input name="phone" className={FIELD} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">주일 예배시간</span>
          <input name="serviceTime" className={FIELD} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">메모</span>
          <input name="memo" className={FIELD} />
        </label>
        <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          저장
        </button>
      </form>
      <form action={importChurchSheetAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="font-semibold leading-snug">엑셀로 넣기</h2>
        <p className="leading-relaxed text-[#4b5563]">첫 줄 칸 이름은 교회이름, 담임목사, 주소, 전화번호, 주일 예배시간, 메모 순서입니다.</p>
        <ChurchFileField />
        <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          엑셀 넣기
        </button>
      </form>
      {shown.length === 0 ? (
        <p className="leading-relaxed">{churches.length === 0 ? "등록된 교회가 없습니다." : "이 지역의 교회가 없습니다."}</p>
      ) : (
        <ul className="grid list-none gap-3">
          {shown.map((church) => (
            <li key={church.id} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <form action={saveChurchAction} className="grid gap-3">
                <input type="hidden" name="churchId" value={church.id} />
                <label className="grid gap-1">
                  <span className="font-semibold">교회이름</span>
                  <input name="name" required defaultValue={church.name} className={FIELD} />
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">담임목사</span>
                  <input name="pastorName" defaultValue={church.pastorName} className={FIELD} />
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">주소</span>
                  <input name="address" defaultValue={church.address} className={FIELD} />
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">전화번호</span>
                  <input name="phone" defaultValue={church.phone} className={FIELD} />
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">주일 예배시간</span>
                  <input name="serviceTime" defaultValue={church.serviceTime} className={FIELD} />
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">메모</span>
                  <input name="memo" defaultValue={church.memo} className={FIELD} />
                </label>
                <p className="leading-relaxed text-[#4b5563]">지역 {regionLine(church.region)}</p>
                <p className="leading-relaxed text-[#4b5563]">{church.pinned ? "지도에 핀이 있습니다." : "주소가 없거나 좌표를 찾지 못해 핀이 없습니다."}</p>
                <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
                  수정
                </button>
              </form>
              <form action={removeChurchAction}>
                <input type="hidden" name="churchId" value={church.id} />
                <button type="submit" className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold">
                  삭제
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
