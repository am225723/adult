import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- VAPID JWT signing (ES256) ----------

function base64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function buildVapidAuth(endpoint: string): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const headerB64 = base64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payloadB64 = base64url(
    JSON.stringify({ aud: audience, exp, sub: VAPID_SUBJECT }),
  );
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import the VAPID private key (raw EC private key scalar, base64url-encoded)
  const rawPrivate = base64urlDecode(VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "raw",
    rawPrivate,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(sigBuf)}`;

  return `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;
}

// ---------- AES-128-GCM Web Push message encryption (RFC 8291) ----------

async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const te = new TextEncoder();

  // Recipient's public key (uncompressed EC point, 65 bytes)
  const recipientPublicKey = base64urlDecode(p256dhB64);
  const authSecret = base64urlDecode(authB64);

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  // Import recipient public key for ECDH
  const recipientKey = await crypto.subtle.importKey(
    "raw",
    recipientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientKey },
    serverKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF-SHA-256: PRK = HMAC-SHA-256(auth_secret, shared_secret) using "WebPush: info\0" info
  async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
  }

  async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
    const result = new Uint8Array(length);
    let offset = 0;
    let t = new Uint8Array(0);
    for (let i = 1; offset < length; i++) {
      const input = new Uint8Array([...t, ...info, i]);
      t = await hmac(prk, input);
      const take = Math.min(t.length, length - offset);
      result.set(t.subarray(0, take), offset);
      offset += take;
    }
    return result;
  }

  // Build info for pseudo-random key (auth)
  const authInfo = te.encode("WebPush: info\x00");
  const authInfoFull = new Uint8Array([...authInfo, ...recipientPublicKey, ...serverPublicKeyRaw]);
  const prk = await hmac(authSecret, sharedSecret);
  const ikm = await hkdfExpand(prk, authInfoFull, 32);

  // CEK and nonce derivation
  const saltInfo = te.encode("Content-Encoding: aes128gcm\x00");
  const prkCEK = await hmac(salt, ikm);
  const cek = await hkdfExpand(prkCEK, new Uint8Array([...saltInfo, 1]), 16);

  const nonceInfo = te.encode("Content-Encoding: nonce\x00");
  const nonce = await hkdfExpand(prkCEK, new Uint8Array([...nonceInfo, 1]), 12);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintextBytes = te.encode(plaintext);
  // Padding: single \x02 delimiter (record padding)
  const padded = new Uint8Array([...plaintextBytes, 0x02]);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  // Build aes128gcm content-encoding header (salt 16b + rs 4b + keylen 1b + server public key 65b)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = serverPublicKeyRaw.length;
  header.set(serverPublicKeyRaw, 21);

  const body = new Uint8Array([...header, ...ciphertext]);
  return { body, salt, serverPublicKey: serverPublicKeyRaw };
}

// ---------- Send a Web Push notification ----------

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
): Promise<number> {
  const { body } = await encryptPayload(payload, p256dh, auth);
  const vapidAuth = await buildVapidAuth(endpoint);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuth,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
    },
    body,
  });
  return res.status;
}

// ---------- Handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "VAPID keys not configured" }, 503);
  }

  try {
    const { user_id, title, body, url } = await req.json() as {
      user_id: string;
      title: string;
      body?: string;
      url?: string;
    };

    if (!user_id || !title) return json({ error: "user_id and title required" }, 400);

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subs?.length) return json({ sent: 0 });

    const notification = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });

    const results = await Promise.allSettled(
      subs.map((s) => sendWebPush(s.endpoint, s.p256dh, s.auth, notification)),
    );

    // Clean up expired subscriptions (410 Gone)
    const goneEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value === 410) goneEndpoints.push(subs[i].endpoint);
      if (r.status === "rejected") console.error("push error:", r.reason);
    });
    if (goneEndpoints.length) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .in("endpoint", goneEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<number>).value < 300).length;
    return json({ sent });
  } catch (err) {
    console.error("push-notification error:", err);
    return json({ error: String(err) }, 500);
  }
});
