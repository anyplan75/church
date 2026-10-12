import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { createSong, deleteSong, updateSong } from "@/lib/actions";
import { readDb } from "@/lib/store";

export const metadata = { title: "찬양 · 예배 운영" };

export default async function SongsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const songs = readDb().songs;

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">찬양</h1>
      <p className="mt-2 text-muted">찬송가 번호가 있는 찬송과, 번호 없는 찬양을 함께 둡니다.</p>
      {query.error === "title" ? <p className="mt-4 text-sm text-wine">곡명을 입력해 주세요.</p> : null}

      <form action={createSong} autoComplete="off" className="card mt-6 grid gap-3 p-5 md:grid-cols-[6rem_1fr_6rem_auto] md:items-end">
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
        <SubmitButton>추가</SubmitButton>
      </form>

      <div className="mt-6 space-y-3">
        {songs.length === 0 ? <p className="text-muted">등록된 찬양이 없습니다.</p> : null}
        {songs.map((song) => (
          <form key={song.id} action={updateSong} className="card grid gap-3 p-4 md:grid-cols-[6rem_1fr_6rem_auto_auto] md:items-end">
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
