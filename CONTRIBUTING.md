# Contributing

Thanks for your interest in Code Interpreter!

## How this repository is maintained

This repository is published from an internal ClickHouse monorepo, which is
the source of truth. Every change that lands internally is mirrored here as a
snapshot commit on the `sync/main` branch (spot them by the
`Source: ClickHouse/ai@<sha>` trailer); a maintainer merges the resulting
sync pull request to release it to `main`.

Practical consequences:

- **Pull requests are welcome.** CI runs on every PR. A maintainer reviews
  your change, imports it into the internal repository, and it arrives back
  with the next sync PR. We preserve attribution with a `Co-authored-by:`
  trailer — your PR will be closed with a reference to the sync that
  contains it.
- **`main` accepts no direct pushes.** It only advances by merging sync pull
  requests; branch rules enforce this with no exceptions.
- **History is snapshot-based.** Commits here intentionally do not mirror the
  internal commit history.

## Development

See the [README](README.md) for the architecture overview and
`docker compose up --build` for a local stack. Component-level docs live in
`api/`, `service/`, and `helm/codeapi/`.

## Reporting issues

Open a GitHub issue with reproduction steps. For suspected security issues,
please do not open a public issue — contact the maintainers instead.
