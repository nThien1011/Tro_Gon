import type { Database } from "./models.ts";

export function notifyUsers(
  db: Database,
  recipients: (string | undefined)[],
  type: string,
  title: string,
  body: string,
  href: string,
  actorId?: string,
) {
  db.notifications ||= [];
  for (const userId of new Set(recipients)) {
    if (
      !userId ||
      userId === actorId ||
      !db.users.some((u) => u.id === userId && u.active)
    )
      continue;
    db.notifications.push({
      id: crypto.randomUUID(),
      userId,
      type,
      title: title.slice(0, 300),
      body: body.slice(0, 1000),
      href,
      createdAt: new Date().toISOString(),
    });
  }
}
