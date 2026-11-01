import { ActionToast } from "@/components/action-toast";
import { AnonymousField, VisibilityField } from "@/components/choice-fields";
import { BlockedScreen } from "@/components/blocked-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermButton } from "@/components/term-button";
import { SubmitButton, TermArea } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createPrayerAction, prayTogetherAction } from "@/server/prayer/actions";
import { loadPrayerHome } from "@/server/prayer/service";
import type { TermKey } from "@/theme/dictionary";

export const dynamic = "force-dynamic";

const VISIBILITY_TERM = {
  PUBLIC: "visibility_public",
  GROUP_ONLY: "visibility_group",
  LEADER_ONLY: "visibility_leader",
  PASTOR_ONLY: "visibility_pastor",
} as const;

export default async function PrayerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadPrayerHome();
  if (!page.ok) return <BlockedScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="prayer" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {query.ok === "prayed" ? <ActionToast termKey="pray_together_btn" testId="pray-toast" /> : null}
      <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
      <form action={createPrayerAction} id="prayer-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <TermArea termKey="field_prayer" name="content" required rows={4} />
        <VisibilityField />
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
                <TermText termKey={VISIBILITY_TERM[item.visibility] as TermKey} />
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
