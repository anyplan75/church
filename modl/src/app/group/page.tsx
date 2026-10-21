import Link from "next/link";
import { BlockedScreen } from "@/components/blocked-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { assignGroupAction, createGroupAction, startSeasonAction } from "@/server/community/actions";
import { loadGroupPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; year?: string }>;
}) {
  const query = await searchParams;
  const page = await loadGroupPage();
  if (!page.ok) return <BlockedScreen />;
  const requested = Number(query.year);
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : new Date().getFullYear();

  return (
    <section className="grid gap-6">
      <TermHeading termKey="group" level={1} />
      <p className="leading-relaxed text-[#5c5148]">
        해가 바뀌면 이전 모들은 보관만 하고 지우지 않습니다. 지난 편성과 연결 기록도 그대로 남습니다.
      </p>
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <GroupBody year={year} page={page} />
    </section>
  );
}

function GroupBody({
  year,
  page,
}: {
  year: number;
  page: Extract<Awaited<ReturnType<typeof loadGroupPage>>, { ok: true }>;
}) {
  const years = [...new Set(page.data.groups.map((group) => group.seasonYear))].sort((left, right) => right - left);
  const current = page.data.groups.filter((group) => group.seasonYear === year && !group.isArchived);
  const past = page.data.groups.filter((group) => group.isArchived || group.seasonYear !== year);
  const nameOf = (memberId: string | null) => page.data.roster.find((member) => member.id === memberId)?.name ?? "";

  return (
    <>
      <p className="leading-relaxed text-[#5c5148]">{page.community.name}</p>
      <nav aria-label="시즌 연도" className="flex flex-wrap gap-2">
        {years.map((item) => (
          <Link
            key={item}
            href={`/group?year=${item}`}
            className={`rounded-2xl px-3 py-2 leading-snug ${item === year ? "bg-[#1d6b45] text-white" : "bg-[#fffaf3]"}`}
          >
            {item}
          </Link>
        ))}
      </nav>
      <form action={startSeasonAction} id="season-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <TermField termKey="field_season" name="year" type="number" required defaultValue={String(year)} />
        <SubmitButton termKey="start_season" />
      </form>
      <form action={createGroupAction} id="group-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <input type="hidden" name="year" value={year} />
        <TermField termKey="field_group_name" name="name" required />
        <label className="grid gap-1">
          <span className="font-semibold">
            <TermText termKey="field_leader" />
          </span>
          <select className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" name="leaderMemberId" defaultValue="">
            <option value="">선택 안 함</option>
            {page.data.roster.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton termKey="add_group" />
      </form>
      <ul className="grid gap-3">
        {current.map((group) => (
          <li key={group.id} className="grid gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
            <span className="font-semibold" data-testid="group-name">
              {group.name}
            </span>
            <span>
              <TermText termKey="field_leader" /> {nameOf(group.leaderMemberId)}
            </span>
            <ul className="grid gap-1">
              {page.data.roster
                .filter((member) => member.currentGroupId === group.id)
                .map((member) => (
                  <li key={member.id} data-testid="assigned-member">
                    {member.name}
                  </li>
                ))}
            </ul>
            <form action={assignGroupAction} className="grid gap-2">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="groupId" value={group.id} />
              <select className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" name="memberId" required>
                {page.data.roster.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <SubmitButton termKey="assign_member" />
            </form>
          </li>
        ))}
      </ul>
      <div className="grid gap-2">
        <TermHeading termKey="past_groups" level={2} />
        <ul className="grid gap-2">
          {past.map((group) => (
            <li key={group.id} className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
              <span className="font-semibold">{group.name}</span>
              <span className="ml-2 text-[#5c5148]">{group.seasonYear}</span>
            </li>
          ))}
        </ul>
        <p className="leading-relaxed text-[#5c5148]">연결 기록 {page.data.history.length}</p>
      </div>
    </>
  );
}
