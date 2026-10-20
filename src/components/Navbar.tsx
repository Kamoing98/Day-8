import React from 'react';
import { Ticket, FileText, Lightbulb, Clock, ShoppingBag } from 'lucide-react';
import { ActiveHold } from '../data/mockEvents';

interface NavbarProps {
  activeTab: 'app' | 'design' | 'reflection';
  setActiveTab: (tab: 'app' | 'design' | 'reflection') => void;
  activeHold: ActiveHold | null;
  holdSeconds: number;
  orderCount: number;
  onOpenOrders: () => void;
  onOpenCheckout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeHold,
  holdSeconds,
  orderCount,
  onOpenOrders,
  onOpenCheckout,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo & Brand */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('app')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                  TicketHub
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Interactive Prototype
                </span>
              </div>
              <p className="text-xs text-slate-400">Day 8 System Design & Concurrency Lab</p>
            </div>
          </div>

          {/* Mobile orders icon */}
          <div className="flex md:hidden items-center gap-2">
            {orderCount > 0 && (
              <button
                onClick={onOpenOrders}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 relative"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
                  {orderCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs sm:text-sm font-medium w-full sm:w-auto justify-center">
          <button
            onClick={() => setActiveTab('app')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'app'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Interactive App</span>
          </button>
          <button
            onClick={() => setActiveTab('design')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'design'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>System Design</span>
          </button>
          <button
            onClick={() => setActiveTab('reflection')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'reflection'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>Reflection</span>
          </button>
        </nav>

        {/* Action badges: Active Hold timer & Orders button */}
        <div className="hidden md:flex items-center gap-3">
          {activeHold && (
            <button
              onClick={onOpenCheckout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all cursor-pointer animate-pulse"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Hold Expires: {formatTime(holdSeconds)}</span>
              <span className="bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded text-[10px] font-bold">Checkout</span>
            </button>
          )}

          <button
            onClick={onOpenOrders}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-indigo-400" />
            <span>My Tickets</span>
            {orderCount > 0 && (
              <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {orderCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
