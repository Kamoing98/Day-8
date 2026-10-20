import React, { useState } from 'react';
import { Shield, Server, Database, Layers, Zap, CreditCard, Clock, Activity, CheckCircle2 } from 'lucide-react';

interface ComponentInfo {
  id: string;
  name: string;
  icon: any;
  category: string;
  role: string;
  peakHandling: string;
  tech: string;
}

const COMPONENTS: ComponentInfo[] = [
  {
    id: 'cdn',
    name: 'Cloudflare CDN + WAF',
    icon: Shield,
    category: 'Edge & Security',
    role: 'Serves cached event listings, static seat map geometries, and JS bundles from 300+ edge locations. WAF mitigates volumetric DDoS attacks.',
    peakHandling: 'Absorbs 85% of browse traffic before requests touch origin infrastructure.',
    tech: 'Cloudflare Enterprise / AWS CloudFront + AWS WAF'
  },
  {
    id: 'lb',
    name: 'Application Load Balancer',
    icon: Activity,
    category: 'Traffic Routing',
    role: 'Distributes incoming traffic across auto-scaled stateless API servers using round-robin and least-connections routing with sub-second health checks.',
    peakHandling: 'Handles 1,667+ peak requests/second with TLS termination and HTTP/2 multiplexing.',
    tech: 'AWS ALB / NGINX Plus'
  },
  {
    id: 'api',
    name: 'Stateless API Cluster (Auto-scaled)',
    icon: Server,
    category: 'Compute',
    role: 'Executes core ticketing logic, authentication, input validation, and transaction orchestration. Completely stateless to enable instant elastic scale.',
    peakHandling: 'Scales from 4 base instances up to 50+ pods during high-demand on-sales.',
    tech: 'Node.js / Go on Kubernetes (EKS/GKE)'
  },
  {
    id: 'redis',
    name: 'Redis Cluster (Cache & Holds)',
    icon: Zap,
    category: 'In-Memory Store',
    role: 'Caches 2-second TTL seat maps, stores active 10-minute hold tokens, tracks session state, and enforces per-user rate limits (max 5 holds/min).',
    peakHandling: 'Sub-millisecond latency for seat availability queries under 200,000 concurrent users.',
    tech: 'Redis 7.2 Cluster with Redis Sentinel'
  },
  {
    id: 'db-primary',
    name: 'Primary PostgreSQL (Writes)',
    icon: Database,
    category: 'Persistence',
    role: 'The authoritative source of truth. Executes atomic row-level locks via FOR UPDATE SKIP LOCKED and enforces UNIQUE(seat_id) on order_items.',
    peakHandling: 'PgBouncer connection pooler maintains 5,000+ client connections to prevent database socket exhaustion.',
    tech: 'PostgreSQL 16 with PgBouncer'
  },
  {
    id: 'db-replicas',
    name: 'PostgreSQL Read Replicas (2-3 Nodes)',
    icon: Layers,
    category: 'Persistence',
    role: 'Offloads all read-heavy queries (browsing events, viewing orders, venue configurations) from the primary database.',
    peakHandling: 'Maintains sub-10ms query response times under high read concurrency.',
    tech: 'Async streaming replication'
  },
  {
    id: 'queue',
    name: 'Message Queue (SQS / Redis Streams)',
    icon: Clock,
    category: 'Async Processing',
    role: 'Buffers non-critical post-checkout workflows: email ticket confirmations, mobile push alerts, and audit logging.',
    peakHandling: 'Prevents third-party email/SMS provider slowness from impacting purchase latency.',
    tech: 'AWS SQS / RabbitMQ'
  },
  {
    id: 'stripe',
    name: 'Payment Gateway (Stripe)',
    icon: CreditCard,
    category: 'Third-Party Service',
    role: 'Processes tokenized credit card transactions synchronously inside the order transaction to guarantee seat settlement.',
    peakHandling: 'Idempotency keys prevent double charging even if network disconnects mid-flight.',
    tech: 'Stripe PaymentIntents API'
  }
];

export const ArchitectureDiagram: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('db-primary');
  const activeComp = COMPONENTS.find(c => c.id === selectedId) || COMPONENTS[0];

  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl my-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            Interactive System Architecture
          </div>
          <h3 className="text-xl font-bold text-white mt-1">
            TicketHub High-Concurrency Infrastructure
          </h3>
          <p className="text-sm text-slate-400">
            Click any component to inspect how it guarantees 99.95% uptime and 0 double-bookings during the "Big Sale".
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300">Target: 200,000 Concurrent Users</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
        {COMPONENTS.map((comp) => {
          const Icon = comp.icon;
          const isSelected = comp.id === selectedId;
          return (
            <button
              key={comp.id}
              onClick={() => setSelectedId(comp.id)}
              className={`p-4 rounded-xl text-left transition-all border flex flex-col justify-between ${
                isSelected
                  ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                  : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">{comp.category}</div>
                <div className="text-sm font-semibold text-white mt-0.5 leading-tight">{comp.name}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-slate-800/90 rounded-xl p-5 border border-indigo-900/60 transition-all">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-indigo-600 text-white">
            {React.createElement(activeComp.icon, { className: "w-5 h-5" })}
          </div>
          <div>
            <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">{activeComp.category}</div>
            <h4 className="text-lg font-bold text-white">{activeComp.name}</h4>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4">
          <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-700/50">
            <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Core Responsibility</span>
            <p className="text-slate-200 leading-relaxed text-xs">{activeComp.role}</p>
          </div>
          <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-700/50">
            <span className="text-xs font-semibold text-emerald-400 uppercase block mb-1">Peak Concurrency Strategy</span>
            <p className="text-slate-200 leading-relaxed text-xs">{activeComp.peakHandling}</p>
          </div>
          <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-700/50">
            <span className="text-xs font-semibold text-indigo-400 uppercase block mb-1">Technologies</span>
            <p className="text-slate-200 leading-relaxed text-xs font-mono">{activeComp.tech}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
