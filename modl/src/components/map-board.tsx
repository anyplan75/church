"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { BusGuide } from "@/map/jeju-bus";
import type { ChurchPin } from "@/map/church-sheet";
import { PLACE_KIND_LABEL, type MapPoint, type PlaceHit, type RouteResult } from "@/map/rules";
import { busGuideAction, searchPlacesAction, travelAction } from "@/server/map/actions";
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

  function choose(next: Selected) {
    setSelected(next);
    setGuiding(false);
    setRoute(null);
    setBus(null);
    setError("");
    setNote("");
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
    setError("");
    if (!start) locate(false);
  }

  useEffect(() => {
    if (!guiding || !target) return;
    let alive = true;
    if (travel === "bus") {
      setPending("bus");
      setRoute(null);
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
        route={route}
        mapboxToken={mapboxToken}
        onSelect={choose}
        onClear={() => {
          setSelected(null);
          setGuiding(false);
          setRoute(null);
          setBus(null);
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-3">
        <div className="pointer-events-auto grid w-full max-w-xl gap-2">
          <form onSubmit={onSearch} className="flex gap-2 rounded-2xl bg-white p-2 shadow-md">
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
            <ul className="grid max-h-52 list-none gap-1 overflow-y-auto rounded-2xl bg-white p-2 shadow-md">
              {places.map((item) => (
                <li key={item.id}>
                  <button type="button" className="grid w-full gap-1 rounded-xl px-3 py-2 text-left hover:bg-[#f8fafc]" onClick={() => choose({ type: "place", id: item.id })}>
                    <span className="font-semibold">
                      {PLACE_KIND_LABEL[item.kind]} · {item.name}
                    </span>
                    <span className="break-words text-sm text-[#4b5563]">{item.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {churches.length === 0 ? (
            <p className="rounded-2xl bg-white/95 px-4 py-2 text-sm leading-relaxed shadow-md">
              {hasChurches ? "주소가 있는 교회가 없습니다." : "등록된 교회가 없습니다."}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed shadow-md">
              {error}
            </p>
          ) : null}
          {note ? (
            <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed shadow-md">
              {note}
            </p>
          ) : null}
        </div>
      </div>
      {self ? (
        <div className="absolute bottom-3 right-3 z-10">
          <button type="button" className="rounded-xl bg-white px-4 py-3 font-semibold shadow-md" onClick={() => setAddressOpen((open) => !open)}>
            데리러 가기
          </button>
        </div>
      ) : null}
      {addressOpen && self ? (
        <form onSubmit={onSaveAddress} className="absolute bottom-20 right-3 z-10 grid w-[min(22rem,calc(100%-1.5rem))] gap-3 rounded-2xl bg-white p-4 shadow-md">
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
      {target && (church || place || pickup) ? (
        <article className="absolute inset-x-0 bottom-0 z-20 max-h-[48%] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg">
          <div className="mx-auto grid max-w-xl gap-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold leading-snug">{targetName}</h2>
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-[#4b5563]"
                onClick={() => {
                  setSelected(null);
                  setGuiding(false);
                  setRoute(null);
                  setBus(null);
                }}
              >
                닫기
              </button>
            </div>
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
            {guiding ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="길안내">
                  <ModeButton current={travel} mode="car" label="자동차" onPick={setTravel} />
                  <ModeButton current={travel} mode="walk" label="도보" onPick={setTravel} />
                  <ModeButton current={travel} mode="bus" label="버스" onPick={setTravel} />
                </div>
                {travel !== "bus" && !start ? (
                  <button type="button" className="w-fit rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold" onClick={() => locate(false)} disabled={pending === "gps"}>
                    내 위치
                  </button>
                ) : null}
                {travel !== "bus" && route ? <p className="leading-relaxed">{routeSummary(route) || "길을 찾았습니다."}</p> : null}
                {travel !== "bus" && pending === "route" ? <p className="leading-relaxed">길을 찾고 있습니다.</p> : null}
                {travel === "bus" && pending === "bus" ? <p className="leading-relaxed">제주 버스 정보를 찾고 있습니다.</p> : null}
                {travel === "bus" && bus?.kind === "outside" ? <p className="leading-relaxed">제주 버스 정보입니다.</p> : null}
                {travel === "bus" && bus?.kind === "empty" ? <p className="leading-relaxed">이 장소 근처 정류장 응답이 없습니다.</p> : null}
                {travel === "bus" && bus?.kind === "stops" ? (
                  <ul className="grid list-none gap-3">
                    {bus.stops.map((stop) => (
                      <li key={stop.id} className="grid gap-1 leading-relaxed">
                        <p className="font-semibold">{stop.name}</p>
                        {stop.routes.length > 0 ? <p>노선 {stop.routes.join(", ")}</p> : null}
                        {stop.arrivals.map((arrival) => (
                          <p key={`${stop.id}-${arrival.label}-${arrival.minutes ?? ""}`}>도착 {arrivalLine(arrival)}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <button type="button" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white" onClick={openGuide}>
                길안내
              </button>
            )}
          </div>
        </article>
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

function MapCanvas({
  places,
  churches,
  pickups,
  selected,
  route,
  mapboxToken,
  onSelect,
  onClear,
}: {
  places: PlaceHit[];
  churches: ChurchPin[];
  pickups: PickupPin[];
  selected: Selected | null;
  route: RouteResult | null;
  mapboxToken: string;
  onSelect: (selected: Selected) => void;
  onClear: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);
  const selectRef = useRef(onSelect);
  const clearRef = useRef(onClear);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  selectRef.current = onSelect;
  clearRef.current = onClear;

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

      const line = route?.line ?? [];
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
  }, [ready, churches, pickups, places, selected, route]);

  useEffect(() => {
    if (!ready || !selected) return;
    const map = mapRef.current;
    const point =
      (selected.type === "church" ? churches.find((item) => item.id === selected.id)?.point : null) ??
      (selected.type === "place" ? places.find((item) => item.id === selected.id)?.point : null) ??
      (selected.type === "pickup" ? pickups.find((item) => item.id === selected.id)?.point : null);
    if (!map || !point) return;
    map.easeTo({ center: [point.lon, point.lat], zoom: Math.max(map.getZoom(), 14) });
  }, [ready, selected, churches, places, pickups]);

  useEffect(() => {
    if (!ready || !route || route.line.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    void import("mapbox-gl").then((mod) => {
      const bounds = new mod.default.LngLatBounds();
      for (const point of route.line) bounds.extend([point.lon, point.lat]);
      map.fitBounds(bounds, { padding: 48 });
    });
  }, [ready, route]);

  return (
    <div className="h-full">
      {mapError ? <p className="absolute left-3 top-24 z-10 rounded-2xl bg-white px-4 py-3 leading-relaxed shadow-md">{mapError}</p> : null}
      <div ref={host} className="modl-map" aria-label="지도" />
    </div>
  );
}
