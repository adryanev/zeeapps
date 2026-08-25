# Domain docs

This repository uses a single domain context.

## Read domain documents before exploration

Read `CONTEXT.md` before you explore or change the project. Read each relevant ADR under `docs/adr/`.

If a domain document does not exist, continue without creating it. The `domain-modeling` skill creates domain documents when the team resolves a term or decision.

## Layout

- `CONTEXT.md` defines the domain vocabulary.
- `docs/adr/` records decisions that are costly to reverse.

## Use the glossary vocabulary

Use each domain term as `CONTEXT.md` defines it. Do not replace a term with a synonym listed under `_Avoid_`.

If the required concept is missing, record the gap for `domain-modeling`.

## Flag ADR conflicts

State when proposed work conflicts with an ADR. Do not override an ADR silently.
