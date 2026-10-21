import { MapBoard } from "@/components/map-board";
import { loadMapBoard } from "@/server/map/board";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const board = await loadMapBoard();
  return <MapBoard churches={board.churches} pickups={board.pickups} self={board.self} hasChurches={board.hasChurches} />;
}
