"use client";

import { TermText } from "@/components/term-text";
import { useCommunityTerm } from "@/components/use-community-term";
import type { TermKey } from "@/theme/dictionary";

type RosterRole = "PASTOR" | "EXECUTIVE" | "CELL_LEADER" | "MEMBER" | "NEWCOMER";

const inputClass = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

export function TermField({
  termKey,
  name,
  type = "text",
  required = false,
  defaultValue = "",
  autoComplete,
  testId,
}: {
  termKey: TermKey;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
  testId?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey={termKey} />
      </span>
      <input
        className={inputClass}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        data-testid={testId}
      />
    </label>
  );
}

export function TermArea({
  termKey,
  name,
  required = false,
  defaultValue = "",
  rows = 5,
}: {
  termKey: TermKey;
  name: string;
  required?: boolean;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey={termKey} />
      </span>
      <textarea className={inputClass} name={name} required={required} defaultValue={defaultValue} rows={rows} />
    </label>
  );
}

export function TermFileField({ termKey, name }: { termKey: TermKey; name: string }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey={termKey} />
      </span>
      <input className={inputClass} name={name} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
    </label>
  );
}

export function SubmitButton({ termKey, testId }: { termKey: TermKey; testId?: string }) {
  const term = useCommunityTerm(termKey);
  return (
    <button
      type="submit"
      data-testid={testId}
      className="w-fit max-w-full whitespace-normal rounded-2xl bg-[#1d6b45] px-4 py-3 text-left font-semibold leading-snug text-white"
    >
      {term.primary}
    </button>
  );
}

const ROLES = ["PASTOR", "EXECUTIVE", "CELL_LEADER", "MEMBER", "NEWCOMER"] as const;
const STATUSES = ["ACTIVE", "LONG_ABSENT", "GRADUATED"] as const;

function RoleOption({ role }: { role: (typeof ROLES)[number] }) {
  const term = useCommunityTerm(role);
  return <option value={role}>{term.primary}</option>;
}

export function RoleField({ defaultValue = "MEMBER" }: { defaultValue?: RosterRole }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_role" />
      </span>
      <select className={inputClass} name="role" defaultValue={defaultValue}>
        {ROLES.map((role) => (
          <RoleOption key={role} role={role} />
        ))}
      </select>
    </label>
  );
}

const STATUS_TERM = {
  ACTIVE: "status_active",
  LONG_ABSENT: "long_term_absentee",
  GRADUATED: "status_graduated",
} as const;

function StatusOption({ status }: { status: (typeof STATUSES)[number] }) {
  const term = useCommunityTerm(STATUS_TERM[status]);
  return <option value={status}>{term.primary}</option>;
}

export function StatusField({
  defaultValue = "ACTIVE",
}: {
  defaultValue?: "ACTIVE" | "LONG_ABSENT" | "GRADUATED";
}) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_status" />
      </span>
      <select className={inputClass} name="status" defaultValue={defaultValue}>
        {STATUSES.map((status) => (
          <StatusOption key={status} status={status} />
        ))}
      </select>
    </label>
  );
}

function ChoiceOption({ value, termKey }: { value: string; termKey: TermKey }) {
  const term = useCommunityTerm(termKey);
  return <option value={value}>{term.primary}</option>;
}

export function GroupSelect({
  groups,
  defaultValue = "",
}: {
  groups: { id: string; name: string; isArchived: boolean }[];
  defaultValue?: string;
}) {
  const past = useCommunityTerm("past_groups");
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_group" />
      </span>
      <select className={inputClass} name="groupId" defaultValue={defaultValue}>
        <option value="">선택 안 함</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id} disabled={group.isArchived}>
            {group.isArchived ? `${group.name} (${past.primary})` : group.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GenderField({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_gender" />
      </span>
      <select className={inputClass} name="gender" defaultValue={defaultValue}>
        <option value="">선택</option>
        <ChoiceOption value="male" termKey="gender_male" />
        <ChoiceOption value="female" termKey="gender_female" />
        <ChoiceOption value="unspecified" termKey="gender_unspecified" />
      </select>
    </label>
  );
}

export function LanguageField({
  defaultValue = "STANDARD",
}: {
  defaultValue?: "JEJU_DUAL" | "JEJU_ONLY" | "STANDARD";
}) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_language" />
      </span>
      <select className={inputClass} name="languageMode" defaultValue={defaultValue}>
        <ChoiceOption value="JEJU_DUAL" termKey="mode_dual" />
        <ChoiceOption value="JEJU_ONLY" termKey="mode_jeju" />
        <ChoiceOption value="STANDARD" termKey="mode_standard" />
      </select>
    </label>
  );
}
