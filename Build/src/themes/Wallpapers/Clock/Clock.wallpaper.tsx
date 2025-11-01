import React, { useEffect, useState } from 'react';

const pad = (n: number) => n.toString().padStart(2, '0');

const ClockWallpaper: React.FC<WallpaperProps> = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg,#f5f7fa,#c3dafe)',
      zIndex: -1,
      color: '#222'
    }}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: '6rem', fontFamily: 'monospace'}}>
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </div>
        <div style={{marginTop: 8, opacity: 0.8}}>
          {now.toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

export default ClockWallpaper;
