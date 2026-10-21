"use client";

import { CHURCH_TAG_GROUPS, type ChurchTag } from "@/map/church-tags";

/** 네 묶음 태그를 켜고 끕니다. 글자는 정해진 이름 그대로입니다. */
export function ChurchTagFilters({
  selected,
  onToggle,
  testId = "church-tag-filters",
}: {
  selected: ReadonlySet<string>;
  onToggle: (tag: ChurchTag) => void;
  testId?: string;
}) {
  return (
    <div className="grid gap-3" data-testid={testId}>
      {CHURCH_TAG_GROUPS.map((group) => (
        <fieldset key={group.label} className="grid gap-2">
          <legend className="font-semibold leading-snug">{group.label}</legend>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => {
              const on = selected.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  data-testid={`${testId}-${tag}`}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-[#111827] text-white" : "bg-white text-[#475569]"}`}
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
