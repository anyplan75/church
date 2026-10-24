import { TermText } from "@/components/term-text";
import { safeScoreUrl, type BulletinBlock } from "@/bulletin/blocks";
import type { TermKey } from "@/theme/dictionary";

const BLOCK_TERM: Record<BulletinBlock["type"], TermKey> = {
  order: "block_order",
  sermon: "block_sermon",
  officers: "block_officers",
  praise: "block_praise",
  announcement: "block_announcement",
};

/** 저장된 순서 그대로 주보를 보여 줍니다. */
export function BulletinView({
  worshipDate,
  sermonTitle,
  scriptureText,
  preacher,
  blocks,
}: {
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
}) {
  return (
    <article className="grid gap-4" data-testid="bulletin-view">
      <header className="grid gap-1 rounded-3xl bg-[#fffaf3] px-4 py-4 leading-snug">
        <p className="break-words text-[#5c5148]">{worshipDate}</p>
        <h2 className="break-words text-[clamp(1.4rem,1.1rem+0.8vw,2rem)] font-semibold leading-snug">{sermonTitle}</h2>
        <p className="break-words">
          <TermText termKey="field_scripture" /> {scriptureText}
        </p>
        <p className="break-words">
          <TermText termKey="field_preacher" /> {preacher}
        </p>
      </header>
      <ol className="grid gap-3">
        {(Array.isArray(blocks) ? blocks : []).map((block) => {
          const termKey = BLOCK_TERM[block.type];
          if (!termKey) return null;
          return (
          <li
            key={block.id}
            data-testid="rendered-block"
            data-block-type={block.type}
            className="grid gap-2 rounded-3xl bg-[#fffaf3] px-4 py-4 leading-snug"
          >
            <h3 className="break-words text-[clamp(1.1rem,1rem+0.3vw,1.35rem)] font-semibold leading-snug">
              <TermText termKey={termKey} />
            </h3>
            <BlockBody block={block} />
          </li>
          );
        })}
      </ol>
    </article>
  );
}

function BlockBody({ block }: { block: BulletinBlock }) {
  if (block.type === "order") {
    return (
      <ol className="grid gap-2">
        {block.items.map((item, index) => (
          <li key={item.id} className="break-words">
            <span className="font-semibold">
              {index + 1}. {item.label}
            </span>
            {item.detail ? <span className="mt-1 block text-[#5c5148]">{item.detail}</span> : null}
          </li>
        ))}
      </ol>
    );
  }
  if (block.type === "sermon") {
    return (
      <div className="grid gap-1 break-words">
        <p className="font-semibold">{block.title}</p>
        <p>
          <TermText termKey="field_scripture" /> {block.scripture}
        </p>
        <p>
          <TermText termKey="field_preacher" /> {block.preacher}
        </p>
      </div>
    );
  }
  if (block.type === "officers") {
    return (
      <ul className="grid gap-1">
        {block.people.map((person) => (
          <li key={person.id} className="break-words">
            <TermText termKey="field_duty" /> {person.duty} · <TermText termKey="field_name" /> {person.name}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "praise") {
    return (
      <ul className="grid gap-3">
        {block.songs.map((song) => {
          const score = safeScoreUrl(song.scoreUrl);
          return (
            <li key={song.id} className="grid gap-2">
              <p className="break-words font-semibold">{song.title}</p>
              {score ? (
                <img src={score} alt={song.title || "악보"} className="h-auto max-w-full rounded-2xl" />
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{block.body}</p>;
}
