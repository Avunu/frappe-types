# Changelog

## [16.1.0](https://github.com/Avunu/frappe-types/compare/v16.0.1...v16.1.0) (2026-09-04)


### Features

* pin the frappe source with nix, and run checks through the flake ([99b513b](https://github.com/Avunu/frappe-types/commit/99b513b09376638aae0b457231f256dc96675553))


### Bug Fixes

* fall back to npm run check when a publish backfill predates nix ([5358b0b](https://github.com/Avunu/frappe-types/commit/5358b0be3eff61d9b8675e1306ffe103ac64c89b))
* refuse to measure coverage across frappe majors ([0224fae](https://github.com/Avunu/frappe-types/commit/0224fae971dca472ecefce3cd762a0c5c45e4a7d))
* separate-pull-requests, so a single-package release can be tagged ([b9fa19f](https://github.com/Avunu/frappe-types/commit/b9fa19f0b8048a23ef6546d95aaa4dfea4535936))


### Reverts

* keep jquery 3.5 ([87cd679](https://github.com/Avunu/frappe-types/commit/87cd679f58650fc2bb17e47cb669eaab1ece2119))

## [16.0.1](https://github.com/Avunu/frappe-types/compare/v16.0.0...v16.0.1) (2026-09-02)


### Bug Fixes

* correct datatable, form and utils types against frappe v16 source ([ecbd91f](https://github.com/Avunu/frappe-types/commit/ecbd91fe3d662019360ddce7ae701a464e87e436))
* type the total-row cell as the full stock shape ([14e56f9](https://github.com/Avunu/frappe-types/commit/14e56f9d1271637bfb34360c539f74fe263d79c7))
