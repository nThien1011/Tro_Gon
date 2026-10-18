const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
export async function hashPassword(
  password: string,
  salt: string = crypto.randomUUID(),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return { salt, hash: hex(hash) };
}
