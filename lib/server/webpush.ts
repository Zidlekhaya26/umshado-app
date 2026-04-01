/**
 * Web Push (RFC 8291 / RFC 8292) implementation using Node.js built-in crypto.
 * No external packages required.
 *
 * Implements:
 *  - VAPID auth headers (RFC 8292)
 *  - Message Encryption (RFC 8291 / aes128gcm content-encoding)
 */

import crypto from 'crypto';

// ── Types ────────────────────────────────────────────────────────────

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string; // base64url-encoded user public key
    auth: string;   // base64url-encoded auth secret (16 bytes)
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

// ── Base64url helpers ─────────────────────────────────────────────────

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── VAPID JWT ─────────────────────────────────────────────────────────

function makeVapidJwt(endpoint: string, vapidPrivateKeyB64: string, subject: string): string {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ aud: audience, exp: now + 86400, sub: subject })).toString('base64url');
  const signingInput = `${header}.${payload}`;

  // Import private key from raw bytes
  const rawPriv = b64urlDecode(vapidPrivateKeyB64);

  // Build a proper EC private key DER (SEC1 format for P-256)
  // SEC1 ECPrivateKey: SEQUENCE { INTEGER 1, OCTET STRING <private>, [1] EXPLICIT BIT STRING <public> }
  // For signing we only need the private scalar; Node accepts PKCS8 or jwk format
  const privateKey = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: b64urlEncode(rawPriv),
      // Dummy x/y (only d is needed for signing)
      x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      y: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    format: 'jwk',
  });

  const sig = crypto.sign('SHA256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${sig.toString('base64url')}`;
}

// ── Message Encryption (RFC 8291 aes128gcm) ───────────────────────────

async function encryptPayload(
  payload: string,
  userPublicKeyB64: string,
  authSecretB64: string,
): Promise<{ ciphertext: Buffer; salt: Buffer; serverPublicKey: Buffer }> {
  const userPublicKey = b64urlDecode(userPublicKeyB64); // 65-byte uncompressed EC point
  const authSecret = b64urlDecode(authSecretB64);       // 16-byte auth secret
  const salt = crypto.randomBytes(16);

  // Generate server ephemeral ECDH key pair
  const serverECDH = crypto.createECDH('prime256v1');
  serverECDH.generateKeys();
  const serverPublicKey = serverECDH.getPublicKey(); // 65-byte uncompressed

  // ECDH shared secret
  const sharedSecret = serverECDH.computeSecret(userPublicKey);

  // HKDF-SHA256 — PRK from HKDF-Extract
  const prk = await hkdfExtract(authSecret, sharedSecret);

  // key_info = "WebPush: info\x00" + userPublicKey + serverPublicKey
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\x00'),
    userPublicKey,
    serverPublicKey,
  ]);
  const ikm = await hkdfExpand(prk, keyInfo, 32);

  // Content encryption keys
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\x00');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\x00');

  const cekPrk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(cekPrk, cekInfo, 16);
  const nonce = await hkdfExpand(cekPrk, nonceInfo, 12);

  // Pad and encrypt
  const plaintext = Buffer.from(payload, 'utf8');
  // Add a single 0x02 delimiter byte (no padding needed for small payloads)
  const padded = Buffer.concat([plaintext, Buffer.from([0x02])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]);

  return { ciphertext, salt, serverPublicKey };
}

// ── HKDF helpers ──────────────────────────────────────────────────────

async function hkdfExtract(salt: Buffer, ikm: Buffer): Promise<Buffer> {
  const hmac = crypto.createHmac('sha256', salt);
  hmac.update(ikm);
  return hmac.digest();
}

async function hkdfExpand(prk: Buffer, info: Buffer, length: number): Promise<Buffer> {
  const rounds = Math.ceil(length / 32);
  const output: Buffer[] = [];
  let prev = Buffer.alloc(0);
  for (let i = 1; i <= rounds; i++) {
    const hmac = crypto.createHmac('sha256', prk);
    hmac.update(prev);
    hmac.update(info);
    hmac.update(Buffer.from([i]));
    prev = hmac.digest();
    output.push(prev);
  }
  return Buffer.concat(output).slice(0, length);
}

// ── Build aes128gcm content body ─────────────────────────────────────

function buildEncryptedBody(salt: Buffer, serverPublicKey: Buffer, ciphertext: Buffer): Buffer {
  // RFC 8291 aes128gcm record:
  // salt (16) + rs (4, big-endian uint32) + idlen (1) + keyid (65) + ciphertext
  const rs = Buffer.allocUnsafe(4);
  rs.writeUInt32BE(4096, 0); // record size
  const idlen = Buffer.from([serverPublicKey.length]);
  return Buffer.concat([salt, rs, idlen, serverPublicKey, ciphertext]);
}

// ── Main send function ────────────────────────────────────────────────

export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@umshadohub.co.za';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return { ok: false, error: 'VAPID keys not configured' };
  }

  try {
    const payloadJson = JSON.stringify(payload);
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(
      payloadJson,
      subscription.keys.p256dh,
      subscription.keys.auth,
    );
    const body = buildEncryptedBody(salt, serverPublicKey, ciphertext);

    const jwt = makeVapidJwt(subscription.endpoint, vapidPrivateKey, vapidSubject);

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': body.length.toString(),
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
        TTL: '86400',
      },
      body: body as any, // Buffer is a valid BodyInit but TypeScript needs help
    });

    return { ok: res.ok, status: res.status };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
