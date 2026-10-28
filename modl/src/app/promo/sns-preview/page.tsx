import { PromoSnsLazy } from "@/components/promo-sns-lazy";

/** 미리보기도 제목 껍데기를 먼저 보내고, SNS는 나중에 채웁니다. */
export const revalidate = 60;

/**
 * SNS 자리(아이폰 인스타·유튜브 최근 3개·라이트박스)를 바로 확인하는 미리보기입니다.
 * 서귀포제일교회처럼 연결된 공개 계정에서 글을 읽어 보여 줍니다.
 */
export default function PromoSnsPreviewPage() {
  const instagramHref = "https://www.instagram.com/anyplan/";
  const youtubeChannel = "https://www.youtube.com/@서귀포제일교회";

  return (
    <section className="grid gap-4" data-testid="promo-sns-preview">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: '"JejuMyeongjo", "제주명조", serif' }}>
          SNS 자리 미리보기
        </h1>
        <p className="leading-relaxed text-[#5c5148]">
          넓은 화면은 왼쪽 아이폰 인스타그램·오른쪽 유튜브 최근 영상 세 개입니다. 유튜브는 채널에서 자동으로 읽고,
          썸네일을 누르면 이 페이지 안에서 커져서 재생됩니다.
        </p>
      </div>
      <PromoSnsLazy headingLevel="h2" instagramAccount={instagramHref} youtubeUrl={youtubeChannel} />
    </section>
  );
}
