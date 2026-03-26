interface LiveDataGridProps {
  data: {
    distance: number;
    pace: number;
    strokeRate: number;
    watts: number;
    elapsedTime: number;
  };
  formatPace: (seconds: number) => string;
  formatTime: (seconds: number) => string;
}

export function LiveDataGrid({ data, formatPace, formatTime }: LiveDataGridProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
      <h2 className="text-lg font-semibold mb-4 text-center text-gray-300">Live Data</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-erg-400">{data.distance.toFixed(0)}</div>
          <div className="text-gray-400 text-sm">meters</div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-erg-400">{formatPace(data.pace)}</div>
          <div className="text-gray-400 text-sm">/500m</div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-erg-400">{data.strokeRate}</div>
          <div className="text-gray-400 text-sm">s/m</div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-erg-400">{data.watts}</div>
          <div className="text-gray-400 text-sm">watts</div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 text-center col-span-2">
          <div className="text-4xl font-bold text-white font-mono">{formatTime(data.elapsedTime)}</div>
          <div className="text-gray-400 text-sm">elapsed time</div>
        </div>
      </div>
    </div>
  );
}
