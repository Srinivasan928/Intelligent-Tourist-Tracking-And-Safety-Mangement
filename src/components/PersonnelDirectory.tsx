import React, { useState } from "react";
import { 
  Users, UserPlus, Heart, Battery, Thermometer, ShieldAlert, 
  MapPin, Phone, AlertTriangle, CheckCircle, Edit3, X, Save,
  Database, UserCheck, Activity, Award, Shield, FileText, Search,
  ExternalLink, ChevronUp, ChevronDown, Map, CheckSquare, Square,
  MinusSquare, Radio, Bell, Send, CheckCircle2, AlertOctagon,
  Sparkles, Filter, ListFilter, SlidersHorizontal, RefreshCw, Check, CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tourist } from "../types";
import { 
  savePersonToFirestore, 
  batchUpdateTouristsStatus, 
  batchBroadcastAlertToTourists 
} from "../services/firebase";

interface PersonnelDirectoryProps {
  tourists: Tourist[];
  isOpen?: boolean;
  onClose?: () => void;
  onSelectTourist: (id: string) => void;
  onFocusOnMap: (coordinates: [number, number], id: string) => void;
  onRegisterPerson: (personData: Partial<Tourist>) => Promise<void>;
  onUpdatePerson: (personData: Partial<Tourist> & { id: string }) => Promise<void>;
  isFirebaseConnected?: boolean;
  mode?: "modal" | "embedded" | "page";
  onOpenFullPage?: () => void;
  onBackToMap?: () => void;
  onBatchUpdateStatus?: (touristIds: string[], newStatus: "safe" | "warning" | "danger", reason?: string) => Promise<void>;
  onBatchBroadcastAlert?: (touristIds: string[], message: string, severity: "advisory" | "warning" | "danger", title?: string) => Promise<void>;
}

// Rapid Broadcast Alert Presets for Tactical Forest Range Operations
const BROADCAST_PRESETS = [
  {
    title: "Wild Elephant Movement Alert",
    severity: "warning" as const,
    message: "Forest Ranger Dispatch: Active wild elephant herd crossing Dhimbam sector trail near 27th bend. Halt forward motion, do not approach, remain in marked shelters.",
  },
  {
    title: "Moyar Riverbed Flash Flood Warning",
    severity: "danger" as const,
    message: "Urgent Weather Advisory: Upstream dam release and torrential rain causing fast surge in Moyar gorge. Immediately evacuate riverbed trails to elevated ridge markers.",
  },
  {
    title: "Forest Ranger Escort En Route",
    severity: "advisory" as const,
    message: "STR Ranger unit under Murugan dispatched to your sector coordinates. Keep beacon transmitters active and stand by for VHF radio link.",
  },
  {
    title: "Evening Forest Curfew Notice",
    severity: "advisory" as const,
    message: "Standard park curfew commences at 18:00 hrs. All wilderness trekking permits require return checkout at Bannari Checkpost Gate #1.",
  },
];

const STATUS_REASON_PRESETS = [
  "In-person wellness check completed by Ranger Murugan",
  "Verified safe arrival at forest basecamp / checkpost",
  "Severe dehydration / elevated vitals observed on satellite telemetry",
  "High danger zone / cliff ravine proximity override",
  "Radio check-in confirmed; nominal status restored",
];

export default function PersonnelDirectory({
  tourists,
  isOpen = true,
  onClose,
  onSelectTourist,
  onFocusOnMap,
  onRegisterPerson,
  onUpdatePerson,
  isFirebaseConnected = true,
  mode = "modal",
  onOpenFullPage,
  onBackToMap,
  onBatchUpdateStatus,
  onBatchBroadcastAlert,
}: PersonnelDirectoryProps) {
  const [activeTab, setActiveTab] = useState<"list" | "register">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Tourist | null>(tourists[0] || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Tourist>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Multi-Selection State for Batch Actions
  const [selectedTouristIds, setSelectedTouristIds] = useState<string[]>([]);
  const [rightViewMode, setRightViewMode] = useState<"profile" | "batch_roster">("profile");

  // Broadcast Alert Modal State
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastSeverity, setBroadcastSeverity] = useState<"advisory" | "warning" | "danger">("warning");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccessMessage, setBroadcastSuccessMessage] = useState<string | null>(null);

  // Mass Status Update Modal State
  const [isMassStatusModalOpen, setIsMassStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<"safe" | "warning" | "danger">("safe");
  const [statusReason, setStatusReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusSuccessMessage, setStatusSuccessMessage] = useState<string | null>(null);

  // New registration form state
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    emergencyContact: "",
    bloodGroup: "O+ (Positive)",
    age: "28",
    gender: "Male",
    idProof: "",
    entryGate: "Bannari Amman Checkpost Gate #1",
    permitNumber: `STR-TRK-${Math.floor(1000 + Math.random() * 9000)}`,
    assignedRanger: "Forest Guard Murugan (Dhimbam Beat)",
    medicalNotes: "No chronic conditions. Standard wilderness gear.",
    notes: "Trekking permit authorized for Dhimbam-Hasanur range.",
  });

  if (!isOpen) return null;

  const filteredTourists = tourists.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.phone && t.phone.toLowerCase().includes(q)) ||
      (t.bloodGroup && t.bloodGroup.toLowerCase().includes(q)) ||
      (t.permitNumber && t.permitNumber.toLowerCase().includes(q)) ||
      (t.street && t.street.toLowerCase().includes(q))
    );
  });

  // Selection Helper Handlers
  const handleToggleSelectTourist = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTouristIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const areAllFilteredSelected = 
    filteredTourists.length > 0 && 
    filteredTourists.every((t) => selectedTouristIds.includes(t.id));
  
  const isPartiallySelected = 
    selectedTouristIds.length > 0 && !areAllFilteredSelected;

  const handleToggleSelectAllFiltered = () => {
    const filteredIds = filteredTourists.map((t) => t.id);
    if (areAllFilteredSelected) {
      // Remove filtered tourists from selection
      setSelectedTouristIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // Add all filtered tourists
      setSelectedTouristIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleSelectByPreset = (type: "all" | "danger_warning" | "safe" | "clear") => {
    if (type === "all") {
      setSelectedTouristIds(tourists.map((t) => t.id));
    } else if (type === "danger_warning") {
      setSelectedTouristIds(tourists.filter((t) => t.status === "danger" || t.status === "warning").map((t) => t.id));
    } else if (type === "safe") {
      setSelectedTouristIds(tourists.filter((t) => t.status === "safe").map((t) => t.id));
    } else {
      setSelectedTouristIds([]);
    }
  };

  // Selected tourist objects for quick summaries
  const selectedTouristsList = tourists.filter((t) => selectedTouristIds.includes(t.id));

  // Batch Status Update Execution
  const handleExecuteBatchStatus = async () => {
    if (selectedTouristIds.length === 0) return;
    setIsUpdatingStatus(true);
    setStatusSuccessMessage(null);
    try {
      if (onBatchUpdateStatus) {
        await onBatchUpdateStatus(selectedTouristIds, targetStatus, statusReason);
      } else {
        await batchUpdateTouristsStatus(selectedTouristIds, targetStatus, statusReason);
      }
      setStatusSuccessMessage(`Mass status update applied: ${selectedTouristIds.length} personnel marked as "${targetStatus.toUpperCase()}".`);
      setTimeout(() => {
        setIsMassStatusModalOpen(false);
        setStatusSuccessMessage(null);
        setStatusReason("");
      }, 1300);
    } catch (err) {
      console.error("Batch status failed:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Batch Broadcast Alert Execution
  const handleExecuteBatchBroadcast = async () => {
    if (selectedTouristIds.length === 0 || !broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    setBroadcastSuccessMessage(null);
    try {
      const titleToUse = broadcastTitle.trim() || `DISPATCH BROADCAST: ${broadcastSeverity.toUpperCase()}`;
      if (onBatchBroadcastAlert) {
        await onBatchBroadcastAlert(selectedTouristIds, broadcastMessage, broadcastSeverity, titleToUse);
      } else {
        await batchBroadcastAlertToTourists(selectedTouristIds, broadcastMessage, broadcastSeverity, titleToUse);
      }
      setBroadcastSuccessMessage(`Broadcast alert dispatched to ${selectedTouristIds.length} field radio(s) and logged to dispatch.`);
      setTimeout(() => {
        setIsBroadcastModalOpen(false);
        setBroadcastSuccessMessage(null);
        setBroadcastMessage("");
        setBroadcastTitle("");
      }, 1300);
    } catch (err) {
      console.error("Batch broadcast failed:", err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleStartEdit = (person: Tourist) => {
    setSelectedPerson(person);
    setEditForm({
      ...person,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    setIsSaving(true);
    try {
      await onUpdatePerson(editForm as any);
      if (isFirebaseConnected) {
        await savePersonToFirestore(editForm as Tourist);
      }
      setIsEditing(false);
      setSelectedPerson((prev) => (prev ? { ...prev, ...editForm } as Tourist : null));
    } catch (err) {
      console.error("Failed to update person:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.phone) return;
    setIsSaving(true);
    try {
      await onRegisterPerson({
        ...regForm,
        age: Number(regForm.age) || 28,
      });
      // Reset form and switch to list
      setRegForm({
        name: "",
        phone: "",
        emergencyContact: "",
        bloodGroup: "O+ (Positive)",
        age: "28",
        gender: "Male",
        idProof: "",
        entryGate: "Bannari Amman Checkpost Gate #1",
        permitNumber: `STR-TRK-${Math.floor(1000 + Math.random() * 9000)}`,
        assignedRanger: "Forest Guard Murugan (Dhimbam Beat)",
        medicalNotes: "No chronic conditions. Standard wilderness gear.",
        notes: "Trekking permit authorized for Dhimbam-Hasanur range.",
      });
      setActiveTab("list");
    } catch (err) {
      console.error("Failed to register person:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const containerClasses = 
    mode === "embedded"
      ? "bg-slate-950 border border-white/20 shadow-xl flex flex-col h-[580px] w-full"
      : mode === "page"
      ? "bg-slate-950 border border-white/20 shadow-xl flex flex-col flex-1 w-full min-h-[700px]"
      : "bg-slate-950 border border-white/20 shadow-2xl flex flex-col h-[85vh] max-h-[850px] w-full";

  const directoryContent = (
    <div className={containerClasses}>
      {/* Top Header Bar */}
      <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">
                Personnel & Tourist Database
              </h2>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-700/50 text-[10px] font-mono font-bold px-2 py-0.5 uppercase tracking-widest flex items-center gap-1">
                <Database className="w-2.5 h-2.5" />
                Firestore Live
              </span>
              {mode === "embedded" && (
                <span className="bg-sky-950 text-sky-400 border border-sky-700/50 text-[10px] font-mono font-bold px-2 py-0.5 uppercase tracking-widest hidden sm:inline">
                  Above Map View
                </span>
              )}
              {mode === "page" && (
                <span className="bg-purple-950 text-purple-300 border border-purple-700/50 text-[10px] font-mono font-bold px-2 py-0.5 uppercase tracking-widest hidden sm:inline">
                  Full Database Page
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Demographic records, multi-person batch operations, broadcast alerts, and field medical profiles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-white/10 p-0.5 bg-slate-900">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "list" ? "bg-white text-black" : "text-slate-400 hover:text-white"
              }`}
            >
              All Persons ({tourists.length})
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "register" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Person
            </button>
          </div>

          {mode === "embedded" && onOpenFullPage && (
            <button
              onClick={onOpenFullPage}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-bold px-2.5 py-1.5 flex items-center gap-1.5 border border-emerald-400/40 uppercase tracking-wider transition-colors cursor-pointer"
              title="Open full page database tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Page</span>
            </button>
          )}

          {mode === "page" && onBackToMap && (
            <button
              onClick={onBackToMap}
              className="bg-white hover:bg-slate-200 text-slate-950 font-mono text-[11px] font-bold px-3 py-1.5 flex items-center gap-1.5 border border-white uppercase tracking-wider transition-colors cursor-pointer"
              title="Switch to Tactical Map & Dispatcher"
            >
              <Map className="w-3.5 h-3.5" />
              <span>Back to Map</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={mode === "embedded" ? "Collapse Database above map" : "Close"}
            >
              {mode === "embedded" ? <ChevronUp className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "list" && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Search, Selection Bar, Batch Bar, and Person List */}
          <div className="w-full md:w-5/12 border-r border-white/10 flex flex-col bg-slate-950/60">
            {/* Search Input */}
            <div className="p-3 border-b border-white/10 bg-slate-900/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search name, phone, blood group, permit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 text-xs text-white pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Master Checkbox & Quick Selection Presets */}
              <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] font-mono">
                <button
                  onClick={handleToggleSelectAllFiltered}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer select-none"
                  title="Toggle select all visible tourists"
                >
                  {areAllFilteredSelected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : isPartiallySelected ? (
                    <MinusSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="font-bold text-[10px] uppercase tracking-wider">
                    {areAllFilteredSelected 
                      ? `All Selected (${filteredTourists.length})` 
                      : `Select All (${filteredTourists.length})`}
                  </span>
                </button>

                {/* Quick Selection Filter Chips */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSelectByPreset("danger_warning")}
                    className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/40 hover:bg-amber-900/60 transition-colors cursor-pointer"
                    title="Select all tourists with Warning or Danger status"
                  >
                    Risk Only
                  </button>
                  <button
                    onClick={() => handleSelectByPreset("safe")}
                    className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60 transition-colors cursor-pointer"
                    title="Select all tourists marked Safe"
                  >
                    Safe
                  </button>
                  {selectedTouristIds.length > 0 && (
                    <button
                      onClick={() => handleSelectByPreset("clear")}
                      className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Clear selection"
                    >
                      Clear ({selectedTouristIds.length})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* DOCKED BATCH ACTIONS TOOLBAR: Rendered prominently when items are selected */}
            <AnimatePresence>
              {selectedTouristIds.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-900 border-b border-emerald-500/30 p-2.5 flex flex-wrap items-center justify-between gap-2 overflow-hidden shadow-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-black font-mono uppercase tracking-wider flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" />
                      {selectedTouristIds.length} Selected
                    </span>
                    <button
                      onClick={() => setRightViewMode(rightViewMode === "batch_roster" ? "profile" : "batch_roster")}
                      className={`px-2 py-1 text-[10px] font-mono border transition-colors cursor-pointer flex items-center gap-1 ${
                        rightViewMode === "batch_roster" 
                          ? "bg-white text-slate-950 border-white font-bold" 
                          : "bg-slate-800 text-slate-300 border-white/10 hover:text-white"
                      }`}
                    >
                      <ListFilter className="w-3 h-3" />
                      <span>{rightViewMode === "batch_roster" ? "Show Profile" : "View Matrix"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Send Broadcast Alert Button */}
                    <button
                      onClick={() => {
                        setBroadcastTitle(`BROADCAST TO ${selectedTouristIds.length} FIELD PERSONNEL`);
                        setBroadcastMessage("");
                        setIsBroadcastModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-[10px] font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                      title="Send urgent broadcast alert to selected personnel"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Broadcast Alert</span>
                    </button>

                    {/* Mass Status Update Button */}
                    <button
                      onClick={() => {
                        setStatusReason("");
                        setIsMassStatusModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-[10px] font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                      title="Mass update status for selected personnel"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Mass Status</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tourist List with Selection Checkbox on Each Row */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
              {filteredTourists.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No matching persons found in the database.
                </div>
              ) : (
                filteredTourists.map((person) => {
                  const isInspected = selectedPerson?.id === person.id;
                  const isChecked = selectedTouristIds.includes(person.id);
                  const statusColor = 
                    person.status === "danger" 
                      ? "border-red-500 bg-red-950/30 text-red-400" 
                      : person.status === "warning"
                      ? "border-amber-500 bg-amber-950/30 text-amber-400"
                      : "border-emerald-500 bg-emerald-950/30 text-emerald-400";

                  return (
                    <div
                      key={person.id}
                      onClick={() => {
                        setSelectedPerson(person);
                        setIsEditing(false);
                        onSelectTourist(person.id);
                      }}
                      className={`p-3 cursor-pointer transition-all flex items-start gap-3 ${
                        isChecked 
                          ? "bg-emerald-950/20 border-l-4 border-l-emerald-500" 
                          : isInspected 
                          ? "bg-white/10 border-l-4 border-l-slate-400" 
                          : "hover:bg-white/5 border-l-4 border-l-transparent"
                      }`}
                    >
                      {/* Checkbox dedicated button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelectTourist(person.id, e)}
                        className="mt-0.5 p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        title={isChecked ? "Deselect this person" : "Select this person for batch action"}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>

                      {/* Person Details Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs sm:text-sm truncate">
                                {person.name}
                              </span>
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 border shrink-0 ${statusColor}`}>
                                {person.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{person.phone}</span>
                            </div>
                          </div>
                          
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-white/10 shrink-0">
                            {person.bloodGroup ? person.bloodGroup.split(" ")[0] : "O+"}
                          </span>
                        </div>

                        <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between gap-2">
                          <span className="truncate text-slate-500">
                            {person.street || person.locality || "Dhimbam Range"}
                          </span>
                          <span className="text-sky-400 font-bold shrink-0">
                            Batt {person.battery}% • {person.heartRate} bpm
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Tabbed between "Selected Roster Matrix" OR "Detailed Person Profile" */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-900 flex flex-col scrollbar-thin">
            {/* Top View Toggle in Right Panel if Tourists are Selected */}
            {selectedTouristIds.length > 0 && (
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRightViewMode("batch_roster")}
                    className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      rightViewMode === "batch_roster"
                        ? "bg-emerald-500 text-slate-950 border-emerald-400"
                        : "bg-slate-800 text-slate-300 border-white/10 hover:text-white"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Selected Batch Roster ({selectedTouristIds.length})</span>
                  </button>

                  <button
                    onClick={() => setRightViewMode("profile")}
                    className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      rightViewMode === "profile"
                        ? "bg-emerald-500 text-slate-950 border-emerald-400"
                        : "bg-slate-800 text-slate-300 border-white/10 hover:text-white"
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Individual Profile ({selectedPerson?.name || "Inspect"})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setBroadcastTitle(`BROADCAST TO ${selectedTouristIds.length} FIELD PERSONNEL`);
                      setBroadcastMessage("");
                      setIsBroadcastModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                  >
                    <Radio className="w-3 h-3" />
                    <span>Alert ({selectedTouristIds.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      setStatusReason("");
                      setIsMassStatusModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>Update Status</span>
                  </button>
                </div>
              </div>
            )}

            {/* CONTENT MODE 1: Batch Comparative Roster Matrix */}
            {rightViewMode === "batch_roster" && selectedTouristIds.length > 0 ? (
              <div className="space-y-6">
                {/* Batch Metrics Header Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-white/10 p-3">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Selected</span>
                    <span className="text-xl font-black text-white font-mono">{selectedTouristIds.length}</span>
                  </div>
                  <div className="bg-slate-950 border border-white/10 p-3">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Risk Personnel</span>
                    <span className="text-xl font-black text-amber-400 font-mono">
                      {selectedTouristsList.filter((t) => t.status === "warning" || t.status === "danger").length}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-white/10 p-3">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Marked Safe</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      {selectedTouristsList.filter((t) => t.status === "safe").length}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-white/10 p-3">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Avg Battery</span>
                    <span className="text-xl font-black text-sky-400 font-mono">
                      {selectedTouristsList.length > 0 
                        ? Math.round(selectedTouristsList.reduce((acc, curr) => acc + (curr.battery || 0), 0) / selectedTouristsList.length)
                        : 0}%
                    </span>
                  </div>
                </div>

                {/* Batch Operations Bar */}
                <div className="bg-slate-950 border border-white/15 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                      Batch Operations Control
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Apply real-time telemetry changes and radio alerts to all {selectedTouristIds.length} selected personnel simultaneously.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setBroadcastTitle(`BROADCAST TO ${selectedTouristIds.length} FIELD PERSONNEL`);
                        setBroadcastMessage("");
                        setIsBroadcastModalOpen(true);
                      }}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-mono px-3 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Radio className="w-4 h-4" />
                      Send Broadcast Alert
                    </button>
                    <button
                      onClick={() => {
                        setStatusReason("");
                        setIsMassStatusModalOpen(true);
                      }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black font-mono px-3 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Mass Status Update
                    </button>
                  </div>
                </div>

                {/* Tabular List of Selected Personnel */}
                <div className="bg-slate-950 border border-white/10 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] text-slate-400 uppercase tracking-wider">
                        <th className="p-3">Tourist / ID</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Phone & Emergency</th>
                        <th className="p-3">Blood Group</th>
                        <th className="p-3">Vitals / Battery</th>
                        <th className="p-3">Location / Sector</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedTouristsList.map((t) => (
                        <tr key={t.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-white text-xs">{t.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{t.permitNumber || t.id}</div>
                          </td>
                          <td className="p-3">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 border ${
                              t.status === "danger" 
                                ? "bg-red-950 text-red-400 border-red-500" 
                                : t.status === "warning"
                                ? "bg-amber-950 text-amber-400 border-amber-500"
                                : "bg-emerald-950 text-emerald-400 border-emerald-500"
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="text-slate-300">{t.phone}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{t.emergencyContact || "STR Forest Station"}</div>
                          </td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-white/10 text-[10px]">
                              {t.bloodGroup || "O+ (Pos)"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="text-sky-400 font-bold">Batt {t.battery}%</div>
                            <div className="text-[10px] text-slate-400">HR {t.heartRate} bpm</div>
                          </td>
                          <td className="p-3 text-slate-400 truncate max-w-[160px]">
                            {t.street || t.locality || "Dhimbam Trail"}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedPerson(t);
                                  setRightViewMode("profile");
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] uppercase font-mono transition-colors cursor-pointer"
                                title="Inspect this profile"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleToggleSelectTourist(t.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                title="Remove from batch selection"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : selectedPerson ? (
              /* CONTENT MODE 2: Individual Person Profile */
              isEditing ? (
                /* Edit Form */
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Edit Person Data: {selectedPerson.name}
                    </h3>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-xs text-slate-400 hover:text-white uppercase font-mono cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-400 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Emergency Contact (Name & Phone)</label>
                      <input
                        type="text"
                        value={editForm.emergencyContact || ""}
                        onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Blood Group</label>
                      <select
                        value={editForm.bloodGroup || "O+ (Positive)"}
                        onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      >
                        <option>O+ (Positive)</option>
                        <option>O- (Negative)</option>
                        <option>A+ (Positive)</option>
                        <option>A- (Negative)</option>
                        <option>B+ (Positive)</option>
                        <option>B- (Negative)</option>
                        <option>AB+ (Positive)</option>
                        <option>AB- (Negative)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Assigned Beat Ranger</label>
                      <input
                        type="text"
                        value={editForm.assignedRanger || ""}
                        onChange={(e) => setEditForm({ ...editForm, assignedRanger: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Permit Number</label>
                      <input
                        type="text"
                        value={editForm.permitNumber || ""}
                        onChange={(e) => setEditForm({ ...editForm, permitNumber: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-slate-400 block mb-1">Medical Conditions & Allergies</label>
                      <textarea
                        rows={2}
                        value={editForm.medicalNotes || ""}
                        onChange={(e) => setEditForm({ ...editForm, medicalNotes: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-slate-400 block mb-1">Operational & Field Notes</label>
                      <textarea
                        rows={2}
                        value={editForm.notes || ""}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-2 text-white focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? "Saving to Firestore..." : "Save to Cloud Database"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Profile Details View */
                <div className="space-y-6">
                  {/* Top Identity Block */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/10">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black uppercase text-white tracking-wider">
                          {selectedPerson.name}
                        </h3>
                        <span className="text-xs font-mono font-black px-2 py-0.5 bg-slate-800 text-emerald-400 border border-emerald-500/30">
                          {selectedPerson.bloodGroup || "O+ (Pos)"}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                            selectedPerson.status === "danger"
                              ? "bg-red-950 border-red-500 text-red-400"
                              : selectedPerson.status === "warning"
                              ? "bg-amber-950 border-amber-500 text-amber-400"
                              : "bg-emerald-950 border-emerald-500 text-emerald-400"
                          }`}
                        >
                          Status: {selectedPerson.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        Permit: {selectedPerson.permitNumber || "STR-TRK-2026-0811"} • ID: {selectedPerson.id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Checkbox toggle inside profile */}
                      <button
                        onClick={() => handleToggleSelectTourist(selectedPerson.id)}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-colors cursor-pointer ${
                          selectedTouristIds.includes(selectedPerson.id)
                            ? "bg-emerald-950 border-emerald-500 text-emerald-400"
                            : "bg-slate-800 border-white/10 text-slate-300 hover:text-white"
                        }`}
                      >
                        {selectedTouristIds.includes(selectedPerson.id) ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>In Batch</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-slate-500" />
                            <span>Add to Batch</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleStartEdit(selectedPerson)}
                        className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-white border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Profile
                      </button>
                      <button
                        onClick={() => onFocusOnMap(selectedPerson.coordinates, selectedPerson.id)}
                        className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Locate on Map
                      </button>
                    </div>
                  </div>

                  {/* 4 Core Vital & Biometric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="bg-slate-950 border border-white/10 p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                        <Battery className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Tracker Battery</span>
                      </div>
                      <span className="text-xl font-black text-white">{selectedPerson.battery}%</span>
                      <span className="text-[10px] text-slate-500 block">SAR Transceiver</span>
                    </div>

                    <div className="bg-slate-950 border border-white/10 p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                        <Heart className="w-3.5 h-3.5 text-red-400" />
                        <span>Heart Rate</span>
                      </div>
                      <span className="text-xl font-black text-white">{selectedPerson.heartRate} <span className="text-xs font-normal text-slate-400">bpm</span></span>
                      <span className="text-[10px] text-slate-500 block">Telemetry Lock</span>
                    </div>

                    <div className="bg-slate-950 border border-white/10 p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                        <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Body Temp</span>
                      </div>
                      <span className="text-xl font-black text-white">{selectedPerson.temperature}°C</span>
                      <span className="text-[10px] text-slate-500 block">Normal Range</span>
                    </div>

                    <div className="bg-slate-950 border border-white/10 p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                        <Activity className="w-3.5 h-3.5 text-sky-400" />
                        <span>Active State</span>
                      </div>
                      <span className="text-base font-black uppercase text-sky-400">{selectedPerson.activity}</span>
                      <span className="text-[10px] text-slate-500 block">Altitude {selectedPerson.altitude}m</span>
                    </div>
                  </div>

                  {/* Demographic & Safety Dossier */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    {/* Emergency & Medical Safety Panel */}
                    <div className="bg-slate-950 border border-white/10 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider pb-2 border-b border-white/5">
                        <ShieldAlert className="w-4 h-4" />
                        Emergency & Medical Protocols
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Blood Group & Transfusion</span>
                        <span className="text-white font-bold text-sm text-emerald-400">
                          {selectedPerson.bloodGroup || "O+ (Positive)"}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Primary Emergency Contact</span>
                        <div className="flex items-center gap-1.5 text-white font-bold mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{selectedPerson.emergencyContact || "Sathyamangalam Forest Post (04295-240228)"}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Medical History & Allergies</span>
                        <p className="text-slate-300 mt-1 bg-slate-900 p-2 border border-white/5">
                          {selectedPerson.medicalNotes || "No recorded chronic conditions. Cleared for standard wilderness trails."}
                        </p>
                      </div>
                    </div>

                    {/* Park Administration & Checkpost Dossier */}
                    <div className="bg-slate-950 border border-white/10 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider pb-2 border-b border-white/5">
                        <Award className="w-4 h-4" />
                        Park Administration & Permit
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Age / Gender</span>
                          <span className="text-white">
                            {selectedPerson.age ? `${selectedPerson.age} yrs` : "30 yrs"} • {selectedPerson.gender || "Not Specified"}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Entry Checkpost</span>
                          <span className="text-white">
                            {selectedPerson.entryGate || "Bannari Amman Gate #1"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Assigned Beat Ranger</span>
                        <div className="flex items-center gap-1.5 text-white font-bold mt-0.5">
                          <Shield className="w-3 h-3 text-sky-400" />
                          <span>{selectedPerson.assignedRanger || "Duty Forest Guard (STR Command)"}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Verified Identity Document</span>
                        <span className="text-slate-300">
                          {selectedPerson.idProof || "Verified at Forest Checkpost"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Geolocation & Field Telemetry */}
                  <div className="bg-slate-950 border border-white/10 p-4 font-mono text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                      <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        Exact Geolocation & Coordinates
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        Last Signal: {new Date(selectedPerson.lastUpdate).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Street / Trail</span>
                        <span className="text-white font-bold">{selectedPerson.street || "Dhimbam 27th Hairpin Ghat Viewpoint"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Sector / Locality</span>
                        <span className="text-white font-bold">{selectedPerson.locality || "Sathyamangalam Tiger Reserve, Tamil Nadu"}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-slate-500 uppercase block">GPS Coordinates</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          {selectedPerson.coordinates[0].toFixed(5)}° N, {selectedPerson.coordinates[1].toFixed(5)}° E
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Notes */}
                  <div className="bg-slate-950 border border-white/10 p-4 font-mono text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-2">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      Field Notes & Dispatch Log
                    </div>
                    <p className="text-slate-300 bg-slate-900 p-3 border border-white/5">
                      {selectedPerson.notes || "Standard permit issued for photography and day-trekking along marked Dhimbam-Hasanur trail."}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
                <Users className="w-8 h-8 mb-2 opacity-40" />
                Select a person from the roster or select multiple to run batch operations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register New Person Tab */}
      {activeTab === "register" && (
        <form onSubmit={handleRegisterSubmit} className="flex-1 p-6 overflow-y-auto bg-slate-900 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="pb-4 border-b border-white/10">
              <h3 className="text-base font-black uppercase text-white tracking-wider flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Register New Park Entrant / Backcountry Hiker
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Records are instantly synchronized to Google Cloud Firestore with real-time biometric and location tracking.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vignesh Sundaram"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 94431 88722"
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Emergency Contact (Name & Phone) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brother (Sathyamangalam) +91 98421 11200"
                  value={regForm.emergencyContact}
                  onChange={(e) => setRegForm({ ...regForm, emergencyContact: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Blood Group</label>
                <select
                  value={regForm.bloodGroup}
                  onChange={(e) => setRegForm({ ...regForm, bloodGroup: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                >
                  <option>O+ (Positive)</option>
                  <option>O- (Negative)</option>
                  <option>A+ (Positive)</option>
                  <option>A- (Negative)</option>
                  <option>B+ (Positive)</option>
                  <option>B- (Negative)</option>
                  <option>AB+ (Positive)</option>
                  <option>AB- (Negative)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Age</label>
                <input
                  type="number"
                  value={regForm.age}
                  onChange={(e) => setRegForm({ ...regForm, age: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Gender</label>
                <select
                  value={regForm.gender}
                  onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other / Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Assigned Beat Forest Ranger</label>
                <input
                  type="text"
                  value={regForm.assignedRanger}
                  onChange={(e) => setRegForm({ ...regForm, assignedRanger: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">ID Proof Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Aadhaar / DL / Passport verified"
                  value={regForm.idProof}
                  onChange={(e) => setRegForm({ ...regForm, idProof: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Entry Checkpost Gate</label>
                <input
                  type="text"
                  value={regForm.entryGate}
                  onChange={(e) => setRegForm({ ...regForm, entryGate: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Permit Number</label>
                <input
                  type="text"
                  value={regForm.permitNumber}
                  onChange={(e) => setRegForm({ ...regForm, permitNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-slate-300 block mb-1">Medical Conditions / Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Asthma, hypertension, penicillin allergy, or None"
                  value={regForm.medicalNotes}
                  onChange={(e) => setRegForm({ ...regForm, medicalNotes: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-slate-300 block mb-1">Operational & Route Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Trekking from Bannari to Dhimbam 27 curves viewpoint with camera gear."
                  value={regForm.notes}
                  onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 text-white focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="px-4 py-2.5 text-xs text-slate-400 hover:text-white uppercase font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2.5 text-xs uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Syncing to Firestore..." : "Save Person to Database"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: SEND BROADCAST ALERT TO SELECTED TOURISTS       */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isBroadcastModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-slate-950 border border-amber-500/40 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 font-mono text-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/40 text-amber-400">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-wider">
                      Send Broadcast Alert
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Dispatches direct radio transmission & logs to tactical advisory feed.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recipient summary chips */}
              <div className="bg-slate-900 border border-white/10 p-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Target Recipients ({selectedTouristIds.length} Personnel Selected):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {selectedTouristsList.map((t) => (
                    <span 
                      key={t.id} 
                      className="px-2 py-0.5 bg-slate-950 text-slate-200 border border-white/10 text-[10px] flex items-center gap-1"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === "danger" ? "bg-red-500" : t.status === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      {t.name} ({t.phone})
                    </span>
                  ))}
                </div>
              </div>

              {/* Severity Pill Selector */}
              <div>
                <label className="text-slate-300 block mb-1 text-[11px] font-bold uppercase tracking-wider">
                  Alert Severity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastSeverity("advisory")}
                    className={`py-2 px-3 border text-center transition-all cursor-pointer ${
                      broadcastSeverity === "advisory"
                        ? "bg-sky-950 text-sky-300 border-sky-500 font-bold"
                        : "bg-slate-900 text-slate-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    Advisory (Info)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastSeverity("warning")}
                    className={`py-2 px-3 border text-center transition-all cursor-pointer ${
                      broadcastSeverity === "warning"
                        ? "bg-amber-950 text-amber-300 border-amber-500 font-bold"
                        : "bg-slate-900 text-slate-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    Warning (Hazard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastSeverity("danger")}
                    className={`py-2 px-3 border text-center transition-all cursor-pointer ${
                      broadcastSeverity === "danger"
                        ? "bg-red-950 text-red-300 border-red-500 font-bold"
                        : "bg-slate-900 text-slate-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    Critical (Urgent)
                  </button>
                </div>
              </div>

              {/* Rapid Presets */}
              <div>
                <span className="text-slate-400 block mb-1 text-[10px] uppercase font-bold">
                  Quick Dispatch Presets:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {BROADCAST_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBroadcastTitle(preset.title);
                        setBroadcastMessage(preset.message);
                        setBroadcastSeverity(preset.severity);
                      }}
                      className="text-left p-2 bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] text-slate-300 transition-colors cursor-pointer truncate"
                    >
                      <span className="font-bold text-white block truncate">{preset.title}</span>
                      <span className="text-slate-400 block truncate">{preset.message}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Broadcast Message Fields */}
              <div className="space-y-2">
                <div>
                  <label className="text-slate-300 block mb-1 text-[10px] uppercase">
                    Broadcast Title / Callout
                  </label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. SECTOR 4 ELEPHANT MOVEMENT WARNING"
                    className="w-full bg-slate-900 border border-white/10 p-2 text-white text-xs focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 text-[10px] uppercase">
                    Alert Message Body *
                  </label>
                  <textarea
                    rows={3}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Type broadcast message transmitted to field hand-radios and phone telemetry..."
                    className="w-full bg-slate-900 border border-white/10 p-2 text-white text-xs focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Feedback Alert */}
              {broadcastSuccessMessage && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{broadcastSuccessMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBroadcasting || !broadcastMessage.trim()}
                  onClick={handleExecuteBatchBroadcast}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isBroadcasting ? "Transmitting..." : `Transmit to ${selectedTouristIds.length} Personnel`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 2: MASS STATUS UPDATE FOR SELECTED TOURISTS         */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isMassStatusModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-slate-950 border border-emerald-500/40 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 font-mono text-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-wider">
                      Mass Status Update
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Instantly updates status and adds log override note in Firestore for all selected hikers.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMassStatusModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recipient summary chips */}
              <div className="bg-slate-900 border border-white/10 p-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Applying To ({selectedTouristIds.length} Personnel):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {selectedTouristsList.map((t) => (
                    <span 
                      key={t.id} 
                      className="px-2 py-0.5 bg-slate-950 text-slate-200 border border-white/10 text-[10px] flex items-center gap-1"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === "danger" ? "bg-red-500" : t.status === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      {t.name} (Current: {t.status})
                    </span>
                  ))}
                </div>
              </div>

              {/* Target Status Choice */}
              <div>
                <label className="text-slate-300 block mb-1 text-[11px] font-bold uppercase tracking-wider">
                  Set New Status To:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetStatus("safe")}
                    className={`py-3 px-3 border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      targetStatus === "safe"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500 font-bold"
                        : "bg-slate-900 text-slate-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Safe (Nominal)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus("warning")}
                    className={`py-3 px-3 border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      targetStatus === "warning"
                        ? "bg-amber-950 text-amber-300 border-amber-500 font-bold"
                        : "bg-slate-900 text-slate-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Warning (Risk)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus("danger")}
                    className={`py-3 px-3 border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      targetStatus === "danger"
                        ? "bg-red-950 text-red-300 border-red-500 font-bold"
                        : "bg-slate-900 text-slate-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <AlertOctagon className="w-4 h-4 text-red-400" />
                    <span>Danger (Critical)</span>
                  </button>
                </div>
              </div>

              {/* Status Reason Preset Suggestions */}
              <div>
                <span className="text-slate-400 block mb-1 text-[10px] uppercase font-bold">
                  Quick Reason Presets:
                </span>
                <div className="flex flex-wrap gap-1">
                  {STATUS_REASON_PRESETS.map((reason, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setStatusReason(reason)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] text-slate-300 transition-colors cursor-pointer text-left truncate max-w-full"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Reason Field */}
              <div>
                <label className="text-slate-300 block mb-1 text-[10px] uppercase">
                  Dispatcher Log Note / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Field check completed by Ranger Murugan; shelter confirmed."
                  className="w-full bg-slate-900 border border-white/10 p-2 text-white text-xs focus:border-emerald-500"
                />
              </div>

              {/* Feedback Message */}
              {statusSuccessMessage && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{statusSuccessMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsMassStatusModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={handleExecuteBatchStatus}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isUpdatingStatus ? "Applying Updates..." : `Apply to ${selectedTouristIds.length} Personnel`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  if (mode === "embedded" || mode === "page") {
    return directoryContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl max-h-[90vh] flex flex-col"
      >
        {directoryContent}
      </motion.div>
    </div>
  );
}
