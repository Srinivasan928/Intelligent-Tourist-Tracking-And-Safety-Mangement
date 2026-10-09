import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Satellite,
  Map as MapIcon,
  Crosshair,
  ZoomOut,
  Navigation,
  ExternalLink,
  Search,
  Globe,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Eye,
  SlidersHorizontal,
  X,
  AlertTriangle,
  ShieldAlert,
  Box,
  RotateCw,
  RotateCcw,
  MapPin,
  Orbit,
  Clock,
  Mountain,
  Copy,
  Move,
  GripHorizontal
} from "lucide-react";
import { Tourist, Geofence } from "../types";
import {
  reverseGeocodeWithGoogleMaps,
  forwardGeocodeWithGoogleMaps,
  getGoogleMapsUrl,
  getGoogleStreetViewUrl,
  GeocodeResult
} from "../services/googleMaps";
import {
  getTouchLocationDetails,
  getSyncTouchLocationDetails,
  formatLiveTime,
  TouchLocationDetails
} from "../services/locationDetails";

interface InteractiveMapProps {
  tourists: Tourist[];
  geofences: Geofence[];
  selectedTouristId?: string | null;
  focusCoordinates?: [number, number] | null;
  focusTriggerKey?: number;
  onSelectTourist?: (id: string | null) => void;
  onUpdateTourist?: (tourist: Tourist) => void;
}

// Declare Leaflet global object
declare const L: any;

type MapLayerMode = "google-streets" | "google-hybrid" | "google-terrain" | "3d-relief" | "tactical-dark";

interface MapLayerOption {
  id: MapLayerMode;
  name: string;
  badge: string;
  icon: string;
  description: string;
  previewUrl: string;
}

const MAP_LAYER_OPTIONS: MapLayerOption[] = [
  {
    id: "google-streets",
    name: "Streets",
    badge: "Roadmap",
    icon: "🗺️",
    description: "Roads, trail names & routes",
    previewUrl: "https://mt1.google.com/vt/lyrs=m&x=1376&y=3173&z=13",
  },
  {
    id: "google-hybrid",
    name: "Hybrid",
    badge: "Satellite",
    icon: "🛰️",
    description: "High-res aerial photography",
    previewUrl: "https://mt1.google.com/vt/lyrs=y&x=1376&y=3173&z=13",
  },
  {
    id: "google-terrain",
    name: "Terrain",
    badge: "Topographic",
    icon: "⛰️",
    description: "Contour elevation relief",
    previewUrl: "https://mt1.google.com/vt/lyrs=p&x=1376&y=3173&z=13",
  },
  {
    id: "3d-relief",
    name: "3D Relief",
    badge: "Elevation",
    icon: "🏔️",
    description: "Topographic elevation 3D relief with contour shading",
    previewUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/13/3173/1374",
  },
  {
    id: "tactical-dark",
    name: "Dark",
    badge: "Tactical",
    icon: "🌑",
    description: "High-contrast night vision",
    previewUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/13/3173/1374",
  },
];

export default function InteractiveMap({
  tourists,
  geofences,
  selectedTouristId,
  focusCoordinates,
  focusTriggerKey,
  onSelectTourist,
  onUpdateTourist,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const rootContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markerGroupRef = useRef<any>(null);
  const fenceGroupRef = useRef<any>(null);
  const clickInspectGroupRef = useRef<any>(null);
  const markersMapRef = useRef<Map<string, any>>(new Map());

  // Mutable refs for click handlers and callbacks
  const touristsRef = useRef(tourists);
  touristsRef.current = tourists;
  const selectedTouristIdRef = useRef(selectedTouristId);
  selectedTouristIdRef.current = selectedTouristId;
  const onUpdateTouristRef = useRef(onUpdateTourist);
  onUpdateTouristRef.current = onUpdateTourist;

  const [layerMode, setLayerMode] = useState<MapLayerMode>("google-streets");
  const [isPullOutOpen, setIsPullOutOpen] = useState(true);
  const [isFlying, setIsFlying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 3D View Mode State
  const [is3DMode, setIs3DMode] = useState(false);
  const [pitch, setPitch] = useState(55); // 0 - 75 degrees tilt
  const [bearing, setBearing] = useState(25); // 0 - 360 degrees rotation
  const [isOrbiting, setIsOrbiting] = useState(false);

  // Location Interaction State (relocate person according to map interaction)
  const [isRelocateMode, setIsRelocateMode] = useState(false);
  const isRelocateModeRef = useRef(isRelocateMode);
  isRelocateModeRef.current = isRelocateMode;

  const [relocateFeedback, setRelocateFeedback] = useState<{
    name: string;
    street: string;
    coordinates: [number, number];
  } | null>(null);

  const [activeTargetInfo, setActiveTargetInfo] = useState<{
    id: string;
    name: string;
    coordinates: [number, number];
    status: string;
    altitude: number;
    street?: string;
    country?: string;
  } | null>(null);

  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);

  // Real-time Touched Location Telemetry (Altitude, Time Zone, Lat, Lng, Coordinates)
  const [touchedLocation, setTouchedLocation] = useState<TouchLocationDetails | null>(null);
  const [liveTouchTime, setLiveTouchTime] = useState<{ time: string; date: string; shortZone: string } | null>(null);
  const [isCopiedCoords, setIsCopiedCoords] = useState(false);
  const [relocateTouristId, setRelocateTouristId] = useState<string>("");
  const [hudPositionCorner, setHudPositionCorner] = useState<"top-right" | "top-left" | "bottom-right" | "bottom-left">("top-right");

  const cycleHudPosition = () => {
    setHudPositionCorner((prev) => {
      switch (prev) {
        case "top-right":
          return "bottom-right";
        case "bottom-right":
          return "bottom-left";
        case "bottom-left":
          return "top-left";
        case "top-left":
        default:
          return "top-right";
      }
    });
  };

  // Real-time ticking clock for touched location's time zone
  useEffect(() => {
    if (!touchedLocation) {
      setLiveTouchTime(null);
      return;
    }

    const tick = () => {
      const live = formatLiveTime(touchedLocation.timeZoneId);
      setLiveTouchTime(live);
      const popupTimeEl = document.getElementById("leaflet-popup-live-time");
      if (popupTimeEl) {
        popupTimeEl.textContent = live.time;
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [touchedLocation]);

  const prevFocusKeyRef = useRef<number | undefined>(undefined);
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined);

  // Execute location update for a tourist when interacted on the map
  const performRelocation = async (touristId: string, lat: number, lng: number) => {
    const list = touristsRef.current;
    const targetTourist = list.find((t) => t.id === touristId) || list[0];
    if (!targetTourist) return;

    // High precision reverse geocode according to Google Maps
    const geo = await reverseGeocodeWithGoogleMaps(lat, lng);
    const updatedTourist: Tourist = {
      ...targetTourist,
      coordinates: [lat, lng],
      street: geo.street,
      country: geo.country,
      locality: geo.locality,
      formattedAddress: geo.formattedAddress,
      lastUpdate: new Date().toISOString(),
    };

    onUpdateTouristRef.current?.(updatedTourist);

    setRelocateFeedback({
      name: targetTourist.name,
      street: geo.street || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      coordinates: [lat, lng],
    });

    clickInspectGroupRef.current?.clearLayers();
    setTimeout(() => {
      setRelocateFeedback(null);
    }, 4500);
  };

  // Register global window helper so Leaflet popups can invoke relocation and copy directly
  useEffect(() => {
    (window as any).__tourguard_relocate_tourist = (touristId: string, lat: number, lng: number) => {
      performRelocation(touristId, lat, lng);
    };
    (window as any).__tourguard_copy_coords = (coordsText: string, btnElement?: HTMLElement) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(coordsText);
      }
      if (btnElement) {
        const orig = btnElement.innerText;
        btnElement.innerText = "COPIED!";
        btnElement.classList.add("bg-emerald-600");
        setTimeout(() => {
          btnElement.innerText = orig;
          btnElement.classList.remove("bg-emerald-600");
        }, 1500);
      }
    };
    return () => {
      delete (window as any).__tourguard_relocate_tourist;
      delete (window as any).__tourguard_copy_coords;
    };
  }, []);

  // 3D Cinematic Auto-Orbit animation loop
  useEffect(() => {
    if (!is3DMode || !isOrbiting) return;
    let animFrame: number;
    let lastTime = performance.now();

    const orbitLoop = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      setBearing((prev) => (prev + delta * 9) % 360);
      animFrame = requestAnimationFrame(orbitLoop);
    };

    animFrame = requestAnimationFrame(orbitLoop);
    return () => cancelAnimationFrame(animFrame);
  }, [is3DMode, isOrbiting]);

  // Initialize the Leaflet map
  useEffect(() => {
    if (typeof L === "undefined" || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center of Dhimbam Forest Range & Sathyamangalam Tiger Reserve (SAR initial overview)
      const map = L.map(mapContainerRef.current, {
        center: [11.6150, 77.1250],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      markerGroupRef.current = L.layerGroup().addTo(map);
      fenceGroupRef.current = L.layerGroup().addTo(map);
      clickInspectGroupRef.current = L.layerGroup().addTo(map);

      // Interactive touch/click to inspect real-time Time Zone, Altitude, Latitude, Longitude, and Coordinates
      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;

        // Fast Relocate Mode: Clicking anywhere directly relocates the active person
        if (isRelocateModeRef.current) {
          const targetId = selectedTouristIdRef.current || touristsRef.current[0]?.id;
          if (targetId) {
            performRelocation(targetId, lat, lng);
            return;
          }
        }

        clickInspectGroupRef.current.clearLayers();

        // Pulsating inspection radar marker at the exact touched coordinates
        const touchRadarIcon = L.divIcon({
          className: "tactical-touch-sonar-marker",
          html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; items-center; justify-content: center;">
              <div style="position: absolute; inset: 0; border: 2px solid #38bdf8; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.85;"></div>
              <div style="position: absolute; inset: 4px; border: 1.5px dashed #0284c7; border-radius: 50%;"></div>
              <div style="width: 10px; height: 10px; margin: auto; background: #38bdf8; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px #38bdf8;"></div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker([lat, lng], { icon: touchRadarIcon }).addTo(clickInspectGroupRef.current);

        // Immediately populate single box telemetry state with computed coordinates, altitude & live timezone
        const initialDetails = getSyncTouchLocationDetails(lat, lng);
        setTouchedLocation({
          ...initialDetails,
          street: "Locating on Google Maps...",
          locality: "",
          country: "",
          formattedAddress: "",
        });

        // Query real-time Google Maps reverse geocoding
        try {
          const [geo, locDetails] = await Promise.all([
            reverseGeocodeWithGoogleMaps(lat, lng),
            getTouchLocationDetails(lat, lng),
          ]);

          setTouchedLocation({
            ...locDetails,
            street: geo.street || geo.formattedAddress || "Google Maps Location",
            locality: geo.locality,
            country: geo.country,
            formattedAddress: geo.formattedAddress,
          });
        } catch (err) {
          console.error("Geocoding fetch error:", err);
          setTouchedLocation((prev) =>
            prev ? { ...prev, street: "Location Point" } : null
          );
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update base tile layer based on layerMode
  useEffect(() => {
    if (!mapInstanceRef.current || typeof L === "undefined") return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    let tileUrl = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
    let attribution = '&copy; <a href="https://maps.google.com">Google Maps</a>';
    let maxZoom = 20;

    switch (layerMode) {
      case "google-streets":
        tileUrl = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
        attribution = 'Map data &copy; Google Maps Platform (Streets & Roads)';
        break;
      case "google-hybrid":
        tileUrl = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
        attribution = 'Imagery &copy; Google Maps Platform (Satellite & Streets)';
        break;
      case "google-terrain":
        tileUrl = "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}";
        attribution = 'Terrain &copy; Google Maps Platform';
        break;
      case "3d-relief": {
        tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}";
        attribution = '3D Relief &copy; Esri, USGS, NOAA';
        maxZoom = 18;
        break;
      }
      case "tactical-dark": {
        const darkBase = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
          }
        );
        const darkLabels = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
          }
        );
        const darkGroup = L.layerGroup([darkBase, darkLabels]);
        tileLayerRef.current = darkGroup;
        darkGroup.addTo(mapInstanceRef.current);
        return;
      }
    }

    const tileOptions: any = {
      attribution,
      maxZoom,
      subdomains: "abc",
    };

    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions);
    tileLayerRef.current.addTo(mapInstanceRef.current);
    tileLayerRef.current.bringToBack();
  }, [layerMode]);

  // Update map layer markings (Markers + Fences)
  useEffect(() => {
    if (!mapInstanceRef.current || typeof L === "undefined") return;

    markerGroupRef.current.clearLayers();
    fenceGroupRef.current.clearLayers();
    markersMapRef.current.clear();

    const safeGeofences = Array.isArray(geofences) ? geofences : [];
    const safeTourists = Array.isArray(tourists) ? tourists : [];

    // 1. Add Geofences (Hazard Circles with 3D Volumetric styling)
    safeGeofences.forEach((fence) => {
      if (!fence || !fence.coordinates || !Array.isArray(fence.coordinates) || fence.coordinates.length < 2) return;
      const color = fence.severity === "critical" ? "#ef4444" : "#f59e0b";

      // Outer boundary ring
      const circle = L.circle(fence.coordinates, {
        color: color,
        fillColor: color,
        fillOpacity: is3DMode ? 0.22 : 0.14,
        radius: fence.radius,
        weight: is3DMode ? 2.5 : 1.5,
        dashArray: is3DMode ? undefined : "5, 5",
      });

      circle.bindPopup(`
        <div class="p-1 font-sans text-slate-100 font-mono">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="w-2 h-2 rounded-full ${fence.severity === "critical" ? "bg-red-500 animate-pulse" : "bg-amber-500"}"></span>
            <span class="text-[10px] uppercase tracking-wider font-semibold font-display ${fence.severity === "critical" ? "text-red-400" : "text-amber-400"}">
              ${fence.severity.toUpperCase()} HAZARD ZONE ${is3DMode ? "• 3D CYLINDER" : ""}
            </span>
          </div>
          <h4 class="text-sm font-bold font-display text-white border-b border-slate-800 pb-1 mb-1">${fence.name}</h4>
          <p class="text-xs text-slate-300 leading-normal mb-1.5">${fence.description}</p>
          <div class="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>📡 RADIUS: ${fence.radius}m</span>
            <span>ELEV: BUFFER ZONE</span>
          </div>
        </div>
      `);

      fenceGroupRef.current.addLayer(circle);

      // In 3D mode, add an inner core ring to simulate a 3D hazard column/cylinder
      if (is3DMode) {
        const innerCircle = L.circle(fence.coordinates, {
          color: color,
          fillColor: color,
          fillOpacity: 0.1,
          radius: fence.radius * 0.5,
          weight: 1,
          dashArray: "3, 3",
        });
        fenceGroupRef.current.addLayer(innerCircle);
      }
    });

    // 2. Add Active Tourists (Draggable & 3D Billboards)
    safeTourists.forEach((tourist) => {
      if (!tourist || !tourist.coordinates || !Array.isArray(tourist.coordinates) || tourist.coordinates.length < 2) return;
      let pinColor = "#10b981"; // Safe
      let labelBadge = "SAFE";
      if (tourist.status === "warning") {
        pinColor = "#f59e0b"; // Warning
        labelBadge = "ALERT";
      } else if (tourist.status === "danger") {
        pinColor = "#ef4444"; // Danger
        labelBadge = "SOS/DISTRESS";
      }

      const isCurrentTarget = selectedTouristId === tourist.id;
      const touristStreet = tourist.street || `Track (${tourist.coordinates[0].toFixed(4)}, ${tourist.coordinates[1].toFixed(4)})`;
      const touristCountry = tourist.country || "India";
      const mapsUrl = getGoogleMapsUrl(tourist.coordinates[0], tourist.coordinates[1]);
      const streetViewUrl = getGoogleStreetViewUrl(tourist.coordinates[0], tourist.coordinates[1]);

      // 3D Counter-Rotation so labels and pins remain upright when map is tilted and rotated
      const billboardTransform = is3DMode
        ? `transform: rotateZ(${-bearing}deg) rotateX(${-pitch}deg); transform-origin: center bottom;`
        : "";

      const customIcon = L.divIcon({
        className: "custom-tourist-icon-container",
        html: `
          <div style="position: relative; width: 44px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; ${billboardTransform}">
            ${
              is3DMode
                ? `
                  <!-- 3D Ground Radar Ring -->
                  <div style="position: absolute; bottom: 0; width: ${tourist.status === "danger" ? "42px" : "32px"}; height: ${tourist.status === "danger" ? "20px" : "16px"}; border-radius: 50%; border: ${tourist.status === "danger" ? "2px solid #ef4444" : `1.5px solid ${pinColor}88`}; background: ${tourist.status === "danger" ? "rgba(239, 68, 68, 0.4)" : `${pinColor}22`}; transform: rotateX(${pitch}deg); animation: ${tourist.status === "danger" ? "sos-beacon-heavy-pulse 1.1s infinite" : "pulse 2s infinite"};"></div>
                  <!-- 3D Vertical Elevation Laser Stalk -->
                  <div style="position: absolute; bottom: 8px; width: ${tourist.status === "danger" ? "3px" : "2px"}; height: 28px; background: linear-gradient(to top, ${pinColor}, ${tourist.status === "danger" ? "#ff0000" : "transparent"}); box-shadow: 0 0 ${tourist.status === "danger" ? "12px #ef4444" : `6px ${pinColor}`};"></div>
                `
                : ""
            }

            ${
              tourist.status === "danger"
                ? `
                  <!-- Prominent Multi-Layer SOS Distress Pulsing Radar and Beacon -->
                  <div class="sos-status-beacon"></div>
                  <div class="sos-sonar-wave-primary"></div>
                  <div class="sos-sonar-wave-secondary"></div>
                `
                : tourist.status === "warning"
                ? `<div class="warning-radial-pulse" style="position: absolute; width: 44px; height: 44px; border-radius: 9999px;"></div>`
                : ""
            }

            ${
              isCurrentTarget
                ? `<div style="position: absolute; width: 42px; height: 42px; border: 2px dashed #38bdf8; border-radius: 50%; animation: ranger-pulse 2s infinite linear; pointer-events: none; z-index: 15;"></div>`
                : ""
            }
            
            <div class="${tourist.status === "danger" ? "sos-distress-marker-pin" : ""}" style="width: ${tourist.status === "danger" ? "26px" : "22px"}; height: ${tourist.status === "danger" ? "26px" : "22px"}; border-radius: 50%; background: ${pinColor}; border: 2px solid ${tourist.status === "danger" ? "#ffffff" : "#090d16"}; box-shadow: ${tourist.status === "danger" ? "0 0 24px #ef4444, 0 0 40px #dc2626" : `0 0 14px ${pinColor}`}; display: flex; align-items: center; justify-content: center; z-index: 20;">
              <span style="width: ${tourist.status === "danger" ? "9px" : "7px"}; height: ${tourist.status === "danger" ? "9px" : "7px"}; border-radius: 50%; background: ${tourist.status === "danger" ? "#ffffff" : "#020617"}; ${tourist.status === "danger" ? "box-shadow: 0 0 8px #ffffff; animation: ping 1s infinite cubic-bezier(0, 0, 0.2, 1);" : ""}"></span>
            </div>
            
            <div class="${tourist.status === "danger" ? "sos-distress-badge-active" : ""}" style="position: absolute; bottom: 34px; white-space: nowrap; background-color: ${tourist.status === "danger" ? "#dc2626" : "#0c0c0e"}; color: #f1f5f9; font-size: ${tourist.status === "danger" ? "9.5px" : "9px"}; font-weight: 900; padding: ${tourist.status === "danger" ? "2.5px 7px" : "2px 6px"}; border: 1.5px solid ${tourist.status === "danger" ? "#fca5a5" : isCurrentTarget ? '#38bdf8' : 'rgba(255,255,255,0.15)'}; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: ${tourist.status === "danger" ? "0 0 16px rgba(239, 68, 68, 0.85)" : "0 4px 6px -1px rgb(0 0 0 / 0.7)"}; z-index: 30;">
              ${tourist.status === "danger" ? '🚨 SOS • ' : isCurrentTarget ? '🎯 ' : ''}${tourist.name} ${is3DMode ? `<span style="color: ${tourist.status === "danger" ? "#ffffff" : "#38bdf8"}; font-size: 8px;">(${tourist.altitude}m)</span>` : ''}
            </div>
          </div>
        `,
        iconSize: [44, 50],
        iconAnchor: [22, 50],
      });

      // Marker is draggable so operator can drag & drop anywhere on the map to relocate!
      const marker = L.marker(tourist.coordinates, {
        icon: customIcon,
        draggable: true,
      });

      // Handle direct drag-and-drop location update
      marker.on("dragend", async (ev: any) => {
        const newLatLng = ev.target.getLatLng();
        performRelocation(tourist.id, newLatLng.lat, newLatLng.lng);
      });

      marker.bindPopup(`
        <div class="font-mono w-[260px] text-white p-1">
          <div class="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
            <h4 class="text-xs font-black uppercase text-white flex items-center gap-1">
              <span>${tourist.name}</span>
              <span class="text-[8px] text-white/40 font-normal">✋ Draggable</span>
            </h4>
            <span class="text-[9px] font-black px-1.5 py-0.5 rounded-none" style="background-color: ${pinColor}25; color: ${pinColor}; border: 1px solid ${pinColor}40;">
              ${labelBadge}
            </span>
          </div>
          
          <!-- Google Maps Street & Country Telemetry -->
          <div class="bg-black/60 p-2 border border-white/10 mb-2 space-y-1">
            <div class="flex items-start gap-1">
              <span class="text-sky-400 text-[11px]">🛣️</span>
              <div class="flex-1">
                <span class="text-[8px] uppercase tracking-wider text-white/40 block font-bold">STREET (GOOGLE MAPS)</span>
                <span class="text-[10px] text-white font-bold leading-tight block">${touristStreet}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 border-t border-white/5 pt-1">
              <span class="text-emerald-400 text-[11px]">🌐</span>
              <div class="flex-1 flex justify-between items-center">
                <span class="text-[8px] uppercase tracking-wider text-white/40 font-bold">COUNTRY</span>
                <span class="text-[10px] text-emerald-300 font-bold">${touristCountry}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-white/80 mb-2 font-mono">
            <div>🔋 BATT: <strong class="text-white">${tourist.battery}%</strong></div>
            <div>💓 HEART: <strong class="text-white">${tourist.heartRate} bpm</strong></div>
            <div>🌡️ CORE: <strong class="text-white">${tourist.temperature.toFixed(1)}°C</strong></div>
            <div>⛰️ ELEV: <strong class="text-sky-300">${tourist.altitude}m ALT</strong></div>
          </div>

          <div class="text-[8px] text-amber-300/80 bg-amber-950/40 p-1 mb-2 border border-amber-500/20">
            💡 TIP: You can drag this marker pin to reposition on the map, or click anywhere to relocate.
          </div>

          <div class="flex gap-1 border-t border-white/10 pt-2">
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-black uppercase text-center py-1 transition-colors no-underline">
              Google Maps
            </a>
            <a href="${streetViewUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black uppercase text-center py-1 transition-colors no-underline">
              Street View
            </a>
          </div>
        </div>
      `);

      marker.on("click", () => {
        onSelectTourist?.(tourist.id);
      });

      markerGroupRef.current.addLayer(marker);
      markersMapRef.current.set(tourist.id, marker);
    });
  }, [tourists, geofences, selectedTouristId, onSelectTourist, is3DMode, pitch, bearing]);

  // Smooth programmatic zoom animation feature
  useEffect(() => {
    if (!mapInstanceRef.current || typeof L === "undefined") return;

    const safeTourists = Array.isArray(tourists) ? tourists : [];
    const targetTourist = selectedTouristId
      ? safeTourists.find((t) => t && t.id === selectedTouristId)
      : null;

    const targetCoords = focusCoordinates || targetTourist?.coordinates;
    if (!targetCoords || !Array.isArray(targetCoords) || targetCoords.length < 2) return;

    const isKeyTrigger =
      focusTriggerKey !== undefined && focusTriggerKey !== prevFocusKeyRef.current;
    const isIdTrigger =
      selectedTouristId !== undefined && selectedTouristId !== prevSelectedIdRef.current;
    const isExplicitFocus = !!focusCoordinates;

    prevFocusKeyRef.current = focusTriggerKey;
    prevSelectedIdRef.current = selectedTouristId;

    if (!selectedTouristId && !focusCoordinates) {
      setActiveTargetInfo(null);
      return;
    }

    if (isKeyTrigger || isIdTrigger || isExplicitFocus) {
      if (targetTourist) {
        setActiveTargetInfo({
          id: targetTourist.id,
          name: targetTourist.name,
          coordinates: targetCoords,
          status: targetTourist.status,
          altitude: targetTourist.altitude,
          street: targetTourist.street,
          country: targetTourist.country,
        });
      }

      setIsFlying(true);

      mapInstanceRef.current.flyTo(targetCoords, 17, {
        animate: true,
        duration: 1.6,
        easeLinearity: 0.25,
      });

      const onFlightEnd = () => {
        setIsFlying(false);
        const targetId = selectedTouristId || targetTourist?.id;
        if (targetId && markersMapRef.current.has(targetId)) {
          markersMapRef.current.get(targetId)?.openPopup();
        }
      };

      mapInstanceRef.current.once("moveend", onFlightEnd);

      const fallbackTimer = setTimeout(onFlightEnd, 1750);
      return () => {
        mapInstanceRef.current?.off("moveend", onFlightEnd);
        clearTimeout(fallbackTimer);
      };
    }
  }, [selectedTouristId, focusCoordinates, focusTriggerKey, tourists]);

  // Reset to full Dhimbam Forest Range & Sathyamangalam tactical SAR overview
  const handleResetOverview = () => {
    if (!mapInstanceRef.current || typeof L === "undefined") return;
    setActiveTargetInfo(null);
    if (onSelectTourist) {
      onSelectTourist(null);
    }
    setIsFlying(true);
    mapInstanceRef.current.flyTo([11.6150, 77.1250], 13, {
      animate: true,
      duration: 1.4,
      easeLinearity: 0.25,
    });
    mapInstanceRef.current.once("moveend", () => setIsFlying(false));
  };

  // Re-center on currently active locked target
  const handleRecenterTarget = () => {
    if (!mapInstanceRef.current || !activeTargetInfo || typeof L === "undefined") return;
    setIsFlying(true);
    mapInstanceRef.current.flyTo(activeTargetInfo.coordinates, 17, {
      animate: true,
      duration: 1.2,
      easeLinearity: 0.25,
    });
    mapInstanceRef.current.once("moveend", () => {
      setIsFlying(false);
      markersMapRef.current.get(activeTargetInfo.id)?.openPopup();
    });
  };

  // Street & Country search using Google Maps
  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await forwardGeocodeWithGoogleMaps(searchQuery.trim());
      if (result && result.lat && result.lng) {
        setIsFlying(true);
        mapInstanceRef.current.flyTo([result.lat, result.lng], 16, {
          animate: true,
          duration: 1.5,
        });

        // Add a temporary search highlight marker
        clickInspectGroupRef.current.clearLayers();
        const searchMarker = L.marker([result.lat, result.lng]).addTo(clickInspectGroupRef.current);
        searchMarker.bindPopup(`
          <div class="font-mono w-[240px] text-white p-1">
            <span class="text-[9px] font-black text-sky-400 uppercase">SEARCH RESULT (GOOGLE MAPS)</span>
            <div class="text-xs font-bold text-white mt-1">${result.street || searchQuery}</div>
            <div class="text-[10px] text-emerald-400">${result.country}</div>
            <div class="text-[9px] text-white/50 mt-1">${result.formattedAddress}</div>
            
            <div class="mt-2 border-t border-white/10 pt-1.5">
              <button
                onclick="window.__tourguard_relocate_tourist('${selectedTouristId || tourists[0]?.id}', ${result.lat}, ${result.lng})"
                class="w-full bg-amber-600 hover:bg-amber-500 text-white font-black text-[9px] uppercase py-1 cursor-pointer"
              >
                Relocate Tracked Person Here
              </button>
            </div>
          </div>
        `).openPopup();
      } else {
        setSearchError("No geographic location found. Try adding city or country.");
      }
    } catch (err) {
      setSearchError("Geocoding lookup timed out. Please retry.");
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle 3D View mode
  const handleToggle3D = () => {
    setIs3DMode((prev) => {
      const next = !prev;
      if (next) {
        setPitch(55);
        setBearing(25);
        // Switch to terrain relief if in flat street mode for dramatic elevation pop
        if (layerMode === "google-streets") {
          setLayerMode("google-terrain");
        }
      } else {
        setIsOrbiting(false);
        setPitch(0);
        setBearing(0);
      }
      return next;
    });
  };

  // Google Earth 3D launcher
  const handleOpenGoogleEarth3D = () => {
    const center = mapInstanceRef.current?.getCenter() || { lat: 11.6150, lng: 77.1250 };
    const earthUrl = `https://earth.google.com/web/@${center.lat},${center.lng},1200a,35y,${bearing}h,${pitch}t,0r`;
    window.open(earthUrl, "_blank", "noopener,noreferrer");
  };

  const currentLayerOption =
    MAP_LAYER_OPTIONS.find((opt) => opt.id === layerMode) || MAP_LAYER_OPTIONS[0];

  return (
    <div ref={rootContainerRef} className="relative w-full h-full border border-white/10 bg-brand-surface overflow-hidden flex flex-col">
      
      {/* Top Map Navigation Bar with Pull-Out Controls & 3D Tools */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col pointer-events-auto max-w-[calc(100%-24px)] w-fit">
        
        {/* The One Unified Navigation Bar */}
        <div className="bg-black/95 backdrop-blur-md border border-white/20 px-2.5 py-1.5 flex items-center flex-wrap gap-1.5 sm:gap-2 shadow-2xl w-fit max-w-full">
          
          {/* Google Maps Status */}
          <div
            id="google-maps-api-status-badge"
            className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 shrink-0"
            title="Google Maps Platform: Street & Country Geocoding Engine Active"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-black text-white/50 uppercase">GOOGLE MAP</span>
            <span className="text-[9px] font-black text-emerald-300 uppercase tracking-wider hidden sm:inline">• ACTIVE</span>
          </div>

          {/* 3D VIEW TOGGLE BUTTON */}
          <button
            id="toggle-3d-view-btn"
            type="button"
            onClick={handleToggle3D}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border shrink-0 ${
              is3DMode
                ? "bg-gradient-to-r from-indigo-600 to-sky-600 text-white border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]"
                : "bg-white/10 text-white/90 hover:bg-white/20 border-white/15 hover:border-white/30"
            }`}
            title="Toggle interactive 3D perspective terrain view with tilt and bearing rotation"
          >
            <Box className={`w-3.5 h-3.5 ${is3DMode ? "text-sky-300 animate-bounce" : "text-slate-300"}`} />
            <span>3D VIEW</span>
            <span className={`text-[8px] font-mono px-1 py-0.2 rounded-xs uppercase ${is3DMode ? "bg-black/40 text-emerald-300 font-black" : "text-white/50"}`}>
              {is3DMode ? `${pitch}°` : "2D"}
            </span>
          </button>

          {/* Fast Relocate Mode Button ("change the location according to the map when the user interface it") */}
          <button
            id="toggle-relocate-mode-btn"
            type="button"
            onClick={() => setIsRelocateMode((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border shrink-0 ${
              isRelocateMode
                ? "bg-amber-600 text-white border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse"
                : "bg-white/10 text-white/80 hover:bg-white/20 border-white/15"
            }`}
            title="When active, clicking anywhere on the map immediately moves the selected person to that location"
          >
            <MapPin className={`w-3 h-3 ${isRelocateMode ? "text-white" : "text-amber-400"}`} />
            <span>{isRelocateMode ? "Click Map to Move" : "Relocate"}</span>
          </button>

          {/* Single Pull-out Toggle Button */}
          <button
            type="button"
            onClick={() => setIsPullOutOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border shrink-0 ${
              isPullOutOpen
                ? "bg-sky-600 text-white border-sky-400 shadow-md"
                : "bg-white/10 text-white/90 hover:bg-white/20 border-white/15 hover:border-white/30"
            }`}
            title="Toggle Pull-Out Drawer for Layer Imagery & Search"
          >
            <Layers className="w-3.5 h-3.5 text-sky-300" />
            <span>{currentLayerOption.icon} {currentLayerOption.name}</span>
            <span className="text-[8px] opacity-80 bg-black/40 px-1 py-0.5 rounded-xs hidden md:inline font-mono">
              {isPullOutOpen ? "COLLAPSE" : "PULL OUT"}
            </span>
            {isPullOutOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-sky-200 transition-transform" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-sky-200 animate-pulse" />
            )}
          </button>

          {/* Reset Overview */}
          <button
            id="reset-valley-overview-btn"
            type="button"
            onClick={handleResetOverview}
            className="flex items-center gap-1 px-2 py-1 border border-white/15 bg-white/5 hover:bg-white/15 text-white/80 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer shrink-0"
            title="Reset map to Dhimbam Forest Range & Sathyamangalam SAR Overview (Zoom 13)"
          >
            <ZoomOut className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">Overview</span>
          </button>

          {/* Emergency Target Selector Dropdown Trigger */}
          <div className="relative">
            <button
              id="select-emergency-target-btn"
              type="button"
              onClick={() => setIsTargetDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-1 px-2 py-1 border text-[10px] font-black uppercase tracking-wider shadow-sm cursor-pointer transition-colors shrink-0 ${
                activeTargetInfo
                  ? activeTargetInfo.status === "danger"
                    ? "border-red-500/70 bg-red-950/80 text-red-200 hover:bg-red-900/90"
                    : "border-sky-500/60 bg-sky-950/80 text-sky-200 hover:bg-sky-900/90"
                  : "border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50 hover:border-amber-500/60"
              }`}
              title="Select emergency target or choose who to track on map"
            >
              <AlertTriangle className={`w-3 h-3 shrink-0 ${activeTargetInfo?.status === "danger" ? "text-red-400 animate-pulse" : "text-amber-400"}`} />
              <span className="hidden sm:inline">Target:</span>
              <span className="truncate max-w-[90px] sm:max-w-[130px]">
                {activeTargetInfo ? activeTargetInfo.name : "Free / Select"}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Emergency Target Dropdown Menu */}
            <AnimatePresence>
              {isTargetDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-1.5 w-64 bg-slate-950/95 border border-white/20 shadow-2xl p-2 z-[2000] backdrop-blur-md flex flex-col gap-1 text-[11px]"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[9px] text-white/50 uppercase font-black tracking-wider">
                    <span>Emergency Targets</span>
                    <button
                      type="button"
                      onClick={() => setIsTargetDropdownOpen(false)}
                      className="hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Free overview option (unpin target) */}
                  <button
                    type="button"
                    onClick={() => {
                      handleResetOverview();
                      setIsTargetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 flex items-center justify-between border transition-colors cursor-pointer ${
                      !activeTargetInfo
                        ? "border-sky-500/50 bg-sky-950/60 text-white font-bold"
                        : "border-transparent hover:bg-white/5 text-slate-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <ZoomOut className="w-3 h-3 text-sky-400" />
                      <span>Free Valley Overview (No Target)</span>
                    </div>
                    {!activeTargetInfo && <Check className="w-3 h-3 text-sky-400" />}
                  </button>

                  <div className="text-[8px] text-white/30 uppercase tracking-widest pt-1 px-1">
                    Tracked Hikers & Emergencies
                  </div>

                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-0.5">
                    {tourists.map((tourist) => {
                      const isSelected = activeTargetInfo?.id === tourist.id;
                      const isSos = tourist.status === "danger";
                      const isWarning = tourist.status === "warning";
                      return (
                        <button
                          key={tourist.id}
                          type="button"
                          onClick={() => {
                            if (onSelectTourist) {
                              onSelectTourist(tourist.id);
                            }
                            setIsTargetDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 flex items-center justify-between border transition-colors cursor-pointer ${
                            isSelected
                              ? isSos
                                ? "border-red-500/80 bg-red-950/60 text-white font-black"
                                : "border-sky-500/80 bg-sky-950/60 text-white font-black"
                              : isSos
                              ? "border-red-900/40 bg-red-950/20 text-red-300 hover:bg-red-950/40"
                              : "border-transparent hover:bg-white/5 text-slate-300 hover:text-white"
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <div className="flex items-center gap-1">
                              {isSos ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                              ) : isWarning ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              )}
                              <span className="truncate font-bold text-[10px]">{tourist.name}</span>
                            </div>
                            <span className="text-[8px] opacity-60 truncate pl-2.5">
                              {tourist.street || `${tourist.altitude}m elev`}
                            </span>
                          </div>
                          <span
                            className={`text-[8px] font-black uppercase px-1 py-0.5 border shrink-0 ${
                              isSos
                                ? "bg-red-900/60 text-red-200 border-red-500/50 animate-pulse"
                                : isWarning
                                ? "bg-amber-950/40 text-amber-300 border-amber-500/40"
                                : "bg-emerald-950/40 text-emerald-300 border-emerald-500/40"
                            }`}
                          >
                            {isSos ? "SOS ACTIVE" : isWarning ? "WARNING" : "NOMINAL"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active Target Locked chip with Re-center and Dismiss */}
          {activeTargetInfo && (
            <div className="flex items-center border border-sky-500/50 bg-sky-950/80 text-sky-300 text-[10px] font-black uppercase tracking-wider shadow-sm truncate max-w-[150px] sm:max-w-[200px]">
              <button
                type="button"
                onClick={handleRecenterTarget}
                className="flex items-center gap-1 px-1.5 py-1 hover:bg-sky-900/90 cursor-pointer truncate flex-1"
                title={`Click to re-focus on target ${activeTargetInfo.name}`}
              >
                <Crosshair className={`w-3 h-3 text-sky-400 shrink-0 ${isFlying ? "animate-spin" : "animate-pulse"}`} />
                <span className="truncate">{activeTargetInfo.name}</span>
              </button>
              <button
                type="button"
                onClick={handleResetOverview}
                className="px-1 py-1 hover:bg-white/10 text-white/50 hover:text-white border-l border-sky-500/30 cursor-pointer"
                title="Unpin target and return to free overview"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>

        {/* 3D HUD CAMERA CONTROLS (Rendered when 3D Mode is Active) */}
        <AnimatePresence>
          {is3DMode && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-black/95 backdrop-blur-md border-x border-b border-sky-500/40 p-2 text-white shadow-2xl flex flex-wrap items-center gap-2 max-w-full font-mono text-[10px]"
            >
              {/* 3D Indicator */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-sky-950/60 border border-sky-400/40 text-sky-300">
                <Box className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
                <span className="font-black text-[9px] uppercase tracking-wider">3D ENGINE</span>
              </div>

              {/* Pitch Presets */}
              <div className="flex items-center gap-1 bg-white/5 p-1 border border-white/10">
                <span className="text-[8px] text-white/40 uppercase font-black px-1">Tilt:</span>
                {[
                  { label: "0°", val: 0 },
                  { label: "35°", val: 35 },
                  { label: "55°", val: 55 },
                  { label: "70°", val: 70 },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setPitch(p.val)}
                    className={`px-1.5 py-0.5 text-[9px] font-bold cursor-pointer transition-colors ${
                      pitch === p.val
                        ? "bg-sky-500 text-white font-black"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  type="range"
                  min="0"
                  max="75"
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-16 h-1 accent-sky-400 cursor-pointer ml-1"
                  title={`Tilt Pitch: ${pitch}°`}
                />
              </div>

              {/* Bearing & Compass Controls */}
              <div className="flex items-center gap-1 bg-white/5 p-1 border border-white/10">
                {/* Interactive Compass Needle */}
                <button
                  type="button"
                  onClick={() => setBearing(0)}
                  className="p-1 hover:bg-white/10 text-white cursor-pointer relative flex items-center justify-center"
                  title="Click to reset True North (Bearing 0°)"
                >
                  <Compass
                    className="w-4 h-4 text-emerald-400 transition-transform"
                    style={{ transform: `rotate(${-bearing}deg)` }}
                  />
                  <span className="text-[7px] font-black absolute -top-1 text-red-400">N</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBearing((prev) => (prev - 15 + 360) % 360)}
                  className="p-1 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="Rotate Left 15°"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <span className="text-[9px] font-bold text-sky-300 min-w-[32px] text-center">
                  {Math.round(bearing)}°
                </span>
                <button
                  type="button"
                  onClick={() => setBearing((prev) => (prev + 15) % 360)}
                  className="p-1 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="Rotate Right 15°"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
              </div>

              {/* 3D Auto-Orbit */}
              <button
                type="button"
                onClick={() => setIsOrbiting((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
                  isOrbiting
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-md animate-pulse"
                    : "bg-white/10 hover:bg-white/20 text-white/80 border-white/15"
                }`}
                title="Continuous 360° orbital camera rotation around current valley focus"
              >
                <Orbit className={`w-3 h-3 ${isOrbiting ? "text-white animate-spin" : "text-emerald-400"}`} />
                <span>{isOrbiting ? "Orbiting..." : "3D Orbit"}</span>
              </button>

              {/* Google Earth 3D Link */}
              <button
                type="button"
                onClick={handleOpenGoogleEarth3D}
                className="flex items-center gap-1 px-2 py-1 bg-sky-900/60 hover:bg-sky-800 text-sky-200 border border-sky-400/40 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                title="Open Photorealistic 3D Mesh in Google Earth Web"
              >
                <Globe className="w-3 h-3 text-sky-400" />
                <span className="hidden sm:inline">Earth 3D</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated Pull-Out Drawer Under The One Navigation Bar */}
        <AnimatePresence>
          {isPullOutOpen && (
            <motion.div
              key="map-pull-out-drawer"
              initial={{ opacity: 0, height: 0, y: -10, scaleY: 0.95 }}
              animate={{ opacity: 1, height: "auto", y: 0, scaleY: 1 }}
              exit={{ opacity: 0, height: 0, y: -10, scaleY: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "top" }}
              className="overflow-hidden bg-black/95 backdrop-blur-md border-x border-b border-white/20 shadow-2xl p-3 flex flex-col gap-2.5"
            >
              {/* Visual Imagery Selection Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[9px] font-black tracking-wider text-white/60 uppercase">
                    MAP IMAGERY & TERRAIN LAYERS
                  </span>
                </div>
                <span className="text-[9px] text-emerald-400 font-mono font-bold">
                  {currentLayerOption.badge.toUpperCase()} ACTIVE
                </span>
              </div>

              {/* Visual Layer Preview Thumbnails (Images under the navigation bar) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {MAP_LAYER_OPTIONS.map((option) => {
                  const isSelected = layerMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLayerMode(option.id)}
                      className={`group relative text-left border cursor-pointer transition-all overflow-hidden p-0.5 rounded-none ${
                        isSelected
                          ? "border-sky-400 ring-1 ring-sky-400/80 bg-sky-950/60 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                          : "border-white/15 hover:border-white/40 bg-white/5 hover:bg-white/10"
                      }`}
                      title={option.description}
                    >
                      {/* Image Preview Container with Smooth Pull-Out Scale & Hover */}
                      <div className="relative w-full h-14 bg-slate-900 overflow-hidden">
                        <img
                          src={option.previewUrl}
                          alt={option.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                        
                        {/* Active Selection Badge */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center shadow-md">
                            <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                          </div>
                        )}

                        {/* Layer Title Overlay */}
                        <div className="absolute bottom-1 left-1.5 right-1 flex items-center justify-between">
                          <span className="text-[10px] font-black text-white tracking-wide flex items-center gap-1 drop-shadow">
                            <span>{option.icon}</span>
                            <span>{option.name}</span>
                          </span>
                        </div>
                      </div>

                      {/* Micro descriptor */}
                      <div className="p-1 text-[8px] text-white/50 line-clamp-1 font-mono">
                        {option.badge}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Lower Section: Search Bar & Geocoding */}
              <div className="border-t border-white/10 pt-2 flex flex-col gap-1.5">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-1 bg-white/5 border border-white/15 p-1">
                  <Search className="w-3.5 h-3.5 text-sky-400 ml-1 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                    }}
                    placeholder="Search Street, Trail or Country in Google Maps..."
                    className="bg-transparent border-none text-[10px] text-white placeholder-white/40 focus:outline-none flex-1 font-mono min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-none cursor-pointer transition-colors shrink-0"
                  >
                    {isSearching ? "Locating..." : "Locate"}
                  </button>
                </form>

                {searchError && (
                  <span className="text-[9px] text-brand-red font-bold bg-brand-red/10 px-2 py-0.5 border border-brand-red/30">
                    ⚠️ {searchError}
                  </span>
                )}
              </div>

              {/* Interactive Pull Handle */}
              <button
                type="button"
                onClick={() => setIsPullOutOpen(false)}
                className="w-full py-1 mt-0.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[8px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-white/10"
                title="Click to pull up and retract this drawer"
              >
                <ChevronUp className="w-3 h-3 text-sky-400" />
                <span>PULL UP TO CLOSE</span>
                <span className="text-white/20 font-mono">• • •</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tactile Pull-Out Tab Indicator when collapsed */}
        {!isPullOutOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setIsPullOutOpen(true)}
            className="self-start -mt-px bg-black/90 hover:bg-sky-950 text-sky-400 hover:text-sky-300 border-x border-b border-white/20 px-3 py-1 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl transition-all cursor-pointer"
            title="Click to pull out map layer imagery & search tools"
          >
            <ChevronDown className="w-3 h-3 text-sky-400 animate-bounce" />
            <span>PULL OUT MAP LAYERS & TOOLS</span>
          </motion.button>
        )}

      </div>

      {/* Relocation Instant Feedback Toast */}
      <AnimatePresence>
        {relocateFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute top-16 right-4 z-[1200] bg-emerald-950/95 border border-emerald-400 text-white p-3 shadow-2xl backdrop-blur-md max-w-sm flex items-start gap-2.5 font-mono"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0 text-emerald-300">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase font-black tracking-wider text-emerald-400">
                LOCATION UPDATED FROM MAP
              </div>
              <div className="text-xs font-bold text-white mt-0.5 truncate">
                {relocateFeedback.name} relocated
              </div>
              <div className="text-[10px] text-white/70 truncate mt-0.5">
                📍 {relocateFeedback.street}
              </div>
              <div className="text-[8px] text-white/40 mt-1">
                GPS: {relocateFeedback.coordinates[0].toFixed(5)}, {relocateFeedback.coordinates[1].toFixed(5)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRelocateFeedback(null)}
              className="text-white/50 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fast Relocate Cursor Banner */}
      {isRelocateMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1100] bg-amber-500 text-black px-3 py-1 font-mono text-[10px] font-black uppercase tracking-wider shadow-2xl flex items-center gap-2 border border-black animate-pulse">
          <MapPin className="w-3.5 h-3.5" />
          <span>RELOCATE MODE ACTIVE • CLICK ANYWHERE ON MAP TO MOVE TOURIST</span>
          <button
            type="button"
            onClick={() => setIsRelocateMode(false)}
            className="ml-1 bg-black text-white px-1 py-0.2 hover:bg-neutral-800 cursor-pointer"
          >
            DONE
          </button>
        </div>
      )}

      {/* Floating Tactical Touch Location Telemetry HUD - Movable & Draggable */}
      <AnimatePresence>
        {touchedLocation && (
          <motion.div
            id="map-touch-telemetry-hud"
            drag
            dragConstraints={rootContainerRef}
            dragElastic={0.08}
            dragMomentum={false}
            whileDrag={{ scale: 1.02, cursor: "grabbing" }}
            initial={{ opacity: 0, y: -15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-[1150] w-[330px] sm:w-[360px] max-w-[94vw] bg-black/95 backdrop-blur-md border border-sky-500/70 shadow-2xl p-2.5 font-mono text-white text-xs cursor-grab active:cursor-grabbing select-none touch-none ${
              hudPositionCorner === "top-right"
                ? "top-16 right-3 sm:right-4"
                : hudPositionCorner === "bottom-right"
                ? "bottom-12 right-3 sm:right-4"
                : hudPositionCorner === "bottom-left"
                ? "bottom-12 left-3 sm:left-4"
                : "top-16 left-3 sm:left-4"
            }`}
          >
            {/* Header: Grip Handle, Title, Move, Copy & Close */}
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
              <div
                className="flex items-center gap-1.5 min-w-0 cursor-grab active:cursor-grabbing"
                title="Touch or drag anywhere on this box to move it"
              >
                <GripHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-300 truncate">
                  TELEMETRY
                </span>
                <span className="text-[7.5px] font-mono bg-sky-950 text-sky-300 border border-sky-500/40 px-1 py-0.2 shrink-0 hidden sm:inline">
                  DRAG TO MOVE
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onClick={cycleHudPosition}
                  className="text-[9px] bg-white/10 hover:bg-sky-600 border border-white/20 px-1.5 py-0.5 text-sky-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  title="Move box to another corner"
                >
                  <Move className="w-3 h-3 text-amber-300" />
                  <span className="hidden sm:inline">MOVE</span>
                </button>
                <button
                  type="button"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onClick={() => {
                    navigator.clipboard.writeText(`${touchedLocation.lat.toFixed(6)}, ${touchedLocation.lng.toFixed(6)}`);
                    setIsCopiedCoords(true);
                    setTimeout(() => setIsCopiedCoords(false), 1500);
                  }}
                  className="text-[9px] bg-white/10 hover:bg-sky-600 border border-white/20 px-1.5 py-0.5 text-white flex items-center gap-1 cursor-pointer transition-colors"
                  title="Copy Coordinates to Clipboard"
                >
                  {isCopiedCoords ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3 text-sky-400" />}
                  <span>{isCopiedCoords ? "COPIED" : "COPY"}</span>
                </button>
                <button
                  type="button"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onClick={() => {
                    setTouchedLocation(null);
                    clickInspectGroupRef.current?.clearLayers();
                  }}
                  className="text-white/50 hover:text-white p-0.5 cursor-pointer ml-0.5"
                  title="Close Inspection Box"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Latitude, Longitude & DMS */}
            <div className="bg-white/5 border border-white/10 p-2 mb-2">
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-xs font-black text-white font-mono">
                  {touchedLocation.formattedLat}, {touchedLocation.formattedLng}
                </span>
                <span className="text-[9px] font-bold text-sky-400 font-mono">
                  {touchedLocation.coordinatesString}
                </span>
              </div>
              <div className="text-[8.5px] text-white/60 font-mono mt-0.5 truncate">
                DMS: {touchedLocation.dmsString}
              </div>
            </div>

            {/* Real-time Google Maps Location */}
            <div className="bg-sky-950/30 border border-sky-800/40 p-2 mb-2">
              <div className="flex items-start gap-1 text-[10px] text-amber-300 font-bold">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="truncate" title={touchedLocation.formattedAddress || touchedLocation.street}>
                  {touchedLocation.street || "Google Maps Location"}
                </span>
              </div>
              {(touchedLocation.locality || touchedLocation.country) && (
                <div className="text-[9px] text-emerald-300/90 pl-4 mt-0.5 truncate">
                  {touchedLocation.country} {touchedLocation.locality ? `• ${touchedLocation.locality}` : ""}
                </div>
              )}
              {/* Direct Google Maps & Street View Action Buttons */}
              <div className="flex gap-1.5 mt-2">
                <a
                  href={getGoogleMapsUrl(touchedLocation.lat, touchedLocation.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-black uppercase text-center py-1 transition-colors flex items-center justify-center gap-1 no-underline"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> Google Maps
                </a>
                <a
                  href={getGoogleStreetViewUrl(touchedLocation.lat, touchedLocation.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black uppercase text-center py-1 transition-colors flex items-center justify-center gap-1 no-underline"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> Street View
                </a>
              </div>
            </div>

            {/* Real-Time Time Zone + Altitude Readout Grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 text-xs">
              {/* Real-time Live Clock & Time Zone */}
              <div className="bg-sky-950/50 border border-sky-800/50 p-1.5">
                <div className="text-[8px] font-bold text-sky-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sky-400 animate-pulse shrink-0" />
                  <span>Real-Time</span>
                </div>
                <div className="text-xs font-black text-amber-300 font-mono mt-0.5 tracking-tight">
                  {liveTouchTime?.time || touchedLocation.localTime}
                </div>
                <div className="text-[8px] font-bold text-sky-200/90 truncate mt-0.5" title={touchedLocation.timeZoneName}>
                  {touchedLocation.timeZoneName}
                </div>
                <div className="text-[7.5px] text-white/50 font-mono">
                  {touchedLocation.utcOffset}
                </div>
              </div>

              {/* Real-time Altitude Elevation */}
              <div className="bg-emerald-950/50 border border-emerald-800/50 p-1.5">
                <div className="text-[8px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                  <Mountain className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Altitude (MSL)</span>
                </div>
                <div className="text-xs font-black text-emerald-300 font-mono mt-0.5">
                  {(touchedLocation.altitudeMeters ?? 0).toLocaleString()} m
                </div>
                <div className="text-[9px] text-emerald-200/90 font-mono mt-0.5">
                  ({(touchedLocation.altitudeFeet ?? 0).toLocaleString()} ft)
                </div>
                <div className="text-[7.5px] text-emerald-400/70 font-mono truncate" title={touchedLocation.altitudeSource || "Elevation Model"}>
                  {touchedLocation.altitudeSource || "Elevation Model"}
                </div>
              </div>
            </div>

            {/* Tourist Relocate Action */}
            <div className="bg-amber-950/30 border border-amber-500/30 p-1.5">
              <div className="text-[8.5px] font-bold text-amber-300 uppercase flex items-center gap-1 mb-1">
                <span>📍</span> Relocate Tourist Here:
              </div>
              <div className="flex gap-1">
                <select
                  value={relocateTouristId || selectedTouristId || tourists[0]?.id || ""}
                  onChange={(e) => setRelocateTouristId(e.target.value)}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="bg-black/90 text-white text-[9px] font-mono border border-white/20 px-1 py-0.5 flex-1 rounded-none outline-none"
                >
                  {tourists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status.toUpperCase()})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onClick={() => {
                    const idToMove = relocateTouristId || selectedTouristId || tourists[0]?.id;
                    if (idToMove) {
                      performRelocation(idToMove, touchedLocation.lat, touchedLocation.lng);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-black font-black text-[9px] uppercase px-2 py-0.5 transition-colors cursor-pointer shrink-0"
                  title="Move selected tourist to this exact spot"
                >
                  Set
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[7.5px] text-white/40 font-mono pt-1 mt-1 border-t border-white/5">
              <span className="text-emerald-400/80">● High-Precision WGS 84</span>
              <span className="text-sky-300/80 flex items-center gap-1">
                <Move className="w-2.5 h-2.5 text-amber-300" /> Touch or drag to move
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locating Coordinates Status Badge in Down Corner */}
      {isFlying && (
        <div className="absolute bottom-3 right-3 pointer-events-none z-[1100] flex items-center gap-2 bg-black/95 px-3 py-1.5 border border-sky-500/60 shadow-2xl backdrop-blur-md">
          <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 border border-dashed border-sky-400 rounded-full animate-spin" />
            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.15em] font-black text-sky-300">
            Locating Coordinates via Google Maps • 17x Street Focus
          </span>
        </div>
      )}

      {/* Bottom info helper with 3D status */}
      <div className="absolute bottom-2 left-3 z-[1000] pointer-events-none hidden sm:flex items-center gap-3 bg-black/85 backdrop-blur-sm border border-white/10 px-2.5 py-1 text-[9px] text-white/60">
        <span className="text-white/40 font-bold uppercase">CLICK MAP:</span>
        <span className="text-sky-300 font-bold">Reverse Geocode & Relocate</span>
        <span className="text-white/20">|</span>
        <span className="text-white/40 font-bold uppercase">MODE:</span>
        <span className="text-emerald-300 font-bold uppercase">{layerMode.replace("-", " ")}</span>
        <span className="text-white/20">|</span>
        <span className="text-white/40 font-bold uppercase">VIEW:</span>
        <span className={is3DMode ? "text-sky-300 font-black" : "text-white/60"}>
          {is3DMode ? `3D (${pitch}° TILT, ${Math.round(bearing)}° ROT)` : "2D TOP-DOWN"}
        </span>
      </div>

      {/* 3D Perspective Wrapper & Leaflet Map Container */}
      <div
        className={`w-full h-full relative overflow-hidden flex-1 ${
          isRelocateMode ? "cursor-crosshair" : ""
        }`}
        style={{
          perspective: is3DMode ? "1000px" : "none",
          perspectiveOrigin: "50% 60%",
        }}
      >
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{
            height: "100%",
            width: "100%",
            transform: is3DMode
              ? `rotateX(${pitch}deg) rotateZ(${bearing}deg) scale(1.18)`
              : "none",
            transformOrigin: "50% 50%",
            transition: isOrbiting
              ? "none"
              : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
            willChange: is3DMode ? "transform" : "auto",
          }}
        />
      </div>
    </div>
  );
}
