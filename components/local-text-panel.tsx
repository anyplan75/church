"use client";

import { useEffect, useState } from "react";
import { emptyTemplate, fileSlides, folderStatusText, libraryQuery } from "@/lib/local-library";
import { linkLocalFolder, notifyPassageSaved, readPassage, writePassageFile } from "@/lib/local-files";
import type { Song, WorshipItem } from "@/lib/types";

export function LocalTextPanel({ item, song, onSaved }: { item: WorshipItem; song?: Song; onSaved?: () => void }) {
  const query = libraryQuery(item, song);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "connected" | "idle" | "unsupported" | "reconnect">("loading");
  const [slides, setSlides] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const template = query ? emptyTemplate(query) : null;
  const signature = query ? `${query.kind}\n${query.hymnNumber}\n${query.scripture}\n${query.title}` : "";

  useEffect(() => {
    if (!query) return;
    const current = query;
    let cancel = false;
    void readPassage(current).then((result) => {
      if (cancel) return;
      if (result.state !== "connected") {
        setState(result.state);
        setText("");
        setFileName(null);
        return;
      }
      setState("connected");
      setFileName(result.fileName);
      setText(result.text);
    });
    return () => {
      cancel = true;
    };
  }, [signature]);

  if (!query || !template) return null;

  async function connect() {
    setMessage("");
    const ok = await linkLocalFolder(query!.kind);
    if (!ok) {
      setState("reconnect");
      setMessage("폴더 권한이 없습니다. 다시 연결해 주세요.");
      return;
    }
    const result = await readPassage(query!);
    if (result.state !== "connected") {
      setState(result.state);
      setMessage(result.state === "reconnect" ? "폴더 권한이 없습니다. 다시 연결해 주세요." : "이 컴퓨터의 폴더를 연결해 주세요.");
      return;
    }
    setState("connected");
    setFileName(result.fileName);
    setText(result.text);
  }

  async function save() {
    if (!query) return;
    setSaving(true);
    setMessage("");
    const saved = await writePassageFile(query, text, fileName);
    setSaving(false);
    if (!saved.ok) {
      setState(saved.state);
      setMessage(saved.state === "reconnect" ? "폴더 권한이 없습니다. 다시 연결해 주세요." : "이 컴퓨터의 폴더를 연결해 주세요.");
      return;
    }
    setFileName(saved.fileName);
    setSlides(fileSlides(query, text));
    setMessage(`${saved.fileName}에 저장했습니다. 이 예배 슬라이드를 다시 만들었습니다.`);
    onSaved?.();
    notifyPassageSaved();
  }

  return (
    <section className="mt-3 rounded-2xl border border-line bg-white p-4" data-passage-editor={query.kind}>
      <h3 className="font-semibold">{template.caption}</h3>
      <p className="mt-1 text-sm text-muted">이 예배에서 불러온 글입니다. 고친 내용은 연결된 폴더의 txt에만 저장하고, 서버나 앱에는 남기지 않습니다.</p>
      {state === "loading" ? <p className="mt-3 text-sm text-muted">파일을 읽는 중</p> : null}
      {state === "connected" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted" data-passage-file={fileName || "new"}>
            {fileName || `${template.fileName} · 새 파일`}
          </p>
          <label className="field">
            <span>{template.bodyLabel}</span>
            <textarea className="textarea min-h-40" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} data-passage-text />
          </label>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "저장 중" : "파일에 저장"}
          </button>
        </div>
      ) : null}
      {state === "reconnect" || state === "idle" || state === "unsupported" ? (
        <div className="mt-3">
          <p className="text-sm text-wine">{state === "unsupported" ? "이 브라우저에서는 폴더를 연결할 수 없습니다." : folderStatusText({ state, folderName: "", txtCount: 0, names: [] })}</p>
          {state === "unsupported" ? null : (
            <button type="button" className="btn btn-quiet mt-2" onClick={() => void connect()}>
              {state === "reconnect" ? "다시 연결" : "폴더 연결"}
            </button>
          )}
        </div>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-pine" data-passage-saved={message.includes("저장했습니다") ? "yes" : undefined}>
          {message}
        </p>
      ) : null}
      {slides.length > 0 ? (
        <div className="mt-4 space-y-2" data-passage-slides={String(slides.length)}>
          <p className="text-sm text-muted">다시 만든 슬라이드</p>
          {slides.slice(0, 4).map((slide, index) => (
            <div key={`${index}-${slide.slice(0, 12)}`} className="rounded-xl bg-[#10241f] px-4 py-3 text-center text-[#f6f1e6]">
              {slide.split("\n").map((line) => (
                <p key={line} className="slide-line">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
