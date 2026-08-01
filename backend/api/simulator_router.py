import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import TimelineEvent
from ..services.metrics_service import active_simulations

router = APIRouter(prefix="/api/simulations")

@router.post("/start")
def start_simulation(
    incident_type: str = Body(..., embed=True),
    severity: str = Body(..., embed=True), # LOW, MEDIUM, HIGH
    duration_seconds: int = Body(60, embed=True),
    target_service: str = Body(..., embed=True),
    proactive_defense: bool = Body(False, embed=True),
    db: Session = Depends(get_db)
):
    valid_services = [
        "payment-service", "auth-service", "frontend-service", "database-service",
        "shop-frontend", "shop-auth", "shop-catalog", "shop-notifications",
        "paas-web-app", "paas-api-gateway", "paas-auth-proxy", "paas-db-cluster",
        "erp-frontend", "erp-core", "erp-inventory", "erp-db"
    ]
    if target_service not in valid_services:
        raise HTTPException(status_code=400, detail="Invalid target service.")
        
    valid_incidents = [
        "CPU_SPIKE", "MEMORY_LEAK", "TRAFFIC_SURGE", "POD_CRASH", "NODE_FAILURE",
        "DATABASE_DEADLOCK", "NETWORK_PARTITION", "DNS_RESOLUTION_FAILURE", "CERTIFICATE_EXPIRATION",
        "STORAGE_EXHAUSTION", "CONFIG_MISMATCH"
    ]
    if incident_type not in valid_incidents:
        raise HTTPException(status_code=400, detail="Invalid incident type.")

    # Check if a simulation is already active for this service
    if target_service in active_simulations and active_simulations[target_service].get("active"):
        raise HTTPException(status_code=400, detail=f"A simulation is already active on {target_service}.")

    incident_id = str(uuid.uuid4())
    
    active_simulations[target_service] = {
        "id": incident_id,
        "type": incident_type,
        "severity": severity,
        "start_time": datetime.datetime.utcnow(),
        "duration": duration_seconds,
        "active": True,
        "prevented": proactive_defense
    }
    
    # Save a Detection Event to the timeline
    if proactive_defense:
        timeline_event = TimelineEvent(
            id=str(uuid.uuid4()),
            timeline_id=incident_id,
            event_type="PREDICTION",
            service_name=target_service,
            payload={
                "incident_type": incident_type,
                "severity": severity,
                "message": f"Proactively predicted and prevented {incident_type.lower().replace('_', ' ')} in {target_service} before impact.",
                "duration": duration_seconds
            }
        )
    else:
        timeline_event = TimelineEvent(
            id=str(uuid.uuid4()),
            timeline_id=incident_id,
            event_type="DETECTION",
            service_name=target_service,
            payload={
                "incident_type": incident_type,
                "severity": severity,
                "message": f"Anomaly detected in {target_service}: anomalous {incident_type.lower().replace('_', ' ')} pattern starting.",
                "duration": duration_seconds
            }
        )
    db.add(timeline_event)
    db.commit()
    
    # Actually inject the fault into the live cluster if using live mode
    from ..services.metrics_service import k8s_adapter
    if hasattr(k8s_adapter, "inject_fault") and not proactive_defense:
        if incident_type == "CPU_SPIKE":
            k8s_adapter.inject_fault(target_service, "cpu_spike")
        elif incident_type == "TRAFFIC_SURGE":
            k8s_adapter.inject_fault(target_service, "latency")
            
    return {
        "status": "RUNNING",
        "simulation_id": incident_id,
        "service": target_service,
        "incident_type": incident_type
    }

@router.post("/stop/{service_name}")
def stop_simulation(service_name: str, db: Session = Depends(get_db)):
    if service_name in active_simulations:
        active_simulations[service_name]["active"] = False
        
        timeline_event = TimelineEvent(
            id=str(uuid.uuid4()),
            timeline_id=active_simulations[service_name]["id"],
            event_type="RECOVERY",
            service_name=service_name,
            payload={
                "message": f"Incident simulation aborted for {service_name}. Restoring baseline operations."
            }
        )
        db.add(timeline_event)
        db.commit()
        
        from ..services.metrics_service import k8s_adapter
        if hasattr(k8s_adapter, "clear_fault"):
            k8s_adapter.clear_fault(service_name)
            
        
        return {"status": "STOPPED", "service": service_name}
    raise HTTPException(status_code=404, detail="No active simulation found for this service.")

@router.get("/status")
def get_simulation_status():
    result = []
    for service, sim in active_simulations.items():
        if sim.get("active"):
            result.append({
                "service": service,
                "id": sim["id"],
                "type": sim["type"],
                "severity": sim["severity"],
                "prevented": sim.get("prevented", False),
                "elapsed": (datetime.datetime.utcnow() - sim["start_time"]).total_seconds()
            })
    return result
