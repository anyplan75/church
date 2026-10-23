"use client";

import { useMemo, useState } from "react";
import { ChurchFileField } from "@/components/church-file-field";
import { ChurchTagFilters } from "@/components/church-tag-filters";
import type { ChurchRecord } from "@/map/church-sheet";
import { normalizeChurchTags, type ChurchTag } from "@/map/church-tags";
import { importChurchSheetAction, removeChurchAction, saveChurchAction } from "@/server/map/church-actions";
import { updateGatheringAction } from "@/server/place/actions";

const FIELD = "w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug";

function matching<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase("ko");
  if (!needle) return [...rows];
  return rows.filter((row) => row.name.toLocaleLowerCase("ko").includes(needle));
}

function toggleTag(tags: readonly ChurchTag[], tag: ChurchTag): ChurchTag[] {
  return tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
}

/** 사역자가 교회와 모들 이름·주소를 한 화면에서 고칩니다. */
export function OperatorPlaces({
  churches,
  gatherings,
}: {
  churches: ChurchRecord[];
  gatherings: readonly { id: string; name: string; address: string }[];
}) {
  const [churchQuery, setChurchQuery] = useState("");
  const [gatheringQuery, setGatheringQuery] = useState("");
  const [addTags, setAddTags] = useState<ChurchTag[]>([]);
  const churchRows = useMemo(() => matching(churches, churchQuery), [churches, churchQuery]);
  const gatheringRows = useMemo(() => matching(gatherings, gatheringQuery), [gatherings, gatheringQuery]);

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="operator-places">
      <section className="grid gap-3" data-testid="operator-church-section">
        <h2 className="text-lg font-semibold leading-snug">교회</h2>
        <label className="grid gap-1">
          <span className="font-semibold">교회 이름</span>
          <input
            value={churchQuery}
            onChange={(event) => setChurchQuery(event.target.value)}
            placeholder="교회 이름"
            aria-label="교회 이름 검색"
            data-testid="operator-church-search"
            className={FIELD}
          />
        </label>
        <p className="leading-relaxed">{churchRows.length}곳</p>
        {churchRows.length === 0 ? (
          <p className="leading-relaxed">등록된 교회가 없습니다.</p>
        ) : (
          <ul data-testid="operator-church-list" aria-label="교회 목록" className="grid max-h-[40rem] list-none gap-3 overflow-y-auto">
            {churchRows.map((church) => (
              <li key={church.id} data-testid="operator-church-row" className="grid gap-2 rounded-2xl border border-[#e5e7eb] bg-white p-3">
                <form action={saveChurchAction} className="grid gap-2">
                  <input type="hidden" name="churchId" value={church.id} />
                  {normalizeChurchTags(church.tags).map((tag) => (
                    <input key={tag} type="hidden" name="tags" value={tag} />
                  ))}
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">교회이름</span>
                    <input name="name" required defaultValue={church.name} aria-label={`${church.name} 이름`} className={FIELD} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">주소</span>
                    <input name="address" defaultValue={church.address} aria-label={`${church.name} 주소`} className={FIELD} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">담임목사</span>
                    <input name="pastorName" defaultValue={church.pastorName} aria-label={`${church.name} 담임목사`} className={FIELD} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">전화번호</span>
                    <input name="phone" defaultValue={church.phone} aria-label={`${church.name} 전화번호`} className={FIELD} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">주일 예배시간</span>
                    <input name="serviceTime" defaultValue={church.serviceTime} aria-label={`${church.name} 주일 예배시간`} className={FIELD} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">메모</span>
                    <input name="memo" defaultValue={church.memo} aria-label={`${church.name} 메모`} className={FIELD} />
                  </label>
                  <button type="submit" className="w-fit rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white">
                    저장
                  </button>
                </form>
                <form action={removeChurchAction}>
                  <input type="hidden" name="churchId" value={church.id} />
                  <button type="submit" className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold">
                    삭제
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={saveChurchAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <h3 className="font-semibold leading-snug">교회 추가</h3>
          {addTags.map((tag) => (
            <input key={tag} type="hidden" name="tags" value={tag} />
          ))}
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
          <ChurchTagFilters testId="church-add-tags" selected={new Set(addTags)} onToggle={(tag) => setAddTags((current) => toggleTag(current, tag))} />
          <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
            저장
          </button>
        </form>
        <form action={importChurchSheetAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <h3 className="font-semibold leading-snug">엑셀로 넣기</h3>
          <p className="leading-relaxed text-[#4b5563]">첫 줄 칸 이름은 교회이름, 담임목사, 주소, 전화번호, 주일 예배시간, 메모 순서입니다.</p>
          <ChurchFileField />
          <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
            엑셀 넣기
          </button>
        </form>
      </section>
      <section className="grid content-start gap-3" data-testid="operator-gathering-section">
        <h2 className="text-lg font-semibold leading-snug">모들</h2>
        <label className="grid gap-1">
          <span className="font-semibold">모들 이름</span>
          <input
            value={gatheringQuery}
            onChange={(event) => setGatheringQuery(event.target.value)}
            placeholder="모들 이름"
            aria-label="모들 이름 검색"
            data-testid="operator-gathering-search"
            className={FIELD}
          />
        </label>
        <p className="leading-relaxed">{gatheringRows.length}곳</p>
        {gatheringRows.length === 0 ? (
          <p className="leading-relaxed">등록된 모들이 없습니다.</p>
        ) : (
          <ul data-testid="operator-gathering-list" aria-label="모들 목록" className="grid max-h-[40rem] list-none gap-3 overflow-y-auto">
            {gatheringRows.map((gathering) => (
              <li key={gathering.id} data-testid="operator-gathering-row" className="rounded-2xl border border-[#e5e7eb] bg-white p-3">
                <form action={updateGatheringAction} className="grid gap-2">
                  <input type="hidden" name="groupId" value={gathering.id} />
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">모들 이름</span>
                    <input name="name" required defaultValue={gathering.name} aria-label={`${gathering.name} 이름`} className={FIELD} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold">주소</span>
                    <input name="address" defaultValue={gathering.address} aria-label={`${gathering.name} 주소`} className={FIELD} />
                  </label>
                  <button type="submit" className="w-fit rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white">
                    저장
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
