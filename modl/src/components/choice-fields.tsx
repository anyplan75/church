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

const VISIBILITIES = [
  ["PUBLIC", "visibility_public"],
  ["GROUP_ONLY", "visibility_group"],
  ["LEADER_ONLY", "visibility_leader"],
  ["PASTOR_ONLY", "visibility_pastor"],
] as const;

export function VisibilityField({ defaultValue = "PUBLIC" }: { defaultValue?: (typeof VISIBILITIES)[number][0] }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_visibility" />
      </span>
      <select className={inputClass} name="visibility" defaultValue={defaultValue}>
        {VISIBILITIES.map(([value, termKey]) => (
          <OptionLabel key={value} value={value} termKey={termKey} />
        ))}
      </select>
    </label>
  );
}

export function FinanceTypeField() {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_money_type" />
      </span>
      <select className={inputClass} name="type" defaultValue="EXPENSE" data-testid="finance-type">
        <OptionLabel value="INCOME" termKey="money_income" />
        <OptionLabel value="EXPENSE" termKey="money_expense" />
      </select>
    </label>
  );
}

export function FinanceCategoryField({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_category_pick" />
      </span>
      <select className={inputClass} name="categoryId" required data-testid="finance-category">
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SurveyAnonymousField() {
  return (
    <label className="flex flex-wrap items-start gap-2 leading-snug">
      <input type="checkbox" name="allowAnonymous" value="yes" className="mt-1" data-testid="allow-anonymous" />
      <TermText termKey="allow_anonymous_survey" />
    </label>
  );
}

export function AnonymousField() {
  return (
    <label className="flex flex-wrap items-start gap-2 leading-snug">
      <input type="checkbox" name="isAnonymous" value="yes" className="mt-1" />
      <TermText termKey="field_anonymous" />
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
