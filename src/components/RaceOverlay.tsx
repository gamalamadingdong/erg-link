interface RaceOverlayProps {
  raceState: number | null;
}

export function RaceOverlay({ raceState }: RaceOverlayProps) {
  if (raceState === 8) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-purple-900/90 backdrop-blur-md rounded-lg p-8 animate-pulse">
        <div className="text-xl font-bold text-purple-200 mb-2 tracking-widest uppercase">Race Control</div>
        <div className="text-6xl font-black text-white mb-4">SET</div>
        <div className="text-lg text-purple-300">Sit Ready...</div>
      </div>
    );
  }

  if (raceState === 9) {
    return (
      <div className="bg-emerald-600 rounded-lg p-4 mb-6 text-center shadow-lg border-2 border-emerald-400 animate-bounce-once">
        <div className="text-4xl font-black text-white">GO!</div>
      </div>
    );
  }

  if (raceState === 10) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/95 backdrop-blur-md rounded-lg p-8">
        <div className="text-6xl font-black text-red-100 mb-4">FALSE START</div>
        <div className="text-xl text-red-200">Stop Rowing!</div>
      </div>
    );
  }

  return null;
}
