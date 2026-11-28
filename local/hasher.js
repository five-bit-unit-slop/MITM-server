import { hashPassword, verifyPassword } from "@better-auth/utils/password";

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

export async function passhasher(input) { //trust the process i guess?
    return await hashPassword(input);
};

export async function passverify(input, hash) { // Verify password against stored hash
    return await verifyPassword(hash, input);
};