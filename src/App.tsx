import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Code2,
  Brain,
  Plus,
  X,
  Clock,
  Activity,
  Flame,
  Zap,
  Trophy,
  Calendar,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Download,
  Upload,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Database,
  Eye,
  Check,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  CartesianGrid,
} from 'recharts';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
} from 'firebase/firestore';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: 'AIzaSyA8J7Gr1HGZAI5kQ7hEwxjg9mPoTJHzcQE',
  authDomain: 'mindev-47f3b.firebaseapp.com',
  projectId: 'mindev-47f3b',
  storageBucket: 'mindev-47f3b.firebasestorage.app',
  messagingSenderId: '549283768808',
  appId: '1:549283768808:web:6530bdbc2ccd6eb82d1c5d',
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : '5mindev-tracker';

// --- Date & Time Formatting Utilities ---
const toDateKey = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayKey = () => toDateKey(new Date());

const getYesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
};

const parseDateKey = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatReadableDate = (dateKey) => {
  if (!dateKey) return '';
  const today = getTodayKey();
  const yesterday = getYesterdayKey();
  const d = parseDateKey(dateKey);
  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (dateKey === today) return `Today (${formatted})`;
  if (dateKey === yesterday) return `Yesterday (${formatted})`;
  return formatted;
};

const formatShortDay = (dateKey) => {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
};

const formatDurationBadge = (totalMinutes) => {
  const mins = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h 0m`;
  return `${m}m`;
};

const formatHoursDecimal = (totalMinutes) => {
  const hrs = (totalMinutes || 0) / 60;
  return hrs >= 10 ? hrs.toFixed(1) : hrs.toFixed(1);
};

// --- Deterministic Rich Demo Data Generator (Last 115 Days) ---
const generateSampleLogs = () => {
  const logs = {};
  const today = new Date();
  for (let i = 115; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateKey(d);

    // Deterministic pseudo-random based on day index
    const seed1 = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    const rand1 = seed1 - Math.floor(seed1);
    const seed2 = Math.cos(i * 78.233 + 1.618) * 29432.1234;
    const rand2 = seed2 - Math.floor(seed2);

    // Make recent 9 days an active streak so the demo looks inspiring
    let buildMinutes = 0;
    let solveMinutes = 0;

    if (i === 0) {
      buildMinutes = 45;
      solveMinutes = 25;
    } else if (i <= 8) {
      const buildChoices = [5, 15, 35, 65, 90, 125, 45, 20];
      const solveChoices = [5, 20, 40, 15, 75, 130, 30, 10];
      buildMinutes = buildChoices[i % buildChoices.length];
      solveMinutes = solveChoices[(i + 3) % solveChoices.length];
    } else {
      // 78% chance of activity
      if (rand1 > 0.22) {
        if (rand1 > 0.85) buildMinutes = 120 + Math.floor(rand2 * 60);
        else if (rand1 > 0.6) buildMinutes = 60 + Math.floor(rand2 * 55);
        else if (rand1 > 0.38) buildMinutes = 30 + Math.floor(rand2 * 25);
        else buildMinutes = 5 + Math.floor(rand2 * 15); // 5-minute streak savers!
      }
      if (rand2 > 0.25) {
        if (rand2 > 0.87) solveMinutes = 120 + Math.floor(rand1 * 45);
        else if (rand2 > 0.62) solveMinutes = 60 + Math.floor(rand1 * 50);
        else if (rand2 > 0.4) solveMinutes = 30 + Math.floor(rand1 * 25);
        else solveMinutes = 5 + Math.floor(rand1 * 15);
      }
    }

    // Round to multiples of 5 for clean realistic logs
    buildMinutes = Math.round(buildMinutes / 5) * 5;
    solveMinutes = Math.round(solveMinutes / 5) * 5;

    if (buildMinutes > 0 || solveMinutes > 0) {
      logs[key] = {
        date: key,
        buildMinutes,
        solveMinutes,
      };
    }
  }
  return logs;
};

// --- Intensity Level Calculator ---
// 0 = 0m, 1 = 1-29m (5m Streak Saver), 2 = 30-59m, 3 = 60-119m, 4 = 120m+
const getIntensityLevel = (minutes) => {
  if (!minutes || minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
};

// --- Integrated 5-Minute Sprint Timer Component ---
function SprintTimerWidget({ pathType, onLogSprint, onClose }) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const isBuild = pathType === 'build';
  const targetSeconds = 300; // 5 minutes = 300 seconds

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const progressPct = Math.min(100, (secondsElapsed / targetSeconds) * 100);
  const mins = Math.floor(secondsElapsed / 60);
  const secs = secondsElapsed % 60;
  const formattedClock = `${String(mins).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;
  const isGoalReached = secondsElapsed >= targetSeconds;

  // Allow logging exact minutes (minimum 1m if > 10s, or 5m quick finish)
  const loggableMinutes = Math.max(1, Math.round(secondsElapsed / 60));

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-300 ${
        isBuild
          ? 'bg-cyan-950/25 border-cyan-500/40 shadow-[0_0_25px_-5px_rgba(6,182,212,0.2)]'
          : 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_25px_-5px_rgba(16,185,129,0.2)]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'animate-ping' : ''
            } ${isBuild ? 'bg-cyan-400' : 'bg-emerald-400'}`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {isBuild ? 'Building 5m Sprint' : 'Problem Solving 5m Sprint'}
          </span>
          {isGoalReached && (
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              5m Minimum Crushed! ⚡
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60"
          title="Close Timer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-4 border border-slate-800">
        <div
          className={`h-full transition-all duration-500 ${
            isGoalReached
              ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
              : isBuild
              ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
              : 'bg-gradient-to-r from-emerald-500 to-green-400'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-3xl font-black tracking-wider text-white">
          {formattedClock}
          <span className="text-xs font-normal text-slate-400 ml-2">
            / 05:00 target
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setSecondsElapsed(0);
              setIsRunning(false);
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {secondsElapsed >= 60 ? (
            <button
              onClick={() => onLogSprint(loggableMinutes)}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs text-slate-950 transition-all flex items-center gap-1.5 ${
                isBuild
                  ? 'bg-cyan-400 hover:bg-cyan-300'
                  : 'bg-emerald-400 hover:bg-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Log +{loggableMinutes}m
            </button>
          ) : (
            <button
              onClick={() => onLogSprint(5)}
              className={`px-3.5 py-2 rounded-xl font-semibold text-xs border transition-all flex items-center gap-1.5 ${
                isBuild
                  ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/30'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
              }`}
              title="Finish and log 5 minutes immediately"
            >
              <Zap className="w-3.5 h-3.5" />
              Complete 5m Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- 16-Week Consistency Heatmap Component ---
function ConsistencyHeatmap({ logs, pathType, onSelectDate }) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const isBuild = pathType === 'build';

  // Generate 16 weeks (112 days) aligned to Sunday-Saturday rows ending this week
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const todayKey = toDateKey(today);
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
    const totalWeeks = 16;

    // End of current week (Saturday)
    const endOfGrid = new Date(today);
    endOfGrid.setDate(today.getDate() + (6 - dayOfWeek));

    const weeksArr = [];
    const months = [];
    let lastMonth = -1;

    for (let w = totalWeeks - 1; w >= 0; w--) {
      const weekCells = [];
      for (let d = 0; d < 7; d++) {
        const daysBack = w * 7 + (6 - d);
        const cellDate = new Date(endOfGrid);
        cellDate.setDate(endOfGrid.getDate() - daysBack);
        const key = toDateKey(cellDate);
        const isFuture = key > todayKey;

        const entry = logs[key] || { buildMinutes: 0, solveMinutes: 0 };
        const minutes = isBuild
          ? entry.buildMinutes || 0
          : entry.solveMinutes || 0;
        const isDualSync =
          (entry.buildMinutes || 0) >= 5 && (entry.solveMinutes || 0) >= 5;

        if (d === 0) {
          const m = cellDate.getMonth();
          if (m !== lastMonth) {
            months.push({
              weekIndex: totalWeeks - 1 - w,
              label: cellDate.toLocaleDateString('en-US', { month: 'short' }),
            });
            lastMonth = m;
          }
        }

        weekCells.push({
          dateKey: key,
          minutes,
          intensity: getIntensityLevel(minutes),
          isFuture,
          isToday: key === todayKey,
          isDualSync,
        });
      }
      weeksArr.push(weekCells);
    }

    return { weeks: weeksArr, monthLabels: months };
  }, [logs, isBuild]);

  const getSquareStyle = (cell) => {
    if (cell.isFuture) {
      return 'bg-slate-900/25 border-slate-800/30 opacity-30 cursor-default';
    }
    const level = cell.intensity;
    if (level === 0) {
      return 'bg-slate-900/90 border-slate-800/80 hover:border-slate-600';
    }
    if (isBuild) {
      switch (level) {
        case 1:
          return 'bg-cyan-950 border-cyan-700/70 text-cyan-300';
        case 2:
          return 'bg-cyan-700/80 border-cyan-500/80';
        case 3:
          return 'bg-cyan-500 border-cyan-300/90 shadow-[0_0_8px_rgba(6,182,212,0.35)]';
        case 4:
          return 'bg-cyan-300 border-white shadow-[0_0_12px_rgba(34,211,238,0.75)]';
        default:
          return 'bg-slate-900';
      }
    } else {
      switch (level) {
        case 1:
          return 'bg-emerald-950 border-emerald-700/70 text-emerald-300';
        case 2:
          return 'bg-emerald-700/80 border-emerald-500/80';
        case 3:
          return 'bg-emerald-500 border-emerald-300/90 shadow-[0_0_8px_rgba(16,185,129,0.35)]';
        case 4:
          return 'bg-emerald-300 border-white shadow-[0_0_12px_rgba(52,211,153,0.75)]';
        default:
          return 'bg-slate-900';
      }
    }
  };

  return (
    <div className="relative">
      {/* Top Info Bar / Active Hover Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 min-h-[24px]">
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          {hoveredCell ? (
            <span className="text-slate-200 font-medium flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                {formatReadableDate(hoveredCell.dateKey)}
              </span>
              <span
                className={
                  isBuild
                    ? 'text-cyan-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {formatDurationBadge(hoveredCell.minutes)}
              </span>
              {hoveredCell.isDualSync && (
                <span className="text-amber-400 text-[11px] flex items-center gap-0.5 font-semibold">
                  ⚡ Dual-Sync
                </span>
              )}
              <span className="text-slate-500 text-[11px]">
                (Click square to edit)
              </span>
            </span>
          ) : (
            <span>Click any day square to backfill or adjust time</span>
          )}
        </div>

        {/* Intensity Legend */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>0m</span>
          <span
            className="w-3 h-3 rounded-[3px] bg-slate-900 border border-slate-800"
            title="0 minutes"
          />
          <span
            className={`w-3 h-3 rounded-[3px] border ${
              isBuild
                ? 'bg-cyan-950 border-cyan-700'
                : 'bg-emerald-950 border-emerald-700'
            }`}
            title="5m - 29m (Streak Saver)"
          />
          <span
            className={`w-3 h-3 rounded-[3px] border ${
              isBuild
                ? 'bg-cyan-700/80 border-cyan-500'
                : 'bg-emerald-700/80 border-emerald-500'
            }`}
            title="30m - 59m"
          />
          <span
            className={`w-3 h-3 rounded-[3px] border ${
              isBuild
                ? 'bg-cyan-500 border-cyan-300'
                : 'bg-emerald-500 border-emerald-300'
            }`}
            title="1h - 2h"
          />
          <span
            className={`w-3 h-3 rounded-[3px] border ${
              isBuild
                ? 'bg-cyan-300 border-white'
                : 'bg-emerald-300 border-white'
            }`}
            title="2h+"
          />
          <span>2h+</span>
        </div>
      </div>

      {/* Heatmap Scroll Container */}
      <div className="overflow-x-auto pb-2 custom-scrollbar">
        <div className="inline-block min-w-full">
          {/* Month Headers */}
          <div className="flex items-center mb-1.5 pl-8 relative h-4">
            {monthLabels.map((m, idx) => (
              <span
                key={idx}
                className="text-[10px] font-medium text-slate-500 absolute"
                style={{ left: `${32 + m.weekIndex * 18}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-2">
            {/* Day of Week Labels */}
            <div className="grid grid-rows-7 gap-1.5 text-[10px] text-slate-500 pr-1 pt-0.5 select-none">
              <span className="h-3.5 leading-3.5">Sun</span>
              <span className="h-3.5 leading-3.5 text-slate-400">Mon</span>
              <span className="h-3.5 leading-3.5">Tue</span>
              <span className="h-3.5 leading-3.5 text-slate-400">Wed</span>
              <span className="h-3.5 leading-3.5">Thu</span>
              <span className="h-3.5 leading-3.5 text-slate-400">Fri</span>
              <span className="h-3.5 leading-3.5">Sat</span>
            </div>

            {/* 16 Columns of 7 Days */}
            <div className="flex gap-1.5 flex-1 justify-between">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-rows-7 gap-1.5">
                  {week.map((cell) => (
                    <button
                      key={cell.dateKey}
                      type="button"
                      disabled={cell.isFuture}
                      onMouseEnter={() =>
                        !cell.isFuture && setHoveredCell(cell)
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() =>
                        !cell.isFuture && onSelectDate(cell.dateKey)
                      }
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] border transition-all duration-150 relative flex items-center justify-center ${getSquareStyle(
                        cell
                      )} ${
                        cell.isToday
                          ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[#111827]'
                          : 'hover:scale-125 hover:z-10'
                      }`}
                      title={`${formatReadableDate(
                        cell.dateKey
                      )}: ${formatDurationBadge(cell.minutes)}`}
                    >
                      {cell.isDualSync && cell.intensity > 0 && (
                        <span className="w-1 h-1 rounded-full bg-amber-300 shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Volume Bar Chart Component (Last 7 or 14 Days) ---
function VolumeBarChart({ logs, pathType, daysRange, onSelectDate }) {
  const isBuild = pathType === 'build';

  const { chartData, avgMinutes } = useMemo(() => {
    const data = [];
    const today = new Date();
    let total = 0;

    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toDateKey(d);
      const entry = logs[key] || { buildMinutes: 0, solveMinutes: 0 };
      const minutes = isBuild
        ? entry.buildMinutes || 0
        : entry.solveMinutes || 0;
      total += minutes;

      data.push({
        dateKey: key,
        label:
          i === 0
            ? 'Today'
            : d.toLocaleDateString('en-US', {
                weekday: daysRange <= 7 ? 'short' : undefined,
                month: daysRange > 7 ? 'numeric' : undefined,
                day: 'numeric',
              }),
        fullDate: formatReadableDate(key),
        minutes,
        metGoal: minutes >= 5,
      });
    }

    return {
      chartData: data,
      avgMinutes: Math.round(total / daysRange),
    };
  }, [logs, isBuild, daysRange]);

  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#090D16]/95 border border-slate-700/80 px-3 py-2 rounded-xl shadow-2xl text-xs backdrop-blur-md">
          <p className="text-slate-400 font-medium mb-1">{item.fullDate}</p>
          <p
            className={`text-sm font-bold ${
              isBuild ? 'text-cyan-400' : 'text-emerald-400'
            }`}
          >
            {formatDurationBadge(item.minutes)}
          </p>
          {item.minutes >= 5 ? (
            <p className="text-[10px] text-amber-400 mt-0.5">
              ✓ 5m Minimum Met
            </p>
          ) : (
            <p className="text-[10px] text-slate-500 mt-0.5">
              Click bar to log time
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 8, left: -24, bottom: 0 }}
          onClick={(state) => {
            if (state && state.activePayload && state.activePayload[0]) {
              onSelectDate(state.activePayload[0].payload.dateKey);
            }
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1e293b"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) =>
              val >= 60 ? `${Math.round((val / 60) * 10) / 10}h` : `${val}m`
            }
          />
          <Tooltip
            content={<CustomBarTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          {avgMinutes > 0 && (
            <ReferenceLine
              y={avgMinutes}
              stroke={isBuild ? '#22d3ee' : '#34d399'}
              strokeDasharray="4 4"
              strokeOpacity={0.65}
            />
          )}
          <Bar
            dataKey="minutes"
            radius={[6, 6, 0, 0]}
            className="cursor-pointer"
          >
            {chartData.map((entry, index) => {
              const activeColor = isBuild ? '#06b6d4' : '#10b981';
              const dimColor = isBuild ? '#164e63' : '#064e3b';
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.minutes >= 30
                      ? activeColor
                      : entry.minutes > 0
                      ? dimColor
                      : '#1e293b'
                  }
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Main Application Component ---
export default function App() {
  // Auth & Firestore Real Data State
  const [user, setUser] = useState(null);
  const [realLogs, setRealLogs] = useState({});
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  // Sample Mode State (Allows admiring populated 90+ day graphs vs personal data)
  const [demoLogs, setDemoLogs] = useState(() => generateSampleLogs());
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Mobile View Filter ('both' | 'build' | 'solve')
  const [mobileFilter, setMobileFilter] = useState('both');

  // Chart Days Toggle (7 or 14 days)
  const [buildChartRange, setBuildChartRange] = useState(7);
  const [solveChartRange, setSolveChartRange] = useState(7);

  // Active 5-Minute Sprint Timers
  const [activeSprintBuild, setActiveSprintBuild] = useState(false);
  const [activeSprintSolve, setActiveSprintSolve] = useState(false);

  // Log Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPath, setModalPath] = useState('build'); // 'build' | 'solve'
  const [modalDate, setModalDate] = useState(getTodayKey());
  const [logMode, setLogMode] = useState('add'); // 'add' | 'set'
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(5);

  // Celebration Toast Banner
  const [toastMessage, setToastMessage] = useState(null);
  const fileInputRef = useRef(null);

  // 1. Firebase Auth Setup (RULE 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Authentication initialization failed:', error);
        setIsLoadingDB(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setIsLoadingDB(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Firestore Real-Time Listener (RULE 1, 2, 3)
  useEffect(() => {
    if (!user) return;
    const colRef = collection(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'dailyLogs'
    );
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const fetched = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.date) {
            fetched[data.date] = {
              date: data.date,
              buildMinutes: Number(data.buildMinutes) || 0,
              solveMinutes: Number(data.solveMinutes) || 0,
            };
          }
        });
        setRealLogs(fetched);
        setIsLoadingDB(false);
      },
      (error) => {
        console.error('Firestore listener error:', error);
        setIsLoadingDB(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Active logs source depending on Demo Mode
  const activeLogs = isDemoMode ? demoLogs : realLogs;

  // Trigger brief toast notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // --- Computed Metrics & Streaks ---
  const stats = useMemo(() => {
    const todayKey = getTodayKey();
    const todayEntry = activeLogs[todayKey] || {
      buildMinutes: 0,
      solveMinutes: 0,
    };
    const buildToday = todayEntry.buildMinutes || 0;
    const solveToday = todayEntry.solveMinutes || 0;
    const totalToday = buildToday + solveToday;

    const buildMetToday = buildToday >= 5;
    const solveMetToday = solveToday >= 5;
    const isDualSyncToday = buildMetToday && solveMetToday;

    // Calculate Streaks (Walking backwards from Today or Yesterday if Today is 0 so far)
    const calcStreak = (checkFn) => {
      let streak = 0;
      const d = new Date();
      const todayValid = checkFn(
        activeLogs[toDateKey(d)] || { buildMinutes: 0, solveMinutes: 0 }
      );
      if (!todayValid) {
        // Check starting from yesterday
        d.setDate(d.getDate() - 1);
      }
      while (true) {
        const key = toDateKey(d);
        const entry = activeLogs[key] || { buildMinutes: 0, solveMinutes: 0 };
        if (checkFn(entry)) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
      return streak;
    };

    const buildStreak = calcStreak((e) => (e.buildMinutes || 0) >= 5);
    const solveStreak = calcStreak((e) => (e.solveMinutes || 0) >= 5);
    const dualStreak = calcStreak(
      (e) => (e.buildMinutes || 0) >= 5 && (e.solveMinutes || 0) >= 5
    );

    // Aggregate Week, Month, All-Time
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const weekStartKey = toDateKey(sevenDaysAgo);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const monthStartKey = toDateKey(thirtyDaysAgo);

    let buildWeek = 0,
      buildMonth = 0,
      buildAllTime = 0;
    let solveWeek = 0,
      solveMonth = 0,
      solveAllTime = 0;

    Object.values(activeLogs).forEach((entry) => {D
      const b = entry.buildMinutes || 0;
      const s = entry.solveMinutes || 0;
      buildAllTime += b;
      solveAllTime += s;
      if (entry.date >= monthStartKey) {
        buildMonth += b;
        solveMonth += s;
      }
      if (entry.date >= weekStartKey) {
        buildWeek += b;
        solveWeek += s;
      }
    });

    return {
      buildToday,
      solveToday,
      totalToday,
      buildMetToday,
      solveMetToday,
      isDualSyncToday,
      buildStreak,
      solveStreak,
      dualStreak,
      buildWeek,
      buildMonth,
      buildAllTime,
      solveWeek,
      solveMonth,
      solveAllTime,
    };
  }, [activeLogs]);

  // --- Modal Open Handler ---
  const openLogModal = (pathType, dateKey = getTodayKey()) => {
    setModalPath(pathType);
    setModalDate(dateKey);
    setLogMode('add');
    setInputHours(0);
    setInputMinutes(5); // Default to the 5-minute rule!
    setIsModalOpen(true);
  };

  // --- Save Time Function (Updates Firestore or Demo State) ---
  const saveTimeLog = async (
    pathType,
    dateKey,
    minutesToApply,
    mode = 'add'
  ) => {
    const existing = activeLogs[dateKey] || {
      date: dateKey,
      buildMinutes: 0,
      solveMinutes: 0,
    };
    const currentBuild = existing.buildMinutes || 0;
    const currentSolve = existing.solveMinutes || 0;

    let newBuild = currentBuild;
    let newSolve = currentSolve;

    if (pathType === 'build') {
      newBuild =
        mode === 'add' ? currentBuild + minutesToApply : minutesToApply;
    } else {
      newSolve =
        mode === 'add' ? currentSolve + minutesToApply : minutesToApply;
    }

    newBuild = Math.max(0, Math.min(1440, newBuild));
    newSolve = Math.max(0, Math.min(1440, newSolve));

    const updatedDoc = {
      date: dateKey,
      buildMinutes: newBuild,
      solveMinutes: newSolve,
      updatedAt: Date.now(),
    };

    const wasDual = currentBuild >= 5 && currentSolve >= 5;
    const isNowDual = newBuild >= 5 && newSolve >= 5;

    // Optimistic update
    if (isDemoMode) {
      setDemoLogs((prev) => ({ ...prev, [dateKey]: updatedDoc }));
    } else {
      setRealLogs((prev) => ({ ...prev, [dateKey]: updatedDoc }));
      if (user) {
        try {
          const docRef = doc(
            db,
            'artifacts',
            appId,
            'users',
            user.uid,
            'dailyLogs',
            dateKey
          );
          await setDoc(docRef, updatedDoc, { merge: true });
        } catch (err) {
          console.error('Failed to save log to Firestore:', err);
        }
      }
    }

    if (!wasDual && isNowDual) {
      showToast('⚡ Golden Dual-Sync Unlocked! Both paths hit 5m+!');
    } else {
      const label = pathType === 'build' ? 'Building 🛠️' : 'Problem Solving 🧠';
      showToast(
        `Saved! ${label} is now ${formatDurationBadge(
          pathType === 'build' ? newBuild : newSolve
        )} on ${formatReadableDate(dateKey)}`
      );
    }
  };

  const handleModalSubmit = async () => {
    const totalInputMins = inputHours * 60 + inputMinutes;
    await saveTimeLog(modalPath, modalDate, totalInputMins, logMode);
    setIsModalOpen(false);
  };

  // Quick-add inside modal
  const handleQuickAddChip = (minsToAdd) => {
    const currentTotal = inputHours * 60 + inputMinutes + minsToAdd;
    const capped = Math.min(1439, Math.max(0, currentTotal));
    setInputHours(Math.floor(capped / 60));
    setInputMinutes(capped % 60);
  };

  // --- Backup Export & Restore ---
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(activeLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `5mindev-backup-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📦 Exported JSON backup successfully!');
  };

  const handleImportJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        if (isDemoMode) {
          setDemoLogs(parsed);
        } else {
          setRealLogs((prev) => ({ ...prev, ...parsed }));
          if (user) {
            for (const [key, val] of Object.entries(parsed)) {
              if (val && val.date) {
                const docRef = doc(
                  db,
                  'artifacts',
                  appId,
                  'users',
                  user.uid,
                  'dailyLogs',
                  key
                );
                await setDoc(docRef, val, { merge: true });
              }
            }
          }
        }
        showToast('✅ Imported backup data successfully!');
      }
    } catch (err) {
      console.error('Import error:', err);
      showToast('⚠️ Could not parse JSON backup file.');
    }
  };

  // Today's Ratio Percentage for Header Split Bar
  const buildRatioPct =
    stats.totalToday > 0
      ? Math.round((stats.buildToday / stats.totalToday) * 100)
      : 50;
  const solveRatioPct = stats.totalToday > 0 ? 100 - buildRatioPct : 50;

  // Existing minutes on selected modal date
  const existingModalDateEntry = activeLogs[modalDate] || {
    buildMinutes: 0,
    solveMinutes: 0,
  };
  const existingMinutesForModalPath =
    modalPath === 'build'
      ? existingModalDateEntry.buildMinutes || 0
      : existingModalDateEntry.solveMinutes || 0;
  const modalInputTotalMinutes = inputHours * 60 + inputMinutes;
  const previewFinalMinutes =
    logMode === 'add'
      ? existingMinutesForModalPath + modalInputTotalMinutes
      : modalInputTotalMinutes;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-sans selection:bg-cyan-500/30 flex flex-col">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900/95 border border-amber-500/50 text-amber-200 text-sm font-semibold shadow-[0_10px_40px_rgba(0,0,0,0.7)] backdrop-blur-md flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ==================== 1. TOP COMMAND HEADER ==================== */}
      <header className="sticky top-0 z-30 bg-[#090D16]/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Brand & Dual-Sync Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                    stats.isDualSyncToday
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                      : 'bg-slate-900 border-slate-700 text-cyan-400'
                  }`}
                >
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg tracking-tight text-white">
                      5Min<span className="text-cyan-400">Dev</span>
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        stats.isDualSyncToday
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : stats.buildMetToday || stats.solveMetToday
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700'
                      }`}
                    >
                      {stats.isDualSyncToday
                        ? '⚡ Perfect Dual-Sync Unlocked'
                        : stats.buildMetToday
                        ? '🛠️ Build 5m Met • Solve Pending'
                        : stats.solveMetToday
                        ? '🧠 Solve 5m Met • Build Pending'
                        : '🎯 Goal: 5m Build + 5m Solve'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Zero notes. Zero friction. Just log your daily hours &amp;
                    minutes.
                  </p>
                </div>
              </div>

              {/* Demo Mode Toggle (Mobile position) */}
              <button
                onClick={() => setIsDemoMode(!isDemoMode)}
                className={`lg:hidden px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                  isDemoMode
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {isDemoMode ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <Database className="w-3.5 h-3.5" />
                )}
                {isDemoMode ? 'Sample Data' : 'My Data'}
              </button>
            </div>

            {/* Center: Master Today Counter + Ratio Split Bar */}
            <div className="flex flex-col items-center justify-center bg-[#111827]/90 border border-slate-800/90 rounded-2xl px-5 py-2.5 min-w-[280px] sm:min-w-[360px]">
              <div className="flex items-baseline justify-between w-full gap-4 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Total Time Today
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {formatDurationBadge(stats.totalToday)}
                  </span>
                </div>
              </div>

              {/* Visual Ratio Bar (Building vs Solving) */}
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden flex border border-slate-800/80">
                {stats.totalToday > 0 ? (
                  <>
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                      style={{ width: `${buildRatioPct}%` }}
                      title={`Building: ${formatDurationBadge(
                        stats.buildToday
                      )} (${buildRatioPct}%)`}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
                      style={{ width: `${solveRatioPct}%` }}
                      title={`Solving: ${formatDurationBadge(
                        stats.solveToday
                      )} (${solveRatioPct}%)`}
                    />
                  </>
                ) : (
                  <div className="w-full h-full bg-slate-800/50" />
                )}
              </div>

              <div className="flex justify-between w-full text-[11px] font-medium mt-1">
                <span className="text-cyan-400">
                  🛠️ Build: {formatDurationBadge(stats.buildToday)}
                </span>
                <span className="text-emerald-400">
                  🧠 Solve: {formatDurationBadge(stats.solveToday)}
                </span>
              </div>
            </div>

            {/* Right: Streak Counters + Demo Mode Toggle */}
            <div className="flex items-center justify-between lg:justify-end gap-2.5">
              {/* Streaks Strip */}
              <div className="flex items-center gap-2 bg-[#111827] border border-slate-800 rounded-xl p-1.5">
                <div
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center gap-1.5"
                  title="Building Streak (5m+ daily)"
                >
                  <Flame className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-white">
                    {stats.buildStreak}d
                  </span>
                  <span className="text-[10px] text-cyan-400 hidden sm:inline">
                    Build
                  </span>
                </div>

                <div
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-1.5"
                  title="Solving Streak (5m+ daily)"
                >
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    {stats.solveStreak}d
                  </span>
                  <span className="text-[10px] text-emerald-400 hidden sm:inline">
                    Solve
                  </span>
                </div>

                <div
                  className="px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center gap-1.5"
                  title="Dual-Sync Streak (Both >= 5m on the same day)"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    {stats.dualStreak}d
                  </span>
                  <span className="text-[10px] text-amber-400 hidden sm:inline">
                    Dual
                  </span>
                </div>
              </div>

              {/* Desktop Demo Mode Button */}
              <button
                onClick={() => setIsDemoMode(!isDemoMode)}
                className={`hidden lg:flex px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all items-center gap-2 ${
                  isDemoMode
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'bg-[#111827] border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
                title="Switch between a rich 16-week sample dataset and your live personal data"
              >
                {isDemoMode ? (
                  <>
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span>Sample Data Active (Switch to Real)</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>Preview Sample Data</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mobile View Switcher Pills (Visible only on < lg screens) */}
          <div className="flex lg:hidden items-center justify-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/70">
            <button
              onClick={() => setMobileFilter('both')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mobileFilter === 'both'
                  ? 'bg-slate-800 text-white border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Both Stacked
            </button>
            <button
              onClick={() => setMobileFilter('build')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mobileFilter === 'build'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🛠️ Build Only
            </button>
            <button
              onClick={() => setMobileFilter('solve')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mobileFilter === 'solve'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🧠 Solve Only
            </button>
          </div>
        </div>
      </header>

      {/* ==================== 2. SPLIT-SCREEN PATH PANELS ==================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
        {/* -------------------- LEFT HALF: THE BUILDING PATH 🛠️ -------------------- */}
        <section
          className={`p-4 sm:p-6 lg:p-8 flex flex-col gap-6 ${
            mobileFilter === 'solve' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Path Header Card */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/90 shadow-lg relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                  <Code2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      The Building Path
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium">
                      Web Dev &amp; Projects
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {stats.buildMetToday ? (
                      <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 5m daily
                        minimum complete!
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Log at least 5 minutes to keep your Building streak
                        alive
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Today's Path Readout */}
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                  Today&apos;s Build
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-black text-cyan-400">
                  {formatDurationBadge(stats.buildToday)}
                </span>
              </div>
            </div>

            {/* Action Buttons: + Log Build Time & 5m Sprint Timer */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => openLogModal('build', getTodayKey())}
                className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm tracking-wide shadow-[0_0_25px_-5px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_-2px_rgba(6,182,212,0.7)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                Log Build Time
              </button>

              <button
                onClick={() => setActiveSprintBuild(!activeSprintBuild)}
                className={`py-3.5 px-4 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeSprintBuild
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                <Clock className="w-4 h-4 text-cyan-400" />
                5m Sprint Timer
              </button>
            </div>
          </div>

          {/* Expandable 5m Sprint Timer */}
          {activeSprintBuild && (
            <SprintTimerWidget
              pathType="build"
              onClose={() => setActiveSprintBuild(false)}
              onLogSprint={(mins) => {
                saveTimeLog('build', getTodayKey(), mins, 'add');
                setActiveSprintBuild(false);
              }}
            />
          )}

          {/* 4-Pill Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">Today</span>
              <span className="font-mono text-lg font-bold text-white">
                {formatDurationBadge(stats.buildToday)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">
                Last 7 Days
              </span>
              <span className="font-mono text-lg font-bold text-white">
                {formatDurationBadge(stats.buildWeek)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">
                Last 30 Days
              </span>
              <span className="font-mono text-lg font-bold text-white">
                {formatDurationBadge(stats.buildMonth)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">
                All-Time Hours
              </span>
              <span className="font-mono text-lg font-bold text-cyan-400">
                {formatHoursDecimal(stats.buildAllTime)} hrs
              </span>
            </div>
          </div>

          {/* Visualization 1: Building Consistency Heatmap */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/90 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Building Consistency (Last 16 Weeks)
              </h3>
              <span className="text-[11px] text-slate-400">
                5m+ lights up the grid
              </span>
            </div>
            <ConsistencyHeatmap
              logs={activeLogs}
              pathType="build"
              onSelectDate={(dateKey) => openLogModal('build', dateKey)}
            />
          </div>

          {/* Visualization 2: Building Time Volume Bar Chart */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/90 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Daily Build Volume
                </h3>
                <p className="text-[11px] text-slate-400">
                  Dashed line shows daily average • Click any bar to edit
                </p>
              </div>
              <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setBuildChartRange(7)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    buildChartRange === 7
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400'
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => setBuildChartRange(14)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    buildChartRange === 14
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400'
                  }`}
                >
                  14D
                </button>
              </div>
            </div>

            <VolumeBarChart
              logs={activeLogs}
              pathType="build"
              daysRange={buildChartRange}
              onSelectDate={(dateKey) => openLogModal('build', dateKey)}
            />
          </div>
        </section>

        {/* -------------------- RIGHT HALF: THE PROBLEM SOLVING PATH 🧠 -------------------- */}
        <section
          className={`p-4 sm:p-6 lg:p-8 flex flex-col gap-6 ${
            mobileFilter === 'build' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Path Header Card */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/90 shadow-lg relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      Problem Solving Path
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                      Algorithms &amp; DSA
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {stats.solveMetToday ? (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 5m daily
                        minimum complete!
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Log at least 5 minutes to keep your Solving streak alive
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Today's Path Readout */}
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                  Today&apos;s Solve
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  {formatDurationBadge(stats.solveToday)}
                </span>
              </div>
            </div>

            {/* Action Buttons: + Log Solve Time & 5m Sprint Timer */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => openLogModal('solve', getTodayKey())}
                className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-sm tracking-wide shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)] hover:shadow-[0_0_30px_-2px_rgba(16,185,129,0.7)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                Log Solve Time
              </button>

              <button
                onClick={() => setActiveSprintSolve(!activeSprintSolve)}
                className={`py-3.5 px-4 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeSprintSolve
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                <Clock className="w-4 h-4 text-emerald-400" />
                5m Sprint Timer
              </button>
            </div>
          </div>

          {/* Expandable 5m Sprint Timer */}
          {activeSprintSolve && (
            <SprintTimerWidget
              pathType="solve"
              onClose={() => setActiveSprintSolve(false)}
              onLogSprint={(mins) => {
                saveTimeLog('solve', getTodayKey(), mins, 'add');
                setActiveSprintSolve(false);
              }}
            />
          )}

          {/* 4-Pill Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">Today</span>
              <span className="font-mono text-lg font-bold text-white">
                {formatDurationBadge(stats.solveToday)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">
                Last 7 Days
              </span>
              <span className="font-mono text-lg font-bold text-white">
                {formatDurationBadge(stats.solveWeek)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">
                Last 30 Days
              </span>
              <span className="font-mono text-lg font-bold text-white">
                {formatDurationBadge(stats.solveMonth)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block">
                All-Time Hours
              </span>
              <span className="font-mono text-lg font-bold text-emerald-400">
                {formatHoursDecimal(stats.solveAllTime)} hrs
              </span>
            </div>
          </div>

          {/* Visualization 1: Solving Consistency Heatmap */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/90 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Solving Consistency (Last 16 Weeks)
              </h3>
              <span className="text-[11px] text-slate-400">
                5m+ lights up the grid
              </span>
            </div>
            <ConsistencyHeatmap
              logs={activeLogs}
              pathType="solve"
              onSelectDate={(dateKey) => openLogModal('solve', dateKey)}
            />
          </div>

          {/* Visualization 2: Solving Time Volume Bar Chart */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800/90 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  Daily Solve Volume
                </h3>
                <p className="text-[11px] text-slate-400">
                  Dashed line shows daily average • Click any bar to edit
                </p>
              </div>
              <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setSolveChartRange(7)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    solveChartRange === 7
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => setSolveChartRange(14)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    solveChartRange === 14
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  14D
                </button>
              </div>
            </div>

            <VolumeBarChart
              logs={activeLogs}
              pathType="solve"
              daysRange={solveChartRange}
              onSelectDate={(dateKey) => openLogModal('solve', dateKey)}
            />
          </div>
        </section>
      </main>

      {/* ==================== MOBILE FLOATING ACTION BUTTON (FAB) ==================== */}
      <div className="lg:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2">
        <button
          onClick={() => openLogModal('build', getTodayKey())}
          className="px-4 py-3 rounded-2xl bg-cyan-500 text-slate-950 font-black text-xs shadow-[0_8px_30px_rgba(6,182,212,0.5)] flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Build
        </button>
        <button
          onClick={() => openLogModal('solve', getTodayKey())}
          className="px-4 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs shadow-[0_8px_30px_rgba(16,185,129,0.5)] flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Solve
        </button>
      </div>

      {/* ==================== 3. FRICTIONLESS "LOG TIME" MODAL ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className={`w-full max-w-md rounded-3xl bg-[#111827] border shadow-2xl overflow-hidden transition-all ${
              modalPath === 'build'
                ? 'border-cyan-500/40 shadow-[0_0_50px_-10px_rgba(6,182,212,0.25)]'
                : 'border-emerald-500/40 shadow-[0_0_50px_-10px_rgba(16,185,129,0.25)]'
            }`}
          >
            {/* Modal Top Path Switcher */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#090D16]/60">
              <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalPath('build')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    modalPath === 'build'
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Building
                </button>
                <button
                  type="button"
                  onClick={() => setModalPath('solve')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    modalPath === 'solve'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  Solving
                </button>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {/* Date Switcher Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModalDate(getTodayKey())}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      modalDate === getTodayKey()
                        ? 'bg-slate-800 text-white border-slate-600'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalDate(getYesterdayKey())}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      modalDate === getYesterdayKey()
                        ? 'bg-slate-800 text-white border-slate-600'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    Yesterday
                  </button>
                </div>

                <input
                  type="date"
                  value={modalDate}
                  max={getTodayKey()}
                  onChange={(e) =>
                    e.target.value && setModalDate(e.target.value)
                  }
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Add vs Set Exact Total Mode */}
              <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-2 text-xs">
                <span className="text-slate-400 pl-2">
                  Currently logged:{' '}
                  <strong className="text-white">
                    {formatDurationBadge(existingMinutesForModalPath)}
                  </strong>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setLogMode('add')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      logMode === 'add'
                        ? 'bg-slate-800 text-white border border-slate-600'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    + Add Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogMode('set')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      logMode === 'set'
                        ? 'bg-slate-800 text-white border border-slate-600'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Set Total
                  </button>
                </div>
              </div>

              {/* Giant HH : MM Interactive Display */}
              <div className="bg-[#090D16] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-4">
                  {/* HOURS COLUMN */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setInputHours((h) => Math.min(23, h + 1))}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={String(inputHours).padStart(2, '0')}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          Math.min(23, parseInt(e.target.value, 10) || 0)
                        );
                        setInputHours(val);
                      }}
                      className={`w-24 text-center bg-transparent font-mono text-5xl sm:text-6xl font-black focus:outline-none focus:ring-2 rounded-xl ${
                        modalPath === 'build'
                          ? 'text-cyan-400 focus:ring-cyan-500/50'
                          : 'text-emerald-400 focus:ring-emerald-500/50'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setInputHours((h) => Math.max(0, h - 1))}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mt-1">
                      Hours
                    </span>
                  </div>

                  <span className="font-mono text-5xl font-black text-slate-600 -mt-5">
                    :
                  </span>

                  {/* MINUTES COLUMN */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() =>
                        setInputMinutes((m) => {
                          if (m + 5 >= 60) {
                            setInputHours((h) => Math.min(23, h + 1));
                            return (m + 5) % 60;
                          }
                          return m + 5;
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={String(inputMinutes).padStart(2, '0')}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          Math.min(59, parseInt(e.target.value, 10) || 0)
                        );
                        setInputMinutes(val);
                      }}
                      className={`w-24 text-center bg-transparent font-mono text-5xl sm:text-6xl font-black focus:outline-none focus:ring-2 rounded-xl ${
                        modalPath === 'build'
                          ? 'text-cyan-400 focus:ring-cyan-500/50'
                          : 'text-emerald-400 focus:ring-emerald-500/50'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setInputMinutes((m) => Math.max(0, m - 5))}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mt-1">
                      Minutes
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick-Add Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Quick-Add Chips</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInputHours(0);
                      setInputMinutes(0);
                    }}
                    className="text-slate-400 hover:text-white underline text-[11px]"
                  >
                    Clear to 00:00
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickAddChip(5)}
                    className="py-2.5 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all flex flex-col items-center justify-center"
                    title="The 5-Minute Rule Streak Saver!"
                  >
                    <span>+5m</span>
                    <span className="text-[9px] font-normal text-amber-400/90">
                      Streak🔥
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddChip(15)}
                    className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddChip(30)}
                    className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all"
                  >
                    +30m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddChip(60)}
                    className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all"
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddChip(120)}
                    className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all"
                  >
                    +2h
                  </button>
                </div>
              </div>

              {/* Save Action Button */}
              <button
                type="button"
                onClick={handleModalSubmit}
                className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide text-slate-950 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  modalPath === 'build'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                    : 'bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                }`}
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>
                  Save {modalPath === 'build' ? 'Building' : 'Solving'} Log (New
                  Total: {formatDurationBadge(previewFinalMinutes)})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. FOOTER & DATA BACKUP ==================== */}
      <footer className="border-t border-slate-800/80 bg-[#090D16] py-5 px-6 mt-auto">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">5MinDev</span>
            <span>•</span>
            <span>
              {isDemoMode
                ? 'Viewing 16-Week Sample Data (Click "Sample Data Active" in header for your live cloud logs)'
                : isLoadingDB
                ? 'Syncing cloud storage...'
                : 'Cloud Sync Active'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Export JSON Backup
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              Restore JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </div>
        </div>
      </footer>

      {/* Custom Scrollbar Styling */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(51, 65, 85, 0.8);
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 1);
        }
      `,
        }}
      />
    </div>
  );
}
