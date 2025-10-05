from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
from datetime import datetime

app = FastAPI(title="Weather Buddy API", version="1.0")

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for testing; replace "*" with your actual frontend URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "Backend running fine 🚀"}


@app.get("/risk")
def get_weather_risk(
    location: str = Query(..., description="City name"),
    date: str = Query(..., description="Date in YYYY-MM-DD"),
    time: str = Query(..., description="Time in HH:MM (24h)"),
):
    """
    Returns risk labels for Very Hot, Very Cold, Very Windy, Very Wet, and Very Uncomfortable
    """
    # You can use Open-Meteo (free, no key) for real weather
    geocode_url = f"https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1"
    geo_resp = requests.get(geocode_url).json()

    if "results" not in geo_resp or len(geo_resp["results"]) == 0:
        return {"error": "Invalid location"}

    lat = geo_resp["results"][0]["latitude"]
    lon = geo_resp["results"][0]["longitude"]

    weather_url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation,wind_speed_10m&forecast_days=1"
    )
    weather_resp = requests.get(weather_url).json()

    temps = weather_resp["hourly"]["temperature_2m"]
    winds = weather_resp["hourly"]["wind_speed_10m"]
    rains = weather_resp["hourly"]["precipitation"]

    avg_temp = sum(temps) / len(temps)
    avg_wind = sum(winds) / len(winds)
    avg_rain = sum(rains) / len(rains)

    # Simple threshold logic for “risk” labels
    very_hot = avg_temp > 35
    very_cold = avg_temp < 10
    very_windy = avg_wind > 30
    very_wet = avg_rain > 2
    very_uncomfortable = very_hot or very_cold or (avg_humidity := avg_rain > 3)

    summary = []
    if very_hot: summary.append("Very Hot 🌡️")
    if very_cold: summary.append("Very Cold 🧊")
    if very_windy: summary.append("Very Windy 🌬️")
    if very_wet: summary.append("Very Wet 🌧️")
    if very_uncomfortable: summary.append("Very Uncomfortable 😓")

    return {
        "location": location.title(),
        "date": date,
        "time": time,
        "summary": summary if summary else ["Looks comfortable! 😎"],
        "metrics": {
            "avg_temp": f"{avg_temp:.1f} °C",
            "avg_wind": f"{avg_wind:.1f} km/h",
            "avg_rain": f"{avg_rain:.1f} mm",
        },
        "very_hot": very_hot,
        "very_cold": very_cold,
        "very_windy": very_windy,
        "very_wet": very_wet,
        "very_uncomfortable": very_uncomfortable,
    }
