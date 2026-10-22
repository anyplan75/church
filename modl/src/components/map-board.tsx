"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { followWindowMeters, distanceToLineMeters, HERE_RADIUS_METERS, JEJU_VIEW, lineLengthMeters, nearestSegmentIndex, OFF_ROUTE_METERS, radiusView } from "@/map/follow";
import type { BusGuide } from "@/map/jeju-bus";
import type { ChurchPin } from "@/map/church-sheet";
import { churchMatchesTags, normalizeChurchTags, type ChurchTag } from "@/map/church-tags";
import { ChurchTagFilters } from "@/components/church-tag-filters";
import { PLACE_KIND_LABEL, type MapPoint, type PlaceHit, type RouteResult, type RouteSegment } from "@/map/rules";
import { busGuideAction, busRouteLineAction, searchPlacesAction, travelAction } from "@/server/map/actions";
import { saveMapChurchAction, saveMyAddressAction, setPickupConsentAction } from "@/server/map/church-actions";

type Pending = "search" | "route" | "bus" | "gps" | "address" | "consent" | "church" | null;
type TravelMode = "car" | "walk" | "bus";
type PickupPin = { id: string; name: string; point: MapPoint };
type MapSelf = { address: string; consented: boolean };
type Selected = { type: "church" | "place" | "pickup"; id: string };
type ChurchDraft = {
  id: string;
  name: string;
  pastorName: string;
  address: string;
  phone: string;
  serviceTime: string;
  memo: string;
  tags: ChurchTag[];
};

const CHURCH_FIELD = "w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug";

function routeSummary(route: RouteResult): string {
  const parts: string[] = [];
  if (route.distanceMeters !== null) {
    parts.push(route.distanceMeters >= 1000 ? `${(route.distanceMeters / 1000).toFixed(1)}km` : `${Math.round(route.distanceMeters)}m`);
  }
  if (route.durationSeconds !== null) {
    parts.push(route.durationSeconds < 60 ? `${Math.round(route.durationSeconds)}초` : `${Math.round(route.durationSeconds / 60)}분`);
  }
  return parts.join(" · ");
}

function arrivalLine(arrival: { label: string; minutes: number | null; stopsLeft: number | null }): string {
  const parts = [arrival.label];
  if (arrival.minutes !== null) parts.push(`${arrival.minutes}분`);
  if (arrival.stopsLeft !== null) parts.push(`${arrival.stopsLeft}정류장 남음`);
  return parts.join(" · ");
}

export function MapBoard({
  churches,
  pickups,
  self,
  hasChurches,
  canEditChurches,
  mapboxToken,
}: {
  churches: ChurchPin[];
  pickups: PickupPin[];
  self: MapSelf | null;
  hasChurches: boolean;
  canEditChurches: boolean;
  mapboxToken: string;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [guiding, setGuiding] = useState(false);
  const [travel, setTravel] = useState<TravelMode>("car");
  const [start, setStart] = useState<MapPoint | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [bus, setBus] = useState<BusGuide | null>(null);
  const [busRouteId, setBusRouteId] = useState<string | null>(null);
  const [busLine, setBusLine] = useState<MapPoint[]>([]);
  const [following, setFollowing] = useState(false);
  const [here, setHere] = useState<MapPoint | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const watchRef = useRef<number | null>(null);
  const rerouteLock = useRef(false);
  const rerouteAt = useRef(0);
  const rerouteGen = useRef(0);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState(self?.address ?? "");
  const [consented, setConsented] = useState(self?.consented ?? false);
  const [selectedTags, setSelectedTags] = useState<ReadonlySet<string>>(new Set());
  const [phoneFiltersOpen, setPhoneFiltersOpen] = useState(false);
  const [phoneDraftTags, setPhoneDraftTags] = useState<ReadonlySet<string>>(new Set());
  const [churchRows, setChurchRows] = useState(churches);
  const [draft, setDraft] = useState<ChurchDraft | null>(null);
  useEffect(() => {
    setChurchRows(churches);
  }, [churches]);
  const visibleChurches = useMemo(
    () => churchRows.filter((item) => churchMatchesTags(item.tags, selectedTags)),
    [churchRows, selectedTags],
  );

  const church = selected?.type === "church" ? visibleChurches.find((item) => item.id === selected.id) ?? null : null;
  const place = selected?.type === "place" ? places.find((item) => item.id === selected.id) ?? null : null;
  const pickup = selected?.type === "pickup" ? pickups.find((item) => item.id === selected.id) ?? null : null;
  const target = church?.point ?? place?.point ?? pickup?.point ?? null;
  const targetName = church?.name ?? place?.name ?? pickup?.name ?? "";

  const followSegments = useMemo<RouteSegment[]>(() => {
    if (travel === "bus") return busLine.length >= 2 ? [{ line: busLine, speedMps: null }] : [];
    if (route?.segments.length) return route.segments;
    if (route && route.line.length >= 2) return [{ line: route.line, speedMps: null }];
    return [];
  }, [travel, route, busLine]);
  const drawnLine = travel === "bus" ? busLine : (route?.line ?? []);
  const canFollow = followSegments.some((segment) => segment.line.length >= 2);

  function openChurchEdit(item: ChurchPin) {
    setDraft({
      id: item.id,
      name: item.name,
      pastorName: item.pastorName,
      address: item.address,
      phone: item.phone,
      serviceTime: item.serviceTime,
      memo: item.memo,
      tags: normalizeChurchTags(item.tags),
    });
    setError("");
  }

  async function onSaveChurch(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setPending("church");
    setError("");
    const result = await saveMapChurchAction({ ...draft, churchId: draft.id });
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const saved = result.church;
    setChurchRows((current) => {
      const rest = current.filter((item) => item.id !== saved.id);
      if (!saved.point) return rest;
      return [...rest, { ...saved, point: saved.point }];
    });
    setDraft(null);
    if (!saved.point) {
      setSelected(null);
      setNote("교회는 저장했지만, 주소를 지도에서 찾지 못해 핀은 없습니다.");
      return;
    }
    setSelected({ type: "church", id: saved.id });
    setNote("교회를 저장했습니다.");
  }

  function openPhoneFilters() {
    setPhoneDraftTags(new Set(selectedTags));
    setPhoneFiltersOpen(true);
  }

  function finishPhoneFilters() {
    setSelectedTags(new Set(phoneDraftTags));
    setPhoneFiltersOpen(false);
  }

  function togglePhoneDraft(tag: ChurchTag) {
    setPhoneDraftTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function choose(next: Selected) {
    setDraft(null);
    setPhoneFiltersOpen(false);
    setSelected(next);
    setGuiding(false);
    setRoute(null);
    setBus(null);
    setBusRouteId(null);
    setBusLine([]);
    stopNavigation();
    setError("");
    setNote("");
  }

  function pickTravel(mode: TravelMode) {
    setTravel(mode);
    stopNavigation();
  }

  async function pickBus(routeId: string) {
    setBusRouteId(routeId);
    stopNavigation();
    setError("");
    const result = await busRouteLineAction(routeId);
    if (!result.ok) {
      setBusLine([]);
      setError(result.message);
      return;
    }
    setBusLine(result.data);
    if (result.data.length < 2) setNote("이 노선은 잇을 정류장 좌표가 없습니다.");
  }

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setPending("search");
    setError("");
    setNote("");
    const result = await searchPlacesAction(query);
    setPending(null);
    if (!result.ok) {
      setPlaces([]);
      setError(result.message);
      return;
    }
    setPlaces(result.data);
    if (result.data.length === 0) setNote("식당이나 숙소로 찾은 결과가 없습니다.");
  }

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHere({ lat: position.coords.latitude, lon: position.coords.longitude });
        const reading = position.coords.speed;
        if (typeof reading === "number" && Number.isFinite(reading) && reading >= 0) setSpeed(reading);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  function stopNavigation() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setFollowing(false);
    setRerouting(false);
    rerouteGen.current += 1;
  }

  function beginNavigation() {
    if (!canFollow) return;
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 위치를 받지 못합니다.");
      return;
    }
    setError("");
    let started = false;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        started = true;
        setFollowing(true);
        setHere({ lat: position.coords.latitude, lon: position.coords.longitude });
        const reading = position.coords.speed;
        setSpeed(typeof reading === "number" && Number.isFinite(reading) && reading >= 0 ? reading : null);
      },
      () => {
        if (started) return;
        stopNavigation();
        setError("위치를 받지 못했습니다.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
    );
  }

  function locate(thenGuide: boolean) {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 위치를 받지 못합니다.");
      return;
    }
    setPending("gps");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStart({ lat: position.coords.latitude, lon: position.coords.longitude });
        setPending(null);
        setNote("내 위치를 시작으로 두었습니다.");
        if (thenGuide) setGuiding(true);
      },
      () => {
        setPending(null);
        setError("위치를 받지 못했습니다.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function openGuide() {
    setGuiding(true);
    setTravel("car");
    setRoute(null);
    setBus(null);
    setBusRouteId(null);
    setBusLine([]);
    stopNavigation();
    setError("");
    if (!start) locate(false);
  }

  useEffect(() => {
    if (!canFollow) stopNavigation();
  }, [canFollow]);

  useEffect(() => {
    if (!following || !here || !target || rerouteLock.current) return;
    const away = distanceToLineMeters(here, drawnLine);
    if (away === null || away <= OFF_ROUTE_METERS) return;
    if (Date.now() - rerouteAt.current < 15000) return;
    rerouteLock.current = true;
    rerouteAt.current = Date.now();
    setRerouting(true);
    setError("");
    const mode = travel;
    const from = here;
    const to = target;
    const previousRouteId = busRouteId;
    const generation = rerouteGen.current;
    const still = () => rerouteGen.current === generation;
    const finish = () => {
      rerouteLock.current = false;
      if (still()) setRerouting(false);
    };
    if (mode === "bus") {
      void busGuideAction(from).then(async (result) => {
        if (!still()) {
          finish();
          return;
        }
        if (!result.ok) {
          setError(result.message);
          finish();
          return;
        }
        setBus(result.data);
        if (result.data.kind !== "stops") {
          setBusLine([]);
          setBusRouteId(null);
          finish();
          return;
        }
        const ids = result.data.stops.flatMap((stop) => stop.routes.map((item) => item.id)).filter((id) => id.length > 0);
        const nextId = previousRouteId && ids.includes(previousRouteId) ? previousRouteId : (ids[0] ?? null);
        if (!nextId) {
          setBusLine([]);
          setBusRouteId(null);
          finish();
          return;
        }
        const lineResult = await busRouteLineAction(nextId);
        if (!still()) {
          finish();
          return;
        }
        if (!lineResult.ok) {
          setError(lineResult.message);
          finish();
          return;
        }
        setBusRouteId(nextId);
        setBusLine(lineResult.data.length >= 2 ? lineResult.data : []);
        finish();
      });
      return;
    }
    void travelAction(from, to, mode).then((result) => {
      if (!still()) {
        finish();
        return;
      }
      if (!result.ok) {
        setError(result.message);
        finish();
        return;
      }
      if (result.data.line.length >= 2) setRoute(result.data);
      else setRoute(null);
      finish();
    });
  }, [following, here, drawnLine, travel, target, busRouteId]);

  useEffect(() => {
    if (!guiding || !target) return;
    let alive = true;
    stopNavigation();
    if (travel === "bus") {
      setPending("bus");
      setRoute(null);
      setBusLine([]);
      setBusRouteId(null);
      void busGuideAction(target).then((result) => {
        if (!alive) return;
        setPending(null);
        if (!result.ok) {
          setBus(null);
          setError(result.message);
          return;
        }
        setBus(result.data);
      });
      return () => {
        alive = false;
      };
    }
    if (!start) return;
    setPending("route");
    setBus(null);
    void travelAction(start, target, travel).then((result) => {
      if (!alive) return;
      setPending(null);
      if (!result.ok) {
        setRoute(null);
        setError(result.message);
        return;
      }
      setRoute(result.data);
      setError("");
    });
    return () => {
      alive = false;
    };
  }, [guiding, travel, start, target]);

  async function onSaveAddress(event: FormEvent) {
    event.preventDefault();
    setPending("address");
    setError("");
    const result = await saveMyAddressAction(address);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (!address.trim()) setConsented(false);
    setNote(address.trim() ? "주소를 저장했습니다." : "주소를 지웠습니다.");
  }

  async function onConsent(next: boolean) {
    setPending("consent");
    setError("");
    const result = await setPickupConsentAction(next);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setConsented(next);
    setNote(next ? "데리러 가기 주소를 지도에 올렸습니다." : "데리러 가기 핀을 지웠습니다.");
  }

  return (
    <section className="map-stage flex flex-col">
      <div className="relative min-h-0 flex-1">
      <h1 className="page-title absolute left-3 top-3 z-20 rounded-xl bg-white px-3 py-2 text-[clamp(1.22rem,1rem+0.5vw,1.6rem)] leading-tight shadow-md">지도</h1>
      <MapCanvas
        places={places}
        churches={visibleChurches}
        pickups={pickups}
        selected={selected}
        line={drawnLine}
        followSegments={followSegments}
        following={following}
        here={here}
        speed={speed}
        mapboxToken={mapboxToken}
        onSelect={choose}
        onClear={() => {
          setDraft(null);
          setPhoneFiltersOpen(false);
          setSelected(null);
          setGuiding(false);
          setRoute(null);
          setBus(null);
          setBusLine([]);
          setBusRouteId(null);
          stopNavigation();
        }}
      />
      <div data-testid="map-dock" className="absolute inset-x-2 bottom-2 z-20 hidden max-h-[calc(100%-5.5rem)] flex-col md:flex">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-md">
          {church ? null : (
          <>
          <form onSubmit={onSearch} className="flex shrink-0 gap-2 border-b border-[#e5e7eb] p-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">장소 검색</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl border border-[#e5e7eb] px-3 py-3 leading-snug outline-none"
                placeholder="장소나 주소"
              />
            </label>
            <button type="submit" disabled={pending === "search"} className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
              검색
            </button>
          </form>
          <div className="shrink-0 px-3 py-3">
            <ChurchTagFilters
              layout="board"
              selected={selectedTags}
              onToggle={(tag) => {
                setSelectedTags((current) => {
                  const next = new Set(current);
                  if (next.has(tag)) next.delete(tag);
                  else next.add(tag);
                  return next;
                });
              }}
            />
            <p className="mt-3 text-sm leading-relaxed" data-testid="church-edit-request">
              교회정보수정요청{" "}
              <a className="underline" href="mailto:anyplan@me.com">
                anyplan@me.com
              </a>
            </p>
          </div>
          </>
          )}
          {church || places.length > 0 || (!church && target) || visibleChurches.length === 0 || error || note ? (
            <div className={`min-h-0 overflow-y-auto ${church ? "" : "border-t border-[#e5e7eb]"}`}>
          {places.length > 0 && !selected ? (
            <ul className="list-none">
              {places.map((item) => (
                <li key={item.id} className="border-b border-[#f3f4f6] last:border-b-0">
                  <button type="button" className="grid w-full gap-1 px-3 py-2 text-left hover:bg-[#f8fafc]" onClick={() => choose({ type: "place", id: item.id })}>
                    <span className="font-semibold">
                      {PLACE_KIND_LABEL[item.kind]} · {item.name}
                    </span>
                    <span className="break-words text-sm text-[#4b5563]">{item.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {target && (church || place || pickup) ? (
            <article data-testid={church ? "church-info" : undefined} className={church ? "" : "border-t border-[#e5e7eb]"}>
              <div className="flex items-start justify-between gap-2 border-b border-[#e5e7eb] px-3 py-3">
                <h2 className="text-lg font-semibold leading-snug">{targetName}</h2>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-[#4b5563]"
                  onClick={() => {
                    setDraft(null);
                    setPhoneFiltersOpen(false);
                    setSelected(null);
                    setGuiding(false);
                    setRoute(null);
                    setBus(null);
                    setBusLine([]);
                    setBusRouteId(null);
                    stopNavigation();
                  }}
                >
                  닫기
                </button>
              </div>
              <section className="grid gap-2 border-b border-[#e5e7eb] px-3 py-3">
                {church ? (
                  <>
                    <dl className="grid gap-1 leading-relaxed">
                      <Detail label="교회이름" value={church.name} />
                      <Detail label="담임목사" value={church.pastorName} />
                      <Detail label="주소" value={church.address} />
                      <Detail label="지역" value={church.region ?? ""} />
                      <Detail label="전화번호" value={church.phone} />
                      <Detail label="주일 예배시간" value={church.serviceTime} />
                      <Detail label="메모" value={church.memo} />
                      {church.tags.length > 0 ? <Detail label="태그" value={church.tags.join(" · ")} /> : null}
                    </dl>
                    {canEditChurches ? (
                      <button
                        type="button"
                        data-testid="map-church-edit"
                        className="w-fit rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold"
                        onClick={() => openChurchEdit(church)}
                      >
                        수정
                      </button>
                    ) : null}
                  </>
                ) : null}
                {place ? (
                  <dl className="grid gap-1 leading-relaxed">
                    <Detail label="이름" value={place.name} />
                    <Detail label="주소" value={place.address} />
                  </dl>
                ) : null}
                {pickup ? <p className="leading-relaxed">데리러 가기 핀</p> : null}
              </section>
              {guiding ? (
                <section className="grid gap-3 border-b border-[#e5e7eb] px-3 py-3">
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="길안내">
                    <ModeButton current={travel} mode="car" label="자동차" onPick={pickTravel} />
                    <ModeButton current={travel} mode="walk" label="도보" onPick={pickTravel} />
                    <ModeButton current={travel} mode="bus" label="버스" onPick={pickTravel} />
                  </div>
                  {travel !== "bus" && !start ? (
                    <button type="button" className="w-fit rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold" onClick={() => locate(false)} disabled={pending === "gps"}>
                      내 위치
                    </button>
                  ) : null}
                  {travel !== "bus" && route ? <p className="leading-relaxed">{routeSummary(route) || "길을 찾았습니다."}</p> : null}
                  {travel !== "bus" && pending === "route" ? <p className="leading-relaxed">길을 찾고 있습니다.</p> : null}
                  {rerouting ? <p className="leading-relaxed">재탐색</p> : null}
                  <button
                    type="button"
                    className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white disabled:bg-[#e5e7eb] disabled:text-[#6b7280]"
                    disabled={!canFollow}
                    aria-pressed={following}
                    onClick={() => (following ? stopNavigation() : beginNavigation())}
                  >
                    {following ? "따라가는 중" : "따라가기"}
                  </button>
                </section>
              ) : (
                <div className="border-b border-[#e5e7eb] px-3 py-3">
                  <button type="button" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white" onClick={openGuide}>
                    길안내
                  </button>
                </div>
              )}
              {guiding && travel === "bus" ? (
                <section className="grid gap-3 px-3 py-3">
                  {pending === "bus" ? <p className="leading-relaxed">제주 버스 정보를 찾고 있습니다.</p> : null}
                  {bus?.kind === "outside" ? <p className="leading-relaxed">제주 버스 정보입니다.</p> : null}
                  {bus?.kind === "empty" ? <p className="leading-relaxed">이 장소 근처 정류장 응답이 없습니다.</p> : null}
                  {bus?.kind === "stops" ? (
                    <ul className="grid list-none gap-3">
                      {bus.stops.map((stop) => (
                        <li key={stop.id} className="grid gap-2 border-t border-[#e5e7eb] pt-3 first:border-t-0 first:pt-0">
                          <p className="font-semibold">{stop.name}</p>
                          {stop.routes.length > 0 ? (
                            <ul className="grid list-none gap-2">
                              {stop.routes.map((item) => (
                                <li key={item.id} className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    aria-pressed={busRouteId === item.id}
                                    className={`rounded-full px-3 py-1 text-sm font-semibold ${item.background ? "" : "border border-[#e5e7eb] bg-white"}`}
                                    style={item.background ? { background: item.background, color: item.text ?? "#ffffff" } : undefined}
                                    onClick={() => void pickBus(item.id)}
                                  >
                                    {item.number}
                                  </button>
                                  {item.detail ? <span className="text-sm leading-relaxed text-[#4b5563]">{item.detail}</span> : null}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {stop.arrivals.map((arrival) => (
                            <p key={`${stop.id}-${arrival.routeId}-${arrival.minutes ?? ""}`} className="leading-relaxed">
                              도착 {arrivalLine(arrival)}
                            </p>
                          ))}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
            </article>
          ) : null}
          {visibleChurches.length === 0 ? (
            <p className="px-4 py-2 text-sm leading-relaxed">
              {churchRows.length === 0 ? (hasChurches ? "주소가 있는 교회가 없습니다." : "등록된 교회가 없습니다.") : "조건에 맞는 교회 핀이 없습니다."}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="bg-[#fde8e2] px-4 py-3 leading-relaxed">
              {error}
            </p>
          ) : null}
          {note ? (
            <p role="status" className="bg-[#ecfdf3] px-4 py-3 leading-relaxed">
              {note}
            </p>
          ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {draft ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-3 md:items-center">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-church-edit-title"
            data-testid="map-church-edit-dialog"
            onSubmit={onSaveChurch}
            className="grid max-h-[min(42rem,calc(100%-1rem))] w-full max-w-lg gap-3 overflow-y-auto rounded-2xl bg-white p-4 shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="map-church-edit-title" className="text-lg font-semibold leading-snug">
                교회 정보 수정
              </h2>
              <button type="button" className="rounded-xl px-3 py-2 text-[#4b5563]" onClick={() => setDraft(null)}>
                닫기
              </button>
            </div>
            <label className="grid gap-1">
              <span className="font-semibold">교회이름</span>
              <input
                name="name"
                required
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={CHURCH_FIELD}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">담임목사</span>
              <input
                name="pastorName"
                value={draft.pastorName}
                onChange={(event) => setDraft({ ...draft, pastorName: event.target.value })}
                className={CHURCH_FIELD}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">주소</span>
              <input
                name="address"
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                className={CHURCH_FIELD}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">전화번호</span>
              <input
                name="phone"
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                className={CHURCH_FIELD}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">주일 예배시간</span>
              <input
                name="serviceTime"
                value={draft.serviceTime}
                onChange={(event) => setDraft({ ...draft, serviceTime: event.target.value })}
                className={CHURCH_FIELD}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">메모</span>
              <input
                name="memo"
                value={draft.memo}
                onChange={(event) => setDraft({ ...draft, memo: event.target.value })}
                className={CHURCH_FIELD}
              />
            </label>
            <ChurchTagFilters
              testId="map-church-edit-tags"
              selected={new Set(draft.tags)}
              onToggle={(tag) =>
                setDraft((current) =>
                  current
                    ? { ...current, tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag] }
                    : current,
                )
              }
            />
            {error ? (
              <p role="alert" className="rounded-xl bg-[#fde8e2] px-3 py-2 leading-relaxed">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={pending === "church"} className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
              저장
            </button>
          </form>
        </div>
      ) : null}
      {self ? (
        <div className="absolute right-3 top-3 z-10">
          <button type="button" className="rounded-xl bg-white px-4 py-3 font-semibold shadow-md" onClick={() => setAddressOpen((open) => !open)}>
            데리러 가기
          </button>
        </div>
      ) : null}
      {addressOpen && self ? (
        <form onSubmit={onSaveAddress} className="absolute right-3 top-16 z-10 grid w-[min(22rem,calc(100%-1.5rem))] gap-3 rounded-2xl bg-white p-4 shadow-md">
          <h2 className="font-semibold leading-snug">데리러 가기 주소 제공</h2>
          <p className="leading-relaxed">이 주소를 데리러 가는 사역자에게 지도로 보여 줍니다.</p>
          <label className="grid gap-1">
            <span className="font-semibold">내 주소</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 leading-snug" />
          </label>
          <button type="submit" disabled={pending === "address"} className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
            주소 저장
          </button>
          <label className="flex items-start gap-2 leading-relaxed">
            <input type="checkbox" checked={consented} disabled={pending === "consent"} onChange={(event) => void onConsent(event.target.checked)} />
            <span>데리러 가기 주소 제공</span>
          </label>
        </form>
      ) : null}
      </div>
      <div data-testid="map-phone-bar" className="z-20 shrink-0 border-t border-[#e5e7eb] bg-white md:hidden">
        {church || place || pickup ? (
          <div className="max-h-[min(22rem,52dvh)] overflow-y-auto">
            <article data-testid={church ? "map-phone-church" : undefined}>
              <div className="flex items-start justify-between gap-2 border-b border-[#e5e7eb] px-3 py-2">
                <h2 className="text-base font-semibold leading-snug">{targetName}</h2>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm text-[#4b5563]"
                  onClick={() => {
                    setDraft(null);
                    setPhoneFiltersOpen(false);
                    setSelected(null);
                    setGuiding(false);
                    setRoute(null);
                    setBus(null);
                    setBusLine([]);
                    setBusRouteId(null);
                    stopNavigation();
                  }}
                >
                  닫기
                </button>
              </div>
              <section className="grid gap-2 px-3 py-2">
                {church ? (
                  <>
                    <dl className="grid gap-1 text-sm leading-relaxed">
                      <Detail label="교회이름" value={church.name} />
                      <Detail label="담임목사" value={church.pastorName} />
                      <Detail label="주소" value={church.address} />
                      <Detail label="지역" value={church.region ?? ""} />
                      <Detail label="전화번호" value={church.phone} />
                      <Detail label="주일 예배시간" value={church.serviceTime} />
                      <Detail label="메모" value={church.memo} />
                      {church.tags.length > 0 ? <Detail label="태그" value={church.tags.join(" · ")} /> : null}
                    </dl>
                    {canEditChurches ? (
                      <button
                        type="button"
                        data-testid="map-phone-church-edit"
                        className="w-fit rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold"
                        onClick={() => openChurchEdit(church)}
                      >
                        수정
                      </button>
                    ) : null}
                  </>
                ) : null}
                {place ? (
                  <dl className="grid gap-1 text-sm leading-relaxed">
                    <Detail label="이름" value={place.name} />
                    <Detail label="주소" value={place.address} />
                  </dl>
                ) : null}
                {pickup ? <p className="text-sm leading-relaxed">데리러 가기 핀</p> : null}
                {guiding ? (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="길안내">
                      <ModeButton current={travel} mode="car" label="자동차" onPick={pickTravel} />
                      <ModeButton current={travel} mode="walk" label="도보" onPick={pickTravel} />
                      <ModeButton current={travel} mode="bus" label="버스" onPick={pickTravel} />
                    </div>
                    {travel !== "bus" && route ? <p className="text-sm leading-relaxed">{routeSummary(route) || "길을 찾았습니다."}</p> : null}
                    {rerouting ? <p className="text-sm leading-relaxed">재탐색</p> : null}
                  </div>
                ) : (
                  <button type="button" className="w-fit rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white" onClick={openGuide}>
                    길안내
                  </button>
                )}
              </section>
            </article>
          </div>
        ) : phoneFiltersOpen ? (
          <div className="grid max-h-[min(28rem,62dvh)] grid-rows-[minmax(0,1fr)_auto]">
            <div className="overflow-y-auto px-3 py-3">
              <ChurchTagFilters layout="board" testId="map-phone-filters" selected={phoneDraftTags} onToggle={togglePhoneDraft} />
            </div>
            <div className="grid gap-2 border-t border-[#e5e7eb] px-3 py-2">
              <p className="text-sm leading-relaxed" data-testid="map-phone-edit-request">
                교회정보수정요청{" "}
                <a className="underline" href="mailto:anyplan@me.com">
                  anyplan@me.com
                </a>
              </p>
              <button
                type="button"
                data-testid="map-phone-filter-done"
                className="w-full rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white"
                onClick={finishPhoneFilters}
              >
                완료
              </button>
            </div>
          </div>
        ) : (
          <>
            {places.length > 0 ? (
              <ul className="max-h-36 list-none overflow-y-auto border-b border-[#e5e7eb]">
                {places.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="grid w-full gap-0.5 px-3 py-2 text-left" onClick={() => choose({ type: "place", id: item.id })}>
                      <span className="text-sm font-semibold">
                        {PLACE_KIND_LABEL[item.kind]} · {item.name}
                      </span>
                      <span className="break-words text-xs text-[#4b5563]">{item.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form onSubmit={onSearch} data-testid="map-phone-search" className="flex items-center gap-2 p-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">장소 검색</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm leading-snug outline-none"
                  placeholder="장소나 주소"
                />
              </label>
              <button
                type="button"
                data-testid="map-phone-filter"
                className="shrink-0 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold"
                onClick={openPhoneFilters}
              >
                필터
              </button>
            </form>
            {visibleChurches.length === 0 ? (
              <p className="px-3 pb-2 text-sm leading-relaxed">
                {churchRows.length === 0 ? (hasChurches ? "주소가 있는 교회가 없습니다." : "등록된 교회가 없습니다.") : "조건에 맞는 교회 핀이 없습니다."}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2">
      <dt className="font-semibold">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function ModeButton({
  current,
  mode,
  label,
  onPick,
}: {
  current: TravelMode;
  mode: TravelMode;
  label: string;
  onPick: (mode: TravelMode) => void;
}) {
  const active = current === mode;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`rounded-xl px-4 py-3 font-semibold ${active ? "bg-[#111827] text-white" : "border border-[#e5e7eb] bg-white"}`}
      onClick={() => onPick(mode)}
    >
      {label}
    </button>
  );
}

function MapCanvas({
  places,
  churches,
  pickups,
  selected,
  line,
  followSegments,
  following,
  here,
  speed,
  mapboxToken,
  onSelect,
  onClear,
}: {
  places: PlaceHit[];
  churches: ChurchPin[];
  pickups: PickupPin[];
  selected: Selected | null;
  line: MapPoint[];
  followSegments: RouteSegment[];
  following: boolean;
  here: MapPoint | null;
  speed: number | null;
  mapboxToken: string;
  onSelect: (selected: Selected) => void;
  onClear: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);
  const hereMarkerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const selectRef = useRef(onSelect);
  const clearRef = useRef(onClear);
  const followingRef = useRef(following);
  const lineCountRef = useRef(line.length);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  selectRef.current = onSelect;
  clearRef.current = onClear;
  followingRef.current = following;
  lineCountRef.current = line.length;

  useEffect(() => {
    if (!ready || !host.current) return;
    const node = host.current;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    let alive = true;
    let map: import("mapbox-gl").Map | null = null;
    void import("mapbox-gl").then((mod) => {
      if (!alive || !host.current || mapRef.current) return;
      const mapboxgl = mod.default;
      if (mapboxToken) mapboxgl.accessToken = mapboxToken;
      map = new mapboxgl.Map({
        container: host.current,
        style: {
          version: 8,
          sources: {
            modl: {
              type: "raster",
              tiles: ["/map/tiles/{z}/{x}/{y}"],
              tileSize: 256,
              attribution: "© Mapbox © OpenStreetMap",
            },
          },
          layers: [{ id: "modl", type: "raster", source: "modl" }],
        },
        center: [(JEJU_VIEW.west + JEJU_VIEW.east) / 2, (JEJU_VIEW.south + JEJU_VIEW.north) / 2],
        zoom: 9,
        attributionControl: false,
        logoPosition: "top-right",
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "top-right");
      map.on("click", (event) => {
        const target = event.originalEvent.target;
        if (target instanceof Element && target.closest(".mapboxgl-marker")) return;
        clearRef.current();
      });
      map.on("error", () => {
        if (alive) setMapError("지도 그림을 열지 못했습니다.");
      });
      map.on("load", () => {
        if (!alive || !map) return;
        const bounds = new mapboxgl.LngLatBounds([JEJU_VIEW.west, JEJU_VIEW.south], [JEJU_VIEW.east, JEJU_VIEW.north]);
        map.fitBounds(bounds, { padding: 48, duration: 0 });
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => {
      alive = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      hereMarkerRef.current?.remove();
      hereMarkerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    void import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;
      markersRef.current.forEach((marker) => marker.remove());
      const markers: import("mapbox-gl").Marker[] = [];
      const add = (marker: import("mapbox-gl").Marker, choice: Selected, label: string) => {
        marker.getElement().setAttribute("aria-label", label);
        marker.getElement().addEventListener("click", (event) => {
          event.stopPropagation();
          selectRef.current(choice);
        });
        markers.push(marker);
      };
      for (const church of churches) {
        const marker = new mapboxgl.Marker({ color: selected?.type === "church" && selected.id === church.id ? "#1e3a8a" : "#1d4ed8" })
          .setLngLat([church.point.lon, church.point.lat])
          .addTo(map);
        add(marker, { type: "church", id: church.id }, church.name);
      }
      for (const pin of pickups) {
        const marker = new mapboxgl.Marker({ color: "#b45309" }).setLngLat([pin.point.lon, pin.point.lat]).addTo(map);
        add(marker, { type: "pickup", id: pin.id }, pin.name);
      }
      for (const item of places) {
        const marker = new mapboxgl.Marker({ color: selected?.type === "place" && selected.id === item.id ? "#111827" : "#64748b" })
          .setLngLat([item.point.lon, item.point.lat])
          .addTo(map);
        add(marker, { type: "place", id: item.id }, item.name);
      }
      markersRef.current = markers;

      const data =
        line.length < 2
          ? { type: "FeatureCollection" as const, features: [] }
          : {
              type: "Feature" as const,
              properties: {},
              geometry: { type: "LineString" as const, coordinates: line.map((point) => [point.lon, point.lat]) },
            };
      const source = map.getSource("route-line");
      if (source && "setData" in source) {
        source.setData(data);
      } else if (line.length >= 2) {
        map.addSource("route-line", { type: "geojson", data });
        map.addLayer({ id: "route-line", type: "line", source: "route-line", paint: { "line-color": "#1d4ed8", "line-width": 5 } });
      }
    });
  }, [ready, churches, pickups, places, selected, line]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    if (!here) {
      hereMarkerRef.current?.remove();
      hereMarkerRef.current = null;
      return;
    }
    const point = here;
    void import("mapbox-gl").then((mod) => {
      if (!mapRef.current) return;
      if (hereMarkerRef.current) {
        hereMarkerRef.current.setLngLat([point.lon, point.lat]);
        return;
      }
      const spot = document.createElement("div");
      spot.setAttribute("aria-label", "내 위치");
      spot.style.width = "18px";
      spot.style.height = "18px";
      spot.style.borderRadius = "999px";
      spot.style.background = "#16a34a";
      spot.style.border = "3px solid #ffffff";
      spot.style.boxShadow = "0 0 0 2px #166534";
      hereMarkerRef.current = new mod.default.Marker({ element: spot }).setLngLat([point.lon, point.lat]).addTo(mapRef.current);
    });
  }, [ready, here]);

  useEffect(() => {
    if (!ready || !selected || followingRef.current) return;
    const map = mapRef.current;
    const point =
      (selected.type === "church" ? churches.find((item) => item.id === selected.id)?.point : null) ??
      (selected.type === "place" ? places.find((item) => item.id === selected.id)?.point : null) ??
      (selected.type === "pickup" ? pickups.find((item) => item.id === selected.id)?.point : null);
    if (!map || !point) return;
    map.easeTo({ center: [point.lon, point.lat], zoom: Math.max(map.getZoom(), 14) });
  }, [ready, selected, churches, places, pickups]);

  useEffect(() => {
    if (!ready || followingRef.current || line.length >= 2) return;
    const map = mapRef.current;
    if (!map) return;
    const view = here ? radiusView(here, HERE_RADIUS_METERS) : JEJU_VIEW;
    void import("mapbox-gl").then((mod) => {
      if (!mapRef.current || followingRef.current || lineCountRef.current >= 2) return;
      const next = new mod.default.LngLatBounds([view.west, view.south], [view.east, view.north]);
      mapRef.current.fitBounds(next, { padding: 48, duration: 0 });
    });
  }, [ready, here, line.length]);

  useEffect(() => {
    if (!ready || followingRef.current || line.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    void import("mapbox-gl").then((mod) => {
      if (!mapRef.current || followingRef.current) return;
      const bounds = new mod.default.LngLatBounds();
      for (const point of line) bounds.extend([point.lon, point.lat]);
      const width = mapRef.current.getContainer().clientWidth;
      mapRef.current.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: width > 800 ? 360 : 24 } });
    });
  }, [ready, line]);

  useEffect(() => {
    if (!ready || !following || !here) return;
    const map = mapRef.current;
    if (!map) return;
    const point = here;
    const reading = speed;
    void import("mapbox-gl").then((mod) => {
      if (!mapRef.current || !followingRef.current) return;
      const mapboxgl = mod.default;
      const width = mapRef.current.getContainer().clientWidth;
      const padding = { top: 72, bottom: 72, left: 48, right: width > 800 ? 380 : 24 };
      const index = nearestSegmentIndex(point, followSegments);
      const segment = index >= 0 ? followSegments[index]?.line : undefined;
      const slow = reading !== null && reading <= 3;
      const bounds = new mapboxgl.LngLatBounds();
      if (slow && segment && segment.length >= 2 && lineLengthMeters(segment) <= 800) {
        for (const spot of segment) bounds.extend([spot.lon, spot.lat]);
        bounds.extend([point.lon, point.lat]);
        mapRef.current.fitBounds(bounds, { padding, animate: false, maxZoom: 17 });
        return;
      }
      const meters = slow ? 160 : followWindowMeters(reading);
      const view = radiusView(point, meters);
      bounds.extend([view.west, view.south]);
      bounds.extend([view.east, view.north]);
      mapRef.current.fitBounds(bounds, { padding, animate: false, maxZoom: slow ? 17 : 16 });
    });
  }, [ready, following, here, speed, followSegments]);

  return (
    <div className="h-full">
      {mapError ? <p className="absolute left-3 top-24 z-10 rounded-2xl bg-white px-4 py-3 leading-relaxed shadow-md">{mapError}</p> : null}
      <div ref={host} className="modl-map" aria-label="지도" />
    </div>
  );
}
