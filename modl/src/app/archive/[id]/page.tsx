import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { loadArchiveDetail } from "@/server/archive/service";

export const dynamic = "force-dynamic";

export default async function ArchiveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadArchiveDetail(id);
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="archive" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
        <>
          <h2 className="break-words text-[clamp(1.3rem,1.1rem+0.6vw,1.8rem)] font-semibold leading-snug" data-testid="archive-title">
            {page.archive.title}
          </h2>
          {page.archive.photos.map((photo) => (
            <img key={photo} src={photo} alt="" className="h-auto w-full rounded-2xl" />
          ))}
          {page.archive.videos.map((video) => (
            <iframe
              key={video}
              data-testid="youtube-embed"
              src={video}
              title={page.archive.title}
              className="aspect-video w-full rounded-2xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ))}
        </>
    </section>
  );
}
