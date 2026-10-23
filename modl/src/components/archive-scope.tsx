"use client";

import { useState } from "react";

type NamedPlace = { id: string; name: string };

/** 행사자료를 올릴 범위입니다. 속한 교회와 속한 모들을 모두 보여 주고, 미리 고르지 않습니다. */
export function ArchiveScope({
  churches,
  gatherings,
}: {
  churches: readonly NamedPlace[];
  gatherings: readonly NamedPlace[];
}) {
  const [audience, setAudience] = useState("");
  const showChurch = audience === "church" || audience === "both";
  const showGathering = audience === "gathering" || audience === "both";
  return (
    <fieldset className="grid gap-2">
      <legend className="font-semibold">어디에 올릴까요</legend>
      <div className="flex flex-wrap gap-3 leading-snug">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="audience"
            value="church"
            required
            data-testid="archive-scope-church"
            checked={audience === "church"}
            onChange={() => setAudience("church")}
          />
          교회
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="audience"
            value="gathering"
            required
            data-testid="archive-scope-gathering"
            checked={audience === "gathering"}
            onChange={() => setAudience("gathering")}
          />
          모들
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="audience"
            value="both"
            required
            data-testid="archive-scope-both"
            checked={audience === "both"}
            onChange={() => setAudience("both")}
          />
          둘 다
        </label>
      </div>
      {showChurch ? (
        <label className="grid gap-1">
          <span className="font-semibold">교회</span>
          <select name="churchId" required data-testid="archive-church-list" defaultValue="" className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug">
            <option value="">교회를 고르세요</option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showGathering ? (
        <label className="grid gap-1">
          <span className="font-semibold">모들</span>
          <select name="gatheringId" required data-testid="archive-gathering-list" defaultValue="" className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug">
            <option value="">모들을 고르세요</option>
            {gatherings.map((gathering) => (
              <option key={gathering.id} value={gathering.id}>
                {gathering.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}
