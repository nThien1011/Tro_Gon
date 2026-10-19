import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export async function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  const hash = await deriveHash(password, salt, 3);
  return { salt, hash: `scrypt$32768$8$3$${hash.toString("hex")}` };
}
async function deriveHash(
  password: string,
  salt: string,
  parallelization: number,
) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: parallelization, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolve(result)),
    ),
  );
}
export async function verifyPassword(
  password: string,
  credential: { salt: string; hash: string },
) {
  const current = /^scrypt\$32768\$8\$3\$([a-f0-9]{128})$/.exec(
    credential.hash,
  );
  // Accept the initial development hashes; new/changed credentials use versioned parameters.
  if (!current && !/^[a-f0-9]{128}$/.test(credential.hash)) return false;
  const actual = await deriveHash(password, credential.salt, current ? 3 : 1);
  const expected = Buffer.from(current?.[1] || credential.hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
