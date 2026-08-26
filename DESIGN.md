# Depot Tenang design system

Depot Tenang is a full-viewport wooden toy diorama for toddlers. The Child Stage presents one clear vehicle journey at a time. It has no score, timer, failure state, building labels, route labels, or visible instructions.

The approved direction is **Meja Mainan Kayu** with **Kamera Mengikuti Kendaraan**. The visual authority is `.impeccable/mocks/wooden-compositions/follow-the-vehicle.png`. `PRODUCT.md` defines the product constraints, and `.impeccable/surfaces/src-game-depottenangscene-ts.md` defines the surface contract.

## Visual hierarchy

The Active Vehicle is the primary object. On short mobile landscape screens, it occupies about one third of the viewport. Wider screens increase its visual scale without changing its Matter body.

The scene uses three depth groups:

- The foreground route uses a broad curved asphalt surface with a pale beech border.
- The Active Vehicle, its moving parts, contact shadow, and dust sit above the route.
- Resting vehicles and Resting Places stay visible at reduced scale and opacity.

Do not give a resting object the same contrast, scale, or saturation as the Active Vehicle. Keep edge-cropped resting objects quiet enough that they do not look interactive.

## Materials and color

Use these roles consistently:

| Role | Value or material |
| --- | --- |
| Dark wood and ground | `#986525`, `#917657` |
| Beech highlight and route border | `#DBBF94`, `beech-wood-texture.png` |
| Felt terrain | `#6D894F`, `felt-terrain-texture.png` |
| Asphalt route | `asphalt-road-texture.png` |
| Coral accent | `#BE5A25` |
| Golden accent | `#D8AF4A` |
| Tire and contact tone | `#25230C` |

`DepotTenangScene.createTexturedRoute` creates one `CanvasTexture`. `layoutTexturedRoute` redraws that texture only when the scene starts or resizes. The canvas repeats the asphalt, beech, and felt raster sources inside the curved route and terrain shapes, then uploads the finished texture once to WebGL.

Do not replace the route with a full-screen `TileSprite` or an untextured CSS shape. Keep the canvas transparent outside the route so that the wooden table remains visible.

## Composition and camera

The route enters from the lower foreground, sweeps past the Active Vehicle, and bends toward the distant Resting Places. The route must use the viewport height. Avoid straight horizontal bands.

The camera places a moving land vehicle near 36 percent of the viewport width. Airplane framing uses a higher vertical focus. The camera eases toward the target and never teleports during normal motion.

Short mobile landscape screens use a higher land-vehicle focus. Keep the wheels, contact shadow, and tappable route inside the viewport. Trim distant decoration before shrinking the Active Vehicle.

Reduced Motion keeps the same composition with a static camera. It also reduces lean, sway, and incidental motion.

## Vehicle motion

Matter Physics owns vehicle and cargo positions. Guided Physics controls acceleration, braking, speed limits, and arrival. Visual containers follow the Matter bodies and add small authored responses:

- The truck leans and compresses before departure.
- Wheels rotate independently from the body raster.
- The airplane propeller rotates independently.
- The truck emits a short bounded dust puff while moving.
- Arrival uses a damped settle without a bounce loop.

Soft Grab moves a body toward the pointer through bounded velocity. Gentle Recovery returns a body when the pointer reaches a stage edge, the body leaves its safe corridor, or motion becomes stuck. Recovery must remain visible and calm. Do not teleport a vehicle or cargo during a normal interaction.

Only one Active Vehicle can respond at a time. Keyboard, mouse, trackpad, and one-finger touch express the same journey intention.

## Child Stage interface

The Child Stage fills `100dvh` and clips world overscan. It contains no visible title, status card, or navigation control.

Three small wooden pegs show the current vehicle. The active peg brightens and grows slightly. The semantic title, live status, and active-vehicle copy remain in the DOM for assistive technology and automated tests.

The Companion Gate and settings remain outside ordinary toddler play. Preserve their keyboard and two-corner touch access.

## Assets and provenance

Production assets live in `public/assets/depot-tenang-v2/`. The inventory and dimensions live in `.impeccable/depot-tenang-v2-assets.json`. Exact generation prompts live in `.impeccable/asset-prompts/depot-tenang-v2/` and remain embedded in each generated raster.

Keep vehicle bodies, wheels, propellers, shadows, and dust as separate transparent assets. Keep material textures tileable. Do not add chrome, photoreal room furniture, labels, or true 3D rendering.

## Verification

Use these commands before changing the visual system:

```bash
npm run typecheck
npm test
```

The Playwright suite runs with one worker because concurrent Phaser WebGL scenes contend for the same GPU and create false journey timeouts. Review the final composition at 1672 by 941, 1366 by 768, and 844 by 390. The required comp-led capture is `.impeccable/review/hero-repro.png`.
