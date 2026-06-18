import { FC, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useRequestsSettings } from "Components/UserSettings";

import { useItems } from "@clients/zotero";
import { getCitekeyPages } from "@services/roam";

import { SEARCH_RESULT_LIMIT, LibraryIndex, LibraryRecord, buildLibraryIndex, buildLibraryRecords, searchLibraryIndex } from "./helpers";

import { RCitekeyPages, ZCleanItemTop, ZItemTop } from "Types/transforms";


type LibrarySyncStatus = "idle" | "loading" | "ready" | "syncing" | "error";

type LibraryStoreValue = {
	index: LibraryIndex,
	isReady: boolean,
	queries: ReturnType<typeof useItems>,
	refresh: () => void,
	search: (query: string, limit?: number) => LibraryRecord[],
	status: LibrarySyncStatus,
	updateImportedPage: (item: ZCleanItemTop | ZItemTop, pageUID: string) => void
};

const LibraryStoreContext = createContext<LibraryStoreValue | null>(null);

function getSyncStatus(queries: ReturnType<typeof useItems>, enabled: boolean): LibrarySyncStatus {
	if (!enabled) {
		return "idle";
	}

	if (queries.some(q => q.isLoadingError || q.isRefetchError)) {
		return "error";
	}

	if (queries.some(q => q.isLoading)) {
		return "loading";
	}

	if (queries.some(q => q.isFetching)) {
		return "syncing";
	}

	return "ready";
}

type LibraryStoreProviderProps = {
	enabled: boolean
};

const LibraryStoreProvider: FC<LibraryStoreProviderProps> = ({ children, enabled }) => {
	const [{ dataRequests }] = useRequestsSettings();
	const [roamCitekeys, setRoamCitekeys] = useState<RCitekeyPages>(() => new Map());

	useEffect(() => {
		if (enabled) {
			setRoamCitekeys(getCitekeyPages());
		}
	}, [enabled]);

	const itemQueries = useItems(dataRequests, {
		enabled,
		notifyOnChangeProps: ["data", "dataUpdatedAt", "fetchStatus", "isFetching", "isLoading", "isLoadingError", "isRefetchError", "status"]
	});

	const items = useMemo(() => itemQueries.map(q => q.data?.data || []).flat(1), [itemQueries]);
	const records = useMemo(() => buildLibraryRecords(items, roamCitekeys), [items, roamCitekeys]);
	const index = useMemo(() => buildLibraryIndex(records), [records]);
	const status = useMemo(() => getSyncStatus(itemQueries, enabled), [enabled, itemQueries]);

	const refresh = useCallback(() => {
		itemQueries.forEach(q => q.refetch());
		setRoamCitekeys(getCitekeyPages());
	}, [itemQueries]);

	const search = useCallback((query: string, limit = SEARCH_RESULT_LIMIT) => {
		return searchLibraryIndex(index, query, limit);
	}, [index]);

	const updateImportedPage = useCallback((item: ZCleanItemTop | ZItemTop, pageUID: string) => {
		const citekey = "@" + item.key;
		setRoamCitekeys(prev => {
			const next = new Map(prev);
			next.set(citekey, pageUID);
			return next;
		});
	}, []);

	const value = useMemo<LibraryStoreValue>(() => ({
		index,
		isReady: status == "ready" || status == "syncing",
		queries: itemQueries,
		refresh,
		search,
		status,
		updateImportedPage
	}), [index, itemQueries, refresh, search, status, updateImportedPage]);

	return (
		<LibraryStoreContext.Provider value={value}>
			{children}
		</LibraryStoreContext.Provider>
	);
};

const useLibraryStore = () => {
	const context = useContext(LibraryStoreContext);
	if (!context) {
		throw new Error("No library store provided");
	}
	return context;
};

export {
	LibraryStoreProvider,
	useLibraryStore
};
export type {
	LibraryIndex,
	LibraryRecord
};
