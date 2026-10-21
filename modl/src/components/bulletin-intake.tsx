"use client";

import { useState } from "react";
import { bulletinAccept, bulletinFormatNote, type BulletinServiceDraft } from "@/bulletin/intake";
import { readBulletinSourceAction } from "@/server/bulletin/read-source";

export function BulletinIntake({ onApply }: { onApply: (services: BulletinServiceDraft[]) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState("");

  async function onRead(formData: FormData) {
    setPending(true);
    setError("");
    setNote("");
    const result = await readBulletinSourceAction(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNote(result.note);
    if (result.filled) onApply(result.services);
  }

  return (
    <div className="grid gap-3 rounded-3xl bg-[#fffaf3] px-4 py-4">
      <h2 className="text-[clamp(1.1rem,1rem+0.3vw,1.35rem)] font-semibold leading-snug">주보 입력</h2>
      <p className="text-sm leading-6 text-[#5c5148]">{bulletinFormatNote()}</p>
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
      <form action={onRead} className="grid gap-3">
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
