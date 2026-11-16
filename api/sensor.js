// Compatibility route for existing /sensor clients.
// The request contract is the same as POST /measurements.
export { measurementsRoute as sensorRoute } from "./measurements.js";
