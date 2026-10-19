import type { Database, Snapshot, User } from "../../../src/domain/models.ts";

export function visibleSnapshot(
  database: Database,
  viewer: User | null,
): Snapshot {
  viewer = viewer
    ? database.users.find((user) => user.id === viewer!.id && user.active) ||
      null
    : null;
  const { credentials: _, ...db } = structuredClone(database);
  db.notifications = (db.notifications || [])
    .filter((n) => n.userId === viewer?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  db.meterReadings ||= [];
  if (viewer?.role === "admin") return db;
  const ownRooms = new Set(
    db.rooms
      .filter((room) =>
        db.buildings.some(
          (b) => b.id === room.buildingId && b.ownerId === viewer?.id,
        ),
      )
      .map((room) => room.id),
  );
  const publicListings = db.listings.filter(
    (listing) =>
      listing.status === "published" &&
      db.rooms.some(
        (room) =>
          room.id === listing.roomId &&
          room.status === "available" &&
          db.buildings.some(
            (b) =>
              b.id === room.buildingId &&
              db.users.some((u) => u.id === b.ownerId && u.active),
          ),
      ),
  );
  const tenancies = db.tenancies.filter(
    (item) =>
      viewer && (item.tenantId === viewer.id || ownRooms.has(item.roomId)),
  );
  const invoices = db.invoices.filter(
    (item) =>
      viewer &&
      ((item.tenantId === viewer.id && item.status !== "draft") ||
        ownRooms.has(item.roomId)),
  );
  const requests = db.requests.filter(
    (item) =>
      viewer && (item.tenantId === viewer.id || ownRooms.has(item.roomId)),
  );
  const conversations = db.conversations.filter(
    (item) => viewer && [item.ownerId, item.tenantId].includes(viewer.id),
  );
  const appointments = db.appointments.filter(
    (item) =>
      viewer &&
      (item.tenantId === viewer.id ||
        db.listings.some(
          (l) => l.id === item.listingId && ownRooms.has(l.roomId),
        )),
  );
  const tickets = db.tickets.filter(
    (item) =>
      viewer &&
      (item.authorId === viewer.id ||
        (item.category === "repair" &&
          !!item.roomId &&
          ownRooms.has(item.roomId))),
  );
  const favorites = db.favorites.filter((item) => item.userId === viewer?.id);
  const meterReadings = db.meterReadings.filter(
    (item) =>
      viewer && (item.tenantId === viewer.id || ownRooms.has(item.roomId)),
  );
  const neededListingIds = new Set([
    ...publicListings.map((l) => l.id),
    ...conversations.map((c) => c.listingId),
    ...appointments.map((a) => a.listingId),
  ]);
  const neededRoomIds = new Set([
    ...ownRooms,
    ...tenancies.map((t) => t.roomId),
    ...invoices.map((i) => i.roomId),
    ...requests.map((r) => r.roomId),
    ...tickets.flatMap((t) => (t.roomId ? [t.roomId] : [])),
  ]);
  const listings = db.listings.filter(
    (listing) =>
      neededListingIds.has(listing.id) || neededRoomIds.has(listing.roomId),
  );
  listings.forEach((listing) => neededRoomIds.add(listing.roomId));
  const rooms = db.rooms.filter((room) => neededRoomIds.has(room.id));
  const buildings = db.buildings.filter(
    (building) =>
      rooms.some((r) => r.buildingId === building.id) ||
      building.ownerId === viewer?.id,
  );
  const userIds = new Set([
    viewer?.id,
    ...buildings.map((b) => b.ownerId),
    ...tenancies.map((t) => t.tenantId),
    ...requests.map((r) => r.tenantId),
    ...appointments.map((a) => a.tenantId),
    ...conversations.flatMap((c) => [c.ownerId, c.tenantId]),
    ...tickets.map((t) => t.authorId),
    ...invoices.map((i) => i.tenantId),
    ...meterReadings
      .flatMap((r) => [r.submittedBy, r.reviewedBy])
      .filter((id): id is string => !!id),
  ]);
  const users = db.users
    .filter((user) => userIds.has(user.id))
    .map((user) =>
      user.id === viewer?.id
        ? user
        : {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            active: user.active,
            avatar: user.avatar,
          },
    );
  // Meter readings and deposits of other people's occupied rooms are not public.
  rooms.forEach((room) => {
    if (
      !ownRooms.has(room.id) &&
      !tenancies.some((t) => t.roomId === room.id && t.tenantId === viewer?.id)
    ) {
      room.electricity = 0;
      room.water = 0;
    }
  });
  return {
    version: db.version,
    users,
    buildings,
    rooms,
    listings,
    tenancies,
    invoices,
    appointments,
    requests,
    conversations,
    tickets,
    favorites,
    audit: [],
    notifications: db.notifications,
    meterReadings,
    settings: db.settings,
  };
}
