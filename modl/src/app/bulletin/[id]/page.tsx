import { ErrorNote, OkNote } from "@/components/form-note";
import { BulletinEditor } from "@/components/bulletin-editor";
import { BulletinView } from "@/components/bulletin-view";
import { ShareLink } from "@/components/share-link";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { saveBulletinAction, unpublishBulletinAction } from "@/server/bulletin/actions";
import { loadBulletin } from "@/server/bulletin/service";

export const dynamic = "force-dynamic";

export default async function BulletinDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  let page: Awaited<ReturnType<typeof loadBulletin>>;
  try {
    page = await loadBulletin(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "이 주보를 열 수 없습니다.";
    return (
      <section className="grid gap-4">
        <TermHeading termKey="bulletin" level={1} />
        <ErrorNote message={message} />
      </section>
    );
  }

  if (!page.ok) {
    return (
      <section className="grid gap-4">
        <TermHeading termKey="bulletin" level={1} />
        <ErrorNote message={query.error} />
        <p className="leading-relaxed">{page.message}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <TermHeading termKey="bulletin" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {page.bulletin.serviceLabel ? (
        <p className="font-semibold leading-snug">
          {[page.bulletin.serviceLabel, page.bulletin.serviceTime].filter(Boolean).join(" ")}
        </p>
      ) : null}
      {page.canPublish ? (
        <>
          <BulletinEditor
            action={saveBulletinAction}
            bulletinId={page.bulletin.id}
            worshipDate={page.bulletin.worshipDate}
            sermonTitle={page.bulletin.sermonTitle}
            scriptureText={page.bulletin.scriptureText}
            preacher={page.bulletin.preacher}
            blocks={page.bulletin.blocks}
          />
          {page.bulletin.isPublic ? (
            <form action={unpublishBulletinAction}>
              <input type="hidden" name="bulletinId" value={page.bulletin.id} />
              <button type="submit" className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold leading-snug">
                <TermText termKey="bulletin_unpublish" />
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <BulletinView
          worshipDate={page.bulletin.worshipDate}
          sermonTitle={page.bulletin.sermonTitle}
          scriptureText={page.bulletin.scriptureText}
          preacher={page.bulletin.preacher}
          blocks={page.bulletin.blocks}
        />
      )}
      {page.bulletin.isPublic && page.bulletin.shareToken ? (
        <ShareLink
          title={page.bulletin.sermonTitle}
          dateLabel={page.bulletin.worshipDate}
          path={`/bulletin/share/${page.bulletin.shareToken}`}
          kakaoKey={page.kakao?.javascriptKey ?? null}
          templateId={page.kakao?.templateId ?? null}
        />
      ) : null}
    </section>
  );
}
