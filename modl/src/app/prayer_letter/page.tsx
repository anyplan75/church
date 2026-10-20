import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { markLetterReadAction } from "@/server/prayer/actions";
import { loadPrayerLetters } from "@/server/prayer/service";

export const dynamic = "force-dynamic";

export default async function PrayerLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadPrayerLetters();

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="prayer_letter" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          <div className="grid gap-2">
            <TermHeading termKey="inbox" level={2} />
            {page.inbox.length === 0 ? (
              <p className="leading-relaxed">
                <TermText termKey="letter_empty" />
              </p>
            ) : (
              page.inbox.map((letter) => (
                <article key={letter.id} data-testid="inbox-letter" className="grid min-w-0 gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3">
                  <p className="break-words font-semibold">{letter.senderName}</p>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{letter.message}</p>
                  {letter.isRead ? (
                    <TermText termKey="letter_read" />
                  ) : (
                    <form action={markLetterReadAction}>
                      <input type="hidden" name="letterId" value={letter.id} />
                      <SubmitButton termKey="mark_read" testId="mark-read" />
                    </form>
                  )}
                </article>
              ))
            )}
          </div>
          <div className="grid gap-2">
            <TermHeading termKey="sent_letters" level={2} />
            {page.sent.length === 0 ? (
              <p className="leading-relaxed">
                <TermText termKey="letter_empty" />
              </p>
            ) : (
              page.sent.map((letter) => (
                <article key={letter.id} data-testid="sent-letter" className="grid min-w-0 gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3">
                  {letter.recipientName ? (
                    <p data-testid="sent-recipient" className="break-words font-semibold">
                      {letter.recipientName}
                    </p>
                  ) : (
                    <p data-testid="sent-recipient" className="font-semibold">
                      <TermText termKey="anonymous_author" />
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{letter.message}</p>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
