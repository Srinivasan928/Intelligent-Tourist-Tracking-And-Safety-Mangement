import { useState, useEffect } from "react";
import { Tourist, Geofence, Incident, Advisory } from "./types";
import InteractiveMap from "./components/InteractiveMap";
import TouristApp from "./components/TouristApp";
import DispatcherConsole from "./components/DispatcherConsole";
import TeamsChatInbox from "./components/TeamsChatInbox";
import AuthBar from "./components/AuthBar";
import PersonnelDirectory from "./components/PersonnelDirectory";
import { 
  savePersonToFirestore, 
  seedTouristsIfEmpty, 
  subscribeToTourists,
  batchUpdateTouristsStatus,
  batchBroadcastAlertToTourists
} from "./services/firebase";
import { 
  Radio, Clock, AlertTriangle, Compass, Map, ShieldAlert, Sparkles, 
  Settings, CheckCircle, RefreshCw, Smartphone, LogOut, Info, ArrowUpRight,
  MessageSquare, Users, Database, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";

export default function App() {
  // Master States
  const [tourists, setTourists] = useState<Tourist[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);

  // Selection & focus states
  const [selectedTouristId, setSelectedTouristId] = useState<string | null>(null); // Free overview by default; select on emergency or click
  const [focusCoordinates, setFocusCoordinates] = useState<[number, number] | null>(null);
  const [focusTriggerKey, setFocusTriggerKey] = useState<number>(1);
  
  // App-wide Status state
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPersonnelDirectoryOpen, setIsPersonnelDirectoryOpen] = useState(false);
  const [showDatabaseAboveMap, setShowDatabaseAboveMap] = useState(true);

  // Active view toggle on desktop & mobile
  const [mainView, setMainView] = useState<"operations" | "database" | "inbox">("operations");
  const [mobileActiveView, setMobileActiveView] = useState<"ranger" | "database" | "inbox" | "tourist">("ranger");

  // Fetch initial state from full-stack server
  const fetchState = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (Array.isArray(data.tourists)) {
            setTourists(data.tourists);
            seedTouristsIfEmpty(data.tourists).catch(() => {});
          }
          if (Array.isArray(data.geofences)) setGeofences(data.geofences);
          if (Array.isArray(data.incidents)) setIncidents(data.incidents);
          if (Array.isArray(data.advisories)) setAdvisories(data.advisories);
        }
      }
    } catch (err) {
      console.error("Failed to load tracking data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchState();
    
    // Subscribe to real-time changes in Firestore tourists collection
    let unsubscribeTourists = () => {};
    try {
      unsubscribeTourists = subscribeToTourists((firestoreTourists) => {
        if (firestoreTourists && firestoreTourists.length > 0) {
          setTourists(firestoreTourists);
        }
      });
    } catch (err) {
      console.warn("Firestore live listener skipped:", err);
    }

    // Update local clock every second
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toUTCString().replace("GMT", "UTC"));
    }, 1000);

    // Poll server state every 7 seconds for back-channel sync
    const pollInterval = setInterval(() => {
      fetchState();
    }, 7000);

    return () => {
      unsubscribeTourists();
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, []);

  // API Call: Update tourist metrics
  const handleUpdateTourist = async (updatedTourist: Tourist) => {
    // Optimistic UI update
    setTourists((prev) => prev.map((t) => (t.id === updatedTourist.id ? updatedTourist : t)));

    try {
      const res = await fetch("/api/tourist/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTourist),
      });

      if (res.ok) {
        const data = await res.json();
        // If a geofence was entered, re-fetch state to draw automated geofence incidents immediately
        if (data.breachedGeofence) {
          fetchState();
        }
      }
    } catch (err) {
      console.error("Failed to sync hiker updates with server:", err);
    }
  };

  // API Call: Trigger or cancel SOS
  const handleTriggerSOS = async (id: string, isSOS: boolean) => {
    // Optimistic UI update
    setTourists((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: isSOS ? "danger" as const : "safe" as const } : t))
    );

    try {
      const res = await fetch("/api/tourist/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isSOS }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error("Failed to trigger SOS:", err);
    }
  };

  // API Call: Update Incident Status
  const handleUpdateIncidentStatus = async (id: string, status: "dispatched" | "resolved") => {
    try {
      const res = await fetch("/api/incident/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error("Failed to update incident:", err);
    }
  };

  // API Call: Generate Search and Rescue Triage Plan (Gemini)
  const handleGenerateTriagePlan = async (id: string): Promise<string> => {
    try {
      const res = await fetch("/api/incident/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchState(); // Re-fetch to update local incident records
        return data.triagePlan;
      }
      throw new Error("Failed to generate plan");
    } catch (err) {
      console.error("Triage plan query failed:", err);
      return "Unable to connect to SAR satellite node. Please check server secrets.";
    }
  };

  // API Call: Generate Daily Safety Report (Gemini)
  const handleGenerateDailyAdvisory = async (weatherCondition: string) => {
    try {
      const res = await fetch("/api/advisory/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weatherCondition }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error("Report drafting failed:", err);
    }
  };

  // API Call: Post manual advisory
  const handleAddManualAdvisory = async (title: string, content: string, type: "weather" | "hazard" | "general") => {
    try {
      const res = await fetch("/api/advisory/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, type, author: "Yosemite Dispatch Desk" }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error("Advisory creation failed:", err);
    }
  };

  // API Call: Register a new tourist with full personal data (demographics, emergency contact, blood group)
  const handleRegisterPerson = async (personData: Partial<Tourist>) => {
    try {
      const res = await fetch("/api/tourist/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personData),
      });
      if (res.ok) {
        const newPerson = await res.json();
        try {
          await savePersonToFirestore(newPerson);
        } catch (e) {
          console.warn("Firestore save fallback:", e);
        }
        await fetchState();
        setSelectedTouristId(newPerson.id);
      }
    } catch (err) {
      console.error("Hiker registration failed:", err);
    }
  };

  // API Call: Update person data (emergency, medical, blood group, ranger assignment)
  const handleUpdatePerson = async (personData: Partial<Tourist> & { id: string }) => {
    try {
      const res = await fetch("/api/tourist/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.tourist) {
          try {
            await savePersonToFirestore(data.tourist);
          } catch (e) {
            console.warn("Firestore save fallback:", e);
          }
        }
        await fetchState();
      }
    } catch (err) {
      console.error("Failed to update person:", err);
    }
  };

  const handleAddTourist = async (name: string, phone: string, notes: string) => {
    await handleRegisterPerson({ name, phone, notes });
  };

  // API & Firestore Call: Mass status update for multiple tourists
  const handleBatchStatusUpdate = async (touristIds: string[], newStatus: "safe" | "warning" | "danger", reason?: string) => {
    try {
      // 1. Full-stack API batch call
      await fetch("/api/tourists/batch-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: touristIds, status: newStatus, reason }),
      });

      // 2. Real-time Firestore atomic batch write
      try {
        await batchUpdateTouristsStatus(touristIds, newStatus, reason);
      } catch (e) {
        console.warn("Firestore batch status fallback:", e);
      }

      await fetchState();
    } catch (err) {
      console.error("Batch status update failed:", err);
    }
  };

  // API & Firestore Call: Batch broadcast alert to multiple tourists
  const handleBatchBroadcastAlert = async (touristIds: string[], message: string, severity: "advisory" | "warning" | "danger", title?: string) => {
    try {
      // 1. Full-stack API broadcast call
      await fetch("/api/tourists/batch-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: touristIds, message, severity, title }),
      });

      // 2. Real-time Firestore atomic batch write & advisory log
      try {
        await batchBroadcastAlertToTourists(touristIds, message, severity, title);
      } catch (e) {
        console.warn("Firestore batch broadcast fallback:", e);
      }

      await fetchState();
    } catch (err) {
      console.error("Batch broadcast alert failed:", err);
    }
  };

  // Focus on map coordinates
  const handleFocusTouristOnMap = (coordinates: [number, number], id: string) => {
    setFocusCoordinates(coordinates);
    setSelectedTouristId(id);
    setFocusTriggerKey((prev) => prev + 1);
    // Clear focusCoordinates after animation trigger
    setTimeout(() => {
      setFocusCoordinates(null);
    }, 1200);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3 font-mono">
        <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
        <span className="text-xs uppercase tracking-widest text-sky-400 font-bold animate-pulse">Initializing TourGuard SAR Network...</span>
        <span className="text-[10px] text-slate-600">Syncing telemetry and satellite layers</span>
      </div>
    );
  }

  // Active emergencies count
  const safeTourists = Array.isArray(tourists) ? tourists : [];
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const safeGeofences = Array.isArray(geofences) ? geofences : [];
  const safeAdvisories = Array.isArray(advisories) ? advisories : [];
  const criticalCount = safeIncidents.filter((i) => i && i.status !== "resolved").length;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans text-[#F0F0F0] p-4 md:p-8 overflow-x-hidden">
      
      {/* Top Navigation & Status */}
      <header className="flex flex-col md:flex-row justify-between items-baseline border-b border-white/10 pb-4 mb-6 gap-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
            TourGuard<span className="text-brand-red">.</span>
          </h1>
          <span className="text-[10px] tracking-[0.3em] font-bold text-white/40 uppercase">Safety OS v8.2</span>
          <span className="text-[10px] tracking-[0.15em] font-mono text-sky-400/80 uppercase hidden sm:inline">• World Map Engine</span>
          <span className="text-[10px] tracking-[0.15em] font-mono text-emerald-400 uppercase hidden md:inline">• Firebase Integrated</span>
        </div>
        
        <div className="flex flex-wrap gap-4 md:gap-6 mt-4 md:mt-0 text-left md:text-right items-center">
          {/* Google Auth & Personnel Directory Control */}
          <AuthBar
            onDirectoryOpen={() => {
              setMainView("database");
              setMobileActiveView("database");
            }}
            touristsCount={safeTourists.length}
          />

          <div className="hidden sm:block">
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Active SOS</div>
            <div className="text-xl font-mono leading-none text-brand-red font-black">
              {criticalCount > 0 ? `0${criticalCount}`.slice(-2) : "00"}
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Total Tracked</div>
            <div className="text-xl font-mono leading-none font-black">
              {`0${safeTourists.length}`.slice(-2)}
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">System Time</div>
            <div className="text-xl font-mono leading-none font-black">
              {currentTime ? currentTime.split(" ")[4] : "18:42:01"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchState(true)}
              className="bg-brand-panel hover:bg-white/10 text-white border border-white/10 rounded-none px-3 py-1.5 transition-colors focus:outline-none cursor-pointer text-xs font-mono font-bold flex items-center gap-1.5 uppercase"
              title="Sync Feed"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-brand-red" : ""}`} />
              Sync
            </button>
          </div>
        </div>
      </header>

      {/* Desktop & Tablet Mode Bar: Ranger Operations vs Database Page vs Teams Comms Inbox */}
      <div className="hidden xl:flex items-center justify-between bg-brand-panel border border-white/10 px-4 py-2 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainView("operations")}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer ${
              mainView === "operations"
                ? "bg-white text-black font-black shadow"
                : "bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Page 1: Tactical Map & Dispatcher</span>
          </button>

          <button
            onClick={() => setMainView("database")}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer relative ${
              mainView === "database"
                ? "bg-emerald-500 text-slate-950 font-black shadow"
                : "bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Page 2: Personnel Database</span>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0.2 font-mono">
              {safeTourists.length} Records
            </span>
          </button>

          <button
            onClick={() => setMainView("inbox")}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer relative ${
              mainView === "inbox"
                ? "bg-brand-red text-white font-black shadow"
                : "bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Teams Radio & Comms Inbox</span>
            <span className="bg-sky-400/20 text-sky-400 border border-sky-400/40 text-[9px] px-1.5 py-0.2 font-mono">
              5 Channels
            </span>
            {criticalCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
            )}
          </button>
        </div>

        {/* Live operational snippet */}
        <div className="flex items-center gap-3 text-xs font-mono text-white/50">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Gemini Multimodal Mesh: Active
          </span>
          <span className="text-white/20">|</span>
          <span className="text-white/40">Models: gemini-3.8-flash • 3.1-pro • 3.5-flash • 3.1-flash-lite</span>
        </div>
      </div>

      {/* Mobile Selector Tab */}
      <div className="xl:hidden bg-brand-panel border border-white/10 p-1 mb-4 flex rounded-none">
        <button
          onClick={() => {
            setMobileActiveView("ranger");
            setMainView("operations");
          }}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-none transition-colors ${
            mobileActiveView === "ranger" && mainView === "operations"
              ? "bg-brand-red text-white"
              : "bg-transparent text-white/60 hover:text-white"
          }`}
        >
          <Map className="w-4 h-4" /> Command HQ
        </button>
        <button
          onClick={() => {
            setMobileActiveView("database");
            setMainView("database");
          }}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-none transition-colors ${
            mobileActiveView === "database" || mainView === "database"
              ? "bg-emerald-500 text-slate-950 font-black"
              : "bg-transparent text-white/60 hover:text-white"
          }`}
        >
          <Database className="w-4 h-4" /> Database
          <span className="text-[9px] bg-black/40 px-1 text-white">
            {safeTourists.length}
          </span>
        </button>
        <button
          onClick={() => {
            setMobileActiveView("inbox");
            setMainView("inbox");
          }}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-none transition-colors ${
            mobileActiveView === "inbox" || mainView === "inbox"
              ? "bg-brand-red text-white"
              : "bg-transparent text-white/60 hover:text-white"
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Teams
          {criticalCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
        </button>
        <button
          onClick={() => setMobileActiveView("tourist")}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-none transition-colors ${
            mobileActiveView === "tourist"
              ? "bg-brand-red text-white"
              : "bg-transparent text-white/60 hover:text-white"
          }`}
        >
          <Smartphone className="w-4 h-4" /> Sim
        </button>
      </div>

      {/* Main Core Layout Grid */}
      <main className="flex-grow grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0">
        
        {mainView === "database" || mobileActiveView === "database" ? (
          /* Dedicated Full-Page Database View (Page 2) */
          <div className="col-span-12 flex flex-col min-h-[640px]">
            {/* Page 2 Top Navigation Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-emerald-500/40 p-3 sm:p-4 font-mono text-xs shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black uppercase tracking-wider text-white">
                      Page 2: Personnel & Tourist Database
                    </span>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-600/50 text-[10px] font-mono font-bold px-2 py-0.5">
                      Cloud Firestore Live
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Hiker profiles, blood groups, medical vitals, emergency contacts & batch operations
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setMainView("operations");
                  setMobileActiveView("ranger");
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase px-4 py-2 flex items-center gap-2 border border-white/20 cursor-pointer transition-colors shadow"
              >
                <Map className="w-4 h-4 text-sky-400" />
                <span>← Return to Tactical Map (Page 1)</span>
              </button>
            </div>

            <PersonnelDirectory
              tourists={safeTourists}
              isOpen={true}
              mode="page"
              onClose={() => {
                setMainView("operations");
                setMobileActiveView("ranger");
              }}
              onBackToMap={() => {
                setMainView("operations");
                setMobileActiveView("ranger");
              }}
              onSelectTourist={(id) => setSelectedTouristId(id)}
              onFocusOnMap={(coords, id) => {
                handleFocusTouristOnMap(coords, id);
                setMainView("operations");
                setMobileActiveView("ranger");
              }}
              onRegisterPerson={handleRegisterPerson}
              onUpdatePerson={handleUpdatePerson}
              onBatchUpdateStatus={handleBatchStatusUpdate}
              onBatchBroadcastAlert={handleBatchBroadcastAlert}
            />
          </div>
        ) : (
          <>
            {/* Left Side Column: Map & Dispatcher Console OR Teams Chat Inbox */}
            <div className={`xl:col-span-8 flex flex-col gap-6 ${
              mobileActiveView === "tourist" ? "hidden xl:flex" : "block"
            }`}>
              {mainView === "inbox" || mobileActiveView === "inbox" ? (
                /* Teams Comms Inbox View */
                <TeamsChatInbox
                  tourists={safeTourists}
                  incidents={safeIncidents}
                  geofences={safeGeofences}
                  selectedTouristId={selectedTouristId}
                  onSelectTourist={(id) => {
                    setSelectedTouristId(id);
                  }}
                  onFocusCoordinates={handleFocusTouristOnMap}
                />
              ) : (
                /* Standard Tactical Operations View: Page 1 Tactical Map & Dispatcher */
                <>
                  {/* Tactical Interactive Map (Extended Full Display) */}
                  <div className="h-[680px] sm:h-[750px] xl:h-[820px] w-full shadow-2xl">
                    <InteractiveMap
                      tourists={safeTourists}
                      geofences={safeGeofences}
                      selectedTouristId={selectedTouristId}
                      focusCoordinates={focusCoordinates}
                      focusTriggerKey={focusTriggerKey}
                      onSelectTourist={(id) => {
                        setSelectedTouristId(id);
                        setFocusTriggerKey((prev) => prev + 1);
                      }}
                      onUpdateTourist={handleUpdateTourist}
                    />
                  </div>

                  {/* Dispatcher Console */}
                  <div>
                    <DispatcherConsole
                      tourists={safeTourists}
                      geofences={safeGeofences}
                      incidents={safeIncidents}
                      advisories={safeAdvisories}
                      selectedTouristId={selectedTouristId}
                      onFocusTourist={handleFocusTouristOnMap}
                      onUpdateIncidentStatus={handleUpdateIncidentStatus}
                      onGenerateTriage={handleGenerateTriagePlan}
                      onGenerateDailyAdvisory={handleGenerateDailyAdvisory}
                      onAddManualAdvisory={handleAddManualAdvisory}
                      onAddTourist={handleAddTourist}
                      onOpenTeamsInbox={() => {
                        setMainView("inbox");
                        setMobileActiveView("inbox");
                      }}
                      onOpenPersonnelDirectory={(id) => {
                        if (id) setSelectedTouristId(id);
                        setShowDatabaseAboveMap(true);
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Right Side Column: Rugged Tourist App Simulator */}
            <div className={`xl:col-span-4 flex flex-col justify-start items-center ${
              mobileActiveView === "tourist" ? "block" : "hidden xl:flex"
            }`}>
              <div className="sticky top-6 w-full flex flex-col items-center">
                
                {/* Quick Context Card */}
                <div className="w-full max-w-[340px] mb-4 bg-brand-panel p-5 border-l-4 border-brand-red text-xs text-slate-300 leading-normal flex items-start gap-3 rounded-none">
                  <Info className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-black uppercase tracking-wider block mb-1">Simulator Sandbox</strong>
                    Move the hiker using the <strong className="text-brand-red font-mono">D-Pad</strong>. Walk into red geofences to breach hazards, drag biometric sliders, trigger an SOS, and ask Gemini for custom high-angle rescue guides.
                  </div>
                </div>

                <TouristApp
                  tourists={safeTourists}
                  geofences={safeGeofences}
                  selectedTouristId={selectedTouristId}
                  onSelectTourist={setSelectedTouristId}
                  onUpdateTourist={handleUpdateTourist}
                  onTriggerSOS={handleTriggerSOS}
                />

              </div>
            </div>
          </>
        )}

      </main>

      {/* Bottom Ticker */}
      <footer className="mt-8 bg-brand-panel py-3 px-6 border border-white/5 flex items-center rounded-none overflow-hidden">
        <div className="text-[10px] font-black uppercase text-brand-red tracking-widest mr-6 shrink-0 flex items-center gap-1.5">
          <span className="w-2 h-2 bg-brand-red rounded-full animate-ping"></span>
          Live Feed
        </div>
        <div className="flex-grow overflow-hidden relative">
          <div 
            className="text-[11px] font-mono whitespace-nowrap opacity-60 flex gap-12" 
            style={{ 
              display: 'inline-flex',
              animation: 'marquee 30s linear infinite'
            }}
          >
            <span>[INFO] YOSEMITE REGION SATELLITE ALTITUDE: 22,236 MILES (LOCK VERIFIED)</span>
            <span>[ALERT] ADVISORY LOGS SYNCHRONIZED ACROSS DISPATCH CHANNELS</span>
            <span>[EVENT] ACTIVE BIO-SENSOR GRID OPERATING AT 100% SAT STRENGTH</span>
            <span>[LOG] BATTERY LEVELS NOMINAL ACROSS ALL BACKCOUNTRY SENSORS</span>
            <span>[DEBUG] GEOTAPPING MATRIX FULLY CALIBRATED WITH SATELLITE HUD</span>
          </div>
        </div>
      </footer>

      {/* Complete Persons & Tourists Directory with Firebase Persistence */}
      <PersonnelDirectory
        tourists={safeTourists}
        isOpen={isPersonnelDirectoryOpen}
        onClose={() => setIsPersonnelDirectoryOpen(false)}
        onSelectTourist={(id) => setSelectedTouristId(id)}
        onFocusOnMap={handleFocusTouristOnMap}
        onRegisterPerson={handleRegisterPerson}
        onUpdatePerson={handleUpdatePerson}
        onBatchUpdateStatus={handleBatchStatusUpdate}
        onBatchBroadcastAlert={handleBatchBroadcastAlert}
      />
    </div>
  );
}
