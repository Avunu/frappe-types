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

		// The message's own shape is not the response: the envelope mistaken for
		// the payload is caught.
		frappe
			.call({ method: "app.api.get_row" })
			// @ts-expect-error `{ name, qty }` shares no key with the response envelope
			.then((/** @type {{ name: string; qty: number }} */ row) => row.name.toUpperCase());

		// .done takes the same annotations as .then.
		frappe
			.call({ method: "app.api.get_secret" })
			.done((/** @type {RecipientsResponse} */ r) => void r.message?.[0]?.email)
			.done(/** @param {{ message: string }} r */ (r) => void r.message.length)
			.fail(() => undefined);
		frappe
			.call({ method: "app.api.get_row" })
			// @ts-expect-error the message's shape is rejected here too
			.done((/** @type {{ name: string; qty: number }} */ row) => void row.name);

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
		// @ts-expect-error frm.call reads opts.method unguarded, so the object form needs it
		void frm.call({ args: { status: "Closed" } });

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

// An awaited frm.call in JavaScript: annotate the variable (T is inferred from
// it), or annotate the `.then` and await that.
/** @param {frappe.ui.form.Form<"ToDo">} frm */
async function pending_rows(frm) {
	/** @type {import("frappe-types").FrappeResponse<{ name: string }[]>} */
	const r = await frm.call("get_pending");
	/** @type {import("frappe-types").FrappeResponse<{ name: string }[]>} */
	const r2 = await frappe.call({ method: "app.api.pending" });
	const rows = await frm
		.call("get_pending")
		.then((/** @type {import("frappe-types").FrappeResponse<{ name: string }[]>} */ r) => r.message ?? []);
	/** @type {string | undefined} */
	const first = rows[0]?.name ?? r.message?.[0]?.name ?? r2.message?.[0]?.name;
	return first;
}
void pending_rows;

// API v2 carries the payload in `data`, not `message`.
async function v2_rows() {
	/** @type {import("frappe-types").FrappeResponse<{ name: string }[]>} */
	const r = await frappe.call({ method: "app.api.rows", api_version: "v2" });
	return r.data ?? [];
}
void v2_rows;

/** @typedef {import("frappe-types").FrappeDoc & { item_name: string }} ItemDoc an app's own document type, "Item" not registered */

// An unregistered doctype: the annotation on the result types it.
async function load_item() {
	/** @type {ItemDoc} */
	const item = await frappe.db.get_doc("Item", "ITEM-0001");
	return item.item_name;
}
void load_item;

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
	// precision() may be the System Settings string; the formatters take it.
	/** @type {string} */
	const amount = format_currency(frm.doc.grand_total, "USD", precision("grand_total"));
	/** @type {string} */
	const plain = format_number(frm.doc.grand_total, null, precision("grand_total"));
	/** @type {number} */
	const whole = cint(frm.doc.customer);
	/** @type {number | null} */
	const maybe_int = cint(frm.doc.customer, null);
	// @ts-expect-error an explicit null default can come back
	/** @type {number} */ const not_null = cint(frm.doc.customer, null);
	/** @type {number} */
	const with_default = cint(frm.doc.customer, 5);
	/** @type {number | null} */ const nullable_default = cint(frm.doc.customer, maybe_int);
	// @ts-expect-error a default that may be null can come back
	/** @type {number} */ const nullable_not_null = cint(frm.doc.customer, maybe_int);
	/** @type {any} */ const untyped_default = frm.doc.customer;
	// an untyped (`any`) default reads as a number, as before
	/** @type {number} */ const from_any = cint(frm.doc.customer, untyped_default);
	// map passes the index as `def`, which is a number: the result stays number[]
	/** @type {number[]} */
	const permlevels = ["0", "1", "2"].map(cint);
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
	void total, qty, amount, plain, whole, maybe_int, not_null, with_default, nullable_default, nullable_not_null, from_any, permlevels, open, arg, symbol, places, blank, right;
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

// `__` fits a parameter that only needs the string form of the translator.
/** @param {(txt: string, replace?: string[]) => string} translate */
function label(translate) {
	return translate("Saved");
}
void label(__), label(frappe._);

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
