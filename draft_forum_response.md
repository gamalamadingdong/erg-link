Subject: Re: Recommendation for in-club racing software?

Hi Aquaman,

This is an interesting problem. Based on your requirements, the "stickiest" part technically isn't the graphics or the race logic, but the **connectivity layer**. 

Getting 8+ ergs to talk to a central screen wirelessy, reliably, and without accounts is surprisingly hard because of hardware limits (a typical laptop Bluetooth radio can only maintain ~7 stable connections).

I'm currently exploring the architecture for an open-source solution to this. Here is a potential approach to hit your "zero-friction / no-cables" requirement:

### The Mechanics: "Bring Your Own Bridge"
Instead of the "Room PC" trying to connect to 24 ergs (which will fail), we use the rower's own phone as a **bridge**.

1. **The Setup**: Admin screen shows a grid of QR codes ("Lane 1", "Lane 2", etc.).
2. **The Connection**: Rower scans "Lane 1". Their phone opens a simple webpage.
3. **The Bridge**: The *phone* connects to the PM5 (via Bluetooth) and relays that data to the Room Screen (via Wi-Fi).

This gives you infinite scalability because every rower brings their own Bluetooth radio.

### The Trade-offs: Web vs. App

The biggest hurdle is **iOS**.

**Option A: Pure Web (No App Download)** :star: *The Holy Grail*
*   **Pros**: Literally "scan and go". Zero friction.
*   **Cons**: **iOS Safari does not support Bluetooth.** This is the big blocker. iPhone users would have to download a specialized browser (like Bluefy) to make it work, which breaks the "no app" rule. Android/Chrome works perfectly.

**Option B: The "Lightweight" Companion App**
*   **Pros**: 100% reliable Bluetooth on all phones. Screen stays awake reliably.
*   **Cons**: First-time users have to download a ~10MB app.
*   **Mitigation**: You can use "App Clips" (iOS) or "Instant Apps" (Android) to load a mini-version of the app instantly from a QR code without a full store install.

### A Question for You
I'm leaning towards **Option A (Web)** as a roadmap, because widely available cheap Android tablets can be used as "loaner bridges" for iPhone users.

But before going down that rabbit hole: Would asking members to use their phones as "bridges" be a dealbreaker in your club? Or is the "no install" benefit worth it?

Cheers,
[Your Name]
