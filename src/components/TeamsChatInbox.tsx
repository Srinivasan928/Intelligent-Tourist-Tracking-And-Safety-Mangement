import { useState, useEffect, useRef } from "react";
import { Tourist, Incident, Geofence, TeamChannel, ChatMessage } from "../types";
import { 
  MessageSquare, Send, Radio, Users, ShieldAlert, AlertTriangle, 
  HeartPulse, Compass, Activity, Sparkles, Cpu, Clock, CheckCircle2, 
  Trash2, RefreshCw, Zap, Search, Shield, ChevronRight, PhoneCall,
  Flame, BatteryCharging, AlertOctagon, HelpCircle
} from "lucide-react";

interface TeamsChatInboxProps {
  tourists: Tourist[];
  incidents: Incident[];
  geofences: Geofence[];
  selectedTouristId: string | null;
  onSelectTourist: (id: string) => void;
  onFocusCoordinates?: (coords: [number, number], id: string) => void;
}

const INITIAL_CHANNELS: TeamChannel[] = [
  {
    id: "team-rrt",
    name: "Rapid Response Team Alpha",
    callsign: "RRT-COMMAND",
    role: "Tactical Search & Rescue Ground Operations",
    description: "Anti-Poaching Watchers, 4WD extraction cruisers, drone reconnaissance & backcountry search grids.",
    category: "tactical",
    avatar: "🛡️",
    status: "urgent",
    defaultModel: "gemini-3.1-pro-preview",
    modelTier: "complex",
    badge: "Active SAR Mission",
    unreadCount: 1,
    lastMessage: "Priority: Stranded hiker Muthu kumar in Talamalai Ravine. Advise dispatch.",
    lastTimestamp: "18:41",
    samplePrompts: [
      "🚨 Coordinate extraction for Muthu kumar in Talamalai Ravine",
      "🗺️ Optimal 4WD route from Hasanur Range Station",
      "🔋 Remote battery conservation protocol for 12% device",
      "📋 Full situational status of all 4 grid sectors",
    ],
  },
  {
    id: "team-medical",
    name: "SAR Paramedic & Trauma Unit",
    callsign: "MED-DISPATCH",
    role: "Wilderness Emergency Medical Service & Vitals Triage",
    description: "Remote physiological monitoring, hypothermia, shock management, and pre-hospital clinical guidance.",
    category: "medical",
    avatar: "🩺",
    status: "urgent",
    defaultModel: "gemini-3.5-flash",
    modelTier: "general",
    badge: "Vitals Critical",
    unreadCount: 1,
    lastMessage: "Patient t4 displaying tachycardia (125 bpm) and core temp drop (35.8°C).",
    lastTimestamp: "18:38",
    samplePrompts: [
      "🩺 Triage Muthu kumar's biometrics (HR 125, temp 35.8°C)",
      "🧊 Wilderness hypothermia & cold ravine stabilization steps",
      "💧 Hydration & fatigue assessment for hiker Moorthy",
      "🚑 Ambulance & paramedic staging checklist at Hasanur",
    ],
  },
  {
    id: "team-wildlife",
    name: "STR Wildlife & Elephant Squad",
    callsign: "ELEPHANT-SQUAD",
    role: "Asian Elephant Tracking & Forest Corridor Safety",
    description: "Asian wild elephant telemetry, herd tracking, gaur/tiger mitigation flares & wildlife safety buffer zones.",
    category: "wildlife",
    avatar: "🐘",
    status: "online",
    defaultModel: "gemini-3.5-flash",
    modelTier: "general",
    badge: "Herd Active",
    unreadCount: 0,
    lastMessage: "Breeding herd of 6 elephants foraging across Talamalai corridor.",
    lastTimestamp: "18:25",
    samplePrompts: [
      "🐘 Elephant herd position relative to Muthu kumar [11.6450, 77.0950]",
      "⚠️ Protocol if Asian elephants approach a stranded hiker in darkness",
      "🐅 Leopard & carnivore movement along Dhimbam hairpin bends",
      "🔊 Safety buffer distance & acoustic deterrent recommendations",
    ],
  },
  {
    id: "team-traffic",
    name: "Dhimbam Ghat & Weather Dispatch",
    callsign: "GHAT-DISPATCH",
    role: "Rapid Radio Dispatch & 27 Curves Transit Control",
    description: "Instant road clearance, heavy monsoon fog status on NH 948, Bannari checkpost logs & flash floods.",
    category: "dispatch",
    avatar: "📻",
    status: "online",
    defaultModel: "gemini-3.1-flash-lite",
    modelTier: "fast",
    badge: "Fast Dispatch",
    unreadCount: 0,
    lastMessage: "Heavy mist envelops bends 12-22. Commercial curfew active.",
    lastTimestamp: "18:14",
    samplePrompts: [
      "🌧️ Current fog visibility on Dhimbam Hairpin 9-27",
      "🛑 Bannari & Hasanur checkpost night curfew status",
      "🌊 Moyar river gauge level & flash flood risk",
      "⚡ Quick radio clearance for emergency rescue vehicle STR-04",
    ],
  },
  {
    id: "team-tourist-direct",
    name: "Field Handsets Tactical Intercom",
    callsign: "INTERCOM-RELAY",
    role: "Direct Satellite Relay to Tourist Handhelds",
    description: "Direct real-time two-way satellite comms with hikers' TourGuard trackers in the wilderness.",
    category: "direct",
    avatar: "📡",
    status: "urgent",
    defaultModel: "gemini-3.5-flash",
    modelTier: "general",
    badge: "Handset SOS Active",
    unreadCount: 2,
    lastMessage: "Muthu kumar: 'Please hurry, my battery just dipped to 12%...'",
    lastTimestamp: "18:42",
    samplePrompts: [
      "📻 Instruct Muthu kumar: Stay on high boulder, conserve light",
      "📻 Check in with Selvan at Dhimbam 27th Hairpin viewpoint",
      "📻 Send hydration alert to Moorthy near Hasanur",
      "📢 Broadcast regional weather advisory to all 4 handsets",
    ],
  },
];

const INITIAL_THREAD_HISTORY: Record<string, ChatMessage[]> = {
  "team-rrt": [
    {
      id: "m1-rrt",
      sender: "system",
      text: "🔒 ENCRYPTED SATELLITE COMMS LINK ESTABLISHED // SATHYAMANGALAM SAR GRID",
      timestamp: "18:30",
    },
    {
      id: "m2-rrt",
      sender: "bot",
      text: "**[SITREP // RRT-COMMAND TO HQ]**\n\n🚨 **URGENT ALERT**: Tourist **Muthu kumar (ID: t4)** triggered manual SOS panic beacon in **Talamalai Forest Ravine** [11.6450, 77.0950]. Handheld battery is critically depleted at **12%**.\n\n4WD Rapid Response vehicle with Anti-Poaching Watchers is spun up at Hasanur Range Station. Awaiting operator deployment orders.",
      timestamp: "18:41",
      modelUsed: "gemini-3.1-pro-preview",
    },
  ],
  "team-medical": [
    {
      id: "m1-med",
      sender: "system",
      text: "🩺 BIO-SENSOR TELEMETRY STREAM ONLINE // EMERGENCY CLINICAL DESK",
      timestamp: "18:20",
    },
    {
      id: "m2-med",
      sender: "bot",
      text: "**[MED-DISPATCH // CLINICAL ALERT]**\n\nTelemetry lock on patient **Muthu kumar**:\n- Heart Rate: **125 bpm** (Severe acute stress tachycardia)\n- Core Temperature: **35.8°C** (Sub-clinical hypothermia risk in damp jungle ravine)\n- Battery: **12%**\n\nRecommend transmitting immediate hypothermia mitigation checklist before device goes dark.",
      timestamp: "18:38",
      modelUsed: "gemini-3.5-flash",
    },
  ],
  "team-wildlife": [
    {
      id: "m1-wld",
      sender: "system",
      text: "🐘 STR ELEPHANT SQUAD TELEMETRY NODE // ASIAN ELEPHANT TRACKING MESH",
      timestamp: "18:15",
    },
    {
      id: "m2-wld",
      sender: "bot",
      text: "**[ELEPHANT-SQUAD // WILDLIFE INTEL]**\n\nRadio-collared Asian elephant matriarch herd (6 members) is active 1.8km north-west of Talamalai Ravine. Advise search teams to carry acoustic deterrence sirens and stay downwind.",
      timestamp: "18:25",
      modelUsed: "gemini-3.5-flash",
    },
  ],
  "team-traffic": [
    {
      id: "m1-trf",
      sender: "system",
      text: "📻 BANNARI & DHIMBAM GHAT TRAFFIC CONTROL DESK // NH 948 DISPATCH",
      timestamp: "18:10",
    },
    {
      id: "m2-trf",
      sender: "bot",
      text: "**[GHAT-DISPATCH // RADIO ACK]**\n\nDhimbam 27 Hairpin Bends: Heavy fog from bend 12 up to bend 27. Visibility reduced to 25m. Night transit curfew strictly enforced at Bannari gate. Fast radio frequency open for SAR convoy priority.",
      timestamp: "18:14",
      modelUsed: "gemini-3.1-flash-lite",
    },
  ],
  "team-tourist-direct": [
    {
      id: "m1-dir",
      sender: "system",
      text: "📡 DIRECT SATELLITE HANDSET RELAY // 4 TRANSCEIVERS LOCKED",
      timestamp: "18:00",
    },
    {
      id: "m2-dir",
      sender: "bot",
      text: "**[RADIO INCOMING // MUTHU KUMAR HANDSET (12% BATT)]**\n\n*\"Ranger Command, I can hear your radio... It's getting pitch dark down here in the ravine. I am sitting on a large granite boulder as told. I heard heavy branch cracking about 200 meters away earlier... Please hurry, my battery just dipped to 12%!\"*",
      timestamp: "18:42",
      modelUsed: "gemini-3.5-flash",
    },
  ],
};

export default function TeamsChatInbox({
  tourists,
  incidents,
  geofences,
  selectedTouristId,
  onSelectTourist,
  onFocusCoordinates,
}: TeamsChatInboxProps) {
  const [channels, setChannels] = useState<TeamChannel[]>(INITIAL_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState<string>("team-rrt");
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>(INITIAL_THREAD_HISTORY);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Model selection per channel or global override
  const [selectedModelByChannel, setSelectedModelByChannel] = useState<Record<string, string>>({
    "team-rrt": "gemini-3.1-pro-preview", // Complex tasks
    "team-medical": "gemini-3.5-flash",    // General tasks
    "team-wildlife": "gemini-3.5-flash",   // General tasks
    "team-traffic": "gemini-3.1-flash-lite", // Fast tasks
    "team-tourist-direct": "gemini-3.5-flash", // General tasks
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activeMessages = messagesByChannel[activeChannelId] || [];
  const currentModel = selectedModelByChannel[activeChannelId] || activeChannel.defaultModel;

  // Auto scroll to bottom of thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, isSending]);

  // Mark channel as read when opened
  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, unreadCount: 0 } : c))
    );
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Switch model for the current active channel
  const handleModelChange = (model: string) => {
    setSelectedModelByChannel((prev) => ({
      ...prev,
      [activeChannelId]: model,
    }));
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      modelUsed: currentModel,
    };

    const updatedHistory = [...activeMessages, userMsg];

    // Optimistic UI update
    setMessagesByChannel((prev) => ({
      ...prev,
      [activeChannelId]: updatedHistory,
    }));
    setInputMessage("");
    setIsSending(true);

    // Update channel snippet
    setChannels((prev) =>
      prev.map((c) =>
        c.id === activeChannelId
          ? {
              ...c,
              lastMessage: text,
              lastTimestamp: userMsg.timestamp,
            }
          : c
      )
    );

    try {
      const response = await fetch("/api/teams/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: activeChannelId,
          model: currentModel,
          messages: updatedHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reach team radio relay");
      }

      const data = await response.json();

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.text || "Acknowledgment confirmed by dispatch frequency.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelUsed: data.modelUsed || currentModel,
      };

      setMessagesByChannel((prev) => ({
        ...prev,
        [activeChannelId]: [...(prev[activeChannelId] || []), botMsg],
      }));

      // Update snippet with bot reply
      setChannels((prev) =>
        prev.map((c) =>
          c.id === activeChannelId
            ? {
                ...c,
                lastMessage: botMsg.text.slice(0, 70) + (botMsg.text.length > 70 ? "..." : ""),
                lastTimestamp: botMsg.timestamp,
              }
            : c
        )
      );
    } catch (err: any) {
      console.error("Teams chat error:", err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "system",
        text: `⚠️ TRANSMISSION WARNING: ${err.message || "Failed to receive radio response."} Operating under local emergency buffer.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessagesByChannel((prev) => ({
        ...prev,
        [activeChannelId]: [...(prev[activeChannelId] || []), errMsg],
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm(`Clear message history for ${activeChannel.name}?`)) {
      setMessagesByChannel((prev) => ({
        ...prev,
        [activeChannelId]: [
          {
            id: `sys-${Date.now()}`,
            sender: "system",
            text: `CHANNEL HISTORY CLEARED // OPERATOR RESET [${new Date().toLocaleTimeString()}]`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      }));
    }
  };

  // Filter channels
  const filteredChannels = channels.filter((c) => {
    const matchesCat = categoryFilter === "all" || c.category === categoryFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const totalUnread = channels.reduce((sum, c) => sum + c.unreadCount, 0);
  const activeSOS = incidents.filter((i) => i.status !== "resolved");

  return (
    <div className="bg-brand-panel border border-white/10 flex flex-col h-[750px] shadow-2xl rounded-none overflow-hidden font-sans">
      
      {/* Top Status Header Bar */}
      <div className="bg-[#0B0F19] border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red/20 border border-brand-red flex items-center justify-center text-brand-red font-black">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-white">
                Teams Radio & Comms Inbox
              </h2>
              <span className="text-[10px] font-mono font-bold bg-brand-red/20 text-brand-red border border-brand-red/40 px-1.5 py-0.5 uppercase">
                Multi-Turn Gemini Hub
              </span>
            </div>
            <p className="text-[11px] text-white/50 font-mono">
              Secure tactical radio channels with specialized AI response teams
            </p>
          </div>
        </div>

        {/* Global Situational Mini-Badge */}
        <div className="flex items-center gap-2">
          {activeSOS.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 px-2.5 py-1 text-red-400 text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>SOS ACTIVE: {activeSOS[0].touristName} (12% Batt)</span>
            </div>
          )}
          <div className="bg-white/5 border border-white/10 px-2.5 py-1 text-slate-300 text-xs font-mono flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>{channels.length} Teams Online</span>
          </div>
        </div>
      </div>

      {/* Main Split Body: Channels Inbox Sidebar (left) + Active Chat Thread (right) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
        
        {/* Left Side: Channels List / Inbox */}
        <div className="md:col-span-4 lg:col-span-4 border-r border-white/10 flex flex-col bg-[#080C14] min-h-0">
          
          {/* Search & Filter */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams, callsigns..."
                className="w-full bg-white/5 border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-sky-400 font-mono"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono uppercase">
              {[
                { id: "all", label: "All" },
                { id: "tactical", label: "SAR" },
                { id: "medical", label: "Med" },
                { id: "wildlife", label: "Wildlife" },
                { id: "dispatch", label: "Traffic" },
                { id: "direct", label: "Field" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2 py-0.5 transition-colors cursor-pointer shrink-0 font-bold ${
                    categoryFilter === cat.id
                      ? "bg-white text-black font-black"
                      : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Channels Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredChannels.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/40 font-mono">
                No matching teams found.
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const isSelected = channel.id === activeChannelId;
                const channelModel = selectedModelByChannel[channel.id] || channel.defaultModel;

                return (
                  <button
                    key={channel.id}
                    onClick={() => handleSelectChannel(channel.id)}
                    className={`w-full text-left p-3 transition-colors cursor-pointer relative flex items-start gap-3 ${
                      isSelected
                        ? "bg-white/10 border-l-4 border-brand-red"
                        : "hover:bg-white/5 border-l-4 border-transparent"
                    }`}
                  >
                    {/* Team Avatar Icon */}
                    <div className="relative shrink-0 text-xl">
                      <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
                        {channel.avatar}
                      </div>
                      {channel.status === "urgent" && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                      )}
                    </div>

                    {/* Team Information */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black uppercase tracking-wider text-white truncate">
                          {channel.name}
                        </span>
                        <span className="text-[10px] font-mono text-white/40 shrink-0 ml-1">
                          {channel.lastTimestamp || "Live"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sky-400 bg-sky-400/10 px-1 py-0.2 border border-sky-400/30">
                          {channel.callsign}
                        </span>
                        {channel.badge && (
                          <span
                            className={`text-[9px] font-mono font-bold px-1 py-0.2 border uppercase ${
                              channel.status === "urgent"
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-white/5 text-white/50 border-white/10"
                            }`}
                          >
                            {channel.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-white/60 truncate font-sans">
                        {channel.lastMessage || channel.role}
                      </p>

                      {/* Model Indicator Chip */}
                      <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-white/40">
                        <span className="truncate">Model: {channelModel.replace("gemini-", "")}</span>
                        {channel.unreadCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-brand-red text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                            {channel.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom Field Units Quick Context */}
          <div className="p-3 bg-[#05080E] border-t border-white/10">
            <div className="text-[10px] font-mono font-bold text-white/40 uppercase mb-1 flex items-center justify-between">
              <span>Tracked Field Units</span>
              <span className="text-sky-400">{tourists.length} Active</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {tourists.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTourist(t.id)}
                  className={`p-1.5 border text-[10px] font-mono cursor-pointer transition-colors ${
                    t.status === "danger"
                      ? "bg-red-500/10 border-red-500/50 text-red-300"
                      : t.status === "warning"
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <div className="font-bold truncate">{t.name}</div>
                  <div className="flex justify-between text-[9px] opacity-75">
                    <span>{t.battery}%</span>
                    <span>{t.heartRate} bpm</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Active Multi-Turn Chat Thread */}
        <div className="md:col-span-8 lg:col-span-8 flex flex-col bg-[#0A0E17] min-h-0">
          
          {/* Active Channel Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-[#0C121E] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0">
                {activeChannel.avatar}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white truncate">
                    {activeChannel.name}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-sky-400/10 text-sky-400 border border-sky-400/30">
                    {activeChannel.callsign}
                  </span>
                </div>
                <p className="text-[11px] text-white/50 font-mono truncate">
                  {activeChannel.role}
                </p>
              </div>
            </div>

            {/* Model Selector & Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Gemini Model Selector */}
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1">
                <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[10px] font-mono text-white/60 uppercase">Model:</span>
                <select
                  value={currentModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="bg-transparent text-xs font-mono font-bold text-sky-400 focus:outline-none cursor-pointer"
                  title="Select Gemini Model Tier"
                >
                  <option value="gemini-3.8-flash" className="bg-[#0B0F19] text-white">
                    gemini-3.8-flash (Standard)
                  </option>
                  <option value="gemini-3.1-pro-preview" className="bg-[#0B0F19] text-white">
                    gemini-3.1-pro-preview (Complex Tasks)
                  </option>
                  <option value="gemini-3.5-flash" className="bg-[#0B0F19] text-white">
                    gemini-3.5-flash (General Tasks)
                  </option>
                  <option value="gemini-3.1-flash-lite" className="bg-[#0B0F19] text-white">
                    gemini-3.1-flash-lite (Fast Tasks)
                  </option>
                </select>
              </div>

              {/* Clear History Button */}
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                title="Clear channel conversation history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Model Operational Context Pill */}
          <div className="bg-[#070A10] px-4 py-1.5 border-b border-white/5 flex items-center justify-between text-[10px] font-mono text-white/50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>UPLINK: SATHYAMANGALAM TACTICAL MESH ACTIVE</span>
            </div>
            <div className="flex items-center gap-3">
              <span>ROLE INSTRUCTION APPLIED</span>
              <span className="text-sky-400/80">
                {currentModel === "gemini-3.1-pro-preview"
                  ? "🧠 High Reasoning SAR Engine"
                  : currentModel === "gemini-3.1-flash-lite"
                  ? "⚡ Low Latency Fast Dispatch"
                  : "✨ Balanced Operational Mode"}
              </span>
            </div>
          </div>

          {/* Scrollable Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#070B13]">
            {activeMessages.map((msg, index) => {
              const isUser = msg.sender === "user";
              const isSystem = msg.sender === "system";

              if (isSystem) {
                return (
                  <div key={msg.id || index} className="flex justify-center my-2">
                    <div className="bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-mono text-white/50 tracking-wider uppercase text-center max-w-lg">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[88%] md:max-w-[80%] ${
                    isUser ? "ml-auto" : "mr-auto"
                  }`}
                >
                  {/* Sender Metadata Bar */}
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/50">
                      {isUser ? "Ranger Command HQ" : activeChannel.callsign}
                    </span>
                    <span className="text-[9px] font-mono text-white/30">
                      {msg.timestamp}
                    </span>
                    {msg.modelUsed && !isUser && (
                      <span className="text-[9px] font-mono text-sky-400/80 bg-sky-400/10 px-1 py-0.2 border border-sky-400/20">
                        {msg.modelUsed.replace("gemini-", "")}
                      </span>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-3 text-xs leading-relaxed ${
                      isUser
                        ? "bg-brand-red text-white border border-red-500 font-sans shadow-lg"
                        : "bg-[#111726] text-slate-100 border border-white/15 font-sans shadow-md"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words font-sans space-y-1">
                      {msg.text.split("\n").map((line, lIdx) => {
                        // Styled headers / highlights
                        if (line.startsWith("**[") && line.endsWith("]**")) {
                          return (
                            <div key={lIdx} className="font-mono font-bold text-sky-400 tracking-wider text-[11px] mb-1">
                              {line.replace(/\*\*/g, "")}
                            </div>
                          );
                        }
                        if (line.includes("🚨") || line.includes("URGENT") || line.includes("CRITICAL")) {
                          return (
                            <div key={lIdx} className="text-red-300 font-bold bg-red-500/10 px-2 py-0.5 my-1 border border-red-500/20">
                              {line}
                            </div>
                          );
                        }
                        return <div key={lIdx}>{line}</div>;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Waiting for response indicator */}
            {isSending && (
              <div className="flex flex-col items-start max-w-[80%] mr-auto">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                    {activeChannel.callsign} TRANSMITTING...
                  </span>
                  <span className="text-[9px] font-mono text-white/30">Live</span>
                </div>
                <div className="bg-[#111726] border border-sky-400/40 p-3 text-xs font-mono text-sky-400 flex items-center gap-2.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Relaying situational prompt via {currentModel}...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Tactical Prompt Chips */}
          <div className="px-4 py-2 bg-[#0B0F19] border-t border-white/5 overflow-x-auto flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono font-bold text-white/40 uppercase shrink-0 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Quick Dispatches:
            </span>
            {activeChannel.samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                disabled={isSending}
                onClick={() => handleSendMessage(prompt)}
                className="bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 px-2.5 py-1 text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Message Input Bar */}
          <div className="p-3 bg-[#0E1422] border-t border-white/10 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Dispatch order to ${activeChannel.name} (${activeChannel.callsign})...`}
                  disabled={isSending}
                  className="w-full bg-[#070B13] border border-white/20 px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-sky-400 font-sans disabled:opacity-50"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/30 hidden sm:block">
                  Press Enter ↵
                </div>
              </div>

              <button
                type="submit"
                disabled={isSending || !inputMessage.trim()}
                className="bg-brand-red hover:bg-red-600 disabled:bg-white/10 text-white font-mono font-bold uppercase text-xs px-4 py-2.5 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Relaying</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Transmit</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
}
