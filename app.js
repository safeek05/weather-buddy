// ====== CONFIG ======
const BASE_URL = "https://janise-inhabited-amber.ngrok-free.dev";
const ENDPOINT = "predict"; 
const API_URL = `${BASE_URL}/${ENDPOINT}`;

// ====== ELEMENTS ======
const form = document.getElementById("query-form");
const locationEl = document.getElementById("location");
const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");

const resultGrid = document.getElementById("resultGrid");
const emptyState = document.getElementById("emptyState");
const loader = document.getElementById("loader");
const toast = document.getElementById("toast");

const summaryBadge = document.getElementById("summaryBadge");
const summaryText = document.getElementById("summaryText");
const chips = document.getElementById("chips");
const details = document.getElementById("details");
const timeline = document.getElementById("timeline");

document.getElementById("clearBtn").addEventListener("click", () => {
  form.reset();
  hideResults();
});
document.getElementById("mockToggle").addEventListener("change", (e) => {
  USE_MOCK = e.target.checked;
  ping(`Mock data ${USE_MOCK ? "enabled" : "disabled"}.`);
});
document.getElementById("year").textContent = new Date().getFullYear();

// Pre-fill date/time with "now"
(function presetNow(){
  const now = new Date();
  dateEl.value = now.toISOString().slice(0,10);
  timeEl.value = now.toTimeString().slice(0,5);
})();

// ====== HELPERS ======
function show(el){ el.hidden = false; }
function hide(el){ el.hidden = true; }
function showLoader(){ hide(emptyState); hide(resultGrid); show(loader); }
function hideLoader(){ hide(loader); }
function showResults(){ hide(loader); hide(emptyState); show(resultGrid); }
function hideResults(){ hide(loader); show(emptyState); hide(resultGrid); }

function ping(msg, timeout=2200){
  toast.textContent = msg;
  show(toast);
  setTimeout(()=> hide(toast), timeout);
}

function classifyBadge(overall){
  if(!overall) return {text:"—", cls:""};
  const lvl = overall.toLowerCase();
  if(lvl.includes("low")) return {text:"LOW RISK", cls:"ok"};
  if(lvl.includes("moderate")) return {text:"MODERATE", cls:"warn"};
  return {text:"HIGH RISK", cls:"bad"};
}

// Small HTML builders
function chip(label, value){ return `<span class="chip">${label}: <strong>${value}</strong></span>`; }
function row(label, value){ return `<div class="detail-row"><span class="label">${label}</span><span class="value">${value}</span></div>`; }
function tile(hour){
  return `<div class="tile">
    <div class="t-time">${hour.time}</div>
    <div class="t-main">${hour.temp} • ${hour.summary}</div>
    <div class="t-sub">Rain: ${hour.rain}% · Wind: ${hour.wind} km/h</div>
  </div>`;
}

function toISO(dateStr, timeStr){
  return new Date(`${dateStr}T${timeStr}:00`);
}

// ====== MOCK DATA ======
function mockResponse(loc, iso){
  return {
    overall: "Moderate",
    summary: `Mock forecast for ${loc} at ${iso.toLocaleString()}`,
    risks: { heat:"Low", cold:"Low", wind:"Moderate", rain:"Moderate", comfort:"Moderate" },
    metrics: { temperature:"28°C", humidity:"62%", wind:"12 km/h", precipitation:"40%", uv_index:"6", visibility:"9 km" },
    hours: [
      { time:"10:00", temp:"28°C", summary:"Clear", rain:20, wind:8 },
      { time:"11:00", temp:"30°C", summary:"Cloudy", rain:35, wind:10 },
      { time:"12:00", temp:"31°C", summary:"Rainy", rain:60, wind:14 }
    ]
  };
}

// ====== RENDER ======
function render(data){
  const b = classifyBadge(data.overall);
  summaryBadge.textContent = b.text;
  summaryBadge.className = `badge ${b.cls}`;

  summaryText.textContent = data.summary || "—";
  chips.innerHTML = [
    chip("Heat", data.risks?.heat ?? "—"),
    chip("Cold", data.risks?.cold ?? "—"),
    chip("Wind", data.risks?.wind ?? "—"),
    chip("Rain", data.risks?.rain ?? "—"),
    chip("Comfort", data.risks?.comfort ?? "—"),
  ].join("");

  details.innerHTML = [
    row("Temperature", data.metrics?.temperature ?? "—"),
    row("Humidity", data.metrics?.humidity ?? "—"),
    row("Wind", data.metrics?.wind ?? "—"),
    row("Precipitation", data.metrics?.precipitation ?? "—"),
    row("UV Index", data.metrics?.uv_index ?? "—"),
    row("Visibility", data.metrics?.visibility ?? "—"),
  ].join("");

  timeline.innerHTML = (data.hours || []).map(tile).join("");

  showResults();
}

// ====== BACKEND ======
async function fetchFromBackend(loc, iso){
  const payload = {
    location: loc,
    date: iso.toISOString()
  };

  const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });

  if(!res.ok) throw new Error(`Backend ${res.status}: ${res.statusText}`);
  return res.json();
}

function normalizeData(d){
  // adjust if your backend keys differ
  return {
    overall: d.overall ?? "Moderate",
    summary: d.summary ?? "—",
    risks: d.risks ?? {},
    metrics: d.metrics ?? {},
    hours: d.hours ?? []
  };
}

// ====== EVENTS ======
form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const loc = locationEl.value.trim();
  if(!loc || !dateEl.value || !timeEl.value){
    ping("Please fill location, date and time."); return;
  }
  const iso = toISO(dateEl.value, timeEl.value);

  showLoader();
  try{
    const data = USE_MOCK ? mockResponse(loc, iso) : await fetchFromBackend(loc, iso);
    render(normalizeData(data));
  }catch(err){
    hideResults();
    ping(err.message || "Error");
    console.error(err);
  }finally{
    hideLoader();
  }

  // ==== ChatBuddy Logic ====
const chatBox = document.getElementById("chat-box");
const talkBtn = document.getElementById("talk-btn");

let listening = false;

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.onstart = () => {
  listening = true;
  talkBtn.textContent = "🎙️ Listening...";
};

recognition.onend = () => {
  listening = false;
  talkBtn.textContent = "🎙️ Talk to Buddy";
};

recognition.onresult = (event) => {
  const userText = event.results[0][0].transcript;
  addMessage("user", userText);
  respondToUser(userText);
};

// Add message to chat
function addMessage(from, text) {
  const msg = document.createElement("div");
  msg.className = `message ${from}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// AI Buddy Replies
function respondToUser(input) {
  const text = input.toLowerCase();
  let reply = "Hmm, I didn't catch that 🤔";

  if (text.includes("hi") || text.includes("hello")) {
    reply = "Hii there! 🌞 Ready for a weather adventure?";
  } else if (text.includes("weather tip") || text.includes("tip")) {
    reply = "Sure! 🌦️ Always check the UV index before heading out — sunscreen saves skin!";
  } else if (text.includes("how is the weather") || text.includes("weather today")) {
    reply = "Let me guess... it's either sunny, rainy, or confusing! 😄 But always good to check your local forecast!";
  } else if (text.includes("rain")) {
    reply = "Looks like puddle season ☔ — grab your boots and umbrella!";
  } else if (text.includes("hot") || text.includes("heat")) {
    reply = "Stay cool 😎 and hydrated — wear light clothes and sip water often!";
  } else if (text.includes("cold") || text.includes("chilly")) {
    reply = "Brrr 🧣! Layer up and keep warm with a cozy drink!";
  } else if (text.includes("bye")) {
    reply = "Catch you later! 🌈 Stay weather-wise!";
  }

  addMessage("buddy", reply);
  speak(reply);
}

// Speech Synthesis
function speak(text) {
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  synth.speak(utter);
}

// Start listening when button clicked
talkBtn.addEventListener("click", () => {
  recognition.start();
});

});
