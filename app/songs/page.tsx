"use client";

import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { createSong, deleteSong, updateSong } from "@/lib/actions";
import { COPYRIGHT_NOTE } from "@/lib/checklist";

export default function SongsPage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  if (!ready || !db) return null;
  const songs = db.songs;

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">찬양</h1>
      <p className="mt-2 max-w-3xl text-muted">곡명과 번호만 저장합니다. {COPYRIGHT_NOTE}</p>
      {query.error === "title" ? <p className="mt-4 text-sm text-wine">곡명을 입력해 주세요.</p> : null}

      <form action={createSong} autoComplete="off" className="card mt-6 grid gap-3 p-5 md:grid-cols-2 md:items-end">
        <label className="field">
          <span>번호</span>
          <input className="input" name="hymnNumber" maxLength={10} placeholder="405" />
        </label>
        <label className="field">
          <span>곡명</span>
          <input className="input" name="title" maxLength={80} required placeholder="곡명" />
        </label>
        <label className="field">
          <span>조</span>
          <input className="input" name="key" maxLength={8} placeholder="G" />
        </label>
        <label className="field">
          <span>화면 표시</span>
          <select className="select" name="license" defaultValue="title-only">
            <option value="title-only">제목만 표시</option>
            <option value="permitted">사용 허가를 확인한 짧은 문구</option>
          </select>
        </label>
        <label className="field">
          <span>허가된 한 줄</span>
          <input className="input" name="permittedLine" maxLength={80} placeholder="허가를 받은 경우에만 저장됩니다" />
        </label>
        <SubmitButton>추가</SubmitButton>
      </form>

      <div className="mt-6 space-y-3">
        {songs.length === 0 ? <p className="text-muted">등록된 찬양이 없습니다.</p> : null}
        {songs.map((song) => (
          <form key={song.id} action={updateSong} className="card grid gap-3 p-4 md:grid-cols-2 md:items-end">
            <input type="hidden" name="id" value={song.id} />
            <label className="field">
              <span>번호</span>
              <input className="input" name="hymnNumber" defaultValue={song.hymnNumber} maxLength={10} />
            </label>
            <label className="field">
              <span>곡명</span>
              <input className="input" name="title" defaultValue={song.title} maxLength={80} required />
            </label>
            <label className="field">
              <span>조</span>
              <input className="input" name="key" defaultValue={song.key} maxLength={8} />
            </label>
            <label className="field">
              <span>화면 표시</span>
              <select className="select" name="license" defaultValue={song.license === "permitted" ? "permitted" : "title-only"}>
                <option value="title-only">제목만 표시</option>
                <option value="permitted">사용 허가를 확인한 짧은 문구</option>
              </select>
            </label>
            <label className="field">
              <span>허가된 한 줄</span>
              <input className="input" name="permittedLine" defaultValue={song.license === "permitted" ? song.permittedLine : ""} maxLength={80} />
            </label>
            <SubmitButton className="btn btn-quiet">저장</SubmitButton>
            <ConfirmSubmit action={deleteSong} message={`${song.title} 곡을 지울까요?`} className="btn btn-quiet text-wine">
              삭제
            </ConfirmSubmit>
          </form>
        ))}
      </div>
    </div>
  );
}
