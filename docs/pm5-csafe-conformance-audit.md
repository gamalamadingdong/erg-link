# ErgLink PM5/CSAFE Conformance Audit

**Status:** Initial static audit complete; real-PM5 verification remains required.
**Audit baseline:** `erg-link` at `b1d1a47` (`main`); remediation tracked on `feature/pm5-csafe-core-hardening`.
**Primary source:** Concept2 *PM CSAFE Communication Definition*, Revision 0.34, dated 2025-07-17 and published by Concept2 in March 2026: <https://cms.concept2.com/sites/default/files/2026-03/Concept2%20PM%20CSAFE%20Communication%20Definition.pdf>.
**Historical source:** Revision 0.27, bundled at `docs/concept2-pm5-reference/PM5_CSAFECommunicationDefinition.pdf`.

## Decision

Do not extract the current implementation as a trusted shared library yet. Reuse it as a prototype and code donor. The three status parsers and basic constants are plausible starting points, but command transport, response handling, workout programming, completion detection, and durable capture need correction and hardware evidence first.

## Progress

- Status parsing `[███░░]` Static fixtures pass; hardware remains
- BLE telemetry `[██░░░]` Basic statuses only
- Read-only diagnostics `[████░]` Implemented; PM5 evidence remains
- Pure CSAFE core `[████░]` Static Revision 0.34 vectors pass
- Workout programming `[████░]` Real fixed-distance programming and the first two speed-pyramid intervals/rest transition are proven
- Completed capture `[█████]` Versioned accumulator proven on a second 100 m hardware run
- Durable capture storage `[█████]` Shared store contract plus browser IndexedDB and mobile SQLite adapters proven

## Hardware evidence — 2026-09-19

A read-only Web Bluetooth diagnostic completed successfully on a RowErg PM5:

- model `PM5`, hardware `907`, firmware `8200-000409-212.000`;
- machine type `0` (static Model D);
- ATT MTU `247`, link-layer max `251`;
- every requested device-information characteristic read successfully (`readErrors: []`).

This proves discovery, connection and the read-only C2 device-information path on this PM5. The larger negotiated sizes do not yet prove that CSAFE control characteristic `0x0021` accepts values over the documented 20-byte limit.

The public read-only `CSAFE_GETSTATUS_CMD` was then exercised over Web Bluetooth. Firmware `212.000` advertised receive `0x0021` as write/write-without-response and transmit `0x0022` as notify-only. ErgLink subscribed before writing and received valid frames `f1 81 81 f2` and `f1 01 01 f2`: checksums valid, previous-frame status `ok`, PM5 state `ready`, and frame toggle changed as expected. This proves the bounded write → notify → parse path on this PM5 without changing workout state.

## Programming evidence — 2026-09-20

The same PM5/browser path successfully programmed a `2000m` fixed-distance workout. A later connection reported ATT MTU `23`, link-layer maximum `251`, and an effective control-value limit of `20`; this confirmed that link-layer size does not widen the PM control characteristic and that workout commands must remain within the documented 20-byte value limit.

The Pete Plan speed pyramid `250m/1:30r+500m/3:00r+750m/4:30r+1000m/6:00r+750m/4:30r+500m/3:00r+250m/1:30r` was then translated into the official Concept2 variable-interval command order and packed only at complete command boundaries. The real PM5 displayed the first `250m` interval, entered the prescribed `1:30` rest after it was rowed, and then started the `500m` second interval. Reprogramming `2000m` immediately afterward again produced the correct fixed-distance workout. This proves command-aware multi-frame programming for the exercised fixed-distance and initial variable-interval transitions; the remaining pyramid intervals, final prescribed rest, full completion capture, disconnect/retry behavior, and other firmware families remain unproven.

A direct-PM5 **Just Row** smoke then produced `32 m`, `0:19` elapsed, `4:27/500 m`, `43 s/m`, and `18 W` in ErgLink. The Concept2 pace-to-power relationship predicts `18.39 W` at a `4:27` pace; the displayed `18 W` is consistent after rounding. Distance, elapsed time, pace, rate, and power all updated live without a parser or disconnect error. This proves the current basic status subscriptions and unit conversions on this PM5, but does not prove one notification per stroke or completed-workout capture.

A directly programmed **100 m fixed-distance** PM5 workout then produced:

- `20` stroke-characteristic notifications ending at PM5 stroke count `10`;
- one split notification reporting `100 m` in `28.9 s`;
- base and additional end-summary notifications reporting `100 m`, `28.90 s`, `2:24.5/500 m`, `21 s/m`, `116 W`, `5 cal`, zero rest, and no heart-rate data.

The summary is internally exact: `28.90 s × 500 / 144.5 s = 100 m`; Concept2's pace formula gives `116.00 W`; and `10` strokes over `28.90 s` gives `20.76 s/m`, rounded to the reported `21`. This proves the `0x0035`, `0x0037`, `0x0039`, and `0x003A` subscriptions, parsers, units, and final-summary relationship on this PM5. It also proves that notification count is not stroke identity: this workout emitted two stroke notifications per final stroke count. Normalized strokes must therefore deduplicate by PM5 stroke count while preserving the raw notification stream. End-summary fields, not the last stroke/status sample, are authoritative for final totals.

The remediation branch now implements `PM5CompletedCaptureV1` and a pure accumulator that preserves every raw characteristic value in arrival order, overwrites normalized strokes by PM5 stroke count, deduplicates splits by interval number, finalizes only after both end-summary notifications, derives completion time from measured elapsed time, and retains explicit `aborted` / `incomplete_capture` terminal states. Native and web BLE services feed the same contract and expose its snapshot in **Show Capture Evidence**. Static tests replay the observed 20-notification/10-stroke pattern and the authoritative 100 m summary.

A second 100 m hardware run validated the wired accumulator: capture version `1`, stable UUID, status `completed`, `23` raw notifications, normalized stroke counts `1–10`, one 100 m split, paired summaries, and authoritative totals of `100 m`, `26.40 s`, `2:12.0/500 m`, `23 s/m`, `152 W`, and `6 cal`. Pace predicts `152 W` after rounding and `10` strokes over `26.4 s` predicts `22.73 s/m`, rounded to `23`. Hardware also exposed an initial all-zero `strokeCount: 0` notification; the accumulator now preserves it only in raw evidence and excludes it from normalized strokes, with a regression test.

## Platform and storage boundary

The destination architecture is **Logbook Companion mobile processing**, not a browser-only ErgLink product. The pure PM5 protocol and completed-capture contract must remain independent of React, Capacitor, IndexedDB, Supabase, and any one storage engine.

- **Browser ErgLink:** retain as a development harness and possible boathouse-racing client. IndexedDB is appropriate local browser-origin storage for that path.
- **LC Capacitor mobile:** primary athlete capture path. Use the same capture contract behind a storage interface, with a mobile-durable implementation selected by reviewing the existing Capacitor stack and proven ScheduleBoard patterns rather than assuming IndexedDB is sufficient.
- **Shared behavior:** stable capture ID, raw evidence, lifecycle, retry rules, upstream acknowledgement, and provider-independent summary semantics remain identical across storage implementations.

The next persistence change should therefore extend the existing browser buffer behind a `CaptureStore` boundary, not make IndexedDB part of the domain model and not create a network service between LC and ErgLink.

That boundary is now implemented. `CaptureStore` owns save/get, pending selection, attempt counting, failure retention, and immutable upstream acknowledgement. `IndexedDBCaptureStore` is the browser adapter; the shared `erg-link-buffer` database was upgraded additively to schema version 2 with a new capture store while retaining the existing legacy stroke store. `MobileSQLiteCaptureStore` follows ScheduleBoard's proven Capacitor 7 + `@capacitor-community/sqlite` connection/migration pattern in an ErgLink-owned database and implements the same lifecycle. Completed web and native captures are saved as `pending`; interrupted captures are held rather than uploaded as completed workouts. Memory, fake IndexedDB, and injected SQLite adapters exercise the same retry/acknowledgement contract.

Heart-rate expansion remains backward-compatible. PM5 status already carries live HR and the preserved end summary carries ending, average, minimum, maximum, and recovery HR. Raw evidence is retained now; normalized optional HR fields can be added later without changing capture identity or requiring browser-specific logic.

## Evidence boundary

`[PROVEN]` means source inspection plus an executable fixture. `[PARTIAL]` means some required behavior exists. `[MISSING]` means the requirement is absent or contradicted by the code. `[HARDWARE]` means static inspection cannot prove it.

The supplied current PDF is Revision 0.34. Its document history adds changes through July 2025, including authentication clarifications, force-curve updates, watt-minute workout support, projected-work fields and BLE characteristic `0x0042`. The core framing, BLE-control, interval-programming and response requirements cited below remain present.

## Conformance matrix

| Area | Status | Evidence and consequence |
|---|---|---|
| PM5 service/characteristic UUIDs | PARTIAL | UUIDs for rowing, status, sample rate, stroke, split, summary and CSAFE control are defined. Only a subset is used. |
| General status core fields (`0x0031`) | PARTIAL | Synthetic fixture verifies elapsed time, distance and states. The parser ignores remaining workout-duration/drag-factor fields. |
| Additional status parsers (`0x0032`, `0x0033`) | PROVEN | Synthetic fixtures verify documented units and invalid-heart-rate behavior against PDF pp. 18–19. |
| Notification subscriptions | PARTIAL | Native and web services subscribe only to general/additional status 1/2. They do not subscribe to stroke (`0x0035`), split (`0x0037`/`0x0038`), end-summary (`0x0039`/`0x003A`) or logged-workout data. |
| Sample-rate configuration (`0x0034`) | MISSING | UUID exists, but the app never reads or writes it. Effective cadence is therefore implicit. |
| Status aggregation | PARTIAL | Live metrics are assembled, but emissions mix independently timed characteristics and omit rest totals, work totals and PM5 completion state from the public `PM5Data` contract. |
| “Stroke” semantics | MISSING | Every aggregate notification is appended to `strokeBuffer`; these are periodic mixed status snapshots, not proven one-per-stroke samples. |
| CSAFE checksum | PROVEN | XOR checksum behavior has an executable fixture. |
| CSAFE byte stuffing | PROVEN | Builders and parsers now stuff/unstuff all four reserved bytes with round-trip and checksum vectors. |
| BLE control payload size | PARTIAL | The app now blocks every generated frame over the documented 20-byte value limit before writing. A safe multi-command transport strategy remains unresolved. |
| CSAFE response/status handling | PARTIAL | Native and web transports now read transmit (`0x0022`) after each permitted write and reject non-OK status. Response timing/toggle behavior still needs PM5 evidence. |
| Proprietary-protocol authentication | MISSING | Revision 0.34 says the full proprietary protocol has limited availability on some interfaces without authentication available to qualified developers. ErgLink has no capability/authentication negotiation and cannot distinguish unsupported, unauthorized or rejected commands. |
| Race operation command | PROVEN | Builder now uses command `0x1E` and extended addressing for every non-disabled race operation; exact vector is tested. |
| Protocol enumerations | PROVEN | Revision 0.34 stroke, workout, interval, machine and screen values are represented and fixture-tested. |
| Fixed distance/time programming | PARTIAL | Workout type, duration, split, configure and screen commands are emitted and one fixed-distance frame is fixture-tested. Limits and PM5 acceptance are not validated. |
| Fixed interval programming | PARTIAL | Configured rest duration is now included and fixture-tested. PM5 response and transport-size behavior remain unverified. |
| Variable interval programming | PARTIAL | Required interval count (`0x18`) and interval type (`0x17`) sequence is implemented and fixture-tested. PM5 response and transport-size behavior remain unverified. |
| Revision 0.34 additions | MISSING | Watt-minute interval support, projected-work additions and split watt-minute characteristic `0x0042` are not represented. These are optional unless LC adopts those workout shapes, but the shared core must version capabilities explicitly. |
| PM5 completion detection | MISSING | Upload is triggered by remote race state `11`, not PM5 workout/end-summary state. Ordinary completed and aborted workouts are not classified. |
| Real-device interoperability | HARDWARE | Scanning, subscription support across firmware families, command acceptance, disconnect/reconnect and completion behavior need a PM5 matrix. |

## Durable-capture audit

| Requirement | Status | Current behavior |
|---|---|---|
| Stable capture ID/version | MISSING | Session ID is used as the buffer key; it is not a unique workout capture identity. |
| Actual start/end/timezone | MISSING | Start is UI state; `completed_at` is upload time. |
| Completion/abort/incomplete state | MISSING | No PM5-derived terminal state is persisted. |
| Final PM5 summary and intervals | MISSING | Only the last aggregate snapshot and raw snapshot array are used. |
| Correct averages | MISSING | Last stroke rate and watts are saved as averages. |
| Raw evidence identity/hash | MISSING | Samples are stored, but no schema version, count/hash or durable evidence reference is recorded. |
| Idempotent retry | MISSING | Upload inserts a new workout row without owner-plus-capture uniqueness. |
| Clear only after durable confirmation | MISSING | A missing Supabase client, failed workout insert, or unchecked participant-update failure can resolve without durable workout persistence; caller then clears the local buffer. |
| Provider independence | PARTIAL | PM5 capture does not call Concept2 Logbook directly, but it writes LC database rows and schema details from the capture client. |

## Executable baseline added by this audit

`npm run test:protocol` now checks:

1. general-status byte decoding;
2. additional-status byte decoding and units;
3. aggregation into current application units;
4. the exact fixed-distance proprietary frame currently generated.

These tests establish only static encoding/decoding behavior. They do not prove PM5 acceptance.

Repository verification after restoring the locked dev dependencies:

- `npm run test:protocol` — pass;
- `npm run lint` — pass after removing two unused catch bindings;
- `npm run build` — pass;
- `npm audit --omit=dev` — three high-severity runtime dependency findings remain in React Router / `ws`; track separately from protocol conformance.

## Recommended sequence

1. **Lock the source revision.** Revision 0.34 is now the audit authority; record which features require Concept2 proprietary-protocol authentication.
2. **Repair the pure protocol core.** Add stuffing/unstuffing, response/status parsing, capability/authentication handling, extended addressing, payload-size strategy, parameter validation, fixed-rest programming and official variable-interval sequencing. Convert official sample frames into exact fixtures.
3. **Complete telemetry parsing.** Add stroke, interval and end-summary parsers; expose PM5 states and preserve timestamped native samples without calling every notification a stroke.
4. **Build a capture state machine.** Add stable capture identity, recording/completed/aborted/incomplete states, final summary, evidence hash and retry-safe local persistence.
5. **Verify on hardware.** Batch fixed distance, fixed time, fixed intervals, variable intervals, normal completion, early stop, disconnect/reconnect and failed-upload retry on representative PM5 firmware.
6. **Extract only the proven core.** Keep Capacitor BLE, local persistence, LC auth/upload and UI in the app. Share the pure protocol/capture contract only after the tests and hardware matrix pass.

## Documentation status

Revision 0.34 resolves the specification-version question. An official Concept2 BLE/CSAFE sample SDK or the qualified-developer authentication material would still help validate command transport, but neither is required to begin repairing the pure frame/parser layer. Community implementations can inform tests but are not authoritative.

## Primary-source pointers

- Current Concept2 PDF: <https://cms.concept2.com/sites/default/files/2026-03/Concept2%20PM%20CSAFE%20Communication%20Definition.pdf>
- Historical bundled PDF: `docs/concept2-pm5-reference/PM5_CSAFECommunicationDefinition.pdf`
- BLE status layouts and sample rate: PDF pp. 17–20
- CSAFE framing, stuffing and responses: PDF pp. 8–11
- BLE control receive/transmit characteristics: PDF pp. 15–16
- Parameter limits: PDF pp. 49–50
- Workout configuration commands and official samples: PDF pp. 73–83
- Current official landing page: <https://www.concept2.com/support/software-development>