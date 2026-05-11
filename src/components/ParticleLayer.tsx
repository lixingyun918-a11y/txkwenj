import { isLowPowerDevice } from '../utils/env';

const particleCount = isLowPowerDevice() ? 8 : 22;
const particles = Array.from({ length: particleCount }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 9) * -1.6}s`,
  duration: `${11 + (index % 7)}s`,
  size: `${3 + (index % 4)}px`
}));

export function ParticleLayer() {
  return (
    <div className="particle-layer" aria-hidden="true">
      {particles.map((particle) => (
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
  );
}
