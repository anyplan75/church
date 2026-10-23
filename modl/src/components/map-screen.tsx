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
  gatherings,
  churchPinColor,
  gatheringPinColor,
  pickups,
  self,
  hasChurches,
  canEditChurches,
  signedIn,
  followedChurchIds,
  followedGroupIds,
  mapboxToken,
}: {
  churches: ChurchPin[];
  gatherings: Array<{ id: string; name: string; address: string; point: MapPoint }>;
  churchPinColor: string;
  gatheringPinColor: string;
  pickups: Array<{ id: string; name: string; point: MapPoint }>;
  self: { address: string; consented: boolean } | null;
  hasChurches: boolean;
  canEditChurches: boolean;
  signedIn: boolean;
  followedChurchIds: string[];
  followedGroupIds: string[];
  mapboxToken: string;
}) {
  return (
    <MapBoard
      churches={churches}
      gatherings={gatherings}
      churchPinColor={churchPinColor}
      gatheringPinColor={gatheringPinColor}
      pickups={pickups}
      self={self}
      hasChurches={hasChurches}
      canEditChurches={canEditChurches}
      signedIn={signedIn}
      followedChurchIds={followedChurchIds}
      followedGroupIds={followedGroupIds}
      mapboxToken={mapboxToken}
    />
  );
}
