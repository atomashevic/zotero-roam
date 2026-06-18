import { KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Callout, Classes, InputGroup, Menu, MenuItem, Spinner, Tag } from "@blueprintjs/core";

import DialogOverlay, { DialogOverlayProps } from "Components/DialogOverlay";
import { ErrorBoundary } from "Components/Errors";
import ItemDetails from "Components/ItemDetails";
import { LibraryRecord, useLibraryStore } from "Components/LibraryStore";
import { useAnnotationsSettings, useCopySettings, useMetadataSettings, useNotesSettings, useTypemapSettings } from "Components/UserSettings";

import { importItemMetadata, importItemNotes, openPageByUID } from "@services/roam";

import { dialogClass, dialogLabel, resultClass, resultKeyClass } from "./classes";
import { formatItemReferenceWithDefault } from "./helpers";

import { CustomClasses } from "../../constants";
import { copyToClipboard, getPDFLink, pluralize } from "../../utils";

import { ExtensionStatusEnum } from "Types/extension";

import "./_index.sass";


type PendingAction = {
	action: "import" | "notes",
	key: string
} | null;

type SearchPanelProps = {
	status: ExtensionStatusEnum
} & Pick<DialogOverlayProps, "isOpen" | "onClose">;

const SearchPanel = memo<SearchPanelProps>(function SearchPanel({ isOpen, onClose, status }) {
	const searchbar = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [detailRecord, setDetailRecord] = useState<LibraryRecord | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction>(null);

	const [annotationsSettings] = useAnnotationsSettings();
	const [copySettings] = useCopySettings();
	const [metadataSettings] = useMetadataSettings();
	const [notesSettings] = useNotesSettings();
	const [typemap] = useTypemapSettings();
	const { index, isReady, refresh, search, status: syncStatus, updateImportedPage } = useLibraryStore();

	const results = useMemo(() => search(query), [query, search]);
	const activeRecord = results[activeIndex] || null;
	const hasLibraryData = index.records.length > 0;

	useEffect(() => {
		setActiveIndex(0);
		setDetailRecord(null);
	}, [query, results.length]);

	useEffect(() => {
		if (isOpen) {
			searchbar.current?.focus();
		} else {
			setQuery("");
			setActiveIndex(0);
			setDetailRecord(null);
			setPendingAction(null);
		}
	}, [isOpen]);

	const closeAndOpenPage = useCallback(async (pageUID: string) => {
		await openPageByUID(pageUID);
		onClose();
	}, [onClose]);

	const importAndJump = useCallback(async (record: LibraryRecord) => {
		const { item } = record;
		setPendingAction({ action: "import", key: record.citekey });
		try {
			const { pdfs = [], notes = [] } = item.children;
			const outcome = await importItemMetadata(
				{ item: item.raw, pdfs, notes },
				record.pageUID,
				metadataSettings,
				typemap,
				notesSettings,
				annotationsSettings
			);
			if (outcome.success && outcome.page?.uid) {
				updateImportedPage(item, outcome.page.uid);
				await closeAndOpenPage(outcome.page.uid);
			}
			return outcome;
		} finally {
			setPendingAction(null);
		}
	}, [annotationsSettings, closeAndOpenPage, metadataSettings, notesSettings, typemap, updateImportedPage]);

	const runPrimaryAction = useCallback(async (record: LibraryRecord | null) => {
		if (!record) {
			return;
		}

		if (record.pageUID) {
			await closeAndOpenPage(record.pageUID);
		} else {
			await importAndJump(record);
		}
	}, [closeAndOpenPage, importAndJump]);

	const importNotes = useCallback(async (record: LibraryRecord) => {
		const { item } = record;
		setPendingAction({ action: "notes", key: record.citekey });
		try {
			const outcome = await importItemNotes(
				{ item: item.raw, notes: item.children.notes },
				record.pageUID,
				notesSettings,
				annotationsSettings
			);
			if (outcome.success && outcome.page?.uid) {
				updateImportedPage(item, outcome.page.uid);
			}
			return outcome;
		} finally {
			setPendingAction(null);
		}
	}, [annotationsSettings, notesSettings, updateImportedPage]);

	const copyReference = useCallback((record: LibraryRecord) => {
		copyToClipboard(formatItemReferenceWithDefault(record.item, copySettings));
	}, [copySettings]);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
		switch (event.key) {
		case "ArrowDown":
			event.preventDefault();
			setActiveIndex(prev => Math.min(prev + 1, Math.max(results.length - 1, 0)));
			break;
		case "ArrowUp":
			event.preventDefault();
			setActiveIndex(prev => Math.max(prev - 1, 0));
			break;
		case "Enter":
			event.preventDefault();
			runPrimaryAction(activeRecord);
			break;
		case "Escape":
			event.preventDefault();
			onClose();
			break;
		default:
			break;
		}
	}, [activeRecord, onClose, results.length, runPrimaryAction]);

	const renderStatus = useMemo(() => {
		if (status != ExtensionStatusEnum.ON) {
			return <Callout intent="warning">zoteroRoam is disabled.</Callout>;
		}
		if (!hasLibraryData && syncStatus == "loading") {
			return <div className="zr-core-search--loading"><Spinner size={18} /> Loading Zotero library...</div>;
		}
		if (!hasLibraryData && syncStatus == "error") {
			return <Callout intent="danger">Unable to load Zotero data. Check your API settings, then refresh.</Callout>;
		}
		if (!hasLibraryData && isReady) {
			return <Callout>No Zotero items are available for search.</Callout>;
		}
		return null;
	}, [hasLibraryData, isReady, status, syncStatus]);

	return (
		<DialogOverlay
			ariaLabelledBy={dialogLabel}
			className={dialogClass}
			isOpen={isOpen}
			lazy={true}
			onClose={onClose} >
			<ErrorBoundary>
				<div className="zr-core-search">
					<InputGroup
						autoComplete="off"
						className="zr-core-search--input"
						inputRef={searchbar}
						leftIcon="search"
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search Zotero by citekey, title, author, year, DOI, tag, or abstract"
						rightElement={
							<Button className={Classes.MINIMAL} icon="refresh" loading={syncStatus == "syncing"} onClick={refresh} title="Refresh Zotero data" />
						}
						spellCheck={false}
						type="text"
						value={query}
					/>
					<div className="zr-core-search--meta">
						<span>{pluralize(index.records.length, "indexed paper")}</span>
						{syncStatus == "syncing" ? <Tag minimal={true}>Refreshing</Tag> : null}
						{syncStatus == "error" ? <Tag intent="danger" minimal={true}>Sync error</Tag> : null}
					</div>
					{renderStatus}
					{detailRecord
						? <ItemDetails
							closeDialog={() => setDetailRecord(null)}
							item={detailRecord.item}
							onImported={updateImportedPage} />
						: <Menu className="zr-core-search--results">
							{results.map((record, index) => {
								const { item } = record;
								const isActive = index == activeIndex;
								const isPending = pendingAction?.key == record.citekey;
								const primaryText = record.pageUID ? "Open" : "Import";
								return (
									<MenuItem
										active={isActive}
										className="zotero-roam-search_result zr-core-search--result"
										data-in-graph={(record.pageUID != false).toString()}
										htmlTitle={item.title}
										key={[record.location, record.itemKey].join("/")}
										labelClassName={resultKeyClass}
										labelElement={record.citekey}
										onClick={() => runPrimaryAction(record)}
										shouldDismissPopover={false}
										text={
											<span className={resultClass}>
												<span className="zr-library-item--title">{item.title}</span>
												<span className="zr-details">
													<span className={CustomClasses.TEXT_ACCENT_1}>{item.meta}</span>
													<span className={CustomClasses.TEXT_SECONDARY}>{item.publication}</span>
												</span>
												<span className="zr-core-search--actions">
													<Button loading={isPending && pendingAction?.action == "import"} minimal={true} small={true} text={primaryText} onClick={(event) => { event.stopPropagation(); runPrimaryAction(record); }} />
													<Button icon="clipboard" minimal={true} small={true} title="Copy reference" onClick={(event) => { event.stopPropagation(); copyReference(record); }} />
													{item.children.notes.length > 0
														? <Button icon="highlight" loading={isPending && pendingAction?.action == "notes"} minimal={true} small={true} title="Import notes" onClick={(event) => { event.stopPropagation(); importNotes(record); }} />
														: null}
													{item.children.pdfs[0]
														? <Button icon="paperclip" minimal={true} small={true} title="Open first PDF" onClick={(event) => { event.stopPropagation(); window.open(getPDFLink(item.children.pdfs[0], "href"), "_blank", "noreferrer"); }} />
														: null}
													<Button icon="info-sign" minimal={true} small={true} title="Show details" onClick={(event) => { event.stopPropagation(); setDetailRecord(record); }} />
												</span>
											</span>
										}
									/>
								);
							})}
						</Menu>}
				</div>
			</ErrorBoundary>
		</DialogOverlay>
	);
});


export default SearchPanel;
