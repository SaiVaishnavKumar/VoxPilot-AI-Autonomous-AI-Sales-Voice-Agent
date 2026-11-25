import React, { useEffect, useRef } from 'react';

export default function AudioWaveform({ isListening, isSpeaking, isCallActive, analyser }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let phase = 0;

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const bars = 36;
      const barWidth = Math.max(4, Math.floor(width / (bars * 1.7)));
      const gap = (width - bars * barWidth) / (bars - 1);

      if (analyser && isListening && dataArray) {
        analyser.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < bars; i++) {
        let amplitude = 0.08;
        if (isListening && dataArray) {
          const binIndex = Math.min(dataArray.length - 1, Math.floor((i / bars) * (dataArray.length * 0.6)));
          amplitude = Math.max(0.12, dataArray[binIndex] / 255);
        } else if (isSpeaking) {
          amplitude = 0.25 + 0.55 * Math.abs(Math.sin(phase * 1.6 + i * 0.42));
        } else if (isCallActive) {
          amplitude = 0.12 + 0.1 * Math.abs(Math.sin(phase * 0.6 + i * 0.35));
        }

        const barHeight = Math.max(6, amplitude * (height - 12));
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isSpeaking) {
          grad.addColorStop(0, '#8b5cf6');
          grad.addColorStop(1, '#3b82f6');
        } else if (isListening) {
          grad.addColorStop(0, '#10b981');
          grad.addColorStop(1, '#06b6d4');
        } else {
          grad.addColorStop(0, '#475569');
          grad.addColorStop(1, '#334155');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
      }

      phase += 0.08;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isListening, isSpeaking, isCallActive, analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={460}
      height={76}
      className="w-full h-[76px] rounded-xl bg-navy-950/60 border border-white/10 px-3"
    />
  );
}
