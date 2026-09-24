# Build Depot Tenang models

Depot Tenang loads compressed GLB files from `public/assets/depot-tenang-3d`. The Blender source and uncompressed exports live in this directory. Run these commands from the repository root with Blender 5.2.2 LTS and the npm dependencies installed:

```sh
rtk proxy blender -b --python-exit-code 1 -P assets-source/blender/depot-tenang/build_vehicle_fleet.py
rtk proxy blender -b --python-exit-code 1 -P assets-source/blender/depot-tenang/build_play_materials.py
rtk proxy blender -b --python-exit-code 1 -P assets-source/blender/depot-tenang/build_environment_3d.py
rtk npm run assets:sync
rtk npm run build
```

`build_vehicle_fleet.py` builds the locomotive, carriages, airplane, crate, and truck variants. It also writes PNG sprites for the earlier 2D game. `build_play_materials.py` builds stones, blocks, concrete, mud, water, and supply props. `build_environment_3d.py` builds the station, garage, hangar, and tree as separate models. `assets:sync` compresses only the 22 GLBs used by the current Game with Meshopt and makes small WebP previews from the four large PNGs used by the Playroom and activity buttons. It preserves the uncompressed Blender exports and named model parts used by the animations.

`src/game/DepotTenang3D.ts` places the models on a wider board. The station sits beside the railway, the garage beside the road, and the hangar beside the airplane. The renderer handles lighting, camera, touch picking, and animation. Rapier 3D gives loose stones and blocks gravity and collisions; vehicles follow guided paths.

Run `npm test` after exporting. Inspect the running Game in desktop and portrait sizes because a valid GLB file can still have the wrong orientation or scale.
