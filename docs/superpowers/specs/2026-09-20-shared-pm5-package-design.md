# Shared PM5 Package Architecture

Status: Approved architecture direction; implementation not started.

## Decision

Keep Logbook Companion and ErgLink as separate applications. Use the ErgLink repository as the source repository for a published `@readyall/pm5` package. Both applications consume that package.

- Logbook Companion is the primary athlete product.
- ErgLink remains the hardware-development harness and optional boathouse/racing client.
- `@readyall/rwn` remains the canonical workout language and PM5-translation authority.
- `@readyall/pm5` owns device protocol, transport, programming, and capture behavior.

Do not copy ErgLink source into Logbook Companion, make the coach-session bridge the primary athlete path, or merge the two application repositories.

## Goals

1. Give Logbook Companion direct, local PM5 programming and capture on Capacitor mobile without requiring a coach session or network relay.
2. Ensure ErgLink and Logbook Companion exercise the same PM5 protocol implementation.
3. Preserve ErgLink as a small browser/native diagnostic and hardware-proof surface.
4. Keep PM5 protocol behavior independent of React, Supabase, user identity, and Concept2 Logbook publication.
5. Preserve RWN as a superset; device limitations must not redefine the notation.
6. Allow browser, Android, and iOS transports and stores to vary behind stable contracts.

## Non-goals

- Replacing `@readyall/rwn` with a PM5-specific workout language.
- Moving Logbook Companion product UI, Supabase access, templates, or Concept2 OAuth into the PM5 package.
- Making ErgLink a required network service for a single athlete.
- Removing the existing coach/boathouse session workflow.
- Retiring the ErgLink app before the direct Logbook Companion mobile path is proven.
- Redesigning capture or programming contracts during the initial extraction.

## Repository shape

The existing ErgLink repository becomes an npm workspace while continuing to host the ErgLink application:

```text
erg-link/
├── packages/
│   └── pm5/                 # published as @readyall/pm5
│       ├── src/protocol/
│       ├── src/programming/
│       ├── src/capture/
│       ├── src/transports/
│       └── src/storage/
├── src/                     # ErgLink application and diagnostics
├── android/
├── ios/
└── docs/
```

The first extraction may keep the root application in place. Moving it under `apps/erg-link` is optional cleanup and is not required to publish the package.

No third repository is introduced.

## Ownership boundaries

### `@readyall/rwn`

Owns:

- RWN parsing and fail-closed validation;
- canonical `WorkoutStructure`;
- serialization and whiteboard rendering;
- translation to the PM5-applicable subset;
- `exact`, `prompt_only`, and `unsupported` outcomes and notes.

Does not own Bluetooth, PM5 response handling, persistence, or application UI.

### `@readyall/pm5`

Owns:

- CSAFE constants, enumerations, framing, byte stuffing, checksums, and response parsing;
- PM5 command construction and command-aware 20-byte BLE packetization;
- fixed and variable workout programming;
- serialized request/response transactions and PM5 acceptance/rejection interpretation;
- device diagnostics and GATT capability representation;
- browser Web Bluetooth and Capacitor BLE adapters;
- `PM5CompletedCaptureV1`, raw evidence, normalization, finalization, and completion state;
- platform-neutral capture-store interfaces;
- browser IndexedDB and Capacitor SQLite adapters behind optional exports.

Must not import React, React Router, Zustand, Supabase, Logbook Companion types, Concept2 Logbook APIs, or application-specific session models.

### Logbook Companion

Owns:

- athlete authentication and profile;
- plans, templates, assignments, and selected source RWN;
- athlete-facing connect/program/confirm/capture screens;
- stable application request identity and source-workout identity;
- confirmation for `prompt_only` translations;
- durable LC workout/result creation and Supabase synchronization;
- Concept2 OAuth and optional publication;
- user-visible recovery from disconnected, rejected, not-ready, and incomplete captures.

### ErgLink application

Owns:

- hardware diagnostics and evidence display;
- browser protocol-development workflow;
- experimental PM5 capabilities before package promotion;
- optional boathouse/racing and coach-session behavior;
- focused real-hardware conformance exercises.

It consumes `@readyall/pm5` rather than importing private package internals.

## Package exports

The intended public surface is split by responsibility so consumers do not import internal files:

```text
@readyall/pm5
@readyall/pm5/protocol
@readyall/pm5/programming
@readyall/pm5/capture
@readyall/pm5/web
@readyall/pm5/capacitor
@readyall/pm5/storage/indexeddb
@readyall/pm5/storage/sqlite
```

The root export contains platform-neutral types and common client contracts. Platform exports may declare optional peer dependencies:

- `@capacitor/core` and `@capacitor-community/bluetooth-le` for the Capacitor transport;
- `@capacitor-community/sqlite` for SQLite;
- `idb` for IndexedDB.

A consumer that uses only the pure protocol core must not load or require these adapters.

## Core contracts

The package exposes stable contracts rather than application state:

- `PM5Transport`: connect, disconnect, diagnostics, serialized CSAFE exchange, and telemetry subscription;
- `PM5Programmer`: accept a PM5-native workout configuration and return explicit device acknowledgement or typed failure;
- `PM5CaptureAccumulator`: consume raw characteristic notifications and produce a versioned capture snapshot;
- `CaptureStore`: save, retrieve, select pending captures, record attempts/failures, recover stale uploads, and record immutable acknowledgement;
- `PM5Client`: compose a transport, programmer, and capture accumulator for an application.

Application-level request IDs, RWN text, template IDs, assignments, and Supabase participant records remain outside these device contracts. Logbook Companion may wrap a package acknowledgement with that application metadata.

## Data flow

The primary athlete flow is local:

```text
LC plan/template/source RWN
        ↓
@readyall/rwn.parseRWN
        ↓
@readyall/rwn.translateWorkoutToPm5
        ↓ exact | prompt_only | unsupported
LC confirmation when required
        ↓
@readyall/pm5 PM5-native configuration
        ↓
Capacitor BLE transport
        ↓
PM5 CSAFE acknowledgement
        ↓
PM5 telemetry and end summaries
        ↓
PM5CompletedCaptureV1
        ↓
LC durable completed result
        ↓ optional
Concept2 publication
```

The coach-session bridge remains a secondary remote/group input. It can provide application requests to an ErgLink client, but it is not a package dependency or the primary single-athlete route.

## Error and lifecycle rules

- A successful GATT write is not programming success; a valid PM5 response is required.
- PM5 control values remain at the documented 20-byte maximum. ATT MTU and link-layer values do not widen the control characteristic.
- Only complete CSAFE commands may be packed into a frame; commands must never straddle frame boundaries.
- CSAFE exchanges are serialized and correlated using frame-toggle state.
- Programming acknowledgement, workout start, and completed capture are separate facts.
- `unsupported` translations never write to the PM5.
- `prompt_only` requires application confirmation and retains all guidance.
- Raw capture evidence is preserved; normalized strokes use PM5 stroke count and final summaries own completed totals.
- Disconnects and incomplete terminal states remain recoverable and must not produce invented measurements.

## Dependency rules

The dependency direction is one way:

```text
@readyall/rwn ───────┐
                     ├── Logbook Companion
@readyall/pm5 ───────┤
                     └── ErgLink app
```

`@readyall/pm5` may depend on shared types from `@readyall/rwn` only if a future device-neutral contract requires it. The initial package accepts PM5-native configuration and therefore does not need an RWN dependency.

Neither shared package may depend on either application.

## Migration sequence

### Phase 1 — Pure core extraction

Move the existing proven protocol, programming, response, and capture code into `packages/pm5` without behavior changes. Preserve existing byte vectors and hardware-derived regression tests. Make ErgLink consume the workspace package.

Exit gate: ErgLink tests, lint, build, fixed-distance programming, initial speed-pyramid transitions, and completed capture behave exactly as before extraction.

### Phase 2 — Adapter extraction

Move Web Bluetooth and Capacitor BLE behind public transport contracts. Move IndexedDB and SQLite behind capture-store exports. Remove imports from package code back into the ErgLink application.

Exit gate: browser and native builds resolve only public package exports; adapter tests prove equivalent request, response, capture, retry, and acknowledgement behavior.

### Phase 3 — Logbook Companion mobile shell

Add Capacitor to Logbook Companion using the established ScheduleBoard pattern. Install the published PM5 package and implement an athlete-facing local connect/program/capture flow.

Exit gate: one LC request can be traced from source RWN through PM5 acknowledgement without a coach session.

### Phase 4 — Completed-result integration

Convert `PM5CompletedCaptureV1` into LC's durable completed-result model while retaining raw evidence and source identity. Add pending upload, retry, immutable acknowledgement, and optional Concept2 publication.

Exit gate: one app-programmed workout is completed, captured, stored in LC, and reconciled against PM5 final summaries.

### Phase 5 — ErgLink role review

After mobile proof, decide whether ErgLink remains a deployed boathouse/racing client or only a development harness. This decision does not block the package or LC integration.

## Verification strategy

1. Preserve all pure framing, parser, command, response, and capture tests.
2. Add package-export tests so consumers never rely on private paths.
3. Run the ErgLink browser harness against the workspace package before publishing.
4. Publish a prerelease and install it into a clean consumer before the first stable package release.
5. Repeat the bounded PM5 matrix on the packaged implementation:
   - fixed distance;
   - fixed time;
   - fixed-distance intervals;
   - fixed-time intervals;
   - variable intervals with variable rest;
   - prompt-only and unsupported RWN;
   - rejection/not-ready;
   - disconnect and retry;
   - completed capture and final-summary reconciliation.
6. Validate the Capacitor adapter on physical Android and iOS hardware before calling the LC mobile path proven.

## Release and rollback

- Publish immutable semantic versions of `@readyall/pm5`.
- Keep LC and ErgLink pinned to reviewed versions during hardware validation rather than relying on floating latest versions.
- A package release does not automatically deploy either application.
- Rollback is an application dependency-version revert; package releases are never overwritten.
- Preserve the current ErgLink implementation until the package-backed app passes the same hardware evidence gates.

## Success criteria

The architecture is complete when:

1. ErgLink and LC import the same published PM5 implementation.
2. LC can locally connect, program, capture, and persist without a coach session or ErgLink network service.
3. The browser harness remains capable of reproducing protocol evidence and diagnosing devices.
4. Package code contains no application UI, Supabase, or Concept2 publication coupling.
5. One complete physical-device flow is traced from source RWN through translation, PM5 acknowledgement, completed capture, LC persistence, and optional Concept2 publication.
