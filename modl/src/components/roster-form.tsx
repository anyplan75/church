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
      <StatusField defaultValue={member?.status ?? "ACTIVE"} />
      <GroupSelect groups={groups} defaultValue={member?.currentGroupId ?? ""} />
      <SubmitButton termKey={submitKey} />
    </form>
  );
}
