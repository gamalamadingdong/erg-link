# PM5 Read-Only Hardware Smoke

Use this before any workout-programming or race command test.

## Preconditions

- Run the app from `feature/pm5-csafe-core-hardening`.
- In a VS Code Dev Tunnel, run Vite with `--host localhost`; binding to `0.0.0.0` did not forward correctly in the exercised environment.
- Do not join an ErgLink live session and do not select an active workout.
- Power the PM5 and leave it at the normal idle/menu screen.
- Keep another PM5 app disconnected so only ErgLink owns the BLE connection.

## Steps

1. Tap **Connect to PM5** and select the nearby PM5.
2. Confirm the app reports **Connected** and begins showing live status without errors.
3. Tap **Run Read-Only Diagnostic**.
4. Save the displayed JSON. It should include model, serial, firmware, hardware, machine type and transport sizes where the PM5 firmware exposes them. Fields listed under `readErrors` are unsupported or unreadable and must not be treated as zero.
5. Tap **Probe CSAFE Status (Read-Only)** and save that JSON. This sends public `GETSTATUS` only and must not change PM5 state.
6. Start **Just Row** directly on the PM5 and row 10–15 strokes.
7. Confirm elapsed time, distance, pace, stroke rate and watts move plausibly. Do not treat this as proof that each buffered record is one stroke.
8. Stop rowing, disconnect in the app, and confirm the PM5 releases the BLE connection.

## Stop conditions

Stop without retrying writes if:

- the diagnostic changes PM5 state or screen;
- the app joins/programs a workout unexpectedly;
- the PM5 disconnects repeatedly;
- values become non-monotonic or obviously mis-scaled;
- a permission or pairing prompt differs from the expected OS Bluetooth flow.

## Evidence to record

- Platform and OS version
- PM5 model, hardware and firmware
- `attMtu`, `linkLayerMaxBytes` and native `negotiatedMtu` when present
- `readErrors`
- CSAFE status-probe response
- Whether all five live metrics updated
- Any disconnect or parser error

The public `GETSTATUS` probe is the first bounded CSAFE command. Frames over 20 bytes and all workout-programming commands remain blocked pending this evidence.
