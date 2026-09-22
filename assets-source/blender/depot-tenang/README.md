# Rebuild the Depot Tenang fleet

Run these commands from the repository root with Blender 5.2.2 LTS installed.
The fleet build writes the Blender catalogue, GLB exports, game sprites, and projected geometry together.
Vehicle frames render at 1536 × 1024; wheels and propellers render at 512 × 512.
The mixer has 24 rotation frames and the dump bed has 13 tilt frames. Their frame counts are exported in the vehicle manifest and used by the loader.
Cab panels, window trims, bed ribs, and tank fittings are generated with the model.

```sh
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 -P assets-source/blender/depot-tenang/build_vehicle_fleet.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 -P assets-source/blender/depot-tenang/build_play_materials.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender -b assets-source/blender/depot-tenang/depot-tenang-master.blend --python-exit-code 1 -P assets-source/blender/depot-tenang/export_layout.py
rtk npm run build
rtk proxy env PLAYWRIGHT_PORT=4290 npx playwright test --reporter=line
```

Open `vehicle-fleet.blend` to inspect the complete catalogue. Edit `build_vehicle_fleet.py` to change generated models.
The script imports the four authored trucks from `truck-family.blend` and builds the locomotive, carriage, airplane, crate, wheel, and propeller.

The current touch playground draws its surfaces and railway in Phaser. The earlier overview environment is retained as a source asset. To change that asset, edit `depot-tenang-master.blend`, render it with `render_environment.py`, and export its layout again.
Commit the changed source, generated assets, and both JSON files under `src/game/generated` together.
The old `render_truck_sprites.py` entry point delegates to the fleet build.

## Play materials

`build_play_materials.py` creates `play-materials.blend`, individual GLB exports, transparent material sprites, and `src/game/generated/playMaterials.json`.
The catalogue contains three stones, a wooden block, seven concrete fill stages in wooden formwork, a reflective pool, water and concrete droplets and splashes, mud, a cement sack, a water bucket, and a hose with a metal nozzle.
Open `renders/play-materials.png` for the catalogue preview.
The generated manifest supplies display dimensions, the bridge surface contact, and the nozzle outlet to `PlayMaterials.ts`. The vehicle manifest supplies the mixer chute outlet; the truck aligns that outlet above each form before pouring.
Streams reuse a bounded set of sprites along a path. They are illustrated toy effects rather than a fluid solver.
Continuous stream cores, impact droplets, fading mud, and short completion glints follow the scene clock. Feedback is cleared when activities change and freezes during pause. Reduced Motion removes flying droplets, suspension bounce, and airplane banking.

## Check the result

The Blender build fails if a vehicle or animation frame extends into its padding.
The browser tests also inspect PNG transparency at the edges, so the check covers rendered pixels.
Inspect `renders/vehicle-fleet.png` for the complete catalogue and the running game for scenery overlap.

The generated coordinates use the same orthographic camera and aspect ratio as their PNGs.
The layout export samples the road mesh and the near rail in the background camera.
The game preserves logical coordinates of 960 × 540. Its render buffer follows the displayed size and device pixel ratio, up to 3840 × 2160. The camera scales that buffer back to the logical world, and pointer input is converted through the camera.

## Physics scope

Depot Tenang uses a 2D world with Blender-rendered sprites.
The truck moves along its activity lane with bounded acceleration and braking.
Wheel hub markers rotate from measured travel divided by wheel radius.
The locomotive drives the carriages through constraints at the exported coupler positions.
Axles remain on the playground rail. Clearing rocks releases the train.
The airplane follows an illustrated takeoff path after washing.

Loose rocks and toy blocks are Matter bodies with friction, restitution, gravity, and collision surfaces.
Released rocks land in the foreground pit and can knock down blocks.
Loaded cargo is attached to its vehicle, then released as separate bodies. The dump sprites exclude baked rocks.
Replenishment retains up to 24 fallen rocks to bound the cost of a long play session.

Mixer drum rotation and dump-bed tilt use Blender animation frames.
These are toy mechanisms. Washing and concrete pouring leave illustrated results.
The game does not simulate liquid flow, three-dimensional granular material, aerodynamics, or collisions with buildings in the background image.

## Free play controls

Choose Batu & kereta, Bangun jembatan, or Cuci pesawat. Touch the highlighted objects; vehicles travel automatically when an activity needs them.
Space or Enter performs the next action. Tap or lift the dump bed, and drag fallen rocks to play with them.
The supply box repeats the activity. The Companion Gate pauses movement and cargo physics.
There is no required activity order or final Quiet State.
