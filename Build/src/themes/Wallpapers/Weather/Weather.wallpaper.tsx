import React, { useEffect, useState } from 'react';

type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'storm';

const icons: Record<WeatherType, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  storm: '⛈️'
};

const WeatherWallpaper: React.FC<WallpaperProps> = ({ currentSong }) => {
  // Simple POC: pick a pseudo-random weather based on time + song id if available
  const [weather, setWeather] = useState<WeatherType>('sunny');

  useEffect(() => {
    const seed = (currentSong?.id?.length || 0) + new Date().getHours();
    const list: WeatherType[] = ['sunny', 'cloudy', 'rain', 'snow', 'storm'];
    setWeather(list[seed % list.length]);
  }, [currentSong]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: -1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: weather === 'sunny' ? 'linear-gradient(180deg,#fffb8f,#ffd27f)'
        : weather === 'cloudy' ? 'linear-gradient(180deg,#e0e7ff,#cbd5e1)'
        : weather === 'rain' ? 'linear-gradient(180deg,#b6d0e6,#6b8ea3)'
        : weather === 'snow' ? 'linear-gradient(180deg,#ffffff,#cfe8ff)'
        : 'linear-gradient(180deg,#6b6b6b,#2b2b2b)'
    }}>
      <div style={{textAlign: 'center', fontSize: '6rem'}}>
        <div>{icons[weather]}</div>
        <div style={{fontSize: 18, marginTop: 8, opacity: 0.9}}>{weather.toUpperCase()}</div>
      </div>
    </div>
  );
};

export default WeatherWallpaper;
