import { ManagerAssign } from "@/components/manager-assign";
import {
  createGatheringAction,
  grantPlaceEditAction,
  revokePlaceEditAction,
  setCurrentChurchAction,
  setCurrentGatheringAction,
  subscribeChurchAction,
  subscribeGatheringAction,
  unsubscribeChurchAction,
  unsubscribeGatheringAction,
} from "@/server/place/actions";
import type { PlaceAccount as PlaceAccountData } from "@/server/place/service";

export function PlaceAccount({
  place,
  part,
  churchQuery,
  gatheringQuery,
}: {
  place: PlaceAccountData;
  part: "personal" | "church" | "gathering" | "site";
  churchQuery: string;
  gatheringQuery: string;
}) {
  const managedKind = part === "church" ? "church" : part === "gathering" ? "gathering" : null;
  const managedMembers = managedKind ? place.members.filter((member) => member.kind === managedKind) : [];
  const managedGrants = managedKind ? place.grants.filter((grant) => grant.kind === managedKind) : [];

  return (
    <div className="grid gap-6" data-testid="place-account">
      {part === "personal" ? (
      <>
      <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="text-lg font-semibold leading-snug">교회</h2>
        <p className="leading-relaxed text-[#5c5148]">여러 교회를 구독하고, 내가 갈 교회를 고릅니다.</p>
        <form action="/account" className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="places" />
          <input
            name="church"
            defaultValue={churchQuery}
            placeholder="교회 이름"
            className="min-w-0 flex-1 rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
          />
          <button type="submit" className="rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
            교회 찾기
          </button>
        </form>
        {place.foundChurches.length > 0 ? (
          <ul className="grid gap-2">
            {place.foundChurches.map((church) => (
              <li key={church.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{church.name}</span>
                {church.subscribed ? (
                  <span className="text-[#5c5148]">구독 중</span>
                ) : (
                  <form action={subscribeChurchAction}>
                    <input type="hidden" name="churchId" value={church.id} />
                    <button type="submit" className="rounded-xl bg-[#1d4ed8] px-3 py-2 font-semibold text-white">
                      구독
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="grid gap-2" data-testid="church-follows">
          {place.churches.map((church) => (
            <li key={church.id} className="grid gap-2 rounded-2xl bg-white px-3 py-3">
              <p className="font-semibold">
                {church.name}
                {church.current ? " · 내가 갈 교회" : ""}
                {church.steward ? " · 관리자" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {church.current ? null : (
                  <form action={setCurrentChurchAction}>
                    <input type="hidden" name="churchId" value={church.id} />
                    <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                      이 교회 예배드리기
                    </button>
                  </form>
                )}
                <form action={unsubscribeChurchAction}>
                  <input type="hidden" name="churchId" value={church.id} />
                  <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                    구독 빼기
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="text-lg font-semibold leading-snug">모들</h2>
        <p className="leading-relaxed text-[#5c5148]">모들을 따로 만들고, 여러 모들을 구독한 뒤 내가 갈 모들을 바꿉니다.</p>
        <form action={createGatheringAction} className="grid gap-2">
          <input name="name" required placeholder="모들 이름" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" />
          <input name="address" required placeholder="모들 주소" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" />
          <button type="submit" className="w-fit rounded-xl bg-[#7c3aed] px-3 py-2 font-semibold text-white">
            모들 만들기
          </button>
        </form>
        <form action="/account" className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="places" />
          <input
            name="gathering"
            defaultValue={gatheringQuery}
            placeholder="모들 이름"
            className="min-w-0 flex-1 rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
          />
          {churchQuery ? <input type="hidden" name="church" value={churchQuery} /> : null}
          <button type="submit" className="rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
            모들 찾기
          </button>
        </form>
        {place.foundGatherings.length > 0 ? (
          <ul className="grid gap-2">
            {place.foundGatherings.map((group) => (
              <li key={group.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{group.name}</span>
                {group.subscribed ? (
                  <span className="text-[#5c5148]">구독 중</span>
                ) : (
                  <form action={subscribeGatheringAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" className="rounded-xl bg-[#7c3aed] px-3 py-2 font-semibold text-white">
                      구독
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="grid gap-2" data-testid="gathering-follows">
          {place.gatherings.map((group) => (
            <li key={group.id} className="grid gap-2 rounded-2xl bg-white px-3 py-3">
              <p className="font-semibold">
                {group.name}
                {group.current ? " · 내가 갈 모들" : ""}
                {group.steward ? " · 관리자" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.current ? null : (
                  <form action={setCurrentGatheringAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                      이 모들로 가기
                    </button>
                  </form>
                )}
                <form action={unsubscribeGatheringAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                    구독 빼기
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
      </>
      ) : null}
      {managedMembers.length > 0 || managedGrants.length > 0 ? (
        <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
          <h2 className="text-lg font-semibold leading-snug">수정 권한</h2>
          <p className="leading-relaxed text-[#5c5148]">관리자가 속한 사람에게 재정과 일정을 고칠 권한을 줍니다. 권한이 없으면 보기만 합니다.</p>
          <ul className="grid gap-2">
            {managedMembers.map((member) => (
              <li key={`${member.kind}-${member.placeId}-${member.userId}`} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {member.placeName} · {member.name}
                </span>
                <form action={grantPlaceEditAction}>
                  <input type="hidden" name="kind" value={member.kind} />
                  <input type="hidden" name="placeId" value={member.placeId} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                    수정 권한 주기
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {managedGrants.length > 0 ? (
            <ul className="grid gap-2">
              {managedGrants.map((grant) => (
                <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {grant.name} · {grant.person} · 수정 가능
                  </span>
                  <form action={revokePlaceEditAction}>
                    <input type="hidden" name="grantId" value={grant.id} />
                    <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                      권한 빼기
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {part === "site" && place.isPastor ? (
        <ManagerAssign churches={place.managerChurches} gatherings={place.managerGatherings} />
      ) : null}
    </div>
  );
}
