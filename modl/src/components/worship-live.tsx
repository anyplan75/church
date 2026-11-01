"use client";

import { useEffect, useState } from "react";
import type { BulletinBlock } from "@/bulletin/blocks";
import type { CaptionChoice } from "@/worship/caption-links";

type ServiceView = {
  id: string;
  label: string;
  time: string;
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
};

/** 예배 탭과 고른 언어의 자막입니다. 자막은 화면 위 3분의 1, 폰을 가로로 두면 전체입니다. */
export function WorshipLive({
  churchId,
  services,
  choices,
}: {
  churchId: string;
  services: ServiceView[];
  choices: CaptionChoice[];
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [language, setLanguage] = useState(choices[0]?.code ?? "");
  const [lines, setLines] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const service = services.find((item) => item.id === serviceId) ?? services[0] ?? null;

  useEffect(() => {
    if (!language) return;
    let alive = true;
    async function pull() {
      const response = await fetch(`/api/worship/caption?community=${encodeURIComponent(churchId)}&language=${encodeURIComponent(language)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { lines?: string[]; message?: string };
      if (!alive) return;
      setLines(Array.isArray(data.lines) ? data.lines : []);
      setNote(data.message ?? "");
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [churchId, language]);

  return (
    <div className={language ? "worship-live grid gap-4" : "grid gap-4"}>
      {choices.length > 0 ? (
        <section className="worship-caption grid content-start gap-3 overflow-hidden rounded-3xl bg-[#10243f] px-4 py-4 text-white" data-testid="worship-caption">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="자막 언어" data-testid="worship-language">
            {choices.map((item) => (
              <button
                key={item.code}
                type="button"
                role="tab"
                aria-selected={language === item.code}
                data-testid={`worship-lang-${item.code}`}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${language === item.code ? "bg-white text-[#10243f]" : "bg-white/15 text-white"}`}
                onClick={() => setLanguage(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid content-center gap-2" data-testid="worship-caption-lines">
            {lines.length > 0 ? (
              lines.map((line, index) => (
                <p key={`${index}-${line}`} className="text-[clamp(1.35rem,1rem+1.4vw,2.2rem)] font-semibold leading-snug">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-lg leading-snug text-white/80">{note || "자막을 기다리고 있습니다."}</p>
            )}
          </div>
        </section>
      ) : (
        <p className="leading-relaxed text-[#5c5148]">언어와 자막 링크를 연결하면 자막을 고를 수 있습니다.</p>
      )}
      <div className="worship-body grid gap-4">
        {services.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="예배">
            {services.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={service?.id === item.id}
                data-testid="worship-service-tab"
                className={`shrink-0 rounded-2xl px-4 py-3 font-semibold leading-snug ${service?.id === item.id ? "bg-[#1d6b45] text-white" : "bg-[#fffaf3]"}`}
                onClick={() => setServiceId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="leading-relaxed">이번 주 예배가 아직 없습니다.</p>
        )}
        {service ? (
          <article className="grid gap-3" data-testid="worship-service">
            <header className="grid gap-1">
              <p className="text-[#5c5148]">{[service.worshipDate, service.time].filter(Boolean).join(" · ")}</p>
              <h2 className="text-xl font-semibold leading-snug">{service.sermonTitle || service.label}</h2>
              {service.scriptureText ? <p className="leading-relaxed">본문 {service.scriptureText}</p> : null}
              {service.preacher ? <p className="leading-relaxed">설교 {service.preacher}</p> : null}
            </header>
            {service.blocks.map((block) => (
              <section key={block.id} className="grid gap-2 rounded-3xl bg-[#fffaf3] px-4 py-4">
                <h3 className="font-semibold">{blockTitle(block.type)}</h3>
                <WorshipBlock block={block} />
              </section>
            ))}
          </article>
        ) : null}
      </div>
    </div>
  );
}

function blockTitle(type: BulletinBlock["type"]): string {
  if (type === "order") return "예배순서";
  if (type === "sermon" || type === "praise") return "내용";
  if (type === "announcement") return "광고";
  return "내용";
}

function WorshipBlock({ block }: { block: BulletinBlock }) {
  if (block.type === "order") {
    return (
      <ol className="grid gap-1">
        {block.items.map((item) => (
          <li key={item.id} className="leading-relaxed">
            {item.label}
            {item.detail ? ` ${item.detail}` : ""}
          </li>
        ))}
      </ol>
    );
  }
  if (block.type === "sermon") {
    return (
      <p className="leading-relaxed">
        {[block.title, block.scripture, block.preacher].filter(Boolean).join(" · ")}
      </p>
    );
  }
  if (block.type === "praise") {
    return (
      <ul className="grid gap-1">
        {block.songs.map((song) => (
          <li key={song.id}>{song.title}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "announcement") return <p className="whitespace-pre-wrap leading-relaxed">{block.body}</p>;
  return null;
}
