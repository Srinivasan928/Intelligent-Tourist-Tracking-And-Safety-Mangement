import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { Tourist, BatteryDataPoint } from "../types";
import { Battery, Zap, AlertTriangle, TrendingDown, ArrowDownRight } from "lucide-react";

interface TouristBatteryLineChartProps {
  tourist: Tourist;
}

export function getTouristBatteryHistory(tourist?: Tourist | null): BatteryDataPoint[] {
  if (!tourist) return [];

  // If already populated on the tourist with 10 or more points, take last 10
  if (Array.isArray(tourist.batteryHistory) && tourist.batteryHistory.length >= 10) {
    const raw = tourist.batteryHistory.slice(-10);
    return raw.map((pt, i) => {
      const prevVal = i > 0 ? raw[i - 1].battery : pt.battery;
      const drainDelta = Math.max(0, prevVal - pt.battery);
      return {
        ...pt,
        index: i + 1,
        drainDelta,
        isCriticalDrop: drainDelta > 5,
      };
    });
  }

  // If tourist has some history (1..9 points), normalize to 10 points
  if (Array.isArray(tourist.batteryHistory) && tourist.batteryHistory.length > 0) {
    const existing = tourist.batteryHistory;
    const curr = typeof tourist.battery === "number" ? tourist.battery : existing[existing.length - 1].battery;
    const points: BatteryDataPoint[] = [];
    const count = 10;
    const now = Date.now();
    const intervalMin = 6;
    const startVal = Math.min(100, Math.max(curr + 15, existing[0].battery + 5));

    for (let i = 0; i < count; i++) {
      const remainingExistingIndex = existing.length - (count - i);
      let val: number;
      if (remainingExistingIndex >= 0 && remainingExistingIndex < existing.length) {
        val = existing[remainingExistingIndex].battery;
      } else {
        const progress = i / (count - 1);
        val = Math.round(startVal - (startVal - curr) * progress);
      }
      val = Math.max(0, Math.min(100, val));
      const prev = i > 0 ? points[i - 1].battery : val;
      const drain = Math.max(0, prev - val);
      points.push({
        index: i + 1,
        label: i === count - 1 ? "Now" : `U-${count - 1 - i}`,
        time: new Date(now - (count - 1 - i) * intervalMin * 60 * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        battery: val,
        voltage: Number((3.3 + (val / 100) * 0.88).toFixed(2)),
        drainDelta: drain,
        isCriticalDrop: drain > 5,
      });
    }
    return points;
  }

  // Fallback: Generate realistic 10-point telemetry history ending with current battery
  const curr = typeof tourist.battery === "number" ? tourist.battery : 50;
  const isFailing = curr <= 20 || tourist.status === "danger";
  const isHighDrain = curr <= 40 || tourist.status === "warning";
  const points: BatteryDataPoint[] = [];
  const count = 10;
  const now = Date.now();
  const intervalMin = 6;

  const base = isFailing ? Math.min(68, curr + 32) : isHighDrain ? Math.min(82, curr + 22) : Math.min(98, curr + 12);
  let previousVal = base;

  for (let i = 0; i < count; i++) {
    let val: number;
    if (i === 0) {
      val = base;
    } else if (i === count - 1) {
      val = curr;
    } else {
      const progress = i / (count - 1);
      const expected = Math.round(base - (base - curr) * progress);
      if ((isFailing || isHighDrain) && (i === 6 || i === 7)) {
        val = Math.max(curr + 2, previousVal - 7); // Sudden 7% drop spike
      } else {
        const stepDrop = Math.max(1, Math.min(4, Math.round((previousVal - curr) / (count - i))));
        val = Math.max(curr + 1, previousVal - stepDrop);
      }
    }

    const drainDelta = i > 0 ? Math.max(0, previousVal - val) : 0;
    const isCriticalDrop = drainDelta > 5;
    previousVal = val;

    const timeStr = new Date(now - (count - 1 - i) * intervalMin * 60 * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
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

export default function TouristBatteryLineChart({ tourist }: TouristBatteryLineChartProps) {
  const chartData = useMemo(() => getTouristBatteryHistory(tourist), [tourist]);

  if (!tourist || chartData.length === 0) {
    return (
      <div className="bg-brand-bg p-3 border border-white/10 text-white/40 text-[10px] font-mono text-center">
        No battery telemetry available
      </div>
    );
  }

  const latest = chartData[chartData.length - 1];
  const oldest = chartData[0];
  const totalDrop = Math.max(0, (oldest?.battery || 0) - (latest?.battery || 0));
  const avgDrain = (totalDrop / Math.max(1, chartData.length - 1)).toFixed(1);
  const criticalDrops = chartData.filter((d) => (d.drainDelta || 0) > 5);

  const currentBattery = typeof tourist.battery === "number" ? tourist.battery : latest.battery;
  const isCritical = currentBattery <= 20 || tourist.status === "danger";
  const isWarning = currentBattery <= 40 || tourist.status === "warning";

  const lineColor = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#10b981";

  // Calculate tight dynamic Y-axis domain
  const minVal = Math.min(...chartData.map((d) => d.battery));
  const maxVal = Math.max(...chartData.map((d) => d.battery));
  const yMin = Math.max(0, Math.floor((minVal - 6) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((maxVal + 6) / 5) * 5);

  return (
    <div className="bg-brand-bg border border-white/10 p-3 rounded-none font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Battery
            className={`w-3.5 h-3.5 ${
              isCritical ? "text-brand-red animate-pulse" : isWarning ? "text-amber-400" : "text-emerald-400"
            }`}
          />
          <span className="text-[9px] font-black uppercase text-white/70 tracking-wider">
            BATTERY HISTORY (LAST 10 UPDATES)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs font-black font-mono ${
              isCritical ? "text-brand-red animate-pulse" : isWarning ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {currentBattery}%
          </span>
          <span className="text-[8px] text-white/40 uppercase font-bold">SOC</span>
        </div>
      </div>

      {/* Visual Warning Pulse for Battery < 15% */}
      {currentBattery < 15 && (
        <div className="mb-2 bg-red-950/80 border border-brand-red/80 px-2 py-1.5 flex items-center justify-between text-[9px] text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.35)] animate-pulse">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-brand-red shrink-0" />
            <span className="uppercase tracking-wider font-black">CRITICAL BATTERY &lt; 15%</span>
          </div>
          <span className="text-[8px] font-black uppercase text-red-300 tracking-widest bg-black/70 px-1.5 py-0.5 border border-red-500/40">
            HAPTIC BUZZ ACTIVE
          </span>
        </div>
      )}

      {/* Recharts Historical Battery Consumption Line Chart */}
      <div className="w-full h-36 relative select-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 10, left: -22, bottom: 2 }}
          >
            <CartesianGrid stroke="#ffffff" strokeOpacity={0.06} strokeDasharray="3 3" vertical={false} />
            
            <XAxis
              dataKey="label"
              stroke="#ffffff"
              strokeOpacity={0.4}
              fontSize={8}
              tickLine={false}
              axisLine={{ stroke: "#ffffff", strokeOpacity: 0.15 }}
            />
            
            <YAxis
              domain={[yMin, yMax]}
              stroke="#ffffff"
              strokeOpacity={0.4}
              fontSize={8}
              tickLine={false}
              axisLine={{ stroke: "#ffffff", strokeOpacity: 0.15 }}
              unit="%"
            />

            {/* Critical 15% Battery Line Warning Reference */}
            {yMin <= 15 && yMax >= 15 && (
              <ReferenceLine
                y={15}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                strokeOpacity={0.9}
              />
            )}

            {/* 20% Warning Reference Line */}
            {yMin <= 20 && yMax >= 20 && (
              <ReferenceLine
                y={20}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                strokeOpacity={0.5}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as BatteryDataPoint;
                  return (
                    <div className="bg-black/95 border border-sky-400/80 px-2 py-1.5 shadow-xl text-[9px] font-mono text-white rounded-none">
                      <div className="text-sky-300 font-bold uppercase flex justify-between gap-3">
                        <span>{data.label}</span>
                        <span className="text-white/50">{data.time}</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-3 font-bold">
                        <span className="text-white/70">Charge:</span>
                        <span className={data.battery <= 20 ? "text-red-400 font-black" : "text-emerald-400"}>
                          {data.battery}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 text-white/60">
                        <span>Voltage:</span>
                        <span>{data.voltage}V</span>
                      </div>
                      {typeof data.drainDelta === "number" && (
                        <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-0.5 mt-0.5">
                          <span>Delta:</span>
                          <span className={data.drainDelta > 5 ? "text-red-400 font-black" : "text-amber-400 font-bold"}>
                            -{data.drainDelta}% {data.drainDelta > 5 ? "⚠️ SPURT" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Line
              type="monotone"
              dataKey="battery"
              stroke={lineColor}
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                if (cx === undefined || cy === undefined) return null;
                const isCrit = (payload?.drainDelta || 0) > 5;
                const isLast = index === chartData.length - 1;
                return (
                  <circle
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={isCrit ? 4.5 : isLast ? 3.5 : 2}
                    fill={isCrit ? "#ef4444" : isLast ? lineColor : "#000000"}
                    stroke={isCrit ? "#fecaca" : lineColor}
                    strokeWidth={isCrit ? 1.5 : 1}
                  />
                );
              }}
              activeDot={{
                r: 4.5,
                fill: lineColor,
                stroke: "#ffffff",
                strokeWidth: 1.5,
              }}
              isAnimationActive={true}
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Telemetry diagnostics summary row */}
      <div className="mt-2.5 pt-2 border-t border-white/10 grid grid-cols-3 gap-1.5 text-center text-[8px] font-mono">
        <div className="bg-black/40 p-1 border border-white/5">
          <span className="text-white/40 uppercase block">10-Cycle Drain</span>
          <span className="text-white font-bold flex items-center justify-center gap-0.5 mt-0.5">
            <ArrowDownRight className="w-2.5 h-2.5 text-orange-400 shrink-0" />
            -{totalDrop}%
          </span>
        </div>
        <div className="bg-black/40 p-1 border border-white/5">
          <span className="text-white/40 uppercase block">Avg Drain / Ping</span>
          <span className="text-white font-bold mt-0.5 block">
            -{avgDrain}%
          </span>
        </div>
        <div className="bg-black/40 p-1 border border-white/5">
          <span className="text-white/40 uppercase block">Voltage</span>
          <span className="text-sky-400 font-bold mt-0.5 block">
            {latest?.voltage || 3.8}V
          </span>
        </div>
      </div>

      {/* Critical rapid drop warning if detected in last 10 updates */}
      {criticalDrops.length > 0 && (
        <div className="mt-2 px-2 py-1 bg-red-950/40 border border-brand-red/50 flex items-center gap-1.5 text-[8px] text-red-300">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 animate-bounce" />
          <span className="font-bold tracking-wide uppercase">
            Spike Drop Detected (&gt;5% in single cycle) — Monitor SOC
          </span>
        </div>
      )}
    </div>
  );
}
