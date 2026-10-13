"use client";

import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { createPerson, deletePerson, updatePerson } from "@/lib/actions";
import { MEMBERSHIPS, type Membership } from "@/lib/types";

export default function PeoplePage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  if (!ready || !db) return null;
  const people = db.people;

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">사람</h1>
      <p className="mt-2 text-muted">예배 순서를 맡을 사람과 교인 구분입니다. 쉼으로 두면 새 순서에는 나오지 않습니다. 방문자와 새신자는 출결에 기록하지 않습니다.</p>
      {query.error === "name" ? <p className="mt-4 text-sm text-wine">이름을 입력해 주세요.</p> : null}

      <form action={createPerson} autoComplete="off" className="card mt-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_8rem_10rem_auto] md:items-end">
        <label className="field">
          <span>이름</span>
          <input className="input" name="name" maxLength={40} required placeholder="이름" />
        </label>
        <label className="field">
          <span>역할</span>
          <input className="input" name="roles" maxLength={80} placeholder="담임목사, 설교" />
        </label>
        <label className="field">
          <span>구분</span>
          <MembershipSelect />
        </label>
        <label className="field">
          <span>전화</span>
          <input className="input" name="phone" maxLength={30} autoComplete="off" placeholder="전화번호" />
        </label>
        <SubmitButton>추가</SubmitButton>
      </form>

      <div className="mt-6 space-y-3">
        {people.length === 0 ? <p className="text-muted">등록된 사람이 없습니다.</p> : null}
        {people.map((person) => (
          <form key={person.id} action={updatePerson} className="card grid gap-3 p-4 md:grid-cols-[1fr_1fr_8rem_10rem_auto_auto_auto] md:items-end">
            <input type="hidden" name="id" value={person.id} />
            <label className="field">
              <span>이름</span>
              <input className="input" name="name" defaultValue={person.name} maxLength={40} required />
            </label>
            <label className="field">
              <span>역할</span>
              <input className="input" name="roles" defaultValue={person.roles.join(", ")} maxLength={80} />
            </label>
            <label className="field">
              <span>구분</span>
              <MembershipSelect value={person.membership} />
            </label>
            <label className="field">
              <span>전화</span>
              <input className="input" name="phone" defaultValue={person.phone} maxLength={30} />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={person.active} />
              활동
            </label>
            <SubmitButton className="btn btn-quiet">저장</SubmitButton>
            <ConfirmSubmit action={deletePerson} message={`${person.name} 님을 명단에서 지울까요?`} className="btn btn-quiet text-wine">
              삭제
            </ConfirmSubmit>
          </form>
        ))}
      </div>
    </div>
  );
}

function MembershipSelect({ value = "member" }: { value?: Membership }) {
  return (
    <select className="select" name="membership" defaultValue={value}>
      {MEMBERSHIPS.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
