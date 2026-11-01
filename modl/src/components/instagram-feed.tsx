type InstagramPost = { id: string; permalink: string; imageUrl: string; caption: string };

/** 한 교회나 한 모들의 인스타그램 글입니다. 글이 없으면 빈 격자를 만들지 않습니다. */
export function InstagramFeed({ posts }: { posts: readonly InstagramPost[] }) {
  if (posts.length === 0) return null;
  return (
    <ul data-testid="instagram-feed" className="grid list-none grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {posts.map((post) => (
        <li key={post.id}>
          <a href={post.permalink} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl bg-white">
            <img src={post.imageUrl} alt={post.caption || "인스타그램 글"} className="aspect-square w-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}
