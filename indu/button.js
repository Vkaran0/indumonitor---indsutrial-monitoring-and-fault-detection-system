const client = supabase.createClient(
 "https://noyfimgffaccelemollp.supabase.co",
 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWZpbWdmZmFjY2VsZW1vbGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDM1NTMsImV4cCI6MjA4MDA3OTU1M30.xhjHnWFpLxpFVnMStu2kveN4Ch_qtabNT5FUIIAJw7o"
);

let thresholds = {};
let lastErrorReasons = [];
let currentRelayStatus = "normal";
let faultMode = "idle"; // idle → fault → hold

/* --------------------- UI Helpers --------------------- */
function setText(id, value) {
  let el = document.getElementById(id);
  if (el) el.textContent = value;
}

function scrollToError() {
  document.getElementById("errorSection").scrollIntoView({ behavior:"smooth" });
}

function updateErrorUI(isFault) {
  let btn = document.getElementById("errorNavButton");
  let badge = document.getElementById("relayStatusBadge");

  if (isFault) {
    btn.style.display = "inline-block";
    badge.textContent = "FAULT";
    badge.className = "badge badge-fault";
    setText("navSystemState","System: FAULT");
    setText("systemStatusLabel","FAULT");
  } else {
    btn.style.display = "none";
    badge.textContent = "NORMAL";
    badge.className = "badge badge-normal";
    setText("navSystemState","System: NORMAL");
    setText("systemStatusLabel","NORMAL");
  }
}

function renderErrorReasons() {
  let ul = document.getElementById("errorReasonList");
  ul.innerHTML = "";
  if (lastErrorReasons.length === 0) {
    ul.innerHTML = "<li>No active fault</li>";
    return;
  }
  lastErrorReasons.forEach(r => {
    let li = document.createElement("li");
    li.textContent = r;
    ul.appendChild(li);
  });
}


/* --------------------- Auto Threshold from Power Rating --------------------- */
function autoSetThresholds() {
  let W = parseFloat(document.getElementById("machinePowerInput").value);

  if (isNaN(W) || W <= 0) {
    document.getElementById("autoSetMsg").textContent = "Enter valid watt rating.";
    return;
  }

  // Auto formulas
  let ratedCurrent = W / 230;
  let maxCurrent = ratedCurrent * 1.30;
  let maxVoltage = 250;
  let maxTemp = 65;
  let maxHumidity = 85;
  let fireTh = 0;
  let mq135Th = 600;

  // Fill fields
  document.getElementById("th_current").value = maxCurrent.toFixed(1);
  document.getElementById("th_voltage").value = maxVoltage;
  document.getElementById("th_temperature").value = maxTemp;
  document.getElementById("th_humidity").value = maxHumidity;
  document.getElementById("th_fire").value = fireTh;
  document.getElementById("th_mq135").value = mq135Th;

  document.getElementById("autoSetMsg").textContent =
    "Thresholds updated based on machine rating!";
}


/* --------------------- Threshold Load/Save --------------------- */
async function loadThresholds() {
  setText("thresholdMessage","Loading thresholds...");

  const { data } = await client.from("thresholds").select("*");

  data.forEach(row => thresholds[row.sensor_name] = row.threshold);

  for (let key of ["temperature","humidity","current","voltage","fire","mq135"]) {
    let el = document.getElementById("th_"+key);
    if (el) el.value = thresholds[key];
  }

  setText("thresholdMessage","Thresholds loaded.");
}

async function saveThresholds() {
  let names = ["temperature","humidity","current","voltage","fire","mq135"];
  let payload = [];

  names.forEach(name=>{
    let el = document.getElementById("th_"+name);
    let v = parseFloat(el.value);
    if (!isNaN(v)) {
      payload.push({ sensor_name:name, threshold:v });
      thresholds[name] = v;
    }
  });

  await client.from("thresholds").upsert(payload, { onConflict:"sensor_name" });
  setText("thresholdMessage","Thresholds saved.");
}


/* --------------------- Fault Mode Load/Save --------------------- */
async function loadFaultMode() {
  let { data } = await client
    .from("system_state")
    .select("*")
    .eq("key","fault_mode")
    .maybeSingle();

  if (!data) {
    await client.from("system_state").insert({ key:"fault_mode", value:"idle" });
    faultMode = "idle";
  } else {
    faultMode = data.value || "idle";
  }
}

async function setFaultMode(m) {
  faultMode = m;
  await client.from("system_state")
    .upsert({ key:"fault_mode", value:m });
}


/* --------------------- Relay & RF --------------------- */
async function loadRelayRF() {
  let relay = await client.from("relay_status").select("*").eq("id",1).single();
  let rf = await client.from("rf_channel_control").select("*").eq("id",1).single();

  if (relay.data) {
    currentRelayStatus = relay.data.status;
    setText("relayStatusText", relay.data.status.toUpperCase());
    updateErrorUI(relay.data.status === "fault");
  }

  if (rf.data) setText("rfChannelText", rf.data.channel);
}

async function forceRelay(state) {
  await client.from("relay_status").update({status:state}).eq("id",1);
  currentRelayStatus = state;
  updateErrorUI(state === "fault");
  setText("relayStatusText", state.toUpperCase());
}

async function updateRFChannel() {
  let val = parseInt(document.getElementById("rfChannelInput").value);
  if (isNaN(val)) return alert("Invalid channel");
  await client.from("rf_channel_control").update({channel:val}).eq("id",1);
  setText("rfChannelText", val);
}


/* --------------------- Fault Logic --------------------- */
async function evaluateFault(snapshot) {
  let r = [];

  if (snapshot.temperature > thresholds.temperature)
    r.push(`Temperature ${snapshot.temperature} > ${thresholds.temperature}`);

  if (snapshot.current > thresholds.current)
    r.push(`Current ${snapshot.current} > ${thresholds.current}`);

  if (snapshot.voltage > thresholds.voltage)
    r.push(`Voltage ${snapshot.voltage} > ${thresholds.voltage}`);

  if (snapshot.fire > thresholds.fire)
    r.push(`Fire detected (${snapshot.fire})`);

  if (snapshot.mq135 > thresholds.mq135)
    r.push(`MQ135 ${snapshot.mq135} > ${thresholds.mq135}`);

  let cross = r.length > 0;

  if (faultMode === "idle") {
    if (cross) {
      lastErrorReasons = r;
      renderErrorReasons();
      await forceFault();
    }
  }

  else if (faultMode === "fault") {
    if (cross) {
      lastErrorReasons = r;
      renderErrorReasons();
    }
  }

  else if (faultMode === "hold") {
    if (!cross) {
      await setFaultMode("idle");
    }
  }
}

async function forceFault() {
  await client.from("relay_status").update({status:"fault"}).eq("id",1);
  currentRelayStatus = "fault";
  updateErrorUI(true);
  await setFaultMode("fault");
}


/* --------------------- Clear Fault --------------------- */
async function clearFault() {
  await client.from("relay_status").update({status:"normal"}).eq("id",1);
  currentRelayStatus = "normal";
  updateErrorUI(false);
  lastErrorReasons = [];
  renderErrorReasons();
  await setFaultMode("hold");
}


/* --------------------- Live Sensor Fetch --------------------- */
async function loadLiveData() {
  let [dht, fire, hall, ir, mq, iv] = await Promise.all([
    client.from("dht11_readings").select("*").order("created_at",{ascending:false}).limit(1),
    client.from("fire_readings").select("*").order("created_at",{ascending:false}).limit(1),
    client.from("hall_readings").select("*").order("created_at",{ascending:false}).limit(1),
    client.from("ir_readings").select("*").order("created_at",{ascending:false}).limit(1),
    client.from("mq135_readings").select("*").order("created_at",{ascending:false}).limit(1),
    client.from("readings").select("*").order("created_at",{ascending:false}).limit(1)
  ]);

  let t = dht.data?.[0]?.temperature ?? "--";
  let h = dht.data?.[0]?.humidity ?? "--";
  let A = iv.data?.[0]?.current ?? "--";
  let V = iv.data?.[0]?.voltage ?? "--";
  let F = fire.data?.[0]?.fire_detected ?? "--";
  let MQ = mq.data?.[0]?.adc_value ?? "--";
  let HL = hall.data?.[0]?.magnet_present ?? "--";
  let IR = ir.data?.[0]?.object_present ?? "--";

  setText("valTemperature", t);
  setText("valHumidity", h);
  setText("valCurrent", A);
  setText("valVoltage", V);
  setText("valFire", F);
  setText("valMQ135", MQ);
  setText("valHall", HL);
  setText("valIR", IR);

  if (t !== "--" && A !== "--") {
    await evaluateFault({
      temperature: parseFloat(t),
      humidity: parseFloat(h),
      current: parseFloat(A),
      voltage: parseFloat(V),
      fire: parseFloat(F),
      mq135: parseFloat(MQ)
    });
  }
}


/* --------------------- INIT --------------------- */
async function init() {
  await loadFaultMode();
  await loadThresholds();
  await loadRelayRF();
  await loadLiveData();

  setInterval(loadLiveData, 4000);
}

init();