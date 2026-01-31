import { APP_STORE_URL, BLUEFY_URL } from '../utils/platformDetection';

export function IOSDownloadPrompt() {
    return (
        <div className="bg-gray-800 rounded-lg p-8 max-w-sm mx-auto w-full text-center">
            <div className="text-5xl mb-6">📱</div>

            <h2 className="text-xl font-bold text-white mb-3">iOS & Safari Limitation</h2>

            <p className="text-gray-400 mb-8 leading-relaxed">
                Apple doesn't support Web Bluetooth in browsers. You'll need our app or a specialized browser to connect your PM5.
            </p>

            <div className="space-y-4">
                {/* Primary Action: Download Native App (Future) */}
                <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-6 bg-erg-500 hover:bg-erg-600 text-white rounded-lg font-semibold transition-colors"
                    onClick={(e) => {
                        // For now, prevent default since URL is placeholder
                        e.preventDefault();
                        alert("The iOS app is coming soon! Please use Bluefy for now.");
                    }}
                >
                    Download Erg-Link App
                </a>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-gray-800 text-gray-500">OR</span>
                    </div>
                </div>

                {/* Secondary Action: Use Bluefy */}
                <a
                    href={BLUEFY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors border border-gray-600"
                >
                    Open in Bluefy Browser
                </a>
            </div>

            <p className="mt-6 text-xs text-gray-500">
                If you are already in Bluefy, refresh the page!
            </p>
        </div>
    );
}
