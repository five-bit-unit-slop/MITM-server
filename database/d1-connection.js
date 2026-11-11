export function getDatabase(env) {
    if (!env.random_access_memory) {
        throw new Error("D1 database binding not found!");
    }
    return env.random_access_memory;
}