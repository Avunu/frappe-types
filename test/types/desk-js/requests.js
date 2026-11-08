// Server calls, window helpers, templates and the translator, from plain desk
// JavaScript checked with JSDoc. Each block is a pattern an app used to need a
// local type, a cast or a `@ts-expect-error` for.

/** @typedef {import("frappe-types").FrappeResponse<{ name: string; email: string }[]>} RecipientsResponse */
/** @typedef {{ message?: string }} SecretResponse a hand-written envelope, as cloudflare_email_delivery has */

frappe.ui.form.on("ToDo", {
	refresh(frm) {
		// frappe.call(...).then: annotate the response the method returns. No
		// cast, and the annotation is checked against the response type.
		frappe
			.call({ method: "app.api.list_recipients", args: { todo: frm.doc.name }, freeze: true })
			.then((/** @type {RecipientsResponse} */ r) => {
				const rows = r.message || [];
				/** @type {string | undefined} */
				const first = rows[0]?.email;
				void first;
			});

		// A narrower hand-written envelope is accepted too.
		frappe
			.call({ method: "app.api.get_secret" })
			.then((/** @type {SecretResponse} */ r) => frappe.utils.copy_to_clipboard(r.message ?? ""));

		frappe
			.call({ method: "app.api.get_secret" })
			// @ts-expect-error an annotation that is not a response at all is rejected
			.then((/** @type {string} */ r) => r.length);

		// Unannotated, the response is typed; its message is `unknown`, not `any`.
		frappe.call("app.api.count").then((r) => {
			/** @type {string | undefined} */
			const exc = r.exc;
			void exc;
			// @ts-expect-error message is unknown until the script says what it is
			r.message.toFixed();
		});

		// T is inferred from an annotated callback, and flows to the promise.
		void frappe
			.call({
				method: "app.api.count",
				callback: (/** @type {import("frappe-types").FrappeResponse<number>} */ r) => void r,
			})
			.then((r) => r.message?.toFixed());

		// frm.call: the response, not `unknown`.
		void frm.call("get_totals").then((/** @type {import("frappe-types").FrappeResponse<{ total: number }>} */ r) => {
			/** @type {number | undefined} */
			const total = r.message?.total;
			void total;
		});
		void frm.call({ method: "app.api.set_status", args: { status: "Closed" }, freeze: true });

		// frappe.xcall resolves with the message itself.
		void frappe.xcall("app.api.count").then((/** @type {number} */ n) => n.toFixed());
	},
});

async function load_totals() {
	const r = await frappe.call({ method: "app.api.totals" });
	// @ts-expect-error awaited, the message is unknown, not any
	r.message.toFixed();
	/** @type {string | undefined} */
	const exception = r.exception;
	void exception;
	const n = await frappe.xcall("app.api.count");
	// @ts-expect-error xcall's value is unknown until annotated
	n.toFixed();
}
void load_totals;

// An awaited frm.call in JavaScript: annotate the `.then` and await that.
/** @param {frappe.ui.form.Form<"ToDo">} frm */
async function pending_rows(frm) {
	const rows = await frm
		.call("get_pending")
		.then((/** @type {import("frappe-types").FrappeResponse<{ name: string }[]>} */ r) => r.message ?? []);
	/** @type {string | undefined} */
	const first = rows[0]?.name;
	return first;
}
void pending_rows;

// frappe.db.get_doc infers the document from a registered doctype.
void frappe.db.get_doc("ToDo", "TD-0001").then((todo) => {
	/** @type {"Open" | "Closed" | "Cancelled"} */
	const status = todo.status;
	void status;
});

// The bare helpers frappe puts on window.
/** @param {frappe.ui.form.Form<"Sales Order">} frm */
function summarise(frm) {
	/** @type {string} */
	const total = format_currency(frm.doc.grand_total, "USD");
	/** @type {number} */
	const qty = flt(frm.doc.items[0]?.qty, precision("qty"));
	/** @type {boolean} */
	const open = in_list(["Draft", "To Deliver"], frm.doc.customer);
	open_url_post("/api/method/app.export", { name: frm.doc.name }, true);
	/** @type {string} */
	const arg = get_url_arg("tab");
	refresh_field("items");
	hide_field(["customer", "transaction_date"]);
	/** @type {string | null | undefined} */
	const symbol = get_currency_symbol();
	/** @type {number} */
	const places = get_number_format_info().precision;
	/** @type {true | undefined} */
	const blank = is_null(frm.doc.customer);
	/** @type {"read"} */
	const right = READ;
	void total, qty, open, arg, symbol, places, blank, right;
}
void summarise;

// window.saving is frappe's web form save guard.
/** @type {boolean | undefined} */
const busy = window.saving;
void busy;

// Templates: frappe.templates holds what an `import "./x.html"` compiled.
/** @type {string} */
const html = frappe.render_template("todo_summary", { title: __("Summary") });
/** @type {string} */
const inline = frappe.render("<b>{{ name }}</b>", { name: "x" });
/** @type {string | undefined} */
const raw = frappe.templates["todo_summary"];
void html, inline, raw;

// One translator: `__` and `frappe._` are the same function and the same type.
/** @type {typeof __} */
const t1 = frappe._;
/** @type {typeof frappe._} */
const t2 = __;
/** @type {string} */
const no_replacements = frappe._("Edit", "", "Edit grid row");
/** @type {string | undefined} */
const maybe = frappe._(/** @type {string | undefined} */ (undefined));
void t1, t2, no_replacements, maybe;

// A stand-in that only handles strings still fits the shared translator type.
/** @type {import("frappe-types").TranslateStringFunction} */
const translate = typeof window.__ === "function" ? __ : (txt) => txt;
void translate("Saved");

// frappe.prompt: say what the values are, in the callback.
frappe.prompt(
	[{ fieldname: "tasks", fieldtype: "Small Text", label: "Tasks", reqd: 1 }],
	async (/** @type {{ tasks: string; notes?: string }} */ values) => {
		/** @type {string[]} */
		const lines = values.tasks.split("\n");
		void lines;
	},
	__("Add Tasks"),
);

// frappe.user_info is never undefined.
/** @type {string} */
const fullname = frappe.user_info("someone@example.com").fullname;
void fullname;

// A decoded _server_messages entry.
/** @param {import("frappe-types").FrappeResponse} r */
function server_messages(r) {
	if (!r._server_messages) return [];
	/** @type {string[]} */
	const raw_entries = JSON.parse(r._server_messages);
	return raw_entries.map((entry) => {
		/** @type {import("frappe-types").FrappeServerMessage} */
		const m = JSON.parse(entry);
		return typeof m.message === "string" ? m.message : m.title;
	});
}
void server_messages;
