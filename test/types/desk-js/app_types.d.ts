// Names an app adds to frappe's namespaces itself. frappe-types does not
// declare them, because they are not frappe's; the app declares them by
// augmenting the package's interfaces. This file is a module (it imports), so
// `declare module "frappe-types"` merges into the package rather than
// declaring a new ambient module.

import type { QuickEntryForm } from "frappe-types";

declare module "frappe-types" {
	interface FrappeUiFormNamespace {
		/** The app's quick entry for ToDo, found by `make_quick_entry("ToDo")`. */
		ToDoQuickEntryForm?: typeof QuickEntryForm;
	}
	interface Frappe {
		/** Set by the app's web page template. */
		todo_board_context?: { board: string };
	}
}
