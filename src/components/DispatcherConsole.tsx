import { useState, FormEvent } from "react";
import { Tourist, Geofence, Incident, Advisory } from "../types";
import { 
  ShieldAlert, Activity as ActivityIcon, Users, AlertTriangle, CheckCircle, 
  Clock, Battery, Heart, Thermometer, MapPin, Sparkles, 
  FileText, ShieldAlert as ShieldIcon, ChevronRight, UserMinus, Plus, Send, RefreshCw, Layers, Crosshair, Zap,
  Globe, ExternalLink, Compass, MessageSquare, Database, User
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import BatteryConsumptionChart from "./BatteryConsumptionChart";
import { getGoogleMapsUrl, getGoogleStreetViewUrl } from "../services/googleMaps";

interface DispatcherConsoleProps {
  tourists: Tourist[];
  geofences: Geofence[];
  incidents: Incident[];
  advisories: Advisory[];
  selectedTouristId?: string | null;
  onFocusTourist: (coordinates: [number, number], id: string) => void;
  onUpdateIncidentStatus: (id: string, status: "dispatched" | "resolved") => void;
  onGenerateTriage: (id: string) => Promise<string>;
  onGenerateDailyAdvisory: (condition: string) => Promise<void>;
  onAddManualAdvisory: (title: string, content: string, type: "weather" | "hazard" | "general") => void;
  onAddTourist: (name: string, phone: string, notes: string) => void;
  onOpenTeamsInbox?: () => void;
  onOpenPersonnelDirectory?: (touristId?: string) => void;
}

export default function DispatcherConsole({
  tourists,
  geofences,
  incidents,
  advisories,
  selectedTouristId,
  onFocusTourist,
  onUpdateIncidentStatus,
  onGenerateTriage,
  onGenerateDailyAdvisory,
  onAddManualAdvisory,
  onAddTourist,
  onOpenTeamsInbox,
  onOpenPersonnelDirectory,
}: DispatcherConsoleProps) {
  // Safe array guards
  const safeTourists = Array.isArray(tourists) ? tourists : [];
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const safeGeofences = Array.isArray(geofences) ? geofences : [];
  const safeAdvisories = Array.isArray(advisories) ? advisories : [];

  // Filters
  const [touristFilter, setTouristFilter] = useState<"all" | "safe" | "warning" | "danger">("all");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(safeIncidents[0]?.id || null);
  
  // Console Tab State: Incidents vs Hardware Battery Diagnostics
  const [consoleTab, setConsoleTab] = useState<"incidents" | "battery_diagnostics">("incidents");
  const [selectedDiagnosticsTouristId, setSelectedDiagnosticsTouristId] = useState<string>(
    selectedTouristId || safeIncidents[0]?.touristId || safeTourists[0]?.id || "t1"
  );
  
  // Gemini Advisory state
  const [selectedWeather, setSelectedWeather] = useState("Severe Lightning & High Winds");
  const [isAdvisoryLoading, setIsAdvisoryLoading] = useState(false);
  const [isTriageLoading, setIsTriageLoading] = useState(false);

  // Manual advisory state
  const [newAdvTitle, setNewAdvTitle] = useState("");
  const [newAdvContent, setNewAdvContent] = useState("");
  const [newAdvType, setNewAdvType] = useState<"weather" | "hazard" | "general">("general");

  // Manual tourist register state
  const [newTourName, setNewTourName] = useState("");
  const [newTourPhone, setNewTourPhone] = useState("");
  const [newTourNotes, setNewTourNotes] = useState("");
  const [showAddTouristForm, setShowAddTouristForm] = useState(false);

  // Filters tourists
  const filteredTourists = safeTourists.filter((t) => {
    if (!t) return false;
    if (touristFilter === "all") return true;
    return t.status === touristFilter;
  });

  const activeIncidents = safeIncidents.filter((i) => i && i.status !== "resolved");
  const selectedIncident = safeIncidents.find((i) => i && i.id === selectedIncidentId);

  // Trigger Gemini Triage
  const handleTriageRequest = async (id: string) => {
    setIsTriageLoading(true);
    try {
      await onGenerateTriage(id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTriageLoading(false);
    }
  };

  // Trigger Gemini Daily Safety Advisory
  const handleAdvisoryRequest = async () => {
    setIsAdvisoryLoading(true);
    try {
      await onGenerateDailyAdvisory(selectedWeather);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdvisoryLoading(false);
    }
  };

  const handleManualAdvisorySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newAdvTitle.trim() || !newAdvContent.trim()) return;
    onAddManualAdvisory(newAdvTitle, newAdvContent, newAdvType);
    setNewAdvTitle("");
    setNewAdvContent("");
    setNewAdvType("general");
  };

  const handleAddTouristSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newTourName.trim() || !newTourPhone.trim()) return;
    onAddTourist(newTourName, newTourPhone, newTourNotes);
    setNewTourName("");
    setNewTourPhone("");
    setNewTourNotes("");
    setShowAddTouristForm(false);
  };

  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 text-[#F0F0F0]">
      
      {/* 1. Header Metrics - Spanned Full Column */}
      <div className="xl:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-brand-panel p-5 rounded-none border border-white/10 border-t-4 border-sky-500 flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 rounded-none text-sky-400 border border-sky-500/15">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40 font-mono mb-1">Active Tracked</div>
            <div className="text-3xl font-black font-display text-white">{`0${safeTourists.length}`.slice(-2)}</div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-brand-panel p-5 rounded-none border border-white/10 border-t-4 border-emerald-500 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-none text-emerald-400 border border-emerald-500/15">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40 font-mono mb-1">Nominal (Safe)</div>
            <div className="text-3xl font-black font-display text-emerald-400">
              {`0${safeTourists.filter((t) => t.status === "safe").length}`.slice(-2)}
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-brand-panel p-5 rounded-none border border-white/10 border-t-4 border-amber-500 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-none text-amber-400 border border-amber-500/15">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40 font-mono mb-1">Anomalies/Alerts</div>
            <div className="text-3xl font-black font-display text-amber-400">
              {`0${safeTourists.filter((t) => t.status === "warning").length}`.slice(-2)}
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-brand-panel p-5 rounded-none border border-white/10 border-t-4 border-brand-red flex items-center gap-4">
          <div className={`p-3 rounded-none border ${
            activeIncidents.length > 0 
              ? "bg-brand-red/10 text-brand-red border-brand-red/30 animate-pulse" 
              : "bg-white/5 text-white/30 border-white/10"
          }`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40 font-mono mb-1">Active SOS</div>
            <div className={`text-3xl font-black font-display ${activeIncidents.length > 0 ? "text-brand-red animate-pulse" : "text-white/40"}`}>
              {`0${activeIncidents.length}`.slice(-2)}
            </div>
          </div>
        </div>

      </div>

      {/* 2. Left Column (Ranger Incident Control Center) - 8 Cols */}
      <div className="xl:col-span-8 flex flex-col gap-6">
        
        {/* Active Emergencies Panel */}
        <div className="bg-brand-panel rounded-none border border-white/10 overflow-hidden shadow-lg flex-1 border-t-4 border-brand-red">
          <div className="bg-brand-bg px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-4.5 h-4.5 text-brand-red" />
              <h2 className="text-xs uppercase tracking-[0.2em] font-black font-display text-white/90">Emergency Dispatch & Incident Control</h2>
            </div>
            <span className="text-[10px] bg-brand-red/10 text-brand-red px-2 py-0.5 rounded-none font-mono border border-brand-red/25 font-black uppercase tracking-wider">
              REAL-TIME SAT-FEED
            </span>
          </div>

          {/* Console Sub-Tab Switcher */}
          <div className="flex border-b border-white/10 bg-black/40 text-[10px] font-mono font-bold">
            <button
              onClick={() => setConsoleTab("incidents")}
              className={`px-4 py-2.5 flex items-center gap-2 border-b-2 uppercase tracking-wider cursor-pointer transition-colors ${
                consoleTab === "incidents"
                  ? "border-brand-red text-white bg-white/5 font-black"
                  : "border-transparent text-white/50 hover:text-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-brand-red" />
              Active Incidents ({activeIncidents.length})
            </button>
            <button
              onClick={() => setConsoleTab("battery_diagnostics")}
              className={`px-4 py-2.5 flex items-center gap-2 border-b-2 uppercase tracking-wider cursor-pointer transition-colors ${
                consoleTab === "battery_diagnostics"
                  ? "border-sky-400 text-white bg-white/5 font-black"
                  : "border-transparent text-white/50 hover:text-white"
              }`}
            >
              <Battery className="w-3.5 h-3.5 text-sky-400" />
              Hardware Battery Diagnostics (10 Updates)
              {safeTourists.some((t) => t.battery <= 20) && (
                <span className="w-2 h-2 rounded-full bg-brand-red animate-ping inline-block" />
              )}
            </button>
          </div>

          {consoleTab === "incidents" ? (
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[360px]">
            {/* Sub-pane: Emergency list (4 cols) */}
            <div className="md:col-span-4 border-r border-white/10 flex flex-col">
              <div className="bg-black/20 p-2.5 border-b border-white/10 text-[10px] font-mono font-bold tracking-wider text-white/40 uppercase">
                ACTIVE INCIDENTS ({activeIncidents.length})
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[360px]">
                {activeIncidents.length === 0 ? (
                  <div className="p-8 text-center text-white/30 text-xs font-mono h-full flex flex-col items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500/30 mb-2" />
                    No active backcountry alerts. Nominal state.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {activeIncidents.map((inc) => {
                      const isSelected = selectedIncidentId === inc.id;
                      return (
                        <button
                          key={inc.id}
                          onClick={() => {
                            setSelectedIncidentId(inc.id);
                            onFocusTourist(inc.coordinates, inc.touristId);
                          }}
                          className={`w-full text-left p-3 flex flex-col gap-1 cursor-pointer transition-colors focus:outline-none rounded-none ${
                            isSelected 
                              ? "bg-brand-red/10 border-l-2 border-brand-red" 
                              : "hover:bg-white/5 border-l-2 border-transparent"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black font-mono text-white/40">{inc.id.toUpperCase()}</span>
                            <span className="text-[8px] font-mono text-white/40 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="text-xs font-black text-white font-display uppercase">{inc.touristName}</span>
                          <span className="text-[10px] text-brand-red font-mono uppercase font-black tracking-wide">
                            ⚠️ {inc.type.replace("_", " ")}
                          </span>
                          <span className="text-[9px] text-white/50 line-clamp-1">{inc.details}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sub-pane: Selected Emergency details (8 cols) */}
            <div className="md:col-span-8 p-4 flex flex-col justify-between bg-[#111112] min-h-[300px]">
              {selectedIncident ? (
                <div className="flex flex-col gap-4 flex-1">
                  
                  {/* Alert Header */}
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-brand-red/10 text-brand-red border border-brand-red/25 px-2 py-0.5 rounded-none font-mono font-black uppercase tracking-wider">
                          CRITICAL DISTRESS
                        </span>
                        <span className="text-xs text-white/40 font-mono">ID: {selectedIncident.id}</span>
                      </div>
                      <h3 className="text-base font-black font-display text-white mt-1 uppercase">
                        Hiker: {selectedIncident.touristName}
                      </h3>
                    </div>
                    
                    <div className="flex gap-1.5 text-xs">
                      {selectedIncident.status === "active" ? (
                        <button
                          onClick={() => onUpdateIncidentStatus(selectedIncident.id, "dispatched")}
                          className="bg-amber-600 hover:bg-amber-500 text-white font-black font-display text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-none cursor-pointer transition-colors focus:outline-none border border-amber-500/20"
                        >
                          Dispatch SAR Team
                        </button>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-none font-black font-display text-[11px] uppercase tracking-wider">
                          Rangers Dispatched
                        </span>
                      )}

                      <button
                        onClick={() => onUpdateIncidentStatus(selectedIncident.id, "resolved")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black font-display text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-none cursor-pointer transition-colors focus:outline-none border border-emerald-500/20"
                      >
                        Resolve SOS
                      </button>

                      {onOpenTeamsInbox && (
                        <button
                          onClick={onOpenTeamsInbox}
                          className="bg-sky-600 hover:bg-sky-500 text-white font-black font-display text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-none cursor-pointer transition-colors focus:outline-none border border-sky-400/30 flex items-center gap-1.5 shadow-sm"
                          title="Open multi-turn Teams Comms Inbox to coordinate with SAR response teams"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Teams Radio
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Victim Telemetry Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-brand-bg p-3.5 rounded-none border border-white/10">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black tracking-wider font-mono text-white/40 uppercase">Heart Rate</span>
                      <span className="text-xs font-black font-mono text-white flex items-center gap-1.5 mt-0.5">
                        <Heart className="w-3.5 h-3.5 text-brand-red animate-pulse" />
                        {selectedIncident.vitals.heartRate} bpm
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black tracking-wider font-mono text-white/40 uppercase">Core Temp</span>
                      <span className="text-xs font-black font-mono text-white flex items-center gap-1.5 mt-0.5">
                        <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                        {selectedIncident.vitals.temperature}°C
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black tracking-wider font-mono text-white/40 uppercase">Satellite Batt</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-black font-mono text-white flex items-center gap-1">
                          <Battery className={`w-3.5 h-3.5 ${selectedIncident.vitals.battery < 20 ? "text-brand-red animate-pulse" : "text-white/40"}`} />
                          {selectedIncident.vitals.battery}%
                        </span>
                        <button
                          onClick={() => {
                            setSelectedDiagnosticsTouristId(selectedIncident.touristId);
                            setConsoleTab("battery_diagnostics");
                          }}
                          className="text-[9px] text-sky-400 hover:text-sky-300 font-mono underline cursor-pointer"
                          title="Inspect 10-update battery line chart"
                        >
                          [Chart]
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black tracking-wider font-mono text-white/40 uppercase">Coordinates</span>
                      <button
                        onClick={() => onFocusTourist(selectedIncident.coordinates, selectedIncident.touristId)}
                        className="text-[10px] font-mono text-sky-400 hover:underline flex items-center gap-0.5 mt-0.5 text-left focus:outline-none font-bold"
                      >
                        <MapPin className="w-3 h-3" />
                        {selectedIncident.coordinates[0].toFixed(4)}, {selectedIncident.coordinates[1].toFixed(4)}
                      </button>
                    </div>
                  </div>

                  {/* Google Maps Location & Navigation Card */}
                  <div className="bg-brand-bg p-3.5 rounded-none border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold">
                        <Globe className="w-3.5 h-3.5" />
                        <span>GOOGLE MAPS TELEMETRY</span>
                      </div>
                      <div className="text-xs text-white">
                        <span className="text-white/40 uppercase text-[9px] font-bold block">Street / Trail Route:</span>
                        <span className="font-bold text-white text-[12px]">{selectedIncident.street || "Tenaya Canyon Ravine (Off Tioga Pass Rd)"}</span>
                      </div>
                      <div className="text-xs text-emerald-400">
                        <span className="text-white/40 uppercase text-[9px] font-bold block">Country & Region:</span>
                        <span>{selectedIncident.country || "United States"} {selectedIncident.locality ? `• ${selectedIncident.locality}` : ""}</span>
                      </div>
                      {selectedIncident.formattedAddress && (
                        <div className="text-[10px] text-white/50">
                          📍 {selectedIncident.formattedAddress}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                      <a
                        href={getGoogleMapsUrl(selectedIncident.coordinates[0], selectedIncident.coordinates[1])}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-initial bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 flex items-center justify-center gap-1.5 transition-colors no-underline shadow-md"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open in Google Maps</span>
                      </a>
                      <a
                        href={getGoogleStreetViewUrl(selectedIncident.coordinates[0], selectedIncident.coordinates[1])}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-initial bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 flex items-center justify-center gap-1.5 transition-colors no-underline border border-white/15 shadow-md"
                      >
                        <Compass className="w-3 h-3" />
                        <span>Street View</span>
                      </a>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="text-xs text-white/70 leading-relaxed bg-brand-bg p-3 rounded-none border border-white/10">
                    <strong className="text-white/40 font-mono text-[9px] font-bold uppercase tracking-wider block mb-1">Incident Logs</strong> {selectedIncident.details}
                  </div>

                  {/* Gemini Triage Section */}
                  <div className="flex-1 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                        Gemini Intelligent Triage
                      </span>
                      {!selectedIncident.triagePlan && (
                        <button
                          onClick={() => handleTriageRequest(selectedIncident.id)}
                          disabled={isTriageLoading}
                          className="bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black font-mono px-3 py-1 rounded-none cursor-pointer transition-colors focus:outline-none flex items-center gap-1 shadow-md disabled:opacity-50 uppercase tracking-wider"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTriageLoading ? "animate-spin" : ""}`} />
                          {isTriageLoading ? "Analyzing..." : "Draft Plan"}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-h-[140px] bg-brand-bg p-4 rounded-none border border-white/10 font-mono text-[11px] leading-relaxed text-sky-200 overflow-y-auto max-h-[190px]">
                      {isTriageLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-white/40 gap-2">
                          <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
                          <span className="uppercase tracking-wider text-[10px]">Evaluating heart rate, hypothermia thresholds, and geofences...</span>
                        </div>
                      ) : selectedIncident.triagePlan ? (
                        <div className="whitespace-pre-line text-white/80 prose prose-invert prose-xs">
                          {selectedIncident.triagePlan}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-white/30 gap-1.5 p-4 text-center">
                          <FileText className="w-7 h-7 text-white/10" />
                          <span className="text-[10px] uppercase tracking-wider font-bold">No triage plan generated yet. Run Gemini AI S.O.S. triage.</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/30 gap-2 py-10">
                  <CheckCircle className="w-12 h-12 text-emerald-500/10" />
                  <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Select an active emergency from the panel to oversee triage.</span>
                </div>
              )}
            </div>
          </div>
          ) : (
            <div className="p-4 bg-brand-bg/40">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4 text-sky-400" />
                  <span className="text-xs uppercase tracking-widest font-black text-white font-display">
                    Telemetric Battery Diagnostics (10 Updates)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/50 uppercase font-mono font-bold">Select Hiker:</label>
                  <select
                    value={selectedDiagnosticsTouristId}
                    onChange={(e) => setSelectedDiagnosticsTouristId(e.target.value)}
                    className="bg-brand-panel border border-white/20 text-white text-xs px-2.5 py-1 rounded-none font-mono focus:outline-none focus:border-sky-400"
                  >
                    {tourists.map((t) => (
                      <option key={t.id} value={t.id} className="bg-brand-bg text-white">
                        {t.name} ({t.battery}%) - {t.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(() => {
                const diagTourist = tourists.find((t) => t.id === selectedDiagnosticsTouristId) || tourists[0];
                return diagTourist ? (
                  <BatteryConsumptionChart tourist={diagTourist} />
                ) : (
                  <div className="text-white/40 text-xs font-mono p-4">No hiker selected.</div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Tracked Backcountry Hikers Roster */}
        <div className="bg-brand-panel rounded-none border border-white/10 overflow-hidden shadow-lg border-t-4 border-sky-500">
          <div className="bg-brand-bg px-4 py-3 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-sky-400" />
              <h2 className="text-xs uppercase tracking-[0.2em] font-black font-display text-white/90">Tracked Back-country Hikers Roster</h2>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {(["all", "safe", "warning", "danger"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTouristFilter(filter)}
                  className={`text-[10px] font-black font-mono uppercase px-2.5 py-1 rounded-none border focus:outline-none cursor-pointer tracking-wider ${
                    touristFilter === filter 
                      ? "bg-sky-500/10 border-sky-500 text-sky-400" 
                      : "bg-black/20 border-white/10 text-white/40 hover:text-white/80"
                  }`}
                >
                  {filter === "all" ? "All" : filter === "danger" ? "🚨 SOS" : filter === "warning" ? "⚠️ Alert" : "🟢 Safe"}
                </button>
              ))}
              
              {onOpenPersonnelDirectory && (
                <button
                  onClick={() => onOpenPersonnelDirectory()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30 text-[10px] font-black font-mono px-2.5 py-1 rounded-none cursor-pointer flex items-center gap-1.5 focus:outline-none uppercase tracking-wider shadow-sm"
                  title="Open Persons Directory with Firebase persistence, blood group, and emergency records"
                >
                  <Database className="w-3 h-3 text-emerald-200" /> Persons Data ({safeTourists.length})
                </button>
              )}

              <button
                onClick={() => setShowAddTouristForm(!showAddTouristForm)}
                className="bg-brand-panel hover:bg-white/10 text-white/90 border border-white/10 text-[10px] font-black font-mono px-2.5 py-1 rounded-none cursor-pointer flex items-center gap-1 focus:outline-none uppercase tracking-wider"
              >
                <Plus className="w-3 h-3 text-brand-red" /> Register
              </button>
            </div>
          </div>

          <div className="p-4">
            
            {/* Collapse form to add tourist */}
            <AnimatePresence>
              {showAddTouristForm && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddTouristSubmit}
                  className="bg-brand-bg p-4 rounded-none border border-white/10 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black font-mono uppercase text-white/40 tracking-wider">Hiker Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={newTourName}
                      onChange={(e) => setNewTourName(e.target.value)}
                      className="bg-brand-panel border border-white/10 rounded-none px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black font-mono uppercase text-white/40 tracking-wider">Handheld Phone Key</label>
                    <input
                      type="text"
                      required
                      placeholder="+1 (555) 000-0000"
                      value={newTourPhone}
                      onChange={(e) => setNewTourPhone(e.target.value)}
                      className="bg-brand-panel border border-white/10 rounded-none px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black font-mono uppercase text-white/40 tracking-wider">Route Plan & Notes</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Half Dome Loop, water supply..."
                        value={newTourNotes}
                        onChange={(e) => setNewTourNotes(e.target.value)}
                        className="flex-1 bg-brand-panel border border-white/10 rounded-none px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <button
                        type="submit"
                        className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase tracking-wider px-4 rounded-none cursor-pointer focus:outline-none border border-sky-500/20"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Tourist List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 font-mono text-[10px] uppercase tracking-wider font-bold">
                    <th className="py-2.5 px-2">Hiker Name</th>
                    <th className="py-2.5 px-2">Device Status</th>
                    <th className="py-2.5 px-2 text-center">💓 Heart</th>
                    <th className="py-2.5 px-2 text-center">🌡️ Core Temp</th>
                    <th className="py-2.5 px-2 text-center">🔋 Battery</th>
                    <th className="py-2.5 px-2">⛰️ Elev / Activity</th>
                    <th className="py-2.5 px-2 text-right">Radar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTourists.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-white/30 font-mono">
                        No tracked tourists match this filter category.
                      </td>
                    </tr>
                  ) : (
                    filteredTourists.map((tourist) => {
                      let statusBadge = "Safe";
                      let statusStyle = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                      if (tourist.status === "warning") {
                        statusBadge = "Alert";
                        statusStyle = "text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse";
                      } else if (tourist.status === "danger") {
                        statusBadge = "SOS Distress";
                        statusStyle = "text-brand-red bg-brand-red/15 border-brand-red/25 font-black animate-pulse";
                      }

                      const isSelected = selectedTouristId === tourist.id;

                      return (
                        <tr 
                          key={tourist.id} 
                          onClick={() => onFocusTourist(tourist.coordinates, tourist.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-sky-500/15 border-l-2 border-sky-400"
                              : "hover:bg-white/5 border-l-2 border-transparent"
                          }`}
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1.5">
                              {isSelected && <Crosshair className="w-3 h-3 text-sky-400 shrink-0 animate-pulse" />}
                              <div>
                                <div className="font-black text-white font-display uppercase text-[12px] flex items-center gap-1.5 flex-wrap">
                                  <span>{tourist.name}</span>
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-slate-800 text-emerald-400 border border-emerald-500/30">
                                    {tourist.bloodGroup || "O+ (Pos)"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-white/50 font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span>{tourist.phone}</span>
                                  {tourist.emergencyContact && (
                                    <span className="text-amber-400/90 truncate max-w-[170px]" title={tourist.emergencyContact}>
                                      • ICE: {tourist.emergencyContact}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-sky-400 font-mono mt-0.5 flex items-center gap-1 font-semibold">
                                  <span>📍 {tourist.street || "Dhimbam Ghat Viewpoint"}</span>
                                  <span className="text-white/30">•</span>
                                  <span className="text-emerald-400">{tourist.country || "India"}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`text-[9px] font-black font-mono uppercase px-2 py-0.5 rounded-none border ${statusStyle}`}>
                              {statusBadge}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="font-mono font-bold flex items-center justify-center gap-1 text-white/90">
                              <Heart className={`w-3.5 h-3.5 text-brand-red ${tourist.heartRate > 110 ? "animate-pulse" : ""}`} />
                              {tourist.heartRate} <span className="text-[9px] text-white/40">bpm</span>
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="font-mono text-white/90 font-bold">{tourist.temperature.toFixed(1)}°C</span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-12 bg-white/10 h-1.5 rounded-none overflow-hidden">
                                <div 
                                  className={`h-full ${tourist.battery < 20 ? "bg-brand-red" : tourist.battery < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${tourist.battery}%` }}
                                ></div>
                              </div>
                              <span className="font-mono text-[10px] text-white/60 font-bold">{tourist.battery}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-mono text-[11px] text-white/90 font-bold">{tourist.altitude}m</div>
                            <div className="text-[10px] text-emerald-400 capitalize flex items-center gap-1 font-bold">
                              <ActivityIcon className="w-3 h-3" />
                              {tourist.activity}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1.5 ml-auto">
                              {onOpenPersonnelDirectory && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPersonnelDirectory(tourist.id);
                                  }}
                                  className="border border-white/15 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[10px] font-mono px-2 py-1 rounded-none cursor-pointer transition-colors flex items-center gap-1"
                                  title="View full personal and emergency profile"
                                >
                                  <User className="w-3 h-3" />
                                  Data
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFocusTourist(tourist.coordinates, tourist.id);
                                }}
                                className={`border text-[10px] font-black font-mono px-2.5 py-1 rounded-none cursor-pointer focus:outline-none flex items-center gap-1.5 uppercase tracking-wider transition-all ${
                                  isSelected
                                    ? "bg-sky-500 text-white border-sky-400 shadow-md"
                                    : "bg-brand-panel hover:bg-white/10 border-white/10 text-sky-400 hover:text-sky-300"
                                }`}
                                title="Smooth programmatic zoom to hiker coordinates on map"
                              >
                                <Crosshair className={`w-3 h-3 ${isSelected ? "animate-spin" : ""}`} />
                                {isSelected ? "Locked" : "Focus 17x"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

      {/* 3. Right Column (Ranger Bulletins & Geofence Registry) - 4 Cols */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        
        {/* Advisories Feed */}
        <div className="bg-brand-panel rounded-none border border-white/10 overflow-hidden shadow-lg flex flex-col h-full min-h-[380px] border-t-4 border-amber-500">
          <div className="bg-brand-bg px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-amber-500" />
            <h2 className="text-xs uppercase tracking-[0.2em] font-black font-display text-white/90">Ranger Safety Advisories</h2>
          </div>

          <div className="p-4 flex flex-col gap-4 flex-1">
            
            {/* Gemini AI Daily Report Drawer */}
            <div className="bg-brand-bg p-4 rounded-none border border-white/10">
              <span className="text-[10px] font-black font-mono uppercase text-white/40 tracking-wider flex items-center gap-1 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                Gemini Safety Advisor Drafting
              </span>
              
              <div className="flex flex-col gap-2">
                <div className="flex flex-col">
                  <label className="text-[8px] font-black font-mono text-white/40 uppercase tracking-wider">Simulated Daily Weather</label>
                  <select
                    value={selectedWeather}
                    onChange={(e) => setSelectedWeather(e.target.value)}
                    className="bg-brand-panel border border-white/10 text-slate-200 text-xs rounded-none px-2 py-1.5 mt-1 focus:outline-none font-mono"
                  >
                    <option>Severe Lightning & High Winds</option>
                    <option>Merced River Flood Warning</option>
                    <option>Extreme Heat Exhaustion Advisory</option>
                    <option>Thick Forest Fire Smoke Watch</option>
                    <option>Blizzard & Ice Pack Storm</option>
                  </select>
                </div>

                <button
                  onClick={handleAdvisoryRequest}
                  disabled={isAdvisoryLoading}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-black font-mono py-2 rounded-none cursor-pointer transition-colors focus:outline-none flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 uppercase tracking-wider mt-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAdvisoryLoading ? "animate-spin" : ""}`} />
                  {isAdvisoryLoading ? "Drafting bulletin..." : "Draft AI Weather Advisory"}
                </button>
              </div>
            </div>

            {/* List of active advisories */}
            <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 flex flex-col gap-3">
              {advisories.map((adv) => {
                const isWeather = adv.type === "weather";
                const isHazard = adv.type === "hazard";
                return (
                  <div 
                    key={adv.id} 
                    className={`p-3 rounded-none border text-xs flex flex-col gap-1.5 ${
                      isWeather 
                        ? "bg-brand-red/5 border-brand-red/20" 
                        : isHazard 
                          ? "bg-amber-500/5 border-amber-500/20" 
                          : "bg-black/20 border-white/10"
                    }`}
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-1">
                      <span className={`text-[9px] font-black font-mono uppercase tracking-wider ${
                        isWeather ? "text-brand-red" : isHazard ? "text-amber-400" : "text-sky-400"
                      }`}>
                        📢 {adv.type.toUpperCase()}
                      </span>
                      <span className="text-[8px] font-mono text-white/40 font-bold">
                        {new Date(adv.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-black text-white font-display text-[12px] uppercase">{adv.title}</h4>
                    <div className="text-[11px] text-white/80 leading-relaxed font-sans whitespace-pre-line prose prose-invert prose-xs">
                      {adv.content}
                    </div>
                    <div className="text-[9px] text-white/40 font-mono text-right mt-1 font-bold">
                      By: {adv.author}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual Quick Bulletin Submit */}
            <form onSubmit={handleManualAdvisorySubmit} className="border-t border-white/10 pt-3 flex flex-col gap-2">
              <span className="text-[9px] font-black font-mono text-white/40 uppercase tracking-wider">Write Manual Ranger Advisory</span>
              <input
                type="text"
                required
                placeholder="Alert Title"
                value={newAdvTitle}
                onChange={(e) => setNewAdvTitle(e.target.value)}
                className="bg-brand-bg border border-white/10 rounded-none px-2 py-1 text-xs text-white focus:outline-none font-mono"
              />
              <textarea
                required
                rows={2}
                placeholder="Alert content..."
                value={newAdvContent}
                onChange={(e) => setNewAdvContent(e.target.value)}
                className="bg-brand-bg border border-white/10 rounded-none px-2 py-1 text-xs text-white focus:outline-none resize-none font-mono"
              />
              <div className="flex gap-2">
                <select
                  value={newAdvType}
                  onChange={(e: any) => setNewAdvType(e.target.value)}
                  className="bg-brand-bg border border-white/10 text-slate-300 text-[10px] font-black font-mono rounded-none px-1.5 focus:outline-none uppercase"
                >
                  <option value="general">General</option>
                  <option value="weather">Weather</option>
                  <option value="hazard">Hazard</option>
                </select>
                <button
                  type="submit"
                  className="flex-1 bg-brand-bg hover:bg-white/10 text-white border border-white/10 text-[11px] font-black py-1.5 rounded-none cursor-pointer focus:outline-none flex items-center justify-center gap-1.5 uppercase tracking-wider"
                >
                  <Send className="w-3 h-3 text-brand-red" /> Broadcast
                </button>
              </div>
            </form>

          </div>
        </div>

        {/* Geofence Registry */}
        <div className="bg-brand-panel rounded-none border border-white/10 overflow-hidden shadow-lg border-t-4 border-emerald-500">
          <div className="bg-brand-bg px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-emerald-500" />
            <h2 className="text-xs uppercase tracking-[0.2em] font-black font-display text-white/90">Geofence Registry</h2>
          </div>
          <div className="p-3 divide-y divide-white/5 max-h-[180px] overflow-y-auto">
            {geofences.map((fence) => {
              const isCrit = fence.severity === "critical";
              return (
                <div key={fence.id} className="py-2.5 first:pt-1 last:pb-1 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-white text-xs font-display uppercase tracking-wide">{fence.name}</span>
                    <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded-none border uppercase ${
                      isCrit 
                        ? "text-brand-red bg-brand-red/10 border-brand-red/20 animate-pulse" 
                        : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    }`}>
                      {fence.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 leading-relaxed font-sans">{fence.description}</p>
                  <div className="text-[9px] text-white/30 font-mono mt-0.5 font-bold">
                    Center: [{fence.coordinates[0].toFixed(4)}, {fence.coordinates[1].toFixed(4)}] | Radius: {fence.radius}m
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
