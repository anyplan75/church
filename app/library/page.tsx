"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { saveLibrary } from "@/lib/actions";
import { connectFolder, findNamedFile, readFolderView } from "@/lib/local-files";
import { LibraryUseSteps } from "@/components/service-folder";
import { folderStatusText, LIBRARY_RULES, type FolderView } from "@/lib/local-library";
import { isMobileOperatorApp } from "@/lib/mobile-app";
import { CAPTION_FONTS, captionFont, captionSize, compactLabel, fullscreenStep } from "@/lib/simple";

const KINDS = [
  { id: "bible", label: "성경", hint: LIBRARY_RULES[0], sample: "창세기" },
  { id: "hymn", label: "찬송가", hint: LIBRARY_RULES[1], sample: "찬송가1장" },
  { id: "praise", label: "찬양", hint: LIBRARY_RULES[2], sample: "찬양 제목" },
] as const;

const OVERLAYS = [
  { id: "bottom", label: "아래" },
  { id: "top", label: "위" },
  { id: "left", label: "왼쪽" },
  { id: "right", label: "오른쪽" },
] as const;

const STEPS = ["맨 위", "위", "가운데", "아래", "맨 아래"];

export default function LibraryPage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  const [notice, setNotice] = useState("");
  const [hit, setHit] = useState("");
  const [foldersView, setFoldersView] = useState<Partial<Record<(typeof KINDS)[number]["id"], FolderView>>>({});
  const [overlay, setOverlay] = useState("bottom");
  const [overlayFontId, setOverlayFontId] = useState("noto-sans-kr");
  const [fullFontId, setFullFontId] = useState("noto-sans-kr");
  const [step, setStep] = useState(2);
  const [primed, setPrimed] = useState(false);
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
  useEffect(() => {
    if (!db || primed) return;
    setOverlay(db.settings.overlay);
    setOverlayFontId(captionFont(db.settings.overlayFont).id);
    setFullFontId(captionFont(db.settings.fullscreenFont).id);
    setStep(fullscreenStep(db.settings.fullscreenStep));
    setPrimed(true);
  }, [db, primed]);
  if (!ready || !db) return null;
  const settings = db.settings;
  const folders = settings.folders ?? { bible: "", hymn: "", praise: "" };
  const backgrounds = settings.backgrounds ?? ["배경 1", "배경 2", "배경 3", "배경 4", "배경 5"];
  const previewFont = captionFont(fullFontId).family;

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

  const mobile = isMobileOperatorApp();

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">라이브러리</h1>
      <p className="mt-2 text-muted">성경, 찬송가, 찬양 폴더를 각각 지정합니다. 본문은 이 컴퓨터의 파일에서만 읽고 앱에는 저장하지 않습니다.</p>
      {mobile ? (
        <p className="mt-3 rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
          iPhone·iPad에서는 로컬 txt 폴더를 쓸 수 없습니다. 로그인·예배 진행·송출 연결은 되고, 가사·성경 본문은 조작 컴퓨터의 라이브러리에서 준비합니다.
        </p>
      ) : null}
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

        <section className="card space-y-4 p-5">
          <h2 className="font-serif text-2xl">영상 위 오버레이 자막</h2>
          <p className="text-sm text-muted">실시간 통역 자막처럼 글자만 두고, 뒤는 투명하며, 가장자리에 어두운 그라데이션을 깔습니다.</p>
          <label className="field">
            <span>위치</span>
            <select className="select" name="overlay" value={overlay} onChange={(event) => setOverlay(event.target.value)}>
              {OVERLAYS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <FontSelect name="overlayFont" value={overlayFontId} onChange={setOverlayFontId} />
          <div className="caption-frame mt-2" data-overlay-preview={overlay}>
            <div className={`worship-shade layout-${overlay}`} style={{ fontFamily: captionFont(overlayFontId).family }}>
              <p style={{ fontSize: captionSize(db.settings.overlayFontSize) }}>자막은 영상 위에 겹칩니다</p>
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-serif text-2xl">전체화면 메인 자막</h2>
          <p className="text-sm text-muted">글은 가운데 정렬이고 두 줄입니다. 위에서 아래 위치를 다섯 단계로 고릅니다.</p>
          <FontSelect name="fullscreenFont" value={fullFontId} onChange={setFullFontId} />
          <label className="field">
            <span>세로 위치</span>
            <select className="select" name="fullscreenStep" value={String(step)} onChange={(event) => setStep(fullscreenStep(Number(event.target.value)))}>
              {STEPS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-5">
            {backgrounds.slice(0, 5).map((name, index) => (
              <label key={index} className="field">
                <span>배경 {index + 1}</span>
                <input className="input" name={`background${index + 1}`} defaultValue={name} maxLength={40} />
              </label>
            ))}
          </div>
          <div className="relative h-48 overflow-hidden rounded-xl bg-pine text-center text-white" style={{ fontFamily: previewFont }}>
            <div className="absolute inset-x-0" style={{ top: `${8 + step * 16}%` }}>
              <p className="font-semibold" style={{ fontSize: captionSize(db.settings.mainFontSize) }}>첫째 줄</p>
              <p className="mt-1" style={{ fontSize: captionSize(db.settings.mainFontSize) }}>둘째 줄</p>
            </div>
          </div>
          <SubmitButton>라이브러리 저장</SubmitButton>
        </section>
      </form>
    </div>
  );
}

function FontSelect({ name, value, onChange }: { name: string; value?: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>폰트</span>
      <select className="select" name={name} value={captionFont(value).id} onChange={(event) => onChange(event.target.value)}>
        {CAPTION_FONTS.map((font) => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </select>
    </label>
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
