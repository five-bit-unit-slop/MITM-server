# MITM Server

Cloudflare Worker between the Raspberry Pi Gateway and the Azure DB Bridge.

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
    "device": {
        "id": "<DEVICE_ID>"
    },
    "action": "<ACTION>",
    "payload": {
        "light": "<LIGHT_VALUE>",
        "knob": "<KNOB_VALUE>"
    }
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
    "limit": <LIMIT>
}
```

## What are the placeholders?

**Parameters**
- `<GATEWAY_TOKEN>`: Authentication token of the Raspberry Pi Gateway.
- `<DEVICE_ID>`: ID of the device.
- `<ACTION>`: Action to perform, for example `sensor.measurement`.
- `<LIGHT_VALUE>`: Measured light sensor value.
- `<KNOB_VALUE>`: Measured rotary knob value.
- `<LIMIT>`: Maximum number of measurements to retrieve.