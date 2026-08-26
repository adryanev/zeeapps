# Depot Tenang Child Stage

## Scope and mode

- Target: `src/game/DepotTenangScene.ts` and the Child Stage shell in `src/main.ts`.
- Mode: Experience.
- Approved visual world: Meja Mainan Kayu.
- Approved composition: Kamera Mengikuti Kendaraan.
- Approved comp: `.impeccable/mocks/wooden-compositions/follow-the-vehicle.png`.

## Audience, job, and action

The Explorer is a toddler who taps, presses ordinary keys, and drags large objects to discover cause and effect. The Companion may point, imitate, and talk without taking control. One Active Vehicle must read within a glance and respond within one action.

## Chosen direction

Depot Tenang becomes one handcrafted wooden play table. The camera sits low and close to the Active Vehicle, which occupies roughly one third of the frame. A broad curved route uses the entire viewport height. Resting vehicles and homes remain visible in soft background depth but do not compete with the active journey.

The memorable moment is the start of a journey: the vehicle leans back a few pixels, its wheels compress and turn, then the camera eases after it while a small felt dust puff settles behind. Reduced Motion keeps the same framing and journey but removes camera travel, parallax, and incidental sway.

## Constraints

- Preserve truck, train, airplane, Vehicle Journeys, Soft Grab, Gentle Recovery, Equivalent Input, Quiet State, Companion Gate, and settings.
- Keep layered 2D or 2.5D rendering and Matter Physics.
- No score, countdown, failure state, building labels, route labels, dashboard cards, or visible debug geometry.
- Large targets remain usable at laptop and mobile-landscape sizes.
- Do not literalize the photographed room in the comp. Carry only warm daylight and material depth.

## Visual system sampled from the approved comp

- Ground and dark wood: `#986525` and `#917657`.
- Pale beech highlights: `#DBBF94`.
- Felt landscape: `#6D894F` with deep `#4A4C29` shadows.
- Coral vehicle accents: `#BE5A25`.
- Golden accents: `#D8AF4A`.
- Dark contact and tire tone: `#25230C`.
- Materials: painted beech wood, carved grooves, rubber wheels, felt hills, matte asphalt insert, soft contact shadows.
- Corners and construction: visibly rounded wooden profiles, 18 to 28 pixel visual radii, inset seams, no generic card border.
- Elevation: one soft offset contact shadow per object plus a short darker grounding shadow under wheels.
- Type: no decorative text inside the Child Stage. Existing semantic status copy remains available to assistive technology and Companion surfaces.

## Implementation inventory

| Visible ingredient | Commitment | Medium |
| --- | --- | --- |
| Table and distant depth | Warm wooden table fills the frame; no empty lower field | Generated raster layers with Phaser camera |
| Felt landscape | Dense tactile hills and bushes covering background gaps | Generated raster layers |
| Curved road | Wide foreground curve leading to the active Resting Place | Canvas or Phaser geometry with a produced asphalt texture |
| Railway and runway | Quiet depth layers, never equal horizontal bands | Phaser geometry plus wooden or asphalt texture |
| Garage, station, hangar | Separate rounded wooden homes at different depth planes | Transparent generated raster cutouts |
| Truck, train, airplane | Chunky painted wooden toys with consistent material and scale | Transparent generated raster cutouts |
| Wheels and propeller | Independent moving pieces with readable rotation | Separate transparent raster parts animated in Phaser |
| Journey anticipation | Brief body lean and wheel compression before acceleration | Phaser transform and body state |
| Settling response | One damped body settle and short felt dust puff | Phaser animation and bounded particles |
| Contact shadows | Soft offset shadow plus tight wheel grounding | Raster shadow sprite or bounded blur layer |
| Camera behavior | Low close follow with slow ease and no overshoot | Phaser camera pan or world-container transform |
| Reduced Motion | Static camera, no parallax, lighter lean and particles | Existing setting mapped to motion profiles |
| Status | Three small wooden pegs; active one brightens | Phaser or semantic DOM with hidden live status copy |

## Responsive behavior

- Landscape laptop and tablet retain the low close camera and full curved route.
- Short mobile landscape raises the active vehicle slightly and trims distant decoration before shrinking the vehicle.
- Portrait shows the existing orientation guidance and does not squeeze the game into a tall stage.
- Safe areas protect the active vehicle, status pegs, and Companion Gate touch corners.

## Unresolved decisions

None for the first implementation pass. Asset production may simplify distant foliage, but it may not flatten the approved wooden and felt materials into CSS-only shapes.
