import {
  assignStewardAction,
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
import { loadPlaceAccount } from "@/server/place/service";

export async function PlaceAccount({ churchQuery, gatheringQuery }: { churchQuery: string; gatheringQuery: string }) {
  const place = await loadPlaceAccount(churchQuery, gatheringQuery);
  if (!place) return null;

  return (
    <div className="grid gap-6" data-testid="place-account">
      <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="text-lg font-semibold leading-snug">교회</h2>
        <p className="leading-relaxed text-[#5c5148]">여러 교회를 구독하고, 지금 말씀을 들을 교회를 고릅니다.</p>
        <form action="/account" className="flex flex-wrap gap-2">
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
                {church.current ? " · 지금 말씀을 들을 교회" : ""}
                {church.steward ? " · 태우리" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {church.current ? null : (
                  <form action={setCurrentChurchAction}>
                    <input type="hidden" name="churchId" value={church.id} />
                    <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                      이 교회 말씀 듣기
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
        <p className="leading-relaxed text-[#5c5148]">모임을 따로 만들고, 여러 모임을 고른 뒤 지금 갈 모임을 바꿉니다.</p>
        <form action={createGatheringAction} className="grid gap-2">
          <input name="name" required placeholder="모임 이름" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" />
          <input name="address" required placeholder="모임 주소" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug" />
          <button type="submit" className="w-fit rounded-xl bg-[#7c3aed] px-3 py-2 font-semibold text-white">
            모임 만들기
          </button>
        </form>
        <form action="/account" className="flex flex-wrap gap-2">
          <input
            name="gathering"
            defaultValue={gatheringQuery}
            placeholder="모임 이름"
            className="min-w-0 flex-1 rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
          />
          {churchQuery ? <input type="hidden" name="church" value={churchQuery} /> : null}
          <button type="submit" className="rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
            모임 찾기
          </button>
        </form>
        {place.foundGatherings.length > 0 ? (
          <ul className="grid gap-2">
            {place.foundGatherings.map((group) => (
              <li key={group.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{group.name}</span>
                {group.subscribed ? (
                  <span className="text-[#5c5148]">가는 중</span>
                ) : (
                  <form action={subscribeGatheringAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" className="rounded-xl bg-[#7c3aed] px-3 py-2 font-semibold text-white">
                      이 모임 가기
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
                {group.current ? " · 지금 갈 모임" : ""}
                {group.steward ? " · 태우리" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.current ? null : (
                  <form action={setCurrentGatheringAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                      지금 이 모임 가기
                    </button>
                  </form>
                )}
                <form action={unsubscribeGatheringAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <button type="submit" className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
                    모임 빼기
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {place.members.length > 0 ? (
        <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
          <h2 className="text-lg font-semibold leading-snug">수정 권한</h2>
          <p className="leading-relaxed text-[#5c5148]">태우리가 속한 사람에게 재정과 일정을 고칠 권한을 줍니다. 권한이 없으면 보기만 합니다.</p>
          <ul className="grid gap-2">
            {place.members.map((member) => (
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
          {place.grants.length > 0 ? (
            <ul className="grid gap-2">
              {place.grants.map((grant) => (
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
      {place.isPastor ? (
        <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
          <h2 className="text-lg font-semibold leading-snug">태우리 지정</h2>
          <p className="leading-relaxed text-[#5c5148]">만든 사람이 없는 교회는 사역자가 태우리를 지정합니다. 등급은 고르지 않습니다.</p>
          <ul className="grid gap-2">
            {place.unassigned.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="grid gap-2 rounded-2xl bg-white px-3 py-3">
                <p className="font-semibold">{item.name}</p>
                <form action={assignStewardAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="kind" value={item.kind} />
                  <input type="hidden" name="placeId" value={item.id} />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="태우리 이메일"
                    className="min-w-0 flex-1 rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
                  />
                  <button type="submit" className="rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
                    태우리 지정
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
