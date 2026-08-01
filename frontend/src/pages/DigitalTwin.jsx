import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, Globe, Network, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DigitalTwin() {
  const [activeSims, setActiveSims] = useState([]);
  const mode = localStorage.getItem('dashboardMode') || 'standard';
  const navigate = useNavigate();

  // Topology definitions based on mode
  const topologies = {
    standard: [
      { id: 'frontend-service', label: 'Frontend Service', x: 200, y: 150, icon: Globe },
      { id: 'auth-service', label: 'Auth Service', x: 500, y: 100, icon: Shield },
      { id: 'payment-service', label: 'Payment Service', x: 500, y: 200, icon: Activity },
      { id: 'database-service', label: 'Database Cluster', x: 800, y: 150, icon: Database },
    ],
    ecommerce: [
      { id: 'shop-frontend', label: 'Storefront Web', x: 200, y: 150, icon: Globe },
      { id: 'shop-auth', label: 'Authentication', x: 500, y: 100, icon: Shield },
      { id: 'shop-catalog', label: 'Product Catalog', x: 500, y: 250, icon: Database },
      { id: 'shop-notifications', label: 'Notification Hub', x: 800, y: 150, icon: Activity },
    ],
    paas: [
      { id: 'paas-web-app', label: 'paas Web App', x: 200, y: 150, icon: Globe },
      { id: 'paas-api-gateway', label: 'API Gateway', x: 500, y: 150, icon: Network },
      { id: 'paas-auth-proxy', label: 'Auth Proxy', x: 500, y: 300, icon: Shield },
      { id: 'paas-db-cluster', label: 'Database Cluster', x: 800, y: 150, icon: Database },
    ],
    inventraerp: [
      { id: 'erp-frontend', label: 'ERP Web Frontend', x: 300, y: 200, icon: Globe },
      { id: 'erp-db', label: 'ERP Relational DB', x: 700, y: 200, icon: Database },
    ]
  };

  const edges = {
    standard: [
      { source: 'frontend-service', target: 'auth-service' },
      { source: 'frontend-service', target: 'payment-service' },
      { source: 'payment-service', target: 'database-service' },
      { source: 'auth-service', target: 'database-service' }
    ],
    ecommerce: [
      { source: 'shop-frontend', target: 'shop-auth' },
      { source: 'shop-frontend', target: 'shop-catalog' },
      { source: 'shop-catalog', target: 'shop-notifications' },
      { source: 'shop-auth', target: 'shop-notifications' }
    ],
    paas: [
      { source: 'paas-web-app', target: 'paas-api-gateway' },
      { source: 'paas-web-app', target: 'paas-auth-proxy' },
      { source: 'paas-api-gateway', target: 'paas-db-cluster' },
      { source: 'paas-auth-proxy', target: 'paas-db-cluster' }
    ],
    inventraerp: [
      { source: 'erp-frontend', target: 'erp-db' }
    ]
  };

  const nodes = topologies[mode] || topologies['standard'];
  const connections = edges[mode] || edges['standard'];

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/simulations/status');
      if (res.ok) {
        const data = await res.json();
        const filtered = data.filter(s => {
            if (mode === 'ecommerce') return s.service.startsWith('shop-');
            if (mode === 'inventraerp') return s.service.startsWith('erp-');
            return !s.service.startsWith('shop-') && !s.service.startsWith('erp-');
          });
        setActiveSims(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [mode]);

  // Determine node status
  const getNodeStatus = (nodeId) => {
    const sim = activeSims.find(s => s.service === nodeId);
    if (!sim) return 'healthy';
    return sim.prevented ? 'protected' : 'degraded';
  };

  const getSimDetails = (nodeId) => {
    return activeSims.find(s => s.service === nodeId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-dark)', letterSpacing: '-0.5px' }}>
            Infrastructure Digital Twin
          </h1>
          <p style={{ color: 'var(--color-slate-500)', fontSize: '1rem', marginTop: '0.4rem' }}>
            Live topology of the {mode === 'ecommerce' ? 'E-Commerce' : 'Vector Core'} cluster.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }}></div> Healthy
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', boxShadow: '0 0 10px #3b82f6' }}></div> Proactive Defense Active
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }}></div> Degraded
          </div>
        </div>
      </div>

      {/* SVG Visualization Container */}
      <div className="glass-panel" style={{
        height: '600px',
        width: '100%',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflowX: 'auto',
        overflowY: 'hidden',
        borderRadius: '16px'
      }}>
        <div style={{ minWidth: '1000px', height: '100%', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 1000 500" style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
            </marker>

            <filter id="glow-protected">
              <feGaussianBlur stdDeviation="6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-degraded">
              <feGaussianBlur stdDeviation="8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Render Edges */}
          {connections.map((edge, idx) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            // Check if traffic flow should be animated red/green
            const targetStatus = getNodeStatus(targetNode.id);
            const strokeColor = targetStatus === 'degraded' ? '#fecaca' : targetStatus === 'protected' ? '#bfdbfe' : '#e2e8f0';

            return (
              <g key={idx}>
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={strokeColor}
                  strokeWidth="3"
                  markerEnd="url(#arrowhead)"
                  strokeDasharray={targetStatus === 'degraded' ? "5,5" : "0"}
                />
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node) => {
            const status = getNodeStatus(node.id);
            const sim = getSimDetails(node.id);

            let strokeColor = '#10b981'; // Healthy Green
            let bgColor = '#ecfdf5';
            let glowFilter = '';

            if (status === 'degraded') {
              strokeColor = '#ef4444'; // Red
              bgColor = '#fef2f2';
              glowFilter = 'url(#glow-degraded)';
            } else if (status === 'protected') {
              strokeColor = '#3b82f6'; // Blue
              bgColor = '#eff6ff';
              glowFilter = 'url(#glow-protected)';
            }

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                onClick={() => navigate(`/simulator`)}
              >
                {/* Node Circle Background */}
                <circle
                  r="45"
                  fill={bgColor}
                  stroke={strokeColor}
                  strokeWidth={status !== 'healthy' ? "4" : "2"}
                  filter={glowFilter}
                />

                {/* Pulse Animation for active sims */}
                {status !== 'healthy' && (
                  <circle
                    r="45"
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2"
                  >
                    <animate attributeName="r" from="45" to="65" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Node Label Text */}
                <text
                  y="65"
                  textAnchor="middle"
                  fill="var(--color-dark)"
                  fontSize="14"
                  fontWeight="700"
                >
                  {node.label}
                </text>

                {/* Incident Detail Text if Active */}
                {sim && (
                  <text
                    y="85"
                    textAnchor="middle"
                    fill={strokeColor}
                    fontSize="12"
                    fontWeight="600"
                  >
                    {sim.type.replace('_', ' ')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Icons Over SVG */}
        {nodes.map(node => {
          const status = getNodeStatus(node.id);
          const Icon = node.icon;
          let iconColor = '#10b981';
          if (status === 'degraded') iconColor = '#ef4444';
          if (status === 'protected') iconColor = '#3b82f6';

          return (
            <div
              key={`icon-${node.id}`}
              style={{
                position: 'absolute',
                left: `calc(${node.x / 1000 * 100}% - 16px)`,
                top: `calc(${node.y / 500 * 100}% - 16px)`,
                pointerEvents: 'none'
              }}
            >
              <Icon size={32} color={iconColor} />
            </div>
          );
        })}
        </div>
      </div>

    </div>
  );
}
