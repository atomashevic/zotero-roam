import { categorizeLibraryItems, cleanLibraryItem, identifyChildren, parseDOI, searchEngine } from "../../utils";

import { RCitekeyPages, ZCleanItemTop, ZItem, ZItemTop } from "Types/transforms";


const SEARCH_RESULT_LIMIT = 50;

export type LibraryRecord = {
	citekey: string,
	doi: string,
	item: ZCleanItemTop,
	itemKey: string,
	location: string,
	pageUID: string | false,
	searchText: string
};

export type LibraryIndex = {
	byCitekey: Map<string, LibraryRecord>,
	byItemKey: Map<string, LibraryRecord>,
	byPageUID: Map<string, LibraryRecord>,
	records: LibraryRecord[]
};

const emptyIndex: LibraryIndex = {
	byCitekey: new Map(),
	byItemKey: new Map(),
	byPageUID: new Map(),
	records: []
};

function makeRecord(item: ZCleanItemTop): LibraryRecord {
	const doi = parseDOI(item.raw.data.DOI) || "";
	const citekey = "@" + item.key;
	const searchText = [
		citekey,
		item.key,
		item.title,
		item.authors,
		item.authorsFull.join(" "),
		item.year,
		item.publication,
		doi,
		item.tags.join(" "),
		item.abstract
	].filter(Boolean).join(" ");

	return {
		citekey,
		doi,
		item,
		itemKey: item.itemKey,
		location: item.location,
		pageUID: item.inGraph,
		searchText
	};
}

function buildLibraryRecords(items: ZItem[], roamCitekeys: RCitekeyPages): LibraryRecord[] {
	const lib = categorizeLibraryItems(items);

	return lib.items.map((item: ZItemTop) => {
		const itemKey = item.data.key;
		const location = item.library.type + "s/" + item.library.id;
		const { pdfs, notes } = identifyChildren(itemKey, location, { pdfs: lib.pdfs, notes: lib.notes });
		return makeRecord(cleanLibraryItem(item, pdfs, notes, roamCitekeys));
	});
}

function buildLibraryIndex(records: LibraryRecord[]): LibraryIndex {
	return records.reduce<LibraryIndex>((index, record) => {
		index.records.push(record);
		index.byCitekey.set(record.citekey, record);
		index.byItemKey.set([record.location, record.itemKey].join("/"), record);
		if (record.pageUID) {
			index.byPageUID.set(record.pageUID, record);
		}
		return index;
	}, {
		byCitekey: new Map(),
		byItemKey: new Map(),
		byPageUID: new Map(),
		records: []
	});
}

function scoreLibraryRecord(query: string, record: LibraryRecord): number {
	const cleanQuery = query.trim().toLowerCase();
	const title = record.item.title.toLowerCase();
	const citekey = record.citekey.toLowerCase();
	const key = record.item.key.toLowerCase();
	const authors = record.item.authors.toLowerCase();
	const doi = record.doi.toLowerCase();

	if (citekey == cleanQuery || key == cleanQuery || citekey == "@" + cleanQuery) {
		return 100;
	}
	if (citekey.includes(cleanQuery) || key.includes(cleanQuery)) {
		return 90;
	}
	if (title.startsWith(cleanQuery)) {
		return 80;
	}
	if (authors.startsWith(cleanQuery)) {
		return 70;
	}
	if (doi && doi.includes(cleanQuery)) {
		return 65;
	}
	return 50;
}

function searchLibraryIndex(index: LibraryIndex, query: string, limit = SEARCH_RESULT_LIMIT): LibraryRecord[] {
	const cleanQuery = query.trim();
	if (cleanQuery.length == 0) {
		return index.records
			.slice()
			.sort((a, b) => {
				const aDate = new Date(a.item.raw.data.dateAdded || 0).getTime();
				const bDate = new Date(b.item.raw.data.dateAdded || 0).getTime();
				return bDate - aDate;
			})
			.slice(0, limit);
	}

	return index.records
		.filter(record => searchEngine(
			cleanQuery,
			record.searchText,
			{
				any_case: true,
				match: "partial",
				search_compounds: true,
				word_order: "loose"
			}
		))
		.sort((a, b) => scoreLibraryRecord(cleanQuery, b) - scoreLibraryRecord(cleanQuery, a))
		.slice(0, limit);
}

export {
	SEARCH_RESULT_LIMIT,
	buildLibraryIndex,
	buildLibraryRecords,
	emptyIndex,
	searchLibraryIndex
};
