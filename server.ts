import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory Database State
interface BatteryDataPoint {
  index: number;
  label: string;
  time: string;
  battery: number;
  voltage: number;
  drainDelta?: number;
}

interface Tourist {
  id: string;
  name: string;
  phone: string;
  coordinates: [number, number]; // [lat, lng]
  street?: string;
  country?: string;
  locality?: string;
  formattedAddress?: string;
  status: "safe" | "warning" | "danger";
  battery: number;
  heartRate: number;
  temperature: number;
  altitude: number;
  lastUpdate: string;
  activity: "hiking" | "resting" | "climbing" | "exploring";
  notes: string;
  batteryHistory?: BatteryDataPoint[];
  emergencyContact?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  age?: number;
  gender?: string;
  idProof?: string;
  entryGate?: string;
  permitNumber?: string;
  assignedRanger?: string;
  updatedAt?: string;
}

interface Geofence {
  id: string;
  name: string;
  type: "avalanche" | "flooding" | "cliff_danger" | "wildlife" | "exposure";
  radius: number; // in meters
  coordinates: [number, number];
  severity: "critical" | "moderate";
  description: string;
}

interface Incident {
  id: string;
  touristId: string;
  touristName: string;
  timestamp: string;
  coordinates: [number, number];
  street?: string;
  country?: string;
  locality?: string;
  formattedAddress?: string;
  type: "sos_button" | "vitals_anomaly" | "geofence_breach";
  status: "active" | "dispatched" | "resolved";
  details: string;
  triagePlan?: string;
  vitals: {
    heartRate: number;
    battery: number;
    temperature: number;
  };
}

interface Advisory {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  type: "weather" | "hazard" | "general";
  author: string;
}

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

function createInitialBatteryHistory(currBatt: number, pattern: "nominal" | "warning" | "failing"): BatteryDataPoint[] {
  const points: BatteryDataPoint[] = [];
  const count = 10;
  const now = Date.now();
  let base = pattern === "failing" ? Math.min(68, currBatt + 38) : pattern === "warning" ? Math.min(78, currBatt + 26) : Math.min(98, currBatt + 10);
  const step = (base - currBatt) / (count - 1);

  for (let i = 0; i < count; i++) {
    const val = i === count - 1 ? currBatt : Math.round(Math.max(1, Math.min(100, base - (step * i))));
    const timeStr = new Date(now - (count - 1 - i) * 12 * 60 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const voltage = Number((3.3 + (val / 100) * 0.88).toFixed(2));
    points.push({
      index: i + 1,
      label: i === count - 1 ? "Now" : `U-${count - 1 - i}`,
      time: timeStr,
      battery: val,
      voltage,
      drainDelta: i > 0 ? points[i - 1].battery - val : 0,
    });
  }
  return points;
}

// Seed Data - Dhimbam Forest Range, Sathyamangalam Tiger Reserve, Tamil Nadu, India
let tourists: Tourist[] = [
  {
    id: "t1",
    name: "Selvan",
    phone: "+91 94432 18921",
    coordinates: [11.6125, 77.1261], // Dhimbam Ghat Hairpin Bend 27 Viewpoint
    street: "Dhimbam Ghat Viewpoint (27th Hairpin Bend, NH 948)",
    country: "India",
    locality: "Dhimbam, Sathyamangalam, Tamil Nadu",
    formattedAddress: "Dhimbam Ghat 27th Bend, NH 948, Sathyamangalam, Erode, Tamil Nadu 638461, India",
    status: "safe",
    battery: 84,
    heartRate: 76,
    temperature: 36.6,
    altitude: 1050,
    lastUpdate: new Date().toISOString(),
    activity: "hiking",
    notes: "Solo trekker observing Dhimbam Ghat crest. Route: Bannari foothills to Dhimbam Top.",
    batteryHistory: createInitialBatteryHistory(84, "nominal"),
    emergencyContact: "Kavitha Selvan (Wife) - +91 94432 18999",
    bloodGroup: "O+ (Positive)",
    age: 34,
    gender: "Male",
    idProof: "Aadhaar ending in 4921",
    entryGate: "Bannari Checkpost Gate #1",
    permitNumber: "STR-TRK-2026-0811",
    assignedRanger: "Forest Guard Murugan (Dhimbam Beat)",
    medicalNotes: "No chronic conditions. Carries standard wilderness first-aid kit and ORS sachets.",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t2",
    name: "Moorthy",
    phone: "+91 98421 73310",
    coordinates: [11.6350, 77.1180], // Hasanur Forest Plateau
    street: "Hasanur Forest Trail (Sathyamangalam Tiger Reserve)",
    country: "India",
    locality: "Hasanur, Sathyamangalam, Tamil Nadu",
    formattedAddress: "Hasanur Forest Range, STR, Sathyamangalam, Erode, Tamil Nadu 638461, India",
    status: "warning",
    battery: 28,
    heartRate: 118,
    temperature: 37.1,
    altitude: 980,
    lastUpdate: new Date().toISOString(),
    activity: "climbing",
    notes: "Field research group near Hasanur plateau. Elevated heart rate and fatigue during uphill trail trek.",
    batteryHistory: createInitialBatteryHistory(28, "warning"),
    emergencyContact: "Ramesh Moorthy (Brother) - +91 98421 73388",
    bloodGroup: "B+ (Positive)",
    age: 42,
    gender: "Male",
    idProof: "Aadhaar ending in 7710",
    entryGate: "Hasanur Checkpost Gate #3",
    permitNumber: "STR-RES-2026-0429",
    assignedRanger: "Range Officer Anbarasu (Hasanur Range)",
    medicalNotes: "Borderline hypertension. Prescribed beta-blockers. Advised 15-min mandatory shade breaks on grades.",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t3",
    name: "Ns Kumar",
    phone: "+91 97890 42244",
    coordinates: [11.5950, 77.1450], // Bannari Forest Checkpost Foothills
    street: "Bannari Forest Checkpost (NH 948)",
    country: "India",
    locality: "Bannari, Sathyamangalam, Tamil Nadu",
    formattedAddress: "Bannari Amman Forest Checkpost, Sathyamangalam, Erode, Tamil Nadu 638401, India",
    status: "safe",
    battery: 95,
    heartRate: 68,
    temperature: 36.5,
    altitude: 380,
    lastUpdate: new Date().toISOString(),
    activity: "resting",
    notes: "Wildlife photographer positioned at Bannari checkpost gate. Battery & hydration status nominal.",
    batteryHistory: createInitialBatteryHistory(95, "nominal"),
    emergencyContact: "Deepa Kumar (Spouse) - +91 97890 42200",
    bloodGroup: "A+ (Positive)",
    age: 29,
    gender: "Male",
    idProof: "Aadhaar ending in 3344",
    entryGate: "Bannari Amman Gate #2",
    permitNumber: "STR-PHO-2026-1102",
    assignedRanger: "Watcher Chinnasamy (Foothills Beat)",
    medicalNotes: "Fit endurance trekker. Wilderness safety certified. No known allergies.",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t4",
    name: "Muthu kumar",
    phone: "+91 94876 11992",
    coordinates: [11.6450, 77.0950], // Talamalai Forest Ravine
    street: "Talamalai Forest Ravine (Off Hasanur-Talamalai Rd)",
    country: "India",
    locality: "Talamalai Forest Range, Sathyamangalam, Tamil Nadu",
    formattedAddress: "Talamalai Wild Forest, Dhimbam Range, Sathyamangalam, Erode, Tamil Nadu 638461, India",
    status: "danger",
    battery: 12,
    heartRate: 125,
    temperature: 35.8, // Slightly hypothermic/cold in dense jungle ravine
    altitude: 820,
    lastUpdate: new Date().toISOString(),
    activity: "climbing",
    notes: "Lost trail markers near Talamalai elephant corridor at dusk. Trapped in ravine with low battery.",
    batteryHistory: createInitialBatteryHistory(12, "failing"),
    emergencyContact: "Vennila Muthu (Mother) - +91 94876 11900 / 04295-240112",
    bloodGroup: "AB+ (Positive)",
    age: 26,
    gender: "Male",
    idProof: "Aadhaar ending in 8892",
    entryGate: "Hasanur North Gate #4",
    permitNumber: "STR-TRK-2026-0943",
    assignedRanger: "RRT Commander Vikram (Search & Rescue Lead)",
    medicalNotes: "History of mild asthma (inhaler carried). Critical hypothermia & acute stress tachycardia (125 bpm).",
    updatedAt: new Date().toISOString(),
  }
];

const geofences: Geofence[] = [
  {
    id: "g1",
    name: "Talamalai Wild Elephant Corridor",
    type: "wildlife",
    radius: 450,
    coordinates: [11.6450, 77.0950],
    severity: "critical",
    description: "Active Asian elephant herd transit route and dense scrub jungle. Critical encounter risk."
  },
  {
    id: "g2",
    name: "Moyar River Basin & Flash Flood Zone",
    type: "flooding",
    radius: 300,
    coordinates: [11.5820, 77.1550],
    severity: "moderate",
    description: "Steep river basin with rapid water surges and crocodile presence. Maintain a 50ft buffer from banks."
  },
  {
    id: "g3",
    name: "Dhimbam Hairpin Bends 9-14 Cliff Drop",
    type: "cliff_danger",
    radius: 280,
    coordinates: [11.6080, 77.1320],
    severity: "critical",
    description: "Steep 1,200ft valley drop with sharp ghat curves, heavy transport traffic, and narrow shoulders."
  }
];

let incidents: Incident[] = [
  {
    id: "inc-1",
    touristId: "t4",
    touristName: "Muthu kumar",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45m ago
    coordinates: [11.6450, 77.0950],
    street: "Talamalai Forest Ravine (Off Hasanur-Talamalai Rd)",
    country: "India",
    locality: "Talamalai Forest Range, Sathyamangalam, Tamil Nadu",
    formattedAddress: "Talamalai Wild Forest, Dhimbam Range, Sathyamangalam, Erode, Tamil Nadu 638461, India",
    type: "sos_button",
    status: "active",
    details: "SOS manual panic trigger from handheld tracker in Dhimbam forest range. Battery low and stranded off-trail near elephant corridor.",
    vitals: {
      heartRate: 125,
      battery: 12,
      temperature: 35.8
    },
    triagePlan: "🚨 SEARCH & RESCUE DISPATCH BLUEPRINT:\n1. Stranded tourist Muthu kumar is currently inside high-risk zone 'Talamalai Wild Elephant Corridor' in Dhimbam Forest Range, Sathyamangalam, Tamil Nadu, India.\n2. Battery is dangerously low (12%). Minimize radio transmission; switch device to Eco Beacon mode.\n3. Vitals show high heart rate (125 bpm) and cold exposure in forest terrain.\n4. Route recommendation: Dispatch Sathyamangalam Forest Department Anti-Poaching Watchers (APW) & Rapid Response Team (RRT) from Hasanur checkpost with 4WD safari vehicle, searchlights, and elephant repellant flares.\n5. Estimated arrival time: 40 minutes."
  }
];

let advisories: Advisory[] = [
  {
    id: "adv-1",
    title: "Dhimbam Ghat Night Traffic & Wild Elephant Advisory",
    content: "Dense fog and nocturnal wildlife movement active along Dhimbam Ghat (NH 948, 27 Hairpin Bends). Wild elephant crossings noted between bends 18 and 24. Night travel restricted between 6:00 PM and 6:00 AM.",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    type: "hazard",
    author: "Sathyamangalam Forest Range Command"
  },
  {
    id: "adv-2",
    title: "Wild Elephant Herd Active near Hasanur Forest Border",
    content: "Forest patrol tracked a breeding herd of wild elephants 2km north of Hasanur. Hikers must avoid interior jungle tracks and stay on marked forest road corridors.",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    type: "hazard",
    author: "Wildlife Safety Division, STR"
  }
];

// Helper to calculate distance in meters (Haversine)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Lazy Gemini Initialization & Graceful Fallback
function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Regional fallback lookup table for coordinates in Dhimbam Forest Range & Sathyamangalam Tiger Reserve
const KNOWN_REGIONAL_LOCATIONS: Array<{
  bounds: [number, number, number, number];
  street: string;
  locality: string;
  country: string;
  formattedAddress: string;
}> = [
  {
    bounds: [11.605, 11.625, 77.115, 77.135],
    street: "Dhimbam Ghat Viewpoint (27th Hairpin Bend, NH 948)",
    locality: "Dhimbam, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Dhimbam Ghat 27th Bend, NH 948, Sathyamangalam, Erode, Tamil Nadu 638461, India",
  },
  {
    bounds: [11.625, 11.645, 77.105, 77.128],
    street: "Hasanur Forest Trail (Sathyamangalam Tiger Reserve)",
    locality: "Hasanur, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Hasanur Forest Range, STR, Sathyamangalam, Erode, Tamil Nadu 638461, India",
  },
  {
    bounds: [11.585, 11.605, 77.135, 77.155],
    street: "Bannari Forest Checkpost (NH 948)",
    locality: "Bannari, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Bannari Amman Forest Checkpost, Sathyamangalam, Erode, Tamil Nadu 638401, India",
  },
  {
    bounds: [11.635, 11.655, 77.085, 77.105],
    street: "Talamalai Forest Ravine (Off Hasanur-Talamalai Rd)",
    locality: "Talamalai Forest Range, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Talamalai Wild Forest, Dhimbam Range, Sathyamangalam, Erode, Tamil Nadu 638461, India",
  },
  {
    bounds: [11.570, 11.590, 77.145, 77.165],
    street: "Moyar River Valley Corridor",
    locality: "Sathyamangalam Tiger Reserve, Tamil Nadu",
    country: "India",
    formattedAddress: "Moyar Gorge & Valley, Sathyamangalam, Erode, Tamil Nadu 638401, India",
  },
  {
    bounds: [11.500, 11.520, 77.225, 77.250],
    street: "Sathyamangalam Forest Division Headquarters",
    locality: "Sathyamangalam, Erode, Tamil Nadu",
    country: "India",
    formattedAddress: "Sathyamangalam Forest Range Office, Tamil Nadu 638401, India",
  }
];

function getRegionalFallback(lat: number, lng: number) {
  for (const loc of KNOWN_REGIONAL_LOCATIONS) {
    const [minLat, maxLat, minLng, maxLng] = loc.bounds;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return {
        street: loc.street,
        country: loc.country,
        locality: loc.locality,
        formattedAddress: loc.formattedAddress,
        lat,
        lng,
      };
    }
  }

  // If within Dhimbam / STR broader bounds (lat 11.45 - 11.75, lng 76.95 - 77.40)
  if (lat >= 11.45 && lat <= 11.75 && lng >= 76.95 && lng <= 77.40) {
    return {
      street: `Dhimbam Range Track (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      country: "India",
      locality: "Dhimbam Forest Range, Sathyamangalam, Tamil Nadu",
      formattedAddress: `Dhimbam Ghat Reserve, Sathyamangalam Tiger Reserve, Tamil Nadu, India`,
      lat,
      lng,
    };
  }

  // Southeast Asia / Thailand / Gulf of Thailand (lat 5.0 - 21.0, lng 97.0 - 106.0)
  if (lat >= 5.0 && lat <= 21.0 && lng >= 97.0 && lng <= 106.0) {
    const isGulf = lat >= 9.0 && lat <= 13.5 && lng >= 99.5 && lng <= 102.5;
    return {
      street: isGulf ? `Gulf of Thailand Route (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)` : `Coastal Route (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      country: "Thailand",
      locality: "Southern / Central Region, Thailand",
      formattedAddress: `${isGulf ? "Gulf of Thailand" : "Gulf Coast"}, Thailand (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      lat,
      lng,
    };
  }

  // Global coordinates fallback
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  return {
    street: `Location (${latStr}, ${lngStr})`,
    country: "International",
    locality: `Coordinates ${latStr}, ${lngStr}`,
    formattedAddress: `Global Position ${latStr}, ${lngStr}`,
    lat,
    lng,
  };
}

// API Endpoints

// Google Maps Platform Geocoding & Address Resolver
app.get("/api/maps/geocode", async (req, res) => {
  const { lat, lng, address } = req.query;
  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "AIzaSyCn2MsIC4918ooEk8M5TJ1DGzDCClTCIB0";

  if (lat && lng) {
    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);

    if (apiKey && apiKey !== "YOUR_GOOGLE_MAPS_API_KEY") {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${apiKey}&solution_id=gmp_mcp_codeassist_v1_aistudio`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === "OK" && data.results && data.results.length > 0) {
          const first = data.results[0];
          const components = first.address_components || [];
          const route = components.find((c: any) => c.types.includes("route"))?.long_name;
          const streetNumber = components.find((c: any) => c.types.includes("street_number"))?.long_name;
          const pointOfInterest = components.find((c: any) =>
            c.types.includes("point_of_interest") || c.types.includes("natural_feature") || c.types.includes("park")
          )?.long_name;
          const country = components.find((c: any) => c.types.includes("country"))?.long_name || "United States";
          const locality = components.find((c: any) =>
            c.types.includes("locality") || c.types.includes("administrative_area_level_2")
          )?.long_name || "Yosemite Valley";
          const adminArea = components.find((c: any) => c.types.includes("administrative_area_level_1"))?.short_name || "CA";

          const street = streetNumber && route ? `${streetNumber} ${route}` : (route || pointOfInterest || first.name || "Main Trail Access");
          return res.json({
            street,
            country,
            locality: `${locality}, ${adminArea}`,
            formattedAddress: first.formatted_address,
            lat: latNum,
            lng: lngNum,
          });
        }
      } catch (err) {
        console.warn("Google Maps Geocoding API call error:", err);
      }
    }

    const fallback = getRegionalFallback(latNum, lngNum);
    return res.json(fallback);
  }

  if (address) {
    const query = (address as string).trim();
    if (apiKey && apiKey !== "YOUR_GOOGLE_MAPS_API_KEY") {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&solution_id=gmp_mcp_codeassist_v1_aistudio`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === "OK" && data.results && data.results.length > 0) {
          const first = data.results[0];
          const loc = first.geometry.location;
          const components = first.address_components || [];
          const route = components.find((c: any) => c.types.includes("route"))?.long_name;
          const streetNumber = components.find((c: any) => c.types.includes("street_number"))?.long_name;
          const country = components.find((c: any) => c.types.includes("country"))?.long_name || "United States";
          const locality = components.find((c: any) => c.types.includes("locality"))?.long_name || "";
          const street = streetNumber && route ? `${streetNumber} ${route}` : (route || first.name || query);
          return res.json({
            street,
            country,
            locality,
            formattedAddress: first.formatted_address,
            lat: loc.lat,
            lng: loc.lng,
          });
        }
      } catch (err) {
        console.warn("Forward geocoding failed:", err);
      }
    }

    const qLower = query.toLowerCase();
    const matchedLoc = KNOWN_REGIONAL_LOCATIONS.find((loc) =>
      loc.street.toLowerCase().includes(qLower) ||
      loc.locality.toLowerCase().includes(qLower) ||
      loc.formattedAddress.toLowerCase().includes(qLower)
    );
    if (matchedLoc) {
      const midLat = (matchedLoc.bounds[0] + matchedLoc.bounds[1]) / 2;
      const midLng = (matchedLoc.bounds[2] + matchedLoc.bounds[3]) / 2;
      return res.json({
        street: matchedLoc.street,
        country: matchedLoc.country,
        locality: matchedLoc.locality,
        formattedAddress: matchedLoc.formattedAddress,
        lat: midLat,
        lng: midLng,
      });
    }

    return res.status(404).json({ error: "Address not found." });
  }

  return res.status(400).json({ error: "Provide lat,lng or address." });
});

// Google Maps Platform Elevation API
app.get("/api/maps/elevation", async (req, res) => {
  const { lat, lng } = req.query;
  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "AIzaSyCn2MsIC4918ooEk8M5TJ1DGzDCClTCIB0";

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng required." });
  }

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);

  if (apiKey && apiKey !== "YOUR_GOOGLE_MAPS_API_KEY") {
    try {
      const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${latNum},${lngNum}&key=${apiKey}&solution_id=gmp_mcp_codeassist_v1_aistudio`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
        const elevation = data.results[0].elevation;
        if (typeof elevation === "number") {
          const meters = Math.round(elevation);
          return res.json({
            meters,
            feet: Math.round(meters * 3.28084),
            source: "Google Maps Elevation API",
          });
        }
      }
    } catch (err) {
      console.warn("Google Maps Elevation API error:", err);
    }
  }

  return res.status(502).json({ error: "Elevation query unavailable." });
});

// Google Maps Platform Time Zone API
app.get("/api/maps/timezone", async (req, res) => {
  const { lat, lng, timestamp } = req.query;
  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "AIzaSyCn2MsIC4918ooEk8M5TJ1DGzDCClTCIB0";

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng required." });
  }

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  const timeSec = timestamp ? parseInt(timestamp as string, 10) : Math.floor(Date.now() / 1000);

  if (apiKey && apiKey !== "YOUR_GOOGLE_MAPS_API_KEY") {
    try {
      const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${latNum},${lngNum}&timestamp=${timeSec}&key=${apiKey}&solution_id=gmp_mcp_codeassist_v1_aistudio`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === "OK" && data.timeZoneId) {
        const totalOffsetSec = (data.rawOffset || 0) + (data.dstOffset || 0);
        const hours = Math.floor(Math.abs(totalOffsetSec) / 3600);
        const minutes = Math.floor((Math.abs(totalOffsetSec) % 3600) / 60);
        const sign = totalOffsetSec >= 0 ? "+" : "-";
        const utcOffset = `UTC${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

        return res.json({
          timeZoneId: data.timeZoneId,
          timeZoneName: data.timeZoneName || data.timeZoneId,
          utcOffset,
        });
      }
    } catch (err) {
      console.warn("Google Maps Time Zone API error:", err);
    }
  }

  return res.status(502).json({ error: "Time Zone query unavailable." });
});

// 1. Get entire tracking & safety system state
app.get("/api/state", (req, res) => {
  res.json({
    tourists,
    geofences,
    incidents,
    advisories,
  });
});

// 2. Register new tourist / person
app.post("/api/tourist/register", (req, res) => {
  const { 
    name, 
    phone, 
    coordinates, 
    notes, 
    street, 
    country, 
    locality, 
    formattedAddress,
    emergencyContact,
    bloodGroup,
    medicalNotes,
    age,
    gender,
    idProof,
    entryGate,
    permitNumber,
    assignedRanger
  } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Name and Phone are required." });
  }

  const coords: [number, number] = coordinates || [11.6125, 77.1261];
  const geoFallback = getRegionalFallback(coords[0], coords[1]);

  const newTourist: Tourist = {
    id: `t${Date.now()}`,
    name,
    phone,
    coordinates: coords,
    street: street || geoFallback.street,
    country: country || geoFallback.country,
    locality: locality || geoFallback.locality,
    formattedAddress: formattedAddress || geoFallback.formattedAddress,
    status: "safe",
    battery: 100,
    heartRate: 75,
    temperature: 36.6,
    altitude: 1050,
    lastUpdate: new Date().toISOString(),
    activity: "hiking",
    notes: notes || "Standard park entrant.",
    emergencyContact: emergencyContact || "Sathyamangalam Forest Post (04295-240228)",
    bloodGroup: bloodGroup || "O+ (Positive)",
    medicalNotes: medicalNotes || "No reported medical conditions.",
    age: age ? Number(age) : 30,
    gender: gender || "Not Specified",
    idProof: idProof || "Verified at Forest Gate",
    entryGate: entryGate || "Bannari Amman Gate #1",
    permitNumber: permitNumber || `STR-TRK-${Date.now().toString().slice(-4)}`,
    assignedRanger: assignedRanger || "Duty Ranger (STR Command)",
    updatedAt: new Date().toISOString(),
    batteryHistory: createInitialBatteryHistory(100, "nominal"),
  };

  tourists.push(newTourist);
  res.status(201).json(newTourist);
});

// 3. Update tourist location and metrics
app.post("/api/tourist/update", (req, res) => {
  const { 
    id, 
    coordinates, 
    battery, 
    heartRate, 
    temperature, 
    altitude, 
    activity, 
    street, 
    country, 
    locality, 
    formattedAddress,
    notes,
    emergencyContact,
    bloodGroup,
    medicalNotes,
    age,
    gender,
    idProof,
    entryGate,
    permitNumber,
    assignedRanger
  } = req.body;
  const tourist = tourists.find((t) => t.id === id);

  if (!tourist) {
    return res.status(404).json({ error: "Tourist not found." });
  }

  // Update person demographics and medical fields
  if (emergencyContact !== undefined) tourist.emergencyContact = emergencyContact;
  if (bloodGroup !== undefined) tourist.bloodGroup = bloodGroup;
  if (medicalNotes !== undefined) tourist.medicalNotes = medicalNotes;
  if (age !== undefined) tourist.age = Number(age);
  if (gender !== undefined) tourist.gender = gender;
  if (idProof !== undefined) tourist.idProof = idProof;
  if (entryGate !== undefined) tourist.entryGate = entryGate;
  if (permitNumber !== undefined) tourist.permitNumber = permitNumber;
  if (assignedRanger !== undefined) tourist.assignedRanger = assignedRanger;
  if (notes !== undefined) tourist.notes = notes;
  tourist.updatedAt = new Date().toISOString();

  // Update metrics
  if (coordinates) {
    tourist.coordinates = coordinates;
    if (!street && !country) {
      const geo = getRegionalFallback(coordinates[0], coordinates[1]);
      tourist.street = geo.street;
      tourist.country = geo.country;
      tourist.locality = geo.locality;
      tourist.formattedAddress = geo.formattedAddress;
    }
  }

  if (street) tourist.street = street;
  if (country) tourist.country = country;
  if (locality) tourist.locality = locality;
  if (formattedAddress) tourist.formattedAddress = formattedAddress;

  const previousBatt = tourist.battery;
  if (battery !== undefined) tourist.battery = Math.max(0, Math.min(100, battery));
  if (heartRate !== undefined) tourist.heartRate = heartRate;
  if (temperature !== undefined) tourist.temperature = temperature;
  if (altitude !== undefined) tourist.altitude = altitude;
  if (activity) tourist.activity = activity;
  tourist.lastUpdate = new Date().toISOString();

  // Track the last 10 battery updates for SAR hardware diagnostics
  if (!tourist.batteryHistory || tourist.batteryHistory.length === 0) {
    tourist.batteryHistory = createInitialBatteryHistory(tourist.battery, tourist.battery <= 20 ? "failing" : tourist.battery <= 40 ? "warning" : "nominal");
  } else {
    const drainDelta = previousBatt - tourist.battery;
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const voltage = Number((3.3 + (tourist.battery / 100) * 0.88).toFixed(2));
    
    tourist.batteryHistory.push({
      index: tourist.batteryHistory.length + 1,
      label: "Now",
      time: nowTime,
      battery: tourist.battery,
      voltage,
      drainDelta,
    });

    if (tourist.batteryHistory.length > 10) {
      tourist.batteryHistory = tourist.batteryHistory.slice(-10);
    }

    tourist.batteryHistory.forEach((pt, idx, arr) => {
      pt.index = idx + 1;
      pt.label = idx === arr.length - 1 ? "Now" : `U-${arr.length - 1 - idx}`;
    });
  }

  // Evaluate geofence breaches
  let breachZone: Geofence | null = null;
  for (const fence of geofences) {
    const dist = getDistanceMeters(
      tourist.coordinates[0],
      tourist.coordinates[1],
      fence.coordinates[0],
      fence.coordinates[1]
    );
    if (dist <= fence.radius) {
      breachZone = fence;
      break;
    }
  }

  // Handle status update
  if (tourist.status !== "danger") {
    if (breachZone) {
      tourist.status = breachZone.severity === "critical" ? "warning" : "warning";
      // Auto-warning for critical zones
      if (breachZone.severity === "critical" && !incidents.some((i) => i.touristId === tourist.id && i.status === "active")) {
        // Automatically create a geofence breach incident
        const newInc: Incident = {
          id: `inc-${Date.now()}`,
          touristId: tourist.id,
          touristName: tourist.name,
          timestamp: new Date().toISOString(),
          coordinates: [...tourist.coordinates],
          type: "geofence_breach",
          status: "active",
          details: `AUTOMATED ALERT: Entered hazardous geofenced zone "${breachZone.name}". Vital signs are being monitored.`,
          vitals: {
            heartRate: tourist.heartRate,
            battery: tourist.battery,
            temperature: tourist.temperature
          }
        };
        incidents.unshift(newInc);
      }
    } else {
      tourist.status = "safe";
    }
  }

  res.json({ tourist, breachedGeofence: breachZone });
});

// 3b. Batch update status for multiple tourists
app.post("/api/tourists/batch-status", (req, res) => {
  const { ids, status, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: "ids array and valid status are required." });
  }

  const validStatuses = ["safe", "warning", "danger"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "status must be safe, warning, or danger." });
  }

  const updated: Tourist[] = [];
  const now = new Date().toISOString();

  for (const id of ids) {
    const t = tourists.find((item) => item.id === id);
    if (t) {
      t.status = status;
      t.lastUpdate = now;
      t.updatedAt = now;
      if (reason && reason.trim()) {
        t.notes = `[MASS STATUS: ${status.toUpperCase()}] ${reason.trim()} (${new Date().toLocaleTimeString()})`;
      }
      updated.push(t);
    }
  }

  res.json({ success: true, count: updated.length, tourists: updated });
});

// 3c. Send broadcast alert to selected tourists
app.post("/api/tourists/batch-broadcast", (req, res) => {
  const { ids, message, severity, title } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !message) {
    return res.status(400).json({ error: "ids array and message are required." });
  }

  const now = new Date().toISOString();
  const alertTitle = title || `BROADCAST: ${severity ? severity.toUpperCase() : "ADVISORY"}`;
  
  // Create system advisory
  const newAdvisory: Advisory = {
    id: `adv-${Date.now()}`,
    title: alertTitle,
    content: message,
    timestamp: now,
    type: severity === "danger" ? "hazard" : severity === "warning" ? "weather" : "general",
    author: "Tactical Dispatch Desk",
  };
  advisories.unshift(newAdvisory);

  // Update target tourists
  const affectedTourists: Tourist[] = [];
  for (const id of ids) {
    const t = tourists.find((item) => item.id === id);
    if (t) {
      t.lastUpdate = now;
      t.updatedAt = now;
      t.notes = `[BROADCAST ${severity ? severity.toUpperCase() : "ALERT"}] ${message}`;
      if (severity === "danger") {
        t.status = "warning";
      }
      affectedTourists.push(t);
    }
  }

  res.json({
    success: true,
    count: affectedTourists.length,
    advisory: newAdvisory,
    tourists: affectedTourists,
  });
});

// 4. Trigger SOS / Emergency Alert
app.post("/api/tourist/sos", (req, res) => {
  const { id, isSOS, type } = req.body;
  const tourist = tourists.find((t) => t.id === id);

  if (!tourist) {
    return res.status(404).json({ error: "Tourist not found." });
  }

  if (isSOS) {
    tourist.status = "danger";
    // Create an incident if one doesn't exist
    const existingActive = incidents.find((i) => i.touristId === id && i.status !== "resolved");
    if (!existingActive) {
      const newInc: Incident = {
        id: `inc-${Date.now()}`,
        touristId: tourist.id,
        touristName: tourist.name,
        timestamp: new Date().toISOString(),
        coordinates: [...tourist.coordinates],
        type: type || "sos_button",
        status: "active",
        details: "Manual distress call triggered by the tourist.",
        vitals: {
          heartRate: tourist.heartRate,
          battery: tourist.battery,
          temperature: tourist.temperature
        }
      };
      incidents.unshift(newInc);
      res.json({ status: "success", tourist, incident: newInc });
    } else {
      res.json({ status: "success", tourist, incident: existingActive });
    }
  } else {
    tourist.status = "safe";
    // Resolve any active incident for this tourist
    incidents = incidents.map((inc) => {
      if (inc.touristId === id && inc.status !== "resolved") {
        return { ...inc, status: "resolved" as const };
      }
      return inc;
    });
    res.json({ status: "success", tourist });
  }
});

// 5. Update incident status
app.post("/api/incident/status", (req, res) => {
  const { id, status } = req.body;
  const incident = incidents.find((i) => i.id === id);

  if (!incident) {
    return res.status(404).json({ error: "Incident not found." });
  }

  incident.status = status;

  // Sync tourist status if resolved
  if (status === "resolved") {
    const tourist = tourists.find((t) => t.id === incident.touristId);
    if (tourist) {
      tourist.status = "safe";
    }
  }

  res.json(incident);
});

// 6. Intelligent Search & Rescue Triage (Gemini AI Feature)
app.post("/api/incident/triage", async (req, res) => {
  const { id } = req.body;
  const incident = incidents.find((i) => i.id === id);

  if (!incident) {
    return res.status(404).json({ error: "Incident not found." });
  }

  const tourist = tourists.find((t) => t.id === incident.touristId);
  const matchedGeofence = geofences.find((g) => {
    const dist = getDistanceMeters(
      incident.coordinates[0],
      incident.coordinates[1],
      g.coordinates[0],
      g.coordinates[1]
    );
    return dist <= g.radius;
  });

  const prompt = `
    Conduct an emergency search and rescue (SAR) tactical triage for the following national park emergency incident:
    
    TOURIST DETAILS:
    - Name: ${incident.touristName}
    - Phone: ${tourist?.phone || "Unknown"}
    - Last Known Position: [${incident.coordinates[0]}, ${incident.coordinates[1]}]
    - Current Heart Rate: ${incident.vitals.heartRate} bpm
    - Body Core Temp: ${incident.vitals.temperature} °C
    - Battery on Handheld: ${incident.vitals.battery}%
    - Activity at distress: ${tourist?.activity || "climbing"}
    - Special Notes: "${tourist?.notes || "Stranded on steep rocks."}"

    GEOGRAPHIC HAZARDS:
    - Current Location Hazard Context: ${matchedGeofence ? `Stranded inside geofenced risk zone: "${matchedGeofence.name}" (${matchedGeofence.description})` : "General back-country wilderness terrain."}
    - Severity: ${matchedGeofence?.severity || "High"}
    
    ALERT TYPE: ${incident.type} (Details: "${incident.details}")

    Based on the vitals, altitude, location, and battery stats, write a concise, highly professional Search and Rescue Dispatch Blueprint. 
    Format with clean markdown bullet points. Structure your blueprint exactly with these sections:
    1. 🚨 RISK ASSESSMENT (Assess critical threat levels for battery, thermal/hypothermia exposure, and physical fall risks)
    2. 🔋 DEVICE CONSERVATION ACTION (Provide specific advice on saving their 12% battery)
    3. 🚁 DISPATCH LEVEL & GEAR (What responder teams, vehicle types, or rescue ropes are needed)
    4. 🗺️ OPTIMAL ACCESS ROAD/TRAIL (Give a mock tactical approach direction from the Sathyamangalam / Hasanur Forest Range base)
    5. ⏳ RESPONSE WINDOW (Estimated hours before critical threat increases)

    Keep the wording clean, clinical, professional, and action-oriented. No flowery remarks.
  `;

  try {
    const ai = getGemini();
    if (!ai) {
      // Elegant simulated response if no API key is provided
      const fallbackPlans: Record<string, string> = {
        "inc-1": `🚨 RISK ASSESSMENT:
- **Wildlife Threat**: Critical. Located inside Talamalai Wild Elephant Corridor during dusk transit hours.
- **Physical Hazard**: Dense ravine terrain with thorny scrub vegetation and steep drop-offs.
- **Battery Expiry**: Critical. Handheld battery at 12%. Device will drop satellite beaconing within 45 minutes.

🔋 DEVICE CONSERVATION ACTION:
- Remote command: Transmit command to switch handheld tracker into **Eco-Beacon Mode** (interval throttled to 10 mins).
- Instruct tourist via SMS: Keep device protected from moisture, turn off auxiliary flashlight if battery bank is exhausted, use sound/whistle.

🚁 DISPATCH LEVEL & GEAR:
- Level: Category-1 Forest Search & Rescue Dispatch.
- Team: Sathyamangalam Forest Department Anti-Poaching Watchers (APW) & Rapid Response Team (RRT).
- Equipment: 4WD forestry patrol vehicle, high-powered searchlights, elephant repellant air horns/flares, thermal blankets, and trauma kit.

🗺️ OPTIMAL ACCESS ROAD/TRAIL:
- Deploy from Hasanur Forest Range Station along Talamalai road.
- Disembark at forest mile-marker 14; advance on foot along western ravine ridge to last GPS ping [11.6450, 77.0950].

⏳ RESPONSE WINDOW:
- Critical rescue window: **45 minutes** before complete darkness and potential herd movement.`,
      };

      const plan = fallbackPlans[incident.id] || `🚨 RISK ASSESSMENT:
- **Alert Trigger**: ${incident.type}.
- **Battery Status**: ${incident.vitals.battery}% remaining.
- **Physical Vitals**: Heart rate is ${incident.vitals.heartRate} bpm. Core temp is ${incident.vitals.temperature}°C.

🔋 DEVICE CONSERVATION ACTION:
- Instruct tourist to turn off non-essential telemetry, lower display brightness, and stay at a static identifiable landmark.

🚁 DISPATCH LEVEL & GEAR:
- Forest range search and rescue unit.
- Dispatch 2-person forest ranger squad equipped with first aid kits, emergency hydration, and communication radios.

🗺️ OPTIMAL ACCESS ROAD/TRAIL:
- Depart from nearest forest checkpost. Proceed along sector trail to coordinates [${incident.coordinates[0]}, ${incident.coordinates[1]}].

⏳ RESPONSE WINDOW:
- Response target is within 60 minutes. Monitor coordinates remotely.`;

      incident.triagePlan = plan;
      return res.json({ triagePlan: plan });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const triagePlan = response.text || "Failed to generate plan.";
    incident.triagePlan = triagePlan;
    res.json({ triagePlan });
  } catch (error: any) {
    console.error("Gemini triage generation failed:", error);
    res.status(500).json({ error: "Failed to generate AI triage plan. " + error.message });
  }
});

// 7. Add a safety advisory
app.post("/api/advisory/create", (req, res) => {
  const { title, content, type, author } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and Content are required." });
  }

  const newAdvisory: Advisory = {
    id: `adv-${Date.now()}`,
    title,
    content,
    timestamp: new Date().toISOString(),
    type: type || "general",
    author: author || "Forest Safety Desk",
  };

  advisories.unshift(newAdvisory);
  res.status(201).json(newAdvisory);
});

// 8. Generate Daily Safety Report & Advisories using Gemini
app.post("/api/advisory/generate-report", async (req, res) => {
  const { weatherCondition } = req.body; // e.g., "Thunderstorms", "Heavy Rain", "Wildfire Smoke"

  const prompt = `
    As the Safety Coordinator of Dhimbam Forest Range & Sathyamangalam Tiger Reserve (Tamil Nadu, India), draft a daily park-wide safety alert and briefing based on these parameters:
    - Forest Reserve: Dhimbam Forest Range, Sathyamangalam Tiger Reserve (Tamil Nadu, India)
    - Active Tourist Count: ${tourists.length} tracked forest trek groups / field teams
    - Current Simulated Weather / Forest Hazard: "${weatherCondition || "Dense Monsoon Mist & Wildlife Movement"}"
    - Active Hazards / Incidents: ${incidents.filter((i) => i.status === "active").length} ongoing forest rescue operations.

    Please write a formal, highly scannable daily Safety briefing.
    Include:
    1. A short, high-impact headline.
    2. A list of 3 specific, highly practical recommendations (e.g., Dhimbam 27 hairpin bends night driving rules, wild elephant safety, Moyar river flood warnings).
    3. An official concluding remark from Sathyamangalam Forest Division Headquarters.

    Keep it in markdown format. Under 200 words.
  `;

  try {
    const ai = getGemini();
    if (!ai) {
      const fallbackReport = `### ⚠️ FOREST ADVISORY: DHIMBAM GHAT & STR WILDLIFE BULLETIN

**Hazard Status**: Heavy Ghat Fog, Monsoon Runoff & Night Wildlife Crossing.
**Tracked Parties**: ${tourists.length} active field teams.
**Ongoing Rescues**: ${incidents.filter((i) => i.status === "active").length} active operation.

**CRITICAL GUIDELINES:**
1. **Dhimbam Ghat Safety**: NH 948 27 Hairpin Bends experience heavy mist. Use low-beam fog lamps; adhere to 30 km/h speed limit. Night movement strictly monitored.
2. **Wild Elephant Protocol**: If wild elephants or gaurs are sighted near Hasanur or Talamalai, do not sound horns or flash headlights. Maintain at least 100m distance.
3. **Moyar River Precautions**: High water discharge in Moyar gorge. Steer clear of wet boulders and river banks.

*Issued by Forest Range Officer, Sathyamangalam Tiger Reserve, Tamil Nadu.*`;

      const newAdv: Advisory = {
        id: `adv-${Date.now()}`,
        title: `Forest Intelligence: Dhimbam Ghat & STR Safety Update`,
        content: fallbackReport,
        timestamp: new Date().toISOString(),
        type: "hazard",
        author: "AI Dispatcher Bot"
      };
      advisories.unshift(newAdv);
      return res.json({ advisory: newAdv });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const reportContent = response.text || "Failed to generate report.";
    const newAdv: Advisory = {
      id: `adv-${Date.now()}`,
      title: `Ranger Intelligence: ${weatherCondition || "Storm Front"} Alert`,
      content: reportContent,
      timestamp: new Date().toISOString(),
      type: "weather",
      author: "AI Emergency Generator"
    };

    advisories.unshift(newAdv);
    res.json({ advisory: newAdv });
  } catch (error: any) {
    console.error("Gemini report generation failed:", error);
    res.status(500).json({ error: "Failed to generate AI advisory. " + error.message });
  }
});

// 9. AI Safety Assistant Chat (Tourist companion bot)
app.post("/api/tourist/ai-chat", async (req, res) => {
  const { messages, touristId } = req.body; // array of { sender, text }
  const tourist = tourists.find((t) => t.id === touristId);

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  const lastUserMessage = messages[messages.length - 1]?.text;
  if (!lastUserMessage) {
    return res.status(400).json({ error: "No user message found." });
  }

  // Construct context-rich conversation prompt
  const systemInstruction = `
    You are the "TourGuard Emergency Safety Guide", an AI wilderness survival and safety assistant embedded in a handheld tracker. 
    You are helping tourists and trekkers inside Dhimbam Forest Range & Sathyamangalam Tiger Reserve (Tamil Nadu, India). 
    
    TOURIST CURRENT STATE:
    - Name: ${tourist ? tourist.name : "Adventurer"}
    - Street / Trail (Google Maps): ${tourist?.street || "Dhimbam Ghat Viewpoint"}
    - Country (Google Maps): ${tourist?.country || "India"}
    - Full Address (Google Maps): ${tourist?.formattedAddress || "Dhimbam Ghat, Sathyamangalam, Tamil Nadu, India"}
    - Last Known Altitude: ${tourist ? tourist.altitude : 1050} meters
    - Last Known Location: [${tourist ? tourist.coordinates.join(", ") : "11.6125, 77.1261"}]
    - Battery Level: ${tourist ? tourist.battery : 100}%
    - Safety Status: ${tourist ? tourist.status : "safe"}

    INSTRUCTIONS:
    - Be brief, extremely supportive, and practical.
    - Provide bullet-point survival steps for their questions.
    - If they ask about their location, street, or country, inform them clearly based on their Google Maps geocoded position in Dhimbam / Sathyamangalam, Tamil Nadu, India.
    - If they say they are in immediate pain, bleeding, encountering aggressive wildlife (wild elephants, leopards), or trapped, advise them to PRESS the red SOS button immediately.
    - Ground your knowledge in Sathyamangalam Tiger Reserve guidelines (Asian wild elephant encounters, ghat driving caution, Moyar river safety, night forest curfews).
    - Limit replies to 3-4 sentences maximum. Keep text highly scannable since tourists are reading on small screens under distress.
  `;

  try {
    const ai = getGemini();
    if (!ai) {
      // Elegant fallback replies
      const text = lastUserMessage.toLowerCase();
      let reply = "";

      if (text.includes("where") || text.includes("location") || text.includes("street") || text.includes("country") || text.includes("address")) {
        reply = `📍 **CURRENT GOOGLE MAPS LOCATION:**\n- **Street / Area**: ${tourist?.street || "Dhimbam Ghat Viewpoint (27th Hairpin Bend)"}\n- **Country**: ${tourist?.country || "India"}\n- **Address**: ${tourist?.formattedAddress || "Dhimbam Ghat, Sathyamangalam, Tamil Nadu, India"}\n- **Coordinates**: [${tourist ? tourist.coordinates.join(", ") : "11.6125, 77.1261"}]\nSathyamangalam Forest Division SAR base has your GPS beacon locked.`;
      } else if (text.includes("elephant") || text.includes("animal") || text.includes("tiger") || text.includes("leopard")) {
        reply = `🐘 **WILD ELEPHANT / WILDLIFE SAFETY PROTOCOL:**\n1. Do **not** honk, shine high beams, or make loud screaming noises.\n2. Maintain at least 100 meters distance and never block the herd's path across the corridor.\n3. Slowly back away without turning your back completely.\n4. If trapped, stay inside your vehicle or retreat to an elevated forestry watchtower and press SOS.`;
      } else if (text.includes("rain") || text.includes("storm") || text.includes("mist") || text.includes("fog") || text.includes("weather")) {
        reply = `🌧️ **DHIMBAM GHAT MONSOON & MIST DRILL:**\n1. Heavy fog envelops hairpin bends 9 through 27. Switch on yellow fog lamps and drive in low gear (gear 1 or 2).\n2. Beware of sudden flash runoff across culverts along the ghat.\n3. Keep your handheld tracker in a waterproof pouch to preserve battery performance in humid conditions.`;
      } else if (text.includes("lost") || text.includes("dark") || text.includes("trail")) {
        reply = `🧭 **LOST IN DHIMBAM FOREST SAFETY DRILL:**\n1. **S.T.O.P.** (Stop, Think, Observe, Plan). Do not venture deeper into dense thorny scrub.\n2. Stay right at your current GPS coordinates. Moving makes forestry rescue searches harder.\n3. Conserve flashlight battery. If you hear wildlife or feel threatened, **hold down the red SOS button** to dispatch the Hasanur/Bannari Rapid Response Team.`;
      } else {
        reply = `👋 Vanakkam! I am your TourGuard AI safety guide for Dhimbam Forest Range & Sathyamangalam Tiger Reserve, ${tourist?.country || "India"}.\n\n💡 **Quick tips:**\n- Ask me about wild elephant safety, Dhimbam 27 hairpin bends travel rules, or your current GPS street location.\n- In any emergency, hold the **Distress SOS** button on your device to notify the forest ranger station.`;
      }

      return res.json({ text: reply });
    }

    // Call Gemini chat
    const formattedContents = messages.map((m) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction,
      },
    });

    res.json({ text: response.text || "I'm having trouble connecting to satellite signals, but stay safe!" });
  } catch (error: any) {
    console.error("Gemini Chat failed:", error);
    res.status(500).json({ error: "Failed to connect to AI Guide. " + error.message });
  }
});

// 10. Multi-Turn Teams Comms Inbox Chat (Gemini AI Feature)
app.post("/api/teams/chat", async (req, res) => {
  const { teamId, model, messages, customRole } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  const lastUserMessage = messages[messages.length - 1]?.text;
  if (!lastUserMessage) {
    return res.status(400).json({ error: "No user message found." });
  }

  // Model selection: support complex, general, fast, or default
  const validModels = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview"
  ];
  let targetModel = validModels.includes(model) ? model : "gemini-3.8-flash";

  // Compile real-time situational telemetry for context-aware grounding
  const activeSOS = incidents.filter((i) => i.status !== "resolved");
  const touristsSummary = tourists
    .map(
      (t) =>
        `- ${t.name} (ID: ${t.id}, Phone: ${t.phone}): Status ${t.status.toUpperCase()}, Battery ${t.battery}%, Heart Rate ${t.heartRate} bpm, Temp ${t.temperature}°C, Altitude ${t.altitude}m, Loc: [${t.coordinates.join(", ")}], Address: ${t.street || t.locality || "Dhimbam Range"}`
    )
    .join("\n");
  const incidentsSummary =
    activeSOS.length > 0
      ? activeSOS
          .map(
            (i) =>
              `- [URGENT ${i.type.toUpperCase()}] Tourist: ${i.touristName} (ID: ${i.touristId}), Coords: [${i.coordinates.join(", ")}], Details: "${i.details}", Vitals: HR ${i.vitals.heartRate} bpm / Batt ${i.vitals.battery}%`
          )
          .join("\n")
      : "No critical active emergencies currently registered.";
  const geofencesSummary = geofences
    .map((g) => `- ${g.name} (${g.severity.toUpperCase()}): ${g.description} [Coords: ${g.coordinates.join(", ")}]`)
    .join("\n");

  // Specific role definitions and system instructions
  let teamRoleName = "Tactical Dispatcher";
  let systemInstruction = "";

  switch (teamId) {
    case "team-rrt":
      teamRoleName = "Rapid Response Team (RRT) Tactical Search & Rescue Lead";
      systemInstruction = `
You are Commander Vikram, Tactical Lead of the Rapid Response Team (RRT) & Sathyamangalam Forest Search & Rescue (SAR).
Your callsign is "RRT-COMMAND". You coordinate ground patrols, anti-poaching watchers, 4WD extraction vehicles, drone sweeps, and night search logistics across Dhimbam Ghat and the Sathyamangalam Tiger Reserve.

YOUR ROLE & PERSONA:
- Authoritative, disciplined, tactical, and decisive military/forest ranger tone.
- Task Type: High-complexity search & rescue operations, topographical route planning, night extraction strategies.
- Use tactical format: [SITREP], [TACTICAL DEPLOYMENT], [EXTRACTION TIMELINE], [COORDINATES FOCUS].
- Always prioritize human life preservation and device battery conservation for tourists in distress.

CURRENT LIVE SITUATIONAL TELEMETRY:
Active Incidents:
${incidentsSummary}

Active Field Units / Tracked Parties:
${touristsSummary}

Active Geographic Hazard Corridors:
${geofencesSummary}

GUIDELINES:
- Address the operator directly (e.g., "Ranger Command, RRT-Lead copying.").
- If asked about Muthu kumar (who has an active SOS and 12% battery in Talamalai Ravine), provide immediate, actionable tactical extraction advice from Hasanur checkpost.
- Keep responses clean, professional, and formatted with bullet points.
      `.trim();
      break;

    case "team-medical":
      teamRoleName = "SAR Trauma Paramedic Unit (Medical Dispatch)";
      systemInstruction = `
You are Dr. Ananya Rao, Chief Medical Officer of the Wilderness Emergency Medical Service (EMS) and Forest SAR Paramedic Unit.
Your callsign is "MED-DISPATCH". You monitor physiological telemetries (heart rates, hypothermia risk, dehydration, heat exhaustion, physical falls).

YOUR ROLE & PERSONA:
- Calm, highly clinical, methodical, and medically reassuring.
- Task Type: General clinical assessment, vital signs triage, emergency medical protocol.
- Use clinical triage format: [TRIAGE LEVEL], [PHYSIOLOGICAL RISKS], [FIELD STABILIZATION PROTOCOL], [EVACUATION PRIORITY].
- Analyze tourists' actual biometrics (e.g., Muthu kumar: HR 125 bpm, temp 35.8°C indicating cold exposure/exhaustion; Moorthy: HR 118 bpm uphill fatigue; Selvan: nominal 76 bpm).

CURRENT LIVE SITUATIONAL TELEMETRY:
Active Incidents:
${incidentsSummary}

Tracked Tourist Biometrics:
${touristsSummary}

GUIDELINES:
- Offer step-by-step first-aid and medical guidance that rangers or tourists can apply before ambulance/field medic arrival.
- Always highlight hydration, airway/breathing, trauma care, and core temperature warming.
      `.trim();
      break;

    case "team-wildlife":
      teamRoleName = "STR Wildlife Division & Elephant Squad";
      systemInstruction = `
You are Ranger Murugan, Senior Wildlife Biologist & Asian Elephant Tracker with the Sathyamangalam Tiger Reserve (STR) Elephant Squad.
Your callsign is "ELEPHANT-SQUAD". You track elephant herd corridors, tiger/leopard territories, gaur movements, and human-wildlife conflict zones.

YOUR ROLE & PERSONA:
- Deeply knowledgeable about wildlife behavior, instincts, forest sound signals, and safety buffers.
- Task Type: General wildlife tracking, hazard zone verification, deterrent protocols.
- Use format: [HERD MOVEMENT INTEL], [CORRIDOR ADVISORY], [DETERRENT PROTOCOL], [SAFE BUFFER].

CURRENT LIVE SITUATIONAL TELEMETRY:
Hazard Zones:
${geofencesSummary}

Tracked Groups:
${touristsSummary}

Active Incidents:
${incidentsSummary}

GUIDELINES:
- Note that Talamalai ravine is an active elephant transit path.
- Provide practical rules: no honking, maintain 100m buffer, stay downwind if possible, deploy acoustic flares if charged, never run blindly into scrub.
      `.trim();
      break;

    case "team-traffic":
      teamRoleName = "Dhimbam Ghat & Weather Rapid Dispatch";
      systemInstruction = `
You are Inspector Ramesh, Chief of the Dhimbam Ghat Traffic Control & Rapid Weather Dispatch at Bannari Checkpost (NH 948).
Your callsign is "GHAT-DISPATCH". You manage vehicle clearances, 27 Hairpin Bends road logistics, sudden monsoon fog, landslides, and night curfews (6:00 PM to 6:00 AM).

YOUR ROLE & PERSONA:
- Fast-paced, concise radio style. Low-latency radio dispatcher.
- Task Type: Fast tasks, rapid status pings, road clearance, flash flood warnings on Moyar river basin.
- Use format: [RADIO ACK], [ROAD / WEATHER STATUS], [DISPATCH NOTICE].

CURRENT LIVE SITUATIONAL TELEMETRY:
Incidents & Tourists:
${touristsSummary}
${incidentsSummary}

GUIDELINES:
- Keep answers ultra-concise, rapid, and action-oriented (ideal for quick radio dispatch).
      `.trim();
      break;

    case "team-tourist-direct":
      teamRoleName = "Field Handsets Direct Intercom";
      systemInstruction = `
You are the Tactical Field Intercom operator bridging direct satellite radio with tourists currently carrying TourGuard handheld tracking units in Dhimbam Forest Range & Sathyamangalam Tiger Reserve.
Your callsign is "INTERCOM-RELAY".

CURRENT FIELD STATUS:
${touristsSummary}
Active Emergencies:
${incidentsSummary}

YOUR ROLE & PERSONA:
- You speak as the field communicator connected to the hikers' handsets.
- If the operator is addressing Muthu kumar (who triggered SOS in Talamalai Ravine with 12% battery), convey his urgent distress perspective: cold, darkness falling, elephants heard nearby, desperate for rescue.
- If addressing Selvan, Moorthy, or Ns Kumar, reflect their current physical situation based on their GPS coordinates and notes.
- Format responses like incoming field radio transmissions: [RADIO INCOMING: TOURIST HANDSET] followed by their message.
      `.trim();
      break;

    default:
      teamRoleName = "TourGuard Multi-Agency Response Team";
      systemInstruction = `
You are a specialized member of the TourGuard Integrated Emergency Management Network in Sathyamangalam Tiger Reserve.
Respond to the dispatch operator with professional, concise backcountry emergency intelligence.
Current Status:
${incidentsSummary}
${touristsSummary}
      `.trim();
  }

  if (customRole) {
    systemInstruction += `\nAdditional operational instruction: ${customRole}`;
  }

  try {
    const ai = getGemini();
    if (!ai) {
      // High-fidelity fallback replies when GEMINI_API_KEY is not configured
      const q = lastUserMessage.toLowerCase();
      let reply = "";

      if (teamId === "team-rrt") {
        if (q.includes("muthu") || q.includes("sos") || q.includes("extract") || q.includes("talamalai") || q.includes("rescue")) {
          reply = `**[SITREP // RRT-COMMAND TO HQ]**\n\n🚨 **URGENT EXTRACTION DIRECTIVE FOR MUTHU KUMAR:**\n- **Target Location**: Talamalai Ravine [11.6450, 77.0950], elevation 820m.\n- **Risk Vector**: Handheld battery at **12%** and dropping; terrain is dense scrub near the elephant corridor.\n\n**[TACTICAL DEPLOYMENT]:**\n1. **Strike Team Alpha**: 4 Anti-Poaching Watchers dispatched from Hasanur Range Station in 4WD Patrol Cruiser.\n2. **Gear Loadout**: High-lumen night searchlights, acoustic elephant deterrents, 100m tactical rescue rope, thermal foil wrap.\n3. **Extraction Route**: Advance down Talamalai fireline trail, milepost 14, foot transit 650m eastward.\n\n**[RESPONSE WINDOW]**: Team is 22 minutes from trailhead drop. Advise Muthu kumar via satellite SMS to stay stationary and conserve remaining battery.`;
        } else if (q.includes("status") || q.includes("all") || q.includes("team") || q.includes("where")) {
          reply = `**[SITREP // RRT-COMMAND]**\n- **All Units Report**: 4 active trackers in grid. 3 nominal (Selvan at 27th Bend, Moorthy at Hasanur, Ns Kumar at Bannari Gate).\n- **Active Priority**: 1 Category-1 Critical SOS (Muthu kumar, Talamalai Ravine).\n- **Field Readiness**: Hasanur RRT and Bannari Mobile Patrol on standby status with 100% radio mesh strength.`;
        } else {
          reply = `**[RRT-COMMAND COPYING HQ]**\nDirective received: "${lastUserMessage}".\n\n- Tactical reconnaissance team is standing by across Sathyamangalam sectors.\n- Recommend maintaining continuous ping interval on all handheld units.\n- Awaiting further orders for grid deployment or aerial drone support.`;
        }
      } else if (teamId === "team-medical") {
        if (q.includes("vitals") || q.includes("heart") || q.includes("muthu") || q.includes("temp") || q.includes("shock")) {
          reply = `**[MED-DISPATCH // CLINICAL ASSESSMENT]**\n\n🩺 **PATIENT TRIAGE: Muthu kumar (ID: t4)**\n- **Heart Rate**: 125 bpm — Marked sinus tachycardia secondary to severe acute stress, physical exertion, and fear.\n- **Core Temp**: 35.8°C — Borderline mild hypothermia. Dense ravine shade and evening moisture are accelerating heat loss.\n- **Hydration**: Presumed dehydrated from afternoon climbing.\n\n**[FIELD STABILIZATION DIRECTIVE]:**\n1. Instruct hiker to sit on dry branches or pack (avoid direct ground heat conduction).\n2. Don any spare layer, windbreaker, or emergency foil blanket.\n3. Sip remaining water slowly; perform controlled diaphragmatic breathing to lower tachycardia.\n4. Paramedic ambulance staged at Hasanur junction with warm saline IV and trauma shock blanket.`;
        } else if (q.includes("moorthy")) {
          reply = `**[MED-DISPATCH // CLINICAL ASSESSMENT]**\n\n🩺 **PATIENT: Moorthy (ID: t2)**\n- **Heart Rate**: 118 bpm, Temp 37.1°C.\n- **Diagnosis**: Exertional tachycardia during uphill grade climb to Hasanur plateau.\n- **Action**: Advise mandatory 15-minute hydration break in shaded tree cover. Monitor for heat exhaustion.`;
        } else {
          reply = `**[MED-DISPATCH // TRIAGE LEVEL GREEN]**\nAll field parties screened. Biometric streams show 1 active critical patient (Muthu kumar) and 3 non-critical patients. Medical telemetry link active.`;
        }
      } else if (teamId === "team-wildlife") {
        if (q.includes("elephant") || q.includes("animal") || q.includes("corridor") || q.includes("muthu") || q.includes("talamalai")) {
          reply = `**[ELEPHANT-SQUAD // WILDLIFE INTEL]**\n\n🐘 **HERD TELEMETRY & BUFFER ADVISORY:**\n- **Breeding Herd Position**: Radio collars indicate a family herd of 6 elephants moved across Talamalai Range 1.8km north-west of Muthu kumar's GPS coordinates.\n- **Dusk Behavior**: Herd is foraging towards Moyar river basin. Risk of encounter is **CRITICAL** if hiker attempts to thrash through bushes in darkness.\n\n**[DETERRENT PROTOCOL]:**\n1. RRT squad is carrying chili-smoke flares and high-frequency acoustic sirens to establish a 200m safety perimeter.\n2. Tourist MUST remain silent; no screaming, no flashing phone strobe into deep brush.\n3. Elephant tracks confirmed fresh along Hasanur-Talamalai boundary. Buffer is held.`;
        } else {
          reply = `**[ELEPHANT-SQUAD // CORRIDOR CLEARANCE]**\n- Bannari foothills to Dhimbam Hairpin 18: Clear of megafauna.\n- Hairpin 19 to 27: Leopard crossing signs spotted near culvert 24; motorists warned.\n- Talamalai Elephant Corridor: Active herd movement. Extreme caution required for field rescue operations.`;
        }
      } else if (teamId === "team-traffic") {
        reply = `**[GHAT-DISPATCH // RADIO ACK]**\n📻 **Bannari Checkpost & Dhimbam 27 Curves Report:**\n- **Ghat Road Condition**: Heavy mist reported between Hairpin Bends 12 and 22. Visibility < 25 meters.\n- **Night Curfew**: Active between 18:00 and 06:00. Commercial container trucks halted at Bannari gate.\n- **Emergency Clearance**: Rescue lane opened for RRT vehicle #STR-04 en route to Hasanur.\n- **Moyar River Level**: Gauge at 3.2m (nominal, moderate surge risk). All checkpoints synchronized.`;
      } else if (teamId === "team-tourist-direct") {
        if (q.includes("muthu") || q.includes("hold") || q.includes("help") || q.includes("stay")) {
          reply = `**[RADIO INCOMING // MUTHU KUMAR HANDSET (12% BATT)]**\n\n*"Ranger Command, I can hear your radio... It's getting pitch dark down here in the ravine. I am sitting on a large granite boulder as told. I heard heavy branch cracking about 200 meters away earlier... Please hurry, my battery just dipped to 12%. I will keep flashlight off and stay right here!"*`;
        } else if (q.includes("selvan")) {
          reply = `**[RADIO INCOMING // SELVAN HANDSET]**\n\n*"Ranger Command, Selvan here at Dhimbam 27th Hairpin viewpoint. Heavy mist rolling in, but I have full battery (84%) and safe footing. Standing by if you need relay assistance."*`;
        } else {
          reply = `**[RADIO INCOMING // FIELD SATELLITE MESH]**\nIntercom channel active. Handset units receiving text broadcasts. 4 handhelds registered on local satellite transponder.`;
        }
      } else {
        reply = `**[TEAM INBOX DISPATCH]**\nOperational transmission acknowledged for team "${teamRoleName}". Context updated with ${tourists.length} active tourists and ${incidents.length} incidents.`;
      }

      return res.json({
        text: reply,
        teamId,
        modelUsed: `${targetModel} (simulated fallback)`
      });
    }

    // Call real Gemini API
    const formattedContents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: formattedContents,
      config: {
        systemInstruction,
      },
    });

    res.json({
      text: response.text || "Operational acknowledgment sent.",
      teamId,
      modelUsed: targetModel
    });
  } catch (error: any) {
    console.error("Gemini Teams Chat failed:", error);
    res.status(500).json({ error: "Failed to connect to team frequency. " + error.message });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production build from:", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TourGuard server successfully listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
