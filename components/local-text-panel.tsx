"use client";

import { useState } from "react";
import { emptyTemplate, fileMatchesQuery, libraryQuery, preferredFileName, splitSlides, textFileBody, type LibraryQuery } from "@/lib/local-library";
import { confirmLocalText, findLocalText, linkLocalFolder, localFolderLinked, saveLocalText } from "@/lib/local-files";
import type { Song, WorshipItem } from "@/lib/types";

export function LocalTextPanel({ item, song }: { item: WorshipItem; song?: Song }) {
  const query = libraryQuery(item, song);
  const [linked, setLinked] = useState(false);
  const [foundName, setFoundName] = useState("");
  const [foundText, setFoundText] = useState("");
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  if (!query) return null;
  const template = emptyTemplate(query);

  async function connect() {
    setMessage("");
    const ok = await linkLocalFolder();
    setLinked(ok);
    if (!ok) setMessage("이 브라우저에서는 컴퓨터 폴더를 연결할 수 없습니다.");
  }

  async function search() {
    setMessage("");
    const ready = linked || (await localFolderLinked());
    setLinked(ready);
    if (!ready) {
      setMessage("먼저 이 컴퓨터의 텍스트 폴더를 연결해 주세요.");
      return;
    }
    const hit = await findLocalText(query!);
    if (!hit) {
      setFoundName("");
      setFoundText("");
      setWriting(true);
      setDraft("");
      setMessage("이 컴퓨터에서 해당하는 txt를 찾지 못했습니다. 빈 칸에 직접 쓸 수 있습니다.");
      return;
    }
    setFoundName(hit.fileName);
    setFoundText(hit.text);
    setWriting(false);
    setMessage("");
  }

  async function accept() {
    await confirmLocalText(query!, foundText);
    setMessage("이 컴퓨터에서만 슬라이드에 씁니다. 서버로는 올리지 않습니다.");
  }

  function reject() {
    setWriting(true);
    setDraft("");
    setFoundText("");
  }

  async function save() {
    const body = textFileBody(query!, draft);
    const saved = await saveLocalText(preferredFileName(query!), body);
    if (!saved) {
      setMessage("이 컴퓨터에 저장하지 못했습니다.");
      return;
    }
    await confirmLocalText(query!, draft);
    setMessage(`${saved} 파일로 이 컴퓨터에만 저장했습니다.`);
    setWriting(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h3 className="font-semibold">{template.caption}</h3>
      <p className="mt-1 text-sm text-muted">제목, 찬송가 장 번호, 성경 장·절로 이 컴퓨터의 txt를 찾습니다. 본문은 서버에 올리지 않습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-quiet" onClick={() => void connect()}>
          텍스트 폴더 연결
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => void search()}>
          이 컴퓨터에서 찾기
        </button>
      </div>
      {foundText && !writing ? (
        <div className="mt-4">
          <p className="text-sm text-muted">{foundName} · 이 내용이 맞습니까?</p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-3 text-sm">{foundText}</pre>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void accept()}>
              맞습니다
            </button>
            <button type="button" className="btn btn-quiet" onClick={reject}>
              다릅니다. 새로 작성
            </button>
          </div>
        </div>
      ) : null}
      {writing ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <p className="text-sm text-muted">빈 {template.bodyLabel} 칸입니다. 앱이 가사나 성경 본문을 넣어 두지 않습니다.</p>
          <label className="field">
            <span>{template.bodyLabel}</span>
            <textarea className="textarea" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} />
          </label>
          <button type="submit" className="btn btn-primary">
            이 컴퓨터에 txt로 저장
          </button>
        </form>
      ) : null}
      {message ? <p className="mt-3 text-sm text-pine">{message}</p> : null}
      <MatchHint query={query} />
    </section>
  );
}

function MatchHint({ query }: { query: LibraryQuery }) {
  const sample = query.kind === "hymn" ? "찬송-28.txt" : query.kind === "bible" ? "bible-이사야-40-28.txt" : "찬양-제목.txt";
  return <p className="mt-3 text-xs text-muted">파일 이름 예: {sample}. {fileMatchesQuery(sample, query) ? "" : ""}</p>;
}
