// An app's own view mode. frappe's list of views is open at runtime (an app
// pushes onto `frappe.views.view_modes`), so the app registers the name with
// frappe-types instead of casting it into `FrappeViewName`. The same app also
// routes Workspace Shortcuts to it through a `generate_route` wrapper.

import type { ListView } from "frappe-types";

declare module "frappe-types" {
	interface FrappeViewModes {
		Board: true;
	}
	interface FrappeGenerateRouteDocViews {
		Board: true;
	}
	interface FrappeViewsNamespace {
		/** The app's view: `ListFactory` resolves `frappe.views[view_name + "View"]`. */
		BoardView?: new (opts: import("frappe-types").ListFactoryViewOptions) => ListView;
	}
}
