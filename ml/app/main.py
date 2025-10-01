from __future__ import annotations

import random
import time
from collections import defaultdict
from datetime import datetime
from typing import Dict, List

import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest

app = FastAPI(title="Aurora POS ML", version="0.2.0")


class HealthResponse(BaseModel):
    status: str
    service: str


class AnomalyEvent(BaseModel):
    sku: str
    price: float
    quantity: float


class AnomalyResponse(BaseModel):
    is_anomaly: bool
    score: float
    reason: str | None = None


class VisionRequest(BaseModel):
    product_id: str
    embedding: List[float] = Field(default_factory=list)


class VisionResponse(BaseModel):
    predicted_label: str
    confidence: float
    is_match: bool


class ForecastObservation(BaseModel):
    date: datetime
    quantity: float


class ForecastTrainRequest(BaseModel):
    sku: str
    history: List[ForecastObservation]


class ForecastPredictRequest(BaseModel):
    sku: str
    horizon_days: int = 14


class ForecastResponse(BaseModel):
    sku: str
    daily_forecast: List[float]
    safety_stock: float
    reorder_point: float


class PricingRequest(BaseModel):
    sku: str
    base_price: float
    demand_score: float
    expiry_days: int
    competitor_price: float
    min_margin: float = 0.1


class PricingResponse(BaseModel):
    sku: str
    recommended_price: float
    markdown_percent: float
    rationale: str


_isolation_model = IsolationForest(contamination=0.05, random_state=42)
_training_data = np.array([[10, 1], [5, 2], [20, 1], [8, 3], [12, 1]])
_isolation_model.fit(_training_data)
_last_sku_seen: Dict[str, float] = defaultdict(float)
_forecast_models: Dict[str, Dict[str, float]] = {}
_class_labels = ["apple", "banana", "bread", "milk", "eggs", "cereal", "juice", "chocolate"]


@app.get("/health", response_model=HealthResponse)
def read_health() -> HealthResponse:
    return HealthResponse(status="ok", service="ml-service")


@app.post("/anomaly/predict", response_model=AnomalyResponse)
def anomaly_predict(event: AnomalyEvent) -> AnomalyResponse:
    score = float(_isolation_model.decision_function([[event.price, event.quantity]])[0])
    now = time.time()
    last_seen = _last_sku_seen[event.sku]
    _last_sku_seen[event.sku] = now

    reasons: List[str] = []
    is_anomaly = score < -0.1
    if is_anomaly:
        reasons.append("price_outlier")

    if now - last_seen < 5:
        is_anomaly = True
        reasons.append("rapid_repeat_scan")

    reason_text = ",".join(reasons) if reasons else None
    return AnomalyResponse(is_anomaly=is_anomaly, score=score, reason=reason_text)


@app.post("/vision/predict", response_model=VisionResponse)
def vision_predict(payload: VisionRequest) -> VisionResponse:
    random.seed(hash(payload.product_id) % (2**32))
    label = random.choice(_class_labels)
    confidence = round(random.uniform(0.4, 0.95), 2)
    is_match = label in payload.product_id.lower() and confidence >= 0.6
    return VisionResponse(predicted_label=label, confidence=confidence, is_match=is_match)


@app.post("/forecast/train")
def forecast_train(request: ForecastTrainRequest) -> HealthResponse:
    df = pd.DataFrame([{"date": obs.date, "quantity": obs.quantity} for obs in request.history])
    df.sort_values("date", inplace=True)
    rolling_mean = df["quantity"].rolling(window=3, min_periods=1).mean().iloc[-1]
    trend = (df["quantity"].iloc[-1] - df["quantity"].iloc[0]) / max(len(df) - 1, 1)
    _forecast_models[request.sku] = {"level": rolling_mean, "trend": trend}
    return HealthResponse(status="trained", service=request.sku)


@app.post("/forecast/predict", response_model=ForecastResponse)
def forecast_predict(request: ForecastPredictRequest) -> ForecastResponse:
    params = _forecast_models.get(request.sku, {"level": 10.0, "trend": 0.1})
    series = [max(params["level"] + params["trend"] * day, 0) for day in range(1, request.horizon_days + 1)]
    demand = sum(series)
    safety_stock = round(max(series) * 1.5, 2)
    reorder_point = round(demand / request.horizon_days + safety_stock, 2)
    return ForecastResponse(
        sku=request.sku,
        daily_forecast=[round(val, 2) for val in series],
        safety_stock=safety_stock,
        reorder_point=reorder_point
    )


@app.post("/pricing/recommend", response_model=PricingResponse)
def pricing_recommend(request: PricingRequest) -> PricingResponse:
    decay = max(0, 1 - request.expiry_days / 30)
    competitor_delta = request.base_price - request.competitor_price
    markdown = min(0.4, decay * 0.5 + request.demand_score * 0.2 + max(competitor_delta, 0) * 0.05)
    min_price = request.base_price * (1 - request.min_margin)
    recommended = max(min_price, request.base_price * (1 - markdown))
    rationale = f"Demand={request.demand_score:.2f}, Expiry={request.expiry_days}d, Competitor Δ={competitor_delta:.2f}"
    return PricingResponse(
        sku=request.sku,
        recommended_price=round(recommended, 2),
        markdown_percent=round(markdown * 100, 2),
        rationale=rationale
    )
