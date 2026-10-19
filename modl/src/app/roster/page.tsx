import Link from "next/link";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { loadRosterPage } from "@/server/community/service";
import type { TermKey } from "@/theme/dictionary";

export const dynamic = "force-dynamic";

const STATUS_TERM = {
  ACTIVE: "status_active",
  LONG_ABSENT: "long_term_absentee",
  GRADUATED: "status_graduated",
} as const;

const GENDER_TERM: Record<string, TermKey> = {
  male: "gender_male",
  female: "gender_female",
  unspecified: "gender_unspecified",
};

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadRosterPage();

  return (
    <section className="grid gap-4">
      <TermHeading termKey="roster" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.community.name}</p>
          <Link
            href="/roster/new"
            className="inline-flex w-fit max-w-full rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white"
          >
            <TermText termKey="add_roster" />
          </Link>
          <ul className="grid gap-3">
            {page.data.roster.map((member) => {
              const group = page.data.groups.find((item) => item.id === member.currentGroupId);
              const genderKey = member.gender ? GENDER_TERM[member.gender] : undefined;
              return (
                <li key={member.id} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                  <Link href={`/roster/${member.id}`} className="font-semibold text-[#1d6b45]" data-testid="roster-name">
                    {member.name}
                  </Link>
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {member.userId ? <TermText termKey={member.role} /> : <TermText termKey="UNREGISTERED" />}
                    <TermText termKey={STATUS_TERM[member.status]} />
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-[#5c5148]">
                    <span>
                      <TermText termKey="field_phone" /> {member.phone ?? ""}
                    </span>
                    <span>
                      <TermText termKey="field_birth" /> {member.birthDate ?? ""}
                    </span>
                    {genderKey ? (
                      <span>
                        <TermText termKey="field_gender" /> <TermText termKey={genderKey} />
                      </span>
                    ) : null}
                  </span>
                  <span>
                    <TermText termKey="field_group" /> {group ? group.name : ""}
                    {group ? null : <TermText termKey="no_group" />}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
