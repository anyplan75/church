import { ErrorNote } from "@/components/form-note";
import { importChurchSheetAction, removeChurchAction, saveChurchAction } from "@/server/map/church-actions";
import { loadChurchSettings } from "@/server/map/board";

export const dynamic = "force-dynamic";

const FIELD = "w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug";

function note(ok: string | undefined, count: string | undefined, missed: string | undefined): string {
  if (ok === "church") return "교회를 저장했습니다.";
  if (ok === "removed") return "교회를 지웠습니다.";
  if (ok === "missed") return "교회는 저장했지만, 주소를 지도에서 찾지 못해 핀은 없습니다.";
  if (ok === "sheet") {
    const saved = count && /^\d+$/.test(count) ? `${count}곳을 넣었습니다.` : "엑셀의 교회를 넣었습니다.";
    if (missed && /^\d+$/.test(missed) && missed !== "0") return `${saved} ${missed}곳은 주소를 찾지 못해 핀이 없습니다.`;
    return saved;
  }
  return "";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; count?: string; missed?: string }>;
}) {
  const query = await searchParams;
  const page = await loadChurchSettings();
  const status = note(query.ok, query.count, query.missed);

  return (
    <section className="grid gap-4">
      <h1 className="page-title text-[clamp(1.45rem,1.1rem+1.2vw,2.15rem)] leading-snug">설정</h1>
      <ErrorNote message={query.error} />
      {status ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {status}
        </p>
      ) : null}
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#4b5563]">교회 목록은 사역자만 넣고, 고치고, 지웁니다.</p>
          <form action={saveChurchAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <h2 className="font-semibold leading-snug">교회 추가</h2>
            <label className="grid gap-1">
              <span className="font-semibold">교회이름</span>
              <input name="name" required className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">담임목사</span>
              <input name="pastorName" className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">주소</span>
              <input name="address" className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">전화번호</span>
              <input name="phone" className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">주일 예배시간</span>
              <input name="serviceTime" className={FIELD} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">메모</span>
              <input name="memo" className={FIELD} />
            </label>
            <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
              저장
            </button>
          </form>
          <form action={importChurchSheetAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <h2 className="font-semibold leading-snug">엑셀로 넣기</h2>
            <p className="leading-relaxed text-[#4b5563]">첫 줄 칸 이름은 교회이름, 담임목사, 주소, 전화번호, 주일 예배시간, 메모 순서입니다.</p>
            <input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className={FIELD} />
            <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
              엑셀 넣기
            </button>
          </form>
          {page.churches.length === 0 ? (
            <p className="leading-relaxed">등록된 교회가 없습니다.</p>
          ) : (
            <ul className="grid list-none gap-3">
              {page.churches.map((church) => (
                <li key={church.id} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
                  <form action={saveChurchAction} className="grid gap-3">
                    <input type="hidden" name="churchId" value={church.id} />
                    <label className="grid gap-1">
                      <span className="font-semibold">교회이름</span>
                      <input name="name" required defaultValue={church.name} className={FIELD} />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-semibold">담임목사</span>
                      <input name="pastorName" defaultValue={church.pastorName} className={FIELD} />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-semibold">주소</span>
                      <input name="address" defaultValue={church.address} className={FIELD} />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-semibold">전화번호</span>
                      <input name="phone" defaultValue={church.phone} className={FIELD} />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-semibold">주일 예배시간</span>
                      <input name="serviceTime" defaultValue={church.serviceTime} className={FIELD} />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-semibold">메모</span>
                      <input name="memo" defaultValue={church.memo} className={FIELD} />
                    </label>
                    <p className="leading-relaxed text-[#4b5563]">{church.pinned ? "지도에 핀이 있습니다." : "주소가 없거나 좌표를 찾지 못해 핀이 없습니다."}</p>
                    <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
                      수정
                    </button>
                  </form>
                  <form action={removeChurchAction}>
                    <input type="hidden" name="churchId" value={church.id} />
                    <button type="submit" className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold">
                      삭제
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
