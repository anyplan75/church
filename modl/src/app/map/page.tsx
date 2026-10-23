import { MapScreen } from "@/components/map-screen";
import { loadMapBoard } from "@/server/map/board";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const board = await loadMapBoard();
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  return (
    <MapScreen
      churches={board.churches}
      gatherings={board.gatherings}
      directoryChurches={board.directoryChurches}
      directoryGatherings={board.directoryGatherings}
      churchPinColor={board.churchPinColor}
      gatheringPinColor={board.gatheringPinColor}
      pickups={board.pickups}
      self={board.self}
      hasChurches={board.hasChurches}
      canEditChurches={board.canEditChurches}
      signedIn={board.signedIn}
      followedChurchIds={board.followedChurchIds}
      followedGroupIds={board.followedGroupIds}
      openingPoint={board.openingPoint}
      openingSource={board.openingSource}
      mapboxToken={mapboxToken}
    />
  );
}
