# Depot Tenang design

Depot Tenang is a wooden vehicle playground for Zee, around two years old. The Explorer touches objects to change the world and can repeat or switch activities freely.

## Composition

Use a 960 × 540 world with Phaser FIT. The close view gives vehicles and interactive objects most of the foreground. Each Activity shows only its own toys and surfaces against a plain, still background. The railway and signal appear only in Batu & kereta.

Vehicles use Blender sprites with exported wheel contacts and couplers. Stones, blocks, wooden molds, concrete, water, dirt, and refill props use a separate Blender catalogue with the same lighting and projection. Phaser draws the playground base, rails, and touch hints in matching coordinates. The previous rendered overview board remains a source asset.

Render at the displayed pixel density, capped at 3840 × 2160. Keep the logical world at 960 × 540 through camera scaling so physics and touch targets retain their coordinates. Vehicle sprites use 1536 × 1024 source images. Material sprites render at 256–1536 pixels according to their display size.

Three pictured activity buttons sit below the world. Labels supplement the pictures. One still, warm ring identifies the next touch target. Status text provides short visible and spoken feedback.

Short landscape and portrait layouts keep the canvas and activity choices inside the viewport. Activity buttons are at least 44 pixels high.

## Input

A tap loads a rock, chooses a destination, tips the bed, fills a mold, or washes dirt. Dragging the bed changes its angle. Loose rocks can be dragged and loaded again. The default path through every activity works with taps.

Space or Enter performs the next action. A contextual action button becomes visible when focused by keyboard. The Companion Gate remains available through a keyboard hold or both upper touch corners. Opening it clears gestures and pauses movement and physics.

## Activities

- **Batu & kereta:** three rocks block the railway. Loading the last rock releases the train. Touching the pit moves the dump truck there. Tilting its bed releases physical rocks onto a stack of blocks.
- **Bangun jembatan:** touching molds queues concrete pours. Completing all three lets a cargo truck cross.
- **Cuci pesawat:** touching or scrubbing mud removes it while the tanker sprays. Cleaning all patches starts the airplane's flight.

The supply box replenishes rocks or resets the active construction or washing activity. New rocks wait until the train clears the crossing. Switching activities retains the results and parks each truck at its own position. There is no required order or final state.

Inactive activities are hidden and paused. The train passes once after the railway clears; the cargo truck crosses once after the bridge is complete. The mixer drum turns only while pouring, and the airplane propeller turns only during takeoff. Repeating a result requires another interaction with the supply box.

## Motion

Truck trips use bounded acceleration and braking. Train carriages use Matter constraints at measured couplers and stay on their rail contacts. Wheel hub markers turn with distance travelled.

Released rocks and blocks use Matter gravity, restitution, friction, and collisions. Loading uses an assisted arc and holds rocks in the bed until tipping releases them. Replenishment recycles excess fallen rocks to keep long sessions bounded.

Action feedback uses suspension settling, continuous streams with impact droplets, dissolving mud, and brief completion glints. The mixer uses 24 Blender frames and the dump bed uses 13. Effects follow the scene clock, freeze during pause, and clear when activities change. Reduced Motion removes flying droplets, suspension bounce, and airplane banking, slows the mixer, and reduces rock bounce. Concrete, water, and flight remain simplified toy mechanisms.

## Verification

Run `npm run build` and `npm test`. Tests cover the three activity outcomes, physical cargo, rail contacts and couplers, repeated play, keyboard and touch, pause, responsive layouts, settings, and offline loading.

Use one Playwright worker because simultaneous WebGL scenes contend for the same GPU. Inspect desktop, short landscape, and portrait captures after layout changes. Automated checks do not establish whether Zee finds the game engaging.
