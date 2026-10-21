import Link from "next/link";
import { SurveyAnonymousField } from "@/components/choice-fields";
import { ChurchFileField } from "@/components/church-file-field";
import { SurveyDeskLive } from "@/components/survey-desk";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { saveMyAddressFormAction, setPickupConsentFormAction, importChurchSheetAction, removeChurchAction, saveChurchAction } from "@/server/map/church-actions";
import { loadChurchSettings, loadMyPickup } from "@/server/map/board";
import { addBannedWordAction, removeBannedWordAction, updateBannedWordAction } from "@/server/moderation/actions";
import { loadBannedWordsForEditor } from "@/server/moderation/words";
import { createSurveyAction } from "@/server/survey/actions";
import { loadSurveyDesk } from "@/server/survey/service";

const FIELD = "w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug";

/** 본인 주소와 데리러 가기 동의입니다. 공동체 설정은 여기에 두지 않습니다. */
export async function OwnPickupSettings() {
  const pickup = await loadMyPickup();
  if (!pickup) return null;
  return (
    <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
      <h2 className="font-semibold leading-snug">데리러 가기 주소</h2>
      <p className="leading-relaxed text-[#5c5148]">이 주소를 데리러 가는 사역자에게 지도로 보여 줍니다.</p>
      <form action={saveMyAddressFormAction} className="grid gap-3">
        <label className="grid gap-1">
          <span className="font-semibold">내 주소</span>
          <input name="address" defaultValue={pickup.address} className={FIELD} />
        </label>
        <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          주소 저장
        </button>
      </form>
      <form action={setPickupConsentFormAction}>
        <label className="flex items-start gap-2 leading-relaxed">
          <input type="checkbox" name="agreed" defaultChecked={pickup.consented} />
          <span>데리러 가기 주소 제공</span>
        </label>
        <button type="submit" className="mt-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold">
          동의 저장
        </button>
      </form>
    </section>
  );
}

const PEOPLE = [
  { href: "/roster", label: "교인" },
  { href: "/group", label: "모임" },
  { href: "/invite", label: "초대" },
  { href: "/newcomer", label: "새가족" },
  { href: "/approvals", label: "승인" },
] as const;

/** 사역자와 임원 계정의 사람 메뉴입니다. */
export function PeopleSettings() {
  return (
    <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
      <h2 className="font-semibold leading-snug">사람</h2>
      <ul className="grid list-none gap-2">
        {PEOPLE.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="font-semibold leading-snug">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 설문 만들기와 저장된 응답입니다. 권한 없으면 그리지 않습니다. */
export async function SurveyAccountSettings() {
  const desk = await loadSurveyDesk();
  if (!desk) return null;
  return (
    <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
      <h2 className="font-semibold leading-snug">설문</h2>
      {desk.canCreate ? (
        <form action={createSurveyAction} className="grid gap-3">
          <TermField termKey="field_survey_title" name="title" required />
          <TermArea termKey="field_survey_questions" name="questionsText" required rows={4} />
          <SurveyAnonymousField />
          <TermField termKey="field_deadline" name="deadline" type="datetime-local" />
          <SubmitButton termKey="save_survey" testId="save-survey" />
        </form>
      ) : null}
      <SurveyDeskLive initial={desk} />
    </section>
  );
}

/** 사역자 계정의 교회 목록과 금지어입니다. 다른 역할에는 그리지 않습니다. */
export async function CommunityAccountSettings() {
  const page = await loadChurchSettings();
  if (!page.ok) return null;
  const banned = await loadBannedWordsForEditor();
  if (!banned.ok) return null;

  return (
    <section className="grid gap-4">
      <h2 className="font-semibold leading-snug">공동체 설정</h2>
      <p className="leading-relaxed text-[#4b5563]">교회 목록과 금지어는 사역자만 넣고, 고치고, 지웁니다.</p>
      <section className="grid gap-3">
        <h3 className="font-semibold leading-snug">금지어</h3>
        <p className="leading-relaxed text-[#4b5563]">글이 저장될 때 서버가 확인합니다.</p>
        <form action={addBannedWordAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <label className="grid gap-1">
            <span className="font-semibold">단어 추가</span>
            <input name="word" required className={FIELD} />
          </label>
          <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
            추가
          </button>
        </form>
        {banned.words.length === 0 ? (
          <p className="leading-relaxed">등록된 금지어가 없습니다.</p>
        ) : (
          <ul className="grid list-none gap-3">
            {banned.words.map((item) => (
              <li key={item.id} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
                <form action={updateBannedWordAction} className="grid gap-3">
                  <input type="hidden" name="wordId" value={item.id} />
                  <label className="grid gap-1">
                    <span className="font-semibold">단어</span>
                    <input name="word" required defaultValue={item.word} className={FIELD} />
                  </label>
                  <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
                    수정
                  </button>
                </form>
                <form action={removeBannedWordAction}>
                  <input type="hidden" name="wordId" value={item.id} />
                  <button type="submit" className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold">
                    삭제
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="leading-relaxed text-[#4b5563]">교회 목록은 사역자만 넣고, 고치고, 지웁니다.</p>
      <form action={saveChurchAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h3 className="font-semibold leading-snug">교회 추가</h3>
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
        <h3 className="font-semibold leading-snug">엑셀로 넣기</h3>
        <p className="leading-relaxed text-[#4b5563]">첫 줄 칸 이름은 교회이름, 담임목사, 주소, 전화번호, 주일 예배시간, 메모 순서입니다.</p>
        <ChurchFileField />
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
    </section>
  );
}
