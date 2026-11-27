import type { IncomingMessage } from "node:http";

export async function readBody(req: IncomingMessage): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let body = "";

        req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
        });

        req.on("end", () => {
            resolve(body);
        });

        req.on("error", (error) => {
            reject(error);
        });
    });
}