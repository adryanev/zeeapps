# Issue tracker: GitHub

Issues and specs live in the `adryanev/zeeapps` GitHub repository. Run GitHub operations through `rtk gh` from inside the repository.

## Conventions

- Create an issue with `rtk gh issue create`.
- Read an issue and its comments with `rtk gh issue view <number> --comments`.
- List issues with `rtk gh issue list`.
- Comment with `rtk gh issue comment <number>`.
- Add or remove labels with `rtk gh issue edit <number>`.
- Close an issue with `rtk gh issue close <number>`.

Infer the repository from the `origin` remote.

## Pull requests as a triage surface

PRs as a request surface: no.

## Skill operations

When a skill says "publish to the issue tracker", create a GitHub issue.

When a skill says "fetch the relevant ticket", run `rtk gh issue view <number> --comments`.
