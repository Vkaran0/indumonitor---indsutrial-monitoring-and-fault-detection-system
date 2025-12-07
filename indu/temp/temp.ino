/* 
  Combined sensors -> ESP32 -> Supabase
  Sensors:
   - DHT11 (temp, humidity)
   - HW477 (Magnet / Hall digital)
   - MQ135 (ADC raw)
   - MH Flying Fish IR (object present digital)
   - BMP280 (pressure)
   - HW-072 Fire Sensor (digital)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <time.h>

#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include "DHT.h"

// ---------------- Configuration ----------------
const char* WIFI_SSID = "Cc";
const char* WIFI_PASS = "Kshitij0";

// Supabase config
String SUPABASE_URL = "https://noyfimgffaccelemollp.supabase.co";
String SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWZpbWdmZmFjY2VsZW1vbGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDM1NTMsImV4cCI6MjA4MDA3OTU1M30.xhjHnWFpLxpFVnMStu2kveN4Ch_qtabNT5FUIIAJw7o";

// REST table endpoints
String TBL_DHT11   = "/rest/v1/dht11_readings";
String TBL_HW477   = "/rest/v1/hall_readings";
String TBL_MQ135   = "/rest/v1/mq135_readings";
String TBL_IR      = "/rest/v1/ir_readings";
String TBL_BMP280  = "/rest/v1/bmp280_readings";
String TBL_FIRE    = "/rest/v1/fire_readings";   // NEW

// Pins
#define DHT_PIN    14
#define DHT_TYPE   DHT11
#define HALL_PIN   26
#define MQ135_PIN  34
#define IR_PIN     27
#define SDA_PIN    21
#define SCL_PIN    22
#define FIRE_PIN   25   // NEW: HW-072 fire sensor DO pin

// Timing
const unsigned long SEND_INTERVAL_MS = 10000;
unsigned long lastSendTime = 0;

// Objects
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;

// ---------------- WiFi ----------------
void connectWiFi() {
  Serial.print("Connecting to WiFi ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 60) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

// ---------------- Supabase POST ----------------
int supabasePost(String tableEndpoint, String jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  HTTPClient http;
  String url = SUPABASE_URL + tableEndpoint;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_API_KEY);
  http.addHeader("Authorization", "Bearer " + SUPABASE_API_KEY);
  http.addHeader("Prefer", "return=minimal");

  int code = http.POST(jsonPayload);
  http.end();
  return code;
}

// ---------------- Time Function ----------------
String getTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "1970-01-01 00:00:00"; // fallback
  }

  char buffer[40];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buffer);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(HALL_PIN, INPUT);
  pinMode(IR_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
  pinMode(FIRE_PIN, INPUT);   // NEW

  analogReadResolution(12);

  dht.begin();

  Wire.begin(SDA_PIN, SCL_PIN);
  if (!bmp.begin()) Serial.println("BMP280 init failed.");
  else Serial.println("BMP280 OK");

  connectWiFi();

  // ---------------- NTP Time (IST = UTC+5:30) ----------------
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov");

  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.println("Waiting for NTP time...");
    delay(500);
  }
  Serial.println("Time synced successfully!");
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;

    String timestamp = getTimestamp();

    // ----------- Read Sensors -----------
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    int hallState = digitalRead(HALL_PIN);
    int magnetPresent = hallState == HIGH ? 1 : 0;

    int mqAdc = analogRead(MQ135_PIN);
    float mqVoltage = (mqAdc * 3.3) / 4095.0;

    int irState = digitalRead(IR_PIN);
    int objectPresent = irState == LOW ? 1 : 0;

    float pressure_hPa = bmp.readPressure() / 100.0F;

    // NEW: Fire sensor (correct logic)
    int fireRaw = digitalRead(FIRE_PIN);
    int fireDetected = (fireRaw == HIGH) ? 1 : 0;

    Serial.println("------ READINGS ------");
    Serial.println("Time: " + timestamp);
    Serial.printf("Temp: %.2f°C\n", temperature);
    Serial.printf("Humidity: %.2f%%\n", humidity);
    Serial.printf("Hall: %d\n", magnetPresent);
    Serial.printf("MQ135: %d | %.3f V\n", mqAdc, mqVoltage);
    Serial.printf("IR Present: %d\n", objectPresent);
    Serial.printf("Pressure: %.2f hPa\n", pressure_hPa);
    Serial.printf("Fire Detected: %d (raw=%d)\n", fireDetected, fireRaw);
    
    // ----------- POST to Supabase -----------

    // DHT11
    if (!isnan(temperature) && !isnan(humidity)) {
      String json = 
      "{\"temperature\":" + String(temperature,2) +
      ",\"humidity\":" + String(humidity,2) +
      ",\"created_at\":\"" + timestamp + "\"}";
      supabasePost(TBL_DHT11, json);
    }

    // Hall sensor
    {
      String json = 
      "{\"magnet_present\":" + String(magnetPresent) +
      ",\"created_at\":\"" + timestamp + "\"}";
      supabasePost(TBL_HW477, json);
    }

    // MQ135
    {
      String json =
      "{\"adc_value\":" + String(mqAdc) +
      ",\"voltage\":" + String(mqVoltage,3) +
      ",\"created_at\":\"" + timestamp + "\"}";
      supabasePost(TBL_MQ135, json);
    }

    // IR
    {
      String json = 
      "{\"object_present\":" + String(objectPresent) +
      ",\"created_at\":\"" + timestamp + "\"}";
      supabasePost(TBL_IR, json);
    }

    // BMP280
    {
      String json = 
      "{\"pressure_hpa\":" + String(pressure_hPa,2) +
      ",\"created_at\":\"" + timestamp + "\"}";
      supabasePost(TBL_BMP280, json);
    }

    // FIRE SENSOR
    {
      String json =
      "{\"fire_detected\":" + String(fireDetected) +
      ",\"raw_value\":" + String(fireRaw) +
      ",\"created_at\":\"" + timestamp + "\"}";
      supabasePost(TBL_FIRE, json);
    }

    Serial.println("All POSTs done.\n");
  }

  delay(50);
}
