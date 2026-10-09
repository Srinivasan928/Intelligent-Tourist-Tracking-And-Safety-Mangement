import { useMemo, useState } from "react";
import * as d3 from "d3";
import { Tourist, BatteryDataPoint } from "../types";
import { 
  Battery, 
  Zap, 
  AlertTriangle, 
  TrendingDown, 
  Clock, 
  Radio, 
  ShieldAlert, 
  Activity,
  Calendar,
  Sparkles,
  Info
} from "lucide-react";

interface BatteryConsumptionChartProps {
  tourist: Tourist;
  compact?: boolean;
  title?: string;
  showDiagnosticsDetails?: boolean;
}

export function getOrCreateBatteryHistory(tourist?: Tourist | null): BatteryDataPoint[] {
  if (!tourist) return [];
  if (Array.isArray(tourist.batteryHistory) && tourist.batteryHistory.length >= 10) {
    const raw = tourist.batteryHistory.slice(-10);
    return raw.map((pt, i) => {
      const prevVal = i > 0 ? raw[i - 1].battery : pt.battery;
      const drainDelta = Math.max(0, prevVal - pt.battery);
      return {
        ...pt,
        drainDelta,
        isCriticalDrop: drainDelta > 5,
      };
    });
  }

  const curr = typeof tourist.battery === "number" ? tourist.battery : 50;
  const isFailing = curr <= 20 || tourist.status === "danger";
  const isHighDrain = curr <= 40 || tourist.status === "warning";
  const points: BatteryDataPoint[] = [];
  const count = 10;
  const now = Date.now();
  const intervalMin = 6; // 6 minutes per update cycle

  let base = isFailing ? Math.min(68, curr + 40) : isHighDrain ? Math.min(78, curr + 26) : Math.min(98, curr + 12);
  let previousVal = base;

  for (let i = 0; i < count; i++) {
    let val: number;
    if (i === 0) {
      val = base;
    } else if (i === count - 1) {
      val = curr;
    } else {
      // Create realistic depletion trajectory with occasional critical sudden drop (> 5%)
      const progress = i / (count - 1);
      const expected = Math.round(base - (base - curr) * progress);
      // If failing or warning, introduce a sudden spike in drain at update #6 or #7
      if ((isFailing || isHighDrain) && (i === 6 || i === 7)) {
        val = Math.max(curr + 2, previousVal - 7); // 7% drop in a single cycle!
      } else {
        const stepDrop = Math.max(1, Math.min(5, Math.round((previousVal - curr) / (count - i))));
        val = Math.max(curr + 1, previousVal - stepDrop);
      }
    }

    const drainDelta = i > 0 ? Math.max(0, previousVal - val) : 0;
    const isCriticalDrop = drainDelta > 5;
    previousVal = val;

    const timeStr = new Date(now - (count - 1 - i) * intervalMin * 60 * 1000).toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
    const voltage = Number((3.3 + (val / 100) * 0.88).toFixed(2));

    points.push({
      index: i + 1,
      label: i === count - 1 ? "Now" : `U-${count - 1 - i}`,
      time: timeStr,
      battery: val,
      voltage,
      drainDelta,
      isCriticalDrop,
    });
  }

  return points;
}

export default function BatteryConsumptionChart({ tourist }: BatteryConsumptionChartProps) {
  const [activeTab, setActiveTab] = useState<"forecast" | "depletion_rate">("forecast");
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const chartData = useMemo(() => getOrCreateBatteryHistory(tourist), [tourist]);

  if (!tourist || !chartData || chartData.length === 0) {
    return (
      <div className="bg-brand-panel p-4 rounded-none border border-white/10 text-white/40 text-xs font-mono">
        No telemetry battery data available.
      </div>
    );
  }

  const latest = chartData[chartData.length - 1];
  const oldest = chartData[0];
  const totalDrop = Math.max(0, (oldest?.battery || 0) - (latest?.battery || 0));
  const denominator = Math.max(1, chartData.length - 1);
  const avgDrainPerCycle = totalDrop / denominator;
  const updateIntervalMin = 6; // 6 minutes per telemetry ping
  const historicalMinutes = denominator * updateIntervalMin; // 54 min

  // Depletion rate in % per minute
  const drainRatePerMin = Math.max(0.08, totalDrop / historicalMinutes);
  const drainRatePerHour = (drainRatePerMin * 60).toFixed(1);

  // Critical depletion events count (> 5% drop in 1 cycle)
  const criticalEvents = chartData.filter((d) => (d.drainDelta || 0) > 5);

  // 30-Minute Future Forecast Calculation
  const forecastMinutes = 30;
  const currentBattery = latest.battery;
  const projectedLossIn30m = drainRatePerMin * forecastMinutes;
  const forecastBattery30m = Math.max(0, Math.round(currentBattery - projectedLossIn30m));

  // Time until complete battery exhaustion or communication blackout (< 10% cutoff)
  const commsLossThreshold = 10;
  let minutesToCommsLoss = 0;
  if (currentBattery > commsLossThreshold && drainRatePerMin > 0) {
    minutesToCommsLoss = Math.round((currentBattery - commsLossThreshold) / drainRatePerMin);
  }

  const isCommsLossImminent = currentBattery <= 20 || (minutesToCommsLoss > 0 && minutesToCommsLoss <= 60);

  // Forecast data points extending 30 minutes into future (interpolated at +10m, +20m, +30m)
  const forecastPoints = [
    {
      minuteOffset: historicalMinutes,
      timeLabel: "Now",
      battery: currentBattery,
      isForecast: false,
    },
    {
      minuteOffset: historicalMinutes + 10,
      timeLabel: "+10m",
      battery: Math.max(0, Math.round(currentBattery - drainRatePerMin * 10)),
      isForecast: true,
    },
    {
      minuteOffset: historicalMinutes + 20,
      timeLabel: "+20m",
      battery: Math.max(0, Math.round(currentBattery - drainRatePerMin * 20)),
      isForecast: true,
    },
    {
      minuteOffset: historicalMinutes + 30,
      timeLabel: "+30m",
      battery: forecastBattery30m,
      isForecast: true,
    },
  ];

  // D3 Coordinate Scales & Path Generation
  const svgWidth = 620;
  const svgHeight = 220;
  const padLeft = 46;
  const padRight = 54;
  const padTop = 26;
  const padBottom = 38;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // X scale spans from t = 0 (oldest update) to t = historicalMinutes + 30 (forecast horizon)
  const totalTimeSpan = historicalMinutes + forecastMinutes; // 54 + 30 = 84 min
  const xScale = d3.scaleLinear().domain([0, totalTimeSpan]).range([padLeft, padLeft + plotWidth]);
  const yScale = d3.scaleLinear().domain([0, 100]).range([padTop + plotHeight, padTop]);

  // Historical data points with calculated minute offsets
  const historicalCoords = chartData.map((d, i) => {
    const minuteOffset = i * updateIntervalMin;
    const cx = xScale(minuteOffset);
    const cy = yScale(d.battery);
    return {
      ...d,
      minuteOffset,
      cx,
      cy,
    };
  });

  // Forecast coordinates mapped with D3
  const forecastCoords = forecastPoints.map((fp) => ({
    ...fp,
    cx: xScale(fp.minuteOffset),
    cy: yScale(fp.battery),
  }));

  // D3 Line & Area Generators
  const historicalLineGen = d3
    .line<(typeof historicalCoords)[0]>()
    .x((d) => d.cx)
    .y((d) => d.cy)
    .curve(d3.curveMonotoneX);

  const historicalAreaGen = d3
    .area<(typeof historicalCoords)[0]>()
    .x((d) => d.cx)
    .y0(padTop + plotHeight)
    .y1((d) => d.cy)
    .curve(d3.curveMonotoneX);

  const forecastLineGen = d3
    .line<(typeof forecastCoords)[0]>()
    .x((d) => d.cx)
    .y((d) => d.cy)
    .curve(d3.curveLinear);

  const forecastAreaGen = d3
    .area<(typeof forecastCoords)[0]>()
    .x((d) => d.cx)
    .y0(padTop + plotHeight)
    .y1((d) => d.cy)
    .curve(d3.curveLinear);

  const historicalLinePath = historicalLineGen(historicalCoords) || "";
  const historicalAreaPath = historicalAreaGen(historicalCoords) || "";
  const forecastLinePath = forecastLineGen(forecastCoords) || "";
  const forecastAreaPath = forecastAreaGen(forecastCoords) || "";

  // D3 Depletion Rate Bar Chart Coordinates (Rate Velocity Tab)
  const maxDrain = Math.max(6, d3.max<BatteryDataPoint, number>(chartData, (d: BatteryDataPoint) => d.drainDelta || 0) ?? 6);
  const rateYScale = d3.scaleLinear().domain([0, maxDrain + 2]).range([padTop + plotHeight, padTop]);

  const touristBattery = typeof tourist.battery === "number" ? tourist.battery : 50;
  const isCritical = touristBattery <= 20 || tourist.status === "danger";
  const isWarning = touristBattery <= 45 || tourist.status === "warning";
  const strokeColor = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#10b981";
  const fillColor = isCritical ? "rgba(239,68,68,0.18)" : isWarning ? "rgba(245,158,11,0.18)" : "rgba(16,185,129,0.18)";

  return (
    <div className="bg-brand-panel p-4 rounded-none border border-white/10 font-mono">
      
      {/* Top 5 Diagnostic Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
        
        {/* Card 1: SOC Charge */}
        <div className="bg-brand-bg p-3 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-[9px] uppercase font-bold">
            <span>Current Charge</span>
            <Battery className={`w-3.5 h-3.5 ${isCritical ? "text-brand-red animate-pulse" : "text-emerald-400"}`} />
          </div>
          <div className="text-xl font-black mt-1 text-white flex items-baseline gap-1">
            <span className={isCritical ? "text-brand-red animate-pulse" : isWarning ? "text-amber-400" : "text-emerald-400"}>
              {tourist.battery}%
            </span>
            <span className="text-[9px] text-white/40">SOC</span>
          </div>
          <span className="text-[8px] text-white/40 mt-1">Voltage: {latest.voltage}V</span>
        </div>

        {/* Card 2: Depletion Rate */}
        <div className="bg-brand-bg p-3 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-[9px] uppercase font-bold">
            <span>Depletion Rate</span>
            <TrendingDown className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-xl font-black mt-1 text-white flex items-baseline gap-1">
            <span className="text-orange-400">-{drainRatePerHour}%</span>
            <span className="text-[9px] text-white/40">/ hr</span>
          </div>
          <span className="text-[8px] text-white/40 mt-1">Avg: -{avgDrainPerCycle.toFixed(1)}% / ping</span>
        </div>

        {/* Card 3: +30m D3 Forecast */}
        <div className="bg-brand-bg p-3 border border-sky-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 bg-sky-500/10 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between text-sky-400 text-[9px] uppercase font-bold">
            <span>+30m Forecast</span>
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-black mt-1 text-white flex items-baseline gap-1">
            <span className={forecastBattery30m <= 15 ? "text-red-400 font-black animate-pulse" : "text-sky-300"}>
              {forecastBattery30m}%
            </span>
            <span className="text-[9px] text-white/40">Est. SOC</span>
          </div>
          <span className="text-[8px] text-sky-400/80 mt-1 flex items-center gap-1">
            <span>📉 Projected drop: -{Math.round(projectedLossIn30m)}%</span>
          </span>
        </div>

        {/* Card 4: Critical Depletion Events (>5% Drop) */}
        <div className={`p-3 border flex flex-col justify-between ${
          criticalEvents.length > 0 
            ? "bg-red-950/30 border-red-500/50" 
            : "bg-brand-bg border-white/10"
        }`}>
          <div className="flex items-center justify-between text-[9px] uppercase font-bold">
            <span className={criticalEvents.length > 0 ? "text-red-400" : "text-white/50"}>
              Critical Drops (&gt;5%)
            </span>
            <AlertTriangle className={`w-3.5 h-3.5 ${criticalEvents.length > 0 ? "text-red-400 animate-bounce" : "text-white/30"}`} />
          </div>
          <div className="text-xl font-black mt-1 flex items-baseline gap-1">
            <span className={criticalEvents.length > 0 ? "text-red-400" : "text-white"}>
              {criticalEvents.length}
            </span>
            <span className="text-[9px] text-white/40">Events</span>
          </div>
          <span className="text-[8px] text-red-300/80 mt-1 truncate">
            {criticalEvents.length > 0 ? `Max: -${d3.max<BatteryDataPoint, number>(criticalEvents, (d: BatteryDataPoint) => d.drainDelta || 0) ?? 0}% single drop` : "None detected"}
          </span>
        </div>

        {/* Card 5: Comms Loss Horizon */}
        <div className={`p-3 border flex flex-col justify-between ${
          isCommsLossImminent 
            ? "bg-red-950/40 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.25)]" 
            : "bg-brand-bg border-white/10"
        }`}>
          <div className="flex items-center justify-between text-[9px] uppercase font-bold">
            <span className={isCommsLossImminent ? "text-red-400" : "text-white/50"}>
              Comms Blackout
            </span>
            <Radio className={`w-3.5 h-3.5 ${isCommsLossImminent ? "text-red-400 animate-pulse" : "text-emerald-400"}`} />
          </div>
          <div className="text-sm font-black mt-1 uppercase truncate">
            {currentBattery <= commsLossThreshold ? (
              <span className="text-red-400 animate-pulse">OFFLINE / IMMINENT</span>
            ) : minutesToCommsLoss > 0 && minutesToCommsLoss <= 120 ? (
              <span className="text-red-400">~{minutesToCommsLoss} MIN</span>
            ) : (
              <span className="text-emerald-400">&gt; 3.5 HOURS</span>
            )}
          </div>
          <span className="text-[8px] text-white/40 mt-1">10% threshold cutoff</span>
        </div>
      </div>

      {/* View Toggle Bar (D3 30m Forecast Line vs Depletion Rate Velocity) */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("forecast")}
            className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
              activeTab === "forecast"
                ? "bg-sky-500/20 text-sky-300 border-sky-400 shadow-sm"
                : "bg-white/5 text-white/50 border-white/10 hover:text-white"
            }`}
          >
            📉 Discharge Curve + 30m Forecast
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("depletion_rate")}
            className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
              activeTab === "depletion_rate"
                ? "bg-orange-500/20 text-orange-300 border-orange-400 shadow-sm"
                : "bg-white/5 text-white/50 border-white/10 hover:text-white"
            }`}
          >
            📊 Depletion Rate Trend (% per cycle)
          </button>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[9px] text-white/60">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
            <span>Actual (54m)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-400 inline-block" />
            <span className="text-sky-300 font-bold">D3 Forecast (+30m)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-ping" />
            <span className="text-red-400 font-bold">Critical Drop (&gt;5%)</span>
          </div>
        </div>
      </div>

      {/* Interactive D3 Render Canvas */}
      <div className="relative border border-white/10 bg-black/60 p-2 overflow-x-auto">
        
        {activeTab === "forecast" ? (
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 overflow-visible">
            <defs>
              {/* Historical Area Gradient */}
              <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>

              {/* Forecast Area Gradient */}
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>

              {/* Critical Zone Glow */}
              <linearGradient id="criticalZone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Critical Communication Blackout Zone (<15%) */}
            <rect
              x={padLeft}
              y={yScale(15)}
              width={plotWidth}
              height={padTop + plotHeight - yScale(15)}
              fill="url(#criticalZone)"
              stroke="#ef4444"
              strokeDasharray="2 4"
              strokeWidth="0.8"
            />
            <text
              x={padLeft + 6}
              y={yScale(15) - 4}
              fill="#ef4444"
              fontSize="8"
              fontWeight="bold"
              fontFamily="monospace"
            >
              ⚠️ CRITICAL COMM LOSS HORIZON (&le;15% SOC)
            </text>

            {/* Y-Axis Gridlines (D3 computed ticks) */}
            {[0, 20, 40, 60, 80, 100].map((pct) => {
              const y = yScale(pct);
              return (
                <g key={pct}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotWidth}
                    y2={y}
                    stroke="rgba(255,255,255,0.07)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Division Line Between Historical & Forecast Zone */}
            <line
              x1={xScale(historicalMinutes)}
              y1={padTop}
              x2={xScale(historicalMinutes)}
              y2={padTop + plotHeight}
              stroke="#38bdf8"
              strokeDasharray="2 2"
              strokeWidth="1.2"
            />
            <text
              x={xScale(historicalMinutes)}
              y={padTop - 8}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize="9"
              fontWeight="black"
              fontFamily="monospace"
            >
              CURRENT TIME (NOW)
            </text>

            {/* Historical Area & Line */}
            <path d={historicalAreaPath} fill="url(#histGradient)" />
            <path d={historicalLinePath} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* D3 DASHED FORECAST LINE EXTENDING 30 MINUTES INTO FUTURE */}
            <path d={forecastAreaPath} fill="url(#forecastGradient)" />
            <path
              d={forecastLinePath}
              fill="none"
              stroke={forecastBattery30m <= 15 ? "#ef4444" : "#38bdf8"}
              strokeWidth="2.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />

            {/* Historical Data Points */}
            {historicalCoords.map((pt, i) => {
              const isLast = i === historicalCoords.length - 1;
              const hasCritDrop = (pt.drainDelta || 0) > 5;
              return (
                <g 
                  key={i} 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Critical Drop Indicator Pulse */}
                  {hasCritDrop && (
                    <circle
                      cx={pt.cx}
                      cy={pt.cy}
                      r="11"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      className="animate-ping"
                      style={{ transformOrigin: `${pt.cx}px ${pt.cy}px` }}
                    />
                  )}

                  {/* Dot */}
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r={hasCritDrop ? 6 : isLast ? 5 : 3.5}
                    fill={hasCritDrop ? "#ef4444" : isLast ? strokeColor : "#0b101b"}
                    stroke={hasCritDrop ? "#fee2e2" : strokeColor}
                    strokeWidth={hasCritDrop ? 2.5 : 2}
                  />

                  {/* CRITICAL DEPLETION EVENT ICON & BADGE (>5% DROP IN 1 CYCLE) */}
                  {hasCritDrop && (
                    <g transform={`translate(${pt.cx - 10}, ${pt.cy - 24})`}>
                      {/* Red triangle marker */}
                      <path
                        d="M 10 0 L 18 14 L 2 14 Z"
                        fill="#ef4444"
                        stroke="#7f1d1d"
                        strokeWidth="1"
                      />
                      <text
                        x="10"
                        y="12"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="8"
                        fontWeight="black"
                      >
                        !
                      </text>
                      {/* Micro drop tag */}
                      <rect
                        x="-2"
                        y="-12"
                        width="24"
                        height="10"
                        fill="#991b1b"
                        stroke="#ef4444"
                        strokeWidth="0.8"
                      />
                      <text
                        x="10"
                        y="-4"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="7"
                        fontWeight="black"
                        fontFamily="monospace"
                      >
                        -{pt.drainDelta}%
                      </text>
                    </g>
                  )}

                  {/* X-Axis Time Label */}
                  <text
                    x={pt.cx}
                    y={padTop + plotHeight + 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}

            {/* Forecast Data Points with Future 30m Marker */}
            {forecastCoords.slice(1).map((fp, i) => (
              <g key={i}>
                <circle
                  cx={fp.cx}
                  cy={fp.cy}
                  r="4"
                  fill="#0369a1"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="2 2"
                />
                <text
                  x={fp.cx}
                  y={padTop + plotHeight + 16}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {fp.timeLabel}
                </text>
              </g>
            ))}

            {/* End of 30-min Forecast Flag */}
            {(() => {
              const endPt = forecastCoords[forecastCoords.length - 1];
              return (
                <g transform={`translate(${endPt.cx + 6}, ${endPt.cy - 12})`}>
                  <rect
                    x="0"
                    y="0"
                    width="44"
                    height="22"
                    fill="#082f49"
                    stroke={forecastBattery30m <= 15 ? "#ef4444" : "#38bdf8"}
                    strokeWidth="1.2"
                  />
                  <text
                    x="22"
                    y="10"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="7"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    +30m PROJ
                  </text>
                  <text
                    x="22"
                    y="18"
                    textAnchor="middle"
                    fill={forecastBattery30m <= 15 ? "#ef4444" : "#ffffff"}
                    fontSize="9"
                    fontWeight="black"
                    fontFamily="monospace"
                  >
                    {forecastBattery30m}%
                  </text>
                </g>
              );
            })()}
          </svg>
        ) : (
          /* Depletion Rate Trend Bar / Spike Velocity View */
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 overflow-visible">
            {/* Gridlines for % Drop */}
            {[0, 2, 4, 6, 8, 10].map((drop) => {
              const y = rateYScale(drop);
              return (
                <g key={drop}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotWidth}
                    y2={y}
                    stroke="rgba(255,255,255,0.07)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    -{drop}%
                  </text>
                </g>
              );
            })}

            {/* 5% Critical Drop Threshold Line */}
            <line
              x1={padLeft}
              y1={rateYScale(5)}
              x2={padLeft + plotWidth}
              y2={rateYScale(5)}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeWidth="1.5"
            />
            <text
              x={padLeft + 8}
              y={rateYScale(5) - 4}
              fill="#ef4444"
              fontSize="8"
              fontWeight="black"
              fontFamily="monospace"
            >
              CRITICAL DEPLETION THRESHOLD (&gt;5% PER CYCLE)
            </text>

            {/* Depletion Bars */}
            {historicalCoords.map((pt, i) => {
              const delta = pt.drainDelta || 0;
              const barHeight = padTop + plotHeight - rateYScale(delta);
              const barWidth = 22;
              const isSpike = delta > 5;
              return (
                <g key={i}>
                  <rect
                    x={pt.cx - barWidth / 2}
                    y={rateYScale(delta)}
                    width={barWidth}
                    height={Math.max(2, barHeight)}
                    fill={isSpike ? "#ef4444" : "rgba(249,115,22,0.6)"}
                    stroke={isSpike ? "#fca5a5" : "#f97316"}
                    strokeWidth="1"
                  />
                  {isSpike && (
                    <g transform={`translate(${pt.cx - 6}, ${rateYScale(delta) - 16})`}>
                      <text x="6" y="10" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="bold">
                        ⚠️
                      </text>
                    </g>
                  )}
                  <text
                    x={pt.cx}
                    y={rateYScale(delta) - 3}
                    textAnchor="middle"
                    fill={isSpike ? "#ef4444" : "#f97316"}
                    fontSize="8"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    -{delta}%
                  </text>
                  <text
                    x={pt.cx}
                    y={padTop + plotHeight + 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Hovered point details popup */}
        {hoveredPoint && (
          <div className="absolute top-3 right-3 bg-black/95 border border-sky-400 p-2 text-white shadow-2xl text-[10px] pointer-events-none z-20">
            <div className="text-sky-300 font-bold uppercase">{hoveredPoint.label} ({hoveredPoint.time})</div>
            <div>Charge: <strong>{hoveredPoint.battery}%</strong></div>
            <div>Cell Voltage: {hoveredPoint.voltage}V</div>
            <div className={hoveredPoint.drainDelta > 5 ? "text-red-400 font-black" : "text-white/60"}>
              Cycle Drain: -{hoveredPoint.drainDelta}% {hoveredPoint.drainDelta > 5 ? "⚠️ CRITICAL DROP" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Critical Events Warning Alert Box */}
      {criticalEvents.length > 0 && (
        <div className="mt-3 p-2.5 bg-red-950/40 border border-red-500/50 flex items-start gap-2 text-red-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="flex-1">
            <div className="font-black text-red-400 text-[10px] uppercase tracking-wider">
              {criticalEvents.length} CRITICAL DEPLETION EVENT(S) DETECTED (&gt;5% SINGLE-CYCLE DROP)
            </div>
            <p className="text-[10px] text-white/80 mt-0.5">
              Rapid discharge detected on {tourist.name}&apos;s device. Possible cold exposure, GPS transmitter spike, or hardware thermal distress. Immediate radio contact recommended before projected communication cutoff.
            </p>
          </div>
        </div>
      )}

      {/* Table of 10 Updates with Critical Event Markings */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[10px] font-mono border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase">
              <th className="py-1 px-2">Update</th>
              <th className="py-1 px-2">Timestamp</th>
              <th className="py-1 px-2">SOC Charge</th>
              <th className="py-1 px-2">Voltage</th>
              <th className="py-1 px-2 text-right">Drain Delta</th>
              <th className="py-1 px-2 text-center">Diagnostic Event</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white/80">
            {chartData.map((pt) => {
              const hasCritDrop = (pt.drainDelta || 0) > 5;
              return (
                <tr key={pt.index} className={`hover:bg-white/5 ${hasCritDrop ? "bg-red-950/20" : ""}`}>
                  <td className="py-1.5 px-2 font-bold text-sky-400">
                    #{pt.index} ({pt.label})
                  </td>
                  <td className="py-1.5 px-2 text-white/50">{pt.time}</td>
                  <td className="py-1.5 px-2 font-bold">
                    <span className={`text-xs font-black font-mono ${tourist.battery <= 20 ? "text-brand-red animate-pulse" : "text-white"}`}>
                      {pt.battery}%
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-white/70">{pt.voltage} V</td>
                  <td className="py-1.5 px-2 text-right">
                    {pt.drainDelta ? (
                      <span className={`font-bold ${hasCritDrop ? "text-red-400 font-black text-xs" : "text-orange-400"}`}>
                        -{pt.drainDelta}%
                      </span>
                    ) : (
                      <span className="text-white/30">0%</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {hasCritDrop ? (
                      <span className="inline-flex items-center gap-1 bg-red-950 text-red-300 border border-red-500/60 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider animate-pulse">
                        <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                        CRITICAL DROP (&gt;5%)
                      </span>
                    ) : (
                      <span className="text-white/30 text-[9px]">Nominal</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
