# MITM Server

Cloudflare Worker between the Raspberry Pi Gateway and the Azure MSSQL server.

## How does it work?

### Sending measurements to MITM

Send a request to `/api/sensor-data` using **POST**.

**HTTP Headers**
```http
Authorization: Bearer <GATEWAY_TOKEN>
Content-Type: application/json
```

**Request Body**
```json
{
    "request_id": "<REQUEST_ID>",
    "timestamp": "<TIMESTAMP>",
    "device": {
        "id": "<DEVICE_ID>"
    },
    "measurements": [
        {
            "sensor_key": "light",
            "value": "<LIGHT_VALUE>",
            "unit": "raw"
        },
        {
            "sensor_key": "draaiknop",
            "value": "<KNOB_VALUE>",
            "unit": "raw"
        }
    ]
}
```

### Receiving measurements from MITM

Send a request to the measurements endpoint using **POST**.

**HTTP Headers**
```http
Authorization: Bearer <GATEWAY_TOKEN>
Content-Type: application/json
```

**Request Body**
```json
{
    "device_id": "<DEVICE_ID>",
    "limit": 50
}
```

## What are the placeholders?

**Parameters**

- `<GATEWAY_TOKEN>`: Authentication token of the Raspberry Pi Gateway.
- `<REQUEST_ID>`: Unique UUID identifying the measurement request.
- `<TIMESTAMP>`: Measurement timestamp in ISO 8601 format.
- `<DEVICE_ID>`: Registered device ID.
- `<LIGHT_VALUE>`: Measured light sensor value.
- `<KNOB_VALUE>`: Measured rotary knob value.
- `<LIMIT>`: Maximum number of measurements to retrieve (1-100).

**Measurement fields**

- `sensor_key`: Identifier of the sensor. For example, `light` or `draaiknop`.
- `value`: Numeric sensor reading.
- `unit`: Measurement unit configured for the sensor. Must match the registered sensor configuration.

**Notes**

- The MITM authenticates the gateway using the Bearer token.
- The gateway token is hashed before being forwarded to the Azure DB Bridge.
- The Azure Function key is handled by the MITM and is not required in gateway requests.
- Each `request_id` should be unique to prevent duplicate measurements.
