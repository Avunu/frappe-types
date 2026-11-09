# Changelog

## [16.7.1](https://github.com/Avunu/frappe-types/compare/v16.7.0...v16.7.1) (2026-11-09)


### Bug Fixes

* re-verify declarations against frappe v16.55.2 ([#52](https://github.com/Avunu/frappe-types/issues/52)) ([6abb87f](https://github.com/Avunu/frappe-types/commit/6abb87f4105b6c95f9fe4208584303663fc5f83d))

## [16.7.0](https://github.com/Avunu/frappe-types/compare/v16.6.0...v16.7.0) (2026-11-09)


### Features

* ship lint globals generated from the ambient declarations ([#48](https://github.com/Avunu/frappe-types/issues/48)) ([34ff711](https://github.com/Avunu/frappe-types/commit/34ff711dae624bef11088a618d891bf75f1ed395))
* type the File document upload_file returns and FileUploader on_success gets ([#47](https://github.com/Avunu/frappe-types/issues/47)) ([1bde628](https://github.com/Avunu/frappe-types/commit/1bde62847597cabd050d1e00e613f0a289caa018))


### Bug Fixes

* drop carbon_theme's own declarations, which describe no frappe source ([#49](https://github.com/Avunu/frappe-types/issues/49)) ([adbeaa5](https://github.com/Avunu/frappe-types/commit/adbeaa5ce8d4940946b5a0a7662d6af5889c38bf))

## [16.6.0](https://github.com/Avunu/frappe-types/compare/v16.5.0...v16.6.0) (2026-11-08)


### Features

* complete frappe.perm, workflow and contacts and declare the web form deep modules ([#44](https://github.com/Avunu/frappe-types/issues/44)) ([318dd44](https://github.com/Avunu/frappe-types/commit/318dd44e592a20607351fbc69bf62c6bc09f6c65))
* model frappe's control classes, form footer, dialogs, perm and workflow ([#42](https://github.com/Avunu/frappe-types/issues/42)) ([12d630d](https://github.com/Avunu/frappe-types/commit/12d630df2f14b820ee0556cc3560b2af2b254ff2))
* open view modes to apps and type the views, side panel and utils apps patch ([#43](https://github.com/Avunu/frappe-types/issues/43)) ([89cb135](https://github.com/Avunu/frappe-types/commit/89cb135d7f196b55ebf5674be2b65303e550c836))
* type frappe's server calls, response envelope and window globals ([#40](https://github.com/Avunu/frappe-types/issues/40)) ([ca08433](https://github.com/Avunu/frappe-types/commit/ca08433a794102de9414627c2f39e798b6acc370))
* type quick entry, BaseTimeline and the website-only window helpers ([#45](https://github.com/Avunu/frappe-types/issues/45)) ([80d616c](https://github.com/Avunu/frappe-types/commit/80d616c6a98b016338bace7fc79fcabf31f82037))


### Bug Fixes

* correct the declarations the app migration found too loose or too strict ([#46](https://github.com/Avunu/frappe-types/issues/46)) ([367c72e](https://github.com/Avunu/frappe-types/commit/367c72e064aa930fbc5918b8ed5443796139aaf6))

## [16.5.0](https://github.com/Avunu/frappe-types/compare/v16.4.1...v16.5.0) (2026-10-07)


### Features

* add frappe-types gen-registry; run unit tests and audit:drift in CI ([#28](https://github.com/Avunu/frappe-types/issues/28)) ([8b23d43](https://github.com/Avunu/frappe-types/commit/8b23d43f163e6578b38b704584978553a48ca524))
* declare the desk API the Avunu apps use, and make audit-consumer honest about it ([#30](https://github.com/Avunu/frappe-types/issues/30)) ([284936e](https://github.com/Avunu/frappe-types/commit/284936e9afd93fb0e54b2eee51ef63d314a8b13d))
* tsconfig presets, typed JSDoc for desk scripts, doctype registry and web entry ([#29](https://github.com/Avunu/frappe-types/issues/29)) ([da59ab4](https://github.com/Avunu/frappe-types/commit/da59ab418cd55a5c5d060a14c57765b468e2ef9c))

## [16.4.1](https://github.com/Avunu/frappe-types/compare/v16.4.0...v16.4.1) (2026-10-06)


### Bug Fixes

* declare frappe.avatar and Awesomplete.close ([#26](https://github.com/Avunu/frappe-types/issues/26)) ([d3d7d58](https://github.com/Avunu/frappe-types/commit/d3d7d58ad5ceee3fa2e46439d6a215a0241211d6))

## [16.4.0](https://github.com/Avunu/frappe-types/compare/v16.3.1...v16.4.0) (2026-10-06)


### Features

* add remap-citations to move cited line numbers between frappe tags ([c5c9141](https://github.com/Avunu/frappe-types/commit/c5c9141ccdc65e3b83d7263e33a864d97241fbee))
* re-verify the typeset against frappe v16.50.0 ([ee6d2e0](https://github.com/Avunu/frappe-types/commit/ee6d2e05fcccad1cffdff6a661efed206df6d386))
* re-verify the typeset against frappe v16.50.0 ([8b372d6](https://github.com/Avunu/frappe-types/commit/8b372d6dfa23cb2f7540dbe721e9354d1c91a242))
* track frappe release drift with audit:drift and a DRIFT.md ledger ([a2cbeaf](https://github.com/Avunu/frappe-types/commit/a2cbeaf09a4936083b02a087fe07bc6bf130d4ea))
* track frappe release drift with audit:drift and a DRIFT.md ledger ([45ce97c](https://github.com/Avunu/frappe-types/commit/45ce97c851b138e7a236c1a077c59f7adb9f5daa))

## [16.3.1](https://github.com/Avunu/frappe-types/compare/v16.3.0...v16.3.1) (2026-09-17)


### Bug Fixes

* Grid#visible_columns is null while a form switches documents ([be4a7bc](https://github.com/Avunu/frappe-types/commit/be4a7bc100fc1d15eebbe4bdaeb0abe6fdc8fb58))
* Grid#visible_columns is null while a form switches documents ([9e2df72](https://github.com/Avunu/frappe-types/commit/9e2df72dcf0dd82e43be6b857404574a996bf5be))

## [16.3.0](https://github.com/Avunu/frappe-types/compare/v16.2.0...v16.3.0) (2026-09-16)


### Features

* **globals:** declare cint/flt/cstr/strip_number_groups and frappe.datetime ([7332fa7](https://github.com/Avunu/frappe-types/commit/7332fa71c1d215dd51bca05cc516104f9c3457bc))
* **globals:** declare cint/flt/cstr/strip_number_groups and frappe.datetime ([42c16fe](https://github.com/Avunu/frappe-types/commit/42c16fe67260ebe98d1272d8d138f7fdee962b2f))

## [16.2.0](https://github.com/Avunu/frappe-types/compare/v16.1.1...v16.2.0) (2026-09-14)


### Features

* **ui:** declare frappe.ui.Sidebar, SidebarHeader, Notifications, frappe.app and frappe.current_app ([63e0f69](https://github.com/Avunu/frappe-types/commit/63e0f69209296cf7841a97dc69201600b78bc3b2))
* **ui:** declare frappe.ui.Sidebar, SidebarHeader, Notifications, frappe.app and frappe.current_app ([1fba521](https://github.com/Avunu/frappe-types/commit/1fba521a23ba5d0deefe6687dd7c963683ee9ba9))


### Bug Fixes

* **ci:** silence FlakeHub login noise in check.yml ([28797c3](https://github.com/Avunu/frappe-types/commit/28797c3afa557449f45fcfd1c9f2ea0df324bf7b))
* pin the publish step to the npm resolved before nix runs ([5472449](https://github.com/Avunu/frappe-types/commit/5472449e6fac32d71d3594c76e78bcbd270574a5))

## [16.1.1](https://github.com/Avunu/frappe-types/compare/v16.1.0...v16.1.1) (2026-09-04)


### Bug Fixes

* enable provenance on the package config ([74af69a](https://github.com/Avunu/frappe-types/commit/74af69a9f9072f5a34876726aa02d6f4df21ea0a))

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
