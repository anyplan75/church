import type { SignupPersonRow } from "@/server/community/service";

const HEADERS = ["이름", "이메일", "성별", "전화번호", "다니는 교회"] as const;

/** 사역자 계정 화면의 가입자 목록입니다. 등급 칸은 없습니다. */
export function SignupPeople({ people }: { people: SignupPersonRow[] }) {
  return (
    <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4" data-testid="signup-people">
      <h2 className="font-semibold leading-snug">가입자</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm leading-relaxed">
          <thead>
            <tr className="border-b border-[#e4d8c8]">
              {HEADERS.map((header) => (
                <th key={header} scope="col" className="px-2 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-b border-[#f3ebe3]" data-testid="signup-person">
                <td className="px-2 py-2">{person.name}</td>
                <td className="px-2 py-2">{person.email}</td>
                <td className="px-2 py-2">{person.gender}</td>
                <td className="px-2 py-2">{person.phone}</td>
                <td className="px-2 py-2">{person.churchName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
