import React, { useEffect, useState, useCallback } from "react";

type WeatherType = "sunny" | "cloudy" | "rain" | "snow" | "storm" | "fog";

interface WeatherData {
  temperature: number;
  weatherCode: number;
  location: string;
  isDay: boolean;
}

const icons: Record<WeatherType, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
  fog: "🌫️",
};

const getWeatherType = (weatherCode: number): WeatherType => {
  // WMO Weather interpretation codes
  if (weatherCode === 0) return "sunny"; // Clear sky
  if ([1, 2, 3].includes(weatherCode)) return "cloudy"; // Mainly clear, partly cloudy, overcast
  if ([45, 48].includes(weatherCode)) return "fog"; // Fog and depositing rime fog
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "rain"; // Drizzle
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return "rain"; // Rain
  if ([71, 73, 75, 77].includes(weatherCode)) return "snow"; // Snow
  if ([80, 81, 82, 85, 86].includes(weatherCode)) return "rain"; // Rain showers, snow showers
  if ([95, 96, 99].includes(weatherCode)) return "storm"; // Thunderstorm
  return "sunny"; // Default
};

const getBackgroundGradient = (
  weather: WeatherType,
  isDay: boolean,
): string => {
  const dayGradients = {
    sunny: "linear-gradient(180deg,#fffb8f,#ffd27f)",
    cloudy: "linear-gradient(180deg,#e0e7ff,#cbd5e1)",
    rain: "linear-gradient(180deg,#b6d0e6,#6b8ea3)",
    snow: "linear-gradient(180deg,#ffffff,#cfe8ff)",
    storm: "linear-gradient(180deg,#6b6b6b,#2b2b2b)",
    fog: "linear-gradient(180deg,#f0f0f0,#d0d0d0)",
  };

  const nightGradients = {
    sunny: "linear-gradient(180deg,#1a1a2e,#16213e)",
    cloudy: "linear-gradient(180deg,#2c3e50,#34495e)",
    rain: "linear-gradient(180deg,#2c3e50,#34495e)",
    snow: "linear-gradient(180deg,#34495e,#2c3e50)",
    storm: "linear-gradient(180deg,#1a1a1a,#0f0f0f)",
    fog: "linear-gradient(180deg,#34495e,#2c3e50)",
  };

  return isDay ? dayGradients[weather] : nightGradients[weather];
};

const WeatherWallpaper: React.FC<WallpaperProps> = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        setLoading(true);
        setError(null);

        // Open-Meteo API - free, no API key required
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`,
        );

        if (!response.ok) {
          throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.current) {
          throw new Error("Invalid weather data received");
        }

        // Get location name using reverse geocoding (optional)
        let locationName = "Your Location";
        try {
          const geoResponse = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            locationName = geoData.city || geoData.locality || "Your Location";
          }
        } catch (geoError) {
          console.warn("Could not fetch location name:", geoError);
        }

        const weatherData: WeatherData = {
          temperature: Math.round(data.current.temperature_2m),
          weatherCode: data.current.weather_code,
          location: locationName,
          isDay: data.current.is_day === 1,
        };

        setWeatherData(weatherData);
      } catch (err) {
        console.error("Weather fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch weather",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeather(latitude, longitude);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        // Fallback to a default location (e.g., New York City)
        fetchWeather(40.7128, -74.006);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      },
    );
  }, [fetchWeather]);

  useEffect(() => {
    getUserLocation();

    // Refresh weather every 30 minutes
    const interval = setInterval(getUserLocation, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [getUserLocation]);

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg,#e0e7ff,#cbd5e1)",
        }}
      >
        <div style={{ textAlign: "center", fontSize: "2rem", color: "#666" }}>
          <div>🌤️</div>
          <div style={{ fontSize: 16, marginTop: 8 }}>Loading weather...</div>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg,#ffe6e6,#ffcccc)",
        }}
      >
        <div style={{ textAlign: "center", fontSize: "2rem", color: "#666" }}>
          <div>❌</div>
          <div style={{ fontSize: 16, marginTop: 8 }}>
            {error || "Weather unavailable"}
          </div>
        </div>
      </div>
    );
  }

  const weatherType = getWeatherType(weatherData.weatherCode);
  const background = getBackgroundGradient(weatherType, weatherData.isDay);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background,
      }}
    >
      <div style={{ textAlign: "center", fontSize: "6rem" }}>
        <div>{icons[weatherType]}</div>
        <div style={{ fontSize: 24, marginTop: 8, opacity: 0.9 }}>
          {weatherData.temperature}°C
        </div>
        <div style={{ fontSize: 16, marginTop: 4, opacity: 0.7 }}>
          {weatherData.location}
        </div>
        <div style={{ fontSize: 14, marginTop: 4, opacity: 0.6 }}>
          {weatherType.charAt(0).toUpperCase() + weatherType.slice(1)}
        </div>
      </div>
    </div>
  );
};

export default WeatherWallpaper;
