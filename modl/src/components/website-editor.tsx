"use client";

import { useState } from "react";
import { useCommunityTerm } from "@/components/use-community-term";
import { WebsiteView } from "@/components/website-view";
import type { TermKey } from "@/theme/dictionary";
import {
  emptyBlock,
  linesToFaqs,
  linesToList,
  linesToSocials,
  moveWebsiteBlock,
  WEBSITE_BLOCK_TYPES,
  type LinkedBulletin,
  type LinkedEvent,
  type LinkedSurvey,
  type WebsiteBlock,
  type WebsiteBlockType,
  type WebsiteSeo,
  type WebsiteTheme,
} from "@/website/rules";

const BLOCK_TERM: Record<WebsiteBlockType, TermKey> = {
  intro_profile: "block_intro_profile",
  intro_body: "block_intro_body",
  intro_album: "block_intro_album",
  intro_video: "block_intro_video",
  intro_banner: "block_intro_banner",
  visit_times: "block_visit_times",
  visit_map: "block_visit_map",
  visit_faq: "block_visit_faq",
  visit_inquiry: "block_visit_inquiry",
  news_notice: "block_news_notice",
  news_dday: "block_news_dday",
  news_popup: "block_news_popup",
  news_files: "block_news_files",
  news_social: "block_news_social",
  link_bulletin: "block_link_bulletin",
  link_calendar: "block_link_calendar",
  link_survey: "block_link_survey",
};

const inputClass = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

export function WebsiteEditor({
  action,
  initialBlocks,
  initialTheme,
  initialSeo,
  communityName,
  planTier,
  bulletin,
  events,
  survey,
  surveyChoices,
  slug,
}: {
  action: (formData: FormData) => Promise<void>;
  initialBlocks: WebsiteBlock[];
  initialTheme: WebsiteTheme;
  initialSeo: WebsiteSeo;
  communityName: string;
  planTier: "FREE" | "PRO";
  bulletin: LinkedBulletin | null;
  events: LinkedEvent[];
  survey: LinkedSurvey | null;
  surveyChoices: Array<{ id: string; title: string }>;
  slug: string;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [theme, setTheme] = useState(initialTheme);
  const [seo, setSeo] = useState(initialSeo);

  function addBlock(type: WebsiteBlockType) {
    setBlocks((current) => [...current, emptyBlock(type, crypto.randomUUID())]);
  }

  function patch(index: number, next: Partial<WebsiteBlock>) {
    setBlocks((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)));
  }

  return (
    <form action={action} id="website-form" className="grid min-w-0 gap-4">
      <input type="hidden" name="blocksJson" value={JSON.stringify(blocks)} />
      <input type="hidden" name="themeJson" value={JSON.stringify(theme)} />
      <input type="hidden" name="seoJson" value={JSON.stringify(seo)} />
      <div className="flex flex-wrap gap-2">
        {WEBSITE_BLOCK_TYPES.map((type) => (
          <AddButton key={type} termKey={BLOCK_TERM[type]} testId={`add-${type}`} onClick={() => addBlock(type)} />
        ))}
      </div>
      <ol className="grid gap-3">
        {blocks.map((block, index) => (
          <li key={block.id} data-testid="editor-block" data-block-type={block.type} className="grid gap-3 rounded-3xl bg-[#fffaf3] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="break-words font-semibold leading-snug">
                <TermLabel termKey={BLOCK_TERM[block.type]} />
              </h2>
              <div className="flex flex-wrap gap-2">
                <SmallButton termKey="move_up" testId="move-up" onClick={() => setBlocks((current) => moveWebsiteBlock(current, index, -1))} />
                <SmallButton termKey="move_down" testId="move-down" onClick={() => setBlocks((current) => moveWebsiteBlock(current, index, 1))} />
                <SmallButton
                  termKey="remove_block"
                  testId="remove-block"
                  onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}
                />
              </div>
            </div>
            <BlockFields block={block} surveyChoices={surveyChoices} onChange={(next) => patch(index, next)} />
          </li>
        ))}
      </ol>
      <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold leading-snug">
          <TermLabel termKey="website_design" />
        </h2>
        <FontField value={theme.font} onChange={(font) => setTheme((current) => ({ ...current, font }))} />
        <ColorField value={theme.background} onChange={(background) => setTheme((current) => ({ ...current, background }))} />
        <ButtonField value={theme.button} onChange={(button) => setTheme((current) => ({ ...current, button }))} />
      </section>
      <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold leading-snug">
          <TermLabel termKey="website_seo" />
        </h2>
        <TextField termKey="field_seo_title" value={seo.title} onChange={(title) => setSeo((current) => ({ ...current, title }))} />
        <AreaField
          termKey="field_seo_description"
          value={seo.description}
          onChange={(description) => setSeo((current) => ({ ...current, description }))}
        />
        <TextField termKey="field_seo_image" value={seo.imageUrl} onChange={(imageUrl) => setSeo((current) => ({ ...current, imageUrl }))} />
        <IndexField checked={seo.indexable} onChange={(indexable) => setSeo((current) => ({ ...current, indexable }))} />
      </section>
      <SaveButton />
      <WebsiteView
        mode="preview"
        communityName={communityName}
        theme={theme}
        blocks={blocks}
        bulletin={bulletin}
        events={events}
        survey={survey}
        showProNote={planTier !== "PRO"}
        slug={slug}
        inquiryAction={undefined}
      />
    </form>
  );
}

function BlockFields({
  block,
  surveyChoices,
  onChange,
}: {
  block: WebsiteBlock;
  surveyChoices: Array<{ id: string; title: string }>;
  onChange: (next: Partial<WebsiteBlock>) => void;
}) {
  if (block.type === "intro_profile") {
    return (
      <>
        <TextField termKey="field_name" value={block.title} onChange={(title) => onChange({ title })} />
        <AreaField termKey="field_body" value={block.body} onChange={(body) => onChange({ body })} />
        <TextField termKey="field_photo_urls" value={block.photoUrl} onChange={(photoUrl) => onChange({ photoUrl })} />
      </>
    );
  }
  if (block.type === "intro_body" || block.type === "visit_times") {
    return <AreaField termKey="field_body" value={block.body} onChange={(body) => onChange({ body })} />;
  }
  if (block.type === "intro_album") {
    return (
      <AreaField termKey="field_line_urls" value={block.photoUrls.join("\n")} onChange={(raw) => onChange({ photoUrls: linesToList(raw) })} />
    );
  }
  if (block.type === "intro_video") {
    return <TextField termKey="field_youtube" value={block.videoUrl} onChange={(videoUrl) => onChange({ videoUrl })} />;
  }
  if (block.type === "intro_banner") {
    return (
      <>
        <TextField termKey="field_name" value={block.title} onChange={(title) => onChange({ title })} />
        <TextField termKey="field_photo_urls" value={block.imageUrl} onChange={(imageUrl) => onChange({ imageUrl })} />
        <TextField termKey="field_link_url" value={block.linkUrl} onChange={(linkUrl) => onChange({ linkUrl })} />
      </>
    );
  }
  if (block.type === "visit_map") {
    return <TextField termKey="field_address" value={block.address} onChange={(address) => onChange({ address })} />;
  }
  if (block.type === "visit_faq") {
    return (
      <AreaField
        termKey="field_faq_lines"
        value={block.faqs.map((item) => `${item.question}|${item.answer}`).join("\n")}
        onChange={(raw) => onChange({ faqs: linesToFaqs(raw) })}
      />
    );
  }
  if (block.type === "visit_inquiry" || block.type === "link_bulletin" || block.type === "link_calendar") {
    return null;
  }
  if (block.type === "news_notice" || block.type === "news_popup") {
    return (
      <>
        <TextField termKey="field_name" value={block.title} onChange={(title) => onChange({ title })} />
        <AreaField termKey="field_body" value={block.body} onChange={(body) => onChange({ body })} />
      </>
    );
  }
  if (block.type === "news_dday") {
    return (
      <>
        <TextField termKey="field_name" value={block.title} onChange={(title) => onChange({ title })} />
        <TextField termKey="field_qt_date" type="date" value={block.targetDate} onChange={(targetDate) => onChange({ targetDate })} />
      </>
    );
  }
  if (block.type === "news_files") {
    return (
      <>
        <TextField termKey="field_name" value={block.title} onChange={(title) => onChange({ title })} />
        <AreaField termKey="field_line_urls" value={block.fileUrls.join("\n")} onChange={(raw) => onChange({ fileUrls: linesToList(raw) })} />
      </>
    );
  }
  if (block.type === "news_social") {
    return (
      <AreaField
        termKey="field_social_lines"
        value={block.socials.map((item) => `${item.label}|${item.url}`).join("\n")}
        onChange={(raw) => onChange({ socials: linesToSocials(raw) })}
      />
    );
  }
  return <SurveyField value={block.surveyId} choices={surveyChoices} onChange={(surveyId) => onChange({ surveyId })} />;
}

function TermLabel({ termKey }: { termKey: TermKey }) {
  const term = useCommunityTerm(termKey);
  return <span>{term.primary}</span>;
}

function AddButton({ termKey, testId, onClick }: { termKey: TermKey; testId: string; onClick: () => void }) {
  const term = useCommunityTerm(termKey);
  return (
    <button type="button" data-testid={testId} className="rounded-2xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold leading-snug" onClick={onClick}>
      {term.primary}
    </button>
  );
}

function SmallButton({ termKey, testId, onClick }: { termKey: TermKey; testId: string; onClick: () => void }) {
  const term = useCommunityTerm(termKey);
  return (
    <button type="button" data-testid={testId} className="rounded-2xl bg-white px-3 py-2 leading-snug" onClick={onClick}>
      {term.primary}
    </button>
  );
}

function TextField({
  termKey,
  value,
  onChange,
  type = "text",
}: {
  termKey: TermKey;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const term = useCommunityTerm(termKey);
  return (
    <label className="grid gap-1">
      <span className="font-semibold">{term.primary}</span>
      <input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AreaField({ termKey, value, onChange }: { termKey: TermKey; value: string; onChange: (value: string) => void }) {
  const term = useCommunityTerm(termKey);
  return (
    <label className="grid gap-1">
      <span className="font-semibold">{term.primary}</span>
      <textarea className={inputClass} rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FontField({ value, onChange }: { value: WebsiteTheme["font"]; onChange: (value: WebsiteTheme["font"]) => void }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermLabel termKey="field_theme_font" />
      </span>
      <select className={inputClass} data-testid="theme-font" value={value} onChange={(event) => onChange(event.target.value as WebsiteTheme["font"])}>
        <FontOption value="sans" termKey="theme_sans" />
        <FontOption value="serif" termKey="theme_serif" />
        <FontOption value="rounded" termKey="theme_rounded" />
      </select>
    </label>
  );
}

function FontOption({ value, termKey }: { value: string; termKey: TermKey }) {
  const term = useCommunityTerm(termKey);
  return <option value={value}>{term.primary}</option>;
}

function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const term = useCommunityTerm("field_theme_background");
  return (
    <label className="grid gap-1">
      <span className="font-semibold">{term.primary}</span>
      <input data-testid="theme-background" className="h-12 w-full" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ButtonField({ value, onChange }: { value: WebsiteTheme["button"]; onChange: (value: WebsiteTheme["button"]) => void }) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold">
        <TermLabel termKey="field_theme_button" />
      </span>
      <select
        className={inputClass}
        data-testid="theme-button"
        value={value}
        onChange={(event) => onChange(event.target.value as WebsiteTheme["button"])}
      >
        <FontOption value="square" termKey="button_square" />
        <FontOption value="rounded" termKey="button_rounded" />
        <FontOption value="pill" termKey="button_pill" />
      </select>
    </label>
  );
}

function IndexField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const term = useCommunityTerm("seo_indexable");
  return (
    <label className="flex flex-wrap items-start gap-2 leading-snug">
      <input data-testid="seo-indexable" type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{term.primary}</span>
    </label>
  );
}

function SurveyField({
  value,
  choices,
  onChange,
}: {
  value: string;
  choices: Array<{ id: string; title: string }>;
  onChange: (value: string) => void;
}) {
  const term = useCommunityTerm("field_survey_title");
  return (
    <label className="grid gap-1">
      <span className="font-semibold">{term.primary}</span>
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{term.primary}</option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function SaveButton() {
  const term = useCommunityTerm("save_website");
  return (
    <button type="submit" data-testid="save-website" className="w-fit max-w-full whitespace-normal rounded-2xl bg-[#1d6b45] px-4 py-3 text-left font-semibold leading-snug text-white">
      {term.primary}
    </button>
  );
}
