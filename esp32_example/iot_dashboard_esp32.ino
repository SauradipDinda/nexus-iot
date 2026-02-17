/**
 * ============================================================
 * IoT Dashboard Platform - ESP32/ESP8266 Firmware Example
 * ============================================================
 * Compatible with: ESP32, ESP8266
 * Libraries required:
 *   - WiFi (built-in for ESP32) / ESP8266WiFi (for ESP8266)
 *   - HTTPClient (built-in)
 *   - ArduinoJson (install via Library Manager)
 *   - DHT sensor library (if using DHT11/DHT22)
 *
 * Install ArduinoJson: Sketch > Include Library > Manage Libraries > "ArduinoJson"
 * ============================================================
 */

#include <WiFi.h>           // Use <ESP8266WiFi.h> for ESP8266
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ─── Device Configuration (Get from IoT Dashboard) ───────────────────────────
#define TEMPLATE_ID   "TMPLxxxxxxxx"          // From Templates page
#define DEVICE_NAME   "My_ESP32_Sensor"       // Your device name
#define AUTH_TOKEN    "your_auth_token_here"  // From Device > Auth Token button

// ─── WiFi Configuration ───────────────────────────────────────────────────────
#define WIFI_SSID     "Your_WiFi_SSID"
#define WIFI_PASSWORD "Your_WiFi_Password"

// ─── Server Configuration ─────────────────────────────────────────────────────
#define SERVER_URL    "http://your-server-ip:5000"  // Your IoT Dashboard server
#define PUBLISH_URL   SERVER_URL "/api/data/publish"

// ─── Sensor Configuration ─────────────────────────────────────────────────────
#define DHT_PIN       4       // GPIO pin connected to DHT sensor
#define DHT_TYPE      DHT22   // DHT11 or DHT22
#define GAS_PIN       34      // Analog pin for MQ-2 gas sensor
#define SMOKE_PIN     35      // Analog pin for smoke sensor
#define LED_PIN       2       // Built-in LED

// ─── Timing ───────────────────────────────────────────────────────────────────
#define PUBLISH_INTERVAL  10000   // Publish every 10 seconds (10000 ms)
#define WIFI_RETRY_DELAY  5000    // WiFi retry delay

// ─── Global Objects ───────────────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastPublishTime = 0;
bool wifiConnected = false;

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n╔══════════════════════════════════╗");
  Serial.println("║   IoT Dashboard - ESP32 Client   ║");
  Serial.println("╚══════════════════════════════════╝");
  Serial.printf("Template ID: %s\n", TEMPLATE_ID);
  Serial.printf("Device Name: %s\n", DEVICE_NAME);

  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize DHT sensor
  dht.begin();

  // Connect to WiFi
  connectWiFi();
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectWiFi();
    return;
  }

  // Publish data at interval
  unsigned long now = millis();
  if (now - lastPublishTime >= PUBLISH_INTERVAL) {
    lastPublishTime = now;
    readAndPublishSensors();
  }
}

// ─── WiFi Connection ──────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("\nConnecting to WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected!");
    Serial.printf("  IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  Signal: %d dBm\n", WiFi.RSSI());
    digitalWrite(LED_PIN, HIGH);
    wifiConnected = true;
  } else {
    Serial.println("\n✗ WiFi connection failed. Retrying in 5s...");
    delay(WIFI_RETRY_DELAY);
  }
}

// ─── Read Sensors & Publish ───────────────────────────────────────────────────
void readAndPublishSensors() {
  // Read DHT22 sensor
  float temperature = dht.readTemperature();  // Celsius
  float humidity    = dht.readHumidity();

  // Check for DHT read errors
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("⚠ DHT sensor read failed! Using fallback values.");
    temperature = 25.0 + random(-50, 50) / 10.0;  // Simulated fallback
    humidity    = 60.0 + random(-100, 100) / 10.0;
  }

  // Read analog sensors (0-4095 for ESP32 12-bit ADC)
  int gasRaw   = analogRead(GAS_PIN);
  int smokeRaw = analogRead(SMOKE_PIN);

  // Convert to meaningful values (calibrate for your sensor)
  float gasPPM   = map(gasRaw, 0, 4095, 0, 1000);    // 0-1000 ppm
  float smokePPM = map(smokeRaw, 0, 4095, 0, 500);   // 0-500 ppm

  // Calculate carbon emission index (simplified formula)
  float carbonEmission = (gasPPM * 0.5) + (smokePPM * 0.3);

  // Print to Serial Monitor
  Serial.println("\n─── Sensor Readings ───────────────");
  Serial.printf("  V0 Temperature:    %.1f °C\n", temperature);
  Serial.printf("  V1 Humidity:       %.1f %%\n", humidity);
  Serial.printf("  V2 Gas (MQ-2):     %.0f ppm\n", gasPPM);
  Serial.printf("  V3 Smoke:          %.0f ppm\n", smokePPM);
  Serial.printf("  V4 Carbon Emission: %.1f\n", carbonEmission);
  Serial.println("───────────────────────────────────");

  // Build JSON payload
  StaticJsonDocument<512> doc;
  doc["template_id"] = TEMPLATE_ID;
  doc["auth_token"]  = AUTH_TOKEN;
  doc["device_id"]   = DEVICE_NAME;

  JsonObject pins = doc.createNestedObject("virtual_pins");
  pins["V0"] = round(temperature * 10) / 10.0;
  pins["V1"] = round(humidity * 10) / 10.0;
  pins["V2"] = (int)gasPPM;
  pins["V3"] = (int)smokePPM;
  pins["V4"] = round(carbonEmission * 10) / 10.0;

  // Serialize JSON
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // Send HTTP POST request
  publishData(jsonPayload);
}

// ─── HTTP Publish ─────────────────────────────────────────────────────────────
void publishData(String jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✗ Cannot publish: WiFi not connected");
    return;
  }

  HTTPClient http;
  http.begin(PUBLISH_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);  // 10 second timeout

  Serial.printf("→ Publishing to %s\n", PUBLISH_URL);

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    String response = http.getString();
    if (httpCode == 200 || httpCode == 201) {
      Serial.printf("✓ Published successfully (HTTP %d)\n", httpCode);
      // Blink LED to indicate successful publish
      blinkLED(2, 100);
    } else {
      Serial.printf("⚠ Server returned HTTP %d: %s\n", httpCode, response.c_str());
    }
  } else {
    Serial.printf("✗ HTTP request failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ─── LED Blink Helper ─────────────────────────────────────────────────────────
void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
  }
}

/*
 * ============================================================
 * VIRTUAL PIN MAPPING:
 * ─────────────────────────────────────────────────────────────
 * V0 → Temperature (°C)       - DHT22 sensor
 * V1 → Humidity (%)           - DHT22 sensor
 * V2 → Gas concentration (ppm) - MQ-2 sensor
 * V3 → Smoke level (ppm)      - Smoke sensor
 * V4 → Carbon emission index  - Calculated
 *
 * WIRING:
 * ─────────────────────────────────────────────────────────────
 * DHT22:
 *   VCC → 3.3V
 *   GND → GND
 *   DATA → GPIO 4 (with 10kΩ pull-up to 3.3V)
 *
 * MQ-2 Gas Sensor:
 *   VCC → 5V
 *   GND → GND
 *   AOUT → GPIO 34 (ADC1)
 *
 * Smoke Sensor:
 *   VCC → 5V
 *   GND → GND
 *   AOUT → GPIO 35 (ADC1)
 *
 * SETUP STEPS:
 * ─────────────────────────────────────────────────────────────
 * 1. Create a Template in the IoT Dashboard
 * 2. Register a Device using that Template
 * 3. Copy the AUTH_TOKEN from Device > Auth Token
 * 4. Add Virtual Pins V0-V4 in the Device Detail page
 * 5. Update TEMPLATE_ID, DEVICE_NAME, AUTH_TOKEN above
 * 6. Update WIFI_SSID and WIFI_PASSWORD
 * 7. Update SERVER_URL with your server's IP/domain
 * 8. Flash to ESP32 and monitor Serial output
 * ============================================================
 */
