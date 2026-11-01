import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { OcrKeyButton } from "@/components/ocr-key-button";
import { SubmitButton, TermArea, TermField, TermFileField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createQtAction } from "@/server/qt/actions";
import { loadQtHome } from "@/server/qt/service";

export const dynamic = "force-dynamic";

export default async function QtPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadQtHome();
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="qt" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          {page.canManage ? (
            <form action={createQtAction} id="qt-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <TermField termKey="field_qt_date" name="qtDate" type="date" required />
              <TermField termKey="field_scripture_title" name="scriptureTitle" required />
              <TermArea termKey="field_scripture_body" name="scriptureBody" rows={6} />
              <TermArea termKey="field_questions" name="questionsText" rows={4} />
              <TermFileField termKey="field_source_file" name="sourceFile" />
              {page.ocrReady ? (
                <p data-testid="ocr-ready" className="leading-relaxed">
                  <TermText termKey="ocr_ready" />
                </p>
              ) : (
                <OcrKeyButton />
              )}
              <SubmitButton termKey="save_qt" testId="save-qt" />
            </form>
          ) : (
            <p className="leading-relaxed text-[#5c5148]">
              <TermText termKey="qt_leaders_only" />
            </p>
          )}
          {page.items.length === 0 ? (
            <p className="leading-relaxed">
              <TermText termKey="qt_empty" />
            </p>
          ) : (
            <ul className="grid gap-2">
              {page.items.map((item) => (
                <li key={item.id}>
                  <Link href={`/qt/${item.id}`} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                    <span className="text-[#5c5148]">{item.qtDate}</span>
                    <span className="break-words font-semibold" data-testid="qt-title">
                      {item.scriptureTitle}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
    </section>
  );
}
