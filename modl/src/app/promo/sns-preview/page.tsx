import { PromoSns } from "@/components/promo-sns";
import { loadInstagramFeed } from "@/server/promo/instagram-feed";

export const dynamic = "force-dynamic";

/**
 * SNS 자리(인스타 폰 그리드·유튜브 목록·라이트박스)를 바로 확인하는 미리보기입니다.
 * 서귀포제일교회와 같이 공개 인스타 계정으로 글을 읽어 보여 줍니다.
 */
export default async function PromoSnsPreviewPage() {
  const instagramHref = "https://www.instagram.com/anyplan/";
  const instagram = await loadInstagramFeed(instagramHref);
  const videos = [
    {
      id: "M7lc1UVf-VE",
      title: "유튜브 안내 영상",
      url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      thumbnailUrl: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    },
    {
      id: "jNQXAC9IVRw",
      title: "짧은 공개 영상",
      url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      thumbnailUrl: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
    },
    {
      id: "aqz-KE-bpKQ",
      title: "넓은 화면 미리보기용 영상",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      thumbnailUrl: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
    },
  ] as const;

  return (
    <section className="grid gap-4" data-testid="promo-sns-preview">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: '"JejuMyeongjo", "제주명조", serif' }}>
          SNS 자리 미리보기
        </h1>
        <p className="leading-relaxed text-[#5c5148]">
          넓은 화면은 왼쪽 인스타그램(폰처럼 긴 틀)·오른쪽 유튜브(세로 세 개)입니다. 좁은 화면은 위에서 아래로 한
          줄입니다. 인스타그램은 게시물 칸이 먼저 보이고, 유튜브 썸네일을 누르면 이 페이지 안에서 커져서 재생됩니다.
        </p>
      </div>
      <PromoSns
        headingLevel="h2"
        instagramAccount={instagramHref}
        instagram={instagram}
        youtube={{ status: "ready", videos: [...videos] }}
      />
    </section>
  );
}
