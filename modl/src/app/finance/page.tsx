import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
import { choiceButtonClass, choiceButtonStyle, choiceRowClass, choiceToneColor } from "@/components/choice-buttons";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { createCategoryAction } from "@/server/finance/actions";
import { loadFinanceHome } from "@/server/finance/service";
import { viewerIsGuest } from "@/server/login/access";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; note?: string; place?: string }>;
}) {
  const query = await searchParams;
  const page = await loadFinanceHome();
  if (!page.ok && (await viewerIsGuest())) return <AccessScreen />;
  const selected = page.ok ? page.places.find((place) => `${place.kind}:${place.id}` === query.place) ?? page.places[0] ?? null : null;
  const transactions = page.ok && selected ? page.transactions.filter((row) => row.placeKind === selected.kind && row.placeId === selected.id) : [];

  return (
    <section className="grid min-w-0 gap-6">
      <TermHeading termKey="finance" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">속한 교회와 모들의 재정만 보입니다. 관리자나 수정 권한이 있는 사람만 고칩니다.</p>
          {page.places.length === 0 ? (
            <p className="leading-relaxed">속한 교회와 모들이 없습니다.</p>
          ) : (
            <div data-testid="finance-scopes" className={choiceRowClass}>
              {page.places.map((place) => {
                const on = selected?.id === place.id && selected.kind === place.kind;
                return (
                  <Link
                    key={`${place.kind}:${place.id}`}
                    href={`/finance?place=${place.kind}:${place.id}`}
                    data-testid="finance-scope"
                    data-kind={place.kind}
                    data-on={on ? "yes" : "no"}
                    className={choiceButtonClass}
                    style={choiceButtonStyle(on, choiceToneColor(place.kind))}
                  >
                    {place.name}
                  </Link>
                );
              })}
            </div>
          )}
          {transactions.length === 0 ? <p className="leading-relaxed">보이는 재정 기록이 없습니다.</p> : null}
          {transactions.length > 0 ? (
            <ul className="grid gap-2" data-testid="finance-rows">
              {transactions.map((row) => (
                <li key={row.id} className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                  {row.place} · {row.date} · {row.amount} · {row.description}
                </li>
              ))}
            </ul>
          ) : null}
          {selected?.canEdit ? (
            <form action={createCategoryAction} className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <input type="hidden" name="placeRef" value={`${selected.kind}:${selected.id}`} />
              <input name="departmentOrEvent" required placeholder="부서나 행사" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2" />
              <select name="type" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2">
                <option value="INCOME">수입</option>
                <option value="EXPENSE">지출</option>
              </select>
              <input name="name" required placeholder="분류 이름" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2" />
              <input name="budgetAmount" required defaultValue="0" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2" />
              <button type="submit" className="w-fit rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
                분류 저장
              </button>
            </form>
          ) : selected ? (
            <p className="leading-relaxed text-[#5c5148]" data-testid="finance-view-only">
              수정 권한이 없으면 재정은 보기만 합니다.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
