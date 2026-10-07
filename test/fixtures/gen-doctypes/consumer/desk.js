// @ts-check
// Uncompiled desk JS, checked with allowJs + checkJs: the registry is reachable from JSDoc
// with no import, because it is global.

/** @param {FrappeDocTypes["Sales Order"]} doc */
function rowsToBill(doc) {
	return doc.items.filter((row) => (row.qty ?? 0) > 0).map((row) => row.item_code);
}

/** @param {FrappeDocTypes["Sales Order"]} doc */
function wrongField(doc) {
	// @ts-expect-error status is a string union, not a number
	return doc.status * 2;
}

export { rowsToBill, wrongField };
