"use client";

import { useState } from "react";
import { createBlock, moveBlock, safeScoreUrl, type BlockType, type BulletinBlock } from "@/bulletin/blocks";
import type { BulletinServiceDraft } from "@/bulletin/intake";
import { saveBulletinWeekAction } from "@/server/bulletin/actions";
import { BulletinIntake } from "@/components/bulletin-intake";
import { TermText } from "@/components/term-text";
import { useCommunityTerm } from "@/components/use-community-term";
import type { TermKey } from "@/theme/dictionary";

const BLOCK_TERM: Record<BlockType, TermKey> = {
  order: "block_order",
  sermon: "block_sermon",
  officers: "block_officers",
  praise: "block_praise",
  announcement: "block_announcement",
};

const inputClass = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

function newId(): string {
  return crypto.randomUUID();
}

export function BulletinEditor({
  action,
  bulletinId,
  worshipDate,
  sermonTitle,
  scriptureText,
  preacher,
  blocks,
}: {
  action: (formData: FormData) => Promise<void>;
  bulletinId?: string;
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
}) {
  const [items, setItems] = useState(blocks);
  const [date, setDate] = useState(worshipDate);
  const [title, setTitle] = useState(sermonTitle);
  const [scripture, setScripture] = useState(scriptureText);
  const [speaker, setSpeaker] = useState(preacher);
  const [week, setWeek] = useState<BulletinServiceDraft[] | null>(null);

  function applyIntake(services: BulletinServiceDraft[]) {
    if (!bulletinId && services.length > 0) {
      setWeek(services);
      return;
    }
    const fields = services[0];
    if (!fields) return;
    if (fields.worshipDate) setDate(fields.worshipDate);
    setTitle(fields.sermonTitle);
    setScripture(fields.scriptureText);
    setSpeaker(fields.preacher);
    setItems(fields.blocks);
  }

  function addBlock(type: BlockType) {
    setItems((current) => [...current, createBlock(type, newId())]);
  }

  function update(index: number, block: BulletinBlock) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? block : item)));
  }

  return (
    <div className="grid gap-4">
      <BulletinIntake onApply={applyIntake} />
      {week ? (
        <form action={saveBulletinWeekAction} className="grid gap-4" data-testid="bulletin-week">
          <input type="hidden" name="weekJson" value={JSON.stringify(week)} />
          <h2 className="font-semibold leading-snug">이번 주 예배</h2>
          <p className="leading-relaxed text-[#5c5148]">한 번 읽은 예배 {week.length}개입니다. 글에 없는 순서는 넣지 않았습니다.</p>
          <ol className="grid gap-3">
            {week.map((service) => {
              const order = service.blocks.find((block) => block.type === "order");
              const labels = order?.type === "order" ? order.items.map((item) => item.label) : [];
              return (
                <li key={`${service.label}-${service.worshipDate}-${service.time}`} className="grid gap-1 rounded-3xl bg-[#fffaf3] px-4 py-4">
                  <p className="font-semibold leading-snug">
                    {service.label} {service.time}
                  </p>
                  <p className="leading-relaxed text-[#5c5148]">{service.worshipDate || "날짜를 읽지 못했습니다."}</p>
                  {service.sermonTitle ? <p className="leading-relaxed">{service.sermonTitle}</p> : null}
                  {labels.length > 0 ? <p className="leading-relaxed">{labels.join(" · ")}</p> : null}
                </li>
              );
            })}
          </ol>
          <button type="submit" className="w-fit rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white">
            이번 주 저장
          </button>
        </form>
      ) : null}
      {week ? null : (
      <form action={action} id="bulletin-form" className="grid gap-4">
      {bulletinId ? <input type="hidden" name="bulletinId" value={bulletinId} /> : null}
      <input type="hidden" name="blocksJson" value={JSON.stringify(items)} />
      <p className="leading-relaxed text-[#5c5148]">
        설교 제목, 본문 말씀, 설교자는 목록과 공유 카드에 나갑니다. 아래 블록은 교회마다 순서를 바꿔도 됩니다.
      </p>
      <label className="grid gap-1">
        <span className="font-semibold">
          <TermText termKey="field_worship_date" />
        </span>
        <input className={inputClass} name="worshipDate" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">
          <TermText termKey="field_sermon_title" />
        </span>
        <input className={inputClass} name="sermonTitle" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">
          <TermText termKey="field_scripture" />
        </span>
        <textarea className={inputClass} name="scriptureText" rows={3} value={scripture} onChange={(event) => setScripture(event.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">
          <TermText termKey="field_preacher" />
        </span>
        <input className={inputClass} name="preacher" value={speaker} onChange={(event) => setSpeaker(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLOCK_TERM) as BlockType[]).map((type) => (
          <AddBlockButton key={type} type={type} onAdd={() => addBlock(type)} />
        ))}
      </div>
      <ol className="grid gap-3">
        {items.map((block, index) => (
          <li key={block.id} data-testid="editor-block" data-block-type={block.type} className="grid gap-3 rounded-3xl bg-[#fffaf3] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="break-words text-[clamp(1.1rem,1rem+0.3vw,1.35rem)] font-semibold leading-snug">
                <TermText termKey={BLOCK_TERM[block.type]} />
              </h2>
              <div className="flex flex-wrap gap-2">
                <SmallButton termKey="move_up" testId="move-up" onClick={() => setItems((current) => moveBlock(current, index, -1))} />
                <SmallButton termKey="move_down" testId="move-down" onClick={() => setItems((current) => moveBlock(current, index, 1))} />
                <SmallButton
                  termKey="remove_block"
                  testId="remove-block"
                  onClick={() => setItems((current) => current.filter((item) => item.id !== block.id))}
                />
              </div>
            </div>
            <BlockFields block={block} onChange={(next) => update(index, next)} />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <IntentButton termKey="bulletin_save" intent="save" primary={false} />
        <IntentButton termKey="bulletin_publish" intent="publish" primary />
      </div>
      </form>
      )}
    </div>
  );
}

function AddBlockButton({ type, onAdd }: { type: BlockType; onAdd: () => void }) {
  const term = useCommunityTerm(BLOCK_TERM[type]);
  return (
    <button
      type="button"
      data-testid={`add-${type}`}
      className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold leading-snug"
      onClick={onAdd}
    >
      {term.primary}
    </button>
  );
}

function SmallButton({
  termKey,
  testId,
  onClick,
}: {
  termKey: TermKey;
  testId: string;
  onClick: () => void;
}) {
  const term = useCommunityTerm(termKey);
  return (
    <button type="button" data-testid={testId} className="rounded-2xl bg-[#f4efe4] px-3 py-2 font-semibold leading-snug" onClick={onClick}>
      {term.primary}
    </button>
  );
}

function IntentButton({ termKey, intent, primary }: { termKey: TermKey; intent: string; primary: boolean }) {
  const term = useCommunityTerm(termKey);
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      className={
        primary
          ? "rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white"
          : "rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold leading-snug"
      }
    >
      {term.primary}
    </button>
  );
}

function RowButton({ onClick }: { onClick: () => void }) {
  const term = useCommunityTerm("add_row");
  return (
    <button type="button" className="w-fit rounded-2xl bg-[#f4efe4] px-3 py-2 font-semibold leading-snug" onClick={onClick}>
      {term.primary}
    </button>
  );
}

function BlockFields({ block, onChange }: { block: BulletinBlock; onChange: (block: BulletinBlock) => void }) {
  if (block.type === "order") {
    return (
      <div className="grid gap-3">
        {block.items.map((item, index) => (
          <div key={item.id} className="grid gap-2">
            <label className="grid gap-1">
              <span className="font-semibold">
                <TermText termKey="field_order_label" />
              </span>
              <input
                className={inputClass}
                data-testid="order-label"
                value={item.label}
                onChange={(event) => {
                  const items = block.items.slice();
                  items[index] = { ...item, label: event.target.value };
                  onChange({ ...block, items });
                }}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">
                <TermText termKey="field_order_detail" />
              </span>
              <input
                className={inputClass}
                value={item.detail}
                onChange={(event) => {
                  const items = block.items.slice();
                  items[index] = { ...item, detail: event.target.value };
                  onChange({ ...block, items });
                }}
              />
            </label>
          </div>
        ))}
        <RowButton
          onClick={() => onChange({ ...block, items: [...block.items, { id: newId(), label: "", detail: "" }] })}
        />
      </div>
    );
  }
  if (block.type === "sermon") {
    return (
      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="font-semibold">
            <TermText termKey="field_sermon_title" />
          </span>
          <input className={inputClass} value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">
            <TermText termKey="field_scripture" />
          </span>
          <textarea className={inputClass} rows={3} value={block.scripture} onChange={(event) => onChange({ ...block, scripture: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">
            <TermText termKey="field_preacher" />
          </span>
          <input className={inputClass} value={block.preacher} onChange={(event) => onChange({ ...block, preacher: event.target.value })} />
        </label>
      </div>
    );
  }
  if (block.type === "officers") {
    return (
      <div className="grid gap-3">
        {block.people.map((person, index) => (
          <div key={person.id} className="grid gap-2">
            <label className="grid gap-1">
              <span className="font-semibold">
                <TermText termKey="field_duty" />
              </span>
              <input
                className={inputClass}
                value={person.duty}
                onChange={(event) => {
                  const people = block.people.slice();
                  people[index] = { ...person, duty: event.target.value };
                  onChange({ ...block, people });
                }}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">
                <TermText termKey="field_name" />
              </span>
              <input
                className={inputClass}
                value={person.name}
                onChange={(event) => {
                  const people = block.people.slice();
                  people[index] = { ...person, name: event.target.value };
                  onChange({ ...block, people });
                }}
              />
            </label>
          </div>
        ))}
        <RowButton onClick={() => onChange({ ...block, people: [...block.people, { id: newId(), duty: "", name: "" }] })} />
      </div>
    );
  }
  if (block.type === "praise") {
    return (
      <div className="grid gap-3">
        {block.songs.map((song, index) => {
          const score = safeScoreUrl(song.scoreUrl);
          return (
            <div key={song.id} className="grid gap-2">
              <label className="grid gap-1">
                <span className="font-semibold">
                  <TermText termKey="field_song" />
                </span>
                <input
                  className={inputClass}
                  value={song.title}
                  onChange={(event) => {
                    const songs = block.songs.slice();
                    songs[index] = { ...song, title: event.target.value };
                    onChange({ ...block, songs });
                  }}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-semibold">
                  <TermText termKey="field_score" />
                </span>
                <input
                  className={inputClass}
                  value={song.scoreUrl}
                  onChange={(event) => {
                    const songs = block.songs.slice();
                    songs[index] = { ...song, scoreUrl: event.target.value };
                    onChange({ ...block, songs });
                  }}
                />
              </label>
              {score ? <img src={score} alt={song.title || "악보"} className="h-auto max-w-full rounded-2xl" /> : null}
            </div>
          );
        })}
        <RowButton onClick={() => onChange({ ...block, songs: [...block.songs, { id: newId(), title: "", scoreUrl: "" }] })} />
      </div>
    );
  }
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermText termKey="field_announcement" />
      </span>
      <textarea
        className={inputClass}
        data-testid="announcement-body"
        rows={4}
        value={block.body}
        onChange={(event) => onChange({ ...block, body: event.target.value })}
      />
    </label>
  );
}
