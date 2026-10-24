import { ErrorNote } from "@/components/form-note";
import { BulletinEditor } from "@/components/bulletin-editor";
import { TermHeading } from "@/components/term-heading";
import { saveBulletinAction } from "@/server/bulletin/actions";
import { loadBulletinList } from "@/server/bulletin/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function NewBulletinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const page = await loadBulletinList();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="grid gap-4">
      <TermHeading termKey="bulletin_new" level={1} />
      <ErrorNote message={query.error} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : !page.canPublish ? (
        <p className="leading-relaxed">주보만들기는 그 교회 담당자만 합니다.</p>
      ) : (
        <BulletinEditor
          action={saveBulletinAction}
          worshipDate={today}
          sermonTitle=""
          scriptureText=""
          preacher=""
          blocks={[]}
        />
      )}
    </section>
  );
}
