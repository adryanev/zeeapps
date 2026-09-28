# Depot Tenang design

Depot Tenang is a 3D wooden vehicle playground for a child around two years old. The Explorer touches large objects and can repeat or switch Activities freely.

## Diorama

`DepotTenang3D.ts` loads Blender GLB models for vehicles, materials, the station, the garage, the hangar, and trees. Three.js renders the board, road, ground-level rails, lighting, shadows, and touch hints. The railway, river bridge, and airport apron and runway appear with their matching Activities. One Activity is visible at a time.

The camera has a fixed three-quarter view. A portrait phone moves the camera to the current Activity and unload point. The canvas uses the displayed pixel density up to a 3840-pixel width. Pictured Activity buttons and a large action button stay inside the viewport.

## Input

A tap loads a rock, selects the unloading pit, lifts the dump bed, fills a concrete form, or washes mud. Dragging the bed changes its angle. A loose rock can be pulled with a soft physical grab and tapped to load it again. Every Activity can be completed by tapping or by pressing Space or Enter.

The Companion Gate clears an active gesture and pauses animation and physics. Reduced Motion removes truck bounce and limits incidental effects. Sound remains optional.

## Activities

- **Batu & kereta:** three rocks block the railway. Loading the last rock releases the train. The dump truck travels to the pit, where lifting its bed drops separate physical rocks onto wooden blocks.
- **Bangun jembatan:** a recessed river with visible, gently swimming fish cuts through the road. Three concrete forms fill the gap between raised approaches; a cargo truck crosses the finished deck.
- **Cuci pesawat:** the plane waits on a concrete apron beside the hangar, with a runway ahead and a service road for the tanker. Touching mud removes five patches. The tanker sprays, then the clean airplane takes off.

The supply prop resets the active Activity. Fallen rocks remain in the pit during repeated play, with a cap of 21 older rocks. New rocks wait until the train clears the crossing. Switching Activities keeps their results. There is no required order or final state.

## Motion and physics

Rapier 3D simulates loose rocks and wooden blocks with gravity, friction, bounce, and collision shapes. Loading follows a guided arc so a child can tap without precise placement. A released stone becomes a dynamic rigid body and can move the block pile.

Trucks use bounded acceleration and braking along the road. Train carriages follow the locomotive at fixed spacing on the rails. The dump bed lifts, the mixer drum turns during building, and the airplane propeller turns during flight. Concrete and water are short toy effects, not fluid simulations.

## Verification

Run `npm run build` and `npm test`. Browser tests cover the three Activities, 3D model loading, stone and block physics, touch, keyboard input, the Companion Gate, responsive layouts, settings, and load failure recovery. Inspect desktop and portrait captures after changing the camera or model placement.
