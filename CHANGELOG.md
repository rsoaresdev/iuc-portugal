# Changelog

All notable changes to this package are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow [Semantic Versioning](https://semver.org/).

A change to a rate table is a `minor` release, with the law that changed it named in the entry.

## [1.0.0] - 2026-10-30

### Added

- `computeIuc` for categories A, B and E with the 2026 rates.
- `iucSchedule` for the calendar-year payments from 2027.
- `iucCategory` and the rate `tables`, frozen so they cannot be changed at run time.
- `RATES_YEAR` and `RATES_SOURCE`.
- ESM and CommonJS builds with TypeScript types for both.
