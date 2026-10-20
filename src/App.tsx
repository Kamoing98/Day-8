import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { TicketHubApp } from './components/TicketHubApp';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { ConcurrencySimulator } from './components/ConcurrencySimulator';
import { MarkdownViewer } from './components/MarkdownViewer';
import { designContent } from './data/designContent';
import { reflectionContent } from './data/reflectionContent';
import { ActiveHold, Order } from './data/mockEvents';
import { Users, Flame, ShieldAlert, Award, FileCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'app' | 'design' | 'reflection'>('app');
  const [activeHold, setActiveHold] = useState<ActiveHold | null>(null);
  const [holdSeconds, setHoldSeconds] = useState<number>(600);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  // 1-second countdown interval for active holds
  useEffect(() => {
    if (!activeHold) return;

    const timer = setInterval(() => {
      setHoldSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setActiveHold(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeHold]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeHold={activeHold}
        holdSeconds={holdSeconds}
        orderCount={orders.length}
        onOpenOrders={() => setIsOrdersOpen(true)}
        onOpenCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'app' && (
          <div className="space-y-8">
            <TicketHubApp
              activeHold={activeHold}
              setActiveHold={setActiveHold}
              holdSeconds={holdSeconds}
              setHoldSeconds={setHoldSeconds}
              orders={orders}
              setOrders={setOrders}
              isCheckoutOpen={isCheckoutOpen}
              setIsCheckoutOpen={setIsCheckoutOpen}
              isOrdersOpen={isOrdersOpen}
              setIsOrdersOpen={setIsOrdersOpen}
            />

            <ConcurrencySimulator />
          </div>
        )}

        {activeTab === 'design' && (
          <div className="space-y-8">
            {/* Key Engineering Metrics Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Registered Users</span>
                  <Users className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">2,000,000</div>
                <div className="text-xs text-slate-400 mt-1">Normal daily users</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Big Sale Concurrency</span>
                  <Flame className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-orange-600">200,000</div>
                <div className="text-xs text-slate-400 mt-1">First 10 minutes rush</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Traffic Spike</span>
                  <Award className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">48× / 200×</div>
                <div className="text-xs text-slate-400 mt-1">Requests / Concurrency ratio</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Double Bookings</span>
                  <ShieldAlert className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-purple-600">0 (Strict)</div>
                <div className="text-xs text-slate-400 mt-1">FOR UPDATE SKIP LOCKED</div>
              </div>
            </div>

            <ArchitectureDiagram />

            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm">
              <MarkdownViewer content={designContent} />
            </div>

            <ConcurrencySimulator />
          </div>
        )}

        {activeTab === 'reflection' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm">
              <div className="flex items-center gap-3 pb-6 mb-6 border-b border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Capstone Reflection</h2>
                  <p className="text-sm text-slate-500">
                    Database Concurrency Control, Error Architecture & Event-Driven Systems
                  </p>
                </div>
              </div>

              <MarkdownViewer content={reflectionContent} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TicketHub — High-Concurrency Ticket Reservation System</span>
          <span>Web Foundations Day 8 Assignment • MIT License</span>
        </div>
      </footer>
    </div>
  );
}
