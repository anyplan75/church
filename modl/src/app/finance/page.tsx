import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { loadFinanceHome } from "@/server/finance/service";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; note?: string }>;
}) {
  const query = await searchParams;
  const page = await loadFinanceHome();
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-6">
      <TermHeading termKey="finance" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
      {page.sheet.state === "missing" ? <p className="leading-relaxed">연결된 시트를 읽지 못했습니다.</p> : null}
      {page.sheet.state === "failed" ? <p className="leading-relaxed">시트를 읽지 못했습니다. 금액은 보여 주지 않습니다.</p> : null}
      {page.sheet.state === "empty" ? <p className="leading-relaxed">시트에 금액이 없습니다.</p> : null}
      {page.sheet.state === "ready" ? (
        <div className="overflow-x-auto" data-testid="finance-sheet">
          <table className="w-full border-collapse text-left leading-snug">
            {page.sheet.headers.length > 0 ? (
              <thead>
                <tr>
                  {page.sheet.headers.map((header, index) => (
                    <th key={`${header}-${index}`} className="border-b border-[#e5e7eb] px-2 py-2 font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {page.sheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="border-b border-[#f1f5f9] px-2 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
