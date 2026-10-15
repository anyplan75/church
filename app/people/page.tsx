"use client";

import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { createPerson, deletePerson, updatePerson } from "@/lib/actions";
import { OFFICES, PERSON_CATEGORIES, type Person } from "@/lib/types";

export default function PeoplePage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  if (!ready || !db) return null;

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">사람</h1>
      <p className="mt-2 text-muted">구분은 사역자, 등록교인, 미등록교인입니다. 직분은 목사, 전도사, 장로, 안수집사, 서리집사, 권사입니다.</p>
      {query.error === "name" ? <p className="mt-4 text-sm text-wine">이름을 입력해 주세요.</p> : null}

      <form action={createPerson} autoComplete="off" className="card mt-6 grid gap-3 p-5 md:grid-cols-2">
        <PersonFields />
        <div className="md:col-span-2">
          <SubmitButton>추가</SubmitButton>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {db.people.length === 0 ? <p className="text-muted">등록된 사람이 없습니다.</p> : null}
        {db.people.map((person) => (
          <form key={person.id} action={updatePerson} className="card grid gap-3 p-4 md:grid-cols-2">
            <input type="hidden" name="id" value={person.id} />
            <PersonFields person={person} />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <SubmitButton className="btn btn-quiet">저장</SubmitButton>
              <ConfirmSubmit action={deletePerson} message={`${person.name} 님을 명단에서 지울까요?`} className="btn btn-quiet text-wine">
                삭제
              </ConfirmSubmit>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}

function PersonFields({ person }: { person?: Person }) {
  return (
    <>
      <label className="field">
        <span>이름</span>
        <input className="input" name="name" defaultValue={person?.name ?? ""} maxLength={40} required placeholder="이름" />
      </label>
      <label className="field">
        <span>구분</span>
        <select className="select" name="category" defaultValue={person?.category ?? "registered"}>
          {PERSON_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>직분</span>
        <select className="select" name="office" defaultValue={person?.office ?? ""}>
          <option value="">없음</option>
          {OFFICES.map((office) => (
            <option key={office} value={office}>
              {office}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>주소</span>
        <input className="input" name="address" defaultValue={person?.address ?? ""} maxLength={120} placeholder="주소" />
      </label>
      <label className="field">
        <span>전화번호</span>
        <input className="input" name="phone" defaultValue={person?.phone ?? ""} maxLength={30} placeholder="전화번호" />
      </label>
      <label className="field">
        <span>이메일</span>
        <input className="input" name="email" defaultValue={person?.email ?? ""} maxLength={120} placeholder="이메일" />
      </label>
      <label className="field md:col-span-2">
        <span>메모</span>
        <input className="input" name="memo" defaultValue={person?.memo ?? ""} maxLength={400} placeholder="메모" />
      </label>
    </>
  );
}
