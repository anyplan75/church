"use client";

import { useState } from "react";
import { bulletinAccept, bulletinFormatNote, BULLETIN_PART_BYTES, BULLETIN_UPLOAD_BYTES, type BulletinServiceDraft } from "@/bulletin/intake";
import { finishBulletinUploadAction, readBulletinSourceAction, storeBulletinPartAction } from "@/server/bulletin/read-source";

export function BulletinIntake({ onApply }: { onApply: (services: BulletinServiceDraft[]) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState("");

  async function onRead(formData: FormData) {
    setPending(true);
    setError("");
    setNote("");
    try {
      const file = formData.get("file");
      const text = typeof formData.get("text") === "string" ? String(formData.get("text")) : "";
      const result =
        file instanceof File && file.size > BULLETIN_PART_BYTES
          ? await readLargeFile(file, text)
          : await readBulletinSourceAction(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNote(result.note);
      if (result.filled) onApply(result.services);
    } catch {
      setError("주보를 읽지 못했습니다. 다시 눌러 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-3xl bg-[#fffaf3] px-4 py-4">
      <h2 className="text-[clamp(1.1rem,1rem+0.3vw,1.35rem)] font-semibold leading-snug">주보 입력</h2>
      <p className="text-sm leading-6 text-[#5c5148]">{bulletinFormatNote()}</p>
      <p className="text-sm leading-6 text-[#5c5148]">
        anyplan@me.com 으로 보낸 파일은 지금 받지 않습니다. 담당자가 이 화면에서 파일을 올리면 그 주 예배를 만듭니다. 십일조, 헌금, 봉헌은 넣지 않습니다.
      </p>
      {error ? (
        <p role="alert" className="text-sm leading-6 text-[#9a3412]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="text-sm leading-6 text-[#3f6212]">
          {note}
        </p>
      ) : null}
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onRead(new FormData(event.currentTarget));
        }}
      >
        <label className="grid gap-1">
          <span className="font-semibold">주보 글</span>
          <textarea
            name="text"
            rows={8}
            placeholder="예배 순서와 광고를 붙여 넣습니다."
            className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-6"
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">파일</span>
          <span className="flex flex-wrap items-center gap-3">
            <input
              name="file"
              type="file"
              accept={bulletinAccept()}
              className="sr-only"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
            <span className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-2 text-sm font-semibold">파일 고르기</span>
            <span className="text-sm text-[#5c5148]">{fileName || "선택한 파일 없음"}</span>
          </span>
        </label>
        <button type="submit" disabled={pending} className="w-fit rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white">
          {pending ? "읽는 중" : "주보 읽기"}
        </button>
      </form>
    </div>
  );
}

async function readLargeFile(file: File, text: string) {
  if (file.size > BULLETIN_UPLOAD_BYTES) {
    return { ok: false as const, message: "파일은 16MB 이하로 올려 주세요." };
  }
  const uploadId = crypto.randomUUID();
  const count = Math.ceil(file.size / BULLETIN_PART_BYTES);
  for (let index = 0; index < count; index += 1) {
    const slice = file.slice(index * BULLETIN_PART_BYTES, Math.min(file.size, (index + 1) * BULLETIN_PART_BYTES));
    const part = new FormData();
    part.set("uploadId", uploadId);
    part.set("index", String(index));
    part.set("count", String(count));
    part.set("name", file.name);
    part.set("part", new File([slice], "part", { type: "application/octet-stream" }));
    const stored = await storeBulletinPartAction(part);
    if (!stored.ok) return stored;
  }
  const finish = new FormData();
  finish.set("uploadId", uploadId);
  finish.set("count", String(count));
  finish.set("name", file.name);
  finish.set("text", text);
  return finishBulletinUploadAction(finish);
}
