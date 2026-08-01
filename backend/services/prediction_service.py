import uuid
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..models import InfrastructureMetric, Prediction, TimelineEvent

def calculate_linear_slope(y_values):
    """
    Fits a linear line y = mx + c to the points and returns m (slope)
    """
    n = len(y_values)
    if n < 2:
        return 0.0
    x_values = list(range(n))
    
    sum_x = sum(x_values)
    sum_y = sum(y_values)
    sum_xy = sum(x * y for x, y in zip(x_values, y_values))
    sum_xx = sum(x * x for x in x_values)
    
    denominator = (n * sum_xx) - (sum_x * sum_x)
    if denominator == 0:
        return 0.0
        
    slope = ((n * sum_xy) - (sum_x * sum_y)) / denominator
    return slope

def run_prediction_check(service_name: str, db: Session) -> Prediction:
    """
    Analyzes historical telemetry for a service, forecasts state in 5 minutes (300s),
    saves prediction records to the DB, and logs to the Timeline if an alert is raised.
    """
    # Fetch last 15 metric records (representing last ~45 seconds)
    records = db.query(InfrastructureMetric)\
        .filter(InfrastructureMetric.service_name == service_name)\
        .order_by(desc(InfrastructureMetric.timestamp))\
        .limit(15)\
        .all()
        
    if not records or len(records) < 5:
        return None
        
    records.reverse() # Order chronologically
    
    cpu_vals = [r.cpu_utilization for r in records]
    mem_vals = [r.memory_utilization for r in records]
    lat_vals = [r.latency_ms for r in records]
    
    current_cpu = cpu_vals[-1]
    current_mem = mem_vals[-1]
    current_lat = lat_vals[-1]
    
    # Run slope analysis (m is change per sample interval, which is ~3 seconds)
    cpu_slope = calculate_linear_slope(cpu_vals)
    mem_slope = calculate_linear_slope(mem_vals)
    lat_slope = calculate_linear_slope(lat_vals)
    
    # Project 300 seconds (100 sample steps of 3 seconds) into the future
    projected_steps = 100
    pred_cpu = max(0.0, min(100.0, current_cpu + cpu_slope * projected_steps))
    pred_mem = max(0.0, min(100.0, current_mem + mem_slope * projected_steps))
    pred_lat = max(0.0, current_lat + lat_slope * projected_steps)
    
    # We focus predictions on the most critical threat vector
    metric_name = "cpu"
    current_val = current_cpu
    pred_val = pred_cpu
    slope = cpu_slope
    
    if pred_mem > pred_cpu and pred_mem > 75.0:
        metric_name = "memory"
        current_val = current_mem
        pred_val = pred_mem
        slope = mem_slope
    elif pred_lat > 150.0 and lat_slope > 0:
        metric_name = "latency"
        current_val = current_lat
        pred_val = pred_lat
        slope = lat_slope
        
    trend = "Rising" if slope > 0.05 else ("Falling" if slope < -0.05 else "Stable")
    
    # Determine risk level based on projections and active simulations
    from .metrics_service import active_simulations
    sim = active_simulations.get(service_name)

    if sim:
        sim_sev = sim.get("severity", "HIGH").upper()
        if sim_sev in ["HIGH", "CRITICAL"]:
            risk_level = "Critical" if current_val > 85.0 else "High"
        elif sim_sev == "MEDIUM":
            risk_level = "Medium"
        else:
            risk_level = "Low"
    elif pred_val > 90.0 or current_val > 80.0:
        risk_level = "Critical"
    elif pred_val > 80.0 or current_val > 65.0:
        risk_level = "High"
    elif pred_val > 60.0:
        risk_level = "Medium"
    else:
        risk_level = "Low"
        
    # Heuristic confidence calculation
    confidence = 0.90
    if len(records) > 10:
        # Deduct confidence if data fluctuates wildly
        variance = sum((x - sum(cpu_vals)/len(cpu_vals))**2 for x in cpu_vals) / len(cpu_vals)
        if variance > 50:
            confidence = 0.78
        else:
            confidence = 0.94
            
    prediction_id = f"pred-{service_name}"
    
    # Upsert prediction record so prediction IDs stay 100% stable per service
    existing_pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if existing_pred:
        existing_pred.timestamp = datetime.datetime.utcnow()
        existing_pred.metric_name = metric_name
        existing_pred.current_value = round(current_val, 2)
        existing_pred.predicted_value = round(pred_val, 2)
        existing_pred.confidence_score = round(confidence, 2)
        existing_pred.risk_level = risk_level
        existing_pred.trend = trend
        prediction = existing_pred
    else:
        prediction = Prediction(
            id=prediction_id,
            timestamp=datetime.datetime.utcnow(),
            service_name=service_name,
            metric_name=metric_name,
            current_value=round(current_val, 2),
            predicted_value=round(pred_val, 2),
            forecast_window_seconds=300,
            confidence_score=round(confidence, 2),
            risk_level=risk_level,
            trend=trend
        )
        db.add(prediction)
    
    # If the forecast represents an elevated risk, write an alert to timeline
    if risk_level in ["High", "Critical"]:
        from .metrics_service import active_simulations
        sim = active_simulations.get(service_name)
        timeline_id = sim.get("id") if (sim and sim.get("id")) else f"incident-{service_name}"
        
        # Check if a PREDICTION timeline event was logged for this service within the last 60 seconds
        sixty_secs_ago = datetime.datetime.utcnow() - datetime.timedelta(seconds=60)
        existing_event = db.query(TimelineEvent)\
            .filter(
                TimelineEvent.service_name == service_name,
                TimelineEvent.event_type == "PREDICTION",
                TimelineEvent.timestamp >= sixty_secs_ago
            )\
            .first()
            
        if not existing_event:
            timeline_event = TimelineEvent(
                id=str(uuid.uuid4()),
                timeline_id=timeline_id,
                event_type="PREDICTION",
                service_name=service_name,
                payload={
                    "prediction_id": prediction_id,
                    "metric": metric_name,
                    "current": round(current_val, 2),
                    "predicted": round(pred_val, 2),
                    "confidence": round(confidence, 2),
                    "risk": risk_level,
                    "message": f"AI Engine forecasts critical {metric_name} exhaustion ({round(pred_val, 1)}%) on {service_name} within 5 minutes."
                }
            )
            db.add(timeline_event)
            
    db.commit()
    return prediction
