import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

async function getUserByUuid(ctx: any, uuid: string) {
  const norm = normalizeUuid(uuid);
  const byExact = await ctx.db
    .query("users")
    .withIndex("by_uuid", (q: any) => q.eq("uuid", uuid))
    .unique();
  if (byExact) return byExact;
  return await ctx.db
    .query("users")
    .withIndex("by_uuid", (q: any) => q.eq("uuid", norm))
    .unique();
}

export const registerUser = internalMutation({
  args: { uuid: v.string(), username: v.string() },
  handler: async (ctx, args) => {
    const uuid = normalizeUuid(args.uuid);
    const existing = await getUserByUuid(ctx, uuid);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        username: args.username,
        status: existing.status ?? "online",
        lastSeen: now,
      });
      return;
    }
    await ctx.db.insert("users", {
      uuid,
      username: args.username,
      status: "online",
      currentInstance: undefined,
      lastSeen: now,
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    uuid: v.string(),
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("ingame"),
    ),
    currentInstance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const uuid = normalizeUuid(args.uuid);
    const existing = await getUserByUuid(ctx, uuid);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        currentInstance: args.currentInstance,
        lastSeen: now,
      });
      return;
    }
    await ctx.db.insert("users", {
      uuid,
      username: uuid,
      status: args.status,
      currentInstance: args.currentInstance,
      lastSeen: now,
    });
  },
});

export const sendRequest = internalMutation({
  args: { fromUuid: v.string(), toUsername: v.string() },
  handler: async (ctx, args) => {
    const fromUuid = normalizeUuid(args.fromUuid);
    const toUsername = args.toUsername.trim();
    if (!toUsername) throw new Error("Username required");

    const target = await ctx.db
      .query("users")
      .withIndex("by_username", (q: any) => q.eq("username", toUsername))
      .unique();
    if (!target) throw new Error("User not found");
    const toUuid = normalizeUuid((target as any).uuid);
    if (toUuid === fromUuid) {
      throw new Error("Cannot add yourself");
    }

    const existingFriend = await ctx.db
      .query("friendships")
      .withIndex("by_pair", (q: any) =>
        q.eq("userUuid", fromUuid).eq("friendUuid", toUuid),
      )
      .unique();
    if (existingFriend) throw new Error("Already friends");

    const pending = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_to", (q: any) =>
        q.eq("fromUuid", fromUuid).eq("toUuid", toUuid).eq("status", "pending"),
      )
      .unique();
    if (pending) throw new Error("Request already sent");

    await ctx.db.insert("friendRequests", {
      fromUuid,
      toUuid,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const acceptRequest = internalMutation({
  args: { uuid: v.string(), requestId: v.string() },
  handler: async (ctx, args) => {
    const uuid = normalizeUuid(args.uuid);
    const req = await ctx.db.get(args.requestId as any);
    if (!req || (req as any).status !== "pending") {
      throw new Error("Request not found");
    }
    if (normalizeUuid((req as any).toUuid) !== uuid) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(args.requestId as any, { status: "accepted" });

    for (const [a, b] of [
      [(req as any).fromUuid, (req as any).toUuid],
      [(req as any).toUuid, (req as any).fromUuid],
    ]) {
      const existing = await ctx.db
        .query("friendships")
        .withIndex("by_pair", (q: any) =>
          q.eq("userUuid", a).eq("friendUuid", b),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("friendships", { userUuid: a, friendUuid: b });
      }
    }
  },
});

export const rejectRequest = internalMutation({
  args: { uuid: v.string(), requestId: v.string() },
  handler: async (ctx, args) => {
    const uuid = normalizeUuid(args.uuid);
    const req = await ctx.db.get(args.requestId as any);
    if (!req || (req as any).status !== "pending") {
      throw new Error("Request not found");
    }
    if (normalizeUuid((req as any).toUuid) !== uuid) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(args.requestId as any, { status: "rejected" });
  },
});

export const removeFriend = internalMutation({
  args: { uuid: v.string(), friendUuid: v.string() },
  handler: async (ctx, args) => {
    const uuid = normalizeUuid(args.uuid);
    const other = normalizeUuid(args.friendUuid);
    for (const [a, b] of [
      [uuid, other],
      [other, uuid],
    ]) {
      const existing = await ctx.db
        .query("friendships")
        .withIndex("by_pair", (q: any) =>
          q.eq("userUuid", a).eq("friendUuid", b),
        )
        .unique();
      if (existing) await ctx.db.delete(existing._id);
    }
  },
});

export const getFriends = internalQuery({
  args: { uuid: v.string() },
  handler: async (ctx, args) => {
    const uuid = normalizeUuid(args.uuid);
    const rows = await ctx.db
      .query("friendships")
      .withIndex("by_user", (q: any) => q.eq("userUuid", uuid))
      .collect();
    const out: any[] = [];
    for (const row of rows) {
      const user = await getUserByUuid(ctx, (row as any).friendUuid);
      if (!user) continue;
      out.push({
        uuid: (user as any).uuid,
        username: (user as any).username,
        status: (user as any).status,
        last_seen: new Date((user as any).lastSeen).toISOString(),
        current_instance: (user as any).currentInstance ?? null,
      });
    }
    return out;
  },
});

export const getRequests = internalQuery({
  args: { uuid: v.string() },
  handler: async (ctx, args) => {
    const uuid = normalizeUuid(args.uuid);
    const rows = await ctx.db
      .query("friendRequests")
      .withIndex("by_to", (q: any) =>
        q.eq("toUuid", uuid).eq("status", "pending"),
      )
      .collect();
    const out: any[] = [];
    for (const row of rows) {
      const from = await getUserByUuid(ctx, (row as any).fromUuid);
      out.push({
        id: (row as any)._id,
        from_uuid: (row as any).fromUuid,
        from_username: (from as any)?.username ?? (row as any).fromUuid,
        to_uuid: (row as any).toUuid,
        status: "pending",
        created_at: new Date((row as any).createdAt).toISOString(),
      });
    }
    return out;
  },
});