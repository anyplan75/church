import Link from "next/link";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { WebsiteEditor } from "@/components/website-editor";
import { resolveInquiryAction, saveWebsiteAction } from "@/server/website/actions";
import { loadWebsiteEditor, requestOrigin } from "@/server/website/service";

export const dynamic = "force-dynamic";

export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadWebsiteEditor(await requestOrigin());

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="website" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          <p className="break-all leading-relaxed">
            <TermText termKey="website_public_path" /> {page.publicPath}
          </p>
          <p className="break-all leading-relaxed">{page.atPath}</p>
          <p className="leading-relaxed">
            <TermText termKey="visit_count" /> {page.visitCount}
          </p>
          {page.qrDataUrl ? (
            <img data-testid="website-qr" src={page.qrDataUrl} alt="" className="h-40 w-40 max-w-full" />
          ) : null}
          <Link href={page.publicPath} className="w-fit max-w-full font-semibold leading-snug" data-testid="open-site">
            <TermText termKey="open_website" />
          </Link>
          {!page.pushReady ? (
            <p data-testid="inquiry-push-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              <TermText termKey="inquiry_in_app_only" />
            </p>
          ) : null}
          <section className="grid gap-2">
            <TermHeading termKey="inquiry_notices" level={2} />
            {page.notices.length === 0 ? (
              <p className="leading-relaxed">
                <TermText termKey="inquiry_empty" />
              </p>
            ) : (
              <ul className="grid gap-2">
                {page.notices.map((notice) => (
                  <li key={notice.id} data-testid="inquiry-notice" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                    <span className="break-words font-semibold">{notice.visitorName}</span>
                    <span className="break-words text-[#5c5148]">{notice.visitorContact}</span>
                    <p className="break-words whitespace-pre-wrap">{notice.message}</p>
                    {notice.isResolved ? (
                      <TermText termKey="inquiry_done" />
                    ) : (
                      <form action={resolveInquiryAction}>
                        <input type="hidden" name="inquiryId" value={notice.id} />
                        <ResolveButton />
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <WebsiteEditor
            action={saveWebsiteAction}
            initialBlocks={page.blocks}
            initialTheme={page.theme}
            initialSeo={page.seo}
            communityName={page.communityName}
            planTier={page.planTier}
            bulletin={page.bulletin}
            events={page.events}
            survey={page.survey}
            surveyChoices={page.surveyChoices}
            slug={page.slug}
          />
        </>
      )}
    </section>
  );
}

function ResolveButton() {
  return (
    <button
      type="submit"
      data-testid="resolve-inquiry"
      className="w-fit max-w-full whitespace-normal rounded-2xl bg-[#1d6b45] px-4 py-3 text-left font-semibold leading-snug text-white"
    >
      <TermText termKey="mark_resolved" />
    </button>
  );
}
