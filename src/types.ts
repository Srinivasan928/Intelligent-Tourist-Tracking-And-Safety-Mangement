export interface BatteryDataPoint {
  index: number;
  label: string;
  time: string;
  battery: number;
  voltage: number;
  drainDelta?: number;
  isCriticalDrop?: boolean;
}

export interface Tourist {
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
  // Person Detailed Profile & Safety Data
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

export interface Geofence {
  id: string;
  name: string;
  type: "avalanche" | "flooding" | "cliff_danger" | "wildlife" | "exposure";
  radius: number; // in meters
  coordinates: [number, number];
  severity: "critical" | "moderate";
  description: string;
}

export interface Incident {
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

export interface Advisory {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  type: "weather" | "hazard" | "general";
  author: string;
}

export interface ChatMessage {
  id?: string;
  sender: "user" | "bot" | "system";
  text: string;
  timestamp: string;
  modelUsed?: string;
  status?: "sent" | "delivered" | "error";
  teamId?: string;
}

export interface TeamChannel {
  id: string;
  name: string;
  callsign: string;
  role: string;
  description: string;
  category: "tactical" | "medical" | "wildlife" | "dispatch" | "direct";
  avatar: string;
  status: "online" | "en-route" | "urgent" | "standby";
  defaultModel: "gemini-3.8-flash" | "gemini-3.5-flash" | "gemini-3.1-flash-lite" | "gemini-3.1-pro-preview";
  modelTier: "complex" | "general" | "fast";
  badge?: string;
  unreadCount: number;
  lastMessage?: string;
  lastTimestamp?: string;
  samplePrompts: string[];
}
