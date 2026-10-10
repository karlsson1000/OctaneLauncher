import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired sessions",
  { hours: 1 },
  internal.sessions.cleanupExpired,
);

crons.interval(
  "mark stale users offline",
  { minutes: 2 },
  internal.friends.markStaleOffline,
);

export default crons;