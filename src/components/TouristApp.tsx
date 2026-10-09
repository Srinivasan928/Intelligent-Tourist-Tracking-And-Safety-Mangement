import { useState, useEffect, useRef } from "react";
import { Tourist, Geofence, ChatMessage } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Signal, Battery, ShieldAlert, Heart, Activity as ActivityIcon, 
  Send, Compass, Navigation, Flame, User, AlertOctagon, AlertTriangle, HelpCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CheckCircle2,
  MapPin, Mountain, Clock, Timer
} from "lucide-react";
import TouristBatteryLineChart from "./TouristBatteryLineChart";
import TouristMapWidget from "./TouristMapWidget";

interface TouristAppProps {
  tourists: Tourist[];
  geofences: Geofence[];
  selectedTouristId: string;
  onSelectTourist: (id: string) => void;
  onUpdateTourist: (tourist: Tourist) => void;
  onTriggerSOS: (id: string, isSOS: boolean) => void;
}

const TAB_ORDER = ["satphone", "topomap", "aichat", "manual"] as const;
type TabType = (typeof TAB_ORDER)[number];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
  }),
};

export default function TouristApp({
  tourists,
  geofences,
  selectedTouristId,
  onSelectTourist,
  onUpdateTourist,
  onTriggerSOS,
}: TouristAppProps) {
  const safeTourists = Array.isArray(tourists) ? tourists : [];
  const safeGeofences = Array.isArray(geofences) ? geofences : [];
  const currentTourist = safeTourists.find((t) => t && t.id === selectedTouristId) || safeTourists[0];

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({
    t1: [
      { sender: "bot", text: "Welcome to Dhimbam Forest Range, Selvan. I am your TourGuard AI satellite helper. You are currently tracking near the Dhimbam Ghat 27th Hairpin Bend viewpoint. State is nominal. Ask me anything.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ],
    t2: [
      { sender: "bot", text: "Moorthy, I notice your heart rate is elevated (118 bpm) and altitude is 980m near the Hasanur forest trail. Ensure you take hydration rests in shaded tree cover.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ],
    t3: [
      { sender: "bot", text: "Hello Ns Kumar. Tracking is fully synchronized at Bannari Forest Checkpost. Wildlife advisory: Wild elephant crossings reported along the upper ghat corridor. Advise adhering to marked route.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ],
    t4: [
      { sender: "bot", text: "Muthu kumar, please stay in one place. Do not wander deeper into the Talamalai ravine scrub. Your battery is at 12%. Hold the red SOS button for immediate forest rapid response team dispatch.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ],
  });

  const [activeTab, setActiveTab] = useState<TabType>("satphone");
  const [tabDirection, setTabDirection] = useState<number>(1);

  const handleTabChange = (newTab: TabType) => {
    if (newTab === activeTab) return;
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const newIndex = TAB_ORDER.indexOf(newTab);
    setTabDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  const [isChatLoading, setIsChatLoading] = useState(false);
  const [geofenceWarning, setGeofenceWarning] = useState<Geofence | null>(null);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);
  const zoneEntryTimesRef = useRef<Record<string, { fenceId: string; entryTimestamp: number }>>({});

  // Format time spent in zone as MM:SS (or HH:MM:SS)
  const formatTimeSpent = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, activeTab, selectedTouristId]);

  // Check geofence breaches on local coordinates change
  useEffect(() => {
    if (!currentTourist || !currentTourist.coordinates || !Array.isArray(currentTourist.coordinates) || currentTourist.coordinates.length < 2) return;
    
    // Check if tourist coordinates are inside any geofence
    let activeBreach: Geofence | null = null;
    for (const fence of safeGeofences) {
      if (!fence || !fence.coordinates || !Array.isArray(fence.coordinates) || fence.coordinates.length < 2) continue;
      const dist = getDistanceMeters(
        currentTourist.coordinates[0],
        currentTourist.coordinates[1],
        fence.coordinates[0],
        fence.coordinates[1]
      );
      if (dist <= fence.radius) {
        activeBreach = fence;
        break;
      }
    }
    setGeofenceWarning(activeBreach);
  }, [currentTourist?.coordinates?.[0], currentTourist?.coordinates?.[1], safeGeofences]);

  // Track Time Spent in Zone with real-time ticker
  useEffect(() => {
    if (!geofenceWarning || !currentTourist) {
      if (currentTourist?.id && zoneEntryTimesRef.current[currentTourist.id]) {
        delete zoneEntryTimesRef.current[currentTourist.id];
      }
      setTimeSpentSeconds(0);
      return;
    }

    const touristId = currentTourist.id;
    const fenceId = geofenceWarning.id;

    // Initialize or re-evaluate zone entry timestamp
    if (!zoneEntryTimesRef.current[touristId] || zoneEntryTimesRef.current[touristId].fenceId !== fenceId) {
      zoneEntryTimesRef.current[touristId] = {
        fenceId,
        entryTimestamp: Date.now(),
      };
    }

    const updateCounter = () => {
      const record = zoneEntryTimesRef.current[touristId];
      if (record && record.fenceId === fenceId) {
        const elapsed = Math.floor((Date.now() - record.entryTimestamp) / 1000);
        setTimeSpentSeconds(Math.max(0, elapsed));
      }
    };

    updateCounter();
    const timer = setInterval(updateCounter, 1000);
    return () => clearInterval(timer);
  }, [geofenceWarning?.id, currentTourist?.id]);

  // Low battery threshold (< 15%) state for visual warning pulse & haptic vibration alert
  const isLowBattery = Boolean(
    currentTourist && typeof currentTourist.battery === "number" && currentTourist.battery < 15
  );
  const [hapticAlertEnabled, setHapticAlertEnabled] = useState(true);
  const [isVibrating, setIsVibrating] = useState(false);
  const vibrationTimerRef = useRef<any>(null);

  // Trigger tactile vibration alert (hardware navigator.vibrate + synthetic acoustic haptic motor rumble + chassis shake)
  const triggerHapticVibration = (durationMs = 650) => {
    setIsVibrating(true);

    // 1. Hardware vibration API if supported (mobile devices / Android)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([180, 80, 180, 80, 220]);
      } catch {
        // Safe fallback
      }
    }

    // 2. Synthetic acoustic haptic rumble for tactile feedback on desktop / laptop
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // 56Hz low rumble hum
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(56, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + durationMs / 1000);

        // Rapid tremolo modulating motor speed
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(24, ctx.currentTime);
        lfoGain.gain.setValueAtTime(0.04, ctx.currentTime);
        lfo.connect(gain.gain);
        lfo.start();

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
        lfo.stop(ctx.currentTime + durationMs / 1000);

        setTimeout(() => {
          try {
            ctx.close();
          } catch {}
        }, durationMs + 200);
      }
    } catch {
      // Audio fallback
    }

    if (vibrationTimerRef.current) {
      clearTimeout(vibrationTimerRef.current);
    }
    vibrationTimerRef.current = setTimeout(() => {
      setIsVibrating(false);
    }, durationMs);
  };

  // Periodic haptic vibration alert loop when battery is critically low (< 15%)
  useEffect(() => {
    if (!isLowBattery || !hapticAlertEnabled) {
      setIsVibrating(false);
      return;
    }

    // Trigger immediate haptic buzz on battery dropping below 15%
    triggerHapticVibration(700);

    // Repeat haptic vibration burst every 3.5 seconds
    const interval = setInterval(() => {
      triggerHapticVibration(650);
    }, 3500);

    return () => {
      clearInterval(interval);
      if (vibrationTimerRef.current) clearTimeout(vibrationTimerRef.current);
    };
  }, [isLowBattery, hapticAlertEnabled, currentTourist?.id]);

  if (!currentTourist) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-brand-panel border border-white/10 text-white/40 font-mono text-xs">
        Connecting to satellite beacon...
      </div>
    );
  }

  // Haversine formula
  function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
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

  // Handle Walking (D-Pad Simulator)
  const handleWalk = (direction: "N" | "S" | "E" | "W") => {
    if (!currentTourist) return;
    const stepLat = 0.0012;
    const stepLng = 0.0015;
    const rawCoords = currentTourist.coordinates;
    let lat = Array.isArray(rawCoords) && typeof rawCoords[0] === "number" ? rawCoords[0] : 37.7275;
    let lng = Array.isArray(rawCoords) && typeof rawCoords[1] === "number" ? rawCoords[1] : -119.5442;
    let newAlt = currentTourist.altitude || 1200;
    let newHR = currentTourist.heartRate || 75;

    switch (direction) {
      case "N":
        lat += stepLat;
        newAlt += Math.floor(Math.random() * 30) - 5; // Gain/loss alt
        break;
      case "S":
        lat -= stepLat;
        newAlt -= Math.floor(Math.random() * 30) - 5;
        break;
      case "E":
        lng += stepLng;
        newAlt += Math.floor(Math.random() * 20) - 10;
        break;
      case "W":
        lng -= stepLng;
        newAlt -= Math.floor(Math.random() * 20) - 10;
        break;
    }

    // Walking increases heart rate slightly
    newHR = Math.min(150, Math.max(70, newHR + Math.floor(Math.random() * 12) - 4));
    
    // Slow battery drain
    const newBattery = Math.max(1, currentTourist.battery - (Math.random() > 0.6 ? 1 : 0));

    let updatedHistory = currentTourist.batteryHistory;
    if (newBattery !== currentTourist.battery && Array.isArray(updatedHistory) && updatedHistory.length > 0) {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const lastPt = updatedHistory[updatedHistory.length - 1];
      const drain = Math.max(0, lastPt.battery - newBattery);
      const newPt = {
        index: lastPt.index + 1,
        label: "Now",
        time: nowStr,
        battery: newBattery,
        voltage: Number((3.3 + (newBattery / 100) * 0.88).toFixed(2)),
        drainDelta: drain,
        isCriticalDrop: drain > 5,
      };
      const sliced = [...updatedHistory.slice(-9), newPt];
      updatedHistory = sliced.map((pt, idx, arr) => ({
        ...pt,
        label: idx === arr.length - 1 ? "Now" : `U-${arr.length - 1 - idx}`,
      }));
    }

    const updatedTourist: Tourist = {
      ...currentTourist,
      coordinates: [lat, lng],
      altitude: Math.max(1200, newAlt),
      heartRate: newHR,
      battery: newBattery,
      batteryHistory: updatedHistory,
      lastUpdate: new Date().toISOString(),
    };

    onUpdateTourist(updatedTourist);
  };

  // Modify tourist status from manual sliders
  const handleMetricChange = (field: keyof Tourist, value: any) => {
    let updatedHistory = currentTourist.batteryHistory;
    if (field === "battery" && Array.isArray(updatedHistory) && updatedHistory.length > 0) {
      const numVal = Number(value);
      const lastPt = updatedHistory[updatedHistory.length - 1];
      const drain = Math.max(0, lastPt.battery - numVal);
      const newPt = {
        index: lastPt.index + 1,
        label: "Now",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        battery: numVal,
        voltage: Number((3.3 + (numVal / 100) * 0.88).toFixed(2)),
        drainDelta: drain,
        isCriticalDrop: drain > 5,
      };
      const sliced = [...updatedHistory.slice(-9), newPt];
      updatedHistory = sliced.map((pt, idx, arr) => ({
        ...pt,
        label: idx === arr.length - 1 ? "Now" : `U-${arr.length - 1 - idx}`,
      }));
    }

    onUpdateTourist({
      ...currentTourist,
      [field]: value,
      batteryHistory: updatedHistory,
      lastUpdate: new Date().toISOString(),
    });
  };

  // Chat Submit
  const handleSendChat = async (textToSend?: string) => {
    const messageText = textToSend || chatInput;
    if (!messageText.trim() || isChatLoading) return;

    if (!textToSend) {
      setChatInput("");
    }

    const userMsg: ChatMessage = {
      sender: "user",
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update state locally
    const currentHistory = chatHistory[currentTourist.id] || [];
    const updatedHistory = [...currentHistory, userMsg];
    
    setChatHistory({
      ...chatHistory,
      [currentTourist.id]: updatedHistory,
    });

    setIsChatLoading(true);

    try {
      const response = await fetch("/api/tourist/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedHistory,
          touristId: currentTourist.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const botMsg: ChatMessage = {
          sender: "bot",
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatHistory((prev) => ({
          ...prev,
          [currentTourist.id]: [...updatedHistory, botMsg],
        }));
      } else {
        throw new Error("Chat connection failed.");
      }
    } catch (err) {
      const botError: ChatMessage = {
        sender: "bot",
        text: "⚠️ [SATELLITE COMM TIMEOUT] Signal strength fluctuating, please retry or hold SOS button if stranded.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => ({
        ...prev,
        [currentTourist.id]: [...updatedHistory, botError],
      }));
    } finally {
      setIsChatLoading(false);
    }
  };

  const currentChats = chatHistory[currentTourist.id] || [];

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* Device Toggle Selector */}
      <div className="w-full mb-4 bg-brand-panel border border-white/10 p-3.5 rounded-none flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-black font-display text-white/90 uppercase tracking-wider">Simulate Back-country Tourist:</span>
        </div>
        <select
          value={currentTourist.id}
          onChange={(e) => onSelectTourist(e.target.value)}
          className="w-full sm:w-auto bg-black border border-white/10 text-white text-xs rounded-none px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-mono font-bold uppercase"
        >
          {tourists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.status === "danger" ? "🚨 SOS DISTRESS" : t.status === "warning" ? "⚠️ WARNING" : "🟢 NOMINAL"})
            </option>
          ))}
        </select>
      </div>

      {/* Handset Outer Wrapper with Haptic Vibration Wave Arcs and Chassis */}
      <div className="relative flex items-center justify-center w-full">
        {/* Left Haptic Vibration Wave Arcs (When Vibrating) */}
        {isLowBattery && isVibrating && hapticAlertEnabled && (
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-30">
            <span className="haptic-wave-left text-brand-red font-mono font-black text-sm select-none">
              ((((
            </span>
            <span className="haptic-wave-left text-amber-500 font-mono font-black text-xs select-none">
              (((
            </span>
            <span className="haptic-wave-left text-brand-red font-mono font-black text-sm select-none">
              ((((
            </span>
          </div>
        )}

        {/* Right Haptic Vibration Wave Arcs (When Vibrating) */}
        {isLowBattery && isVibrating && hapticAlertEnabled && (
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-30">
            <span className="haptic-wave-right text-brand-red font-mono font-black text-sm select-none">
              ))))
            </span>
            <span className="haptic-wave-right text-amber-500 font-mono font-black text-xs select-none">
              )))
            </span>
            <span className="haptic-wave-right text-brand-red font-mono font-black text-sm select-none">
              ))))
            </span>
          </div>
        )}

        {/* Rugged Phone Chassis with Haptic Vibration Alert Animation & Visual Warning Pulse */}
        <div
          className={`relative w-full max-w-[340px] bg-brand-bg rounded-none shadow-2xl overflow-hidden aspect-[9/19] flex flex-col transition-all duration-300 ${
            isLowBattery
              ? `border-[8px] border-brand-red/90 battery-warning-pulse-chassis ring-4 ring-brand-red/80 ${
                  isVibrating && hapticAlertEnabled ? "haptic-vibrate-buzz" : ""
                }`
              : "border-[8px] border-[#222224] ring-4 ring-black"
          }`}
        >
          {/* Visual Warning Pulse: Full-Screen Perimeter Vignette Overlay when Battery < 15% */}
          {isLowBattery && (
            <div className="battery-warning-vignette absolute inset-0 z-30 pointer-events-none" />
          )}

          {/* Physical Top Antenna (Flat Military Style) */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-2 bg-[#222224] z-30"></div>

          {/* Device Status Header */}
          <div
            className={`px-4 pt-3.5 pb-2 text-[10px] font-mono flex justify-between items-center border-b z-20 transition-colors ${
              isLowBattery ? "bg-red-950/90 border-brand-red/40 text-red-200" : "bg-black border-white/10 text-white/40"
            }`}
          >
            <div className="flex items-center gap-1">
              <Signal
                className={`w-3.5 h-3.5 ${isLowBattery ? "text-amber-400 animate-pulse" : "text-emerald-500"}`}
              />
              <span
                className={`font-black uppercase tracking-wider text-[9px] ${
                  isLowBattery ? "text-amber-400" : "text-emerald-500"
                }`}
              >
                {isLowBattery ? "LOW PWR LINK" : "SATELLITE LINKED"}
              </span>
            </div>
            <div className="text-[10px] text-white/60 font-bold">
              {Array.isArray(currentTourist?.coordinates) && currentTourist.coordinates.length >= 2
                ? `${currentTourist.coordinates[0].toFixed(3)}, ${currentTourist.coordinates[1].toFixed(3)}`
                : "Acquiring GPS..."}
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              <Battery
                className={`w-4 h-4 ${
                  isLowBattery
                    ? "text-brand-red animate-pulse drop-shadow-[0_0_8px_#ef4444]"
                    : currentTourist.battery < 20
                    ? "text-brand-red animate-pulse"
                    : "text-white/40"
                }`}
              />
              <span
                className={
                  isLowBattery
                    ? "text-brand-red font-black animate-pulse"
                    : currentTourist.battery < 20
                    ? "text-brand-red font-black"
                    : "text-white/60"
                }
              >
                {currentTourist.battery}%
              </span>
              {isLowBattery && (
                <span className="text-[7px] font-black uppercase tracking-widest bg-brand-red text-white px-1 py-0.5 rounded-none animate-pulse">
                  &lt;15%
                </span>
              )}
            </div>
          </div>

          {/* Critical Low Battery Visual Warning Pulse & Haptic Alert Banner */}
          <AnimatePresence>
            {isLowBattery && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-red-950/95 border-b-2 border-brand-red text-white py-2 px-3 z-20 flex flex-col gap-1.5 shadow-[0_4px_20px_rgba(220,38,38,0.4)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-90"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-red"></span>
                    </span>
                    <AlertOctagon className="w-3.5 h-3.5 text-brand-red animate-bounce shrink-0" />
                    <span className="text-[10px] font-black tracking-wider uppercase font-mono text-red-200">
                      BATTERY CRITICAL: {currentTourist.battery}% (&lt; 15%)
                    </span>
                  </div>
                  <span
                    className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                      isVibrating && hapticAlertEnabled
                        ? "bg-brand-red text-white border-white animate-pulse"
                        : "bg-black/60 text-red-300 border-red-500/30"
                    }`}
                  >
                    {isVibrating && hapticAlertEnabled ? "📳 BUZZING" : "HAPTIC ARMED"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-white/80">
                  <span className="text-[8px] text-red-200/90 font-bold uppercase tracking-wide">
                    Emergency power-saving engaged.
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => triggerHapticVibration(850)}
                      className="bg-brand-red hover:bg-red-600 text-white font-mono font-bold text-[8px] uppercase px-1.5 py-0.5 border border-white/20 cursor-pointer active:scale-95"
                      title="Test Haptic Vibration Buzz"
                    >
                      Test Buzz
                    </button>
                    <button
                      type="button"
                      onClick={() => setHapticAlertEnabled(!hapticAlertEnabled)}
                      className={`font-mono font-bold text-[8px] uppercase px-1.5 py-0.5 border cursor-pointer active:scale-95 ${
                        hapticAlertEnabled
                          ? "bg-black/60 text-emerald-400 border-emerald-500/40"
                          : "bg-black/80 text-white/40 border-white/20"
                      }`}
                    >
                      {hapticAlertEnabled ? "Vibe ON" : "Vibe OFF"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        {/* Flashing Hazard Klaxon Banner */}
        <AnimatePresence>
          {geofenceWarning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`text-center py-2 px-3 flex flex-col items-center justify-center border-b rounded-none ${
                geofenceWarning.severity === "critical"
                  ? "bg-brand-red/10 border-brand-red/30 text-brand-red"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 animate-bounce shrink-0" />
                <span className="text-[10px] font-black tracking-widest uppercase font-mono">
                  {geofenceWarning.severity === "critical" ? "GEOFENCE BREACH ALERT" : "HAZARD BOUNDARY ENCOUNTERED"}
                </span>
              </div>
              <p className="text-[10px] font-mono font-bold leading-snug mt-0.5 uppercase tracking-wide">
                Inside "{geofenceWarning.name}".
              </p>

              {/* Time Spent in Zone Counter */}
              <div
                id="geofence-time-spent-counter"
                className={`mt-1.5 flex items-center gap-1.5 px-2.5 py-0.5 border font-mono text-[9px] rounded-none ${
                  geofenceWarning.severity === "critical"
                    ? "bg-black/70 border-brand-red/40 text-brand-red"
                    : "bg-black/70 border-amber-500/40 text-amber-400"
                }`}
              >
                <Clock className="w-3 h-3 text-current animate-pulse shrink-0" />
                <span className="font-bold tracking-wider uppercase text-white/80">Time Spent in Zone:</span>
                <span className="font-black font-mono tracking-widest text-white ml-0.5">
                  {formatTimeSpent(timeSpentSeconds)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Device Application Container with Smooth Horizontal Slide Handset Transition */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-brand-panel flex flex-col relative">
          <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
            <motion.div
              key={activeTab}
              custom={tabDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 320, damping: 32 },
                opacity: { duration: 0.15 },
              }}
              className="flex-1 p-3.5 flex flex-col min-h-full"
            >
              {/* Main App Page according to active tab */}
              {activeTab === "satphone" && (
                <div className="flex-1 flex flex-col justify-between">
              
              {/* Dashboard Content */}
              <div>
                <div className="text-center mb-3 border-b border-white/5 pb-2.5">
                  <h3 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] font-mono">Satellite Tracker</h3>
                  <h2 className="text-sm font-black text-white font-display mt-1 uppercase tracking-wide">{currentTourist.name}</h2>
                </div>

                {/* Google Maps Street & Country Identification */}
                <div className="bg-brand-bg/80 p-2.5 rounded-none border border-white/10 mb-3.5">
                  <div className="flex items-center justify-between text-[8px] font-black uppercase font-mono text-white/40 tracking-wider mb-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-sky-400" />
                      Google Maps Street
                    </span>
                    <span className="text-emerald-400 font-bold">{currentTourist.country || "United States"}</span>
                  </div>
                  <div className="text-xs font-bold text-white font-mono leading-tight">
                    {currentTourist.street || "Mist Trail (Happy Isles Loop Rd)"}
                  </div>
                  <div className="text-[10px] text-white/50 font-mono mt-0.5">
                    {currentTourist.locality || "Yosemite Valley, CA"} • Country: <strong className="text-white">{currentTourist.country || "United States"}</strong>
                  </div>
                </div>

                {/* Tactical Terrain Map Widget with Zoom Control Overlay */}
                <div className="mb-3.5">
                  <TouristMapWidget
                    tourist={currentTourist}
                    geofences={safeGeofences}
                    heightClass="h-44"
                    onToggleExpand={() => handleTabChange("topomap")}
                    showDetails={true}
                    onUpdateTourist={onUpdateTourist}
                  />
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="bg-brand-bg p-3 rounded-none border border-white/10 flex flex-col justify-between">
                    <span className="text-[8px] font-black uppercase font-mono text-white/40 tracking-wider">Heart Rate</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Heart className={`w-4 h-4 text-brand-red ${currentTourist.heartRate > 110 ? "animate-pulse" : ""}`} />
                      <span className="text-xs font-black font-mono text-white">{currentTourist.heartRate} <span className="text-[8px] text-white/40">bpm</span></span>
                    </div>
                  </div>
                  <div className="bg-brand-bg p-3 rounded-none border border-white/10 flex flex-col justify-between">
                    <span className="text-[8px] font-black uppercase font-mono text-white/40 tracking-wider">Altitude</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Compass className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-black font-mono text-white">{currentTourist.altitude} <span className="text-[8px] text-white/40">m</span></span>
                    </div>
                  </div>
                  <div className="bg-brand-bg p-3 rounded-none border border-white/10 flex flex-col justify-between">
                    <span className="text-[8px] font-black uppercase font-mono text-white/40 tracking-wider">Body Temp</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-black font-mono text-white">{currentTourist.temperature.toFixed(1)} <span className="text-[8px] text-white/40">°C</span></span>
                    </div>
                  </div>
                  <div className="bg-brand-bg p-3 rounded-none border border-white/10 flex flex-col justify-between">
                    <span className="text-[8px] font-black uppercase font-mono text-white/40 tracking-wider">Activity</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <ActivityIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-black uppercase text-emerald-400 font-mono tracking-wider">{currentTourist.activity}</span>
                    </div>
                  </div>
                </div>

                {/* Critical Low Battery (< 15%) Visual Warning Pulse Callout */}
                {isLowBattery && (
                  <div className="mb-3.5 bg-red-950/80 border-2 border-brand-red p-3 rounded-none text-white font-mono shadow-[0_0_20px_rgba(239,68,68,0.35)] animate-pulse">
                    <div className="flex items-center justify-between border-b border-brand-red/40 pb-1.5 mb-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-brand-red shrink-0" />
                        <span className="text-[10px] font-black uppercase text-red-200 tracking-wider">
                          CRITICAL POWER RESERVE (&lt; 15%)
                        </span>
                      </div>
                      <span className="text-xs font-black text-brand-red bg-black/60 px-2 py-0.5 border border-brand-red/50">
                        {currentTourist.battery}% SOC
                      </span>
                    </div>
                    <p className="text-[9px] text-white/80 leading-relaxed uppercase">
                      Handset battery dropped below safe reserve threshold. Visual warning pulse &amp; haptic vibration alert engaged.
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-brand-red/30 flex items-center justify-between text-[8px]">
                      <span className="text-red-300 font-bold uppercase">
                        Haptic status: {hapticAlertEnabled ? (isVibrating ? "📳 RUMBLING" : "ARMED") : "MUTED"}
                      </span>
                      <button
                        type="button"
                        onClick={() => triggerHapticVibration(900)}
                        className="bg-brand-red hover:bg-red-500 text-white px-2 py-1 font-black uppercase tracking-wider text-[8px] cursor-pointer active:scale-95 border border-white/20"
                      >
                        Trigger Buzz ⚡
                      </button>
                    </div>
                  </div>
                )}

                {/* Historical Battery Consumption Line Chart (Last 10 Updates) */}
                <div className="mb-4">
                  <TouristBatteryLineChart tourist={currentTourist} />
                </div>

                {/* Trail Walker Controller D-Pad */}
                <div className="bg-brand-bg border border-white/10 p-3.5 rounded-none mb-4 text-center">
                  <span className="text-[9px] font-black uppercase text-white/40 tracking-wider font-mono">Simulate Trail Navigation</span>
                  
                  <div className="flex flex-col items-center mt-3.5 gap-1.5">
                    <button
                      onClick={() => handleWalk("N")}
                      className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-10 h-8 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                    >
                      <ArrowUp className="w-4 h-4 text-brand-red" />
                    </button>
                    
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleWalk("W")}
                        className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-10 h-8 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                      >
                        <ArrowLeft className="w-4 h-4 text-brand-red" />
                      </button>
                      <div className="w-8 h-8 rounded-none border border-white/10 bg-black flex items-center justify-center">
                        <Navigation className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <button
                        onClick={() => handleWalk("E")}
                        className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-10 h-8 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                      >
                        <ArrowRight className="w-4 h-4 text-brand-red" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleWalk("S")}
                      className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-10 h-8 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                    >
                      <ArrowDown className="w-4 h-4 text-brand-red" />
                    </button>
                  </div>
                  <p className="text-[9px] text-white/40 mt-3 font-mono font-bold uppercase tracking-wider">Use D-Pad controls to traverse Yosemite.</p>
                </div>
              </div>

              {/* Big Red SOS Button */}
              <div className="mt-2 text-center">
                {currentTourist.status === "danger" ? (
                  <button
                    onClick={() => onTriggerSOS(currentTourist.id, false)}
                    className="w-full bg-brand-panel hover:bg-white/10 border border-brand-red/40 text-brand-red py-3 rounded-none flex items-center justify-center gap-2 font-display font-black text-xs uppercase tracking-widest cursor-pointer active:scale-98 transition-transform"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Cancel SOS Alert
                  </button>
                ) : (
                  <button
                    onClick={() => onTriggerSOS(currentTourist.id, true)}
                    className="w-full bg-brand-red hover:bg-red-500 hover:shadow-brand-red/10 shadow-lg text-white py-4 rounded-none flex flex-col items-center justify-center gap-0.5 font-display font-black text-xs uppercase tracking-widest cursor-pointer active:scale-98 transition-transform animate-pulse border border-brand-red/30"
                  >
                    <span>⚠️ EMERGENCY SOS ⚠️</span>
                    <span className="text-[9px] opacity-80 font-mono tracking-wider font-bold">TRANSMIT DISTRESS SIG</span>
                  </button>
                )}
              </div>

            </div>
          )}

          {activeTab === "topomap" && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                {/* Header with location and GPS state */}
                <div className="text-center mb-2.5 border-b border-white/5 pb-2">
                  <h3 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] font-mono">
                    Terrain & Topo Navigator
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <MapPin className="w-3 h-3 text-sky-400" />
                    <span className="text-xs font-black text-white font-mono uppercase truncate max-w-[240px]">
                      {currentTourist.street || "Mist Trail Ravine"}
                    </span>
                  </div>
                  <div className="text-[8px] text-white/40 font-mono mt-0.5">
                    {currentTourist.locality || "Yosemite Valley, CA"} • {currentTourist.country || "United States"}
                  </div>
                </div>

                {/* Expanded Tactical Map Widget with Zoom Control Overlay */}
                <div className="mb-3">
                  <TouristMapWidget
                    tourist={currentTourist}
                    geofences={safeGeofences}
                    heightClass="h-64"
                    isExpanded={true}
                    onToggleExpand={() => handleTabChange("satphone")}
                    showDetails={true}
                    onUpdateTourist={onUpdateTourist}
                  />
                </div>

                {/* Live Trail Walker D-Pad Controls for real-time map panning */}
                <div className="bg-brand-bg border border-white/10 p-2.5 rounded-none mb-3 text-center">
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <span className="text-[8px] font-black uppercase text-white/40 tracking-wider font-mono">
                      Contour Trail Walker
                    </span>
                    <span className="text-[8px] font-bold text-sky-400 font-mono">
                      Alt: {currentTourist.altitude}m
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleWalk("N")}
                      title="Walk North (Ascend/Descend)"
                      className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-9 h-7 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-brand-red" />
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleWalk("W")}
                        title="Walk West"
                        className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-9 h-7 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-brand-red" />
                      </button>
                      <div className="w-7 h-7 rounded-none border border-white/10 bg-black flex items-center justify-center">
                        <Navigation className="w-3 h-3 text-sky-400" />
                      </div>
                      <button
                        onClick={() => handleWalk("E")}
                        title="Walk East"
                        className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-9 h-7 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-brand-red" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleWalk("S")}
                      title="Walk South"
                      className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 w-9 h-7 rounded-none flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer font-black"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-brand-red" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom SOS Quick trigger */}
              <div className="mt-1 text-center">
                {currentTourist.status === "danger" ? (
                  <button
                    onClick={() => onTriggerSOS(currentTourist.id, false)}
                    className="w-full bg-brand-panel hover:bg-white/10 border border-brand-red/40 text-brand-red py-2 rounded-none flex items-center justify-center gap-1.5 font-display font-black text-[10px] uppercase tracking-widest cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Cancel Distress SOS
                  </button>
                ) : (
                  <button
                    onClick={() => onTriggerSOS(currentTourist.id, true)}
                    className="w-full bg-brand-red/90 hover:bg-brand-red text-white py-2.5 rounded-none flex items-center justify-center gap-1.5 font-display font-black text-[10px] uppercase tracking-widest cursor-pointer border border-brand-red/30"
                  >
                    <AlertOctagon className="w-3.5 h-3.5 text-white" />
                    Emergency SOS Distress
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "aichat" && (
            <div className="flex-1 flex flex-col justify-between">
              
              {/* Satellite chat feed */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="text-center mb-2.5 border-b border-white/5 pb-2">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.15em] font-mono">AI SAT-COMM LINK</h3>
                </div>

                {/* Message list */}
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0 text-white max-h-[220px]">
                  {currentChats.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col max-w-[85%] ${
                        msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                      }`}
                    >
                      <div
                        className={`rounded-none p-2 text-[11px] leading-relaxed font-mono font-bold ${
                          msg.sender === "user"
                            ? "bg-sky-600/90 text-white border border-sky-500/20"
                            : "bg-black text-white/90 border border-white/10"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-white/30 font-mono mt-1 px-1 font-bold">{msg.timestamp}</span>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="self-start bg-black border border-white/10 p-2.5 rounded-none flex items-center gap-2 max-w-[80%]">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-sky-400 rounded-none animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-sky-400 rounded-none animate-bounce delay-100"></div>
                        <div className="w-1.5 h-1.5 bg-sky-400 rounded-none animate-bounce delay-200"></div>
                      </div>
                      <span className="text-[9px] text-white/30 font-mono font-bold uppercase tracking-wider">Pinging SAT-AI...</span>
                    </div>
                  )}
                  <div ref={chatEndRef}></div>
                </div>

                {/* Pre-canned emergency FAQs */}
                <div className="mt-3 pt-2.5 border-t border-white/5 font-mono">
                  <span className="text-[9px] font-black uppercase text-white/40 tracking-wider">Quick Satellite Queries:</span>
                  <div className="flex flex-col gap-1 mt-1.5">
                    <button
                      onClick={() => handleSendChat("I see a wild black bear. What do I do?")}
                      className="text-[9px] bg-black hover:bg-white/10 border border-white/10 text-white/80 rounded-none px-2.5 py-1.5 cursor-pointer text-left font-bold uppercase tracking-wider"
                    >
                      🐻 Bear Encounter
                    </button>
                    <button
                      onClick={() => handleSendChat("Getting dark, very cold, and I am lost. Help.")}
                      className="text-[9px] bg-black hover:bg-white/10 border border-white/10 text-white/80 rounded-none px-2.5 py-1.5 cursor-pointer text-left font-bold uppercase tracking-wider"
                    >
                      🧭 Lost & Cold
                    </button>
                    <button
                      onClick={() => handleSendChat("Thunderstorm starts and lightning on granite peaks. Safety?")}
                      className="text-[9px] bg-black hover:bg-white/10 border border-white/10 text-white/80 rounded-none px-2.5 py-1.5 cursor-pointer text-left font-bold uppercase tracking-wider"
                    >
                      ⚡ Lightning Drill
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="mt-3 flex gap-1.5 items-center bg-black p-1 rounded-none border border-white/10">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Ask satellite guide..."
                  className="flex-1 bg-transparent text-[11px] font-mono font-bold px-2 py-1.5 text-slate-100 placeholder-white/20 focus:outline-none"
                />
                <button
                  onClick={() => handleSendChat()}
                  className="bg-sky-600 hover:bg-sky-500 text-white rounded-none p-1.5 cursor-pointer flex items-center justify-center focus:outline-none"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

          {activeTab === "manual" && (
            <div className="flex-1 flex flex-col justify-between font-mono">
              <div>
                <div className="text-center mb-3 border-b border-white/5 pb-2">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Vitals Simulator</h3>
                </div>

                {/* Adjust metrics */}
                <div className="flex flex-col gap-3.5">
                  
                  {/* Battery Slider */}
                  <div
                    className={`flex flex-col gap-1.5 p-2.5 rounded-none border transition-colors ${
                      isLowBattery
                        ? "bg-red-950/70 border-brand-red shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
                        : "bg-black/30 border-white/10"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                      <span className={isLowBattery ? "text-brand-red flex items-center gap-1 font-black" : "text-white/40"}>
                        {isLowBattery && (
                          <span className="inline-block w-1.5 h-1.5 bg-brand-red rounded-full animate-ping" />
                        )}
                        ⚡ BATTERY LEVEL:
                      </span>
                      <span className={isLowBattery ? "text-brand-red font-black" : "text-white font-bold"}>
                        {currentTourist.battery}% {isLowBattery ? "⚠️ CRITICAL (< 15%)" : ""}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={currentTourist.battery}
                      onChange={(e) => handleMetricChange("battery", parseInt(e.target.value))}
                      className={`w-full h-1 bg-white/10 rounded-none cursor-pointer ${
                        isLowBattery ? "accent-red-500" : "accent-sky-500"
                      }`}
                    />
                    {isLowBattery && (
                      <div className="text-[8px] text-red-300 font-mono font-bold uppercase tracking-wider mt-1 flex justify-between items-center border-t border-brand-red/30 pt-1">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-ping" />
                          Haptic vibration alert active
                        </span>
                        <button
                          type="button"
                          onClick={() => triggerHapticVibration(800)}
                          className="bg-brand-red hover:bg-red-600 text-white px-2 py-0.5 text-[8px] uppercase font-black cursor-pointer border border-white/20 active:scale-95"
                        >
                          Buzz Now 📳
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Heart Rate Slider */}
                  <div className="flex flex-col gap-1.5 bg-black/30 p-2.5 rounded-none border border-white/10">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                      <span className="text-white/40">💓 HEART EXERTION:</span>
                      <span className="text-white font-bold">{currentTourist.heartRate} BPM</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="170"
                      value={currentTourist.heartRate}
                      onChange={(e) => handleMetricChange("heartRate", parseInt(e.target.value))}
                      className="w-full accent-brand-red h-1 bg-white/10 rounded-none cursor-pointer"
                    />
                  </div>

                  {/* Body Temp Slider */}
                  <div className="flex flex-col gap-1.5 bg-black/30 p-2.5 rounded-none border border-white/10">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                      <span className="text-white/40">🌡️ THERMAL INDEX:</span>
                      <span className="text-white font-bold">{currentTourist.temperature.toFixed(1)} °C</span>
                    </div>
                    <input
                      type="range"
                      min="340"
                      max="400"
                      value={currentTourist.temperature * 10}
                      onChange={(e) => handleMetricChange("temperature", parseInt(e.target.value) / 10)}
                      className="w-full accent-orange-500 h-1 bg-white/10 rounded-none cursor-pointer"
                    />
                  </div>

                  {/* Activity Selector */}
                  <div className="flex flex-col gap-1 bg-black/30 p-2.5 rounded-none border border-white/10">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-wider">ACTIVITY REGIME:</span>
                    <div className="grid grid-cols-2 gap-1 mt-1.5 text-[9px] font-black">
                      {(["hiking", "resting", "climbing", "exploring"] as const).map((act) => (
                        <button
                          key={act}
                          onClick={() => handleMetricChange("activity", act)}
                          className={`py-1.5 rounded-none text-center border uppercase cursor-pointer ${
                            currentTourist.activity === act
                              ? "bg-sky-500/10 border-sky-500 text-sky-400"
                              : "bg-black border-white/10 text-white/40 hover:text-white/70"
                          }`}
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              <div className="text-[9px] text-white/30 text-center font-bold uppercase tracking-wider mt-3">
                Simulate hypothermia or high heart rate.
              </div>
            </div>
          )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Physical Handheld Keyboard / Tab controls */}
        <div className="bg-black border-t border-white/10 px-2 py-2.5 grid grid-cols-4 gap-1 z-20 font-mono">
          <button
            type="button"
            onClick={() => handleTabChange("satphone")}
            className={`py-1.5 px-1 rounded-none flex flex-col items-center gap-0.5 cursor-pointer focus:outline-none transition-all relative border ${
              activeTab === "satphone"
                ? "bg-brand-bg text-sky-400 border-sky-500/50 shadow-sm"
                : "bg-black text-white/40 border-transparent hover:text-white/80"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="text-[8px] font-black uppercase tracking-wider truncate">Dash</span>
            {activeTab === "satphone" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute -bottom-px left-0 right-0 h-0.5 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("topomap")}
            className={`py-1.5 px-1 rounded-none flex flex-col items-center gap-0.5 cursor-pointer focus:outline-none transition-all relative border ${
              activeTab === "topomap"
                ? "bg-brand-bg text-sky-400 border-sky-500/50 shadow-sm"
                : "bg-black text-white/40 border-transparent hover:text-white/80"
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span className="text-[8px] font-black uppercase tracking-wider truncate">Map</span>
            {activeTab === "topomap" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute -bottom-px left-0 right-0 h-0.5 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
              />
            )}
          </button>
          
          <button
            type="button"
            onClick={() => handleTabChange("aichat")}
            className={`py-1.5 px-1 rounded-none flex flex-col items-center gap-0.5 cursor-pointer focus:outline-none transition-all relative border ${
              activeTab === "aichat"
                ? "bg-brand-bg text-sky-400 border-sky-500/50 shadow-sm"
                : "bg-black text-white/40 border-transparent hover:text-white/80"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="text-[8px] font-black uppercase tracking-wider truncate">Guide</span>
            {activeTab === "aichat" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute -bottom-px left-0 right-0 h-0.5 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("manual")}
            className={`py-1.5 px-1 rounded-none flex flex-col items-center gap-0.5 cursor-pointer focus:outline-none transition-all relative border ${
              activeTab === "manual"
                ? "bg-brand-bg text-sky-400 border-sky-500/50 shadow-sm"
                : "bg-black text-white/40 border-transparent hover:text-white/80"
            }`}
          >
            <ActivityIcon className="w-3.5 h-3.5" />
            <span className="text-[8px] font-black uppercase tracking-wider truncate">Vitals</span>
            {activeTab === "manual" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute -bottom-px left-0 right-0 h-0.5 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
              />
            )}
          </button>
        </div>

      </div>
    </div>
  </div>
);
}
