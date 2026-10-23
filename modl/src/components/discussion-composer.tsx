"use client";

import { useState } from "react";

type PlaceOption = { kind: string; id: string; label: string };

/** 글을 올릴 곳입니다. 제주 전체를 고를 때만 익명을 고릅니다. */
export function DiscussionComposer({ places }: { places: readonly PlaceOption[] }) {
  const first = places[0];
  const [placeRef, setPlaceRef] = useState(first ? `${first.kind}:${first.id}` : "");
  if (!first) return null;
  const jeju = placeRef.startsWith("jeju:");
  return (
    <>
      <label className="grid gap-1">
        <span className="font-semibold">올릴 곳</span>
        <select
          name="placeRef"
          required
          data-testid="discussion-place"
          value={placeRef}
          onChange={(event) => setPlaceRef(event.target.value)}
          className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
        >
          {places.map((place) => (
            <option key={`${place.kind}:${place.id}`} value={`${place.kind}:${place.id}`}>
              {place.label}
            </option>
          ))}
        </select>
      </label>
      {jeju ? (
        <label className="flex items-center gap-2 leading-snug">
          <input type="checkbox" name="anonymous" value="1" data-testid="discussion-anonymous" />
          익명으로 올리기
        </label>
      ) : null}
    </>
  );
}
