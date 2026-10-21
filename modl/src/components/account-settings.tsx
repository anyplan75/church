import Link from "next/link";
import { SurveyAnonymousField } from "@/components/choice-fields";
import { SurveyDeskLive } from "@/components/survey-desk";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { saveMyAddressFormAction, setPickupConsentFormAction } from "@/server/map/church-actions";
import { loadMyPickup } from "@/server/map/board";
import { saveBannedWordsAction } from "@/server/moderation/actions";
import { createSurveyAction } from "@/server/survey/actions";
import type { SurveyDesk } from "@/server/survey/service";

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

/** 계정 탭 안에서 사람 일을 엽니다. */
export function PeopleWorkTab({ href, title, body, extraHref, extraLabel }: { href: string; title: string; body: string; extraHref?: string; extraLabel?: string }) {
  return (
    <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
      <h2 className="font-semibold leading-snug">{title}</h2>
      <p className="leading-relaxed text-[#5c5148]">{body}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={href} className="inline-flex w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          {title} 열기
        </Link>
        {extraHref && extraLabel ? (
          <Link href={extraHref} className="inline-flex w-fit rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold">
            {extraLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** 설문 만들기와 저장된 응답입니다. */
export function SurveyAccountSettings({ desk }: { desk: SurveyDesk }) {
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

/** 사역자가 쉼표로 금지어를 저장합니다. 이 저장은 내용 검사를 거치지 않습니다. */
export function BannedWordSettings({ words }: { words: string }) {
  return (
    <form action={saveBannedWordsAction} className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
      <h2 className="font-semibold leading-snug">금지어</h2>
      <p className="leading-relaxed text-[#4b5563]">쉼표로 구분해서 적고 저장합니다. 칸을 비우고 저장하면 목록도 비웁니다.</p>
      <label className="grid gap-1">
        <span className="font-semibold">금지어</span>
        <textarea name="words" defaultValue={words} rows={4} className={FIELD} />
      </label>
      <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
        저장
      </button>
    </form>
  );
}
