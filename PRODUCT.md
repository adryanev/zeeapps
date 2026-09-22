# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary Explorer is a toddler, around two years old, who plays on a laptop or touchscreen device. A family Companion may join through pointing, imitation, conversation, and co-presence while the Explorer keeps control.

## Product purpose

Dunia Zee is an open-access Playroom for calm independent exploration and family bonding. Its Games support simple motor practice through taps, ordinary keyboard input, pointer movement, and forgiving drag interactions. A Play Session should also be able to settle into a quiet stopping point.

## Positioning

Dunia Zee treats the Child Stage as a living toy diorama rather than a lesson, score-driven game, or physics simulator. Different inputs express the same simple play intention, so the Explorer can discover cause and effect without instructions.

## Operating context

Families open the same hosted website without accounts or child profiles. The primary setting is a laptop, with mobile and tablet touch support in landscape. Depot Tenang offers Free Play with trucks, trains, airplanes, supply boxes, and repeatable Activities in one Diorama.

## Capabilities and constraints

- Depot Tenang uses Phaser 4 with Matter Physics and deploys as a static GitHub Pages website.
- Keyboard, mouse, trackpad, and one-finger touch must provide Equivalent Input.
- One Activity receives direct input at a time; other vehicles can react to its results.
- Touching objects causes visible changes. Vehicles travel automatically to activity destinations. Loose rocks support Soft Grab and bounded physical collisions.
- The Child Stage has no score, countdown, failure state, or ordinary navigation controls.
- Companion settings remain outside the Child Stage and stay device-local.
- Keep the vehicle variety, calm play, safety behavior, and public access. The chosen interaction model is direct-touch Free Play: clear the railway, build a bridge, and wash an airplane.
- Art remains layered 2D or 2.5D rather than true 3D.

## Brand commitments

The product name is Dunia Zee and its first Game is Depot Tenang. The interface uses the domain language in `CONTEXT.md`. The experience must feel like a living toy diorama for a toddler, not a simulator, dashboard, or educational exercise.

## Evidence on hand

- Current product behavior and terminology are documented in `CONTEXT.md`.
- The current implementation and the user's screenshots are evidence of layout and motion problems, not visual authority for the redesign.
- Blender source models, rendered sprites, and measured vehicle geometry live in the repository.

## Product principles

- Make cause and effect obvious within one action.
- Give the Explorer large, forgiving targets and predictable responses.
- Preserve calm repetition without rewards, penalties, or pressure.
- Let a Companion join naturally without taking control.
- Prefer one readable play focus over showing every system at once.

## Accessibility & inclusion

The Game must support reduced motion, optional sound, keyboard input, coarse touch targets, and a portrait-orientation guidance state. Required interactions cannot depend on precise dragging or multi-finger gestures.
