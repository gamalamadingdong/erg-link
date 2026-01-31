import { useState } from 'react';
import { useAppStore } from '../store/appStore';

export function NameEntryForm() {
    const [name, setName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { setParticipantName, setSessionInfo } = useAppStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) return;

        // Use dynamic import or standard import if possible. 
        // We'll trust the bundler to handle circular deps if any.
        // Ideally sessionService is imported at top level, but for now:
        try {
            const { sessionService } = await import('../services/sessionService');

            setIsSubmitting(true);

            // If code entered, join session
            if (joinCode.trim()) {
                const { session, participant } = await sessionService.joinSession(joinCode.trim(), name.trim());
                setSessionInfo({
                    sessionId: session.id,
                    participantId: participant.id,
                    joinCode: session.join_code
                });
            }

            setParticipantName(name.trim());
        } catch (err) {
            console.error('Join failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to join session');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-auto w-full">
            <div className="text-center mb-6">
                <div className="text-4xl mb-4">👋</div>
                <h2 className="text-xl font-bold text-white mb-2">Welcome to Erg-Link</h2>
                <p className="text-gray-400 text-sm">Enter your details to join</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">Your Name</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sam"
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-erg-500 focus:border-transparent transition-all"
                        autoFocus
                    />
                </div>

                <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-400 mb-1">Join Code <span className="text-gray-500 font-normal">(Optional)</span></label>
                    <input
                        type="text"
                        id="code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="ROW123"
                        maxLength={6}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-erg-500 focus:border-transparent transition-all uppercase tracking-widest font-mono"
                    />
                </div>

                {error && (
                    <div className="text-red-400 text-sm bg-red-400/10 p-2 rounded">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className="w-full py-3 px-6 bg-erg-500 hover:bg-erg-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors shadow-lg shadow-erg-500/20 flex items-center justify-center"
                >
                    {isSubmitting ? (
                        <span className="inline-block animate-spin mr-2">↻</span>
                    ) : null}
                    {joinCode.trim() ? 'Join Session' : 'Continue Solo'}
                </button>
            </form>
        </div>
    );
}
