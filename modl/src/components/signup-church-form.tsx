"use client";

import { useMemo, useState } from "react";
import { ChurchTagFilters } from "@/components/church-tag-filters";
import { chooseSignupChurchAction, registerSignupChurchAction } from "@/server/login/church-actions";
import type { ChurchTag } from "@/map/church-tags";

const FIELD = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

function toggleTag(tags: readonly ChurchTag[], tag: ChurchTag): ChurchTag[] {
  return tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
}

/** 가입 뒤에 교회를 고르거나, 없을 때 그 자리에서 등록합니다. 등급과 지역 필터는 없습니다. */
export function SignupChurchForm({ churches }: { churches: { id: string; name: string; address: string }[] }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<ChurchTag[]>([]);
  const needle = query.trim();
  const shown = useMemo(
    () => churches.filter((church) => (needle ? church.name.includes(needle) || church.address.includes(needle) : true)),
    [churches, needle],
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold leading-snug">교회 목록</h2>
        <label className="grid gap-1">
          <span className="font-semibold">교회 이름</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름으로 찾기"
            className={FIELD}
            data-testid="signup-church-search"
          />
        </label>
        {shown.length === 0 ? (
          <p className="leading-relaxed">{churches.length === 0 ? "등록된 교회가 없습니다." : "찾는 교회가 목록에 없습니다."}</p>
        ) : (
          <ul data-testid="signup-church-list" aria-label="교회 목록" className="grid max-h-80 list-none gap-2 overflow-y-auto">
            {shown.map((church) => (
              <li key={church.id} className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                <p className="font-semibold leading-snug">{church.name}</p>
                {church.address ? <p className="text-sm leading-relaxed text-[#5c5148]">{church.address}</p> : null}
                <form action={chooseSignupChurchAction} className="mt-2">
                  <input type="hidden" name="churchId" value={church.id} />
                  <button type="submit" className="rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white" data-testid="signup-church-pick">
                    이 교회 선택
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form action={registerSignupChurchAction} id="signup-church-register" data-testid="signup-church-register" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold leading-snug">목록에 없으면 직접 등록</h2>
        {tags.map((tag) => (
          <input key={tag} type="hidden" name="tags" value={tag} />
        ))}
        <label className="grid gap-1">
          <span className="font-semibold">교회이름</span>
          <input name="name" required className={FIELD} data-testid="signup-church-name" />
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
          <input name="phone" className={FIELD} autoComplete="tel" />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">주일 예배시간</span>
          <input name="serviceTime" className={FIELD} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">메모</span>
          <input name="memo" className={FIELD} />
        </label>
        <ChurchTagFilters testId="signup-church-tags" selected={new Set(tags)} onToggle={(tag) => setTags((current) => toggleTag(current, tag))} />
        <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          교회 등록
        </button>
      </form>
    </div>
  );
}
