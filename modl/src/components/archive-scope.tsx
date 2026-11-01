import { choiceButtonClass, choiceRowClass } from "@/components/choice-buttons";

type NamedPlace = { id: string; name: string };

/** 속한 교회와 모들 전부입니다. 켠 곳에만 자료가 올라갑니다. */
export function ArchiveScope({
  churches,
  gatherings,
}: {
  churches: readonly NamedPlace[];
  gatherings: readonly NamedPlace[];
}) {
  return (
    <fieldset data-testid="archive-places" className="grid gap-2">
      <legend className="font-semibold">어디에 올릴까요</legend>
      {churches.length === 0 && gatherings.length === 0 ? (
        <p className="leading-relaxed text-[#5c5148]">속한 교회와 모들이 없습니다.</p>
      ) : (
        <div data-testid="archive-place-list" className={choiceRowClass}>
          {churches.map((church) => (
            <label
              key={church.id}
              className={`${choiceButtonClass} cursor-pointer border-[#1d4ed8] bg-transparent text-[#1d4ed8] has-[:checked]:border-[#1d4ed8] has-[:checked]:bg-[#1d4ed8] has-[:checked]:text-white`}
            >
              <input type="checkbox" name="churchIds" value={church.id} className="sr-only" data-testid="archive-church-check" />
              {church.name}
            </label>
          ))}
          {gatherings.map((gathering) => (
            <label
              key={gathering.id}
              className={`${choiceButtonClass} cursor-pointer border-[#6d28d9] bg-transparent text-[#6d28d9] has-[:checked]:border-[#6d28d9] has-[:checked]:bg-[#6d28d9] has-[:checked]:text-white`}
            >
              <input type="checkbox" name="gatheringIds" value={gathering.id} className="sr-only" data-testid="archive-gathering-check" />
              {gathering.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
