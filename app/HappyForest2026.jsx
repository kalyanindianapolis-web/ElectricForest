import React, { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   HAPPY FOREST! — Electric Forest 2026 (Jun 25–28, Rothbury MI)
   Phase 1: Getting to the Forest + Sealed Prediction Vials
   ============================================================ */

const FEST = { label: "Jun 25–28, 2026", place: "Rothbury, MI" };

// Shared passcode the crew enters once per device. Change this to whatever you like.
const CAMP_CODE = "happyforest";
// Accept any permutation: "Happy Forest!", "HAPPYFOREST", "happy forest!!" all pass.
const normCode = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* --- Festival clock (anchored to Eastern Time so it's the same for everyone) --- */
// Day 1 begins Thursday Jun 25, 2026 12:00 AM ET (EDT = UTC-4) => Jun 25 04:00 UTC
const FOREST_START_UTC = Date.UTC(2026, 5, 25, 4, 0, 0);
// Campgrounds close ~Mon Jun 29 4:00 PM ET => Jun 29 20:00 UTC (end of the run)
const FOREST_END_UTC = Date.UTC(2026, 5, 29, 20, 0, 0);
// Vials crack open Sunday Jun 28, 2026 8:00 PM ET => Jun 29 00:00 UTC. (Change if you like.)
const VIAL_OPEN_UTC = Date.UTC(2026, 5, 29, 0, 0, 0);

// Lightweight PIN hashing — enough to keep plaintext out of the DB. Threat model is
// "don't let someone pick my name by accident", not a determined attacker.
const hashPin = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "p" + h.toString(36); };
const getPinHash = async (id) => { try { const r = await window.storage.get(`ef26:pin:${id}`, true); return r && r.value ? r.value : null; } catch { return null; } };
const setPinHash = async (id, pin) => { await window.storage.set(`ef26:pin:${id}`, hashPin(pin), true); };
const clearPin = async (id) => { try { await window.storage.delete(`ef26:pin:${id}`, true); } catch {} };

/* --- Vial seal: predictions are encrypted in the browser before they're stored,
       so the database (and its dashboard) only ever holds ciphertext. --- */
const _vsf = ["wodahsnoom", "forp", "62tserof"];
const SEAL_TAG = "sealed:v1:";
const _te = new TextEncoder(); const _td = new TextDecoder();
let _vkP = null;
function vialKey() {
  if (_vkP) return _vkP;
  const phrase = _vsf.map((s) => s.split("").reverse().join("")).join(":");
  _vkP = crypto.subtle.importKey("raw", _te.encode(phrase), "PBKDF2", false, ["deriveKey"])
    .then((base) => crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: _te.encode("ef26-vials"), iterations: 120000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]));
  return _vkP;
}
async function sealText(plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await vialKey(), _te.encode(plain)));
  const buf = new Uint8Array(iv.length + ct.length); buf.set(iv); buf.set(ct, iv.length);
  let bin = ""; buf.forEach((b) => { bin += String.fromCharCode(b); });
  return SEAL_TAG + btoa(bin);
}
async function unsealText(sealed) {
  try {
    const raw = atob(sealed.slice(SEAL_TAG.length));
    const buf = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, await vialKey(), buf.slice(12));
    return _td.decode(pt);
  } catch { return null; }
}
const isSealed = (s) => typeof s === "string" && s.indexOf(SEAL_TAG) === 0;

const ROSTER = [
  { id: "kalyan",  name: "Kalyan",  pair: "p1", partner: "Manasa",  g: "m" },
  { id: "manasa",  name: "Manasa",  pair: "p1", partner: "Kalyan",  g: "f" },
  { id: "anvesh",  name: "Anvesh",  pair: "p2", partner: "Shravya", g: "m" },
  { id: "shravya", name: "Shravya", pair: "p2", partner: "Anvesh",  g: "f" },
  { id: "pranith", name: "Pranith", pair: "p3", partner: "Bhavya",  g: "m" },
  { id: "bhavya",  name: "Bhavya",  pair: "p3", partner: "Pranith", g: "f" },
  { id: "sandy",   name: "Sandy",   pair: "p4", partner: "Ujwala",  g: "m" },
  { id: "ujwala",  name: "Ujwala",  pair: "p4", partner: "Sandy",   g: "f", local: true },
  { id: "andy",    name: "Andy",    pair: null, solo: true,         g: "m" },
  { id: "srikar",  name: "Srikar",  pair: null, solo: true,         g: "m" },
];
// Ladies first, then the gentlemen — used everywhere we list the crew.
const LADIES = ROSTER.filter((r) => r.g === "f");
const GUYS = ROSTER.filter((r) => r.g === "m");
const ORDER = [...LADIES, ...GUYS];
// Couples shown joined, lady on the left; solos stand on their own.
const PAIR_IDS = [...new Set(ROSTER.filter((r) => r.pair).map((r) => r.pair))];
const PAIRS = PAIR_IDS.map((pid) => {
  const mem = ROSTER.filter((r) => r.pair === pid);
  return [mem.find((m) => m.g === "f"), mem.find((m) => m.g === "m")].filter(Boolean);
});
const SOLO_ROSTER = ROSTER.filter((r) => r.solo);

const AVATAR_TYPES = ["fox","owl","deer","frog","wolf","bear","mushroom","firefly","cat","shaman","rabbit","raccoon"];

/* ---- EF 2026 lineup (initial + phase 2). Genres are buckets; some artists span a few. ---- */

const DAY_LABELS = { thu:"Thu 6/25", fri:"Fri 6/26", sat:"Sat 6/27", sun:"Sun 6/28" };

const GENRES = [
  ["bass", "⚡ Bass & Dubstep"],
  ["house", "🏠 House & Techno"],
  ["edm", "🎛️ Electronic & EDM"],
  ["psy", "🌀 Psychedelic"],
  ["jam", "🎸 Jam & Live"],
  ["dnb", "🥁 Drum & Bass"],
  ["hiphop", "🎤 Hip-Hop & R&B"],
  ["indie", "🔮 Experimental & Indie"],
];
const LINEUP = [
  ["Excision",["bass"]],["Sullivan King",["bass"]],["Kai Wachi",["bass"]],["Ganja White Night",["bass"]],
  ["Wooli",["bass"]],["ISOxo",["bass"]],["RAVENSCOON",["bass"]],["Jkyl & Hyde",["bass"]],["Bricknasty",["bass"]],
  ["Daily Bread",["bass"]],["Levity",["bass"]],["Riot",["bass"]],["LSDream",["bass","psy"]],["Snow Wife",["bass","indie"]],
  ["Sippy",["bass","house"]],["Nitepunk",["bass","edm"]],["Magoo",["bass"]],["MPH",["bass"]],["Jigitz",["bass"]],
  ["Chris Lake",["house"]],["Eli Brown",["house"]],["Purple Disco Machine",["house"]],["Sidepiece",["house"]],
  ["Sammy Virji",["house"]],["D.O.D",["house"]],["Odd Mob",["house"]],["Omnom",["house"]],["Disco Lines",["house"]],
  ["Devault",["house","edm"]],["Ship Wrek",["house"]],["Qrion",["house","edm"]],["MCR-T",["house"]],["Brunello",["house"]],
  ["Westend",["house"]],["Heyz",["house"]],["Costa",["house"]],["Chris Luno",["house"]],["Saint Ludo",["house","indie"]],
  ["Oppidan",["house","edm"]],["Close Friends Only",["house"]],["Hershe",["house"]],
  ["ILLENIUM",["edm","bass"]],["Kaskade",["edm","house"]],["Galantis",["edm"]],["Madeon",["edm"]],["Lane 8",["edm","house"]],
  ["GRiZ",["edm","bass","psy"]],["Whethan",["edm"]],["Tourist",["edm"]],["Mild Minds",["edm","house"]],["Sam Gellaitry",["edm","hiphop"]],
  ["Bob Moses",["edm","house"]],["Bombargo",["edm","indie"]],["Daniel Allan",["edm","hiphop"]],["Chmura",["edm","bass"]],
  ["Vandelux",["edm","house"]],["Motifv",["edm","bass"]],["Tiffany Day",["edm","indie"]],["Starjunk 95",["edm"]],
  ["Avello",["edm","house"]],["Mary Droppinz",["edm","hiphop"]],["Alleycvt",["edm","bass"]],["Supertaste",["edm","house"]],
  ["Lyrah",["edm","indie"]],["Effin",["edm","house"]],
  ["Shpongle",["psy"]],["Deadtronica",["psy","jam"]],["Dixon's Violin",["psy"]],["Vincent Antone",["psy","bass"]],
  ["Wax Monkey",["psy"]],["EOTO",["psy","jam"]],
  ["The String Cheese Incident",["jam"]],["Eggy",["jam"]],["Dogs In A Pile",["jam"]],["Daniel Donato's Cosmic Country",["jam"]],
  ["Couch",["jam"]],["The Flints",["jam"]],["The Sponges",["jam"]],["LSD Clownsystem",["jam","psy"]],
  ["Andy C",["dnb"]],["Ivy Lab",["dnb"]],["Wilkinson",["dnb"]],["Casey Club",["dnb","house"]],["Muzz",["dnb"]],
  ["DJ Diesel",["hiphop","bass"]],["T-Pain",["hiphop"]],["Channel Tres",["hiphop","house"]],["Probcause",["hiphop","jam"]],
  ["Iniko",["hiphop","indie"]],["Kaleena Zanders",["hiphop","house"]],["Yaeji",["hiphop","house"]],["Rochelle Jordan",["hiphop","house"]],
  ["Jean Dawson",["hiphop","indie"]],["Frost Children",["hiphop","indie"]],["underscores",["hiphop","indie"]],["SBTRKT",["hiphop","edm"]],
  ["River Tiber",["hiphop","indie"]],
  ["CREG",["indie"]],["all:Lo Collective",["indie","hiphop"]],["Passion Pit",["indie"]],["Bipolar Sunshine",["indie"]],
  ["Night Tapes",["indie"]],["Stolen Gin",["indie"]],["Swimming Paul",["indie"]],["Wes Mills",["indie"]],["Inji",["indie","house"]],
  ["Midnight Generation",["indie"]],["Nikita, the Wicked",["indie"]],["Bardo",["indie"]],["Steller",["indie"]],["Capochino",["indie"]],
  ["Cain Culto",["indie"]],["Richard Finger",["indie"]],["Ranger Trucco",["indie","house"]],["Rio Kosta",["indie"]],
  ["Laszewo",["indie"]],["Shima",["indie"]],["Jackie Hollander",["indie"]],["Sam Gellaitry",["edm","hiphop"]],
];
// de-dupe by name (a couple appear twice above by design of editing) -> map name->genres
const ARTISTS = (() => { const m = {}; for (const [n, g] of LINEUP) m[n] = Array.from(new Set([...(m[n]||[]), ...g])); return Object.keys(m).sort((a,b)=>a.localeCompare(b)).map((n)=>({ name:n, genres:m[n] })); })();

const SCHEDULE_RAW = [
  ["Dixon's Violin",[{"day": "thu", "stage": "The Observatory", "start": "18:15", "end": "19:15"}]],
  ["SHIMA",[{"day": "thu", "stage": "The Observatory", "start": "20:00", "end": "20:45"}]],
  ["HerShe",[{"day": "thu", "stage": "The Observatory", "start": "20:45", "end": "21:30"}]],
  ["Jkyl & Hyde",[{"day": "thu", "stage": "The Observatory", "start": "21:30", "end": "22:15"}]],
  ["Probcause",[{"day": "thu", "stage": "The Observatory", "start": "22:15", "end": "23:00"}]],
  ["all:Lo Collective",[{"day": "thu", "stage": "The Observatory", "start": "00:15", "end": "02:00"}]],
  ["LSD Clownsystem",[{"day": "thu", "stage": "The Observatory", "start": "02:30", "end": "03:30"}, {"day": "fri", "stage": "Grand Artique", "start": "23:00", "end": "00:00"}]],
  ["Bipolar Sunshine",[{"day": "thu", "stage": "Honeycomb", "start": "20:30", "end": "21:30"}]],
  ["Magoo",[{"day": "thu", "stage": "Honeycomb", "start": "22:00", "end": "23:00"}]],
  ["Laszewo",[{"day": "thu", "stage": "Honeycomb", "start": "23:30", "end": "00:30"}, {"day": "fri", "stage": "Tripolee", "start": "01:30", "end": "02:30"}]],
  ["MCR-T",[{"day": "thu", "stage": "Honeycomb", "start": "00:30", "end": "01:30"}]],
  ["Midnight Generation",[{"day": "thu", "stage": "Honeycomb", "start": "01:30", "end": "02:30"}, {"day": "thu", "stage": "Ranch Arena", "start": "20:15", "end": "21:15"}]],
  ["Bardo",[{"day": "thu", "stage": "Honeycomb", "start": "02:30", "end": "03:30"}]],
  ["EFFIN",[{"day": "thu", "stage": "Ranch Arena", "start": "18:30", "end": "19:45"}]],
  ["Disco Lines",[{"day": "thu", "stage": "Ranch Arena", "start": "21:45", "end": "23:00"}]],
  ["Excision",[{"day": "thu", "stage": "Ranch Arena", "start": "00:30", "end": "02:30"}]],
  ["Eggy",[{"day": "thu", "stage": "Sherwood Court", "start": "19:00", "end": "20:15"}]],
  ["Night Tapes",[{"day": "thu", "stage": "Sherwood Court", "start": "21:00", "end": "22:00"}]],
  ["ALLEYCVT",[{"day": "thu", "stage": "Sherwood Court", "start": "23:00", "end": "00:15"}]],
  ["Ganja White Night",[{"day": "thu", "stage": "Sherwood Court", "start": "01:45", "end": "03:00"}]],
  ["Close Friends Only",[{"day": "thu", "stage": "Tripolee", "start": "19:45", "end": "20:45"}]],
  ["Jackie Hollander",[{"day": "thu", "stage": "Tripolee", "start": "20:45", "end": "21:45"}]],
  ["Daniel Allan",[{"day": "thu", "stage": "Tripolee", "start": "21:45", "end": "22:45"}]],
  ["Devault",[{"day": "thu", "stage": "Tripolee", "start": "22:45", "end": "23:45"}]],
  ["Westend",[{"day": "thu", "stage": "Tripolee", "start": "23:45", "end": "00:45"}, {"day": "fri", "stage": "Honeycomb", "start": "23:00", "end": "00:00"}]],
  ["D.O.D",[{"day": "thu", "stage": "Tripolee", "start": "00:45", "end": "01:45"}]],
  ["Odd Mob",[{"day": "thu", "stage": "Tripolee", "start": "01:45", "end": "02:45"}]],
  ["Eli Brown",[{"day": "thu", "stage": "Tripolee", "start": "02:45", "end": "04:00"}]],
  ["Supertaste",[{"day": "fri", "stage": "The Observatory", "start": "16:30", "end": "17:30"}, {"day": "sat", "stage": "The Observatory", "start": "16:30", "end": "17:30"}]],
  ["Casey Club",[{"day": "fri", "stage": "The Observatory", "start": "18:00", "end": "19:00"}]],
  ["Mild Minds",[{"day": "fri", "stage": "The Observatory", "start": "19:30", "end": "20:30"}]],
  ["Iniko",[{"day": "fri", "stage": "The Observatory", "start": "21:00", "end": "22:00"}]],
  ["Dogs In A Pile",[{"day": "fri", "stage": "The Observatory", "start": "22:30", "end": "23:45"}]],
  ["Ranger Trucco",[{"day": "fri", "stage": "The Observatory", "start": "00:15", "end": "01:15"}]],
  ["SBTRKT",[{"day": "fri", "stage": "The Observatory", "start": "01:15", "end": "02:15"}]],
  ["Richard Finger",[{"day": "fri", "stage": "The Observatory", "start": "02:30", "end": "03:30"}]],
  ["CREG",[{"day": "fri", "stage": "Honeycomb", "start": "18:30", "end": "19:15"}]],
  ["Brunello",[{"day": "fri", "stage": "Honeycomb", "start": "20:45", "end": "21:45"}, {"day": "sat", "stage": "Honeycomb", "start": "20:45", "end": "21:45"}]],
  ["SIDEPIECE",[{"day": "fri", "stage": "Sherwood Court", "start": "21:00", "end": "22:15"}, {"day": "sat", "stage": "Honeycomb", "start": "23:45", "end": "01:00"}]],
  ["Passion Pit",[{"day": "fri", "stage": "Sherwood Court", "start": "23:00", "end": "00:00"}]],
  ["Sammy Virji",[{"day": "fri", "stage": "Sherwood Court", "start": "02:15", "end": "03:30"}]],
  ["Kaleena Zanders",[{"day": "fri", "stage": "Sherwood Court", "start": "16:00", "end": "17:00"}]],
  ["Couch",[{"day": "fri", "stage": "Sherwood Court", "start": "17:45", "end": "18:45"}]],
  ["Ship Wrek",[{"day": "fri", "stage": "Sherwood Court", "start": "19:15", "end": "20:15"}]],
  ["Motifv",[{"day": "fri", "stage": "Ranch Arena", "start": "16:30", "end": "17:30"}]],
  ["Swimming Paul",[{"day": "fri", "stage": "Ranch Arena", "start": "18:15", "end": "19:15"}]],
  ["Daily Bread",[{"day": "fri", "stage": "Ranch Arena", "start": "20:00", "end": "21:00"}]],
  ["Levity",[{"day": "fri", "stage": "Ranch Arena", "start": "21:45", "end": "23:00"}]],
  ["GRiZ",[{"day": "fri", "stage": "Ranch Arena", "start": "00:00", "end": ""}, {"day": "sun", "stage": "Sherwood Court", "start": "20:15", "end": "21:30", "note": "Chasing The Golden Hour"}]],
  ["Saint Ludo",[{"day": "fri", "stage": "Tripolee", "start": "16:45", "end": "17:15"}]],
  ["MUZZ",[{"day": "fri", "stage": "Tripolee", "start": "17:45", "end": "18:45"}]],
  ["Nitepunk",[{"day": "fri", "stage": "Tripolee", "start": "18:45", "end": "19:45"}]],
  ["Nikita, the Wicked",[{"day": "fri", "stage": "Tripolee", "start": "19:45", "end": "20:45"}]],
  ["Ivy Lab",[{"day": "fri", "stage": "Tripolee", "start": "20:45", "end": "21:45"}]],
  ["Wilkinson",[{"day": "fri", "stage": "Tripolee", "start": "21:45", "end": "22:45"}]],
  ["Andy C",[{"day": "fri", "stage": "Tripolee", "start": "22:45", "end": "00:00"}]],
  ["Galantis",[{"day": "fri", "stage": "Tripolee", "start": "00:15", "end": "01:30"}]],
  ["Claude VonStroke",[{"day": "fri", "stage": "Tripolee", "start": "02:30", "end": "04:00"}]],
  ["Tiffany Day",[{"day": "sat", "stage": "The Observatory", "start": "16:30", "end": "17:30"}]],
  ["Rio Kosta",[{"day": "sat", "stage": "The Observatory", "start": "18:00", "end": "19:00"}]],
  ["Lyrah",[{"day": "sat", "stage": "The Observatory", "start": "19:45", "end": "20:45"}]],
  ["Vandelux",[{"day": "sat", "stage": "The Observatory", "start": "21:15", "end": "22:15"}, {"day": "sat", "stage": "Honeycomb", "start": "01:15", "end": "02:15"}]],
  ["Tourist",[{"day": "sat", "stage": "The Observatory", "start": "22:45", "end": "23:45"}]],
  ["Jigitz",[{"day": "sat", "stage": "The Observatory", "start": "00:15", "end": "01:15"}]],
  ["EOTO",[{"day": "sat", "stage": "The Observatory", "start": "01:45", "end": "03:00"}]],
  ["Cain Culto",[{"day": "sat", "stage": "Honeycomb", "start": "18:15", "end": "19:15"}]],
  ["Snow Wife",[{"day": "sat", "stage": "Honeycomb", "start": "19:30", "end": "20:30"}]],
  ["Channel Tres",[{"day": "sat", "stage": "Honeycomb", "start": "20:45", "end": "21:45"}, {"day": "sat", "stage": "Ranch Arena", "start": "00:00", "end": "01:15"}]],
  ["Rochelle Jordan",[{"day": "sat", "stage": "Honeycomb", "start": "22:00", "end": "23:00"}]],
  ["Chmura",[{"day": "sat", "stage": "Honeycomb", "start": "23:15", "end": "00:15"}]],
  ["Costa",[{"day": "sat", "stage": "Honeycomb", "start": "00:15", "end": "01:15"}]],
  ["Sam Gellaitry",[{"day": "sat", "stage": "Honeycomb", "start": "02:15", "end": "03:15"}, {"day": "sat", "stage": "Sherwood Court", "start": "20:00", "end": "21:00"}]],
  ["Vincent Antone",[{"day": "sat", "stage": "Grand Artique", "start": "21:30", "end": "22:30"}, {"day": "sun", "stage": "Sherwood Court", "start": "17:00", "end": "18:00"}]],
  ["Bob Moses",[{"day": "sat", "stage": "Grand Artique", "start": "22:45", "end": "00:00"}, {"day": "sun", "stage": "Tripolee", "start": "23:30", "end": "00:45"}]],
  ["Inji",[{"day": "sat", "stage": "Ranch Arena", "start": "17:30", "end": "18:30"}]],
  ["The String Cheese Incident",[{"day": "sat", "stage": "Ranch Arena", "start": "19:00", "end": "22:45"}]],
  ["Chris Lake",[{"day": "sat", "stage": "Ranch Arena", "start": "02:00", "end": ""}]],
  ["Starjunk 95",[{"day": "sat", "stage": "Sherwood Court", "start": "18:30", "end": "19:30"}]],
  ["Madeon",[{"day": "sat", "stage": "Sherwood Court", "start": "21:45", "end": "22:50"}]],
  ["Shpongle",[{"day": "sat", "stage": "Sherwood Court", "start": "23:30", "end": "00:45"}]],
  ["ISOxo",[{"day": "sat", "stage": "Sherwood Court", "start": "01:30", "end": "02:45"}]],
  ["Riot",[{"day": "sat", "stage": "Tripolee", "start": "17:15", "end": "18:15"}]],
  ["Capochino",[{"day": "sat", "stage": "Tripolee", "start": "18:15", "end": "19:15"}]],
  ["AVELLO",[{"day": "sat", "stage": "Tripolee", "start": "19:15", "end": "20:15"}]],
  ["Sippy",[{"day": "sat", "stage": "Tripolee", "start": "20:15", "end": "21:15"}]],
  ["Heyz",[{"day": "sat", "stage": "Tripolee", "start": "21:15", "end": "22:15"}]],
  ["RAVENSCOON",[{"day": "sat", "stage": "Tripolee", "start": "22:15", "end": "23:15"}]],
  ["Whethan",[{"day": "sat", "stage": "Tripolee", "start": "23:15", "end": "00:15"}]],
  ["Kai Wachi",[{"day": "sat", "stage": "Tripolee", "start": "00:15", "end": "01:30"}]],
  ["Sullivan King",[{"day": "sat", "stage": "Tripolee", "start": "01:30", "end": "02:45"}]],
  ["DJ Diesel",[{"day": "sat", "stage": "Tripolee", "start": "02:45", "end": "04:00", "note": "b2b Teddy Pain (T-Pain)"}]],
  ["Bricknasty",[{"day": "sun", "stage": "The Observatory", "start": "17:15", "end": "18:15"}]],
  ["Bombargo",[{"day": "sun", "stage": "The Observatory", "start": "18:45", "end": "19:45"}]],
  ["Oppidan",[{"day": "sun", "stage": "The Observatory", "start": "20:15", "end": "21:15"}]],
  ["Mary Droppinz",[{"day": "sun", "stage": "The Observatory", "start": "21:30", "end": "22:30"}]],
  ["MPH",[{"day": "sun", "stage": "The Observatory", "start": "22:45", "end": "23:45"}]],
  ["Frost Children",[{"day": "sun", "stage": "The Observatory", "start": "00:30", "end": "01:40"}]],
  ["Wax Monkey",[{"day": "sun", "stage": "Honeycomb", "start": "18:00", "end": "19:00"}]],
  ["River Tiber",[{"day": "sun", "stage": "Honeycomb", "start": "21:45", "end": "23:00"}]],
  ["Deadtronica",[{"day": "sun", "stage": "Honeycomb", "start": "23:30", "end": "00:30"}]],
  ["LSDream",[{"day": "sun", "stage": "Ranch Arena", "start": "15:30", "end": "17:00", "note": "LIGHTCODE by LSDREAM"}, {"day": "sun", "stage": "Sherwood Court", "start": "00:45", "end": "02:00"}]],
  ["Underscores",[{"day": "sun", "stage": "Ranch Arena", "start": "18:00", "end": "19:00"}]],
  ["Jean Dawson",[{"day": "sun", "stage": "Ranch Arena", "start": "19:30", "end": "20:30"}]],
  ["Kaskade",[{"day": "sun", "stage": "Ranch Arena", "start": "21:15", "end": "22:30"}]],
  ["ILLENIUM",[{"day": "sun", "stage": "Ranch Arena", "start": "23:30", "end": ""}]],
  ["Daniel Donato's Cosmic Country",[{"day": "sun", "stage": "Sherwood Court", "start": "18:30", "end": "19:45"}]],
  ["Wooli",[{"day": "sun", "stage": "Sherwood Court", "start": "22:30", "end": "23:45"}]],
  ["Wes Mills",[{"day": "sun", "stage": "Tripolee", "start": "17:15", "end": "18:30"}]],
  ["Qrion",[{"day": "sun", "stage": "Tripolee", "start": "18:30", "end": "19:45"}]],
  ["Chris Luno",[{"day": "sun", "stage": "Tripolee", "start": "19:45", "end": "21:00"}]],
  ["OMNOM",[{"day": "sun", "stage": "Tripolee", "start": "21:00", "end": "22:15"}]],
  ["Yaeji",[{"day": "sun", "stage": "Tripolee", "start": "22:15", "end": "23:30"}]],
  ["Lane 8",[{"day": "sun", "stage": "Tripolee", "start": "00:45", "end": "02:00"}]]
];
// Map: normalised name -> [{day,stage,start,end,note?}]
const SCHEDULE = (() => {
  const m = {};
  for (const [name, slots] of SCHEDULE_RAW) {
    const k = name.toLowerCase().trim();
    m[k] = (m[k] || []).concat(slots);
    // also store by original name
    m[name] = (m[name] || []).concat(slots);
  }
  return m;
})();
const getSlots = (name) => SCHEDULE[name] || SCHEDULE[name.toLowerCase().trim()] || [];

// Legacy records saved avatars as emoji — map those (and any unknown value) to a real drawn spirit.
const EMOJI_TO_TYPE = { "🦊":"fox","🦉":"owl","🦌":"deer","🐸":"frog","🐺":"wolf","🐻":"bear","🍄":"mushroom","🐝":"firefly","🐱":"cat","🐰":"rabbit","🦝":"raccoon","🦋":"firefly","🦅":"owl","🐉":"shaman","🐢":"frog","🐿️":"raccoon","🦔":"bear","🌲":"deer","✨":"firefly" };
const MODES = [
  { v: "flight",  label: "Flight",     icon: "✈️" },
  { v: "driving", label: "Driving in", icon: "🚗" },
];
const ARRIVAL_POINTS = ["O'Hare (ORD)", "Midway (MDW)", "Driving straight in", "Other"];
const SEATERS = ["5-seater", "7-seater"];

const pad = (n) => String(n).padStart(2, "0");
const isoFrom = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const FEST_DAYS = new Set(["2026-06-25","2026-06-26","2026-06-27","2026-06-28"]);

const partnerId = (id) => {
  const me = ROSTER.find((r) => r.id === id);
  if (!me || !me.pair) return null;
  return ROSTER.find((r) => r.id !== id && r.pair === me.pair)?.id || null;
};
const blank = (id) => ({
  id, avatar: "", filled: false,
  origin: "", mode: "flight", arrDate: "", arrTime: "", flightNo: "", arrPoint: "O'Hare (ORD)",
  renting: false, rentType: "5-seater", rentStartDate: "", rentStartTime: "",
  notes: "", prediction: "", updatedAt: null,
});
const modeMeta = (v) => MODES.find((m) => m.v === v) || MODES[0];
const fmtWhen = (d, t) => {
  if (!d && !t) return "Time TBD";
  let out = "";
  if (d) out = new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (t) { const [h,m]=t.split(":").map(Number); const ap=h>=12?"PM":"AM"; const hr=((h+11)%12)+1; out += (out?" · ":"")+`${hr}:${pad(m)} ${ap}`; }
  return out;
};
const sortKey = (p) => `${p.arrDate || "9999-99-99"}T${p.arrTime || "99:99"}`;
const hueFor = (s) => { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))%360; return h; };
const rnd = () => Math.random().toString(36).slice(2, 7);
const normType = (t) => {
  if (t && AVATAR_TYPES.includes(t)) return t;
  if (t && EMOJI_TO_TYPE[t]) return EMOJI_TO_TYPE[t];
  if (t) return AVATAR_TYPES[hueFor(String(t)) % AVATAR_TYPES.length]; // unknown but set → deterministic real spirit
  return null; // genuinely empty → placeholder
};
const nameOf = (id) => ROSTER.find((r) => r.id === id)?.name || "Someone";
const fmtClock = (ts) => new Date(ts).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
// Read all shared records under a key prefix (each record stored as its own key to avoid clobbering).
const listVals = async (prefix) => {
  try {
    if (window.storage.listFull) { // one query for the whole collection
      const r = await window.storage.listFull(prefix, true);
      return ((r && r.items) || []).map((it) => { try { return { key: it.key, ...JSON.parse(it.value) }; } catch { return null; } }).filter(Boolean);
    }
    const res = await window.storage.list(prefix, true);
    const keys = (res && res.keys) || [];
    const vals = await Promise.all(keys.map(async (k) => {
      try { const r = await window.storage.get(k, true); return r && r.value ? { key: k, ...JSON.parse(r.value) } : null; } catch { return null; }
    }));
    return vals.filter(Boolean);
  } catch { return []; }
};
const GEAR_SUGGESTIONS = ["Sunscreen","Reusable water bottle","Hydration pack","Electrolyte packets","Portable charger","Earplugs","Sunglasses","Bandana / dust mask","Rain poncho","Headlamp","Mini handheld fan","Wet wipes","First-aid + meds","Bug spray","Fanny pack","Camp flag / totem topper","Fairy lights","Bluetooth speaker","Rave fits","Glow / LED toys"];
const GEAR_STATUS = [
  { v: "bringing",    label: "I'm bringing it" },
  { v: "buy_chicago", label: "Buy in Chicago" },
  { v: "buy_onway",   label: "Buy on the way" },
  { v: "needed",      label: "Need it — anyone?" },
];
const gearMeta = (v) => GEAR_STATUS.find((s) => s.v === v) || GEAR_STATUS[0];

/* ---------------- AVATARS (hand-drawn SVG forest spirits) ---------------- */
const GRAD = {
  fox:["#ffc06a","#e0552b"], owl:["#d7a8ff","#6a3bb0"], deer:["#e6c9a0","#9a6433"],
  frog:["#a6f07f","#2f8f3e"], wolf:["#bcd0de","#4a6275"], bear:["#cda06f","#6e4a2c"],
  mushroom:["#ff8a8a","#c0392b"], firefly:["#243524","#0e1a10"], cat:["#7df0e2","#1f8f86"],
  shaman:["#3a4d59","#16222b"], rabbit:["#f6e6fb","#c9a0d8"], raccoon:["#c7d1da","#5a6470"],
};
const Eye = ({ x, y, r = 7, pupil = "#15201a" }) => (
  <g><circle cx={x} cy={y} r={r} fill="#fff" /><circle cx={x} cy={y + 1} r={r * 0.45} fill={pupil} />
    <circle cx={x + r * 0.32} cy={y - r * 0.32} r={r * 0.18} fill="#fff" /></g>
);
function avatarBehind(type) {
  switch (type) {
    case "fox": return (<g><polygon points="26,8 42,32 16,34" fill="#c0451f"/><polygon points="74,8 84,34 58,32" fill="#c0451f"/></g>);
    case "owl": return (<g><polygon points="34,10 44,26 26,26" fill="#5a3199"/><polygon points="66,10 74,26 56,26" fill="#5a3199"/></g>);
    case "deer": return (<g stroke="#caa472" strokeWidth="3" fill="none" strokeLinecap="round">
      <path d="M42 22 C 38 10, 30 8, 30 2 M42 22 C 34 14, 26 16, 22 12"/>
      <path d="M58 22 C 62 10, 70 8, 70 2 M58 22 C 66 14, 74 16, 78 12"/>
      <ellipse cx="30" cy="30" rx="7" ry="12" fill="#caa472" stroke="none" transform="rotate(-20 30 30)"/>
      <ellipse cx="70" cy="30" rx="7" ry="12" fill="#caa472" stroke="none" transform="rotate(20 70 30)"/></g>);
    case "wolf": return (<g><polygon points="22,8 42,30 18,34" fill="#3a4f5e"/><polygon points="78,8 82,34 58,30" fill="#3a4f5e"/></g>);
    case "bear": return (<g><circle cx="26" cy="24" r="13" fill="#6e4a2c"/><circle cx="74" cy="24" r="13" fill="#6e4a2c"/>
      <circle cx="26" cy="24" r="6" fill="#9c7548"/><circle cx="74" cy="24" r="6" fill="#9c7548"/></g>);
    case "cat": return (<g><polygon points="24,10 44,30 20,34" fill="#1f8f86"/><polygon points="76,10 80,34 56,30" fill="#1f8f86"/>
      <polygon points="29,16 40,29 26,31" fill="#ff9ecb"/><polygon points="71,16 74,31 60,29" fill="#ff9ecb"/></g>);
    case "rabbit": return (<g><ellipse cx="40" cy="12" rx="7" ry="22" fill="#dfc3e8"/><ellipse cx="60" cy="12" rx="7" ry="22" fill="#dfc3e8"/>
      <ellipse cx="40" cy="12" rx="3.5" ry="16" fill="#ff9ecb"/><ellipse cx="60" cy="12" rx="3.5" ry="16" fill="#ff9ecb"/></g>);
    case "raccoon": return (<g><circle cx="28" cy="22" r="12" fill="#5a6470"/><circle cx="72" cy="22" r="12" fill="#5a6470"/>
      <circle cx="28" cy="22" r="6" fill="#aeb8c2"/><circle cx="72" cy="22" r="6" fill="#aeb8c2"/></g>);
    default: return null;
  }
}
function avatarFront(type) {
  switch (type) {
    case "fox": return (<g><ellipse cx="40" cy="66" rx="14" ry="10" fill="#fff" opacity=".92"/><ellipse cx="60" cy="66" rx="14" ry="10" fill="#fff" opacity=".92"/>
      <Eye x={40} y={48}/><Eye x={60} y={48}/><polygon points="50,58 44,62 56,62" fill="#2a1a12"/></g>);
    case "owl": return (<g><circle cx="38" cy="50" r="16" fill="#fff"/><circle cx="62" cy="50" r="16" fill="#fff"/>
      <circle cx="38" cy="50" r="8" fill="#15201a"/><circle cx="62" cy="50" r="8" fill="#15201a"/>
      <circle cx="40" cy="47" r="2.6" fill="#fff"/><circle cx="64" cy="47" r="2.6" fill="#fff"/>
      <polygon points="50,56 45,66 55,66" fill="#ffb347"/></g>);
    case "deer": return (<g><Eye x={40} y={50}/><Eye x={60} y={50}/><ellipse cx="50" cy="66" rx="7" ry="5.5" fill="#3a2417"/>
      <circle cx="34" cy="62" r="2.4" fill="#fff" opacity=".6"/><circle cx="66" cy="64" r="2.4" fill="#fff" opacity=".6"/></g>);
    case "frog": return (<g><circle cx="34" cy="24" r="13" fill="#bff3a0"/><circle cx="66" cy="24" r="13" fill="#bff3a0"/>
      <circle cx="34" cy="25" r="6" fill="#15201a"/><circle cx="66" cy="25" r="6" fill="#15201a"/>
      <path d="M30 62 Q50 78 70 62" fill="none" stroke="#1f6b2c" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="44" cy="52" r="2" fill="#1f6b2c"/><circle cx="56" cy="52" r="2" fill="#1f6b2c"/></g>);
    case "wolf": return (<g><ellipse cx="50" cy="66" rx="16" ry="12" fill="#e8eef2"/><Eye x={40} y={48} r={6}/><Eye x={60} y={48} r={6}/>
      <ellipse cx="50" cy="60" rx="5" ry="4" fill="#1b242b"/></g>);
    case "bear": return (<g><ellipse cx="50" cy="66" rx="16" ry="13" fill="#f0e0c8"/><Eye x={40} y={48} r={5}/><Eye x={60} y={48} r={5}/>
      <ellipse cx="50" cy="60" rx="5.5" ry="4.5" fill="#2a1a10"/></g>);
    case "mushroom": return (<g><ellipse cx="50" cy="70" rx="26" ry="20" fill="#f3e2c0"/>
      <circle cx="35" cy="40" r="5" fill="#fff"/><circle cx="62" cy="36" r="6" fill="#fff"/><circle cx="49" cy="28" r="4.5" fill="#fff"/><circle cx="70" cy="52" r="4" fill="#fff"/>
      <Eye x={42} y={66} r={5}/><Eye x={58} y={66} r={5}/><path d="M44 76 Q50 81 56 76" fill="none" stroke="#b07a3a" strokeWidth="2.5" strokeLinecap="round"/></g>);
    case "firefly": return (<g>
      <line x1="44" y1="22" x2="38" y2="8" stroke="#cfe8c8" strokeWidth="2.2"/><circle cx="38" cy="8" r="3" fill="#fff2a8"/>
      <line x1="56" y1="22" x2="62" y2="8" stroke="#cfe8c8" strokeWidth="2.2"/><circle cx="62" cy="8" r="3" fill="#fff2a8"/>
      <ellipse cx="30" cy="56" rx="16" ry="10" fill="#d7ffe6" opacity=".25" transform="rotate(-18 30 56)"/>
      <ellipse cx="70" cy="56" rx="16" ry="10" fill="#d7ffe6" opacity=".25" transform="rotate(18 70 56)"/>
      <circle cx="50" cy="74" r="17" fill="#fff2a8"/><circle cx="50" cy="74" r="11" fill="#fffbcf"/>
      <Eye x={43} y={46} r={5} pupil="#15201a"/><Eye x={57} y={46} r={5}/></g>);
    case "cat": return (<g><path d="M34 44 Q40 38 46 44 Q40 54 34 44Z" fill="#15201a"/><path d="M66 44 Q60 38 54 44 Q60 54 66 44Z" fill="#15201a"/>
      <ellipse cx="40" cy="46" rx="1.6" ry="5" fill="#bff7ef"/><ellipse cx="60" cy="46" rx="1.6" ry="5" fill="#bff7ef"/>
      <polygon points="50,58 46,62 54,62" fill="#ff7eb6"/>
      <g stroke="#0c5b54" strokeWidth="1.6" strokeLinecap="round"><line x1="34" y1="60" x2="20" y2="58"/><line x1="34" y1="64" x2="21" y2="66"/><line x1="66" y1="60" x2="80" y2="58"/><line x1="66" y1="64" x2="79" y2="66"/></g></g>);
    case "shaman": return (<g><path d="M50 8 C 24 10, 16 40, 22 64 C 28 88, 72 88, 78 64 C 84 40, 76 10, 50 8 Z" fill="#1b2932"/>
      <path d="M50 14 C 30 16, 24 40, 30 60 L70 60 C 76 40, 70 16, 50 14 Z" fill="#0e1820"/>
      <ellipse cx="40" cy="48" rx="6" ry="4" fill="#5bf0ff"/><ellipse cx="60" cy="48" rx="6" ry="4" fill="#5bf0ff"/>
      <circle cx="50" cy="34" r="2.5" fill="#5bf0ff"/><circle cx="38" cy="68" r="1.8" fill="#c77dff"/><circle cx="62" cy="68" r="1.8" fill="#c77dff"/></g>);
    case "rabbit": return (<g><Eye x={40} y={52} r={6}/><Eye x={60} y={52} r={6}/><ellipse cx="50" cy="62" rx="4" ry="3" fill="#ff7eb6"/>
      <path d="M50 65 L50 70 M50 70 Q45 72 43 70 M50 70 Q55 72 57 70" fill="none" stroke="#a06ab0" strokeWidth="1.8" strokeLinecap="round"/></g>);
    case "raccoon": return (<g><path d="M22 46 Q50 38 78 46 Q72 60 50 60 Q28 60 22 46 Z" fill="#2b333b"/>
      <circle cx="38" cy="50" r="6.5" fill="#fff"/><circle cx="62" cy="50" r="6.5" fill="#fff"/><circle cx="38" cy="51" r="3" fill="#15201a"/><circle cx="62" cy="51" r="3" fill="#15201a"/>
      <ellipse cx="50" cy="68" rx="13" ry="10" fill="#eef2f6"/><ellipse cx="50" cy="63" rx="4.5" ry="3.5" fill="#1b242b"/></g>);
    default: return null;
  }
}
function Avatar({ type, size = 40 }) {
  const t = normType(type);
  if (!t) return <div className="ava ava--empty" style={{ width: size, height: size }}>?</div>;
  const [c1, c2] = GRAD[t] || GRAD.fox;
  const gid = `av-${t}-${size}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="ava" aria-hidden>
      <defs><radialGradient id={gid} cx="50%" cy="34%" r="78%"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/></radialGradient></defs>
      {avatarBehind(t)}
      <circle cx="50" cy="52" r="42" fill={`url(#${gid})`} stroke="rgba(255,255,255,.28)" strokeWidth="1.5"/>
      {avatarFront(t)}
    </svg>
  );
}

/* ---------------- VINE (hover unfurl) ---------------- */
const Vine = ({ side }) => (
  <svg className={`vine-svg vine--${side}`} viewBox="0 0 40 80" aria-hidden>
    <path d="M20 80 C 6 60, 30 50, 15 32 C 6 19, 26 13, 18 1" fill="none" stroke="#7CFFB2" strokeWidth="2.6" strokeLinecap="round"/>
    <ellipse cx="9" cy="55" rx="6.5" ry="3.6" fill="#4ade80" transform="rotate(-32 9 55)"/>
    <ellipse cx="28" cy="43" rx="6.5" ry="3.6" fill="#7CFFB2" transform="rotate(26 28 43)"/>
    <ellipse cx="10" cy="25" rx="5.5" ry="3.2" fill="#4ade80" transform="rotate(-22 10 25)"/>
    <ellipse cx="24" cy="12" rx="5" ry="3" fill="#7CFFB2" transform="rotate(20 24 12)"/>
  </svg>
);

/* ---------------- SOUND FX ---------------- */
function useSound() {
  const [on, setOn] = useState(true);
  const ctxRef = useRef(null), onRef = useRef(true);
  useEffect(() => { onRef.current = on; }, [on]);
  const ctx = () => {
    if (!ctxRef.current) { try { ctxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };
  const tone = (freq, dur, { type="sine", vol=0.05, when=0, glideTo=null, detune=0 } = {}) => {
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune;
    const t = c.currentTime + when;
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.03);
  };
  const play = (name) => {
    if (!onRef.current) return;
    switch (name) {
      case "hover": tone(760, 0.16, { type:"sine", vol:0.022, glideTo:430 }); tone(1500, 0.06, { type:"sine", vol:0.01 }); break;
      case "pick":  [523.25,659.25,783.99].forEach((f,i)=>{ tone(f,0.22,{type:"triangle",vol:0.045,when:i*0.03}); tone(f*2,0.18,{type:"sine",vol:0.015,when:i*0.03}); }); break;
      case "tab":   tone(659.25, 0.1, { type:"sine", vol:0.03 }); break;
      case "save":  [523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>{ tone(f,0.22,{type:"sine",vol:0.045,when:i*0.075}); tone(f,0.22,{type:"triangle",vol:0.02,when:i*0.075,detune:6}); }); break;
      case "seal":  tone(180,0.26,{type:"sawtooth",vol:0.04,glideTo:80}); tone(90,0.34,{type:"sine",vol:0.05,when:0.03}); break;
      default: break;
    }
  };
  return { play, on, toggle: () => setOn((v) => !v) };
}

/* ---------------- APP ---------------- */
export default function HappyForest() {
  const [people, setPeople] = useState(() => { const o={}; ROSTER.forEach(r=>o[r.id]=blank(r.id)); return o; });
  const [meId, setMeId] = useState(null);
  const [screen, setScreen] = useState("gate");
  const [pendingId, setPendingId] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [pinMap, setPinMap] = useState(null);
  const loadPins = useCallback(async () => {
    try {
      if (window.storage.listFull) {
        const r = await window.storage.listFull("ef26:pin:", true);
        const m = {};
        for (const it of (r && r.items) || []) { if (it.value) m[it.key.slice(9)] = it.value; }
        setPinMap(m); return;
      }
      const r = await window.storage.list("ef26:pin:", true);
      const keys = (r && r.keys) || [];
      const m = {};
      await Promise.all(keys.map(async (k) => {
        try { const v = await window.storage.get(k, true); if (v && v.value) m[k.slice(9)] = v.value; } catch {}
      }));
      setPinMap(m);
    } catch { setPinMap({}); }
  }, []);
  const [tab, setTab] = useState("convoy");
  const [gear, setGear] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [picks, setPicks] = useState({}); // rosterId -> [artistName,...]
  const [lastRead, setLastRead] = useState(() => { try { return parseInt(localStorage.getItem("ef26:lastread") || "0", 10) || 0; } catch { return 0; } });
  const markRead = useCallback(() => { const t = Date.now(); setLastRead(t); try { localStorage.setItem("ef26:lastread", String(t)); } catch {} }, []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const pollRef = useRef(null);
  const sfx = useSound();

  const loadAll = useCallback(async () => {
    // ONE query refreshes the whole app: people + pins + gear + campfire.
    const next = {};
    ROSTER.forEach((r) => { next[r.id] = blank(r.id); });
    try {
      if (window.storage.listFull) {
        const r = await window.storage.listFull("ef26:", true);
        const pins = {}; const g = []; const m = []; const pk = {};
        for (const it of (r && r.items) || []) {
          const k = it.key;
          try {
            if (k.startsWith("ef26:person:")) { const id = k.slice(12); if (next[id]) next[id] = { ...blank(id), ...JSON.parse(it.value) }; }
            else if (k.startsWith("ef26:pin:")) { if (it.value) pins[k.slice(9)] = it.value; }
            else if (k.startsWith("ef26:gear:")) { g.push({ key: k, ...JSON.parse(it.value) }); }
            else if (k.startsWith("ef26:msg:")) { m.push({ key: k, ...JSON.parse(it.value) }); }
            else if (k.startsWith("ef26:picks:")) { pk[k.slice(11)] = JSON.parse(it.value) || []; }
          } catch {}
        }
        m.sort((a, b) => a.ts - b.ts);
        setPinMap(pins); setGear(g); setMsgs(m); setPicks(pk);
      } else {
        await Promise.all(ROSTER.map(async (rr) => {
          try { const res = await window.storage.get(`ef26:person:${rr.id}`, true);
            if (res && res.value) next[rr.id] = { ...blank(rr.id), ...JSON.parse(res.value) };
          } catch {}
        }));
        listVals("ef26:gear:").then(setGear);
        listVals("ef26:msg:").then((v) => { v.sort((a, b) => a.ts - b.ts); setMsgs(v); });
        (async () => { const pk = {}; await Promise.all(ROSTER.map(async (rr) => {
          try { const r = await window.storage.get(`ef26:picks:${rr.id}`, true); if (r && r.value) pk[rr.id] = JSON.parse(r.value); } catch {}
        })); setPicks(pk); })();
      }
    } catch {}
    setPeople(next); return next;
  }, []);
  useEffect(() => { (async () => {
    let unlocked = false, mid = null;
    try { const u = await window.storage.get("ef26:unlocked", false); unlocked = !!(u && u.value); } catch {}
    try { const mine = await window.storage.get("ef26:myid", false); if (mine && mine.value) mid = mine.value; } catch {}
    if (mid) setMeId(mid);
    if (!unlocked || !mid) {
      // gate/login need no shared data — show instantly, fetch in background
      setScreen(!unlocked ? "gate" : "login");
      setLoading(false);
      loadAll(); loadPins();
      return;
    }
    // returning user: route needs their record (a refresh can't skip the vial)
    const ppl = await loadAll();
    const p = ppl && ppl[mid];
    const hasPred = !!(p && p.prediction && String(p.prediction).trim());
    setScreen(!hasPred ? "predict" : (p && p.filled) ? "hub" : "profile");
    setLoading(false);
    loadPins();
  })(); }, [loadAll, loadPins]);
  useEffect(() => { // unread bookkeeping
    if (screen !== "hub") return;
    if (lastRead === 0) { markRead(); return; } // first visit: start clean
    if (tab === "chat" && msgs.length) markRead(); // reading the campfire
  }, [screen, tab, msgs.length, lastRead, markRead]);
  useEffect(() => {
    if (screen !== "hub") { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(loadAll, 10000);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [screen, loadAll]);

  const flash = (m) => { setToast(m); setTimeout(()=>setToast(""), 2600); };
  const pickName = async (id) => {
    sfx.play("pick");
    setPendingId(id); setScreen("pin");
    if (pinMap) { setPendingPin(pinMap[id] ?? null); return; } // instant — prefetched at boot
    setPendingPin(undefined); // map not ready yet (rare) — fetch just this one
    const ph = await getPinHash(id);
    setPendingPin(ph);
  };
  const finishPick = async (id) => {
    setMeId(id);
    try { await window.storage.set("ef26:myid", id, false); } catch {}
    setPendingId(null); setPendingPin(null);
    const p = people[id];
    const hasPred = !!(p && p.prediction && String(p.prediction).trim());
    setScreen(!hasPred ? "predict" : p.filled ? "hub" : "profile");
  };
  const sealMyVial = async (text) => {
    setSaving(true);
    try {
      const sealed = await sealText(text.trim());
      const cur = people[meId] || blank(meId);
      const record = { ...cur, prediction: sealed, updatedAt: Date.now() };
      setPeople((p) => ({ ...p, [meId]: record }));
      await window.storage.set(`ef26:person:${meId}`, JSON.stringify(record), true);
      sfx.play("save"); flash("Vial sealed. See you Sunday 🔮");
      setScreen(record.filled ? "hub" : "profile");
    } catch { flash("Couldn't seal the vial — nothing was saved. Try again 🔮"); }
    setSaving(false);
  };
  const saveMe = async (data) => {
    if (!data.avatar) { flash("Pick a forest spirit first 🦊"); return; }
    setSaving(true);
    const firstTime = !people[meId]?.filled;
    const record = { ...data, prediction: (people[meId]?.prediction) || "", filled: true, updatedAt: Date.now() };
    delete record._sealedKeep;
    setPeople((p)=>({ ...p, [meId]: record }));
    try { await window.storage.set(`ef26:person:${meId}`, JSON.stringify(record), true);
      sfx.play("save"); flash("Plans dropped into the Forest ✨"); setScreen("hub");
      if (firstTime) { setTab("gear"); flash("One more thing — claim what you're bringing 🎒"); }
    } catch { flash("Couldn't save — try again"); }
    setSaving(false);
  };
  const switchUser = async () => { try { await window.storage.delete("ef26:myid", false); } catch {} setMeId(null); setScreen("login"); loadPins(); };
  const unlock = async () => {
    sfx.play("save");
    try { await window.storage.set("ef26:unlocked", "1", false); } catch {}
    setScreen(meId ? "hub" : "login");
  };

  return (
    <div className="ef-root">
      <style>{CSS}</style>
      <div className="aurora" aria-hidden><span/><span/><span/></div>
      <Fireflies />
      <TreeLine />
      <button data-testid="mute" className="mute" onClick={() => { sfx.toggle(); sfx.play("tab"); }} title="Toggle sound">{sfx.on ? "🔊" : "🔇"}</button>
      <div className="ef-shell">
        {loading ? <div className="ef-loading">Waking the Forest…</div>
          : screen === "gate" ? <Gate onUnlock={unlock} sfx={sfx} />
          : screen === "login" ? <Login people={people} onPick={pickName} sfx={sfx} />
          : screen === "pin" ? (
            <PinGate id={pendingId} name={ROSTER.find(r=>r.id===pendingId)?.name}
              filled={people[pendingId]?.filled} pinHash={pendingPin}
              onAuthed={()=>finishPick(pendingId)}
              onCancel={()=>{ setPendingId(null); setPendingPin(null); setScreen("login"); }}
              onPinSet={(pid, h)=>setPinMap((m)=>{ const n={ ...(m||{}) }; if (h) n[pid]=h; else delete n[pid]; return n; })}
              flash={flash} sfx={sfx} />
          )
          : screen === "predict" ? (
            <SealVial name={ROSTER.find(r=>r.id===meId)?.name} saving={saving}
              onSeal={sealMyVial} onBack={switchUser} flash={flash} sfx={sfx} />
          )
          : screen === "profile" ? (
            <Profile me={ROSTER.find(r=>r.id===meId)} data={people[meId]}
              partner={partnerId(meId) ? people[partnerId(meId)] : null}
              partnerName={ROSTER.find(r=>r.id===meId)?.partner}
              saving={saving} onSave={saveMe} onBack={()=>setScreen("hub")} sfx={sfx}
              usedAvatars={Object.values(people).filter(p=>p.id!==meId).map(p=>p.avatar)} />
          ) : (
            <Hub people={people} meId={meId} tab={tab}
              gear={gear} setGear={setGear} msgs={msgs} setMsgs={setMsgs} picks={picks} setPicks={setPicks}
              unread={lastRead === 0 ? 0 : msgs.filter((m) => m.ts > lastRead && m.author !== meId).length}
              setTab={(t)=>{ sfx.play("tab"); setTab(t); }}
              onEdit={()=>{ sfx.play("pick"); setScreen("profile"); }}
              onRefresh={()=>{ sfx.play("tab"); loadAll(); }}
              onSwitch={switchUser} sfx={sfx} />
          )}
      </div>
      {toast && <div data-testid="toast" className="ef-toast">{toast}</div>}
    </div>
  );
}

/* ---------------- GATE (camp code) ---------------- */
function Gate({ onUnlock, sfx }) {
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const submit = () => {
    if (normCode(code) === CAMP_CODE) { onUnlock(); }
    else { sfx.play("seal"); setBad(true); setTimeout(()=>setBad(false), 600); }
  };
  return (
    <div className="gate">
      <p className="eyebrow">Jun 25–28, 2026 · Rothbury, MI</p>
      <h1 className="wordmark"><span>Electric</span><span>Forest</span></h1>
      <div className="gate__card">
        <p className="gate__lock">🔒</p>
        <h2 className="gate__title">Camp code</h2>
        <p className="gate__hint">psst — it's what we say all weekend 🌲</p>
        <input data-testid="gate-input" className={`in gate__in ${bad?"gate__in--bad":""}`} value={code} autoFocus
          onChange={(e)=>setCode(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&submit()}
          placeholder="enter the code" aria-label="Camp code" />
        {bad && <p data-testid="gate-error" className="gate__err">Not quite — try again 🍄</p>}
        <button data-testid="gate-submit" className="save-btn" onMouseEnter={()=>sfx.play("hover")} onClick={submit}>Enter the Forest ✨</button>
      </div>
    </div>
  );
}

/* ---------------- LOGIN ---------------- */
function Login({ people, onPick, sfx }) {
  const Orb = ({ r, i }) => {
    const filled = people[r.id]?.filled;
    return (
      <button className={`orb ${filled ? "orb--lit":""}`} style={{ "--i": i }}
        data-testid={`orb-${r.id}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>onPick(r.id)} aria-label={`Enter as ${r.name}`}>
        <Vine side="l" /><Vine side="r" />
        <span className="orb__av"><Avatar type={people[r.id]?.avatar} size={46} /></span>
        <span className="orb__name">{r.name}</span>
        {r.solo && <span className="orb__tag orb__tag--solo">SOLO!!!</span>}
        {filled && <span className="orb__check">ready</span>}
      </button>
    );
  };
  let k = 0;
  return (
    <div className="login">
      <header className="login__head">
        <p className="eyebrow">Jun 25–28, 2026 · Rothbury, MI</p>
        <h1 className="wordmark"><span>Electric</span><span>Forest</span></h1>
        <p className="greeting glow-pulse">Happy Forest!</p>
        <Countdown />
        <p className="sub">tap your light to step into the trees 🌲</p>
      </header>
      <div className="login__couples">
        {PAIRS.map(([a,b]) => (
          <div className="couple" key={a.id}><Orb r={a} i={k++} /><span className="couple__vine" aria-hidden>♡</span><Orb r={b} i={k++} /></div>
        ))}
      </div>
      <div className="login__solos">{SOLO_ROSTER.map((r)=><Orb key={r.id} r={r} i={k++} />)}</div>
    </div>
  );
}

/* ---------------- PICKERS ---------------- */
function DateField({ value, onChange, sfx }) {
  const start = new Date("2026-06-20T00:00:00");
  const days = Array.from({ length: 9 }, (_, i) => { const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  const inWindow = days.some((d)=>isoFrom(d)===value);
  const [other, setOther] = useState(value && !inWindow);
  return (
    <div>
      <div className="datestrip">
        {days.map((d) => {
          const iso = isoFrom(d), on = value===iso && !other, fest = FEST_DAYS.has(iso);
          return (
            <button key={iso} className={`daychip ${on?"daychip--on":""} ${fest?"daychip--fest":""}`}
              onMouseEnter={()=>sfx.play("hover")} onClick={()=>{ setOther(false); onChange(iso); }} title={fest?"Festival day":""}>
              <span className="daychip__dow">{d.toLocaleDateString(undefined,{weekday:"short"})}</span>
              <span className="daychip__num">{d.getDate()}</span>
              {fest && <span className="daychip__dot">🌲</span>}
            </button>
          );
        })}
        <button className={`daychip daychip--other ${other?"daychip--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>setOther(true)}>＋<span className="daychip__dow">other</span></button>
      </div>
      {other && <input className="in" type="date" value={value} onChange={(e)=>onChange(e.target.value)} style={{ marginTop: 8 }} />}
    </div>
  );
}
function TimeField({ value, onChange }) {
  const opts = [];
  for (let h=0; h<24; h++) for (const m of [0,30]) { const v=`${pad(h)}:${pad(m)}`, ap=h>=12?"PM":"AM", hr=((h+11)%12)+1; opts.push({ v, label:`${hr}:${pad(m)} ${ap}` }); }
  return (
    <select className="in" value={value} onChange={(e)=>onChange(e.target.value)}>
      <option value="">Pick a time</option>{opts.map((o)=><option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}

/* ---------------- PROFILE ---------------- */
function Profile({ me, data, partner, partnerName, saving, onSave, onBack, usedAvatars, sfx }) {
  const [f, setF] = useState(() => { const init = { ...blank(me.id), ...data }; init.avatar = normType(init.avatar) || ""; return init; });
  const upd = (patch) => setF((s)=>({ ...s, ...patch }));
  const set = (k) => (e) => upd({ [k]: e.target.value });
  const copyPartner = () => {
    if (!partner || !partner.filled) return; sfx.play("pick");
    upd({ origin:partner.origin, mode:partner.mode, arrDate:partner.arrDate, arrTime:partner.arrTime, flightNo:partner.flightNo,
      arrPoint:partner.arrPoint, renting:partner.renting, rentType:partner.rentType, rentStartDate:partner.rentStartDate, rentStartTime:partner.rentStartTime, notes:partner.notes });
  };
  return (
    <div className="profile">
      <button className="ghost-btn" onMouseEnter={()=>sfx.play("hover")} onClick={onBack}>← back to the board</button>
      <h2 className="p-title">Hi {me.name} — light up your plans</h2>
      {me.solo && <p className="p-solo">Riding SOLO!!! 🙌</p>}
      <ProfileGuide local={!!me.local} partnerName={partnerName} sfx={sfx} />

      <section className="card">
        <label className="lbl">Pick your forest spirit <span className="req">required</span></label>
        <div className="av-grid">
          {AVATAR_TYPES.map((a) => {
            const taken = usedAvatars.includes(a) && f.avatar!==a;
            return <button data-testid={`avatar-${a}`} key={a} disabled={taken} className={`av ${f.avatar===a?"av--on":""} ${taken?"av--taken":""}`}
              onMouseEnter={()=>!taken&&sfx.play("hover")} onClick={()=>{ if(!taken){ upd({avatar:a}); sfx.play("tab"); } }}
              title={taken?"Taken by someone else":"Choose"}><Avatar type={a} size={48} /></button>;
          })}
        </div>
      </section>

      {me.local ? (
        <section className="card card--local">
          <p data-testid="local-note" className="local-note">🏙️ You're already in Chicago — no travel info needed! Just pick your spirit and seal a prediction below.</p>
        </section>
      ) : (<>
      {partner && partner.filled && !partner.local && (
        <button data-testid="copy-travel" className="copy-btn" onMouseEnter={()=>sfx.play("hover")} onClick={copyPartner}>⤵ Same trip as {partnerName}? Copy their travel</button>
      )}

      <section className="card">
        <label className="lbl">How are you getting to Chicago?</label>
        <div className="seg">{MODES.map((m)=>(<button data-testid={`mode-${m.v}`} key={m.v} className={`seg__btn ${f.mode===m.v?"seg__btn--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>upd({mode:m.v})}>{m.icon} {m.label}</button>))}</div>
        <label className="lbl">Coming from</label>
        <input className="in" placeholder="e.g. San Jose, CA" value={f.origin} onChange={set("origin")} />
        <label className="lbl">Arrival date into Chicago</label>
        <DateField value={f.arrDate} onChange={(v)=>upd({arrDate:v})} sfx={sfx} />
        <label className="lbl">Arrival time</label>
        <TimeField value={f.arrTime} onChange={(v)=>upd({arrTime:v})} />
        <label className="lbl">Landing / arriving at</label>
        <select className="in" value={f.arrPoint} onChange={set("arrPoint")}>{ARRIVAL_POINTS.map((p)=><option key={p}>{p}</option>)}</select>
        {f.mode==="flight" && (<><label className="lbl">Flight # <span className="opt">(optional)</span></label><input className="in" placeholder="e.g. UA 1234" value={f.flightNo} onChange={set("flightNo")} /></>)}
      </section>

      <section className="card">
        <label className="lbl">Are you renting a car?</label>
        <div className="seg">
          <button data-testid="rent-no" className={`seg__btn ${!f.renting?"seg__btn--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>upd({renting:false})}>No</button>
          <button data-testid="rent-yes" className={`seg__btn ${f.renting?"seg__btn--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>upd({renting:true})}>Yes 🚙</button>
        </div>
        {f.renting && (<>
          <label className="lbl">Car size</label>
          <div className="seg">{SEATERS.map((s)=>(<button key={s} className={`seg__btn ${f.rentType===s?"seg__btn--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>upd({rentType:s})}>{s}</button>))}</div>
          <label className="lbl">Rental starts — date</label>
          <DateField value={f.rentStartDate} onChange={(v)=>upd({rentStartDate:v})} sfx={sfx} />
          <label className="lbl">Rental starts — time</label>
          <TimeField value={f.rentStartTime} onChange={(v)=>upd({rentStartTime:v})} />
          <p className="hint" style={{marginTop:8}}>We'll match up rentals & seats once everyone's in. 🤝</p>
        </>)}
      </section>
      </>)}

      <section className="card">
        <label className="lbl">Notes <span className="opt">(layovers, who you're meeting, etc.)</span></label>
        <textarea className="in ta" rows={2} value={f.notes} onChange={set("notes")} />
      </section>

      <button data-testid="profile-save" className="save-btn" disabled={saving} onMouseEnter={()=>sfx.play("hover")} onClick={()=>onSave(f)}>{saving ? "Saving…" : "Drop my plans ✨"}</button>
    </div>
  );
}

/* ---------------- COUNTDOWN ---------------- */
function Countdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  let txt, cls = "countdown";
  if (now < FOREST_START_UTC) {
    const d = Math.ceil((FOREST_START_UTC - now) / 86400000);
    txt = d > 1 ? `⏳ ${d} days until the Forest 🌲` : (d === 1 ? "⏳ 1 day until the Forest 🌲" : "🌲 The Forest is today!");
  } else if (now < FOREST_END_UTC) { txt = "🎉 We're in the Forest!"; cls += " countdown--live"; }
  else { txt = "🌲 Until next time…"; }
  return <div className={cls}>{txt}</div>;
}

/* ---------------- HUNT TEASER ---------------- */
/* ---------------- ARTIST DISCOVERY ---------------- */
function ArtistDiscovery({ people, meId, picks, myPicks, onToggle, sfx }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("all");
  const [day, setDay] = useState("all");

  const wanters = (name) => ROSTER.map(r=>r.id).filter((id) => (picks[id]||[]).includes(name));
  const fmt = (s) => { if (!s) return "?"; const [h,m]=s.split(":"); const hr=parseInt(h)%24; return `${hr>12?hr-12:hr||12}:${m}${hr>=12&&hr<24?"pm":"am"}`; };

  const query = q.trim().toLowerCase();
  let shown = ARTISTS;
  if (genre !== "all") shown = shown.filter((a) => a.genres.includes(genre));
  if (day !== "all") shown = shown.filter((a) => getSlots(a.name).some((s)=>s.day===day));
  if (query) shown = shown.filter((a) => a.name.toLowerCase().includes(query));

  const ranked = ARTISTS.map((a) => ({ name: a.name, n: wanters(a.name).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);
  const myCount = myPicks.length;

  return (
    <div className="adisc">
      <button className="adisc__head" onClick={() => { setOpen(!open); sfx.play("tab"); }} aria-expanded={open}>
        <span className="adisc__icon">🎵</span>
        <span className="adisc__htxt">
          <span className="adisc__title">Lineup & must-sees</span>
          <span className="adisc__sub">{myCount ? `${myCount} on your list` : "tap artists you want to catch"} · {ARTISTS.length} artists · 4 days</span>
        </span>
        <span className={`adisc__chev ${open?"adisc__chev--up":""}`}>▾</span>
      </button>

      {open && (
        <div className="adisc__body">
          {ranked.length > 0 && (
            <div className="adisc__crew">
              <span className="adisc__crewlbl">🔥 Crew most-wanted</span>
              <div className="adisc__crewrow">
                {ranked.map((x) => {
                  const slots = getSlots(x.name);
                  const tag = slots.length===1 ? `${DAY_LABELS[slots[0].day]}` : `${slots.length} sets`;
                  return (
                    <button key={x.name} className={`crewpick ${myPicks.includes(x.name)?"crewpick--mine":""}`} onClick={() => onToggle(x.name)}>
                      {x.name} <span className="crewpick__day">{tag}</span><span className="crewpick__n">{x.n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <input className="in adisc__search" placeholder="🔍 search artist…" value={q} onChange={(e)=>setQ(e.target.value)} />

          <div className="adisc__genres">
            <button className={`gpill ${day==="all"?"gpill--on":""}`} onClick={()=>setDay("all")}>All days</button>
            {Object.entries(DAY_LABELS).map(([k,v]) => (
              <button key={k} className={`gpill ${day===k?"gpill--on":""}`} onClick={()=>{ setDay(k); sfx.play("hover"); }}>{v}</button>
            ))}
          </div>
          <div className="adisc__genres" style={{marginTop:4}}>
            <button className={`gpill ${genre==="all"?"gpill--on":""}`} onClick={()=>setGenre("all")}>All genres</button>
            {GENRES.map(([g, label]) => (
              <button key={g} className={`gpill ${genre===g?"gpill--on":""}`} onClick={()=>{ setGenre(g); sfx.play("hover"); }}>{label}</button>
            ))}
          </div>

          <div className="adisc__list">
            {shown.length === 0 ? <p className="hint">No artists match.</p> :
              shown.map((a) => {
                const mine = myPicks.includes(a.name);
                const others = wanters(a.name).filter((id) => id !== meId);
                const slots = getSlots(a.name);
                return (
                  <button key={a.name} className={`achip ${mine?"achip--on":""}`} onClick={() => onToggle(a.name)}>
                    <span className="achip__col">
                      <span className="achip__name">{a.name}{mine && <span className="achip__check"> ✓</span>}</span>
                      {slots.length > 0 && (
                        <span className="achip__slots">
                          {slots.map((s,i) => (
                            <span key={i} className="achip__slot">{DAY_LABELS[s.day]} · {s.stage} · {fmt(s.start)}{s.end?`–${fmt(s.end)}`:""}{s.note?` · ${s.note}`:""}</span>
                          ))}
                        </span>
                      )}
                    </span>
                    {others.length > 0 && (
                      <span className="achip__who">
                        {others.slice(0,4).map((id) => <span key={id} className="achip__face"><Avatar type={people[id]?.avatar} size={18} /></span>)}
                        {others.length > 4 && <span className="achip__more">+{others.length-4}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Conflict detector */}
          {myPicks.length > 1 && (() => {
            const conflicts = [];
            for (let i = 0; i < myPicks.length; i++) for (let j = i+1; j < myPicks.length; j++) {
              const sA = getSlots(myPicks[i]); const sB = getSlots(myPicks[j]);
              for (const a of sA) for (const b of sB) {
                if (a.day !== b.day) continue;
                const toMin = (t) => { if (!t) return -1; const [h,m]=t.split(":").map(Number); return (h<8?h+24:h)*60+m; };
                const as=toMin(a.start),ae=a.end?toMin(a.end):as+90,bs=toMin(b.start),be=b.end?toMin(b.end):bs+90;
                if (as<be && bs<ae) conflicts.push({a:myPicks[i],b:myPicks[j],day:a.day,stageA:a.stage,stageB:b.stage,timeA:`${fmt(a.start)}`,timeB:`${fmt(b.start)}`});
              }
            }
            if (!conflicts.length) return null;
            return (
              <div className="conflicts">
                <span className="conflicts__lbl">⚠️ Clashes on your list</span>
                {conflicts.slice(0,5).map((c,i) => (
                  <div key={i} className="conflict">{c.a} ({c.timeA}) vs {c.b} ({c.timeB}) — both {DAY_LABELS[c.day]}</div>
                ))}
              </div>
            );
          })()}

          <p className="adisc__foot">Tap any artist to add or remove from your list 🌲</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- HUNT TEASER ---------------- */
function HuntGlyph({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="41" height="41" rx="4" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2.5" opacity=".55" />
      <path d="M24 8.5 L34.5 31 H13.5 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 31 V38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <text x="24" y="27" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="Quicksand, sans-serif" fill="currentColor">?</text>
    </svg>
  );
}
function HuntTeaser({ sfx }) {
  return (
    <div className="hunt" onMouseEnter={() => sfx.play("hover")}>
      <div className="hunt__glyph"><HuntGlyph /></div>
      <div className="hunt__body">
        <div className="hunt__top"><h3 className="hunt__title">The Hunt is coming…</h3><span className="hunt__soon">soon</span></div>
        <p className="hunt__copy">The Forest hides a secret quest — riddles, hidden lockboxes, and a password to a stage most Foresters never find. We'll track it right here. <b>First-timers: you're in for something special.</b> 🔍🌲</p>
      </div>
    </div>
  );
}

/* ---------------- PROFILE QUICK GUIDE (shows once per device) ---------------- */
function ProfileGuide({ local, partnerName, sfx }) {
  const [show, setShow] = useState(false);
  useEffect(() => { (async () => {
    try { const r = await window.storage.get("ef26:tut:profile", false); if (!r) setShow(true); }
    catch { setShow(true); }
  })(); }, []);
  const dismiss = async () => { sfx.play("tab"); setShow(false); try { await window.storage.set("ef26:tut:profile", "1", false); } catch {} };
  if (!show) return null;
  return (
    <div data-testid="profile-guide" className="guide">
      <div className="guide__head">🧭 Quick guide — 30 seconds, tops</div>
      <ol className="guide__steps">
        <li><b>Pick your forest spirit</b> — your avatar. One each; greyed-out ones are taken.</li>
        {local ? (
          <li><b>You're the local</b> — no travel form for you. Skip straight to notes. 🏙️</li>
        ) : (<>
          <li><b>Travel</b> — flying or driving, where from, the day + time you land in Chicago, and which airport. Flight # helps us track you. ✈️</li>
          <li><b>Renting a car?</b> Tap Yes and tell us the size + when it starts, so we can plan seats. 🚙</li>
        </>)}
        {partnerName && !local && <li><b>Same trip as {partnerName}?</b> One tap copies their travel. ♡</li>}
        <li><b>Notes</b> for anything else, then hit <b>Drop my plans ✨</b></li>
        <li>After saving, open the <b>🎒 Gear tab</b> — claim what you're bringing and flag what the camp still needs.</li>
      </ol>
      <p className="guide__foot">You can come back and edit anytime via <b>✎ My plans</b> on the board.</p>
      <button data-testid="guide-dismiss" className="chip" onMouseEnter={()=>sfx.play("hover")} onClick={dismiss}>Got it ✨</button>
    </div>
  );
}

/* ---------------- SEAL YOUR VIAL (one and done) ---------------- */
function SealVial({ name, saving, onSeal, onBack, flash, sfx }) {
  const [text, setText] = useState("");
  const [arm, setArm] = useState(false);
  const n = text.trim().length;
  const ok = n >= 100;
  const copyIt = async () => {
    try { await navigator.clipboard.writeText(text); flash("Copied — paste it in your Notes 📋"); }
    catch {
      try { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); flash("Copied — paste it in your Notes 📋"); }
      catch { flash("Couldn't copy — select & copy it manually"); }
    }
  };
  const seal = () => {
    if (!ok) { sfx.play("seal"); flash("At least 100 characters — make it juicy! 🔮"); return; }
    if (!arm) { sfx.play("tab"); setArm(true); return; }
    onSeal(text);
  };
  return (
    <div className="profile sealv">
      <button className="ghost-btn" onMouseEnter={()=>sfx.play("hover")} onClick={onBack}>← not you? back to names</button>
      <h2 className="profile__title">First things first, {name} — your prophecy 🔮</h2>
      <section className="card card--vial">
        <p className="opt" style={{margin:"0 0 8px"}}>Before anything else: write your prediction for the weekend. <b>One vial per Forester. Once sealed, NOBODY can read it — not you, not Andy — until Sunday, Jun 28 at 8 PM ET — the Forest’s last night.</b> No edits, no do-overs. So go big — be specific, be bold, be weird. Think about:</p>
        <ul className="prompts">
          <li>How do you think the whole weekend's gonna go?</li>
          <li>A specific prediction about someone in the crew?</li>
          <li>The one set or moment you're most looking forward to?</li>
          <li>Something wild you think will happen to us?</li>
        </ul>
        <textarea className="in ta" rows={6} autoFocus placeholder="e.g. Andy disappears into the Sherwood for 3 hours and comes back with 4 new best friends. Srikar goes into the forest and comes out like a totally normal person — nothing happens to him. We all cry at the Sunday closer…"
          data-testid="prediction-input" value={text} onChange={(e)=>{ setText(e.target.value); if (arm) setArm(false); }} />
        <div data-testid="prediction-counter" className={`counter ${ok?"counter--ok":""}`}>{n}/100 {ok ? "✓" : "min"}</div>
        <div className="sealv__row">
          <button data-testid="prediction-copy" className="chip" onMouseEnter={()=>sfx.play("hover")} onClick={copyIt}>📋 Copy my prediction</button>
          <span className="sealv__hint">want a keepsake? copy it into your Notes <b>before</b> you seal — there's no reading it back.</span>
        </div>
      </section>
      <button data-testid="prediction-seal" className={`save-btn ${arm?"save-btn--arm":""}`} disabled={saving}
        onMouseEnter={()=>sfx.play("hover")} onClick={seal}>
        {saving ? "Sealing…" : arm ? "⚠️ Tap again to seal — no take-backs!" : "Seal my vial forever 🔒"}
      </button>
    </div>
  );
}

/* ---------------- PIN GATE ---------------- */
function PinGate({ id, name, filled, pinHash, onAuthed, onCancel, onPinSet, flash, sfx }) {
  const loading = pinHash === undefined;
  const [mode, setMode] = useState(loading ? null : (pinHash ? "enter" : "set"));
  useEffect(() => { if (!loading) setMode((m) => (m === null ? (pinHash ? "enter" : "set") : m)); }, [loading, pinHash]);
  const [pin, setPin] = useState("");
  const [resetting, setResetting] = useState(false);
  const [code, setCode] = useState("");
  const digits = (s) => s.replace(/\D/g, "").slice(0, 4);

  const submitEnter = () => {
    if (hashPin(pin) === pinHash) { sfx.play("save"); onAuthed(); }
    else { sfx.play("seal"); flash("That PIN doesn't match 🔒"); setPin(""); }
  };
  const submitSet = async () => {
    if (pin.length === 4) { await setPinHash(id, pin); if (onPinSet) onPinSet(id, hashPin(pin)); sfx.play("save"); flash("PIN set — only you can pick your name now 🔒"); onAuthed(); }
    else { flash("Enter 4 digits, or skip"); }
  };
  const doReset = async () => {
    if (normCode(code) === CAMP_CODE) { await clearPin(id); if (onPinSet) onPinSet(id, null); setResetting(false); setMode("set"); setPin(""); flash("PIN cleared — set a new one"); }
    else { sfx.play("seal"); flash("Camp code didn't match"); }
  };

  return (
    <div className="pin">
      <button className="pin__back" onClick={onCancel}>← names</button>
      <div className="pin__spirit"><Avatar type={null} size={54} /></div>
      <h2 className="pin__title">{mode === "enter" ? `${name}'s PIN` : `Enter as ${name}`}</h2>
      {mode === null ? (
        <p className="pin__hint">checking the vault… 🔑</p>
      ) : mode === "enter" ? (
        resetting ? (
          <>
            <p className="pin__hint">Forgot it? Enter the camp code to clear this PIN, then set a new one.</p>
            <input className="in pin__in" style={{ letterSpacing: ".05em", fontSize: 16 }} placeholder="camp code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doReset()} />
            <button className="save-btn" onClick={doReset}>Clear PIN</button>
            <button className="pin__link" onClick={() => setResetting(false)}>cancel</button>
          </>
        ) : (
          <>
            <p className="pin__hint">Enter your 4-digit PIN to continue.</p>
            <input className="in pin__in" inputMode="numeric" autoFocus placeholder="••••" value={pin} onChange={(e) => setPin(digits(e.target.value))} onKeyDown={(e) => e.key === "Enter" && submitEnter()} />
            <button className="save-btn" onClick={submitEnter}>Enter ✨</button>
            <button className="pin__link" onClick={() => setResetting(true)}>Forgot PIN?</button>
          </>
        )
      ) : (
        <>
          <p className="pin__hint">{filled ? "Set a 4-digit PIN so nobody picks your name by accident — or skip it." : "Optional: set a 4-digit PIN so only you can edit your card. You can skip this."}</p>
          <input className="in pin__in" inputMode="numeric" autoFocus placeholder="••••" value={pin} onChange={(e) => setPin(digits(e.target.value))} onKeyDown={(e) => e.key === "Enter" && submitSet()} />
          <button className="save-btn" onClick={submitSet}>Set PIN & continue 🔒</button>
          <button data-testid="pin-skip" className="pin__link" onClick={() => { sfx.play("pick"); onAuthed(); }}>Skip — no PIN</button>
        </>
      )}
    </div>
  );
}

/* ---------------- CREW MAP (live GPS) ---------------- */
const EF_STAGES = [
  { name:"Center Stage",       lat:43.52867034, lng:-86.36530036 },
  { name:"Sherwood Court",     lat:43.52842335, lng:-86.36285314 },
  { name:"Ranch Arena",        lat:43.52224425, lng:-86.36445855 },
  { name:"GA Pre-set Camping", lat:43.51960838, lng:-86.37306013 },
  { name:"The Observatory",    lat:43.5255,     lng:-86.3621 },
  { name:"Honeycomb",          lat:43.5263,     lng:-86.3637 },
  { name:"Grand Artique",      lat:43.5248,     lng:-86.3643 },
  { name:"Tripolee",           lat:43.5208,     lng:-86.3698 },
];
const GROUNDS_CENTER = [43.5240, -86.3650];
const LOC_PREFIX = "ef26:loc:";
const agoStr = (ts) => { const s=Math.max(0,Math.round((Date.now()-ts)/1000)); if(s<60) return s+"s ago"; const m=Math.round(s/60); if(m<60) return m+"m ago"; return Math.round(m/60)+"h ago"; };

function CrewMap({ meId, onClose, sfx }) {
  const elRef = useRef(null), mapRef = useRef(null), markersRef = useRef({});
  const watchRef = useRef(null), lastPushRef = useRef(0), centeredRef = useRef(false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState("Satellite of the grounds. Tap “Share my location” so the crew can find you.");

  useEffect(() => {
    if (!window.L) { setStatus("Map library didn't load — check your connection."); return; }
    const map = window.L.map(elRef.current, { zoomControl:true, attributionControl:false }).setView(GROUNDS_CENTER, 16);
    window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom:19 }).addTo(map);
    EF_STAGES.forEach(s => window.L.marker([s.lat,s.lng], { icon: window.L.divIcon({ className:"", html:`<div class="cm-stage">⭐ ${s.name}</div>`, iconSize:[1,1] }) }).addTo(map));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const renderCrew = useCallback((rows) => {
    const map = mapRef.current; if (!map || !window.L) return;
    rows.forEach((r) => {
      let v = r.value; try { if (typeof v === "string") v = JSON.parse(v); } catch { return; }
      const id = r.key.slice(LOC_PREFIX.length);
      if (!v || v.sharing===false || v.lat==null) {
        const m0 = markersRef.current[id]; if (m0) { map.removeLayer(m0); delete markersRef.current[id]; } return;
      }
      const ts = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
      const stale = Date.now()-ts > 120000, isMe = id===meId, hue = hueFor(id);
      const html = `<div class="cm-pin ${stale?'cm-stale':''}"><span class="cm-dot ${isMe?'cm-me':''}" style="background:hsl(${hue} 80% 60%)"></span><span class="cm-name">${nameOf(id)} · ${agoStr(ts)}</span></div>`;
      const icon = window.L.divIcon({ className:"", html, iconSize:[1,1] });
      const m = markersRef.current[id];
      if (m) m.setLatLng([v.lat,v.lng]).setIcon(icon);
      else markersRef.current[id] = window.L.marker([v.lat,v.lng], { icon }).addTo(map);
    });
  }, [meId]);

  useEffect(() => {
    let alive = true;
    const tick = async () => { try { const r = await window.storage.listFull(LOC_PREFIX, true); if (alive && r && r.items) renderCrew(r.items); } catch {} };
    tick(); const iv = setInterval(tick, 10000);
    return () => { alive=false; clearInterval(iv); };
  }, [renderCrew]);

  const startShare = () => {
    if (!navigator.geolocation) { setStatus("Location isn't available on this device."); return; }
    sfx.play("tab");
    watchRef.current = navigator.geolocation.watchPosition((pos) => {
      const { latitude:lat, longitude:lng, accuracy:acc } = pos.coords;
      renderCrew([{ key:LOC_PREFIX+meId, value:{ name:nameOf(meId), lat, lng, acc, sharing:true }, updated_at:new Date().toISOString() }]);
      if (mapRef.current && !centeredRef.current) { mapRef.current.setView([lat,lng], 17); centeredRef.current = true; }
      if (Date.now()-lastPushRef.current > 30000) { lastPushRef.current = Date.now();
        window.storage.set(LOC_PREFIX+meId, JSON.stringify({ name:nameOf(meId), lat, lng, acc, sharing:true }), true).catch(()=>{}); }
    }, (err) => setStatus("Location error: "+err.message+(err.code===1?" — allow location access in settings.":"")),
       { enableHighAccuracy:true, maximumAge:5000, timeout:20000 });
    setSharing(true); setStatus("Sharing your location with the crew (while this map is open).");
  };
  const stopShare = async () => {
    if (watchRef.current!=null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    setSharing(false); setStatus("Stopped sharing. Your dot will fade for the crew.");
    try { await window.storage.set(LOC_PREFIX+meId, JSON.stringify({ name:nameOf(meId), sharing:false }), true); } catch {}
    const m = markersRef.current[meId]; if (m && mapRef.current) { mapRef.current.removeLayer(m); delete markersRef.current[meId]; }
  };
  useEffect(() => () => { if (watchRef.current!=null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current); }, []);

  return (
    <div className="crewmap">
      <div className="crewmap__el" ref={elRef} />
      <div className="crewmap__top">
        <button className="chip chip--ghost" onClick={onClose}>✕ Close</button>
        <button data-testid="map-share" className="chip" onClick={sharing?stopShare:startShare}>{sharing?"🛑 Stop sharing":"📍 Share my location"}</button>
      </div>
      {status && <div className="crewmap__status">{status}</div>}
    </div>
  );
}

/* ---------------- MAP TAB ---------------- */
function MapTab({ meId, sfx }) {
  const elRef = useRef(null), mapRef = useRef(null), markersRef = useRef({});
  const watchRef = useRef(null), lastPushRef = useRef(0), centeredRef = useRef(false);
  const satLayerRef = useRef(null), streetsLayerRef = useRef(null), ovLayerRef = useRef(null);
  const snackTimer = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [satOn, setSatOn] = useState(true);
  const [ovOn, setOvOn] = useState(false);
  const [snack, setSnack] = useState("Tap 📍 to share your location with the crew.");

  const toast = (msg) => {
    setSnack(msg);
    clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(""), 4000);
  };

  useEffect(() => {
    if (!window.L || !elRef.current) return;
    const map = window.L.map(elRef.current, { zoomControl:false, attributionControl:false }).setView(GROUNDS_CENTER, 16);
    const sat = window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom:19 });
    const streets = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 });
    sat.addTo(map);
    satLayerRef.current = sat;
    streetsLayerRef.current = streets;
    EF_STAGES.forEach(s => window.L.marker([s.lat, s.lng], {
      icon: window.L.divIcon({ className:"", html:`<div class="cm-stage">⭐ ${s.name}</div>`, iconSize:[1,1] })
    }).addTo(map));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const renderCrew = useCallback((rows) => {
    const map = mapRef.current; if (!map || !window.L) return;
    rows.forEach((r) => {
      let v = r.value; try { if (typeof v === "string") v = JSON.parse(v); } catch { return; }
      const id = r.key.slice(LOC_PREFIX.length);
      if (!v || v.sharing === false || v.lat == null) {
        const m0 = markersRef.current[id]; if (m0) { map.removeLayer(m0); delete markersRef.current[id]; } return;
      }
      const ts = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
      const stale = Date.now() - ts > 120000, isMe = id === meId, hue = hueFor(id);
      const html = `<div class="cm-pin ${stale?'cm-stale':''}"><span class="cm-dot ${isMe?'cm-me':''}" style="background:hsl(${hue} 80% 60%)"></span><span class="cm-name">${nameOf(id)} · ${agoStr(ts)}</span></div>`;
      const icon = window.L.divIcon({ className:"", html, iconSize:[1,1] });
      const m = markersRef.current[id];
      if (m) m.setLatLng([v.lat, v.lng]).setIcon(icon);
      else markersRef.current[id] = window.L.marker([v.lat, v.lng], { icon }).addTo(map);
    });
  }, [meId]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try { const r = await window.storage.listFull(LOC_PREFIX, true); if (alive && r && r.items) renderCrew(r.items); } catch {}
    };
    tick(); const iv = setInterval(tick, 10000);
    return () => { alive = false; clearInterval(iv); };
  }, [renderCrew]);

  const startShare = () => {
    if (!navigator.geolocation) { toast("Location isn't available on this device."); return; }
    sfx.play("tab");
    watchRef.current = navigator.geolocation.watchPosition((pos) => {
      const { latitude:lat, longitude:lng, accuracy:acc } = pos.coords;
      renderCrew([{ key:LOC_PREFIX+meId, value:{ name:nameOf(meId), lat, lng, acc, sharing:true }, updated_at:new Date().toISOString() }]);
      if (mapRef.current && !centeredRef.current) { mapRef.current.setView([lat,lng], 17); centeredRef.current = true; }
      if (Date.now()-lastPushRef.current > 30000) {
        lastPushRef.current = Date.now();
        window.storage.set(LOC_PREFIX+meId, JSON.stringify({ name:nameOf(meId), lat, lng, acc, sharing:true }), true).catch(()=>{});
      }
    }, (err) => toast("Location error: "+err.message+(err.code===1?" — allow location in settings.":"")),
      { enableHighAccuracy:true, maximumAge:5000, timeout:20000 });
    setSharing(true);
    toast("Sharing your location with the crew.");
  };

  const stopShare = async () => {
    if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null; centeredRef.current = false;
    setSharing(false);
    toast("Stopped sharing.");
    try { await window.storage.set(LOC_PREFIX+meId, JSON.stringify({ name:nameOf(meId), sharing:false }), true); } catch {}
    const m = markersRef.current[meId]; if (m && mapRef.current) { mapRef.current.removeLayer(m); delete markersRef.current[meId]; }
  };

  useEffect(() => () => {
    if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  const toggleSat = () => {
    if (!mapRef.current) return;
    if (satOn) { mapRef.current.removeLayer(satLayerRef.current); streetsLayerRef.current.addTo(mapRef.current); }
    else { mapRef.current.removeLayer(streetsLayerRef.current); satLayerRef.current.addTo(mapRef.current); }
    setSatOn(v => !v); sfx.play("tab");
  };

  const toggleOverlay = () => {
    if (!mapRef.current || !window.L) return;
    if (ovOn) {
      if (ovLayerRef.current) { mapRef.current.removeLayer(ovLayerRef.current); ovLayerRef.current = null; }
    } else {
      ovLayerRef.current = window.L.imageOverlay("venue-map.jpg", [[43.5193,-86.3722],[43.5298,-86.3599]], { opacity:0.65 }).addTo(mapRef.current);
    }
    setOvOn(v => !v); sfx.play("tab");
  };

  return (
    <div className="maptab">
      <div className="maptab__el" ref={elRef} />
      <div className="maptab__fabs">
        <button className={`maptab__fab${satOn?"":" maptab__fab--active"}`} onClick={toggleSat} title="Toggle satellite/streets">
          {satOn ? "🛰️" : "🗺️"}
        </button>
        <button className={`maptab__fab${ovOn?" maptab__fab--active":""}`} onClick={toggleOverlay} title="Toggle EF venue map">
          🌲
        </button>
      </div>
      <button className={`maptab__share${sharing?" maptab__share--stop":""}`} onClick={sharing?stopShare:startShare}>
        {sharing ? "🛑" : "📍"}
      </button>
      {snack && <div className="maptab__snack">{snack}</div>}
    </div>
  );
}

/* ---------------- HUB ---------------- */
function Hub({ people, meId, tab, setTab, gear, setGear, msgs, setMsgs, picks, setPicks, unread, onEdit, onRefresh, onSwitch, sfx }) {
  const [seenTabs, setSeenTabs] = useState(() => { try { return JSON.parse(localStorage.getItem("ef26:seentabs") || "{}"); } catch { return {}; } });
  const seeTab = (t) => { setTab(t); if (!seenTabs[t]) { const n = { ...seenTabs, [t]: 1 }; setSeenTabs(n); try { localStorage.setItem("ef26:seentabs", JSON.stringify(n)); } catch {} } };
  const myPicks = picks[meId] || [];
  const togglePick = async (name) => {
    const has = myPicks.includes(name);
    const next = has ? myPicks.filter((n) => n !== name) : [...myPicks, name];
    setPicks((p) => ({ ...p, [meId]: next }));
    sfx.play(has ? "tab" : "pick");
    try { await window.storage.set(`ef26:picks:${meId}`, JSON.stringify(next), true); } catch {}
  };
  const list = ROSTER.map(r=>people[r.id]).filter(p=>p.filled);
  const ready = list.length, pct = Math.round((ready/ROSTER.length)*100);
  const meName = ROSTER.find(r=>r.id===meId)?.name;
  const convoy = [...list].sort((a,b)=>sortKey(a).localeCompare(sortKey(b)));
  const [showStatus, setShowStatus] = useState(false);
  const vialsOpen = Date.now() >= VIAL_OPEN_UTC;
  const [revealed, setRevealed] = useState({});
  useEffect(() => { if (!vialsOpen) return; let live = true; (async () => {
    const out = {};
    for (const p of ROSTER.map(r=>people[r.id]).filter(p=>p.filled)) {
      out[p.id] = isSealed(p.prediction) ? ((await unsealText(p.prediction)) ?? "…this vial wouldn't open 😢") : p.prediction;
    }
    if (live) setRevealed(out);
  })(); return () => { live = false; }; }, [vialsOpen, ready, people]);

  const RevealCard = ({ p }) => {
    const r = ROSTER.find(x=>x.id===p.id); const hue = hueFor(p.id);
    return (
      <div className="reveal" onMouseEnter={()=>sfx.play("hover")}>
        <div className="reveal__head"><span className="reveal__av" style={{ boxShadow:`0 0 14px hsla(${hue},90%,60%,.7)` }}><Avatar type={p.avatar} size={30} /></span><span className="reveal__name">{r.name}</span></div>
        <p className="reveal__text">“{revealed[p.id] ?? "…unsealing 🔑"}”</p>
      </div>
    );
  };

  const Card = ({ p }) => {
    const r = ROSTER.find(x=>x.id===p.id);
    return (
      <div data-testid={`convoy-${p.id}`} className={`trav ${p.id===meId?"trav--me":""}`}>
        <span className="trav__av"><Avatar type={p.avatar} size={42} /></span>
        <div className="trav__body">
          <div className="trav__top"><span className="trav__name">{r.name}</span>{r.solo && <span className="mini-tag">solo</span>}{!r.local && <span className="trav__mode">{modeMeta(p.mode).icon}</span>}</div>
          {r.local ? (
            <div className="trav__local">🏙️ Local — already in Chicago</div>
          ) : (<>
            <div className="trav__meta">{p.origin && <span>{p.origin} → </span>}<span>{p.arrPoint}</span></div>
            <div className="trav__when">{fmtWhen(p.arrDate,p.arrTime)}{p.flightNo?` · ${p.flightNo}`:""}</div>
            {p.renting && <div className="trav__rent">🚙 {p.rentType} rental{p.rentStartDate||p.rentStartTime?` · from ${fmtWhen(p.rentStartDate,p.rentStartTime)}`:""}</div>}
          </>)}
          {p.notes && <div className="trav__notes">“{p.notes}”</div>}
        </div>
      </div>
    );
  };
  const VialCard = ({ p }) => {
    const r = ROSTER.find(x=>x.id===p.id); const hue = hueFor(p.id);
    return (
      <div className="vial" onMouseEnter={()=>sfx.play("hover")}>
        <div className="vial__cork"/>
        <div className="vial__glass">
          <div className="vial__liquid" style={{ background:`linear-gradient(180deg, hsla(${hue},90%,66%,.92), hsla(${(hue+40)%360},90%,46%,.95))` }}/>
          <span className="vial__q">?</span><span className="vial__lock">🔒</span>
        </div>
        <span className="vial__av"><Avatar type={p.avatar} size={22} /></span>
        <span className="vial__name">{r.name}</span>
      </div>
    );
  };

  return (
    <div className="hub">
      <header className="hub__head">
        <div><p className="eyebrow">Phase 1 · Getting to the Forest</p><h1 className="hub__title glow-pulse">Happy Forest!</h1><p className="festline">{FEST.label} · {FEST.place}</p><Countdown /></div>
        <button data-testid="fillvial" className="cauldron" onMouseEnter={()=>sfx.play("hover")} onClick={()=>{ sfx.play("tab"); setShowStatus(true); }}
          aria-label={`${ready} of 10 potions filled. Tap to see who still has to fill theirs.`}>
          <span className="cauldron__cork"/>
          <span className="cauldron__glass">
            <span className="cauldron__liquid" style={{ height:`${Math.max(10,pct)}%` }}/>
            <span className="cauldron__count">{ready}<span className="cauldron__den">/10</span></span>
          </span>
          <span className="cauldron__tap">who's left?</span>
        </button>
      </header>

      <div className="hub__bar">
        <span className="hi">hey {meName} 👋</span>
        <div className="hub__actions">
          <button data-testid="hub-myplans" className="chip" onMouseEnter={()=>sfx.play("hover")} onClick={onEdit}>✎ My plans</button>
          <button data-testid="hub-refresh" className="chip" onMouseEnter={()=>sfx.play("hover")} onClick={onRefresh}>↻ Refresh</button>
          <button data-testid="hub-switch" className="chip chip--ghost" onMouseEnter={()=>sfx.play("hover")} onClick={onSwitch}>Not you?</button>
        </div>
      </div>

      <ArtistDiscovery people={people} meId={meId} picks={picks} myPicks={myPicks} onToggle={togglePick} sfx={sfx} />

      <HuntTeaser sfx={sfx} />

      <div className="tabs">
        <button data-testid="tab-convoy" className={`tab ${tab==="convoy"?"tab--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>setTab("convoy")}><span className="tab__ic">🚐</span><span className="tab__lb">Convoy</span></button>
        <button data-testid="tab-gear" className={`tab ${tab==="gear"?"tab--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>seeTab("gear")}><span className="tab__ic">🎒</span><span className="tab__lb">Gear</span>{!seenTabs.gear && tab!=="gear" && <span className="tab__dot" />}</button>
        <button data-testid="tab-chat" className={`tab ${tab==="chat"?"tab--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>seeTab("chat")}><span className="tab__ic">💬</span><span className="tab__lb">Campfire</span>{unread>0 && <span className="tab__badge">{unread>9?"9+":unread}</span>}</button>
        <button data-testid="tab-vials" className={`tab ${tab==="vials"?"tab--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>seeTab("vials")}><span className="tab__ic">🔮</span><span className="tab__lb">Vials</span>{!seenTabs.vials && tab!=="vials" && <span className="tab__dot" />}</button>
        <button data-testid="tab-map" className={`tab ${tab==="map"?"tab--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>seeTab("map")}><span className="tab__ic">🗺️</span><span className="tab__lb">Map</span></button>
      </div>

      {tab==="convoy" ? (
        ready===0 ? <div className="empty">No plans dropped yet — be the first firefly in. ✨</div> : (
          <div className="stack"><p className="hint">Everyone's arrival into Chicago, earliest first.</p>{convoy.map(p=><Card key={p.id} p={p} />)}</div>
        )
      ) : tab==="gear" ? (
        <GearBoard meId={meId} people={people} items={gear} setItems={setGear} sfx={sfx} />
      ) : tab==="chat" ? (
        <Campfire meId={meId} people={people} msgs={msgs} setMsgs={setMsgs} sfx={sfx} />
      ) : tab==="map" ? (
        <MapTab meId={meId} sfx={sfx} />
      ) : (
        <div className="vault">
          {vialsOpen ? (<>
            <p className="vault__intro">🔓 The vials have cracked open — here's what everyone foresaw. 🌙</p>
            {ready===0 ? <div className="empty">No predictions were sealed. 🔮</div> : (<div className="reveal-list">{list.map(p=><RevealCard key={p.id} p={p} />)}</div>)}
          </>) : (<>
            <p className="vault__intro">{ready} {ready===1?"vial":"vials"} sealed until Sunday, Jun 28 at 8 PM ET — encrypted in your browser before they're saved. Even Andy won’t see your predictions — writers can’t reread their own either. One and done. Promise! 🤝🔮</p>
            {ready===0 ? <div className="empty">No predictions sealed yet. 🔮</div> : (<div className="vialshelf">{list.map(p=><VialCard key={p.id} p={p} />)}</div>)}
          </>)}
        </div>
      )}

      <footer className="hub__foot">MORE FUN TO COME! HAPPY FOREST!</footer>
      {showStatus && <StatusModal people={people} ready={ready} onClose={()=>{ sfx.play("tab"); setShowStatus(false); }} onSwitch={onSwitch} sfx={sfx} />}
    </div>
  );
}

/* ---------------- POTION STATUS MODAL ---------------- */
function StatusModal({ people, ready, onClose, onSwitch, sfx }) {
  const empties = ORDER.filter((r)=>!people[r.id].filled);
  const fulls = ORDER.filter((r)=>people[r.id].filled);
  const Row = ({ r, done }) => (
    <div data-testid={`strow-${r.id}`} className={`strow ${done?"strow--done":"strow--todo"}`}>
      <span className="strow__av">{done ? <Avatar type={people[r.id].avatar} size={30} /> : <span className="strow__empty">🫙</span>}</span>
      <span className="strow__name">{r.name}{r.solo ? <em className="strow__tag"> · solo</em> : <em className="strow__tag"> · ♡ {r.partner}</em>}</span>
      <span className="strow__badge">{done ? "✓ full" : "empty"}</span>
    </div>
  );
  return (
    <div className="modal" onClick={onClose}>
      <div data-testid="status-modal" className="sheet" onClick={(e)=>e.stopPropagation()}>
        <button className="sheet__x" onClick={onClose} aria-label="Close">✕</button>
        <h3 className="sheet__title">🧪 The crew's potions</h3>
        <p className="sheet__sub">{ready}/10 filled. Tap a name on the home screen to fill yours.</p>
        {empties.length > 0 && (<>
          <p className="sheet__head sheet__head--todo">Still to fill ({empties.length})</p>
          {empties.map((r)=><Row key={r.id} r={r} done={false} />)}
        </>)}
        {fulls.length > 0 && (<>
          <p className="sheet__head sheet__head--done">Potions full ({fulls.length})</p>
          {fulls.map((r)=><Row key={r.id} r={r} done={true} />)}
        </>)}
        <button data-testid="status-back" className="sheet__switch" onMouseEnter={()=>sfx.play("hover")} onClick={onSwitch}>↩ Back to the name screen</button>
      </div>
    </div>
  );
}

/* ---------------- GEAR BOARD ---------------- */
function GearBoard({ meId, people, items, setItems, sfx }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("bringing");
  const [note, setNote] = useState("");

  const add = async () => {
    if (!name.trim()) { return; }
    const id = `${Date.now()}_${rnd()}`;
    const item = { id, name: name.trim(), status, bringerId: status === "bringing" ? meId : null, note: note.trim(), addedBy: meId, ts: Date.now() };
    setItems((s) => [...s, { key: `ef26:gear:${id}`, ...item }]);
    try { await window.storage.set(`ef26:gear:${id}`, JSON.stringify(item), true); sfx.play("pick"); } catch {}
    setName(""); setNote(""); setStatus("bringing");
  };
  const claim = async (it) => {
    const upd = { ...it, bringerId: meId, status: "bringing" }; delete upd.key;
    setItems((s) => s.map((x) => x.key === it.key ? { key: it.key, ...upd } : x));
    try { await window.storage.set(it.key, JSON.stringify(upd), true); sfx.play("tab"); } catch {}
  };
  const remove = async (it) => {
    if (it.addedBy !== meId) return;
    try { await window.storage.delete(it.key, true); sfx.play("tab"); } catch {}
    setItems((s) => s.filter((x) => x.key !== it.key));
  };

  const order = { bringing: 0, buy_chicago: 1, buy_onway: 2, needed: 3 };
  const sorted = [...items].sort((a, b) => (order[a.status] - order[b.status]) || a.ts - b.ts);

  return (
    <div className="gear">
      <section className="card">
        <label className="lbl">Add gear — what are we bringing?</label>
        <input data-testid="gear-name" className="in" placeholder="e.g. Camp flag / totem topper" value={name} onChange={(e)=>setName(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&add()} />
        <p className="hint" style={{margin:"8px 0 2px"}}>✈️ Most of us are flying — these pack easily. Bulky stuff (chairs, cooler, canopy) → add it and set status to <b>Buy in Chicago</b>.</p>
        <div className="chips-wrap">{GEAR_SUGGESTIONS.map((g)=>(
          <button key={g} className="gchip" onMouseEnter={()=>sfx.play("hover")} onClick={()=>{ setName(g); sfx.play("tab"); }}>{g}</button>
        ))}</div>
        <label className="lbl">Status</label>
        <div className="seg">{GEAR_STATUS.map((s)=>(
          <button data-testid={`gear-status-${s.v}`} key={s.v} className={`seg__btn ${status===s.v?"seg__btn--on":""}`} onMouseEnter={()=>sfx.play("hover")} onClick={()=>setStatus(s.v)}>{s.label}</button>
        ))}</div>
        <input className="in" style={{marginTop:10}} placeholder="note (optional) — e.g. fits in checked bag" value={note} onChange={(e)=>setNote(e.target.value)} />
        <button data-testid="gear-add" className="save-btn" style={{marginTop:12}} onMouseEnter={()=>sfx.play("hover")} onClick={add}>＋ Add to the list</button>
      </section>

      {sorted.length===0 ? (
        <div className="empty">No gear yet. Add the first thing — totem, cooler, speaker… 🎒</div>
      ) : (
        <div className="stack">
          {sorted.map((it) => {
            const m = gearMeta(it.status), mine = it.addedBy === meId, bringer = it.bringerId;
            return (
              <div data-testid={`gear-${it.id}`} className={`gitem gitem--${it.status}`} key={it.key}>
                <div className="gitem__body">
                  <div className="gitem__name">{it.name}</div>
                  {it.note && <div className="gitem__note">{it.note}</div>}
                  <div className="gitem__who">
                    {it.status==="bringing" && bringer
                      ? <span className="gitem__bring"><Avatar type={people[bringer]?.avatar} size={20} /> {nameOf(bringer)}'s got it ✅</span>
                      : <span className="gitem__need">{m.label}</span>}
                  </div>
                </div>
                <div className="gitem__actions">
                  {it.status!=="bringing" && <button data-testid="gear-claim" className="chip" onMouseEnter={()=>sfx.play("hover")} onClick={()=>claim(it)}>🙋 I'll bring it</button>}
                  {mine && <button className="chip chip--ghost" onClick={()=>remove(it)} title="Remove (you added this)">✕</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- CAMPFIRE (group chat) ---------------- */
function Campfire({ meId, people, msgs, setMsgs, sfx }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim()) return;
    const id = `${Date.now()}_${rnd()}`;
    const m = { author: meId, text: text.trim(), ts: Date.now() };
    setMsgs((s) => [...s, { key: `ef26:msg:${id}`, ...m }]);
    setText("");
    try { await window.storage.set(`ef26:msg:${id}`, JSON.stringify(m), true); sfx.play("tab"); } catch {}
  };
  const del = async (m) => {
    if (m.author !== meId) return;
    try { await window.storage.delete(m.key, true); } catch {}
    setMsgs((s) => s.filter((x) => x.key !== m.key));
  };

  return (
    <div className="fire">
      <p className="hint">🔥 Crew chat — everyone who joins sees the whole thread. Plan rides, grocery runs, gate-day meetups…</p>
      <div className="fire__log">
        {msgs.length===0 ? (
          <div className="empty">Quiet around the campfire. Say hi! 👋</div>
        ) : msgs.map((m) => {
          const mine = m.author === meId;
          return (
            <div data-testid="chat-bubble" className={`bubble ${mine?"bubble--me":""}`} key={m.key}>
              {!mine && <span className="bubble__av"><Avatar type={people[m.author]?.avatar} size={28} /></span>}
              <div className="bubble__col">
                <div className="bubble__meta">{mine?"You":nameOf(m.author)} · {fmtClock(m.ts)}</div>
                <div className="bubble__text">{m.text}</div>
                {mine && <button className="bubble__del" onClick={()=>del(m)} title="Delete">✕</button>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="fire__bar">
        <input data-testid="chat-input" className="in" placeholder="message the crew…" value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&send()} />
        <button data-testid="chat-send" className="fire__send" onMouseEnter={()=>sfx.play("hover")} onClick={send}>Send</button>
      </div>
    </div>
  );
}

/* ---------------- FIREFLIES + TREELINE ---------------- */
function Fireflies() {
  return (<div className="ff" aria-hidden>{Array.from({length:12}).map((_,i)=>(
    <span key={i} className="ff__d" style={{ left:`${(i*41)%100}%`, top:`${(i*59)%100}%`, animationDelay:`${(i%7)*0.7}s`, animationDuration:`${6+(i%5)}s` }} />
  ))}</div>);
}
function TreeLine() {
  const Pine = ({ x, base, h, w, fill }) => {
    const tip = base - h, half = w / 2;
    return (<g fill={fill}><rect x={x-4} y={base-10} width="8" height="20" fill="#1a120a"/>
      <polygon points={`${x},${tip} ${x-half},${base-h*0.46} ${x+half},${base-h*0.46}`}/>
      <polygon points={`${x},${tip+h*0.22} ${x-half*1.18},${base-h*0.2} ${x+half*1.18},${base-h*0.2}`}/>
      <polygon points={`${x},${tip+h*0.46} ${x-half*1.34},${base} ${x+half*1.34},${base}`}/></g>);
  };
  const back = [[80,150,70],[260,180,80],[470,160,74],[700,185,84],[940,155,72],[1120,175,80]];
  const front = [[40,180,90],[170,210,104],[330,190,96],[520,220,110],[720,195,98],[920,215,108],[1080,185,92],[1180,205,100]];
  const lights = [[150,90],[330,70],[560,60],[760,80],[980,66],[1130,86],[440,110],[860,104]];
  return (
    <div className="treeline" aria-hidden>
      <svg viewBox="0 0 1200 230" preserveAspectRatio="xMidYEnd slice" width="100%" height="100%">
        <defs><filter id="tglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <rect x="0" y="180" width="1200" height="50" fill="url(#ground)"/>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(60,255,170,.10)"/><stop offset="100%" stopColor="rgba(8,19,13,0)"/></linearGradient>
        <g className="tl-back">{back.map(([x,h,w],i)=><Pine key={i} x={x} base={230} h={h} w={w} fill="#0c2417"/>)}</g>
        <g>{front.map(([x,h,w],i)=><Pine key={i} x={x} base={230} h={h} w={w} fill="#071710"/>)}</g>
        <g>{lights.map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="2.4" fill={i%3===0?"#f4e02a":i%3===1?"#d6ff4a":"#ff7a3c"} className="tl-light" style={{ animationDelay:`${(i%5)*0.6}s` }}/>))}</g>
      </svg>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Quicksand:wght@400;600;700&display=swap');
.ef-root{ --void:#10210a; --void2:#1c2f0e; --panel:rgba(30,42,12,.88);
  --glow:#d6ff4a; --grn:#a6e635; --pur:#ffc24a; --mag:#ff6a3c; --cyan:#f4e02a;
  --cream:#f7ffe0; --dim:#c2d690; --line:rgba(214,255,74,.24);
  position:relative; min-height:100vh; width:100%; overflow:hidden;
  font-family:'Quicksand',system-ui,sans-serif; color:var(--cream);
  background:
    radial-gradient(90% 60% at 50% -8%, #4a6f1c 0%, transparent 60%),
    radial-gradient(120% 90% at 50% 110%, #2a4012 0%, transparent 55%),
    linear-gradient(180deg, #20330f 0%, var(--void2) 45%, var(--void) 100%); }
.ef-shell{ position:relative; z-index:3; max-width:760px; margin:0 auto;
  padding:calc(env(safe-area-inset-top) + 18px) calc(env(safe-area-inset-right) + 16px) calc(env(safe-area-inset-bottom) + 120px) calc(env(safe-area-inset-left) + 16px); }
.ef-loading{ text-align:center; padding:80px 0; color:var(--glow); font-size:18px; letter-spacing:.04em; }
.mute{ position:fixed; top:calc(env(safe-area-inset-top) + 12px); right:calc(env(safe-area-inset-right) + 12px); z-index:40; width:40px; height:40px; border-radius:50%;
  background:rgba(8,19,13,.7); border:1px solid var(--line); color:var(--cream); cursor:pointer; font-size:18px; transition:.2s; }
.mute:hover{ border-color:var(--glow); box-shadow:0 0 16px rgba(214,255,74,.4); transform:scale(1.08); }
.eyebrow{ font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:var(--cyan); margin:0; }
.title,.hub__title{ font-family:'Anton',sans-serif; font-weight:400; line-height:.95; color:var(--glow); letter-spacing:.01em; text-transform:uppercase; }
.glow-pulse{ text-shadow:0 0 14px rgba(214,255,74,.65),0 0 38px rgba(214,255,74,.32); }
@keyframes softpulse{ 0%,100%{ transform:scale(1); opacity:1;} 50%{ transform:scale(1.035); opacity:.88;} }
.wordmark{ font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; line-height:.86; margin:6px 0 4px; color:#e6ff5c; letter-spacing:.005em;
  display:flex; flex-direction:column; align-items:center; animation:wmfloat 5s ease-in-out infinite; }
.wordmark span{ display:block; font-size:clamp(46px,15vw,104px);
  text-shadow:0 1px 0 #8aa322, 0 2px 0 #7c941e, 0 3px 0 #6e851b, 0 4px 0 #607517, 0 5px 0 #526414, 0 6px 0 #445310, 0 8px 10px rgba(0,0,0,.55), 0 0 30px rgba(214,255,74,.55); }
.wordmark span:last-child{ color:#fff07a; margin-top:-.06em; }
@keyframes wmfloat{ 0%,100%{ transform:perspective(600px) rotateX(0deg) translateY(0);} 50%{ transform:perspective(600px) rotateX(6deg) translateY(-4px);} }
.greeting{ font-family:'Anton',sans-serif; letter-spacing:.06em; text-transform:uppercase; font-size:clamp(22px,6vw,34px); color:var(--glow); margin:8px 0 4px; }

.aurora{ position:absolute; inset:0; z-index:0; overflow:hidden; }
.aurora span{ position:absolute; width:85vw; height:85vw; border-radius:50%; opacity:.32; animation:drift 28s ease-in-out infinite; will-change:transform; }
.aurora span:nth-child(1){ background:radial-gradient(circle, var(--grn) 0%, transparent 62%); top:-28%; left:-18%; }
.aurora span:nth-child(2){ background:radial-gradient(circle, var(--pur) 0%, transparent 62%); bottom:-32%; right:-22%; animation-delay:-9s; }
.aurora span:nth-child(3){ background:radial-gradient(circle, var(--mag) 0%, transparent 60%); top:24%; left:34%; animation-delay:-18s; opacity:.1; }
@keyframes drift{ 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(6%,8%) scale(1.15);} }
.ff{ position:absolute; inset:0; z-index:1; pointer-events:none; }
.ff__d{ position:absolute; width:5px; height:5px; border-radius:50%; background:radial-gradient(circle,#fbffd6 0%,var(--glow) 45%,transparent 70%); opacity:.5; animation:float linear infinite; }
@keyframes float{ 0%{ transform:translate(0,0) scale(.7); opacity:.12;} 50%{ opacity:.85;} 100%{ transform:translate(28px,-46px) scale(1.1); opacity:.08;} }

.treeline{ position:fixed; left:0; bottom:0; width:100%; height:200px; z-index:1; pointer-events:none; }
.tl-back{ opacity:.55; filter:blur(1.4px); }
.tl-light{ animation:twinkle 3s ease-in-out infinite; }
@keyframes twinkle{ 0%,100%{ opacity:.4;} 50%{ opacity:1;} }
@media(max-width:768px){
  .ff__d:nth-child(n+8){ display:none; }   /* 7 fireflies on phones */
  .aurora span:nth-child(3){ display:none; }
  .tl-light:nth-of-type(2n){ display:none; }
}
@media(prefers-reduced-motion:reduce){ .ff__d,.aurora span,.glow-pulse,.wordmark,.orb,.ava,.tl-light,.vial__liquid,.cauldron__liquid::after,.cauldron__glass,.hub__foot,.bubble__av{ animation:none!important; } }

.ava{ display:block; filter:drop-shadow(0 0 9px rgba(214,255,74,.6)) drop-shadow(0 0 3px rgba(255,240,122,.5)); }
.ava--empty{ border-radius:50%; display:grid; place-items:center; background:rgba(214,255,74,.08); border:1px dashed var(--line); color:var(--dim); font-weight:700; animation:none; }

.gate{ text-align:center; padding-top:14px; }
.gate__card{ max-width:360px; margin:22px auto 0; background:var(--panel); border:1px solid var(--line); border-radius:20px; padding:26px 22px; box-shadow:0 0 30px rgba(214,255,74,.12); }
.gate__lock{ font-size:34px; margin:0 0 4px; }
.gate__title{ font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.04em; font-size:24px; color:var(--glow); margin:0 0 4px; }
.gate__hint{ color:var(--dim); font-size:13px; margin:0 0 16px; }
.gate__in{ text-align:center; font-size:17px; letter-spacing:.04em; margin-bottom:12px; }
.gate__in--bad{ border-color:var(--mag); animation:shake .35s; }
@keyframes shake{ 0%,100%{ transform:translateX(0);} 25%{ transform:translateX(-7px);} 75%{ transform:translateX(7px);} }
.gate__err{ color:var(--mag); font-size:13px; margin:0 0 10px; }
.login{ text-align:center; padding-top:10px; }
.sub{ color:var(--dim); margin:0 0 26px; }
.login__couples{ display:grid; gap:18px; margin-bottom:18px; }
.couple{ display:flex; align-items:center; justify-content:center; gap:8px; }
.couple__vine{ color:var(--mag); font-size:22px; filter:drop-shadow(0 0 7px var(--mag)); animation:beat 2.2s ease-in-out infinite; }
@keyframes beat{ 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.25);} }
.login__solos{ display:flex; gap:18px; justify-content:center; flex-wrap:wrap; }
.orb__tag--solo{ font-size:11px; letter-spacing:.1em; font-weight:700; color:var(--mag); text-shadow:0 0 10px var(--mag); }
.local-note{ margin:0; color:var(--glow); font-weight:600; }
.card--local{ border-color:rgba(244,224,42,.4); box-shadow:0 0 22px rgba(244,224,42,.12); }
.trav__local{ color:var(--cyan); font-weight:600; font-size:14px; margin-top:3px; }

.orb{ position:relative; display:flex; flex-direction:column; align-items:center; gap:5px; min-width:112px; padding:16px 14px; border-radius:18px; cursor:pointer; color:var(--cream);
  background:radial-gradient(120% 120% at 50% 0%, rgba(214,255,74,.10), rgba(12,28,19,.6)); border:1px solid var(--line);
  animation:bob 4s ease-in-out infinite; animation-delay:calc(var(--i)*.3s); transition:transform .18s ease, box-shadow .25s ease, border-color .25s ease; overflow:visible; }
@keyframes bob{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-5px);} }
.orb:hover{ transform:translateY(-6px) scale(1.05); border-color:var(--glow); box-shadow:0 0 26px rgba(214,255,74,.4); }
.orb:focus-visible{ outline:2px solid var(--cyan); outline-offset:3px; }
.orb__name{ font-weight:700; font-size:18px; }
.orb--lit{ border-color:var(--glow); box-shadow:0 0 26px rgba(214,255,74,.25) inset, 0 0 16px rgba(214,255,74,.22); }
.orb__check{ font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--glow); }
.vine-svg{ position:absolute; bottom:4px; width:32px; height:64px; pointer-events:none; opacity:0; transform:scale(0); transform-origin:bottom center;
  transition:transform .5s cubic-bezier(.2,.85,.3,1.25), opacity .3s; filter:drop-shadow(0 0 5px rgba(214,255,74,.6)); z-index:4; }
.vine--l{ left:-12px; } .vine--r{ right:-12px; transform:scaleX(-1) scale(0); }
.orb:hover .vine--l{ opacity:1; transform:scale(1) rotate(-4deg); }
.orb:hover .vine--r{ opacity:1; transform:scaleX(-1) scale(1) rotate(-4deg); }

.ghost-btn{ background:none; border:none; color:var(--cyan); cursor:pointer; font:inherit; padding:6px 0; }
.ghost-btn:hover{ text-shadow:0 0 10px var(--cyan); }
.p-title{ font-size:26px; margin:6px 0 2px; } .p-solo{ color:var(--mag); font-weight:700; margin:0 0 12px; }
.card{ background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:16px; margin:14px 0; transition:border-color .25s; }
.card:hover{ border-color:rgba(214,255,74,.32); }
.card--vial{ border-color:rgba(255,106,60,.4); box-shadow:0 0 22px rgba(255,106,60,.14); }
.prompts{ margin:0 0 10px; padding-left:18px; color:var(--dim); font-size:13px; }
.prompts li{ margin:3px 0; }
.counter{ text-align:right; font-size:12px; font-weight:600; color:var(--mag); margin-top:6px; }
.counter--ok{ color:var(--glow); }

/* GEAR */
.chips-wrap{ display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 4px; }
.gchip{ background:rgba(214,255,74,.08); border:1px solid var(--line); color:var(--cream); border-radius:999px; padding:6px 11px; cursor:pointer; font:inherit; font-size:12px; transition:.15s; }
.gchip:hover{ border-color:var(--glow); box-shadow:0 0 10px rgba(214,255,74,.3); }
.gitem{ display:flex; gap:10px; align-items:center; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:12px 13px; }
.gitem--bringing{ border-color:rgba(166,230,53,.4); }
.gitem--needed{ border-color:rgba(255,106,60,.4); }
.gitem__body{ flex:1; min-width:0; }
.gitem__name{ font-weight:700; font-size:15px; }
.gitem__note{ color:var(--dim); font-size:12px; margin-top:1px; }
.gitem__who{ margin-top:4px; font-size:13px; }
.gitem__bring{ display:inline-flex; align-items:center; gap:6px; color:var(--grn); font-weight:600; }
.gitem__need{ color:var(--pur); font-weight:600; }
.gitem__actions{ display:flex; gap:6px; flex:none; }

/* CAMPFIRE */
.fire{ display:flex; flex-direction:column; }
.fire__log{ display:flex; flex-direction:column; gap:10px; max-height:52vh; overflow-y:auto; padding:6px 14px 10px 16px; }
.bubble{ display:flex; gap:8px; align-items:flex-end; max-width:86%; }
.bubble--me{ align-self:flex-end; flex-direction:row-reverse; }
.bubble__av{ flex:none; line-height:0; width:28px; height:28px; border-radius:50%; display:grid; place-items:center;
  background:radial-gradient(circle, rgba(214,255,74,.4), transparent 72%);
  box-shadow:0 0 12px rgba(214,255,74,.55); }
.bubble__av .ava{ filter:none; animation:none; }
.bubble__col{ position:relative; }
.bubble__meta{ font-size:11px; color:var(--dim); margin:0 4px 3px; }
.bubble--me .bubble__meta{ text-align:right; }
.bubble__text{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:9px 12px; font-size:14px; line-height:1.4; word-break:break-word; }
.bubble--me .bubble__text{ background:linear-gradient(120deg, rgba(214,255,74,.18), rgba(244,224,42,.12)); border-color:rgba(214,255,74,.4); }
.bubble__del{ position:absolute; top:-8px; right:-8px; width:20px; height:20px; border-radius:50%; border:1px solid var(--line); background:var(--void2); color:var(--dim); cursor:pointer; font-size:10px; line-height:1; opacity:0; transition:.15s; }
.bubble:hover .bubble__del{ opacity:1; }
.fire__bar{ display:flex; gap:8px; margin-top:12px; }
.fire__bar .in{ flex:1; }
.fire__send{ flex:none; padding:0 18px; border:none; border-radius:12px; cursor:pointer; font:inherit; font-weight:700; color:#06150d; background:linear-gradient(90deg,var(--glow),var(--cyan)); box-shadow:0 0 16px rgba(214,255,74,.35); }
.fire__send:hover{ box-shadow:0 0 24px rgba(214,255,74,.55); }
.lbl{ display:block; font-size:13px; font-weight:600; color:var(--dim); margin:12px 0 6px; } .lbl:first-child{ margin-top:0; }
.req{ font-weight:700; color:var(--mag); font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-left:6px; }
.opt{ font-weight:500; color:#6f9a80; }
.in{ width:100%; box-sizing:border-box; background:rgba(8,19,13,.75); color:var(--cream); border:1px solid var(--line); border-radius:12px; padding:11px 13px; font:inherit; transition:.18s; }
.in:focus{ outline:none; border-color:var(--glow); box-shadow:0 0 0 3px rgba(214,255,74,.18); }
.ta{ resize:vertical; }
.av-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(46px, 1fr)); gap:8px; }
.av{ aspect-ratio:1; display:grid; place-items:center; border-radius:14px; cursor:pointer; background:rgba(8,19,13,.5); border:1px solid var(--line); transition:.15s; padding:5px; overflow:hidden; }
.av .ava{ width:100%; height:100%; }
.av:hover{ border-color:var(--glow); transform:scale(1.1); }
.av--on{ border-color:var(--glow); background:rgba(214,255,74,.14); box-shadow:0 0 14px rgba(214,255,74,.4); transform:scale(1.08); }
.av--taken{ opacity:.28; cursor:not-allowed; }
.seg{ display:flex; gap:8px; flex-wrap:wrap; }
.seg__btn{ flex:1; min-width:84px; padding:10px; border-radius:12px; cursor:pointer; font:inherit; background:rgba(8,19,13,.6); border:1px solid var(--line); color:var(--cream); transition:.15s; }
.seg__btn:hover{ border-color:var(--pur); }
.seg__btn--on{ border-color:var(--pur); background:rgba(199,125,255,.18); box-shadow:0 0 14px rgba(199,125,255,.35); color:#fff; }
.copy-btn{ width:100%; background:rgba(56,232,255,.12); border:1px dashed var(--cyan); color:var(--cyan); border-radius:12px; padding:11px; cursor:pointer; font:inherit; margin-bottom:4px; transition:.18s; }
.copy-btn:hover{ background:rgba(56,232,255,.2); box-shadow:0 0 14px rgba(56,232,255,.3); }
.save-btn{ width:100%; margin-top:8px; padding:15px; border:none; border-radius:14px; cursor:pointer; font:inherit; font-weight:700; font-size:16px; color:#06150d;
  background:linear-gradient(90deg,var(--glow),var(--cyan)); box-shadow:0 0 26px rgba(214,255,74,.4); transition:.2s; background-size:160% auto; }
.save-btn:hover{ background-position:right center; box-shadow:0 0 34px rgba(214,255,74,.6); }
.save-btn:disabled{ opacity:.6; cursor:default; }

.datestrip{ display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
.daychip{ position:relative; flex:0 0 auto; display:flex; flex-direction:column; align-items:center; min-width:52px; padding:8px 6px; border-radius:12px; cursor:pointer; background:rgba(8,19,13,.6); border:1px solid var(--line); color:var(--cream); transition:.15s; }
.daychip:hover{ border-color:var(--glow); transform:translateY(-2px); }
.daychip--on{ border-color:var(--glow); background:rgba(214,255,74,.16); box-shadow:0 0 14px rgba(214,255,74,.35); }
.daychip--fest{ border-color:rgba(255,93,174,.45); }
.daychip--fest.daychip--on{ border-color:var(--mag); box-shadow:0 0 14px rgba(255,93,174,.4); }
.daychip__dow{ font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:.05em; }
.daychip__num{ font-size:18px; font-weight:700; }
.daychip__dot{ position:absolute; top:-7px; right:-3px; font-size:10px; }
.daychip--other{ justify-content:center; font-size:18px; }

.hub__head{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
.hub__title{ font-size:clamp(30px,8vw,46px); margin:6px 0 2px; }
.festline{ color:var(--cyan); font-size:13px; font-weight:600; margin:0; letter-spacing:.02em; }
.cauldron{ flex:none; margin-top:44px; display:flex; flex-direction:column; align-items:center; gap:3px; background:none; border:none; cursor:pointer; padding:0; }
.cauldron__cork{ width:16px; height:9px; background:linear-gradient(#7a5230,#5a3c22); border-radius:3px 3px 1px 1px; margin-bottom:-2px; box-shadow:0 1px 2px rgba(0,0,0,.5); z-index:2; }
.cauldron__glass{ position:relative; width:42px; height:62px; border-radius:10px 10px 16px 16px; overflow:hidden;
  background:linear-gradient(120deg, rgba(255,255,255,.16), rgba(255,255,255,.04)); border:1px solid rgba(214,255,74,.4);
  box-shadow:0 0 16px rgba(214,255,74,.25), inset 0 0 10px rgba(255,255,255,.08); transition:.2s; animation:cauldronpulse 2.8s ease-in-out infinite; }
@keyframes cauldronpulse{ 0%,100%{ box-shadow:0 0 14px rgba(214,255,74,.25), inset 0 0 10px rgba(255,255,255,.08);} 50%{ box-shadow:0 0 26px rgba(214,255,74,.55), inset 0 0 10px rgba(255,255,255,.08);} }
.cauldron:hover .cauldron__glass{ box-shadow:0 0 24px rgba(214,255,74,.6); transform:scale(1.05); }
.cauldron__liquid{ position:absolute; left:0; right:0; bottom:0; background:linear-gradient(180deg,var(--glow),var(--cyan)); transition:height .6s cubic-bezier(.3,.9,.3,1); box-shadow:0 0 12px rgba(214,255,74,.6); }
.cauldron__liquid::after{ content:""; position:absolute; top:0; left:0; right:0; height:5px; background:rgba(255,255,255,.4); border-radius:50%; animation:slosh 4s ease-in-out infinite; }
.cauldron__count{ position:absolute; inset:0; display:grid; place-items:center; font-weight:700; font-size:15px; color:#06150d; text-shadow:0 1px 2px rgba(255,255,255,.4); z-index:1; }
.cauldron__den{ font-size:10px; }
.cauldron__tap{ font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--cyan); }

.modal{ position:fixed; inset:0; z-index:60; background:rgba(4,10,7,.74); display:flex; align-items:flex-end; justify-content:center; animation:fade .2s ease; }
@keyframes fade{ from{ opacity:0; } to{ opacity:1; } }
@media(min-width:560px){ .modal{ align-items:center; } }
.sheet{ position:relative; width:100%; max-width:480px; max-height:84vh; overflow-y:auto; background:linear-gradient(180deg,#10271a,#0a1812);
  border:1px solid var(--line); border-radius:22px 22px 0 0; padding:22px 18px 26px; box-shadow:0 -10px 50px rgba(0,0,0,.6); animation:rise .28s cubic-bezier(.2,.8,.3,1); }
@media(min-width:560px){ .sheet{ border-radius:22px; } }
@keyframes rise{ from{ transform:translateY(30px); opacity:.4; } to{ transform:translateY(0); opacity:1; } }
.sheet__x{ position:absolute; top:14px; right:14px; width:32px; height:32px; border-radius:50%; background:rgba(214,255,74,.1); border:1px solid var(--line); color:var(--cream); cursor:pointer; font-size:14px; }
.sheet__x:hover{ border-color:var(--glow); }
.sheet__title{ font-size:22px; margin:0 0 2px; color:var(--cream); }
.sheet__sub{ color:var(--dim); font-size:13px; margin:0 0 16px; }
.sheet__head{ font-size:12px; letter-spacing:.14em; text-transform:uppercase; margin:16px 0 8px; font-weight:700; }
.sheet__head--todo{ color:var(--mag); } .sheet__head--done{ color:var(--glow); }
.strow{ display:flex; align-items:center; gap:12px; padding:9px 12px; border-radius:12px; margin-bottom:7px; border:1px solid var(--line); background:rgba(8,19,13,.5); }
.strow--todo{ border-color:rgba(255,93,174,.34); background:rgba(255,93,174,.07); }
.strow--done{ border-color:rgba(214,255,74,.28); }
.strow__av{ flex:none; line-height:0; } .strow__empty{ font-size:24px; opacity:.6; }
.strow__name{ flex:1; font-weight:600; } .strow__tag{ color:var(--dim); font-style:normal; font-weight:500; font-size:13px; }
.strow__badge{ font-size:12px; font-weight:700; }
.strow--todo .strow__badge{ color:var(--mag); } .strow--done .strow__badge{ color:var(--glow); }
.sheet__switch{ width:100%; margin-top:18px; padding:13px; border-radius:12px; cursor:pointer; font:inherit; font-weight:600;
  background:rgba(56,232,255,.12); border:1px solid var(--cyan); color:var(--cyan); transition:.18s; }
.sheet__switch:hover{ background:rgba(56,232,255,.2); box-shadow:0 0 16px rgba(56,232,255,.3); }
.hub__bar{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin:16px 0 10px; flex-wrap:wrap; }
.hi{ color:var(--dim); font-weight:600; }
.hub__actions{ display:flex; gap:8px; flex-wrap:wrap; }
.chip{ background:rgba(214,255,74,.10); border:1px solid var(--line); color:var(--cream); border-radius:999px; padding:7px 13px; cursor:pointer; font:inherit; font-size:13px; transition:.15s; }
.chip:hover{ border-color:var(--glow); box-shadow:0 0 12px rgba(214,255,74,.3); }
.chip--ghost{ color:var(--dim); }
.tabs{ position:fixed; left:50%; transform:translateX(-50%); bottom:0; z-index:45;
  width:100%; max-width:760px; display:flex; gap:6px; box-sizing:border-box;
  padding:8px max(12px,env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-right));
  background:linear-gradient(180deg, rgba(16,33,10,.80), rgba(11,24,12,.97));
  backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  border-top:1px solid var(--line); box-shadow:0 -10px 28px rgba(0,0,0,.4); }
.tab{ position:relative; flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-height:50px; padding:6px 2px; border-radius:14px; cursor:pointer; font:inherit; background:transparent; border:1px solid transparent; color:var(--dim); transition:.15s; }
.tab__ic{ font-size:20px; line-height:1; }
.tab__lb{ font-size:10.5px; font-weight:700; letter-spacing:.01em; white-space:nowrap; }
.tab:active{ transform:scale(.95); }
.tab__badge{ position:absolute; top:3px; left:calc(50% + 6px); min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:var(--mag); color:#fff; font-size:10px; font-weight:800; line-height:16px; text-align:center; box-shadow:0 0 8px rgba(255,106,60,.6); }
.tab__dot{ position:absolute; top:5px; left:calc(50% + 8px); width:7px; height:7px; border-radius:50%; background:var(--glow); box-shadow:0 0 7px rgba(214,255,74,.8); }
.tab:hover{ border-color:var(--glow); }
.tab--on{ color:var(--glow); background:rgba(214,255,74,.14); border-color:rgba(214,255,74,.30); }
.tab--on .tab__ic{ filter:drop-shadow(0 0 6px rgba(214,255,74,.7)); }
.hint{ color:var(--dim); font-size:13px; margin:0 0 10px; }
.empty{ text-align:center; color:var(--dim); padding:46px 16px; border:1px dashed var(--line); border-radius:16px; }
.stack{ display:flex; flex-direction:column; gap:10px; }
.trav{ display:flex; gap:12px; align-items:flex-start; background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:13px; transition:.2s; }
.trav:hover{ transform:translateX(3px); border-color:rgba(214,255,74,.34); }
.trav--me{ border-color:var(--glow); box-shadow:0 0 18px rgba(214,255,74,.22); }
.trav__av{ flex:none; }
.trav__body{ flex:1; min-width:0; }
.trav__top{ display:flex; align-items:center; gap:8px; }
.trav__name{ font-weight:700; font-size:18px; } .trav__mode{ margin-left:auto; font-size:18px; }
.mini-tag{ font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--mag); border:1px solid var(--mag); border-radius:6px; padding:1px 5px; }
.trav__meta{ color:var(--dim); font-size:13px; margin-top:2px; }
.trav__when{ color:var(--cyan); font-weight:600; font-size:14px; margin-top:3px; }
.trav__rent{ color:var(--pur); font-size:13px; font-weight:600; margin-top:3px; }
.trav__notes{ color:var(--cream); font-size:13px; font-style:italic; margin-top:4px; opacity:.85; }

.vault__intro{ color:var(--dim); font-size:14px; margin:0 0 16px; text-align:center; }
.vialshelf{ display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:18px; justify-items:center; }
.vial{ display:flex; flex-direction:column; align-items:center; gap:5px; transition:.2s; }
.vial:hover{ transform:translateY(-4px); }
.vial__cork{ width:22px; height:13px; background:linear-gradient(#7a5230,#5a3c22); border-radius:4px 4px 2px 2px; margin-bottom:-3px; z-index:2; box-shadow:0 1px 3px rgba(0,0,0,.5); }
.vial__glass{ position:relative; width:46px; height:88px; border-radius:12px 12px 18px 18px; overflow:hidden; background:linear-gradient(120deg, rgba(255,255,255,.16), rgba(255,255,255,.04)); border:1px solid rgba(255,255,255,.28); box-shadow:0 0 16px rgba(214,255,74,.18), inset 0 0 12px rgba(255,255,255,.1); }
.vial__liquid{ position:absolute; left:0; right:0; bottom:0; height:64%; animation:slosh 5s ease-in-out infinite; }
@keyframes slosh{ 0%,100%{ height:62%;} 50%{ height:68%;} }
.vial__q{ position:absolute; inset:0; display:grid; place-items:center; font-size:26px; font-weight:700; color:rgba(255,255,255,.85); text-shadow:0 0 8px rgba(0,0,0,.5); z-index:1; }
.vial__lock{ position:absolute; top:4px; right:4px; font-size:12px; z-index:1; }
.vial__av{ line-height:0; } .vial__name{ font-size:13px; font-weight:600; color:var(--cream); }
.hub__foot{ text-align:center; margin-top:26px; font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.06em; font-size:clamp(16px,4.5vw,22px);
  background:linear-gradient(90deg,var(--grn),var(--glow),var(--cyan),var(--mag),var(--glow),var(--grn)); background-size:300% auto;
  -webkit-background-clip:text; background-clip:text; color:transparent; animation:footershine 6s linear infinite, footerbob 3.2s ease-in-out infinite;
  filter:drop-shadow(0 0 10px rgba(214,255,74,.4)); }
@keyframes footershine{ to{ background-position:300% center; } }
@keyframes footerbob{ 0%,100%{ transform:translateY(0) scale(1);} 50%{ transform:translateY(-3px) scale(1.02);} }
.ef-toast{ position:fixed; left:50%; bottom:calc(env(safe-area-inset-bottom) + 88px); transform:translateX(-50%); z-index:50; background:rgba(8,19,13,.92); border:1px solid var(--glow); color:var(--glow); padding:11px 18px; border-radius:999px; box-shadow:0 0 24px rgba(214,255,74,.4); }

/* countdown */
.countdown{ margin-top:7px; display:inline-block; font-size:13px; font-weight:700; color:var(--glow); background:rgba(214,255,74,.1); border:1px solid rgba(214,255,74,.34); padding:4px 12px; border-radius:999px; letter-spacing:.01em; box-shadow:0 0 14px rgba(214,255,74,.18); }
.countdown--live{ color:#0b1407; background:linear-gradient(90deg,var(--glow),var(--grn)); border-color:transparent; animation:softpulse 2.4s ease-in-out infinite; }

/* hunt teaser */
/* artist discovery */
.adisc{ margin:2px 0 14px; border-radius:18px; background:radial-gradient(120% 140% at 100% 0%, rgba(143,232,255,.1), rgba(8,19,13,.5)); border:1px solid rgba(143,232,255,.3); overflow:hidden; }
.adisc__head{ width:100%; display:flex; align-items:center; gap:12px; padding:14px 15px; background:none; border:none; cursor:pointer; text-align:left; color:var(--cream); }
.adisc__icon{ font-size:22px; filter:drop-shadow(0 0 7px rgba(143,232,255,.5)); }
.adisc__htxt{ flex:1; min-width:0; display:flex; flex-direction:column; }
.adisc__title{ font-weight:800; font-size:15px; }
.adisc__sub{ font-size:12px; color:var(--dim); margin-top:2px; }
.adisc__chev{ color:var(--cyan); font-size:16px; transition:transform .2s; }
.adisc__chev--up{ transform:rotate(180deg); }
.adisc__body{ padding:0 13px 14px; }
.adisc__crew{ margin-bottom:12px; }
.adisc__crewlbl{ font-size:12px; font-weight:700; color:var(--glow); }
.adisc__crewrow{ display:flex; flex-wrap:wrap; gap:7px; margin-top:7px; }
.crewpick{ display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:999px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; background:rgba(214,255,74,.08); border:1px solid rgba(214,255,74,.3); color:var(--cream); }
.crewpick--mine{ background:rgba(214,255,74,.2); border-color:var(--glow); }
.crewpick__n{ font-size:10.5px; font-weight:800; background:var(--glow); color:#0b1407; border-radius:999px; padding:0 6px; }
.adisc__search{ margin-bottom:10px; }
.adisc__genres{ display:flex; gap:7px; overflow-x:auto; padding-bottom:8px; margin-bottom:6px; -webkit-overflow-scrolling:touch; }
.gpill{ flex:none; padding:6px 12px; border-radius:999px; font:inherit; font-size:12.5px; font-weight:600; white-space:nowrap; cursor:pointer; background:rgba(8,19,13,.5); border:1px solid var(--line); color:var(--dim); }
.gpill--on{ background:var(--cyan); border-color:var(--cyan); color:#06141a; }
.adisc__list{ display:flex; flex-wrap:wrap; gap:8px; max-height:280px; overflow-y:auto; padding:4px 2px; }
.achip{ display:flex; align-items:flex-start; justify-content:space-between; gap:8px; padding:8px 11px; border-radius:13px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; background:rgba(8,19,13,.55); border:1px solid var(--line); color:var(--cream); transition:.12s; text-align:left; width:100%; }
.achip--on{ background:rgba(214,255,74,.16); border-color:var(--glow); box-shadow:0 0 12px rgba(214,255,74,.2); }
.achip__col{ display:flex; flex-direction:column; gap:3px; flex:1; min-width:0; }
.achip__name{ font-weight:700; }
.achip__check{ color:var(--glow); }
.achip__slots{ display:flex; flex-direction:column; gap:2px; }
.achip__slot{ font-size:11px; font-weight:400; color:var(--dim); line-height:1.4; }
.achip__who{ display:inline-flex; align-items:center; gap:1px; flex:none; }
.achip__face{ line-height:0; filter:drop-shadow(0 0 4px rgba(214,255,74,.5)); }
.achip__more{ font-size:10.5px; color:var(--dim); margin-left:2px; }
.crewpick__day{ font-size:10px; opacity:.7; margin:0 3px; }
.conflicts{ margin-top:10px; padding:10px 12px; border-radius:12px; background:rgba(255,160,50,.1); border:1px solid rgba(255,160,50,.4); }
.conflicts__lbl{ display:block; font-size:12px; font-weight:800; color:#ffb060; margin-bottom:6px; }
.conflict{ font-size:12px; color:rgba(247,255,224,.8); line-height:1.5; padding:2px 0; border-top:1px solid rgba(255,160,50,.2); }
.adisc__foot{ margin:11px 0 0; font-size:11.5px; color:var(--dim); text-align:center; }
.hunt{ display:flex; gap:13px; align-items:center; margin:2px 0 14px; padding:14px 15px; border-radius:18px;
  background:radial-gradient(120% 140% at 0% 0%, rgba(214,255,74,.12), rgba(8,19,13,.5)); border:1px solid rgba(214,255,74,.32);
  box-shadow:0 0 22px rgba(214,255,74,.12), inset 0 0 30px rgba(20,40,16,.4); position:relative; overflow:hidden; }
.hunt::after{ content:""; position:absolute; inset:0; background:radial-gradient(60% 80% at 100% 120%, rgba(143,232,255,.12), transparent 70%); pointer-events:none; }
.hunt__glyph{ flex:none; color:var(--glow); filter:drop-shadow(0 0 8px rgba(214,255,74,.55)); animation:huntpulse 3.4s ease-in-out infinite; will-change:transform; }
.hunt__body{ min-width:0; }
.hunt__top{ display:flex; align-items:center; gap:8px; }
.hunt__title{ margin:0; font-family:'Anton',sans-serif; font-weight:400; letter-spacing:.03em; text-transform:uppercase; font-size:17px; color:var(--cream); }
.hunt__soon{ font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:var(--glow); border:1px solid rgba(214,255,74,.5); border-radius:999px; padding:2px 7px; }
.hunt__copy{ margin:5px 0 0; font-size:12.5px; line-height:1.5; color:rgba(247,255,224,.82); }
.hunt__copy b{ color:var(--glow); font-weight:700; }
@keyframes huntpulse{ 0%,100%{ transform:translateY(0) rotate(-1deg); } 50%{ transform:translateY(-3px) rotate(1deg); } }

/* pin gate */
.pin{ max-width:420px; margin:0 auto; text-align:center; padding-top:8px; }
.pin__back{ background:none; border:none; color:var(--cyan); font-size:14px; cursor:pointer; float:left; }
.pin__spirit{ display:inline-block; margin:6px auto 4px; filter:drop-shadow(0 0 16px rgba(214,255,74,.5)); }
.pin__title{ font-family:'Anton',sans-serif; font-weight:400; letter-spacing:.02em; font-size:24px; color:var(--cream); margin:8px 0 4px; }
.pin__hint{ font-size:13.5px; color:rgba(247,255,224,.78); margin:0 auto 16px; max-width:330px; line-height:1.5; }
.pin__in{ text-align:center; letter-spacing:.5em; font-size:22px; font-weight:700; max-width:230px; margin:0 auto 14px; }
.pin .save-btn{ max-width:300px; margin:0 auto; }
.pin__link{ display:block; margin:12px auto 0; background:none; border:none; color:var(--cyan); font-size:13px; cursor:pointer; text-decoration:underline; }

/* vial reveal */
.reveal-list{ display:flex; flex-direction:column; gap:12px; margin-top:4px; }
.reveal{ padding:13px 15px; border-radius:16px; background:rgba(8,19,13,.5); border:1px solid rgba(214,255,74,.26); box-shadow:inset 0 0 24px rgba(20,40,16,.4); }
.reveal__head{ display:flex; align-items:center; gap:10px; margin-bottom:7px; }
.reveal__av{ flex:none; line-height:0; border-radius:50%; padding:2px; }
.reveal__name{ font-weight:800; color:var(--cream); font-size:15px; }
.reveal__text{ margin:0; font-size:14px; line-height:1.55; color:rgba(247,255,224,.92); font-style:italic; }

/* seal-your-vial screen */
.sealv__row{ display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap; }
.sealv__hint{ font-size:12px; color:var(--dim); line-height:1.45; flex:1; min-width:180px; }
.sealv__hint b{ color:var(--glow); }
.save-btn--arm{ background:linear-gradient(90deg,#ffd84a,#ff9d4a); animation:softpulse 1.1s ease-in-out infinite; }

/* profile quick guide */
.guide{ margin:0 0 16px; padding:13px 15px 13px; border-radius:16px; background:rgba(214,255,74,.07);
  border:1px dashed rgba(214,255,74,.45); box-shadow:inset 0 0 26px rgba(20,40,16,.35); }
.guide__head{ font-weight:800; color:var(--glow); font-size:14px; margin-bottom:7px; letter-spacing:.01em; }
.guide__steps{ margin:0 0 8px; padding-left:20px; color:rgba(247,255,224,.88); font-size:13px; line-height:1.55; }
.guide__steps li{ margin:5px 0; }
.guide__steps b{ color:var(--glow); font-weight:700; }
.guide__foot{ margin:0 0 10px; font-size:12px; color:var(--dim); }
.guide__foot b{ color:var(--cream); }

/* Crew Map (live GPS) */
.chip--map{ background:rgba(214,255,74,.18); border-color:rgba(214,255,74,.5); font-weight:700; }
.crewmap{ position:fixed; inset:0; z-index:5000; background:#10210a; }
.crewmap__el{ position:absolute; inset:0; }
.crewmap__top{ position:absolute; top:calc(env(safe-area-inset-top,0px) + 10px); left:10px; right:10px; z-index:5001; display:flex; gap:8px; }
.crewmap__status{ position:absolute; bottom:calc(env(safe-area-inset-bottom,0px) + 10px); left:10px; right:10px; z-index:5001; background:rgba(16,33,10,.86); border:1px solid var(--line); border-radius:12px; padding:9px 11px; font-size:12px; color:var(--cream); }
.cm-stage{ background:rgba(16,33,10,.8); border:1px solid var(--line); border-radius:8px; padding:1px 6px; font-size:10px; white-space:nowrap; color:#cdeccf; transform:translate(-50%,-50%); }
.cm-pin{ display:flex; flex-direction:column; align-items:center; gap:2px; transform:translate(-50%,-100%); }
.cm-dot{ width:16px; height:16px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 2px rgba(0,0,0,.45); display:block; }
.cm-me{ box-shadow:0 0 0 3px rgba(214,255,74,.65); }
.cm-name{ background:rgba(16,33,10,.8); border:1px solid var(--line); border-radius:8px; padding:1px 6px; font-size:10px; white-space:nowrap; color:var(--cream); }
.cm-stale{ opacity:.5; filter:grayscale(.6); }

/* Map Tab */
.maptab{ position:relative; overflow:hidden; border-radius:16px; height:clamp(320px,calc(100svh - 280px),580px); margin:0 0 10px; }
.maptab__el{ position:absolute; inset:0; }
.maptab__fabs{ position:absolute; right:12px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:10px; z-index:500; }
.maptab__fab{ width:44px; height:44px; border-radius:50%; border:1px solid var(--line); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:18px; background:rgba(8,19,13,.88); color:var(--cream); backdrop-filter:blur(6px); box-shadow:0 3px 12px rgba(0,0,0,.55); transition:.15s; }
.maptab__fab:hover{ border-color:var(--glow); }
.maptab__fab--active{ border-color:var(--glow); background:rgba(214,255,74,.18); box-shadow:0 0 12px rgba(214,255,74,.4); }
.maptab__share{ position:absolute; right:12px; bottom:16px; width:56px; height:56px; border-radius:50%; border:none; cursor:pointer; font-size:26px; background:var(--glow); color:#08210f; box-shadow:0 4px 20px rgba(214,255,74,.5); z-index:500; display:flex; align-items:center; justify-content:center; transition:.2s; }
.maptab__share:hover{ transform:scale(1.08); box-shadow:0 6px 26px rgba(214,255,74,.7); }
.maptab__share--stop{ background:var(--mag); box-shadow:0 4px 20px rgba(255,93,174,.5); }
.maptab__snack{ position:absolute; bottom:82px; left:50%; transform:translateX(-50%); background:rgba(8,19,13,.92); color:var(--cream); font-size:12px; padding:7px 16px; border-radius:20px; border:1px solid var(--line); backdrop-filter:blur(6px); white-space:nowrap; z-index:500; pointer-events:none; }
`;
