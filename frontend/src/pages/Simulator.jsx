import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Play, Square, Info, ShieldAlert, CheckCircle, Activity } from 'lucide-react';

export default function Simulator() {
  const [incidentType, setIncidentType] = useState('CPU_SPIKE');
  const [targetService, setTargetService] = useState('payment-service');
  const [severity, setSeverity] = useState('MEDIUM');
  const [duration, setDuration] = useState(60);
  const [proactiveDefense, setProactiveDefense] = useState(true);
  const [activeSims, setActiveSims] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const mode = localStorage.getItem('dashboardMode') || 'standard';
  const navigate = useNavigate();

  useEffect(() => {
    if (mode === 'ecommerce') {
      setTargetService('shop-frontend');
    } else if (mode === 'inventraerp') {
      setTargetService('erp-frontend');
    }
  }, [mode]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/simulations/status');
      const data = await res.json();
      const filtered = data.filter(s => 
        mode === 'ecommerce' ? s.service.startsWith('shop-') : 
        mode === 'inventraerp' ? s.service.startsWith('erp-') : 
        (!s.service.startsWith('shop-') && !s.service.startsWith('erp-'))
      );
      setActiveSims(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        incident_type: incidentType,
        target_service: targetService,
        severity,
        duration_seconds: duration,
        proactive_defense: proactiveDefense
      };

      const res = await fetch('http://localhost:8000/api/simulations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        let errMsg = "Simulation already active on target.";
        if (errData && errData.detail) {
          if (typeof errData.detail === 'string') {
            errMsg = errData.detail;
          } else if (Array.isArray(errData.detail)) {
            errMsg = errData.detail.map(e => e.msg).join(', ');
          }
        }
        throw new Error(errMsg);
      }

      setSuccessMsg(`Disturbance injected. Simulating ${incidentType.replace('_', ' ')} on ${targetService}. Redirection details loading...`);
      
      // Update local simulations list instantly
      const newSim = {
        id: Math.random().toString(),
        type: incidentType,
        service: targetService,
        severity: severity,
        duration: duration,
        prevented: proactiveDefense,
        elapsed: 0
      };
      setActiveSims(prev => {
        const filtered = prev.filter(s => s.service !== targetService);
        return [...filtered, newSim];
      });

      // Redirect automatically to Dashboard after 3 seconds
      setTimeout(() => {
        navigate(`/dashboard?service=${targetService}`);
      }, 3000);

    } catch (err) {
      setError(err.message);
    }
  };

  const handleStop = async (serviceName) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`http://localhost:8000/api/simulations/stop/${serviceName}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to stop simulation.");
      setSuccessMsg(`Restored baseline telemetry for ${serviceName}.`);
      fetchStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  const incidentDetails = {
    CPU_SPIKE: "Spikes CPU limits dynamically to ~95% utilization. Expect high workloads and latency metrics surge.",
    MEMORY_LEAK: "Gradually leaks process memory towards 97% to simulate OutOfMemory (OOM) alerts. Triggers restart recommendations.",
    TRAFFIC_SURGE: "Simulates high incoming API request surge, escalating network throughput and overall cluster latency.",
    POD_CRASH: "Destroys a service replica node. Functional pods count drops, raising availability threat metrics.",
    NODE_FAILURE: "Simulates an entire Kubernetes node entering NotReady state, forcing pod rescheduling and service migrations.",
    DATABASE_DEADLOCK: "Simulates a transaction deadlock in the database cluster, causing pending queries to build up and latency to skyrocket.",
    STORAGE_EXHAUSTION: "Simulates persistent volume capacity reaching 99%. Triggers immediate write failures and risk of data loss.",
    NETWORK_PARTITION: "Injects packet loss between microservices to simulate a partial network partition and timeout errors.",
    CONFIG_MISMATCH: "Deploys a corrupted config map to the target service causing it to fail readiness probes during startup.",
    DNS_RESOLUTION_FAILURE: "Simulates a failure in the cluster DNS resolver, causing internal microservice communication to drop.",
    CERTIFICATE_EXPIRATION: "Simulates an expired TLS certificate, triggering secure connection failures between components."
  };

  return (
    <div className="responsive-grid two-cols" style={{ width: '100%' }}>
      {/* Simulation Configuration Card */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.8rem' }}>
          <Zap size={22} color="var(--color-dark)" style={{ strokeWidth: 2.5 }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Trigger Telemetry Disturbance</h2>
        </div>

        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Incident Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-dark)', marginBottom: '0.6rem', letterSpacing: '0.5px' }}>INCIDENT SCENARIO TEMPLATE</label>
            <select 
              value={incidentType} 
              onChange={(e) => setIncidentType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.8rem',
                fontSize: '0.9rem'
              }}
            >
              <option value="CPU_SPIKE">CPU Utilization Spike</option>
              <option value="MEMORY_LEAK">Memory Leak / OOM Risk</option>
              <option value="TRAFFIC_SURGE">High Traffic API Surge</option>
              <option value="POD_CRASH">Replica Pod Termination (Crash)</option>
              <option value="NODE_FAILURE">Kubernetes Worker Node Outage</option>
              <option value="DATABASE_DEADLOCK">Database Query Deadlock</option>
              <option value="STORAGE_EXHAUSTION">Storage Volume Exhaustion</option>
              <option value="NETWORK_PARTITION">Network Partition (Packet Loss)</option>
              <option value="CONFIG_MISMATCH">Configuration Mismatch</option>
              <option value="DNS_RESOLUTION_FAILURE">DNS Resolution Failure</option>
              <option value="CERTIFICATE_EXPIRATION">TLS Certificate Expiration</option>
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', marginTop: '0.5rem', fontStyle: 'italic', display: 'flex', gap: '0.3rem', alignItems: 'center', fontWeight: 500 }}>
              <Info size={12} />
              {incidentDetails[incidentType]}
            </div>
          </div>

          <div className="responsive-grid" style={{ gap: '1.2rem' }}>
            {/* Target Workload */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-dark)', marginBottom: '0.6rem', letterSpacing: '0.5px' }}>TARGET SERVICE</label>
              <select 
                value={targetService} 
                onChange={(e) => setTargetService(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontSize: '0.9rem'
                }}
              >
                {mode === 'ecommerce' ? (
                  <>
                    <option value="shop-frontend">shop-frontend</option>
                    <option value="shop-auth">shop-auth</option>
                    <option value="shop-catalog">shop-catalog</option>
                    <option value="shop-notifications">shop-notifications</option>
                  </>
                ) : mode === 'inventraerp' ? (
                  <>
                    <option value="erp-frontend">erp-frontend</option>
                    <option value="erp-core">erp-core</option>
                    <option value="erp-inventory">erp-inventory</option>
                    <option value="erp-db">erp-db</option>
                  </>
                ) : (
                  <>
                    <option value="payment-service">payment-service</option>
                    <option value="auth-service">auth-service</option>
                    <option value="frontend-service">frontend-service</option>
                    <option value="database-service">database-service</option>
                  </>
                )}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-dark)', marginBottom: '0.6rem', letterSpacing: '0.5px' }}>INCIDENT SEVERITY</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['LOW', 'MEDIUM', 'HIGH'].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    style={{
                      flex: 1,
                      padding: '0.8rem 0',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: severity === sev ? 'var(--color-dark)' : 'var(--border-color)',
                      background: severity === sev ? 'var(--color-dark)' : 'rgba(25, 26, 35, 0.02)',
                      color: severity === sev ? '#ffffff' : 'var(--color-slate-700)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-dark)', marginBottom: '0.6rem', letterSpacing: '0.5px' }}>SIMULATION TIMEOUT</label>
            <div className="flex-wrap" style={{ gap: '0.5rem' }}>
              {[30, 60, 120, 180].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setDuration(dur)}
                  style={{
                    flex: 1,
                    padding: '0.7rem 0',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: duration === dur ? 'var(--color-dark)' : 'var(--border-color)',
                    background: duration === dur ? 'var(--color-dark)' : 'rgba(25, 26, 35, 0.02)',
                    color: duration === dur ? '#ffffff' : 'var(--color-slate-700)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {dur} Sec
                </button>
              ))}
            </div>
          </div>
          
          {/* Proactive Defense Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem', background: proactiveDefense ? 'rgba(16,185,129,0.05)' : 'rgba(25, 26, 35, 0.03)', border: '1px solid', borderColor: proactiveDefense ? 'rgba(16,185,129,0.2)' : 'var(--border-color)', borderRadius: '12px', cursor: 'pointer' }} onClick={() => setProactiveDefense(!proactiveDefense)}>
            <div style={{ width: '40px', height: '22px', background: proactiveDefense ? '#10b981' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
              <div style={{ width: '18px', height: '18px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: proactiveDefense ? '20px' : '2px', transition: '0.3s' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-dark)' }}>Enable Vector AI Proactive Defense</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)' }}>If enabled, Vector will proactively predict the failure and auto-remediate (zero downtime).</div>
            </div>
          </div>

          {/* Status logs */}
          {error && (
            <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', padding: '0.8rem 1.2rem', borderRadius: '12px', fontSize: '0.85rem', color: '#f43f5e', fontWeight: 600 }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', padding: '0.8rem 1.2rem', borderRadius: '12px', fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
              {successMsg}
            </div>
          )}

          {/* Start CTA */}
          <button 
            type="submit" 
            className="btn-primary"
            style={{
              padding: '1rem',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.95rem'
            }}
          >
            <Play size={16} fill="#ffffff" stroke="#ffffff" />
            Inject Operational Disturbance
          </button>
        </form>
      </div>

      {/* Simulator Cockpit Status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Active disturbances list */}
        <div className="glass-panel" style={{ padding: '2rem', flex: 1, backgroundColor: '#ffffff' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} color="var(--color-dark)" style={{ strokeWidth: 2.5 }} />
            Active Disturbance Registry
          </h3>

          {activeSims.length === 0 ? (
            <div style={{ 
              height: '80%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--color-dark)',
              fontSize: '0.85rem',
              textAlign: 'center',
              opacity: 0.7
            }}>
              <CheckCircle size={36} color="#10b981" style={{ marginBottom: '0.8rem' }} />
              Cluster is running normally.<br />No active simulations.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeSims.map((sim) => (
                <div 
                  key={sim.id} 
                  className="glass-card" 
                  style={{ 
                    padding: '1.2rem', 
                    border: '1px solid rgba(244,63,94,0.15)',
                    background: 'rgba(244,63,94,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="highlight-badge-dark" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', backgroundColor: '#f43f5e' }}>
                          {sim.type.replace('_', ' ')}
                        </span>
                        {sim.prevented && (
                          <span className="highlight-badge-dark" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', backgroundColor: '#10b981' }}>
                            PREVENTED
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-dark)' }}>
                        {sim.service}
                      </h4>
                    </div>

                    <button
                      onClick={() => handleStop(sim.service)}
                      className="btn-secondary"
                      style={{
                        padding: '0.4rem 0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        color: '#f43f5e',
                        borderColor: 'rgba(244,63,94,0.15)'
                      }}
                    >
                      <Square size={10} fill="#f43f5e" stroke="#f43f5e" />
                      Recover
                    </button>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--color-dark)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>Severity: <span style={{ fontWeight: 800, color: '#f43f5e' }}>{sim.severity}</span></span>
                    <span>Elapsed: <span style={{ fontWeight: 800, color: 'var(--color-dark)', fontFamily: 'JetBrains Mono' }}>{Math.round(sim.elapsed)}s</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chaos Engineering Info Box */}
        <div className="accent-card-green" style={{ padding: '1.5rem', display: 'flex', gap: '0.8rem' }}>
          <ShieldAlert size={28} color="var(--color-dark)" style={{ flexShrink: 0, strokeWidth: 2.5 }} />
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-dark)', marginBottom: '0.2rem' }}>Safety Enclosure Guard</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-dark)', lineHeight: 1.4, fontWeight: 500, opacity: 0.9 }}>
              The Incident Simulator creates controlled disturbances in the isolated telemetry space. Vector guarantees that no destructive actions will leak outside of the configured sandbox namespace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
