type NamedPlace = { id: string; name: string };

/** 속한 교회와 모들 전부입니다. 체크한 곳에만 자료가 올라갑니다. */
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
        <ul data-testid="archive-place-list" className="flex list-none flex-col gap-2 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:gap-y-2">
          {churches.map((church) => (
            <li key={church.id}>
              <label className="flex items-center gap-2 leading-snug">
                <input type="checkbox" name="churchIds" value={church.id} data-testid="archive-church-check" />
                <span>{church.name}</span>
              </label>
            </li>
          ))}
          {gatherings.map((gathering) => (
            <li key={gathering.id}>
              <label className="flex items-center gap-2 leading-snug">
                <input type="checkbox" name="gatheringIds" value={gathering.id} data-testid="archive-gathering-check" />
                <span>{gathering.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
