import { useEffect, useRef, useState, useId } from "react";
import { Tourist, Geofence } from "../types";
import {
  ZoomIn,
  ZoomOut,
  Crosshair,
  Layers,
  Maximize2,
  Minimize2,
  Compass,
  MapPin,
  Mountain,
  Clock,
  Copy,
  Check,
  X,
} from "lucide-react";
import {
  getTouchLocationDetails,
  formatLiveTime,
  TouchLocationDetails,
} from "../services/locationDetails";

declare const L: any;

interface TouristMapWidgetProps {
  tourist: Tourist;
  geofences?: Geofence[];
  heightClass?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showDetails?: boolean;
  onUpdateTourist?: (tourist: Tourist) => void;
}

export default function TouristMapWidget({
  tourist,
  geofences = [],
  heightClass = "h-52",
  isExpanded = false,
  onToggleExpand,
  showDetails = true,
  onUpdateTourist,
}: TouristMapWidgetProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const fenceGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const touchInspectGroupRef = useRef<any>(null);
  const uniqueId = useId().replace(/:/g, "_");

  // Zoom control state
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [terrainMode, setTerrainMode] = useState<"topo" | "satellite" | "outdoor">("topo");
  const [isCentered, setIsCentered] = useState<boolean>(true);
  const [scaleDistance, setScaleDistance] = useState<string>("50m");

  // Real-time Touched Location Telemetry State (Timezone, Altitude, Lat, Lng, Coordinates)
  const [touchedPoint, setTouchedPoint] = useState<{
    details: TouchLocationDetails;
    distanceMeters: number;
    compass: string;
    bearingDeg: number;
  } | null>(null);
  const [liveTouchTime, setLiveTouchTime] = useState<{ time: string; date: string; shortZone: string } | null>(null);
  const [isCopiedCoords, setIsCopiedCoords] = useState(false);
  const [isResolvingTouch, setIsResolvingTouch] = useState(false);

  // Live ticking clock for touched location's time zone
  useEffect(() => {
    if (!touchedPoint) {
      setLiveTouchTime(null);
      return;
    }
    const updateTime = () => {
      const live = formatLiveTime(touchedPoint.details.timeZoneId);
      setLiveTouchTime(live);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [touchedPoint?.details.timeZoneId]);

  // Spherical distance and compass bearing helper
  const calculateDistanceAndBearing = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    const R = 6371000;
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLon = ((toLng - fromLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((fromLat * Math.PI) / 180) *
        Math.cos((toLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);

    const y = Math.sin(dLon) * Math.cos((toLat * Math.PI) / 180);
    const x =
      Math.cos((fromLat * Math.PI) / 180) * Math.sin((toLat * Math.PI) / 180) -
      Math.sin((fromLat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180) * Math.cos(dLon);
    const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const compass = directions[Math.round(brng / 45) % 8];

    return { distanceMeters, compass, bearingDeg: Math.round(brng) };
  };

  const rawCoords = tourist?.coordinates;
  const validCoords: [number, number] =
    Array.isArray(rawCoords) && rawCoords.length >= 2 && typeof rawCoords[0] === "number" && typeof rawCoords[1] === "number"
      ? [rawCoords[0], rawCoords[1]]
      : [11.6125, 77.1261];
  const lat = validCoords[0];
  const lng = validCoords[1];

  // Tile layer URLs
  const getTileLayer = (mode: "topo" | "satellite" | "outdoor") => {
    if (typeof L === "undefined") return null;
    if (mode === "satellite") {
      return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Esri World Imagery",
      });
    }
    if (mode === "outdoor") {
      return L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: "abc",
        attribution: "Google Maps",
      });
    }
    // Default: Esri World Topo Map (rich contour lines, relief shading, trail markers)
    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
      attribution: "Esri World Topo",
    });
  };

  // Calculate approximate scale distance for current zoom
  const updateScaleForZoom = (zoom: number) => {
    if (zoom >= 18) setScaleDistance("25m");
    else if (zoom === 17) setScaleDistance("50m");
    else if (zoom === 16) setScaleDistance("100m");
    else if (zoom === 15) setScaleDistance("200m");
    else if (zoom === 14) setScaleDistance("500m");
    else if (zoom === 13) setScaleDistance("1 km");
    else setScaleDistance("2 km");
  };

  // Initialize Map
  useEffect(() => {
    if (typeof L === "undefined" || !mapContainerRef.current) return;

    // Cleanup previous map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: zoomLevel,
      zoomControl: false, // We supply our dedicated rugged zoom overlay
      attributionControl: false,
    });

    const tileLayer = getTileLayer(terrainMode);
    if (tileLayer) {
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;
    }

    fenceGroupRef.current = L.layerGroup().addTo(map);

    // Create Tourist Pulse Marker
    const isDanger = tourist.status === "danger";
    const isWarning = tourist.status === "warning";
    const pinColor = isDanger ? "#ef4444" : isWarning ? "#f59e0b" : "#10b981";

    const customIcon = L.divIcon({
      className: "tourist-radar-marker",
      html: `
        <div class="relative flex items-center justify-center w-10 h-10">
          ${
            isDanger
              ? `
                <div class="sos-status-beacon" style="width: 48px; height: 48px;"></div>
                <div class="sos-sonar-wave-primary" style="width: 40px; height: 40px;"></div>
                <div class="sos-sonar-wave-secondary" style="width: 40px; height: 40px;"></div>
              `
              : `
                <span class="absolute w-8 h-8 rounded-full bg-emerald-500/40 animate-ping"></span>
                <span class="absolute w-5 h-5 rounded-full bg-emerald-500/60"></span>
              `
          }
          <span class="relative w-4 h-4 rounded-full ${isDanger ? 'bg-red-500 sos-distress-marker-pin' : 'bg-emerald-400'} border-2 border-white shadow-md flex items-center justify-center z-20">
            <span class="w-1.5 h-1.5 rounded-full ${isDanger ? 'bg-white animate-ping' : 'bg-black'}"></span>
          </span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    // Accuracy / Position Uncertainty Ring (30m GPS lock)
    const accuracyCircle = L.circle([lat, lng], {
      radius: 35,
      color: pinColor,
      weight: 1,
      fillColor: pinColor,
      fillOpacity: 0.12,
      dashArray: "3, 3",
    }).addTo(map);
    accuracyCircleRef.current = accuracyCircle;

    // Track user pan/zoom events to sync zoom level state
    map.on("zoomend", () => {
      const z = map.getZoom();
      setZoomLevel(z);
      updateScaleForZoom(z);
    });

    map.on("dragstart", () => {
      setIsCentered(false);
    });

    // Touch/click layer for interactive inspection
    const touchGroup = L.layerGroup().addTo(map);
    touchInspectGroupRef.current = touchGroup;

    // Interactive map touch: calculate altitude, time zone, lat, lng, and coordinates
    map.on("click", async (e: any) => {
      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;

      touchGroup.clearLayers();

      const touchIcon = L.divIcon({
        className: "custom-touch-widget-marker",
        html: `
          <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; border: 2px solid #38bdf8; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.85;"></div>
            <div style="position: absolute; inset: 3px; border: 1.5px dashed #0284c7; border-radius: 50%;"></div>
            <div style="width: 8px; height: 8px; margin: auto; background: #38bdf8; border: 1.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #38bdf8;"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([clickLat, clickLng], { icon: touchIcon }).addTo(touchGroup);

      setIsResolvingTouch(true);
      try {
        const details = await getTouchLocationDetails(clickLat, clickLng);
        const { distanceMeters, compass, bearingDeg } = calculateDistanceAndBearing(lat, lng, clickLat, clickLng);
        setTouchedPoint({
          details,
          distanceMeters,
          compass,
          bearingDeg,
        });
      } finally {
        setIsResolvingTouch(false);
      }
    });

    mapInstanceRef.current = map;

    // Invalidate size in next ticks to avoid tile rendering cutoffs in flex and slide containers
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    const t2 = setTimeout(() => {
      map.invalidateSize();
    }, 320);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [terrainMode]);

  // Update position when tourist coordinates change (e.g. from D-Pad walking)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([lat, lng]);
    }

    // If currently centered on hiker, smooth-pan to updated coordinates
    if (isCentered) {
      mapInstanceRef.current.panTo([lat, lng], {
        animate: true,
        duration: 0.4,
      });
    }
  }, [lat, lng, isCentered]);

  // Render Geofences
  useEffect(() => {
    if (!mapInstanceRef.current || !fenceGroupRef.current || typeof L === "undefined") return;

    fenceGroupRef.current.clearLayers();
    const safeFences = Array.isArray(geofences) ? geofences : [];

    safeFences.forEach((fence) => {
      if (!fence || !fence.coordinates || !Array.isArray(fence.coordinates) || fence.coordinates.length < 2) return;
      const isCritical = fence.severity === "critical";
      const color = isCritical ? "#ef4444" : "#f59e0b";

      const circle = L.circle(fence.coordinates, {
        color: color,
        fillColor: color,
        fillOpacity: 0.18,
        radius: fence.radius,
        weight: 1.5,
        dashArray: "4, 4",
      });

      circle.bindTooltip(`⚠️ ${fence.name} (${fence.radius}m)`, {
        permanent: false,
        direction: "top",
        className: "bg-black text-[10px] text-white font-mono px-1 py-0.5 border border-white/20",
      });

      fenceGroupRef.current.addLayer(circle);
    });
  }, [geofences]);

  // Invalidate map size when expanded state toggles
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, heightClass]);

  // Zoom Control Handlers
  const handleZoomIn = () => {
    if (!mapInstanceRef.current) return;
    const currentZ = mapInstanceRef.current.getZoom();
    const maxZ = terrainMode === "topo" ? 18 : 19;
    if (currentZ < maxZ) {
      const newZ = Math.min(maxZ, currentZ + 1);
      mapInstanceRef.current.setZoom(newZ);
      setZoomLevel(newZ);
      updateScaleForZoom(newZ);
    }
  };

  const handleZoomOut = () => {
    if (!mapInstanceRef.current) return;
    const currentZ = mapInstanceRef.current.getZoom();
    if (currentZ > 10) {
      const newZ = Math.max(10, currentZ - 1);
      mapInstanceRef.current.setZoom(newZ);
      setZoomLevel(newZ);
      updateScaleForZoom(newZ);
    }
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([lat, lng], zoomLevel, { animate: true });
    setIsCentered(true);
  };

  const handleSetSpecificZoom = (targetZoom: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([lat, lng], targetZoom, { animate: true });
    setZoomLevel(targetZoom);
    updateScaleForZoom(targetZoom);
    setIsCentered(true);
  };

  // Zoom descriptor label
  const getZoomDescriptor = (z: number) => {
    if (z >= 18) return "Ridge / Micro Terrain";
    if (z >= 17) return "Trail Detail";
    if (z >= 16) return "Close Terrain";
    if (z >= 15) return "Contour Slopes";
    if (z >= 14) return "Valley Sector";
    return "Regional Area";
  };

  if (!tourist) {
    return (
      <div
        id={`tourist-map-widget-empty-${uniqueId}`}
        className={`w-full ${heightClass} bg-black border border-white/10 flex items-center justify-center font-mono text-xs text-white/40`}
      >
        Syncing satellite terrain radar...
      </div>
    );
  }

  return (
    <div
      id={`tourist-map-widget-${uniqueId}`}
      className="relative w-full bg-black border border-white/10 overflow-hidden font-mono select-none"
    >
      {/* Top Header Bar of Map Widget */}
      <div className="bg-black/90 px-2.5 py-1.5 border-b border-white/10 flex items-center justify-between z-10 relative text-[10px]">
        <div className="flex items-center gap-1.5">
          <Mountain className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-black text-white uppercase tracking-wider text-[9px]">
            Terrain Radar Widget
          </span>
          <span className="text-[8px] bg-sky-950 text-sky-300 border border-sky-800 px-1 py-0.2 font-bold uppercase">
            {terrainMode.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer Cycle Button */}
          <button
            onClick={() =>
              setTerrainMode((m) =>
                m === "topo" ? "satellite" : m === "satellite" ? "outdoor" : "topo"
              )
            }
            title="Cycle Map Layer (Topo / Satellite / Outdoor)"
            className="text-[9px] text-white/60 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 px-1.5 py-0.5 cursor-pointer uppercase font-bold"
          >
            <Layers className="w-2.5 h-2.5 text-sky-400" />
            <span className="hidden sm:inline">Layer</span>
          </button>

          {/* Expand / Minimize Toggle if provided */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              title={isExpanded ? "Collapse Map" : "Expand Map"}
              className="text-white/60 hover:text-white p-0.5 cursor-pointer"
            >
              {isExpanded ? (
                <Minimize2 className="w-3 h-3 text-white/80" />
              ) : (
                <Maximize2 className="w-3 h-3 text-white/80" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Map Canvas Container */}
      <div
        ref={mapContainerRef}
        className={`w-full ${heightClass} z-0 relative bg-slate-950`}
        style={{ minHeight: isExpanded ? "340px" : "180px" }}
      />

      {/* ========================================================= */}
      {/* RUGGED ZOOM CONTROL OVERLAY (TOP-RIGHT / MILITARY HUD)   */}
      {/* ========================================================= */}
      <div
        id="tourist-map-zoom-control-overlay"
        className="absolute top-8 right-2 z-20 flex flex-col items-center bg-black/85 backdrop-blur-sm border border-white/20 p-1 shadow-2xl rounded-none"
      >
        {/* Zoom In Button */}
        <button
          id="tourist-map-zoom-in-btn"
          onClick={handleZoomIn}
          title="Zoom In Closer to Terrain"
          className="w-7 h-7 bg-white/10 hover:bg-sky-600 active:bg-sky-500 text-white flex items-center justify-center cursor-pointer border border-white/15 transition-colors focus:outline-none"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Current Zoom Readout Badge */}
        <div
          title={`Zoom Level ${zoomLevel}: ${getZoomDescriptor(zoomLevel)}`}
          className="py-1 px-0.5 w-full text-center flex flex-col items-center justify-center border-y border-white/10 my-0.5"
        >
          <span className="text-[10px] font-black text-sky-400 leading-none">{zoomLevel}x</span>
          <span className="text-[7px] text-white/40 font-bold uppercase tracking-tighter scale-90">
            ZOOM
          </span>
        </div>

        {/* Zoom Out Button */}
        <button
          id="tourist-map-zoom-out-btn"
          onClick={handleZoomOut}
          title="Zoom Out Regional Terrain"
          className="w-7 h-7 bg-white/10 hover:bg-sky-600 active:bg-sky-500 text-white flex items-center justify-center cursor-pointer border border-white/15 transition-colors focus:outline-none"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Recenter / GPS Lock Button */}
        <button
          id="tourist-map-recenter-btn"
          onClick={handleRecenter}
          title={isCentered ? "Target Locked on Hiker" : "Re-center on Hiker Coordinates"}
          className={`w-7 h-7 mt-1.5 flex items-center justify-center cursor-pointer border transition-colors focus:outline-none ${
            isCentered
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
              : "bg-white/10 hover:bg-amber-500/20 border-white/15 text-white/60 hover:text-amber-400"
          }`}
        >
          <Crosshair className={`w-3.5 h-3.5 ${isCentered ? "" : "animate-pulse"}`} />
        </button>
      </div>

      {/* QUICK PRESET ZOOM CHIPS OVERLAY (BOTTOM-LEFT) */}
      <div
        id="tourist-map-zoom-presets"
        className="absolute bottom-2 left-2 z-20 flex flex-wrap items-center gap-1 bg-black/85 backdrop-blur-sm border border-white/15 px-1.5 py-1 text-[8px]"
      >
        <span className="text-white/40 font-bold uppercase tracking-wider mr-0.5 hidden sm:inline">
          View:
        </span>
        <button
          onClick={() => handleSetSpecificZoom(14)}
          className={`px-1 py-0.5 border cursor-pointer uppercase font-bold ${
            zoomLevel === 14
              ? "bg-sky-500 text-black border-sky-400"
              : "bg-white/5 border-white/10 text-white/60 hover:text-white"
          }`}
          title="Zoom 14: Valley Sector (500m scale)"
        >
          Valley
        </button>
        <button
          onClick={() => handleSetSpecificZoom(16)}
          className={`px-1 py-0.5 border cursor-pointer uppercase font-bold ${
            zoomLevel === 16
              ? "bg-sky-500 text-black border-sky-400"
              : "bg-white/5 border-white/10 text-white/60 hover:text-white"
          }`}
          title="Zoom 16: Trail Detail (100m scale)"
        >
          Trail
        </button>
        <button
          onClick={() => handleSetSpecificZoom(18)}
          className={`px-1 py-0.5 border cursor-pointer uppercase font-bold ${
            zoomLevel >= 18
              ? "bg-sky-500 text-black border-sky-400"
              : "bg-white/5 border-white/10 text-white/60 hover:text-white"
          }`}
          title="Zoom 18: Close Ridge / Micro Terrain (25m scale)"
        >
          Close
        </button>

        {/* Dynamic Scale Indicator */}
        <span className="text-emerald-400 font-bold border-l border-white/15 pl-1.5 ml-0.5">
          ~{scaleDistance}
        </span>
      </div>

      {/* Live Coordinates and Street HUD Pill (Top-Left) */}
      <div className="absolute top-8 left-2 z-20 pointer-events-none bg-black/80 backdrop-blur-sm border border-white/15 px-2 py-1 max-w-[190px] text-[8px] text-white leading-tight">
        <div className="flex items-center gap-1 text-sky-400 font-black">
          <MapPin className="w-2.5 h-2.5" />
          <span className="truncate">{tourist.street || "Mist Trail Ravine"}</span>
        </div>
        <div className="text-white/60 font-mono mt-0.5 text-[7px]">
          {lat.toFixed(4)}°N, {lng.toFixed(4)}°W • {tourist.altitude}m
        </div>
      </div>

      {/* Crosshair Target Center Mark (Pure optical HUD overlay) */}
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-25">
        <div className="w-8 h-8 border border-dashed border-white/40 rounded-full flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-white/60 rounded-full"></div>
        </div>
      </div>

      {/* Real-Time Touched Location Telemetry Card */}
      {touchedPoint && (
        <div
          id="tourist-touch-telemetry-hud"
          className="absolute inset-x-1 bottom-1 z-30 bg-black/95 backdrop-blur-md border border-sky-500/70 p-2 font-mono text-white text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="flex items-center justify-between border-b border-white/15 pb-1 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span className="text-[9px] font-black uppercase tracking-wider text-sky-400">
                TOUCHED COORDINATES TELEMETRY
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${touchedPoint.details.lat.toFixed(6)}, ${touchedPoint.details.lng.toFixed(6)}`);
                  setIsCopiedCoords(true);
                  setTimeout(() => setIsCopiedCoords(false), 1500);
                }}
                className="text-[8px] bg-white/10 hover:bg-sky-600 border border-white/20 px-1.5 py-0.5 text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Copy Coordinates"
              >
                {isCopiedCoords ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5 text-sky-400" />}
                <span>{isCopiedCoords ? "COPIED" : "COPY"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTouchedPoint(null);
                  touchInspectGroupRef.current?.clearLayers();
                }}
                className="text-white/50 hover:text-white p-0.5 cursor-pointer"
                title="Close"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[9px] mb-1.5">
            {/* Real-time Time Zone & Clock */}
            <div className="bg-sky-950/60 border border-sky-800/60 p-1.5">
              <div className="text-[7.5px] font-bold text-sky-300 uppercase flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-sky-400 animate-pulse" />
                <span>Real-Time Time Zone</span>
              </div>
              <div className="text-xs font-black text-amber-300 mt-0.5 font-mono">
                {liveTouchTime?.time || touchedPoint.details.localTime}
              </div>
              <div className="text-[7.5px] text-sky-200/90 truncate mt-0.5">
                {touchedPoint.details.timeZoneName} ({touchedPoint.details.utcOffset})
              </div>
            </div>

            {/* Altitude / Elevation */}
            <div className="bg-emerald-950/60 border border-emerald-800/60 p-1.5">
              <div className="text-[7.5px] font-bold text-emerald-300 uppercase flex items-center gap-1">
                <Mountain className="w-2.5 h-2.5 text-emerald-400" />
                <span>Altitude (Elevation)</span>
              </div>
              <div className="text-xs font-black text-emerald-400 mt-0.5 font-mono">
                {(touchedPoint.details.altitudeMeters ?? 0).toLocaleString()} m
                <span className="text-[8px] text-emerald-200/70 font-normal ml-1">
                  ({(touchedPoint.details.altitudeFeet ?? 0).toLocaleString()} ft)
                </span>
              </div>
              <div className="text-[7.5px] text-emerald-400/60 truncate mt-0.5">
                {touchedPoint.details.altitudeSource || "Elevation Model"}
              </div>
            </div>
          </div>

          {/* Latitude, Longitude & Coordinates */}
          <div className="bg-black/60 border border-white/10 p-1.5 text-[8.5px] flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-white font-mono">
                <span className="text-white/40 uppercase font-bold">LAT: </span>
                <strong className="text-white">{touchedPoint.details.formattedLat}</strong>
                <span className="text-white/40 uppercase font-bold ml-2">LNG: </span>
                <strong className="text-white">{touchedPoint.details.formattedLng}</strong>
              </div>
              <div className="text-[7.5px] text-sky-300 font-mono">
                COORDS: {touchedPoint.details.coordinatesString} • {touchedPoint.distanceMeters}m {touchedPoint.compass} ({touchedPoint.bearingDeg}°)
              </div>
            </div>

            {onUpdateTourist && (
              <button
                type="button"
                onClick={() => {
                  onUpdateTourist({
                    ...tourist,
                    coordinates: [touchedPoint.details.lat, touchedPoint.details.lng],
                    altitude: touchedPoint.details.altitudeMeters,
                    lastUpdate: new Date().toISOString(),
                  });
                  setTouchedPoint(null);
                  touchInspectGroupRef.current?.clearLayers();
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-black font-black text-[8px] uppercase px-2 py-1 shrink-0 ml-2 cursor-pointer transition-colors"
                title="Move your avatar to this touched location"
              >
                Walk Here
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resolving indicator spinner */}
      {isResolvingTouch && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-black/90 border border-sky-400 px-2 py-1 flex items-center gap-1.5 text-[8px] text-sky-300 font-mono shadow-xl">
          <span className="animate-spin text-[10px]">🌐</span>
          <span>Acquiring Time Zone & Altitude...</span>
        </div>
      )}

      {/* Optional Details Footer Bar */}
      {showDetails && (
        <div className="bg-black/95 px-2.5 py-1.5 border-t border-white/10 flex items-center justify-between text-[8px] text-white/50 z-10 relative">
          <span className="flex items-center gap-1 text-white/70">
            <Compass className="w-2.5 h-2.5 text-sky-400" />
            Mode: <strong className="text-white">{getZoomDescriptor(zoomLevel)}</strong>
          </span>
          <span className="text-white/40">
            GPS: <strong className="text-emerald-400 font-bold">LOCK 3D (35m)</strong>
          </span>
        </div>
      )}
    </div>
  );
}
