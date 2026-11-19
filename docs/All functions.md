# **MITM-server functions**

## **worker.js**

- http.createServer(async (req, res) => {})

- Handles incoming HTTP requests.
- Uses these parameters:
  - req: incoming HTTP request.
  - res: HTTP response.
- Checks rate limits using checkRateLimit().
- Determines the requested URL path.
- Routes requests to the correct API function.
- Handles unknown routes with HTTP 404.
- Catches unexpected errors and returns HTTP 500.

- httpServerHandler(server)

- Adapts the Node.js HTTP server to the Cloudflare Workers environment.
- Uses these parameters:
  - server: Node.js HTTP server.
- Exported as the default Worker handler.

## **api/common.js**

- sendJson(res, status, data, headers = {})

- Sends a JSON HTTP response.
- Uses these parameters:
  - res: HTTP response.
  - status: HTTP status code.
  - data: response data.
  - headers: optional additional HTTP headers.
- Sets the Content-Type and Cache-Control headers.
- Converts the data into a JSON string using JSON.stringify().

- sendError(res, status, code, message, headers = {})

- Sends a standardized JSON error response.
- Uses these parameters:
  - res: HTTP response.
  - status: HTTP status code.
  - code: error identifier.
  - message: error description.
  - headers: optional additional HTTP headers.
- Uses sendJson() to send the response.

- getGatewayToken(req)

- Extracts the gateway authentication token from the Authorization header.
- Uses these parameters:
  - req: incoming HTTP request.
- Checks whether the header uses the Bearer format.
- Removes the Bearer  prefix.
- Checks whether the token contains between 16 and 4096 characters.
- Returns the token or null.
- Does not verify whether the token is authorized.

- hashToken(token)

- Converts a gateway token into a SHA-256 hash.
- Uses these parameters:
  - token: gateway authentication token.
- Converts the token into UTF-8 bytes.
- Calculates the SHA-256 hash using the Web Crypto API.
- Converts the result into a 64-character hexadecimal string.
- Returns a Promise.

- requireTokenHash(req, res)

- Requires a gateway token and returns its SHA-256 hash.
- Uses these parameters:
  - req: incoming HTTP request.
  - res: HTTP response.
- Uses getGatewayToken() to extract and check the token.
- Uses hashToken() to calculate its hash.
- Returns null and sends HTTP 401 if the token is missing or malformed.

- readJsonBody(req, maxBytes = 10 * 1024)

- Reads and validates the incoming HTTP request body.
- Uses these parameters:
  - req: incoming HTTP request.
  - maxBytes: maximum allowed request body size in bytes.
- Collects incoming data chunks.
- Checks whether the request body exceeds the size limit.
- Rejects empty request bodies.
- Combines the chunks into a single Buffer.
- Converts the Buffer into a UTF-8 string.
- Parses the string using JSON.parse().
- Checks whether the result is a JSON object.
- Returns the parsed data or an error object.
- Uses a Promise because request data arrives asynchronously.

- callBridge(env, payload)

- Sends a request to the Azure Functions databasebridge.
- Uses these parameters:
  - env: Cloudflare environment containing configuration and secrets.
  - payload: data to send to Azure.
- Retrieves the Azure Functions URL and authentication key.
- Checks whether the bridge is configured.
- Sends an HTTP POST request using fetch().
- Authenticates using the x-functions-key header.
- Converts the payload into JSON.
- Aborts the request after 10 seconds.
- Parses the JSON response from Azure.
- Returns the response or an error object.

## **api/device.js**

- deviceRoute(req, res, env)

- Handles requests to /device.
- Uses these parameters:
  - req: incoming HTTP request.
  - res: HTTP response.
  - env: Cloudflare environment.
- Only allows GET requests.
- Uses requireTokenHash() to require gateway authentication.
- Uses callBridge() to send a device.list action to Azure.
- Returns the devices received from Azure.
- Returns an error if the databasebridge request fails.

## **api/health.js**

- healthRoute(res, env)

- Checks the availability of the Azure databasebridge.
- Uses these parameters:
  - res: HTTP response.
  - env: Cloudflare environment.
- Retrieves the Azure Functions URL and authentication key.
- Checks whether the bridge is configured.
- Sends an HTTP GET request to Azure.
- Uses the x-functions-key header for authentication.
- Aborts the request after 10 seconds.
- Checks whether Azure returns a valid JSON response.
- Checks whether the HTTP response indicates success.
- Returns the database connection status.
- Handles timeout and connection errors.

## **api/measurements.js**

- validateMessage(data)

- Validates an incoming sensor measurement message.
- Uses these parameters:
  - data: parsed JSON request body.
- Checks the message version.
- Checks whether request_id is a valid UUID.
- Checks whether the timestamp is valid ISO 8601 with an explicit timezone.
- Checks whether the action is sensor.measurement.
- Checks whether the device ID is valid.
- Checks whether payloads is a valid JSON object.
- Allows between 1 and 16 sensor payloads.
- Checks whether sensor keys are unique.
- Checks whether sensor names and units are valid.
- Checks whether measurement values are numbers or numeric strings.
- Rejects non-finite values.
- Rejects values exceeding the supported SQL decimal range.
- Rejects values with more than 3 decimal places.
- Converts the timestamp to UTC.
- Returns a validated and normalized message or an error object.
- Uses UUID_PATTERN, MAX_MEASUREMENTS and MAX_VALUE.

- measurementsRoute(req, res, env, url)

- Handles requests to /measurements, /sensor and /demo/measurements.
- Uses these parameters:
  - req: incoming HTTP request.
  - res: HTTP response.
  - env: Cloudflare environment.
  - url: parsed request URL.
- Uses requireTokenHash() to require gateway authentication.
- Handles GET requests:
  - Reads the optional device_id query parameter.
  - Reads the optional limit query parameter.
  - Checks whether the limit is between 1 and 100.
  - Uses callBridge() with the measurement.list action.
- Handles POST requests:
  - Checks the Content-Type header.
  - Uses readJsonBody() to read the request body.
  - Uses validateMessage() to validate the measurement data.
  - Uses callBridge() with the measurement.create action.
- Returns the result received from Azure.
- Rejects unsupported HTTP methods.

## **api/sensor.js**

- sensorRoute

- Re-exports measurementsRoute() under the name sensorRoute.
- Provides compatibility with existing /sensor clients.
- Uses the same request format and processing logic as /measurements.
- Does not implement a separate function.

## **database/d1-connection.js**

- getDatabase(env)

- Retrieves the configured D1 database binding.
- Uses these parameters:
  - env: Cloudflare environment.
- Checks whether env.random_access_memory exists.
- Throws an error if the database binding is missing.
- Returns the database binding.

## **database/d1.js**

- registerRequest(db, requestId, deviceId)

- Registers a processed request in the D1 database.
- Uses these parameters:
  - db: D1 database connection.
  - requestId: unique request identifier.
  - deviceId: ID of the device that sent the request.
- Deletes expired entries from processed_requests.
- Attempts to insert the new request.
- Uses INSERT OR IGNORE to prevent duplicate request IDs.
- Sets the expiration time to one hour after registration.
- Returns whether the request was registered or already existed.

## **migrations/ratelimiter.js**

- checkRateLimit(req, res, env)

- Checks whether an incoming request exceeds its rate limits.
- Uses these parameters:
  - req: incoming HTTP request.
  - res: HTTP response.
  - env: Cloudflare environment.
- Checks whether the Cloudflare rate limiter is configured.
- Retrieves the request's source IP address.
- Creates a rate-limit key based on the IP address.
- Uses Cloudflare's API_RATE_LIMITER.limit() to check the IP limit.
- Retrieves the gateway token using getGatewayToken().
- Hashes the gateway token using hashToken().
- Creates a separate rate-limit key for the gateway.
- Checks the gateway rate limit.
- Returns true if both checks pass.
- Returns false if a limit is exceeded or the rate limiter fails.
- Sends HTTP 429 when a rate limit is exceeded.
- Sends HTTP 503 when the rate limiter is unavailable.
- Uses Cloudflare's configured limit of 60 requests per 60 seconds.