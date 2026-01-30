# Product Context

**Last Updated**: 2026-01-28
**Status**: Revised (Bridge-First Strategy)

## The Core Problem: "The Wireless Gap"

We have two distinct user problems that share the exact same technical bottleneck: **Connecting a PM5 to the Cloud without friction.**

### Problem A: The "Cabling Nightmare" (Racing)
*   **User**: Club Coaches running events.
*   **Pain**: Connecting 24 ergs with cables is impossible for daily use.
*   **Need**: A wireless way to broadcast race data to a big screen.

### Problem B: The "Clipboard Nightmare" (Tracking)
*   **User**: High School Coaches & Coxswains.
*   **Pain**: Manually writing down scores from 40 athletes after a workout is tedious and error-prone. OCR (scanning screens) is a patch, but direct data is better.
*   **Need**: A way to instantly "grab" the data from an erg and log it to the athlete's profile.

## The Solution: "The Universal Bridge"

We will build **The Bridge** as our primary product. It is a connectivity layer that sits between the Hardware (PM5) and the Application Layer.

### 1. The Bridge (Client)
A streamlined mobile app (or web app) that:
*   Connects to PM5 via Bluetooth.
*   Extracts Data (Watts, Distance, Stroke Rate).
*   **Mode A (Race)**: Streams live data to a Race Server via WebSockets.
*   **Mode B (Log)**: Captures workout summary and uploads to `train-better` database.

### 2. The Applications (Consumers)
Once the Bridge exists, we can build:
*   **Erg Racer**: A web dashboard that listens to Bridge streams and visualizes boats.
*   **Team Tracker**: A feature in `train-better` that aggregates Bridge logs.

## Strategy: Bridge First

We will focus 100% on building the robust connectivity layer first. 
*   **Deployment**: Validating if we need a Native App (React Native/Expo) for iOS reliability, or if Web Bluetooth is sufficient.
*   **Differentiation**: Unlike Concept2's utility, our Bridge is designed for **Group/Fleet Management**, not just single-user logging.

---

## Positioning vs. RowHero

RowHero exists and does similar things. Our differentiation:

| RowHero | Erg Bridge |
| :--- | :--- |
| Paid SaaS | Free (or very cheap) |
| Full account + team setup | Guest mode, no signup |
| Coach-initiated workflows | Athlete just connects |
| Feature-heavy dashboard | "It just works" simplicity |

**Core Philosophy**: The hardest part is **adoption**. If 50% of athletes don't open the app, you lose 50% of data. The solution is to make it so lightweight that there's no reason *not* to use it.

**Value Proposition**: Capture data that would otherwise be lost. Whether racing or random Tuesday - if you row, it's logged.


