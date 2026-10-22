import Link from "next/link";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { COHORT_LABEL } from "@/questions/rules";
import { assignGroupAction, createGroupAction, issueInviteAction, reviewApprovalAction, startSeasonAction } from "@/server/community/actions";
import { loadApprovalPage, loadGroupPage, loadInvitePage, loadRosterPage } from "@/server/community/service";
import { approveQuestionReplyAction } from "@/server/questions/actions";
import { loadPendingReplies } from "@/server/questions/service";
import type { TermKey } from "@/theme/dictionary";

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

function blocked() {
  return (
    <p role="alert" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">
      이 화면은 열 수 없습니다.
    </p>
  );
}

/** 계정 탭과 교인 화면이 같은 목록을 보여 줍니다. */
export async function RosterWork() {
  const page = await loadRosterPage();
  if (!page.ok) return blocked();
  return (
    <>
      <p className="leading-relaxed text-[#5c5148]">{page.community.name}</p>
      <Link href="/roster/new" className="inline-flex w-fit max-w-full rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white">
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
                {member.cohort ? <span>{COHORT_LABEL[member.cohort]}</span> : null}
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
  );
}

export function seasonYear(raw: string | undefined): number {
  const requested = Number(raw);
  return Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : new Date().getFullYear();
}

/** 계정 탭과 모임 화면이 같은 편성을 보여 줍니다. */
export async function GroupWork({ year, scope }: { year: number; scope: "account" | "page" }) {
  const page = await loadGroupPage();
  if (!page.ok) return blocked();
  const years = [...new Set(page.data.groups.map((group) => group.seasonYear))].sort((left, right) => right - left);
  const current = page.data.groups.filter((group) => group.seasonYear === year && !group.isArchived);
  const past = page.data.groups.filter((group) => group.isArchived || group.seasonYear !== year);
  const nameOf = (memberId: string | null) => page.data.roster.find((member) => member.id === memberId)?.name ?? "";
  const hrefFor = (item: number) => (scope === "account" ? `/account?tab=group&year=${item}` : `/group?year=${item}`);

  return (
    <>
      <p className="leading-relaxed text-[#5c5148]">{page.community.name}</p>
      <nav aria-label="시즌 연도" className="flex flex-wrap gap-2">
        {years.map((item) => (
          <Link
            key={item}
            href={hrefFor(item)}
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

/** 계정 탭과 초대 화면이 같은 코드를 보여 줍니다. */
export async function InviteWork() {
  const page = await loadInvitePage();
  if (!page.ok) return blocked();
  return (
    <>
      <p className="leading-relaxed text-[#5c5148]">{page.community.name}</p>
      <form action={issueInviteAction} id="invite-form" className="grid gap-3">
        <TermField termKey="issue_invite" name="maxUses" type="number" />
        <SubmitButton termKey="issue_invite" />
      </form>
      <ul className="grid gap-2">
        {page.data.codes.map((code) => (
          <li key={code.id} data-testid="invite-code" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
            <span className="block font-semibold">{code.code}</span>
            <span className="block text-[#5c5148]">
              쓴 횟수 {code.useCount}
              {code.maxUses ? ` / ${code.maxUses}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 새가족 자리는 계정 탭 안에서 바로 안내합니다. */
export function NewcomerWork() {
  return (
    <div className="rounded-3xl border border-dashed border-[#cbbba6] bg-[#fffaf3] p-6 leading-relaxed">
      <p className="text-[clamp(1.1rem,1rem+0.4vw,1.4rem)] font-semibold">곧 열립니다.</p>
      <p className="mt-2 text-[#5c5148]">이 메뉴의 실제 일은 아직 열리지 않았습니다. 지금은 이름과 자리만 있습니다.</p>
    </div>
  );
}

/** 계정 탭과 승인 화면이 같은 대기 목록을 보여 줍니다. */
export async function ApprovalWork() {
  const page = await loadApprovalPage();
  if (!page.ok) return blocked();
  const replies = await loadPendingReplies();
  return (
    <>
      <p className="leading-relaxed text-[#5c5148]">승인 대기 중에는 정식 구성원 권한이 없습니다.</p>
      <ul className="grid gap-3">
        {page.data.requests.map((request) => (
          <li key={request.id} className="grid gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
            <span className="font-semibold">{request.applicantName}</span>
            <span>{request.applicantContact}</span>
            <span className="text-[#5c5148]">{request.status}</span>
            {request.status === "PENDING" ? (
              <form action={reviewApprovalAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="requestId" value={request.id} />
                <button type="submit" name="decision" value="APPROVED" className="rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold text-white">
                  <TermText termKey="approve_member" />
                </button>
                <button type="submit" name="decision" value="REJECTED" className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold">
                  <TermText termKey="reject_member" />
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 className="text-[clamp(1.2rem,1rem+0.4vw,1.5rem)] font-semibold leading-snug">답글 승인</h2>
      {!replies.ok ? (
        <p className="leading-relaxed">{replies.message}</p>
      ) : replies.replies.length === 0 ? (
        <p className="leading-relaxed text-[#5c5148]">승인할 답글이 없습니다.</p>
      ) : (
        <ul className="grid gap-3">
          {replies.replies.map((reply) => (
            <li key={reply.id} className="grid gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 leading-relaxed">
              <span className="whitespace-pre-wrap break-words font-semibold">{reply.questionBody}</span>
              <span>{reply.authorName}</span>
              <span className="whitespace-pre-wrap break-words">{reply.body}</span>
              <form action={approveQuestionReplyAction}>
                <input type="hidden" name="replyId" value={reply.id} />
                <input type="hidden" name="returnTo" value="/approvals" />
                <button type="submit" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
                  답글 승인
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
