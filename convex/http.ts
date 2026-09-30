import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  const parts = h.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

const auth = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);
  const body = await readJson(req);
  const accessToken = body.access_token;
  if (
    typeof accessToken !== "string" ||
    accessToken.length === 0 ||
    accessToken.length > 4096
  ) {
    return json({ message: "Missing or invalid access_token" }, 400);
  }

  let profileRes: Response;
  try {
    profileRes = await fetch(
      "https://api.minecraftservices.com/minecraft/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    return json({ message: "Mojang API unreachable" }, 502);
  }
  if (!profileRes.ok) {
    return json({ message: "Invalid Minecraft token" }, 401);
  }
  const profile = await profileRes.json();
  const mcUuid = profile?.id;
  if (typeof mcUuid !== "string" || mcUuid.length === 0) {
    return json({ message: "Profile unavailable" }, 401);
  }
  const uuid = mcUuid.replace(/-/g, "").toLowerCase();

  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const session = await ctx.runMutation(internal.sessions.issueForUuid, {
    uuid,
    token,
  });

  return json(session);
});

const withSession = (
  fn: (ctx: any, uuid: string, body: any) => Promise<Response>,
) =>
  httpAction(async (ctx, req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    const session = bearer(req);
    if (!session) return json({ message: "Missing session" }, 401);
    const uuid = await ctx.runMutation(internal.sessions.resolveAndTouch, {
      token: session,
    });
    if (!uuid) return json({ message: "Invalid or expired session" }, 401);
    const body = await readJson(req);
    try {
      return await fn(ctx, uuid, body);
    } catch (e: any) {
      return json({ message: e?.message ?? "Database error" }, 400);
    }
  });

const http = httpRouter();

http.route({ path: "/auth", method: "POST", handler: auth });
http.route({ path: "/auth", method: "OPTIONS", handler: auth });

http.route({
  path: "/register",
  method: "POST",
  handler: withSession(async (ctx, uuid, body) => {
    const username = body.username ?? body.uuid ?? uuid;
    await ctx.runMutation(internal.friends.registerUser, {
      uuid,
      username,
    });
    return json({ ok: true });
  }),
});

http.route({
  path: "/status",
  method: "PATCH",
  handler: withSession(async (ctx, uuid, body) => {
    await ctx.runMutation(internal.friends.updateStatus, {
      uuid,
      status: body.status,
      currentInstance: body.current_instance ?? undefined,
    });
    return json({ ok: true });
  }),
});

http.route({
  path: "/friends/request",
  method: "POST",
  handler: withSession(async (ctx, uuid, body) => {
    await ctx.runMutation(internal.friends.sendRequest, {
      fromUuid: uuid,
      toUsername: body.to_username,
    });
    return json({ ok: true });
  }),
});

http.route({
  path: "/friends/accept",
  method: "POST",
  handler: withSession(async (ctx, uuid, body) => {
    await ctx.runMutation(internal.friends.acceptRequest, {
      uuid,
      requestId: body.p_request_id ?? body.request_id,
    });
    return json({ ok: true });
  }),
});

http.route({
  path: "/friends/reject",
  method: "POST",
  handler: withSession(async (ctx, uuid, body) => {
    await ctx.runMutation(internal.friends.rejectRequest, {
      uuid,
      requestId: body.p_request_id ?? body.request_id,
    });
    return json({ ok: true });
  }),
});

http.route({
  path: "/friends/remove",
  method: "POST",
  handler: withSession(async (ctx, uuid, body) => {
    await ctx.runMutation(internal.friends.removeFriend, {
      uuid,
      friendUuid: body.f ?? body.friend_uuid,
    });
    return json({ ok: true });
  }),
});

http.route({
  path: "/friends/list",
  method: "POST",
  handler: withSession(async (ctx, uuid) => {
    const friends = await ctx.runQuery(internal.friends.getFriends, {
      uuid,
    });
    return json(friends);
  }),
});

http.route({
  path: "/friends/requests",
  method: "POST",
  handler: withSession(async (ctx, uuid) => {
    const requests = await ctx.runQuery(internal.friends.getRequests, {
      uuid,
    });
    return json(requests);
  }),
});

export default http;