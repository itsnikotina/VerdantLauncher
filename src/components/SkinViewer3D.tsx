import { useEffect, useRef } from 'react';
import { SkinViewer, IdleAnimation } from 'skinview3d';

interface SkinViewer3DProps {
  skinUrl: string;
  model?: 'classic' | 'slim';
}

export default function SkinViewer3D({ skinUrl, model }: SkinViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Inicializamos direto no Canvas nativo do React
    viewerRef.current = new SkinViewer({
      canvas: canvasRef.current,
      width: 160,
      height: 240,
      model: (model || 'classic') as any,
    });

    viewerRef.current.animation = new IdleAnimation();
    viewerRef.current.controls.enableRotate = true;
    viewerRef.current.controls.enableZoom = true;
    viewerRef.current.controls.enablePan = false;
    viewerRef.current.zoom = 0.8;

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (viewerRef.current && skinUrl) {
      viewerRef.current.loadSkin(skinUrl, { model: (model || 'classic') as any }).catch(e => {
        console.warn('Falha ao carregar skin 3D:', e);
      });
    }
  }, [skinUrl, model]);

  return (
    <canvas 
      ref={canvasRef} 
      className="cursor-grab active:cursor-grabbing w-full max-w-[160px] h-auto drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
    />
  );
}



