"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ChurchPin } from "@/map/church-sheet";
import { PLACE_KIND_LABEL, type MapPoint, type PlaceHit, type RouteResult, type SnapResult } from "@/map/rules";
import { routeBetweenAction, searchPlacesAction, snapToRoadAction } from "@/server/map/actions";
import { saveMyAddressAction, setPickupConsentAction } from "@/server/map/church-actions";

type ClickMode = "point" | "start" | "end";
type Pending = "search" | "snap" | "route" | "gps" | "address" | "consent" | null;
type PickupPin = { id: string; name: string; point: MapPoint };
type MapSelf = { address: string; consented: boolean };

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ClickMode>("point");
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [start, setStart] = useState<MapPoint | null>(null);
  const [end, setEnd] = useState<MapPoint | null>(null);
  const [snap, setSnap] = useState<SnapResult | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState(self?.address ?? "");
  const [consented, setConsented] = useState(self?.consented ?? false);

  function clickMap(point: MapPoint) {
    setError("");
    if (mode === "start") {
      setStart(point);
      setRoute(null);
      setNote("시작 지점을 찍었습니다.");
      return;
    }
    if (mode === "end") {
      setEnd(point);
      setRoute(null);
      setNote("끝 지점을 찍었습니다.");
      return;
    }
    setPoints((current) => [...current, point].slice(-20));
    setSnap(null);
    setNote("점을 찍었습니다.");
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
    setSelectedId(result.data[0]?.id ?? null);
    if (result.data.length === 0) setNote("식당이나 숙소로 찾은 결과가 없습니다.");
  }

  async function onSnap() {
    setPending("snap");
    setError("");
    setNote("");
    const result = await snapToRoadAction(points);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSnap(result.data);
    setNote(result.data.snapped.some((point) => point === null) ? "붙이지 못한 점이 있습니다." : "가까운 길에 붙였습니다.");
  }

  async function drawRoute(from: MapPoint, to: MapPoint) {
    setPending("route");
    setError("");
    setNote("");
    const result = await routeBetweenAction(from, to);
    setPending(null);
    if (!result.ok) {
      setRoute(null);
      setError(result.message);
      return;
    }
    setRoute(result.data);
    const summary = routeSummary(result.data);
    setNote(summary ? `길을 그렸습니다. ${summary}` : "길을 그렸습니다.");
  }

  async function onRoute() {
    if (!start || !end) {
      setError("시작과 끝을 먼저 찍어 주세요.");
      return;
    }
    await drawRoute(start, end);
  }

  function onLocate() {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 위치를 받지 못합니다. 지도를 눌러 점을 찍으세요.");
      return;
    }
    setPending("gps");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoints((current) => [...current, { lat: position.coords.latitude, lon: position.coords.longitude }].slice(-20));
        setSnap(null);
        setPending(null);
        setNote("현재 위치를 점으로 넣었습니다.");
      },
      () => {
        setPending(null);
        setError("위치를 받지 못했습니다. 지도를 눌러 점을 찍으세요.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function usePlace(place: PlaceHit, target: "start" | "end") {
    setSelectedId(place.id);
    setRoute(null);
    if (target === "start") setStart(place.point);
    else setEnd(place.point);
    setNote(target === "start" ? "검색 결과를 시작으로 두었습니다." : "검색 결과를 끝으로 두었습니다.");
  }

  async function guideTo(pin: PickupPin) {
    setEnd(pin.point);
    setSelectedId(pin.id);
    if (!start) {
      setRoute(null);
      setNote("이 핀을 끝으로 두었습니다. 시작을 찍고 길 그리기를 누르세요.");
      return;
    }
    await drawRoute(start, pin.point);
  }

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
    <section className="grid gap-4">
      <h1 className="page-title text-[clamp(1.22rem,1rem+0.5vw,1.6rem)] leading-tight">지도</h1>
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {note}
        </p>
      ) : null}
      {churches.length === 0 ? (
        <p className="leading-relaxed">{hasChurches ? "주소가 있는 교회가 없습니다." : "등록된 교회가 없습니다."}</p>
      ) : null}
      <form onSubmit={onSearch} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <label className="grid gap-1">
          <span className="font-semibold">주소</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 leading-snug"
            placeholder="식당이나 숙소 주소"
          />
        </label>
        <button type="submit" disabled={pending === "search"} className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          검색
        </button>
      </form>
      {places.length > 0 ? (
        <ul className="grid list-none gap-3">
          {places.map((place) => (
            <li key={place.id} className="grid gap-2 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm leading-relaxed">
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f3f4f6] px-3 py-1 font-semibold">{PLACE_KIND_LABEL[place.kind]}</span>
                <button type="button" className="text-left font-semibold" onClick={() => setSelectedId(place.id)}>
                  {place.name}
                </button>
              </span>
              <span className="break-words text-[#4b5563]">{place.address}</span>
              <span className="flex flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 font-semibold" onClick={() => usePlace(place, "start")}>
                  시작
                </button>
                <button type="button" className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 font-semibold" onClick={() => usePlace(place, "end")}>
                  끝
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {self ? (
        <form onSubmit={onSaveAddress} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <h2 className="font-semibold leading-snug">데리러 가기 주소 제공</h2>
          <p className="leading-relaxed">이 주소를 데리러 가는 사역자에게 지도로 보여 줍니다.</p>
          <label className="grid gap-1">
            <span className="font-semibold">내 주소</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 leading-snug"
            />
          </label>
          <button type="submit" disabled={pending === "address"} className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
            주소 저장
          </button>
          <label className="flex items-start gap-2 leading-relaxed">
            <input
              type="checkbox"
              checked={consented}
              disabled={pending === "consent"}
              onChange={(event) => void onConsent(event.target.checked)}
            />
            <span>데리러 가기 주소 제공</span>
          </label>
        </form>
      ) : null}
      {pickups.length > 0 ? (
        <ul className="grid list-none gap-3">
          {pickups.map((pin) => (
            <li key={pin.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <span className="font-semibold">{pin.name}</span>
              <button type="button" className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 font-semibold" onClick={() => void guideTo(pin)}>
                이 핀까지
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <ModeButton current={mode} mode="point" label="점 찍기" onPick={setMode} />
          <ModeButton current={mode} mode="start" label="시작 찍기" onPick={setMode} />
          <ModeButton current={mode} mode="end" label="끝 찍기" onPick={setMode} />
        </div>
        <MapCanvas
          places={places}
          selectedId={selectedId}
          points={points}
          snap={snap}
          start={start}
          end={end}
          route={route}
          churches={churches}
          pickups={pickups}
          mapboxToken={mapboxToken}
          onClick={clickMap}
        />
        <p className="leading-relaxed text-[#4b5563]">지도: 맵박스</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold" onClick={onLocate} disabled={pending === "gps"}>
            내 위치
          </button>
          <button type="button" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white" onClick={() => void onSnap()} disabled={pending === "snap"}>
            길에 붙이기
          </button>
          <button type="button" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white" onClick={() => void onRoute()} disabled={pending === "route"}>
            길 그리기
          </button>
          <button
            type="button"
            className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold"
            onClick={() => {
              setPoints([]);
              setSnap(null);
            }}
          >
            점 지우기
          </button>
        </div>
        <p className="leading-relaxed text-[#4b5563]">점 {points.length}개{start ? " · 시작 있음" : ""}{end ? " · 끝 있음" : ""}</p>
      </div>
    </section>
  );
}

function ModeButton({
  current,
  mode,
  label,
  onPick,
}: {
  current: ClickMode;
  mode: ClickMode;
  label: string;
  onPick: (mode: ClickMode) => void;
}) {
  const active = current === mode;
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-xl px-4 py-3 font-semibold ${active ? "bg-[#111827] text-white" : "border border-[#e5e7eb] bg-white"}`}
      onClick={() => onPick(mode)}
    >
      {label}
    </button>
  );
}

function infoLine(root: HTMLElement, label: string, value: string) {
  const line = document.createElement("p");
  const name = document.createElement("span");
  name.style.fontWeight = "600";
  name.textContent = label;
  line.append(name, document.createTextNode(` ${value}`));
  root.append(line);
}

function MapCanvas({
  places,
  selectedId,
  points,
  snap,
  start,
  end,
  route,
  churches,
  pickups,
  mapboxToken,
  onClick,
}: {
  places: PlaceHit[];
  selectedId: string | null;
  points: MapPoint[];
  snap: SnapResult | null;
  start: MapPoint | null;
  end: MapPoint | null;
  route: RouteResult | null;
  churches: ChurchPin[];
  pickups: PickupPin[];
  mapboxToken: string;
  onClick: (point: MapPoint) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);
  const clickRef = useRef(onClick);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  clickRef.current = onClick;

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
        clickRef.current({ lat: event.lngLat.lat, lon: event.lngLat.lng });
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
      const add = (marker: import("mapbox-gl").Marker) => {
        markers.push(marker);
      };
      for (const church of churches) {
        const body = document.createElement("div");
        infoLine(body, "담임목사", church.pastorName);
        infoLine(body, "주일 예배시간", church.serviceTime);
        infoLine(body, "전화번호", church.phone);
        infoLine(body, "주소", church.address);
        infoLine(body, "메모", church.memo);
        const popup = new mapboxgl.Popup({ offset: 24, maxWidth: "280px" }).setDOMContent(body);
        const marker = new mapboxgl.Marker({ color: "#1d4ed8" })
          .setLngLat([church.point.lon, church.point.lat])
          .setPopup(popup)
          .addTo(map);
        marker.getElement().setAttribute("aria-label", church.name);
        marker.getElement().addEventListener("mouseenter", () => {
          if (window.matchMedia("(hover: hover)").matches) popup.addTo(map);
        });
        marker.getElement().addEventListener("click", (event) => {
          event.stopPropagation();
          popup.addTo(map);
        });
        add(marker);
      }
      for (const pin of pickups) {
        const popup = new mapboxgl.Popup({ offset: 24 }).setText(pin.name);
        add(new mapboxgl.Marker({ color: "#b45309" }).setLngLat([pin.point.lon, pin.point.lat]).setPopup(popup).addTo(map));
      }
      for (const place of places) {
        const popup = new mapboxgl.Popup({ offset: 16 }).setText(`${PLACE_KIND_LABEL[place.kind]} · ${place.name}`);
        add(
          new mapboxgl.Marker({ color: place.id === selectedId ? "#111827" : "#64748b" })
            .setLngLat([place.point.lon, place.point.lat])
            .setPopup(popup)
            .addTo(map),
        );
      }
      for (const point of points) {
        add(new mapboxgl.Marker({ color: "#9ca3af", scale: 0.7 }).setLngLat([point.lon, point.lat]).addTo(map));
      }
      for (const point of snap?.snapped ?? []) {
        if (!point) continue;
        add(new mapboxgl.Marker({ color: "#166534", scale: 0.7 }).setLngLat([point.lon, point.lat]).addTo(map));
      }
      if (start) add(new mapboxgl.Marker({ color: "#15803d" }).setLngLat([start.lon, start.lat]).setPopup(new mapboxgl.Popup().setText("시작")).addTo(map));
      if (end) add(new mapboxgl.Marker({ color: "#111827" }).setLngLat([end.lon, end.lat]).setPopup(new mapboxgl.Popup().setText("끝")).addTo(map));
      markersRef.current = markers;

      const drawLine = (id: string, line: MapPoint[], color: string) => {
        const data =
          line.length < 2
            ? { type: "FeatureCollection" as const, features: [] }
            : {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "LineString" as const, coordinates: line.map((point) => [point.lon, point.lat]) },
              };
        const source = map.getSource(id);
        if (source && "setData" in source) {
          source.setData(data);
          return;
        }
        if (line.length < 2) return;
        map.addSource(id, { type: "geojson", data });
        map.addLayer({ id, type: "line", source: id, paint: { "line-color": color, "line-width": 4 } });
      };
      drawLine("snap-line", snap?.line ?? [], "#166534");
      drawLine("route-line", route?.line ?? [], "#1d4ed8");
    });
  }, [ready, churches, pickups, places, selectedId, points, snap, start, end, route]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const place = places.find((item) => item.id === selectedId);
    if (!map || !place) return;
    map.easeTo({ center: [place.point.lon, place.point.lat], zoom: Math.max(map.getZoom(), 14) });
  }, [ready, selectedId, places]);

  useEffect(() => {
    if (!ready || !route || route.line.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    void import("mapbox-gl").then((mod) => {
      const bounds = new mod.default.LngLatBounds();
      for (const point of route.line) bounds.extend([point.lon, point.lat]);
      map.fitBounds(bounds, { padding: 24 });
    });
  }, [ready, route]);

  return (
    <div className="grid gap-2">
      {mapError ? <p className="leading-relaxed">{mapError}</p> : null}
      <div ref={host} className="modl-map" aria-label="지도" />
    </div>
  );
}
