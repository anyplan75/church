"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { PLACE_KIND_LABEL, type MapPoint, type PlaceHit, type RouteResult, type SnapResult } from "@/map/rules";
import { routeBetweenAction, searchPlacesAction, snapToRoadAction } from "@/server/map/actions";

type ClickMode = "point" | "start" | "end";
type Pending = "search" | "snap" | "route" | "gps" | null;

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

export function MapBoard() {
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

  async function onRoute() {
    if (!start || !end) {
      setError("시작과 끝을 먼저 찍어 주세요.");
      return;
    }
    setPending("route");
    setError("");
    setNote("");
    const result = await routeBetweenAction(start, end);
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

  return (
    <section className="grid gap-4">
      <h1 className="page-title text-[clamp(1.35rem,1.1rem+0.6vw,1.8rem)] leading-tight">지도</h1>
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
          onClick={clickMap}
        />
        <p className="leading-relaxed text-[#4b5563]">지도: 오픈스트리트맵</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 font-semibold" onClick={onLocate} disabled={pending === "gps"}>
            내 위치
          </button>
          <button type="button" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white" onClick={onSnap} disabled={pending === "snap"}>
            길에 붙이기
          </button>
          <button type="button" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white" onClick={onRoute} disabled={pending === "route"}>
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

function MapCanvas({
  places,
  selectedId,
  points,
  snap,
  start,
  end,
  route,
  onClick,
}: {
  places: PlaceHit[];
  selectedId: string | null;
  points: MapPoint[];
  snap: SnapResult | null;
  start: MapPoint | null;
  end: MapPoint | null;
  route: RouteResult | null;
  onClick: (point: MapPoint) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const clickRef = useRef(onClick);
  const [ready, setReady] = useState(false);
  clickRef.current = onClick;

  useEffect(() => {
    let alive = true;
    let map: LeafletMap | null = null;
    void import("leaflet").then((L) => {
      if (!alive || !host.current || mapRef.current) return;
      map = L.map(host.current).setView([36.4, 127.8], 7);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (event) => {
        clickRef.current({ lat: event.latlng.lat, lon: event.latlng.lng });
      });
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      alive = false;
      map?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    void import("leaflet").then((L) => {
      layerRef.current?.remove();
      const group = L.layerGroup();
      for (const place of places) {
        L.circleMarker([place.point.lat, place.point.lon], {
          radius: place.id === selectedId ? 11 : 8,
          color: "#111827",
          weight: 2,
          fillColor: place.kind === "restaurant" ? "#111827" : "#93c5fd",
          fillOpacity: 0.95,
        })
          .bindTooltip(`${PLACE_KIND_LABEL[place.kind]} · ${place.name}`)
          .addTo(group);
      }
      for (const point of points) {
        L.circleMarker([point.lat, point.lon], {
          radius: 6,
          color: "#6b7280",
          weight: 2,
          fillColor: "#e5e7eb",
          fillOpacity: 0.95,
        }).addTo(group);
      }
      for (const point of snap?.snapped ?? []) {
        if (!point) continue;
        L.circleMarker([point.lat, point.lon], {
          radius: 7,
          color: "#166534",
          weight: 2,
          fillColor: "#22c55e",
          fillOpacity: 0.95,
        }).addTo(group);
      }
      if ((snap?.line.length ?? 0) > 1 && snap) {
        L.polyline(snap.line.map((point) => [point.lat, point.lon]), { color: "#166534", weight: 4 }).addTo(group);
      }
      if (start) {
        L.circleMarker([start.lat, start.lon], { radius: 9, color: "#166534", fillColor: "#22c55e", fillOpacity: 1, weight: 2 })
          .bindTooltip("시작")
          .addTo(group);
      }
      if (end) {
        L.circleMarker([end.lat, end.lon], { radius: 9, color: "#111827", fillColor: "#111827", fillOpacity: 1, weight: 2 })
          .bindTooltip("끝")
          .addTo(group);
      }
      if ((route?.line.length ?? 0) > 1 && route) {
        L.polyline(route.line.map((point) => [point.lat, point.lon]), { color: "#1d4ed8", weight: 5 }).addTo(group);
      }
      group.addTo(map);
      layerRef.current = group;
    });
  }, [ready, places, selectedId, points, snap, start, end, route]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const place = places.find((item) => item.id === selectedId);
    if (!map || !place) return;
    map.setView([place.point.lat, place.point.lon], Math.max(map.getZoom(), 15));
  }, [ready, selectedId, places]);

  useEffect(() => {
    if (!ready || !route || route.line.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    void import("leaflet").then((L) => {
      map.fitBounds(L.latLngBounds(route.line.map((point) => [point.lat, point.lon])), { padding: [24, 24] });
    });
  }, [ready, route]);

  return <div ref={host} className="modl-map" aria-label="지도" />;
}
