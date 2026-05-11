import { useEffect, useState } from 'react';

const loadingParticles = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 29) % 84)}%`,
  delay: `${index * 0.09}s`,
  duration: `${2.4 + (index % 5) * 0.28}s`,
  size: `${3 + (index % 3)}px`
}));

export function LoadingScreen() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 1320);
    const removeTimer = window.setTimeout(() => setIsMounted(false), 1680);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div className={`loading-screen ${isLeaving ? 'is-leaving' : ''}`} aria-label="页面加载中" role="status">
      <div className="loading-particles" aria-hidden="true">
        {loadingParticles.map((particle) => (
          <i
            key={particle.id}
            style={{
              left: particle.left,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              width: particle.size,
              height: particle.size
            }}
          />
        ))}
      </div>
      <div className="loading-orbit" aria-hidden="true" />
      <div className="loading-content">
        <span className="loading-text">正在生成</span>
      </div>
    </div>
  );
}
