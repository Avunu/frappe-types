// An app-owned Web Form field (a Custom Field the app ships), declared the way
// esign_webforms declares `esign_enabled`: by augmenting the named keys of the
// Web Form document. `prepare()` copies them onto the controller, and so do the
// types.
import type { FrappeCheck } from "frappe-types";

declare module "frappe-types" {
	interface WebFormDocFields {
		esign_enabled?: FrappeCheck;
	}
}
