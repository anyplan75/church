"use client";

import { InstagramEmbed } from "@/components/instagram-embed";

type InstagramPost = { id: string; permalink: string; imageUrl: string; caption: string };

/**
 * Meta 그래프에서 받은 글을 페이지 안 임베드로 보여 줍니다.
 * 바깥 링크로만 보내지 않습니다. 글이 없으면 그리지 않습니다.
 */
export function InstagramFeed({ posts }: { posts: readonly InstagramPost[] }) {
  if (posts.length === 0) return null;
  return (
    <ul data-testid="instagram-feed" className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2">
      {posts.map((post) => (
        <li key={post.id} className="min-w-0">
          <InstagramEmbed href={post.permalink} />
        </li>
      ))}
    </ul>
  );
}
