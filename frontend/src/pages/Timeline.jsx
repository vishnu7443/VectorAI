import React, { useState, useEffect } from 'react';
import { History, Clock, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

export default function Timeline() {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState(null);

  // Fetch incidents list on mount & polling in real-time
  const selectedIncidentIdRef = React.useRef(selectedIncidentId);
  useEffect(() => {
    selectedIncidentIdRef.current = selectedIncidentId;
  }, [selectedIncidentId]);

  // Fetch incidents list on mount & polling in real-time
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const mode = localStorage.getItem('dashboardMode') || 'standard';
        const res = await fetch(`http://localhost:8000/api/timeline?mode=${mode}`);
        const data = await res.json();
        setIncidents(data);
        if (!selectedIncidentIdRef.current && data.length > 0) {
          setSelectedIncidentId(data[0].timeline_id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch audit trail events when selected incident changes & polling in real-time
  useEffect(() => {
    if (!selectedIncidentId) return;

    let isFirstCall = true;

    const fetchEvents = async () => {
      if (isFirstCall) setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/timeline/${selectedIncidentId}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isFirstCall) {
          setLoading(false);
          isFirstCall = false;
        }
      }
    };
    fetchEvents();
    const interval = setInterval(fetchEvents, 2000);
    return () => clearInterval(interval);
  }, [selectedIncidentId]);

  const toggleExpandEvent = (eventId) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  const getEventBadgeColor = (type) => {
    switch (type) {
      case 'DETECTION': return '#e11d48'; // rose
      case 'PREDICTION': return '#f59e0b'; // amber
      case 'CANDIDATE_PROPOSAL': return '#475569'; // slate
      case 'ASSURANCE': return '#0891b2'; // cyan
      case 'APPROVAL': return '#4f46e5'; // indigo
      case 'EXECUTION': return '#7c3aed'; // violet
      case 'RECOVERY': return '#059669'; // emerald
      case 'ROLLBACK': return '#d97706'; // amber warning
      default: return '#1e293b';
    }
  };

  return (
    <div className="responsive-grid timeline-cols" style={{ gap: '1.5rem', width: '100%', alignItems: 'start' }}>
      {/* Incident Selection Column (Left) */}
      <div className="glass-panel" style={{ 
        padding: '1.5rem', 
        backgroundColor: '#ffffff',
        maxHeight: 'calc(100vh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: '1.5rem'
      }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--color-dark)', marginBottom: '1rem', letterSpacing: '1px', display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          <History size={18} style={{ strokeWidth: 2.5 }} />
          INCIDENT TIMELINES ({incidents.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', paddingRight: '0.3rem', flexGrow: 1 }}>
          {incidents.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-400)', textAlign: 'center', padding: '2rem 0', fontWeight: 500 }}>
              No incidents registered in database yet.
            </div>
          ) : (
            incidents.map((inc) => {
              const isSelected = selectedIncidentId === inc.timeline_id;
              return (
                <div
                  key={inc.timeline_id}
                  onClick={() => setSelectedIncidentId(inc.timeline_id)}
                  className="glass-card"
                  style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--color-green)' : '#ffffff',
                    border: '1px solid',
                    borderColor: isSelected ? 'rgba(25, 26, 35, 0.1)' : 'var(--border-color)',
                    boxShadow: isSelected ? '0 8px 24px rgba(185, 255, 102, 0.2)' : '0 4px 15px rgba(25, 26, 35, 0.015)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span className="highlight-badge-dark" style={{ 
                      fontSize: '0.65rem', 
                      background: inc.resolved ? '#10b981' : '#f43f5e',
                      padding: '0.15rem 0.4rem'
                    }}>
                      {inc.resolved ? "RESOLVED" : "ACTIVE"}
                    </span>
                    
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-dark)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                      {inc.start_time ? inc.start_time.slice(11, 19) : ''} UTC
                    </span>
                  </div>

                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                    {inc.incident_type ? inc.incident_type.replace('_', ' ') : 'INCIDENT'}
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-dark)', marginTop: '0.2rem', fontWeight: 600, opacity: 0.8 }}>
                    Target: {inc.service_name}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Events Chronological Timeline (Right) */}
      <div className="glass-panel" style={{ 
        padding: '1.5rem', 
        backgroundColor: '#ffffff',
        maxHeight: 'calc(100vh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <Clock size={20} color="var(--color-dark)" style={{ strokeWidth: 2.5 }} />
          Audit Trail Chronology ({events.length} Events)
        </h3>

        <div style={{ overflowY: 'auto', paddingRight: '0.5rem', flexGrow: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-dark)', fontWeight: 700 }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-dark)', opacity: 0.7, fontWeight: 700 }}>Select an incident on the left to inspect timeline audit trail.</div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* Timeline center line */}
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '8px',
                bottom: '8px',
                width: '3px',
                background: 'var(--color-slate-100)',
                borderRadius: '2px'
              }} />

              {events.map((ev) => {
                const badgeColor = getEventBadgeColor(ev.event_type);
                const isExpanded = expandedEventId === ev.id;
                return (
                  <div key={ev.id} style={{ position: 'relative' }}>
                    {/* Bullet node dot */}
                    <span style={{
                      position: 'absolute',
                      left: '-34px',
                      top: '8px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: badgeColor,
                      border: '3px solid #ffffff',
                      boxShadow: '0 2px 6px rgba(25, 26, 35, 0.15)'
                    }} />

                    {/* Event Card */}
                    <div 
                      className="glass-card" 
                      style={{ 
                        padding: '1rem 1.2rem',
                        border: '1px solid var(--border-color)',
                        background: '#ffffff',
                        boxShadow: '0 4px 15px rgba(25, 26, 35, 0.01)'
                      }}
                    >
                      <div 
                        onClick={() => toggleExpandEvent(ev.id)}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            background: badgeColor,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            letterSpacing: '0.5px'
                          }}>
                            {ev.event_type ? ev.event_type.replace('_', ' ') : 'EVENT'}
                          </span>
                          
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-dark)' }}>
                            {ev.payload?.message || ev.payload?.explanation || `System event recorded for ${ev.service_name}.`}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--color-slate-400)', fontWeight: 600 }}>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>
                            {ev.timestamp ? ev.timestamp.slice(11, 19) : ''}
                          </span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {/* Expandable JSON details */}
                      {isExpanded && (
                        <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-dark)', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                            <Terminal size={12} />
                            <span>Forensic Payload Data:</span>
                          </div>
                          <pre style={{
                            background: 'var(--color-slate-50)',
                            padding: '0.8rem',
                            borderRadius: '10px',
                            overflowX: 'auto',
                            fontSize: '0.75rem',
                            color: 'var(--color-slate-700)',
                            border: '1px solid var(--border-color)',
                            lineHeight: 1.4,
                            fontWeight: 600
                          }}>
                            {JSON.stringify(ev.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
