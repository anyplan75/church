"use client";

import dynamic from "next/dynamic";
import type { ChurchPin } from "@/map/church-sheet";
import type { MapPoint } from "@/map/rules";

const MapBoard = dynamic(() => import("@/components/map-board").then((mod) => mod.MapBoard), {
  ssr: false,
  loading: () => <p className="p-4 leading-relaxed">지도를 불러오는 중입니다.</p>,
});

/** 지도 그림은 브라우저에서만 불러 서버가 그 묶음을 찾지 못해 멈추지 않게 합니다. */
export function MapScreen({
  churches,
  pickups,
  self,
  hasChurches,
  canEditChurches,
  mapboxToken,
}: {
  churches: ChurchPin[];
  pickups: Array<{ id: string; name: string; point: MapPoint }>;
  self: { address: string; consented: boolean } | null;
  hasChurches: boolean;
  canEditChurches: boolean;
  mapboxToken: string;
}) {
  return (
    <MapBoard
      churches={churches}
      pickups={pickups}
      self={self}
      hasChurches={hasChurches}
      canEditChurches={canEditChurches}
      mapboxToken={mapboxToken}
    />
  );
}
