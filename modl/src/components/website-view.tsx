"use client";

import { useState } from "react";
import Link from "next/link";
import { TermText } from "@/components/term-text";
import { useCommunityTerm } from "@/components/use-community-term";
import { youtubeEmbedUrl } from "@/archive/rules";
import type { TermKey } from "@/theme/dictionary";
import {
  daysUntil,
  isHttpUrl,
  type LinkedBulletin,
  type LinkedEvent,
  type LinkedSurvey,
  type WebsiteBlock,
  type WebsiteTheme,
} from "@/website/rules";

const FONT_FAMILY = {
  sans: '"JejuGothic", "제주고딕", sans-serif',
  serif: '"JejuMyeongjo", "제주명조", serif',
  rounded: '"JejuGothic", "제주고딕", sans-serif',
} as const;

const BUTTON_CLASS = {
  square: "rounded-none",
  rounded: "rounded-2xl",
  pill: "rounded-full",
} as const;

function safeSrc(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.includes("..")) return trimmed;
  return isHttpUrl(trimmed) ? trimmed : null;
}

export function WebsiteView({
  communityName,
  theme,
  blocks,
  bulletin,
  events,
  survey,
  showProNote,
  inquiryAction,
  slug,
  mode,
}: {
  communityName: string;
  theme: WebsiteTheme;
  blocks: WebsiteBlock[];
  bulletin: LinkedBulletin | null;
  events: LinkedEvent[];
  survey: LinkedSurvey | null;
  showProNote: boolean;
  inquiryAction?: (formData: FormData) => Promise<void>;
  slug?: string;
  mode: "public" | "preview";
}) {
  const buttonClass = `inline-flex max-w-full whitespace-normal px-4 py-3 font-semibold leading-snug text-white ${BUTTON_CLASS[theme.button]}`;
  const popup = mode === "public" ? blocks.find((block) => block.type === "news_popup" && (block.title || block.body)) : null;
  const [popupOpen, setPopupOpen] = useState(Boolean(popup));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      data-testid={mode === "public" ? "site-canvas" : "website-preview"}
      className="grid min-w-0 gap-4 rounded-3xl p-4"
      style={{ backgroundColor: theme.background, fontFamily: FONT_FAMILY[theme.font] }}
    >
      <h2 className="break-words text-[clamp(1.4rem,1.1rem+0.8vw,2rem)] font-semibold leading-snug">{communityName}</h2>
      {popup && popupOpen ? (
        <div data-testid="site-popup" className="grid gap-2 rounded-2xl bg-white px-4 py-3 leading-snug">
          <p className="break-words font-semibold">{popup.title}</p>
          <p className="break-words whitespace-pre-wrap">{popup.body}</p>
          <button type="button" className={`${buttonClass} bg-[#1d6b45]`} onClick={() => setPopupOpen(false)}>
            <TermText termKey="close_popup" />
          </button>
        </div>
      ) : null}
      {blocks.map((block) => (
        <article key={block.id} data-testid="site-block" data-block-type={block.type} className="grid min-w-0 gap-2 rounded-2xl bg-white/80 px-4 py-3">
          <BlockBody
            block={block}
            bulletin={bulletin}
            events={events}
            survey={survey}
            showProNote={showProNote}
            today={today}
            buttonClass={buttonClass}
            inquiryAction={inquiryAction}
            slug={slug}
          />
        </article>
      ))}
    </div>
  );
}

function BlockBody({
  block,
  bulletin,
  events,
  survey,
  showProNote,
  today,
  buttonClass,
  inquiryAction,
  slug,
}: {
  block: WebsiteBlock;
  bulletin: LinkedBulletin | null;
  events: LinkedEvent[];
  survey: LinkedSurvey | null;
  showProNote: boolean;
  today: string;
  buttonClass: string;
  inquiryAction?: (formData: FormData) => Promise<void>;
  slug?: string;
}) {
  if (block.type === "link_bulletin" || block.type === "link_calendar" || block.type === "link_survey") {
    if (showProNote) {
      return (
        <p data-testid="pro-block-note" className="leading-relaxed">
          <TermText termKey="pro_blocks_locked" />
        </p>
      );
    }
  }

  if (block.type === "intro_profile") {
    const photo = safeSrc(block.photoUrl);
    return (
      <>
        <BlockTitle termKey="block_intro_profile" title={block.title} />
        {photo ? <img src={photo} alt="" className="max-w-full rounded-2xl" /> : null}
        <p className="break-words whitespace-pre-wrap leading-relaxed">{block.body}</p>
      </>
    );
  }
  if (block.type === "intro_body") {
    return <p className="break-words whitespace-pre-wrap leading-relaxed">{block.body}</p>;
  }
  if (block.type === "intro_album") {
    return (
      <div className="grid gap-2">
        <BlockTitle termKey="block_intro_album" title="" />
        {block.photoUrls.map((url) => {
          const src = safeSrc(url);
          return src ? <img key={url} src={src} alt="" className="max-w-full rounded-2xl" /> : null;
        })}
      </div>
    );
  }
  if (block.type === "intro_video") {
    const embed = youtubeEmbedUrl(block.videoUrl);
    const src = safeSrc(block.videoUrl);
    return (
      <div className="grid gap-2">
        <BlockTitle termKey="block_intro_video" title="" />
        {embed ? (
          <iframe className="aspect-video w-full rounded-2xl" src={embed} title={block.videoUrl} allow="encrypted-media" />
        ) : src ? (
          <a className="break-all font-semibold" href={src}>
            {src}
          </a>
        ) : null}
      </div>
    );
  }
  if (block.type === "intro_banner") {
    const image = safeSrc(block.imageUrl);
    const link = safeSrc(block.linkUrl);
    const inner = (
      <span className="grid gap-2">
        {image ? <img src={image} alt="" className="max-w-full rounded-2xl" /> : null}
        <span className="break-words font-semibold">{block.title || block.body}</span>
      </span>
    );
    return link ? (
      <a href={link} className="break-words">
        {inner}
      </a>
    ) : (
      inner
    );
  }
  if (block.type === "visit_times") {
    return (
      <>
        <BlockTitle termKey="block_visit_times" title="" />
        <p className="break-words whitespace-pre-wrap leading-relaxed">{block.body}</p>
      </>
    );
  }
  if (block.type === "visit_map") {
    const query = encodeURIComponent(block.address);
    return (
      <>
        <BlockTitle termKey="block_visit_map" title="" />
        <p className="break-words leading-relaxed">{block.address}</p>
        {block.address ? (
          <iframe
            className="h-64 w-full rounded-2xl"
            title={block.address}
            src={`https://maps.google.com/maps?q=${query}&output=embed`}
          />
        ) : null}
      </>
    );
  }
  if (block.type === "visit_faq") {
    return (
      <>
        <BlockTitle termKey="block_visit_faq" title="" />
        <ul className="grid gap-2">
          {block.faqs.map((item, index) => (
            <li key={`${block.id}-${index}`} className="grid gap-1">
              <p className="break-words font-semibold">{item.question}</p>
              <p className="break-words whitespace-pre-wrap leading-relaxed">{item.answer}</p>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (block.type === "visit_inquiry") {
    if (!inquiryAction || !slug) {
      return <BlockTitle termKey="block_visit_inquiry" title="" />;
    }
    return (
      <form action={inquiryAction} className="grid gap-3" data-testid="inquiry-form">
        <input type="hidden" name="slug" value={slug} />
        <InquiryField termKey="field_inquiry_name" name="visitorName" />
        <InquiryField termKey="field_inquiry_contact" name="visitorContact" />
        <InquiryArea termKey="field_inquiry_message" name="message" />
        <InquirySubmit buttonClass={buttonClass} />
      </form>
    );
  }
  if (block.type === "news_notice") {
    return (
      <>
        <BlockTitle termKey="block_news_notice" title={block.title} />
        <p className="break-words whitespace-pre-wrap leading-relaxed">{block.body}</p>
      </>
    );
  }
  if (block.type === "news_dday") {
    const days = daysUntil(block.targetDate, today);
    return (
      <>
        <BlockTitle termKey="block_news_dday" title={block.title} />
        <p className="leading-relaxed">
          <TermText termKey="dday_left" /> {days ?? ""}
        </p>
      </>
    );
  }
  if (block.type === "news_popup") {
    return (
      <>
        <BlockTitle termKey="block_news_popup" title={block.title} />
        <p className="break-words whitespace-pre-wrap leading-relaxed">{block.body}</p>
      </>
    );
  }
  if (block.type === "news_files") {
    return (
      <>
        <BlockTitle termKey="block_news_files" title={block.title} />
        <ul className="grid gap-1">
          {block.fileUrls.map((url) => {
            const href = safeSrc(url);
            return href ? (
              <li key={url}>
                <a className="break-all font-semibold" href={href}>
                  {href}
                </a>
              </li>
            ) : null;
          })}
        </ul>
      </>
    );
  }
  if (block.type === "news_social") {
    return (
      <>
        <BlockTitle termKey="block_news_social" title="" />
        <ul className="grid gap-1">
          {block.socials.map((item, index) =>
            isHttpUrl(item.url) ? (
              <li key={`${block.id}-${index}`}>
                <a className="break-all font-semibold" href={item.url}>
                  {item.label || item.url}
                </a>
              </li>
            ) : null,
          )}
        </ul>
      </>
    );
  }
  if (block.type === "link_bulletin") {
    return bulletin ? (
      <Link href={bulletin.href} data-testid="site-bulletin" className="grid gap-1 font-semibold leading-snug">
        <TermText termKey="block_link_bulletin" />
        <span className="break-words">{bulletin.worshipDate}</span>
        <span className="break-words">{bulletin.title}</span>
      </Link>
    ) : (
      <p className="leading-relaxed">
        <TermText termKey="website_empty_link" />
      </p>
    );
  }
  if (block.type === "link_calendar") {
    return (
      <div className="grid gap-2">
        <BlockTitle termKey="block_link_calendar" title="" />
        {events.length === 0 ? (
          <p className="leading-relaxed">
            <TermText termKey="website_empty_link" />
          </p>
        ) : (
          <ul className="grid gap-1">
            {events.map((event) => (
              <li key={event.id} className="break-words leading-snug">
                {event.startAt.replace("T", " ").slice(0, 16)} {event.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return survey ? (
    <Link href={survey.href} data-testid="site-survey" className="grid gap-1 font-semibold leading-snug">
      <TermText termKey="block_link_survey" />
      <span className="break-words">{survey.title}</span>
    </Link>
  ) : (
    <p className="leading-relaxed">
      <TermText termKey="website_empty_link" />
    </p>
  );
}

function BlockTitle({ termKey, title }: { termKey: TermKey; title: string }) {
  return (
    <h3 className="break-words text-[clamp(1.05rem,1rem+0.3vw,1.3rem)] font-semibold leading-snug">
      <TermText termKey={termKey} />
      {title ? <span className="mt-1 block font-normal">{title}</span> : null}
    </h3>
  );
}

function InquiryField({ termKey, name }: { termKey: TermKey; name: string }) {
  const term = useCommunityTerm(termKey);
  return (
    <label className="grid gap-1">
      <span className="font-semibold">{term.primary}</span>
      <input className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" name={name} required />
    </label>
  );
}

function InquiryArea({ termKey, name }: { termKey: TermKey; name: string }) {
  const term = useCommunityTerm(termKey);
  return (
    <label className="grid gap-1">
      <span className="font-semibold">{term.primary}</span>
      <textarea className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" name={name} required rows={4} />
    </label>
  );
}

function InquirySubmit({ buttonClass }: { buttonClass: string }) {
  const term = useCommunityTerm("send_inquiry");
  return (
    <button type="submit" data-testid="send-inquiry" className={`${buttonClass} bg-[#1d6b45]`}>
      {term.primary}
    </button>
  );
}
