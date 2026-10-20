"use client";

import { TermText } from "@/components/term-text";
import { useCommunityTerm } from "@/components/use-community-term";
import type { TermKey } from "@/theme/dictionary";

const inputClass = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

function OptionLabel({ value, termKey }: { value: string; termKey: TermKey }) {
  const term = useCommunityTerm(termKey);
  return <option value={value}>{term.primary}</option>;
}

export function DepartmentField({ defaultValue = "YOUTH" }: { defaultValue?: "YOUTH" | "SCHOOL" }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_department" />
      </span>
      <select className={inputClass} name="departmentType" defaultValue={defaultValue}>
        <OptionLabel value="YOUTH" termKey="dept_youth" />
        <OptionLabel value="SCHOOL" termKey="dept_school" />
      </select>
    </label>
  );
}

const CATEGORIES = [
  ["RETREAT", "category_retreat"],
  ["EVENT", "category_event"],
  ["BIRTHDAY", "category_birthday"],
  ["HOLIDAY", "category_holiday"],
  ["ETC", "category_etc"],
] as const;

export function CategoryField({ defaultValue = "EVENT" }: { defaultValue?: (typeof CATEGORIES)[number][0] }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_category" />
      </span>
      <select className={inputClass} name="category" defaultValue={defaultValue}>
        {CATEGORIES.map(([value, termKey]) => (
          <OptionLabel key={value} value={value} termKey={termKey} />
        ))}
      </select>
    </label>
  );
}

export function LeaderOnlyField({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="flex flex-wrap items-start gap-2 leading-snug">
      <input type="checkbox" name="isLeaderOnly" value="yes" defaultChecked={defaultChecked} className="mt-1" />
      <TermText termKey="leader_only_event" />
    </label>
  );
}
