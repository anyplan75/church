"use client";

import { useMemo, useState } from "react";
import { ChurchFileField } from "@/components/church-file-field";
import { ChurchTagFilters } from "@/components/church-tag-filters";
import type { ChurchRecord } from "@/map/church-sheet";
import { churchMatchesTags, normalizeChurchTags, type ChurchTag } from "@/map/church-tags";
import type { JejuCity } from "@/map/region";
import { importChurchSheetAction, removeChurchAction, saveChurchAction } from "@/server/map/church-actions";

const FIELD = "w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug";

function regionLine(region: JejuCity | null): string {
  return region ?? "";
}

function toggleTag(tags: readonly ChurchTag[], tag: ChurchTag): ChurchTag[] {
  return tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
}

function TagFields({ tags }: { tags: readonly ChurchTag[] }) {
  return (
    <>
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
    </>
  );
}

/** 통역 교회 목록처럼 이름과 주소를 먼저 보여 주고, 고칠 때만 칸을 엽니다. */
export function ChurchSettingsPanel({ churches }: { churches: ChurchRecord[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<ChurchTag[]>([]);
  const [addTags, setAddTags] = useState<ChurchTag[]>([]);
  const shown = useMemo(() => churches.filter((church) => churchMatchesTags(church.tags, selected)), [churches, selected]);
  const editing = churches.find((church) => church.id === editingId) ?? null;

  function openEdit(church: ChurchRecord) {
    setEditingId(church.id);
    setEditTags(normalizeChurchTags(church.tags));
  }

  return (
    <section className="grid gap-4" data-testid="church-settings">
      <div className="grid gap-3">
        <h2 className="font-semibold leading-snug">교회 목록</h2>
        <p className="leading-relaxed text-[#4b5563]">태그는 주소로 만들지 않고, 수정에서 직접 켜고 끕니다.</p>
        <p className="leading-relaxed">{shown.length}곳</p>
        <ChurchTagFilters
          selected={selected}
          onToggle={(tag) => {
            setSelected((current) => {
              const next = new Set(current);
              if (next.has(tag)) next.delete(tag);
              else next.add(tag);
              return next;
            });
          }}
        />
      </div>
      {shown.length === 0 ? (
        <p className="leading-relaxed">{churches.length === 0 ? "등록된 교회가 없습니다." : "조건에 맞는 교회가 없습니다."}</p>
      ) : (
        <ul data-testid="church-list" aria-label="교회 목록" className="grid max-h-[32rem] list-none gap-2 overflow-y-auto">
          {shown.map((church) => (
            <li
              key={church.id}
              data-testid="church-row"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold leading-snug" data-testid="church-name">
                  {church.name}
                </p>
                {church.address ? (
                  <p className="text-sm leading-relaxed text-[#5c5148]">{church.address}</p>
                ) : (
                  <p className="text-sm leading-relaxed text-[#9a3412]">주소 없음</p>
                )}
                {church.region ? <p className="text-sm leading-relaxed text-[#5c5148]">{church.region}</p> : null}
                {church.tags.length > 0 ? <p className="text-sm leading-relaxed text-[#5c5148]">{church.tags.join(" · ")}</p> : null}
              </div>
              <button type="button" className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold" onClick={() => openEdit(church)}>
                수정
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <div className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <form action={saveChurchAction} className="grid gap-3">
            <input type="hidden" name="churchId" value={editing.id} />
            <TagFields tags={editTags} />
            <h2 className="font-semibold leading-snug">교회 정보 수정</h2>
            <label className="grid gap-1">
              <span className="font-semibold">교회이름</span>
              <input name="name" required defaultValue={editing.name} className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">담임목사</span>
              <input name="pastorName" defaultValue={editing.pastorName} className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">주소</span>
              <input name="address" defaultValue={editing.address} className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">전화번호</span>
              <input name="phone" defaultValue={editing.phone} className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">주일 예배시간</span>
              <input name="serviceTime" defaultValue={editing.serviceTime} className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">메모</span>
              <input name="memo" defaultValue={editing.memo} className={FIELD} />
            </label>
            <ChurchTagFilters testId="church-edit-tags" selected={new Set(editTags)} onToggle={(tag) => setEditTags((current) => toggleTag(current, tag))} />
            <p className="leading-relaxed text-[#4b5563]">지역 {regionLine(editing.region)}</p>
            <p className="leading-relaxed text-[#4b5563]">
              {editing.pinned ? "지도에 핀이 있습니다." : "주소가 없거나 좌표를 찾지 못해 핀이 없습니다."}
            </p>
            <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
              수정
            </button>
          </form>
          <form action={removeChurchAction}>
            <input type="hidden" name="churchId" value={editing.id} />
            <button type="submit" className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold">
              삭제
            </button>
          </form>
        </div>
      ) : null}
      <form action={saveChurchAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="font-semibold leading-snug">교회 추가</h2>
        <TagFields tags={addTags} />
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
      <form action={importChurchSheetAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="font-semibold leading-snug">엑셀로 넣기</h2>
        <p className="leading-relaxed text-[#4b5563]">첫 줄 칸 이름은 교회이름, 담임목사, 주소, 전화번호, 주일 예배시간, 메모 순서입니다.</p>
        <ChurchFileField />
        <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          엑셀 넣기
        </button>
      </form>
    </section>
  );
}
