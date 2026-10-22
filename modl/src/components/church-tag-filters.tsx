"use client";

import { CHURCH_TAG_GROUPS, type ChurchTag } from "@/map/church-tags";

/** 네 묶음 태그를 켜고 끕니다. 글자는 정해진 이름 그대로입니다. */
export function ChurchTagFilters({
  selected,
  onToggle,
  testId = "church-tag-filters",
  layout = "stack",
}: {
  selected: ReadonlySet<string>;
  onToggle: (tag: ChurchTag) => void;
  testId?: string;
  /** board 는 지도 아래 창입니다. 네 묶음이 접히거나 잘리지 않고 한 번에 보입니다. */
  layout?: "stack" | "board";
}) {
  const board = layout === "board";
  return (
    <div className={board ? "grid grid-cols-2 gap-x-2 gap-y-2 md:grid-cols-4 md:gap-x-3 md:gap-y-3" : "grid gap-3"} data-testid={testId}>
      {CHURCH_TAG_GROUPS.map((group) => (
        <fieldset key={group.label} className={board ? "m-0 grid min-w-0 gap-1 border-0 p-0 md:gap-1.5" : "grid gap-2"}>
          <legend className="font-semibold leading-snug">{group.label}</legend>
          <div className={board ? "flex flex-wrap gap-1 md:gap-1.5" : "flex flex-wrap gap-2"}>
            {group.tags.map((tag) => {
              const on = selected.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  data-testid={`${testId}-${tag}`}
                  className={
                    board
                      ? `max-w-full whitespace-normal rounded-full border px-1.5 py-0.5 text-left text-[11px] font-semibold leading-4 md:px-3 md:py-1.5 md:text-sm ${on ? "border-[#111827] bg-[#111827] text-white" : "border-[#e5e7eb] bg-white text-[#475569]"}`
                      : `rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-[#111827] text-white" : "bg-white text-[#475569]"}`
                  }
                  onClick={() => onToggle(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
