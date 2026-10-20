import { GenderField, GroupSelect, RoleField, StatusField, SubmitButton, TermField } from "@/components/term-field";

type GroupChoice = { id: string; name: string; isArchived: boolean };

type RosterDefaults = {
  id?: string;
  name?: string;
  phone?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  role?: "PASTOR" | "EXECUTIVE" | "CELL_LEADER" | "MEMBER" | "NEWCOMER";
  status?: "ACTIVE" | "LONG_ABSENT" | "GRADUATED";
  cohort?: "PEER" | "SENIOR" | null;
  currentGroupId?: string | null;
};

export function RosterForm({
  action,
  member,
  groups,
  submitKey,
}: {
  action: (formData: FormData) => Promise<void>;
  member?: RosterDefaults;
  groups: GroupChoice[];
  submitKey: "save" | "add_roster";
}) {
  return (
    <form action={action} id="roster-form" className="grid gap-3">
      {member?.id ? <input type="hidden" name="memberId" value={member.id} /> : null}
      <TermField termKey="field_name" name="name" required defaultValue={member?.name ?? ""} />
      <TermField termKey="field_phone" name="phone" defaultValue={member?.phone ?? ""} autoComplete="tel" />
      <TermField termKey="field_birth" name="birthDate" type="date" defaultValue={member?.birthDate ?? ""} />
      <GenderField defaultValue={member?.gender ?? ""} />
      <RoleField defaultValue={member?.role ?? "MEMBER"} />
      <label className="grid gap-1">
        <span className="font-semibold">구분</span>
        <select
          className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
          name="cohort"
          defaultValue={member?.cohort ?? ""}
        >
          <option value="">없음</option>
          <option value="PEER">또래</option>
          <option value="SENIOR">선배</option>
        </select>
      </label>
      <p className="leading-relaxed text-[#5c5148]">목사로 두면 질문에 답합니다. 또래와 선배는 질문이 보이는 범위입니다.</p>
      <StatusField defaultValue={member?.status ?? "ACTIVE"} />
      <GroupSelect groups={groups} defaultValue={member?.currentGroupId ?? ""} />
      <SubmitButton termKey={submitKey} />
    </form>
  );
}
