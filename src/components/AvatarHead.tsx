import { useEffect, useRef } from 'react';

export default function AvatarHead({ skinUrl, size = 40 }: { skinUrl: string, size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!skinUrl || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous'; // necessário para URLs externas
    img.onload = () => {
      // Limpa
      ctx.clearRect(0, 0, size, size);
      
      // Sem blur de redimensionamento
      ctx.imageSmoothingEnabled = false;

      // O rosto base fica na posição X:8 Y:8, L:8 A:8
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);

      // O overlay do chapéu/cabelo fica na posição X:40 Y:8, L:8 A:8
      // Usamos drawImage de novo por cima
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
    };
    img.src = skinUrl;

  }, [skinUrl, size]);

  return (
    <canvas 
      ref={canvasRef} 
      width={size} 
      height={size} 
      className="w-full h-full object-cover rendering-pixelated"
    />
  );
}
