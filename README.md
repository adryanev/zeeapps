# Dunia Zee

Dunia Zee is a hosted Playroom for calm, shared Games. The first Game is Depot Tenang, a 3D playground with Blender vehicles and three repeatable touch activities.

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

The test command creates a production build, starts its preview server on `http://127.0.0.1:4301`, and runs the browser tests. Set `PLAYWRIGHT_PORT` to use another free port.

## Equivalent Input

Choose one of three pictured activities:

- **Batu & kereta:** touch rocks to load the truck and clear the railway. Touch the pit, then tap or lift the bed to drop rocks onto toy blocks.
- **Bangun jembatan:** touch the three molds. The mixer pours concrete, and a cargo truck crosses the completed bridge.
- **Cuci pesawat:** touch or scrub mud. The tanker sprays water, and the clean airplane takes off.

Touch the supply box to repeat an activity. Space or Enter performs the next action. Fallen rocks can be dragged back into the truck. No driving buttons, score, timer, or final state are required.

Hold Shift+Enter to open the Companion Gate. Touch devices use a hold on both upper corners. The gate pauses the world.

Depot Tenang renders Blender GLB models with Three.js. Rapier 3D simulates loose stones and blocks. See [the asset build guide](assets-source/blender/depot-tenang/README.md) for source files and export commands.
