import React, { useState } from 'react';
import { Play, RotateCcw, Zap, Terminal, CheckCircle2 } from 'lucide-react';

interface LogEntry {
  id: string;
  time: string;
  bot: string;
  action: string;
  result: 'SUCCESS' | 'CONFLICT' | 'LOCKED' | 'INFO';
  message: string;
}

export const ConcurrencySimulator: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const targetSeat = 'B4';
  const [winnerBot, setWinnerBot] = useState<string | null>(null);
  const [stats, setStats] = useState({ attempts: 0, acquired: 0, conflictsPrevented: 0, doubleBookings: 0 });

  const startSimulation = () => {
    setIsRunning(true);
    setLogs([]);
    setWinnerBot(null);
    setStats({ attempts: 0, acquired: 0, conflictsPrevented: 0, doubleBookings: 0 });

    const bots = [
      { name: 'Bot-Alpha (Chrome/US-East)', delay: 100 },
      { name: 'Bot-Beta (App/EU-West)', delay: 140 },
      { name: 'Bot-Gamma (Python/Script)', delay: 180 },
      { name: 'User-Rachel (Mobile/5G)', delay: 220 },
      { name: 'Bot-Delta (FastBot-3)', delay: 260 },
    ];

    let winnerFound = false;

    bots.forEach((bot, idx) => {
      setTimeout(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString() + '.' + String(now.getMilliseconds()).padStart(3, '0');

        if (!winnerFound) {
          winnerFound = true;
          setWinnerBot(bot.name);
          setStats(s => ({ ...s, attempts: s.attempts + 1, acquired: s.acquired + 1 }));

          setLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              time: timeStr,
              bot: bot.name,
              action: 'BEGIN TRANSACTION',
              result: 'INFO',
              message: `Executing: SELECT * FROM seats WHERE label='${targetSeat}' FOR UPDATE SKIP LOCKED;`
            },
            {
              id: Math.random().toString(),
              time: timeStr,
              bot: bot.name,
              action: 'ACQUIRED ROW LOCK',
              result: 'SUCCESS',
              message: `Lock granted on seat ${targetSeat}. Status changed to 'held'. Hold token generated.`
            }
          ]);
        } else {
          setStats(s => ({ ...s, attempts: s.attempts + 1, conflictsPrevented: s.conflictsPrevented + 1 }));

          setLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              time: timeStr,
              bot: bot.name,
              action: 'SKIP LOCKED DETECTED',
              result: 'CONFLICT',
              message: `Row ${targetSeat} locked by another tx. SKIP LOCKED returned 0 rows. Aborting hold.`
            }
          ]);
        }

        if (idx === bots.length - 1) {
          setTimeout(() => {
            setIsRunning(false);
          }, 300);
        }
      }, bot.delay * 2.5);
    });
  };

  const resetSimulation = () => {
    setLogs([]);
    setWinnerBot(null);
    setStats({ attempts: 0, acquired: 0, conflictsPrevented: 0, doubleBookings: 0 });
    setIsRunning(false);
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl my-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            Interactive Concurrency Lab
          </div>
          <h3 className="text-xl font-bold text-white mt-1">
            Simulate "Big Sale" Race Condition (Section 5)
          </h3>
          <p className="text-sm text-slate-400">
            Witness how PostgreSQL <code className="text-indigo-300 font-mono">FOR UPDATE SKIP LOCKED</code> guarantees 0 double-bookings when 5 concurrent clients strike the exact same seat within 200ms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startSimulation}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            {isRunning ? 'Simulating Rush...' : 'Launch Bot Rush'}
          </button>
          <button
            onClick={resetSimulation}
            disabled={isRunning || logs.length === 0}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
          <span className="text-xs text-slate-400 block font-medium">Contested Seat</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold text-white">{targetSeat}</span>
            <span className="text-xs text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">VIP Row</span>
          </div>
        </div>
        <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
          <span className="text-xs text-slate-400 block font-medium">Concurrent Requests</span>
          <div className="text-xl font-bold text-white mt-1">{stats.attempts} / 5</div>
        </div>
        <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
          <span className="text-xs text-emerald-400 block font-medium">Holds Granted</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">{stats.acquired}</div>
        </div>
        <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
          <span className="text-xs text-purple-400 block font-medium">Double Bookings</span>
          <div className="text-xl font-bold text-purple-400 mt-1">{stats.doubleBookings} (0.00%)</div>
        </div>
      </div>

      <div className="bg-black/80 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-hidden">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-500">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>Postgres DB Engine Transaction Log</span>
          </div>
          {winnerBot && (
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Winner: {winnerBot}</span>
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
          {logs.length === 0 ? (
            <div className="text-slate-600 py-6 text-center italic">
              Click "Launch Bot Rush" to initiate 5 concurrent transactions against seat {targetSeat}.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 leading-relaxed">
                <span className="text-slate-500 shrink-0">{log.time}</span>
                <span className="text-indigo-300 font-bold shrink-0">[{log.bot}]</span>
                <span className={`font-bold shrink-0 ${
                  log.result === 'SUCCESS' ? 'text-emerald-400' :
                  log.result === 'CONFLICT' ? 'text-amber-400' :
                  'text-blue-400'
                }`}>
                  {log.action}:
                </span>
                <span className="text-slate-300 break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
