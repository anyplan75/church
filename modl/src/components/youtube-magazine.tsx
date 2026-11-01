type YoutubeVideo = { id: string; title: string; url: string; thumbnailUrl: string };

/**
 * 한 교회나 한 모들의 유튜브 최신 글입니다.
 * 넓은 화면은 가로 3칸, 좁은 화면은 세로로 쌓습니다. 있는 글만 칸을 차지합니다.
 */
export function YoutubeMagazine({ videos }: { videos: readonly YoutubeVideo[] }) {
  if (videos.length === 0) return null;
  return (
    <ul data-testid="youtube-magazine" data-youtube-count={videos.length} className="grid list-none grid-cols-1 gap-4 md:grid-cols-3">
      {videos.map((video) => (
        <li key={video.id} className="grid content-start gap-2" data-testid="youtube-card">
          <a href={video.url} target="_blank" rel="noreferrer" className="grid gap-2">
            <img src={video.thumbnailUrl} alt="" className="aspect-video w-full rounded-2xl object-cover" />
            <span className="font-semibold leading-snug">{video.title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
