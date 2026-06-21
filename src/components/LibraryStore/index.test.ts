import { items } from "Mocks";

import { buildLibraryIndex, buildLibraryRecords, searchLibraryIndex } from "./helpers";


describe("LibraryStore indexing", () => {
	it("normalizes Zotero items into records keyed by citekey, item key, and Roam page UID", () => {
		const records = buildLibraryRecords(items, new Map([
			["@pintoExploringDifferentMethods2021", "pinto-page-uid"]
		]));
		const index = buildLibraryIndex(records);

		expect(records).toHaveLength(3);
		expect(index.byCitekey.get("@pintoExploringDifferentMethods2021")?.pageUID)
			.toBe("pinto-page-uid");
		expect(index.byItemKey.get("groups/456789/D53X926C")?.citekey)
			.toBe("@pintoExploringDifferentMethods2021");
		expect(index.byPageUID.get("pinto-page-uid")?.item.title)
			.toContain("basic income");
	});

	it("matches old Zotero-key Roam pages after citation keys refresh", () => {
		const refreshedItems = items.map(item => item.data.key == "D53X926C"
			? { ...item, key: "betterBibTeXKey" }
			: item);
		const records = buildLibraryRecords(refreshedItems, new Map([
			["@D53X926C", "old-zotero-key-page-uid"]
		]));
		const index = buildLibraryIndex(records);

		expect(index.byCitekey.get("@betterBibTeXKey")?.pageUID)
			.toBe("old-zotero-key-page-uid");
	});

	it("searches the local index across title, author, citekey, DOI, tags, and abstract", () => {
		const index = buildLibraryIndex(buildLibraryRecords(items, new Map()));

		expect(searchLibraryIndex(index, "basic income")[0].citekey)
			.toBe("@pintoExploringDifferentMethods2021");
		expect(searchLibraryIndex(index, "bloch")[0].citekey)
			.toBe("@blochImplementingSocialInterventions2021");
		expect(searchLibraryIndex(index, "10.1503")[0].citekey)
			.toBe("@blochImplementingSocialInterventions2021");
		expect(searchLibraryIndex(index, "housing")[0].citekey)
			.toBe("@pintoExploringDifferentMethods2021");
	});
});
