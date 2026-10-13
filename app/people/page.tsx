import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { createPerson, deletePerson, updatePerson } from "@/lib/actions";
import { requireScreen } from "@/lib/guard";
import { readDb } from "@/lib/store";

export const metadata = { title: "사람 · 예배 운영" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireScreen("screen.people");
  const query = await searchParams;
  const people = readDb().people;

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">사람</h1>
      <p className="mt-2 text-muted">예배 순서를 맡을 교역자와 봉사자입니다. 쉼으로 두면 새 순서에는 나오지 않습니다.</p>
      {query.error === "name" ? <p className="mt-4 text-sm text-wine">이름을 입력해 주세요.</p> : null}

      <form action={createPerson} autoComplete="off" className="card mt-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_10rem_auto] md:items-end">
        <label className="field">
          <span>이름</span>
          <input className="input" name="name" maxLength={40} required placeholder="이름" />
        </label>
        <label className="field">
          <span>역할</span>
          <input className="input" name="roles" maxLength={80} placeholder="담임목사, 설교" />
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
          <form key={person.id} action={updatePerson} className="card grid gap-3 p-4 md:grid-cols-[1fr_1fr_10rem_auto_auto_auto] md:items-end">
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
