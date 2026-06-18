import { memo, useCallback, useEffect, useMemo } from "react";
import { Button, Divider, Icon, IconName, Intent, Menu, MenuItem, Spinner, Switch, Tag } from "@blueprintjs/core";
import { ContextMenu2, Tooltip2 } from "@blueprintjs/popover2";

import { useExtensionContext } from "Components/App";
import { useLibraryStore } from "Components/LibraryStore";
import { useOtherSettings } from "Components/UserSettings";

import { useBool } from "@hooks";

import { pluralize } from "../../utils";

import { ExtensionStatusEnum } from "Types/extension";
import "./_index.sass";


const isCurrentlyDark = () => document.getElementsByTagName("body")[0].getAttribute("zr-dark-theme") == "true";

function DarkThemeToggle() {
	const [{ darkTheme }] = useOtherSettings();
	const [useDark, { set: setUseDark, toggle: toggleDark }] = useBool(darkTheme);
	
	const toggleDarkTheme = useCallback(() => {
		const is_currently_dark = isCurrentlyDark();
		document.getElementsByTagName("body")[0].setAttribute("zr-dark-theme", (!is_currently_dark).toString());
		toggleDark();
	}, [toggleDark]);

	useEffect(() => {
		setUseDark(isCurrentlyDark());
	}, [setUseDark]);

	return <Switch 
		alignIndicator="right" 
		checked={useDark} 
		inline={false} 
		label="Dark Theme"
		onChange={toggleDarkTheme} />;
}

const IconTooltipFooter = memo(function IconTooltipFooter() {
	const { version } = useExtensionContext();
	
	return <div className="zr-icon-tooltip-footer">
		<DarkThemeToggle />
		<span className="zr-icon-tooltip-footer--row">
			<a href="https://alix-lahuec.gitbook.io/zotero-roam/" target="_blank" rel="noreferrer">Docs</a>
			<Tag className="zr-version-tag">v{version}</Tag>
		</span>
	</div>;
});


type ExtensionIconProps = {
	openLogger: () => void,
	openSearchPanel: () => void,
	openSettingsPanel: () => void,
	status: ExtensionStatusEnum,
	toggleExtension: () => void
};

const ExtensionIcon = memo<ExtensionIconProps>(function ExtensionIcon(props) {
	const { openLogger, openSearchPanel, openSettingsPanel, status, toggleExtension } = props;
	const { index, refresh, status: syncStatus } = useLibraryStore();

	const allowSearch = status == ExtensionStatusEnum.ON;
	const hasLoadingError = syncStatus == "error";
	const isFetching = syncStatus == "loading" || syncStatus == "syncing";

	const data_status = useMemo(() => {
		if (hasLoadingError) {
			return "error";
		}
		if (isFetching) {
			return "loading";
		}
		return "ready";
	}, [hasLoadingError, isFetching]);

	const button_icon = useMemo<IconName>(() => {
		if (status == ExtensionStatusEnum.DISABLED) {
			return "warning-sign";
		}
		if (hasLoadingError) {
			return "issue";
		}
		return "manual";
	}, [hasLoadingError, status]);

	const tooltipContent = useMemo(() => {
		return <>
			<span><strong>Status : </strong> {status}</span>
			{status == ExtensionStatusEnum.DISABLED && <Button aria-haspopup="dialog" icon="warning-sign" intent="warning" minimal={true} onClick={openSettingsPanel} text="Finish setup" title="Open zoteroRoam settings" />}
			{status == ExtensionStatusEnum.ON
				? <>
					<Divider />
					<ul className="bp3-list-unstyled">
						<li className="zr-queries-status">
							<span zr-role="entry">Library</span>
							<span zr-role="status">
								<span zr-role="timestamp">{pluralize(index.records.length, "paper")}</span>
								{isFetching ? <Spinner size={16} /> : <Icon size={16} icon={hasLoadingError ? "error" : "tick"} intent={hasLoadingError ? Intent.DANGER : Intent.SUCCESS} />}
								<Button minimal={true} onClick={refresh} disabled={isFetching} title="Refresh Zotero data">
									<Icon size={16} icon="refresh" />
								</Button>
							</span>
						</li>
					</ul>
				</>
				: null}
			<Divider />
			<IconTooltipFooter />
		</>;
	}, [hasLoadingError, index.records.length, isFetching, openSettingsPanel, refresh, status]);

	const contextMenu = useMemo(() => {
		return (
			<Menu>
				<MenuItem disabled={!allowSearch} text="Search Zotero" icon="search" onClick={openSearchPanel} />
				<MenuItem text="Settings" icon="settings" onClick={openSettingsPanel} />
				<MenuItem text="View logs" icon="console" onClick={openLogger} />
			</Menu>
		);
	}, [allowSearch, openLogger, openSearchPanel, openSettingsPanel]);

	return (
		<Tooltip2 popoverClassName="zr-icon-tooltip" 
			usePortal={false} 
			content={tooltipContent}
			placement="auto"
			interactionKind="hover" 
			hoverOpenDelay={450} 
			hoverCloseDelay={450} 
		>
			<ContextMenu2
				content={contextMenu}
			>
				<Button id="zotero-roam-icon"
					data-extension-status={status}
					data-fetching-status={data_status}
					disabled={status == ExtensionStatusEnum.DISABLED}
					icon={button_icon}
					minimal={true} 
					small={true}
					onClick={toggleExtension}
					aria-haspopup="true"
					title={status == ExtensionStatusEnum.DISABLED ? "zoteroRoam is disabled" : "Click to toggle the zoteroRoam extension"} />
			</ContextMenu2>
		</Tooltip2>
	);
});

export default ExtensionIcon;
