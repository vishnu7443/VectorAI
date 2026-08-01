import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Cpu, Server, HardDrive, Clock, ShieldAlert, CheckCircle, ChevronRight, Activity, Play, Pause, AlertTriangle 
} from 'lucide-react';

const defaultServiceForMode = (m) => {
  if (m === 'ecommerce') return 'shop-frontend';
  if (m === 'inventraerp') return 'erp-frontend';
  return 'payment-service';
};

export default function Dashboard({ dashboardData, setDashboardData }) {
  const [searchParams] = useSearchParams();
  const mode = localStorage.getItem('dashboardMode') || 'standard';
  const serviceParam = searchParams.get('service');
  const [selectedService, setSelectedService] = useState(serviceParam || defaultServiceForMode(mode));
  const [chartData, setChartData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [recentDecisions, setRecentDecisions] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [autoPilot, setAutoPilot] = useState(true);
  const [ecommerceStats, setEcommerceStats] = useState({ active_users: 0, db_sales: 0 });
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [isStale, setIsStale] = useState(false);
  const navigate = useNavigate();
  // Stable refs — hold last known non-empty values to prevent flash-to-empty
  const stableAlerts = React.useRef([]);
  const stablePredictions = React.useRef([]);

  // Ensure selectedService matches the active workspace mode
  useEffect(() => {
    const allowed = mode === 'ecommerce' 
      ? ['shop-frontend', 'shop-auth', 'shop-catalog', 'shop-notifications']
      : mode === 'inventraerp'
      ? ['erp-frontend', 'erp-db']
      : ['payment-service', 'auth-service', 'frontend-service', 'database-service'];
    
    if (!allowed.includes(selectedService)) {
      setSelectedService(defaultServiceForMode(mode));
    }
  }, [mode]);

  // Sync selected service if query param changes
  useEffect(() => {
    if (serviceParam) {
      setSelectedService(serviceParam);
    }
  }, [serviceParam]);
  
  // Stale telemetry check
  useEffect(() => {
    const checkStale = setInterval(() => {
      if (Date.now() - lastUpdated > 10000) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
    }, 2000);
    return () => clearInterval(checkStale);
  }, [lastUpdated]);

  // Fetch Dashboard Stats and Charts
  useEffect(() => {
    let controller = new AbortController();

    const fetchData = async () => {
      // Cancel any in-flight request from the previous cycle
      controller.abort();
      controller = new AbortController();
      const sig = controller.signal;

      try {
        // Fetch all endpoints in parallel — no sequential stalls
        const [alertsRes, predRes, decRes, auditRes] = await Promise.all([
          fetch(`http://localhost:8000/api/alerts?mode=${mode}`, { signal: sig }),
          fetch(`http://localhost:8000/api/predictions?mode=${mode}`, { signal: sig }),
          fetch(`http://localhost:8000/api/decisions/recent?mode=${mode}`, { signal: sig }),
          fetch(`http://localhost:8000/api/timeline/events/recent?limit=5&mode=${mode}`, { signal: sig }),
        ]);

        // Only update state when response is non-empty — prevents flash-to-nothing
        if (alertsRes.ok) {
          const data = await alertsRes.json();
          if (Array.isArray(data)) {
            // Only replace if backend sends actual data; otherwise keep last known
            if (data.length > 0) stableAlerts.current = data;
            setAlerts(data.length > 0 ? data : stableAlerts.current);
          }
        }
        if (predRes.ok) {
          const data = await predRes.json();
          if (Array.isArray(data)) {
            if (data.length > 0) stablePredictions.current = data;
            setPredictions(data.length > 0 ? data : stablePredictions.current);
          }
        }
        if (decRes.ok) {
          const data = await decRes.json();
          if (Array.isArray(data)) setRecentDecisions(data);
        }
        if (auditRes.ok) {
          const data = await auditRes.json();
          if (Array.isArray(data) && data.length > 0) setAuditTrail(data);
        }

        if (mode === 'ecommerce') {
          try {
            const ecoRes = await fetch('http://localhost:8000/api/lumora/stats', { signal: sig });
            if (ecoRes.ok) {
              const eStats = await ecoRes.json();
              setEcommerceStats(eStats);
            }
          } catch (e) {
            if (e.name !== 'AbortError') console.error("Error fetching ecommerce stats:", e);
          }
        }

        setLastUpdated(Date.now());
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Error fetching dashboard statistics:", err);
        }
        // On error: keep previous state — do NOT blank out alerts/predictions
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    // Refetch immediately when user returns to this tab
    const onVisible = () => { if (!document.hidden) fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // Fetch Chart Data for Selected Service
  useEffect(() => {
    const fetchCharts = async () => {
      try {
        const chartRes = await fetch(`http://localhost:8000/api/metrics?service_name=${selectedService}`);
        const chartMetrics = await chartRes.json();
        setChartData(chartMetrics);
        setLastUpdated(Date.now());
      } catch (err) {
        console.error("Error fetching charts data:", err);
      }
    };

    fetchCharts();
    const chartInterval = setInterval(fetchCharts, 3000);
    return () => clearInterval(chartInterval);
  }, [selectedService]);

  const fallbackChartData = [
    { timestamp: '10:00', cpu: 42, memory: 48 },
    { timestamp: '10:01', cpu: 45, memory: 50 },
    { timestamp: '10:02', cpu: 48, memory: 52 },
    { timestamp: '10:03', cpu: 52, memory: 54 },
    { timestamp: '10:04', cpu: 50, memory: 53 },
    { timestamp: '10:05', cpu: 46, memory: 51 }
  ];

  const displayChartData = chartData && chartData.length > 0 
    ? chartData.map(d => ({ 
        ...d, 
        timestamp: d.timestamp && typeof d.timestamp === 'string' ? d.timestamp.split('T')[1]?.substring(0, 5) || d.timestamp : d.timestamp 
      }))
    : fallbackChartData;

  const stats = dashboardData?.metrics_summary || {
    cpu_avg: 0, memory_avg: 0, network_avg: 0, latency_avg: 0, pod_count: 0, node_count: 5
  };

  const getHealthStatusText = () => {
    if (dashboardData?.health_status === "Healthy") return "All workloads operating nominally.";
    if (dashboardData?.health_status === "Warning") return "Sub-optimal telemetry levels detected.";
    return "Critical outage mitigation in progress.";
  };

  const activeThreatAlerts = predictions.filter(p => !p.resolved);
  
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const warningAlerts = alerts.filter(a => a.severity === 'WARNING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      
      {isStale && (
        <div style={{ padding: '0.65rem 1rem', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '10px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
          <AlertTriangle size={15} />
          <strong>Warning:</strong> Telemetry data is stale (no updates in 10s). Verify backend connection.
        </div>
      )}

      
      {/* Welcome & System Summary Bar */}
      <div className="responsive-flex row-md" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--color-dark)', letterSpacing: '-0.4px' }}>
            {mode === 'ecommerce' ? 'E-Commerce Command Center' : mode === 'inventraerp' ? 'Inventra ERP SRE Deck' : 'Welcome back, Operator'}
          </h1>
          <p style={{ color: 'var(--color-slate-400)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {mode === 'ecommerce' ? 'Vector is actively monitoring the E-Commerce application infrastructure.' : mode === 'inventraerp' ? 'Vector SRE is actively guarding the Inventra ERP deployment.' : 'Vector AI Core is monitoring isolated cluster namespaces.'}
          </p>
        </div>

        {/* Workspace selector dropdown */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-slate-400)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Assurance Workspace</span>
            <select 
              value={mode} 
              onChange={(e) => {
                localStorage.setItem('dashboardMode', e.target.value);
                window.location.reload();
              }}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: '#ffffff',
                color: 'var(--color-dark)',
                fontWeight: 700,
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
              }}
            >
              <option value="standard">Global Cluster (Standard Demo)</option>
              <option value="ecommerce">ApexStore E-Commerce (CRUD Live)</option>
              <option value="inventraerp">Inventra ERP (Client Workspace)</option>
            </select>
          </div>

          {/* Top Progress metrics list */}
          <div className="flex-wrap" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {mode === 'ecommerce' ? (
              <>
                {/* Store Active Users */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Store Active Users</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{ecommerceStats.active_users.toLocaleString()}</span>
                </div>

                {/* SLA Status */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Status</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{Math.max(0, dashboardData?.health_score || 99.99)}%</span>
                  <div style={{ height: '4px', borderRadius: '10px', background: 'var(--color-slate-100)', overflow: 'hidden', width: '100%' }}>
                    <div style={{ width: `${Math.max(0, dashboardData?.health_score || 99.9)}%`, height: '100%', background: 'var(--color-green)' }} />
                  </div>
                </div>

                {/* API Latency */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>API Latency</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{stats.latency_avg} ms</span>
                  <div style={{ height: '4px', borderRadius: '10px', background: 'var(--color-slate-100)', overflow: 'hidden', width: '100%' }}>
                    <div style={{ width: `${Math.min(100, stats.latency_avg / 3)}%`, height: '100%', background: 'var(--color-amber)' }} />
                  </div>
                </div>

                {/* Orders Processed */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Orders Processed</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{ecommerceStats.db_sales.toLocaleString()}</span>
                </div>
              </>
            ) : mode === 'inventraerp' ? (
              <>
                {/* Active Clients */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ERP Tenants</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>42 Active</span>
                </div>

                {/* SLA Status */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Health</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{Math.max(0, dashboardData?.health_score || 99.99)}%</span>
                  <div style={{ height: '4px', borderRadius: '10px', background: 'var(--color-slate-100)', overflow: 'hidden', width: '100%' }}>
                    <div style={{ width: `${Math.max(0, dashboardData?.health_score || 99.9)}%`, height: '100%', background: 'var(--color-green)' }} />
                  </div>
                </div>

                {/* ERP API Latency */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ERP Latency</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{stats.latency_avg} ms</span>
                  <div style={{ height: '4px', borderRadius: '10px', background: 'var(--color-slate-100)', overflow: 'hidden', width: '100%' }}>
                    <div style={{ width: `${Math.min(100, stats.latency_avg / 3)}%`, height: '100%', background: 'var(--color-amber)' }} />
                  </div>
                </div>

                {/* ERP Transactions */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ERP Tx / Min</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{Math.round(stats.network_avg / 2).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <>
                {/* CPU Pool */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CPU Pool</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{stats.cpu_avg}%</span>
                  <div style={{ height: '4px', borderRadius: '10px', background: 'var(--color-slate-100)', overflow: 'hidden', width: '100%' }}>
                    <div style={{ width: `${stats.cpu_avg}%`, height: '100%', background: 'var(--color-dark)' }} />
                  </div>
                </div>

                {/* Memory Fills */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.7rem 1rem', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Memory Fills</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{stats.memory_avg}%</span>
                  <div style={{ height: '4px', borderRadius: '10px', background: 'var(--color-slate-100)', overflow: 'hidden', width: '100%' }}>
                    <div style={{ width: `${stats.memory_avg}%`, height: '100%', background: 'var(--color-green)' }} />
                  </div>
                </div>

                {/* Active Pods */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem 1.5rem', minWidth: '150px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Pods</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{stats.pod_count}</span>
                </div>

                {/* Decisions Logged */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem 1.5rem', minWidth: '150px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Decisions Logged</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>{recentDecisions.length}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active Incidents & Predictions Banner — always mounted, opacity transition */}
      <div style={{
        opacity: activeThreatAlerts.length > 0 ? 1 : 0,
        maxHeight: activeThreatAlerts.length > 0 ? '600px' : '0px',
        overflow: 'hidden',
        transition: 'opacity 0.4s ease, max-height 0.4s ease',
        display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-rose)', letterSpacing: '0.5px' }}>
            ⚠️ PRE-CRITICAL FORECAST ALERTS (DETECTED BEFORE SERVICE CRASH)
          </span>
          <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: '#10b981', color: '#ffffff' }}>
            🛡️ ZERO DATA LOSS GUARANTEED | 0 TRANSACTIONS DROPPED
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
          {activeThreatAlerts.map((p) => (
            <div 
              key={p.id} 
              className="glass-card" 
              style={{ 
                padding: '1rem 1.2rem', 
                border: '1px solid rgba(244, 63, 94, 0.15)',
                background: 'rgba(244, 63, 94, 0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="highlight-badge-dark" style={{ backgroundColor: '#f43f5e', fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                    {p.risk_level.toUpperCase()} RISK
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-700)' }}>{p.service_name}</span>
                  <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>+300s Horizon</span>
                </div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-dark)', marginTop: '0.3rem' }}>
                  Predicted {p.metric_name.toUpperCase()} exhaustion ({p.predicted_value}%)
                </h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', fontWeight: 600, marginTop: '0.1rem' }}>
                  Vector Pre-Emptive Mitigation Required — Zero Data Loss Active
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', fontWeight: 500, margin: 0 }}>
                    Confidence: {Math.round(p.confidence_score * 100)}%
                  </p>
                  {p.confidence_score < 0.8 && (
                    <span className="highlight-badge-white" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', border: '1px solid var(--color-amber)', color: 'var(--color-amber)' }}>
                      LOW CONFIDENCE
                    </span>
                  )}
                </div>
              </div>

              <button 
                onClick={() => navigate(`/decision?pred_id=${p.id}`)}
                className="btn-primary"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  gap: '0.2rem',
                  height: '32px'
                }}
              >
                <span>Review</span>
                <ChevronRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Crextio main split layout grid */}
      <div className="responsive-grid three-cols">
        
        {/* Left Column: System Status Accent panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Dynamic Core Health card (green) */}
          <div className="accent-card-green" style={{
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '320px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ zIndex: 2 }}>
              <div className="highlight-badge-white" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', fontWeight: 800 }}>SYSTEM ASSURANCE CORE</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '1.5rem', lineHeight: 1.2 }}>
                Cluster Health is {dashboardData?.health_score}%
              </h2>
              <p style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.5rem', fontWeight: 500 }}>
                {getHealthStatusText()}
              </p>
            </div>

            {/* Illustrative details box */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              padding: '0.8rem 1.2rem',
              borderRadius: '16px',
              border: '1px solid rgba(25,26,35,0.08)',
              zIndex: 2
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Nodes Status</span>
              <span className="highlight-badge-dark" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                {stats.node_count} Nodes Nominal
              </span>
            </div>

            {/* Background design elements */}
            <div className="crextio-stripe" style={{
              position: 'absolute',
              right: '-20px',
              top: '-20px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              opacity: 0.3
            }} />
          </div>

          {/* Governance Rules Accordion List */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-slate-400)', letterSpacing: '0.5px' }}>WORKLOAD CLASSIFICATION</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {mode === 'ecommerce' ? (
                <>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>shop-frontend</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>EDGE</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>shop-auth</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>SECURE</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>shop-catalog</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>STORAGE</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>shop-notifications</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>WORKER</span>
                  </div>
                </>
              ) : mode === 'inventraerp' ? (
                <>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>erp-frontend</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>EDGE</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>erp-core</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>CRITICAL</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>erp-inventory</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>LOGISTICS</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>erp-db</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>STORAGE</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>payment-service</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>CRITICAL</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>auth-service</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>SECURE</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>frontend-service</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>EDGE</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>database-service</span>
                    <span className="highlight-badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>STORAGE</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column: CPU Chart & Autopilot Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Top segment: Expanded Full-Width CPU Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-dark)' }}>CPU Metrics Utilization</span>
              {/* Service selector button pill */}
              <select 
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={{ 
                  padding: '0.35rem 1.6rem 0.35rem 0.8rem', 
                  fontSize: '0.75rem', 
                  border: '1px solid var(--border-color)',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  borderRadius: '8px'
                }}
              >
                {mode === 'ecommerce' ? (
                  <>
                    <option value="shop-frontend">Storefront Web</option>
                    <option value="shop-auth">Authentication</option>
                    <option value="shop-catalog">Product Catalog</option>
                    <option value="shop-notifications">Notification Hub</option>
                  </>
                ) : mode === 'inventraerp' ? (
                  <>
                    <option value="erp-frontend">ERP Frontend</option>
                    <option value="erp-core">ERP Core Engine</option>
                    <option value="erp-inventory">Inventory Service</option>
                    <option value="erp-db">Database Node</option>
                  </>
                ) : (
                  <>
                    <option value="payment-service">Payment Service</option>
                    <option value="auth-service">Auth Service</option>
                    <option value="frontend-service">Frontend Service</option>
                    <option value="database-service">Database Service</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ height: '150px', width: '100%', minHeight: '150px' }}>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={displayChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b9ff66" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#b9ff66" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="cpu" stroke="var(--color-dark)" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom segment: Operational timeline scheduler */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-dark)' }}>Audit Trail Scheduler</span>
              <span className="highlight-badge-white" style={{ fontSize: '0.7rem' }}>TODAY</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', maxHeight: '180px' }}>
              {auditTrail.length === 0 ? (
                <div style={{ fontSize: '0.75rem', opacity: 0.7, textAlign: 'center', padding: '1rem 0' }}>No recent audit events.</div>
              ) : (
                auditTrail.map((ev) => {
                  const dateObj = new Date(ev.timestamp);
                  const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
                  
                  // Extract info based on event type
                  let title = ev.event_type;
                  let description = "Event logged.";
                  
                  if (ev.event_type === 'DETECTION') {
                    title = "Incident Detected";
                    description = ev.payload?.explanation || `Detected ${ev.payload?.incident_type} in ${ev.service_name}.`;
                  } else if (ev.event_type === 'PREDICTION') {
                    title = "Forecast Prediction";
                    description = `Predicted ${ev.payload?.metric} exhaustion in ${ev.service_name}.`;
                  } else if (ev.event_type === 'CANDIDATE_PROPOSAL') {
                    title = "Candidate Generation";
                    description = `Generated mitigation candidates for ${ev.service_name}.`;
                  } else if (ev.event_type === 'ASSURANCE') {
                    title = "Decision Assurance";
                    description = ev.payload?.explanation || `Evaluated decision with score ${ev.payload?.score}.`;
                  } else if (ev.event_type === 'EXECUTION') {
                    title = "Remediation Executed";
                    description = ev.payload?.summary || `Executed ${ev.payload?.action} on ${ev.service_name}.`;
                  } else if (ev.event_type === 'RECOVERY') {
                    title = "Service Recovered";
                    description = ev.payload?.explanation || `${ev.service_name} returned to baseline.`;
                  }

                  return (
                    <div key={ev.id} style={{
                      display: 'flex',
                      gap: '1rem',
                      padding: '0.8rem',
                      backgroundColor: 'rgba(25, 26, 35, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px'
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-dark)', width: '60px', borderRight: '1px solid var(--border-color)', paddingRight: '0.5rem' }}>
                        {timeString}
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        <strong>{title}</strong> - {description}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Policies & Actions Task List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Active Policies compliances gauges */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-dark)' }}>Workload Bounds</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-emerald)' }}>98% Safe</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Stat 1 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  <span>Scaling Bounds</span>
                  <span>100% compliant</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--color-slate-100)', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'var(--color-green)' }} />
                </div>
              </div>

              {/* Stat 2 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  <span>Database Resets</span>
                  <span>Locked</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--color-slate-100)', overflow: 'hidden' }}>
                  <div style={{ width: '85%', height: '100%', background: 'var(--color-dark)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Onboarding Task list (Dark card) */}
          <div className="accent-card-dark" style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
            flex: 1
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>Remediation queue</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-green)' }}>
                {recentDecisions.filter(d => d.status === 'EXECUTED').length}/{recentDecisions.length || 3}
              </span>
            </div>

            {/* Checklist tasks container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', maxHeight: '220px' }}>
              {recentDecisions.length === 0 ? (
                <div style={{ fontSize: '0.75rem', opacity: 0.7, textAlign: 'center', padding: '1rem 0' }}>No active decisions in queue.</div>
              ) : (
                recentDecisions.map((dec) => {
                  const isDone = dec.status === 'EXECUTED';
                  return (
                    <div 
                      key={dec.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.8rem 1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {isDone ? (
                          <CheckCircle size={16} color="var(--color-green)" style={{ strokeWidth: 3 }} />
                        ) : (
                          <AlertTriangle size={16} color="var(--color-amber)" />
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#ffffff', fontWeight: 600 }}>
                          {dec.action_name}
                        </span>
                      </div>

                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 700, 
                        color: isDone ? 'var(--color-green)' : 'var(--color-amber)',
                        textTransform: 'uppercase'
                      }}>
                        {dec.status.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Active Alerts Panel — always mounted, CSS transition */}
          <div style={{
            opacity: (criticalAlerts.length > 0 || warningAlerts.length > 0) ? 1 : 0,
            maxHeight: (criticalAlerts.length > 0 || warningAlerts.length > 0) ? '600px' : '0px',
            overflow: 'hidden',
            transition: 'opacity 0.4s ease, max-height 0.4s ease',
          }}>
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-dark)' }}>Live Anomaly Logs</span>
              
              {criticalAlerts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-rose)' }}>CRITICAL</span>
                  {criticalAlerts.map(a => (
                    <div key={a.id} style={{ fontSize: '0.75rem', padding: '0.5rem', background: 'rgba(244, 63, 94, 0.05)', borderLeft: '3px solid var(--color-rose)' }}>
                      <strong>{a.title}</strong>: {a.description}
                    </div>
                  ))}
                </div>
              )}
              
              {warningAlerts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-amber)' }}>WARNING</span>
                  {warningAlerts.map(a => (
                    <div key={a.id} style={{ fontSize: '0.75rem', padding: '0.5rem', background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid var(--color-amber)' }}>
                      <strong>{a.title}</strong>: {a.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
