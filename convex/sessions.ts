import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const TTL_MS = 3600 * 1000;
const TOUCH_AFTER_MS = 1800 * 1000;

export const issueForUuid = internalMutation({
  args: { uuid: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .collect();
    const valid = existing.find((s) => s.expiresAt > now);
    if (valid) {
      await ctx.db.patch(valid._id, { expiresAt: now + TTL_MS });
      return { token: valid.token, expires_in: 3600 };
    }
    await Promise.all(existing.map((s) => ctx.db.delete(s._id)));
    await ctx.db.insert("sessions", {
      token: args.token,
      uuid: args.uuid,
      expiresAt: now + TTL_MS,
    });
    return { token: args.token, expires_in: 3600 };
  },
});

export const resolveAndTouch = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt <= now) {
      await ctx.db.delete(session._id);
      return null;
    }
    if (session.expiresAt - now < TOUCH_AFTER_MS) {
      await ctx.db.patch(session._id, { expiresAt: now + TTL_MS });
    }
    return session.uuid;
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("sessions")
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .take(500);
    await Promise.all(expired.map((s) => ctx.db.delete(s._id)));
    return expired.length;
  },
});
