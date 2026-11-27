import { argon2id, argon2Verify } from "hash-wasm";

// https://stackoverflow.com/questions/59777670/how-can-i-hash-a-string-with-sha256
// basically just the code of this above.
export async function sha256hasher(input) {
    const textAsBuffer = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", textAsBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray
        .map((item) => item.toString(16).padStart(2, "0"))
        .join("");
    return hash;
};

//https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
export async function passhasher(input) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const output = await argon2id({
    password: input,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456, // in KiB, so 19 MiB
    hashLength: 32,
    outputType: "encoded",
    });
    return output;
};

export async function passverify(input, hash) {
    return await argon2Verify({ password: input, hash });
};