import { RESIDENCES } from "../data/residences";

// Combines the static placeholder hostels (src/data/residences.js) with any
// real rows the warden has added in Supabase's `hostels` table. A DB row
// with the same id as a static one overrides it (so the warden can also
// edit the description/photos/floors of the six starter hostels, not just
// add new ones); anything else new is appended.
export function mergeResidences(hostelRows) {
  if (!hostelRows?.length) return RESIDENCES;

  const byId = new Map(RESIDENCES.map((r) => [r.id, r]));
  for (const row of hostelRows) {
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      tag: row.tag ?? "",
      cover: row.cover || byId.get(row.id)?.cover || "",
      description: row.description ?? byId.get(row.id)?.description ?? "",
      facilities: row.facilities?.length ? row.facilities : byId.get(row.id)?.facilities ?? [],
      gallery: row.gallery?.length ? row.gallery : byId.get(row.id)?.gallery ?? [],
      mapQuery: row.map_query || byId.get(row.id)?.mapQuery || row.name,
      // Merge floors by id too, so adding one new floor via the warden
      // form doesn't wipe out the starter mock floors/rooms.
      floors: mergeFloors(byId.get(row.id)?.floors, row.floors),
    });
  }
  return Array.from(byId.values());
}

function mergeFloors(staticFloors = [], dbFloors = []) {
  if (!dbFloors?.length) return staticFloors;
  const byId = new Map((staticFloors ?? []).map((f) => [f.id, f]));
  for (const f of dbFloors) {
    byId.set(f.id, { id: f.id, label: f.label, rooms: byId.get(f.id)?.rooms ?? [] });
  }
  return Array.from(byId.values());
}
