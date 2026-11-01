import type { Metadata } from "next";
import { headers } from "next/headers";
import { BulletinView } from "@/components/bulletin-view";
import { ShareLink } from "@/components/share-link";
import { TermHeading } from "@/components/term-heading";
import { CommunityTermProvider } from "@/components/community-term-provider";
import { loadPublicBulletin, readKakaoShareConfig } from "@/server/bulletin/service";

export const dynamic = "force-dynamic";

async function origin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:3210";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}): Promise<Metadata> {
  const { shareToken } = await params;
  try {
    const page = await loadPublicBulletin(shareToken);
    if (!page) {
      return { title: "모들", robots: { index: false, follow: false } };
    }
    const url = `${await origin()}${page.sharePath}`;
    return {
      title: page.title,
      description: page.description,
      openGraph: {
        title: page.title,
        description: page.description,
        url,
      },
    };
  } catch {
    return { title: "모들", robots: { index: false, follow: false } };
  }
}

export default async function PublicBulletinPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const page = await loadPublicBulletin(shareToken).catch(() => null);
  if (!page) {
    return (
      <section className="grid gap-4" data-testid="bulletin-hidden">
        <TermHeading termKey="bulletin" level={1} />
        <p className="leading-relaxed">이 주소의 주보는 볼 수 없습니다. 표식이 없거나 아직 공개되지 않았습니다.</p>
      </section>
    );
  }
  const kakao = readKakaoShareConfig();
  return (
    <CommunityTermProvider languageModeFromCommunity={page.languageMode} overridesJson={page.overridesJson}>
      <section className="grid gap-4" data-testid="bulletin-public">
        <TermHeading termKey="bulletin" level={1} />
        <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
        <BulletinView
          worshipDate={page.worshipDate}
          sermonTitle={page.sermonTitle}
          scriptureText={page.scriptureText}
          preacher={page.preacher}
          blocks={page.blocks}
        />
        <ShareLink
          title={page.title}
          dateLabel={page.worshipDate}
          path={page.sharePath}
          kakaoKey={kakao?.javascriptKey ?? null}
          templateId={kakao?.templateId ?? null}
        />
      </section>
    </CommunityTermProvider>
  );
}
