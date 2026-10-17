"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { saveLibrary } from "@/lib/actions";
import { connectFolder, findNamedFile, readFolderView } from "@/lib/local-files";
import { LibraryUseSteps } from "@/components/service-folder";
import { folderStatusText, LIBRARY_RULES, type FolderView } from "@/lib/local-library";
import { compactLabel } from "@/lib/simple";

const KINDS = [
  { id: "bible", label: "성경", hint: LIBRARY_RULES[0], sample: "창세기" },
  { id: "hymn", label: "찬송가", hint: LIBRARY_RULES[1], sample: "찬송가1장" },
  { id: "praise", label: "찬양", hint: LIBRARY_RULES[2], sample: "찬양 제목" },
] as const;

export default function LibraryPage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  const [notice, setNotice] = useState("");
  const [hit, setHit] = useState("");
  const [foldersView, setFoldersView] = useState<Partial<Record<(typeof KINDS)[number]["id"], FolderView>>>({});
  useEffect(() => {
    let cancel = false;
    void Promise.all(KINDS.map((kind) => readFolderView(kind.id))).then((views) => {
      if (cancel) return;
      setFoldersView(Object.fromEntries(KINDS.map((kind, index) => [kind.id, views[index]])));
    });
    return () => {
      cancel = true;
    };
  }, []);
  if (!ready || !db) return null;
  const settings = db.settings;
  const folders = settings.folders ?? { bible: "", hymn: "", praise: "" };

  async function connect(slot: (typeof KINDS)[number]["id"]) {
    setNotice("");
    const view = await connectFolder(slot);
    setFoldersView((current) => ({ ...current, [slot]: view }));
  }

  async function search(slot: string, label: string) {
    setHit("");
    setNotice("");
    const wanted = compactLabel(label);
    if (!wanted) {
      setNotice("찾을 이름을 입력해 주세요.");
      return;
    }
    const name = await findNamedFile(slot, label);
    setHit(name ? `찾음: ${name}` : `이 컴퓨터에서 ${label.replace(/\s+/g, "")} 파일을 찾지 못했습니다.`);
  }

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">라이브러리</h1>
      <p className="mt-2 text-muted">성경, 찬송가, 찬양 폴더를 각각 지정합니다. 본문은 이 컴퓨터의 파일에서만 읽고 앱에는 저장하지 않습니다.</p>
      <LibraryUseSteps />
      <section className="card mt-6 p-5">
        <h2 className="font-serif text-2xl">찾는 규칙</h2>
        <ul className="mt-3 space-y-1 text-sm leading-6">
          {LIBRARY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
      {query.saved ? <p className="mt-4 text-sm text-pine">라이브러리 설정을 저장했습니다.</p> : null}
      {notice ? <p className="mt-4 text-sm text-muted">{notice}</p> : null}
      {hit ? <p className="mt-2 text-sm text-pine">{hit}</p> : null}

      <form action={saveLibrary} className="mt-6 space-y-6">
        {KINDS.map((kind) => (
          <section key={kind.id} className="card space-y-3 p-5">
            <h2 className="font-serif text-2xl">{kind.label}</h2>
            <p className="text-sm text-muted">{kind.hint}</p>
            <label className="field">
              <span>저장 폴더</span>
              <input className="input" name={kind.id} defaultValue={folders[kind.id]} maxLength={80} placeholder="폴더 이름" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-quiet btn-small" onClick={() => void connect(kind.id)}>
                이 컴퓨터에서 폴더 연결
              </button>
            </div>
            <p className="text-sm text-ink" data-folder-status={kind.id}>
              {foldersView[kind.id] ? folderStatusText(foldersView[kind.id]!) : "폴더 확인 중"}
            </p>
            <LibrarySearch sample={kind.sample} onSearch={(label) => void search(kind.id, label)} />
          </section>
        ))}
        <SubmitButton>라이브러리 저장</SubmitButton>
      </form>
    </div>
  );
}

function LibrarySearch({ sample, onSearch }: { sample: string; onSearch: (label: string) => void }) {
  const [label, setLabel] = useState(sample);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="field min-w-48 flex-1">
        <span>찾기</span>
        <input className="input" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <button type="button" className="btn btn-quiet" onClick={() => onSearch(label)}>
        이 컴퓨터에서 찾기
      </button>
    </div>
  );
}
