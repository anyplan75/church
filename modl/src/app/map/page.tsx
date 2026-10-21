import { MapBoard } from "@/components/map-board";
import { loadMapBoard } from "@/server/map/board";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const board = await loadMapBoard();
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  return (
    <MapBoard
      churches={board.churches}
      pickups={board.pickups}
      self={board.self}
      hasChurches={board.hasChurches}
      mapboxToken={mapboxToken}
    />
  );
}
