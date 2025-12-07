#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include "esp_wifi.h"

// ======================================================
// ORIGINAL DEFINES
// ======================================================
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
float threshold = 0.50;

// ---- NTP Setting ----
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; // IST
const int daylightOffset_sec = 0;

// ======================================================
// NEW RF SYSTEM
// ======================================================
#define RF_LED 15
#define BUZZER_PIN 16
#define RED_LED_PIN 17

volatile int packetCount = 0;
int lastRFChannel = -1;

String RF_CONTROL_URL = "https://noyfimgffaccelemollp.supabase.co/rest/v1/rf_channel_control?id=eq.1&select=channel";
String RF_NOISE_URL   = "https://noyfimgffaccelemollp.supabase.co/rest/v1/rf_noise_log";

// 🔹 NEW: Voltage mode control URL
String VOLTAGE_MODE_URL = "https://noyfimgffaccelemollp.supabase.co/rest/v1/voltage_mode?id=eq.1&select=mode";

// ======================================================
// MACHINE USAGE TRACKING
// ======================================================
bool machineRunning = false;
time_t machineStart = 0;

// Convert time to Supabase-compatible ISO format
String formatTimeISO(time_t t) {
    struct tm *tm_info = localtime(&t);
    char buffer[32];
    strftime(buffer, 32, "%Y-%m-%dT%H:%M:%S", tm_info);
    return String(buffer);
}

// Upload Machine Usage (start → end)
void logMachineUsage(time_t startT, time_t endT) {
    HTTPClient http;
    http.begin("https://noyfimgffaccelemollp.supabase.co/rest/v1/machine_usage");

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + API_KEY);

    String payload =
        "{\"start_time\":\"" + formatTimeISO(startT) +
        "\",\"end_time\":\"" + formatTimeISO(endT) + "\"}";

    Serial.println("Payload → " + payload);

    int code = http.POST(payload);
    Serial.print("Machine Usage Log Response: ");
    Serial.println(code);

    http.end();
}

// ======================================================
// WIFI SNIFFER CALLBACK
// ======================================================
void rf_sniffer(void* buf, wifi_promiscuous_pkt_type_t type) {
    packetCount++;
}

// Measure RF Noise %
float measureRFNoise(int channel) {
    packetCount = 0;
    digitalWrite(RF_LED, HIGH);

    esp_wifi_set_promiscuous(false);
    esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_promiscuous_rx_cb(&rf_sniffer);

    delay(300);
    esp_wifi_set_promiscuous(false);

    digitalWrite(RF_LED, LOW);

    int pk = packetCount;

    if (pk > 300) return 100.0;
    if (pk > 150) return 80.0;
    if (pk > 80)  return 60.0;
    if (pk > 40)  return 40.0;
    if (pk > 10)  return 20.0;

    return 5.0;
}

// Fetch RF Channel
int fetchRFChannel() {
    HTTPClient http;
    http.begin(RF_CONTROL_URL);

    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + API_KEY);

    int code = http.GET();
    if (code != 200) {
        http.end();
        return -1;
    }

    String res = http.getString();
    http.end();

    res.replace("[", ""); res.replace("]", "");
    res.replace("{", ""); res.replace("}", "");
    res.replace("\"", ""); res.replace(" ", "");

    int pos = res.indexOf("channel:");
    if (pos == -1) return -1;

    String num = res.substring(pos + 8);
    return num.toInt();
}

// Upload RF Noise
void uploadRFNoise(int ch, float noise) {
    HTTPClient http;
    http.begin(RF_NOISE_URL);

    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + API_KEY);
    http.addHeader("Content-Type", "application/json");

    String body = "{\"channel\":"+String(ch)+",\"noise_percent\":"+String(noise,2)+"}";
    http.POST(body);
    http.end();
}

// 🔹 NEW: Fetch voltage mode from Supabase ("low" / "high")
String fetchVoltageMode() {
    if (WiFi.status() != WL_CONNECTED) return "high";  // default

    HTTPClient http;
    http.begin(VOLTAGE_MODE_URL);

    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + API_KEY);

    int code = http.GET();
    if (code != 200) {
        http.end();
        return "high";  // default
    }

    String res = http.getString();
    http.end();

    // simple parsing: check substring
    if (res.indexOf("low") != -1)  return "low";
    if (res.indexOf("high") != -1) return "high";

    return "high";
}

// ======================================================
// ORIGINAL CODE
// ======================================================
void setup() {

    delay(2000);
    Serial.begin(115200);

    pinMode(RELAY_PIN, INPUT_PULLUP);
    delay(100);
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, HIGH);

    pinMode(RF_LED, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);

    digitalWrite(RF_LED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);

    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);

    WiFi.begin(ssid, password);
    Serial.print("Connecting");

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nWiFi Connected!");

    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

    Serial.println("Waiting for NTP...");
    time_t now = time(nullptr);

    while (now < 1000000000) {
        delay(500);
        Serial.print(".");
        now = time(nullptr);
    }

    Serial.println("\nNTP Time Set!");
    Serial.println(ctime(&now));
}

float readCurrent() {
    long sum = 0;
    for (int i = 0; i < 800; i++) sum += analogRead(ACS_PIN);

    float avg = sum / 800.0;
    float voltage = (avg / 4095.0) * 3.3;
    float current = (voltage - offset) / sensitivity;

    return abs(current);
}

// 🔹 UPDATED: simulateVoltage → ab mode bhi lega
float simulateVoltage(float current, const String &mode) {
    // LOW MODE: 3–5V
    if (mode == "low") {
        // 3.00 to 4.99 V
        float v = 3.0 + (float)random(0, 200) / 100.0;
        return v;
    }

    // HIGH MODE (default): purana 220V wala logic
    if (current < threshold) return 0;
    if (current < 0.5) return 228 + random(-2, 3);
    if (current < 1.5) return 220 + random(-3, 4);
    return 210 + random(-4, 5);
}

void sendToSupabase(float current, float voltage) {

    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(SUPABASE_URL);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + API_KEY);
    http.addHeader("Prefer", "return=minimal");

    String json =
        "{\"current\":" + String(current, 3) +
        ",\"voltage\":" + String(voltage, 2) + "}";

    int code = http.POST(json);
    Serial.print("Supabase Response: ");
    Serial.println(code);

    http.end();
}

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
        if (res.indexOf("fault") != -1) return "fault";
    }

    http.end();
    return "normal";
}

// ======================================================
// MAIN LOOP
// ======================================================
void loop() {

    float current = readCurrent();

    // 🔹 NEW: DB se voltage mode lao
    String voltageMode = fetchVoltageMode();

    // 🔹 NEW: mode ke hisaab se voltage simulate
    float voltage = simulateVoltage(current, voltageMode);

    float displayCurrent = current;
    float displayVoltage = voltage;

    if (current < 0.45) {
        displayCurrent = 0.00;
        displayVoltage = 0.00;
    }

    Serial.print("Current: ");
    Serial.print(displayCurrent);
    Serial.print(" A | Voltage: ");
    Serial.print(displayVoltage);
    Serial.print(" V | Mode: ");
    Serial.println(voltageMode);

    sendToSupabase(displayCurrent, displayVoltage);

    // MACHINE USAGE
    if (displayCurrent > 0.45) {
        if (!machineRunning) {
            machineRunning = true;
            machineStart = time(nullptr);
            Serial.print("Machine Started → ");
            Serial.println(ctime(&machineStart));
        }
    }
    else {
        if (machineRunning) {
            machineRunning = false;

            time_t machineEnd = time(nullptr);
            Serial.print("Machine Stopped → ");
            Serial.println(ctime(&machineEnd));

            logMachineUsage(machineStart, machineEnd);
        }
    }

    // Relay Logic
    String status = fetchRelayStatus();

    if (status == "fault") {
        digitalWrite(RELAY_PIN, HIGH);
        digitalWrite(BUZZER_PIN, HIGH);
        digitalWrite(RED_LED_PIN, HIGH);
    }
    else {
        digitalWrite(RELAY_PIN, LOW);
        digitalWrite(BUZZER_PIN, LOW);
        digitalWrite(RED_LED_PIN, LOW);
    }

    // RF Logic
    int ch = fetchRFChannel();

    if (ch != -1 && ch != lastRFChannel) {
        float noise = measureRFNoise(ch);
        uploadRFNoise(ch, noise);
        lastRFChannel = ch;
    }

    delay(2000);
}
