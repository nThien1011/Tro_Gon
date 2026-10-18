export type Role = "admin" | "owner" | "tenant";
export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  active: boolean;
  avatar?: string;
  bankBin?: string;
  bankAccount?: string;
  bankName?: string;
};
export type Building = {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
  description: string;
};
export type Room = {
  id: string;
  buildingId: string;
  name: string;
  area: number;
  capacity: number;
  rent: number;
  electricityRate: number;
  waterRate: number;
  serviceFee: number;
  deposit: number;
  electricity: number;
  water: number;
  status: "available" | "occupied" | "maintenance";
  amenities: string[];
  images: string[];
};
export type Listing = {
  id: string;
  roomId: string;
  title: string;
  description: string;
  status: "draft" | "pending" | "published" | "rejected" | "hidden";
  createdAt: string;
  reason?: string;
};
export type Tenancy = {
  id: string;
  roomId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  active: boolean;
  people: number;
  note: string;
};
export type Invoice = {
  id: string;
  roomId: string;
  tenantId: string;
  tenantName?: string;
  roomName?: string;
  buildingName?: string;
  period: string;
  oldElectricity: number;
  newElectricity: number;
  oldWater: number;
  newWater: number;
  electricityRate: number;
  waterRate: number;
  rent: number;
  serviceFee: number;
  electricityPhoto?: string;
  waterPhoto?: string;
  status: "draft" | "issued" | "cancelled";
  paymentStatus: "unpaid" | "pending" | "paid";
  createdAt: string;
  dueDate: string;
  paidAt?: string;
  bankBin?: string;
  bankAccount?: string;
  bankName?: string;
};
export type Appointment = {
  id: string;
  listingId: string;
  tenantId: string;
  date: string;
  note: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
};
export type RentalRequest = {
  id: string;
  roomId: string;
  tenantId: string;
  date: string;
  people: number;
  note: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "completed";
};
export type Conversation = {
  id: string;
  listingId: string;
  ownerId: string;
  tenantId: string;
  messages: { id: string; senderId: string; body: string; createdAt: string }[];
};
export type SupportTicket = {
  id: string;
  authorId: string;
  roomId?: string;
  title: string;
  content: string;
  category: "repair" | "report";
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  response?: string;
};
export type Audit = {
  id: string;
  actorId: string;
  action: string;
  createdAt: string;
};
export type Settings = {
  siteName: string;
  supportEmail: string;
  electricityRate: number;
  waterRate: number;
  serviceFee: number;
  maintenance: boolean;
};
export type Snapshot = {
  version: number;
  users: User[];
  buildings: Building[];
  rooms: Room[];
  listings: Listing[];
  tenancies: Tenancy[];
  invoices: Invoice[];
  appointments: Appointment[];
  requests: RentalRequest[];
  conversations: Conversation[];
  tickets: SupportTicket[];
  favorites: { userId: string; listingId: string }[];
  audit: Audit[];
  settings: Settings;
};
export type Credential = { userId: string; salt: string; hash: string };
export type Database = Snapshot & { credentials: Credential[] };
export type Command = { type: string; payload: Record<string, unknown> };
export const roleLabels: Record<Role, string> = {
  admin: "Quản trị viên",
  owner: "Chủ trọ",
  tenant: "Người thuê",
};
