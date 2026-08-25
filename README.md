# Dunia Zee

Dunia Zee is a hosted Playroom for calm, shared Games. The first Game is Depot Tenang, a 2.5D greybox where vehicles arrive and settle back into their Resting Places.

## Commands

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Check TypeScript:

```sh
npm run typecheck
```

Build the production app:

```sh
npm run build
```

Run the browser test against the production preview:

```sh
npm run test
```

The test command creates a production build, starts its preview server on `http://127.0.0.1:4173`, and runs the browser tests.

## Equivalent Input

Depot Tenang maps physical actions to the same Game intentions:

- `advance-vehicle-journey`: press an ordinary keyboard key or tap/click the active play area.
- `select-resting-place`: tap/click a vehicle's Resting Place while the Diorama is idle.
- `soft-grab`: press and move with a mouse, trackpad-equivalent pointer, or one finger on optional cargo; swiping is never required to complete a Vehicle Journey.

The Child Stage accepts one active play touch at a time. Playroom settings and scrolling remain ordinary browser controls.
