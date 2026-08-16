import React, { useEffect, useRef, useState } from 'react';

export interface PathNode {
  id: number;
  x: number;
  y: number;
  title: string;
  relX: number;
  relY: number;
}

export const PATH_NODES: PathNode[] = [
  { id: 1, x: 198.6, y: 761.1, title: '始于足下 · 墨韵启程', relX: 12.93, relY: 74.32 },
  { id: 2, x: 527.4, y: 716.2, title: '跨越飞虹 · 拱桥渡水', relX: 34.34, relY: 69.94 },
  { id: 3, x: 848.9, y: 767.2, title: '深入幽林 · 烟翠积蕴', relX: 55.27, relY: 74.92 },
  { id: 4, x: 1116.0, y: 485.4, title: '登临高阁 · 攀峭眺远', relX: 72.66, relY: 47.40 },
  { id: 5, x: 1184.3, y: 237.7, title: '凌云直上 · 绝壁峭峰', relX: 77.10, relY: 23.21 },
  { id: 6, x: 1360.4, y: 137.3, title: '登峰造极 · 朱砂成契', relX: 88.57, relY: 13.41 }
];

export const SVG_PATH_D = `
  M 198.6 761.1 
  C 275.0 812.0, 390.0 690.0, 527.4 716.2 
  C 645.0 770.0, 750.0 780.0, 848.9 767.2 
  C 950.0 735.0, 1060.0 600.0, 1116.0 485.4 
  C 1140.0 400.0, 1165.0 310.0, 1184.3 237.7 
  C 1220.0 180.0, 1290.0 160.0, 1360.4 137.3
`;

export function PacedPathAnimation() {
  const pathRef = useRef<SVGPathElement>(null);
  const illumPathRef = useRef<SVGPathElement>(null);
  const orbAuraRef = useRef<SVGCircleElement>(null);
  const orbMidRef = useRef<SVGCircleElement>(null);
  const orbCoreRef = useRef<SVGCircleElement>(null);
  const pulseWaveRef = useRef<SVGCircleElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [activeNodeIdx, setActiveNodeIdx] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [calloutInfo, setCalloutInfo] = useState<{ num: string; title: string; relX: number; relY: number; visible: boolean }>({
    num: '节点 01',
    title: PATH_NODES[0].title,
    relX: PATH_NODES[0].relX,
    relY: PATH_NODES[0].relY,
    visible: true
  });

  const progressRef = useRef(0);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const reachedNodeRef = useRef(-1);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number; color: string }>>([]);

  useEffect(() => {
    const pathEl = pathRef.current;
    const illumEl = illumPathRef.current;
    if (!pathEl || !illumEl) return;

    const pathLen = pathEl.getTotalLength();
    illumEl.style.strokeDasharray = `${pathLen}`;
    illumEl.style.strokeDashoffset = `${pathLen}`;

    // Compute node distance offsets along SVG path
    const nodeDistances = PATH_NODES.map(n => {
      let bestT = 0;
      let minSquareDist = Infinity;
      const samples = 400;
      for (let i = 0; i <= samples; i++) {
        const len = (i / samples) * pathLen;
        const pt = pathEl.getPointAtLength(len);
        const distSq = (pt.x - n.x) ** 2 + (pt.y - n.y) ** 2;
        if (distSq < minSquareDist) {
          minSquareDist = distSq;
          bestT = len;
        }
      }
      return bestT;
    });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    const updateParticles = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        p.radius *= 0.96;

        if (p.alpha <= 0 || p.radius <= 0.2) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const spawnParticles = (svgX: number, svgY: number) => {
      if (!canvas) return;
      const scaleX = canvas.width / 1536;
      const scaleY = canvas.height / 1024;
      const px = svgX * scaleX;
      const py = svgY * scaleY;

      for (let i = 0; i < 3; i++) {
        particlesRef.current.push({
          x: px + (Math.random() - 0.5) * 8,
          y: py + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5 - 0.5,
          radius: Math.random() * 3 + 1.5,
          alpha: 1.0,
          color: Math.random() > 0.4 ? '#ffd778' : '#6fb3d2'
        });
      }
    };

    const updatePosition = (currentLen: number) => {
      const pt = pathEl.getPointAtLength(currentLen);
      if (orbAuraRef.current) {
        orbAuraRef.current.setAttribute('cx', `${pt.x}`);
        orbAuraRef.current.setAttribute('cy', `${pt.y}`);
      }
      if (orbMidRef.current) {
        orbMidRef.current.setAttribute('cx', `${pt.x}`);
        orbMidRef.current.setAttribute('cy', `${pt.y}`);
      }
      if (orbCoreRef.current) {
        orbCoreRef.current.setAttribute('cx', `${pt.x}`);
        orbCoreRef.current.setAttribute('cy', `${pt.y}`);
      }

      illumEl.style.strokeDashoffset = `${pathLen - currentLen}`;
      spawnParticles(pt.x, pt.y);

      PATH_NODES.forEach((n, idx) => {
        const nodeLen = nodeDistances[idx];
        if (Math.abs(currentLen - nodeLen) < 12 && reachedNodeRef.current !== idx) {
          reachedNodeRef.current = idx;
          setActiveNodeIdx(idx);
          setCalloutInfo({
            num: `节点 0${n.id}`,
            title: n.title,
            relX: n.relX,
            relY: n.relY,
            visible: true
          });

          if (pulseWaveRef.current) {
            pulseWaveRef.current.setAttribute('cx', `${n.x}`);
            pulseWaveRef.current.setAttribute('cy', `${n.y}`);
            pulseWaveRef.current.setAttribute('r', '10');
            pulseWaveRef.current.setAttribute('opacity', '0.9');
          }
        }
      });
    };

    const tick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        const baseDuration = 8000;
        const step = (delta / (baseDuration / speedMultiplier)) * pathLen;
        let currentLen = (progressRef.current * pathLen) + step;

        if (currentLen >= pathLen) {
          currentLen = pathLen;
          progressRef.current = 1.0;
          setIsPlaying(false);
        } else {
          progressRef.current = currentLen / pathLen;
        }

        updatePosition(currentLen);
      }

      updateParticles();
      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, speedMultiplier]);

  const handleJumpToNode = (idx: number) => {
    const n = PATH_NODES[idx];
    setActiveNodeIdx(idx);
    reachedNodeRef.current = idx;
    const pathEl = pathRef.current;
    if (!pathEl) return;
    const pathLen = pathEl.getTotalLength();
    
    // approximate ratio
    const ratios = [0, 0.25, 0.48, 0.72, 0.85, 1.0];
    progressRef.current = ratios[idx];
    setIsPlaying(false);
    
    setCalloutInfo({
      num: `节点 0${n.id}`,
      title: n.title,
      relX: n.relX,
      relY: n.relY,
      visible: true
    });
  };

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(237,227,206,0.15)', background: '#090f16' }}>
      <img src="/brand/landing/f1-paced-path.jpg" alt="Paced Path" style={{ width: '100%', height: 'auto', display: 'block' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 15 }} />

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="react-glow-orb" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="15" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="reactSilkGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4e8a6b" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#6fb3d2" stopOpacity="1" />
            <stop offset="80%" stopColor="#ffd778" stopOpacity="1" />
            <stop offset="100%" stopColor="#e4634c" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path ref={pathRef} d={SVG_PATH_D} fill="none" stroke="transparent" strokeWidth="8" />
        <path ref={illumPathRef} d={SVG_PATH_D} fill="none" stroke="url(#reactSilkGradient)" strokeWidth="6" strokeLinecap="round" opacity="0.85" />

        <g>
          {PATH_NODES.map((n, i) => (
            <React.Fragment key={n.id}>
              <circle cx={n.x} cy={n.y} r="14" fill="none" stroke={i === 5 ? '#e4634c' : '#6fb3d2'} strokeWidth="2" opacity="0.6" />
              <circle cx={n.x} cy={n.y} r="8" fill={i === 5 ? '#c6402f' : '#2c6e93'} stroke="#ede3ce" strokeWidth="2" />
            </React.Fragment>
          ))}
        </g>

        <circle ref={pulseWaveRef} cx="198.6" cy="761.1" r="10" fill="none" stroke="#ffd778" strokeWidth="3" opacity="0" />

        <g filter="url(#react-glow-orb)">
          <circle ref={orbAuraRef} cx="198.6" cy="761.1" r="22" fill="#6fb3d2" opacity="0.45" />
          <circle ref={orbMidRef} cx="198.6" cy="761.1" r="12" fill="#ffd778" opacity="0.9" />
          <circle ref={orbCoreRef} cx="198.6" cy="761.1" r="5" fill="#ffffff" />
        </g>
      </svg>

      {/* Floating Callout */}
      {calloutInfo.visible && (
        <div style={{
          position: 'absolute',
          left: `${calloutInfo.relX}%`,
          top: `${calloutInfo.relY}%`,
          transform: 'translate(-50%, -140%)',
          background: 'rgba(9, 15, 22, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(111, 179, 210, 0.4)',
          padding: '8px 14px',
          borderRadius: 10,
          color: '#ede3ce',
          zIndex: 20,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6fb3d2' }}>{calloutInfo.num}</div>
          <div style={{ fontFamily: 'Noto Serif SC, serif', fontSize: 15, fontWeight: 600 }}>{calloutInfo.title}</div>
        </div>
      )}

      {/* Control Overlay Bar */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(15, 26, 35, 0.85)',
        backdropFilter: 'blur(12px)',
        padding: '8px 16px',
        borderRadius: 12,
        border: '1px solid rgba(237,227,206,0.15)'
      }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ background: '#2c6e93', border: 0, color: '#fff', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>

        {PATH_NODES.map((n, idx) => (
          <button
            key={n.id}
            onClick={() => handleJumpToNode(idx)}
            style={{
              background: activeNodeIdx === idx ? 'rgba(111, 179, 210, 0.4)' : 'rgba(9, 15, 22, 0.6)',
              border: '1px solid rgba(237,227,206,0.2)',
              color: '#ede3ce',
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            {n.id}. {n.title.split(' · ')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
