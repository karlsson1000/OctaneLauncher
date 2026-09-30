import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    uuid: v.string(),
    username: v.string(),
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("ingame"),
    ),
    currentInstance: v.optional(v.string()),
    lastSeen: v.number(),
  })
    .index("by_uuid", ["uuid"])
    .index("by_username", ["username"]),

  friendRequests: defineTable({
    fromUuid: v.string(),
    toUuid: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
  })
    .index("by_to", ["toUuid", "status"])
    .index("by_from_to", ["fromUuid", "toUuid", "status"]),

  friendships: defineTable({
    userUuid: v.string(),
    friendUuid: v.string(),
  })
    .index("by_user", ["userUuid"])
    .index("by_pair", ["userUuid", "friendUuid"]),

  sessions: defineTable({
    token: v.string(),
    uuid: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_uuid", ["uuid"]),
});