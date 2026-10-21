"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { followWindowMeters } from "@/map/follow";
import type { BusGuide } from "@/map/jeju-bus";
import { metersBetween } from "@/map/jeju-bus";
import type { ChurchPin } from "@/map/church-sheet";
import { PLACE_KIND_LABEL, type MapPoint, type PlaceHit, type RouteResult, type RouteSegment } from "@/map/rules";
import { busGuideAction, busRouteLineAction, searchPlacesAction, travelAction } from "@/server/map/actions";
import { saveMyAddressAction, setPickupConsentAction } from "@/server/map/church-actions";

type Pending = "search" | "route" | "bus" | "gps" | "address" | "consent" | null;
type TravelMode = "car" | "walk" | "bus";
type PickupPin = { id: string; name: string; point: MapPoint };
type MapSelf = { address: string; consented: boolean };
type Selected = { type: "church" | "place" | "pickup"; id: string };

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
  mapboxToken,
}: {
  churches: ChurchPin[];
  pickups: PickupPin[];
  self: MapSelf | null;
  hasChurches: boolean;
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
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState(self?.address ?? "");
  const [consented, setConsented] = useState(self?.consented ?? false);

  const church = selected?.type === "church" ? churches.find((item) => item.id === selected.id) ?? null : null;
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

  function choose(next: Selected) {
    setSelected(next);
    setGuiding(false);
    setRoute(null);
    setBus(null);
    setBusRouteId(null);
    setBusLine([]);
    setFollowing(false);
    setError("");
    setNote("");
  }

  function pickTravel(mode: TravelMode) {
    setTravel(mode);
    setFollowing(false);
  }

  async function pickBus(routeId: string) {
    setBusRouteId(routeId);
    setFollowing(false);
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
    setFollowing(false);
    setError("");
    if (!start) locate(false);
  }

  useEffect(() => {
    if (!canFollow) setFollowing(false);
  }, [canFollow]);

  useEffect(() => {
    if (!guiding || !target) return;
    let alive = true;
      if (travel === "bus") {
      setPending("bus");
      setRoute(null);
      setBusLine([]);
      setBusRouteId(null);
      setFollowing(false);
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
    <section className="map-stage">
      <h1 className="page-title absolute left-3 top-3 z-20 rounded-xl bg-white px-3 py-2 text-[clamp(1.22rem,1rem+0.5vw,1.6rem)] leading-tight shadow-md">지도</h1>
      <MapCanvas
        places={places}
        churches={churches}
        pickups={pickups}
        selected={selected}
        line={drawnLine}
        followSegments={followSegments}
        following={following}
        mapboxToken={mapboxToken}
        onSelect={choose}
        onFollowEnd={() => setFollowing(false)}
        onClear={() => {
          setSelected(null);
          setGuiding(false);
          setRoute(null);
          setBus(null);
          setBusLine([]);
          setBusRouteId(null);
          setFollowing(false);
        }}
      />
      <div className="absolute right-2 top-2 z-20 w-[22rem] max-w-[calc(100%-1rem)]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-md">
          <form onSubmit={onSearch} className="flex gap-2 p-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">장소 검색</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl px-3 py-3 leading-snug outline-none"
                placeholder="식당이나 숙소"
              />
            </label>
            <button type="submit" disabled={pending === "search"} className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
              검색
            </button>
          </form>
          {places.length > 0 && !selected ? (
            <ul className="max-h-52 list-none overflow-y-auto border-t border-[#e5e7eb]">
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
            <article className="max-h-[min(32rem,70dvh)] overflow-y-auto border-t border-[#e5e7eb]">
              <div className="flex items-start justify-between gap-2 border-b border-[#e5e7eb] px-3 py-3">
                <h2 className="text-lg font-semibold leading-snug">{targetName}</h2>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-[#4b5563]"
                  onClick={() => {
                    setSelected(null);
                    setGuiding(false);
                    setRoute(null);
                    setBus(null);
                    setBusLine([]);
                    setBusRouteId(null);
                    setFollowing(false);
                  }}
                >
                  닫기
                </button>
              </div>
              <section className="grid gap-2 border-b border-[#e5e7eb] px-3 py-3">
                {church ? (
                  <dl className="grid gap-1 leading-relaxed">
                    <Detail label="교회이름" value={church.name} />
                    <Detail label="담임목사" value={church.pastorName} />
                    <Detail label="주소" value={church.address} />
                    <Detail label="전화번호" value={church.phone} />
                    <Detail label="주일 예배시간" value={church.serviceTime} />
                    <Detail label="메모" value={church.memo} />
                  </dl>
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
                  <button
                    type="button"
                    className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white disabled:bg-[#e5e7eb] disabled:text-[#6b7280]"
                    disabled={!canFollow}
                    aria-pressed={following}
                    onClick={() => setFollowing((value) => !value)}
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
        </div>
        {churches.length === 0 ? (
          <p className="mt-2 rounded-2xl bg-white/95 px-4 py-2 text-sm leading-relaxed shadow-md">
            {hasChurches ? "주소가 있는 교회가 없습니다." : "등록된 교회가 없습니다."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed shadow-md">
            {error}
          </p>
        ) : null}
        {note ? (
          <p role="status" className="mt-2 rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed shadow-md">
            {note}
          </p>
        ) : null}
      </div>
      {self ? (
        <div className="absolute bottom-2 left-2 z-10">
          <button type="button" className="rounded-xl bg-white px-4 py-3 font-semibold shadow-md" onClick={() => setAddressOpen((open) => !open)}>
            데리러 가기
          </button>
        </div>
      ) : null}
      {addressOpen && self ? (
        <form onSubmit={onSaveAddress} className="absolute bottom-16 left-2 z-10 grid w-[min(22rem,calc(100%-1rem))] gap-3 rounded-2xl bg-white p-4 shadow-md">
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

function followPath(segments: readonly RouteSegment[]): Array<{ lat: number; lon: number; distance: number; speedMps: number | null; segment: number }> {
  const samples: Array<{ lat: number; lon: number; distance: number; speedMps: number | null; segment: number }> = [];
  let distance = 0;
  segments.forEach((segment, segmentIndex) => {
    if (segment.line.length < 2) return;
    segment.line.forEach((point, index) => {
      if (index > 0) {
        const previous = segment.line[index - 1];
        if (previous) distance += metersBetween(previous, point);
      }
      const last = samples[samples.length - 1];
      if (last && last.lat === point.lat && last.lon === point.lon) return;
      samples.push({ lat: point.lat, lon: point.lon, distance, speedMps: segment.speedMps, segment: segmentIndex });
    });
  });
  return samples;
}

function placeAtDistance(
  samples: readonly { lat: number; lon: number; distance: number; speedMps: number | null; segment: number }[],
  target: number,
): { lat: number; lon: number; speedMps: number | null; segment: number } {
  let index = 1;
  while (index < samples.length - 1 && (samples[index]?.distance ?? 0) < target) index += 1;
  const previous = samples[index - 1] ?? samples[0];
  const next = samples[index] ?? previous;
  if (!previous || !next) return { lat: 0, lon: 0, speedMps: null, segment: 0 };
  const span = next.distance - previous.distance;
  const ratio = span > 0 ? Math.min(1, Math.max(0, (target - previous.distance) / span)) : 0;
  return {
    lat: previous.lat + (next.lat - previous.lat) * ratio,
    lon: previous.lon + (next.lon - previous.lon) * ratio,
    speedMps: next.speedMps,
    segment: next.segment,
  };
}

function MapCanvas({
  places,
  churches,
  pickups,
  selected,
  line,
  followSegments,
  following,
  mapboxToken,
  onSelect,
  onFollowEnd,
  onClear,
}: {
  places: PlaceHit[];
  churches: ChurchPin[];
  pickups: PickupPin[];
  selected: Selected | null;
  line: MapPoint[];
  followSegments: RouteSegment[];
  following: boolean;
  mapboxToken: string;
  onSelect: (selected: Selected) => void;
  onFollowEnd: () => void;
  onClear: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);
  const selectRef = useRef(onSelect);
  const clearRef = useRef(onClear);
  const followEndRef = useRef(onFollowEnd);
  const followingRef = useRef(following);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  selectRef.current = onSelect;
  clearRef.current = onClear;
  followEndRef.current = onFollowEnd;
  followingRef.current = following;

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
        center: [127.8, 36.4],
        zoom: 6,
      });
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
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => {
      alive = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
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
    if (!ready || followingRef.current || line.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    void import("mapbox-gl").then((mod) => {
      if (followingRef.current) return;
      const bounds = new mod.default.LngLatBounds();
      for (const point of line) bounds.extend([point.lon, point.lat]);
      map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: map.getContainer().clientWidth > 800 ? 360 : 24 } });
    });
  }, [ready, line]);

  useEffect(() => {
    if (!ready || !following) return;
    const map = mapRef.current;
    const samples = followPath(followSegments);
    const total = samples[samples.length - 1]?.distance ?? 0;
    if (!map || samples.length < 2 || total <= 0) {
      followEndRef.current();
      return;
    }
    let alive = true;
    let frame = 0;
    const started = performance.now();
    void import("mapbox-gl").then((mod) => {
      if (!alive) return;
      const mapboxgl = mod.default;
      const tick = (now: number) => {
        if (!alive || !mapRef.current) return;
        const t = Math.min(1, (now - started) / 18000);
        const place = placeAtDistance(samples, total * t);
        const slowLine = place.speedMps !== null && place.speedMps <= 3 ? followSegments[place.segment]?.line : undefined;
        const bounds = new mapboxgl.LngLatBounds();
        if (slowLine && slowLine.length >= 2) {
          for (const point of slowLine) bounds.extend([point.lon, point.lat]);
        } else {
          const meters = followWindowMeters(place.speedMps);
          const latDelta = meters / 111320;
          const cos = Math.cos((place.lat * Math.PI) / 180);
          const lonDelta = meters / (111320 * (Math.abs(cos) < 0.2 ? 0.2 : cos));
          bounds.extend([place.lon - lonDelta, place.lat - latDelta]);
          bounds.extend([place.lon + lonDelta, place.lat + latDelta]);
        }
        const width = map.getContainer().clientWidth;
        map.fitBounds(bounds, {
          padding: { top: 60, bottom: 60, left: 60, right: width > 800 ? 360 : 24 },
          animate: false,
          maxZoom: slowLine && slowLine.length >= 2 ? 17 : 16,
        });
        if (t >= 1) {
          followEndRef.current();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [ready, following, followSegments]);

  return (
    <div className="h-full">
      {mapError ? <p className="absolute left-3 top-24 z-10 rounded-2xl bg-white px-4 py-3 leading-relaxed shadow-md">{mapError}</p> : null}
      <div ref={host} className="modl-map" aria-label="지도" />
    </div>
  );
}
