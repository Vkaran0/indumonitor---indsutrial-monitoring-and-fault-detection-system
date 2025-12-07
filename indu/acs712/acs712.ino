#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

#define ACS_PIN 34
#define RELAY_PIN 23   // Relay control pin

// ---- WiFi ----
const char* ssid = "Cc";
const char* password = "Kshitij0";

// ---- Supabase ----
String SUPABASE_URL = "https://noyfimgffaccelemollp.supabase.co/rest/v1/readings";
String API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWZpbWdmZmFjY2VsZW1vbGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDM1NTMsImV4cCI6MjA4MDA3OTU1M30.xhjHnWFpLxpFVnMStu2kveN4Ch_qtabNT5FUIIAJw7o";

// ---- ACS712 Values ----
float sensitivity = 0.185;
float offset = 2.265;
float threshold = 0.40;

// ---- NTP (IST Time) ----
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;  // IST = UTC +5:30
const int daylightOffset_sec = 0;

void setup() {

  // --- IMPORTANT: Give ESP32 time to boot properly ---
  delay(2000);

  Serial.begin(115200);

  // ---- Prevent relay floating on boot ----
  pinMode(RELAY_PIN, INPUT_PULLUP);
  delay(100);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);  // Default OFF

  // ---- ADC Setup ----
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // ---- WiFi Connect ----
  WiFi.begin(ssid, password);
  delay(1000);  // USB power stabilization

  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  // ---- NTP SYNC ----
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  Serial.println("Waiting for NTP...");
  time_t now = time(nullptr);

  while (now < 1000000000) {     // if time < ~Sat Sep 09 2001, means NOT synced
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }

  Serial.println("\nNTP Time Set!");
  Serial.println(ctime(&now));
}

// -----------------------
// READ CURRENT
// -----------------------
float readCurrent() {
  long sum = 0;
  for (int i = 0; i < 800; i++) {
    sum += analogRead(ACS_PIN);
  }

  float avg = sum / 800.0;
  float voltage = (avg / 4095.0) * 3.3;
  float current = (voltage - offset) / sensitivity;

  return abs(current);
}

// -----------------------
// SIMULATED VOLTAGE
// -----------------------
float simulateVoltage(float current) {
  if (current < threshold) return 0;

  if (current < 0.5)
    return 228 + random(-2, 3);

  if (current < 1.5)
    return 220 + random(-3, 4);

  return 210 + random(-4, 5);
}

// -----------------------
// SEND DATA TO SUPABASE
// -----------------------
void sendToSupabase(float current, float voltage) {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected!");
    return;
  }

  HTTPClient http;
  http.begin(SUPABASE_URL);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + API_KEY);
  http.addHeader("Prefer", "return=minimal");

  // Do NOT send timestamp → Supabase auto now()
  String json = "{\"current\":" + String(current, 3) +
                ",\"voltage\":" + String(voltage, 2) + "}";

  int code = http.POST(json);
  Serial.print("Supabase Response: ");
  Serial.println(code);

  http.end();
}

// -----------------------
// FETCH RELAY STATUS
// -----------------------
String fetchRelayStatus() {
  if (WiFi.status() != WL_CONNECTED) return "normal";

  HTTPClient http;

  String url = "https://noyfimgffaccelemollp.supabase.co/rest/v1/relay_status?select=status&id=eq.1";

  http.begin(url);
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + API_KEY);

  int code = http.GET();

  if (code == 200) {
    String res = http.getString();
    Serial.println("Relay Status Response: " + res);

    if (res.indexOf("fault") != -1) return "fault";
    else return "normal";
  }

  http.end();
  return "normal";
}

// -----------------------
// MAIN LOOP
// -----------------------
void loop() {

  float current = readCurrent();
  float voltage = simulateVoltage(current);

  // ---- FILTER SMALL CURRENT ----
  float displayCurrent = current;
  float displayVoltage = voltage;

  if (current < 0.45) {
    displayCurrent = 0.00;
    displayVoltage = 0.00;
  }

  Serial.print("Current: ");
  Serial.print(displayCurrent);
  Serial.print(" A | Voltage: ");
  Serial.println(displayVoltage);

  // ---- UPLOAD ----
  sendToSupabase(displayCurrent, displayVoltage);

  // ---- RELAY LOGIC ----
  String status = fetchRelayStatus();

  if (status == "fault") {
    digitalWrite(RELAY_PIN, HIGH);  // OFF
    Serial.println("FAULT → Relay OFF (Machine STOP)");
  } 
  else {
    digitalWrite(RELAY_PIN, LOW);   // ON
    Serial.println("NORMAL → Relay ON (Machine RUNNING)");
  }

  delay(2000);
}
