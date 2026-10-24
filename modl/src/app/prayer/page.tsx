import Link from "next/link";
import { ActionToast } from "@/components/action-toast";
import { AnonymousField } from "@/components/choice-fields";
import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermButton } from "@/components/term-button";
import { SubmitButton, TermArea } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { choiceButtonClass, choiceRowClass } from "@/components/choice-buttons";
import { PRAYER_SCOPES } from "@/prayer/scopes";
import { viewerIsGuest } from "@/server/login/access";
import { createPrayerAction, prayTogetherAction } from "@/server/prayer/actions";
import { loadPrayerHome } from "@/server/prayer/service";

export const dynamic = "force-dynamic";

export default async function PrayerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadPrayerHome();
  if (!page.ok) {
    if (await viewerIsGuest()) {
      return (
        <section className="grid min-w-0 gap-4">
          <TermHeading termKey="prayer" level={1} />
          <p className="leading-relaxed">
            <TermText termKey="prayer_empty" />
          </p>
          <p className="leading-relaxed text-[#5c5148]">글을 남기려면 로그인해 주세요.</p>
          <Link href="/account" className="font-medium text-[#1e293b] underline">
            로그인
          </Link>
        </section>
      );
    }
    return <AccessScreen />;
  }

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="prayer" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {query.ok === "prayed" ? <ActionToast termKey="pray_together_btn" testId="pray-toast" /> : null}
      <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
      <form action={createPrayerAction} id="prayer-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <TermArea termKey="field_prayer" name="content" required rows={4} />
        <fieldset data-testid="prayer-scopes" className="grid gap-2">
          <legend className="font-semibold">범위</legend>
          <div className={choiceRowClass}>
            {PRAYER_SCOPES.map((scope) => (
              <label
                key={scope.value}
                className={`${choiceButtonClass} cursor-pointer border-[#0f766e] bg-transparent text-[#0f766e] has-[:checked]:border-[#0f766e] has-[:checked]:bg-[#0f766e] has-[:checked]:text-white`}
              >
                <input type="radio" name="scope" value={scope.value} required className="sr-only" data-testid={`prayer-scope-${scope.value}`} />
                {scope.label}
              </label>
            ))}
          </div>
        </fieldset>
        <AnonymousField />
        <SubmitButton termKey="save" testId="save-prayer" />
      </form>
      {page.items.length === 0 ? (
        <p className="leading-relaxed">
          <TermText termKey="prayer_empty" />
        </p>
      ) : (
        <ul className="grid gap-3">
          {page.items.map((item) => {
            const prayFormId = `pray-${item.id}`;
            return (
              <li key={item.id} className="grid min-w-0 gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3">
                {item.authorName ? (
                  <p data-testid="prayer-author" className="break-words font-semibold">
                    {item.authorName}
                  </p>
                ) : (
                  <p data-testid="anonymous-prayer" className="font-semibold">
                    <TermText termKey="anonymous_author" />
                  </p>
                )}
                <p data-testid="prayer-content" className="whitespace-pre-wrap break-words leading-relaxed">
                  {item.content}
                </p>
                {item.scopeLabel ? (
                  <p data-testid="prayer-scope-label" className="leading-snug text-[#5c5148]">
                    {item.scopeLabel}
                  </p>
                ) : null}
                <p data-testid="pray-count" className="leading-snug">
                  {item.prayTogetherCount}
                </p>
                <form id={prayFormId} action={prayTogetherAction}>
                  <input type="hidden" name="prayerId" value={item.id} />
                </form>
                <TermButton termKey="pray_together_btn" testId="pray-together-btn" toastOnPress={false} submitFormId={prayFormId} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
