function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function importKey(keyHex: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", hexToBytes(keyHex), "AES-GCM", false, [
    usage,
  ]);
}

export async function encryptToken(
  plaintext: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const out = new Uint8Array(12 + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), 12);
  return btoa(String.fromCharCode(...out));
}

export async function decryptToken(
  encrypted: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex, "decrypt");
  const buf = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = buf.slice(0, 12);
  const ciphertext = buf.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plain);
}
