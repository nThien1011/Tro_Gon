import type { Snapshot, Room, User } from "./models";
export const buildingOf = (s: Snapshot, room: Room) =>
  s.buildings.find((b) => b.id === room.buildingId)!;
export const ownerOf = (s: Snapshot, room: Room) =>
  s.users.find((u) => u.id === buildingOf(s, room).ownerId)!;
export const canManageRoom = (s: Snapshot, u: User, roomId: string) =>
  u.role === "admin" ||
  s.buildings.some(
    (b) =>
      b.ownerId === u.id &&
      s.rooms.some((r) => r.id === roomId && r.buildingId === b.id),
  );
export const visibleRooms = (s: Snapshot, user: User) =>
  user.role === "admin"
    ? s.rooms
    : user.role === "owner"
      ? s.rooms.filter((r) => canManageRoom(s, user, r.id))
      : s.rooms.filter((r) =>
          s.tenancies.some(
            (t) => t.active && t.tenantId === user.id && t.roomId === r.id,
          ),
        );
