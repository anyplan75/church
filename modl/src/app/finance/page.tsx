import Link from "next/link";
import { FinanceCategoryField, FinanceTypeField } from "@/components/choice-fields";
import { ErrorNote, NoteBanner, OkNote } from "@/components/form-note";
import { SheetsKeyButton } from "@/components/sheets-key-button";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createCategoryAction, createTransactionAction, syncSheetsAction } from "@/server/finance/actions";
import { loadFinanceHome } from "@/server/finance/service";
import type { TermKey } from "@/theme/dictionary";

export const dynamic = "force-dynamic";

const TYPE_TERM = {
  INCOME: "money_income",
  EXPENSE: "money_expense",
} as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; note?: string }>;
}) {
  const query = await searchParams;
  const page = await loadFinanceHome();

  return (
    <section className="grid min-w-0 gap-6">
      <TermHeading termKey="finance" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <NoteBanner code={query.note} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/export/roster"
              data-testid="download-roster"
              className="inline-flex max-w-full whitespace-normal rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug"
            >
              <TermText termKey="download_roster" />
            </Link>
            <Link
              href="/export/attendance"
              data-testid="download-attendance"
              className="inline-flex max-w-full whitespace-normal rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug"
            >
              <TermText termKey="download_attendance" />
            </Link>
            <Link
              href="/export/finance"
              data-testid="download-finance"
              className="inline-flex max-w-full whitespace-normal rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug"
            >
              <TermText termKey="download_finance" />
            </Link>
          </div>
          {page.sheetsReady ? (
            <form action={syncSheetsAction}>
              <SubmitButton termKey="sheets_sync" testId="sheets-sync" />
            </form>
          ) : (
            <SheetsKeyButton />
          )}
          <form action={createCategoryAction} id="category-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <TermField termKey="field_department_event" name="departmentOrEvent" required />
            <FinanceTypeField />
            <TermField termKey="field_finance_name" name="name" required />
            <TermField termKey="field_budget" name="budgetAmount" required />
            <SubmitButton termKey="save_category" testId="save-category" />
          </form>
          {page.categories.length === 0 ? (
            <p className="leading-relaxed">
              <TermText termKey="finance_empty" />
            </p>
          ) : (
            <ul className="grid gap-4">
              {page.categories.map((category) => (
                <li key={category.id} data-testid="budget-bar" className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-snug">
                    <span className="break-words font-semibold">{category.name}</span>
                    <span className="break-words text-[#5c5148]">{category.departmentOrEvent}</span>
                    <TermText termKey={TYPE_TERM[category.type] as TermKey} />
                    {category.bar.hasBudget ? (
                      <span data-testid="budget-percent" className="font-semibold">
                        {category.bar.percent}%
                      </span>
                    ) : (
                      <span data-testid="budget-percent">
                        <TermText termKey="budget_missing" />
                      </span>
                    )}
                  </div>
                  <div className="h-3 rounded-full bg-[#efe4d6]" aria-hidden="true">
                    <div className="h-3 rounded-full bg-[#1d6b45]" style={{ width: `${category.bar.width}%` }} />
                  </div>
                  <p className="leading-snug text-[#5c5148]">
                    <TermText termKey="budget_spent" /> {category.bar.spent} / {category.bar.budget}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {page.categories.length > 0 ? (
            <form action={createTransactionAction} id="transaction-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <FinanceCategoryField categories={page.categories} />
              <TermField termKey="field_qt_date" name="transactionDate" type="date" required />
              <TermField termKey="field_amount" name="amount" required />
              <TermArea termKey="field_description" name="description" required rows={3} />
              <TermArea termKey="field_receipt_urls" name="receiptText" rows={3} />
              <SubmitButton termKey="save_transaction" testId="save-transaction" />
            </form>
          ) : null}
          <form method="get" action="/finance/receipts" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <TermField termKey="field_range_start" name="start" type="date" required />
            <TermField termKey="field_range_end" name="end" type="date" required />
            <SubmitButton termKey="download_receipts" testId="download-receipts" />
          </form>
          {page.transactions.length === 0 ? null : (
            <ul className="grid gap-2">
              {page.transactions.map((row) => (
                <li key={row.id} data-testid="transaction-row" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                  <span className="text-[#5c5148]">{row.transactionDate}</span>
                  <span className="break-words font-semibold">{row.description}</span>
                  <span className="break-words">
                    {row.categoryName} · {row.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
