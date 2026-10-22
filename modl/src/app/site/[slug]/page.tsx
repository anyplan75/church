import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorNote, OkNote } from "@/components/form-note";
import { CommunityTermProvider } from "@/components/community-term-provider";
import { TermText } from "@/components/term-text";
import { WebsiteView } from "@/components/website-view";
import { submitInquiryAction } from "@/server/website/actions";
import { loadPublicSite } from "@/server/website/service";
import { robotsForSeo } from "@/website/rules";
import type { LanguageMode } from "@/theme/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPublicSite(slug, false);
  if (!page) return { title: "모들", robots: { index: false, follow: false } };
  const title = page.seo.title || page.communityName;
  const description = page.seo.description || page.communityName;
  return {
    title,
    description,
    robots: robotsForSeo(page.seo.indexable),
    openGraph: {
      title,
      description,
      images: page.seo.imageUrl ? [page.seo.imageUrl] : undefined,
    },
  };
}

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const page = await loadPublicSite(slug, true);
  if (!page) notFound();

  return (
    <CommunityTermProvider
      languageModeFromCommunity={page.languageMode as LanguageMode}
      overridesJson={page.overridesJson}
    >
      <section className="grid min-w-0 gap-4">
        <ErrorNote message={query.error} />
        <OkNote code={query.ok} />
        <WebsiteView
          mode="public"
          communityName={page.communityName}
          theme={page.theme}
          blocks={page.blocks}
          bulletin={page.bulletin}
          events={page.events}
          survey={page.survey}
          showProNote={false}
          inquiryAction={submitInquiryAction}
          slug={page.slug}
        />
        <p className="leading-relaxed text-[#5c5148]">
          <TermText termKey="visit_count" /> {page.visitCount}
        </p>
      </section>
    </CommunityTermProvider>
  );
}
