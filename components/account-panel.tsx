import { ConfirmSubmit } from "@/components/confirm-submit";
import { RoleFields } from "@/components/role-fields";
import { SubmitButton } from "@/components/submit-button";
import { createAccount, removeAccount, saveAccount } from "@/lib/account-actions";
import type { Account } from "@/lib/account-rules";
import { ROLES, type Role } from "@/lib/roles";

function roleLabels(roles: readonly Role[]) {
  return ROLES.filter((role) => roles.includes(role.id))
    .map((role) => role.label)
    .join(" · ");
}

const ERRORS: Record<string, string> = {
  email: "이메일 형식을 확인해 주세요.",
  short: "비밀번호는 8자 이상으로 입력해 주세요.",
  confirm: "비밀번호가 서로 다릅니다.",
  taken: "이미 있는 이메일입니다.",
  roles: "역할을 하나 이상 선택해 주세요.",
  last: "마지막 설정·계정 역할은 뺄 수 없습니다.",
  "last-delete": "마지막 설정·계정 계정은 삭제할 수 없습니다.",
};

export function AccountPanel({
  accounts,
  people,
  currentId,
  error,
  saved,
  errorAccount,
}: {
  accounts: Array<Account & { personId?: string | null }>;
  people: { id: string; name: string; active: boolean }[];
  currentId: string;
  error?: string;
  saved?: string;
  errorAccount?: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-3xl">이메일 계정</h2>
      <p className="mt-2 text-muted">로그인에 쓰는 이메일입니다. 교인을 연결하면 그 사람 본인이 자기 출석만 표시할 수 있습니다.</p>
      {saved ? <p className="mt-4 text-sm text-pine">계정을 저장했습니다.</p> : null}
      {error && !errorAccount ? <p className="mt-4 text-sm text-wine">{ERRORS[error] ?? "계정을 저장하지 못했습니다."}</p> : null}

      <form action={createAccount} autoComplete="off" className="card mt-6 space-y-4 p-5">
        <h3 className="font-serif text-2xl">계정 추가</h3>
        <label className="field">
          <span>이메일</span>
          <input className="input" name="email" type="email" autoComplete="off" maxLength={120} required placeholder="name@church.org" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>비밀번호</span>
            <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
          </label>
          <label className="field">
            <span>비밀번호 확인</span>
            <input className="input" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
          </label>
        </div>
        <PersonLink people={people} />
        <RoleFields selected={[]} />
        <SubmitButton>계정 추가</SubmitButton>
      </form>

      <div className="mt-6 space-y-4">
        {accounts.map((account) => (
          <form key={account.id} action={saveAccount} autoComplete="off" className="card space-y-4 p-5">
            <input type="hidden" name="id" value={account.id} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-serif text-2xl">{account.email}</h3>
                <p className="text-sm text-muted">{roleLabels(account.roles)}</p>
              </div>
              {account.id === currentId ? <span className="text-sm text-muted">내 계정</span> : null}
            </div>
            {error && errorAccount === account.id ? <p className="text-sm text-wine">{ERRORS[error] ?? "계정을 저장하지 못했습니다."}</p> : null}
            <label className="field">
              <span>이메일</span>
              <input className="input" name="email" type="email" defaultValue={account.email} autoComplete="off" maxLength={120} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span>새 비밀번호</span>
                <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} placeholder="바꾸지 않으면 비워 두세요" />
              </label>
              <label className="field">
                <span>새 비밀번호 확인</span>
                <input className="input" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={200} />
              </label>
            </div>
            <PersonLink people={people} value={account.personId ?? ""} />
            <RoleFields selected={account.roles} />
            <div className="flex flex-wrap gap-2">
              <SubmitButton className="btn btn-quiet">저장</SubmitButton>
              <ConfirmSubmit action={removeAccount} message={`${account.email} 계정을 삭제할까요?`} className="btn btn-quiet text-wine">
                삭제
              </ConfirmSubmit>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}

function PersonLink({ people, value = "" }: { people: { id: string; name: string; active: boolean }[]; value?: string }) {
  const choices = people.filter((person) => person.active || person.id === value);
  return (
    <label className="field">
      <span>연결된 교인</span>
      <select className="select" name="personId" defaultValue={value}>
        <option value="">없음</option>
        {choices.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
    </label>
  );
}
