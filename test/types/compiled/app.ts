// Compiled TypeScript (esbuild/Vite/Node type stripping) against the strict
// base preset: the ambient globals, the type-space namespace and named imports
// in one program.

import type { DocOf, Form, FormEvents, ListViewSettings, FrappeDoc } from "frappe-types";

const events: FormEvents<"Project"> = {
	refresh(frm) {
		const pct: number = frm.doc.percent_complete;
		if (pct >= 100 && frm.doc.status !== "Completed") {
			void frm.set_value("status", "Completed");
		}
	},
};
frappe.ui.form.on("Project", events);

// The namespace spelling and the named import are the same type.
const same: frappe.ui.form.FormEvents<"Project"> = events;
void same;

export function progress(frm: Form<"Project">): string {
	return `${frm.doc.project_name}: ${frm.doc.percent_complete}%`;
}

export function as_plain(frm: Form<"Project">): Form {
	return frm;
}

export function plain_doc(doc: DocOf<"Project">): FrappeDoc {
	return doc;
}

export const project_list: ListViewSettings<"Project"> = {
	get_indicator(doc) {
		return doc.status === "Completed" ? [__("Completed"), "green", "status,=,Completed"] : [__("Open"), "orange"];
	},
};

// The pre-generic spellings still work: a bare Form, cur_frm, FormEvents<string>.
export function legacy(frm: Form, events: FormEvents): void {
	void frm.doc["anything"];
	void frm.set_value("anything", { nested: true });
	void events;
	if (cur_frm) void cur_frm.doc.name;
}

// @ts-expect-error a registered doc is closed
export const bad = (frm: Form<"Project">) => frm.doc.projct_name;

// @ts-expect-error `percent_complete` is a number
export const bad_value = (frm: Form<"Project">) => frm.set_value("percent_complete", "50");
