import styled from "@emotion/styled";
import type React from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { ProgressBar, ProgressRoot } from "~components/ui/progress";

import {
  Box,
  Circle,
  Float,
  IconButton,
  MenuSeparator,
  Stack,
} from "@chakra-ui/react";
import { css } from "@emotion/react";
import { generateCsv, mkConfig } from "export-to-csv";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo } from "react";
import { CiExport } from "react-icons/ci";
import {
  LuClipboardCopy,
  LuDownload,
  LuLink,
  LuSearch,
  LuSearchX,
  LuSigma
} from "react-icons/lu";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from "~components/ui/menu";
import { Shortcut } from "~components/ui/shortcut";
import { Tooltip } from "~components/ui/tooltip";
import { DateType } from "~lib/dateUtils";
import { DateSelector, isDateSelectorOpenAtom } from "./DateSelector";
import { SettingsDrawer } from "./drawer/Drawer";
import { Editor } from "./Editor";
import { createShortcutsHandler, headerShortcuts, searcherShortcuts } from "./keymaps";
import { notifySuccess } from "./notifyError";
import {
  FormValues,
  isLoadingAtom,
  isQuerySuccessAtom,
  queryEndTimeAtom,
  queryStartTimeAtom,
  useQueryActions,
  useRunQuery
} from "./search";
import { endFullDateAtom, startFullDateAtom } from "./store/dateState";
import { dataViewModelAtom, searchQueryAtom } from "./store/queryState";
import { Timer } from "./Timer";

const StyledHeader = styled.form`
  display: flex;
  gap: 0.4rem;
  flex-direction: row;
  padding: 0.3rem;

  // add media
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const QueryContainer = styled.div`
  position: relative;
  flex: 1;
  display: flex;
`;

const ButtonsHolder = styled.div`
  display: flex;
`;

const LoaderHolder = styled.div`
  display: flex;
  flex-direction: column;
  /* padding: 0 0.9rem; */
  height: 5px;
`;

type HeaderProps = {};

const Header: React.FC<HeaderProps> = ({}) => {
  const isLoading = useAtomValue(isLoadingAtom);

  const [searchValue, setSearchValue] = useAtom(searchQueryAtom);
  const selectedStartTime = useAtomValue(startFullDateAtom);
  const selectedEndTime = useAtomValue(endFullDateAtom);

  // query execution props
  const isQuerySuccess = useAtomValue(isQuerySuccessAtom);
  const queryStartTime = useAtomValue(queryStartTimeAtom);
  const queryEndTime = useAtomValue(queryEndTimeAtom);
  const setDateSelectorOpen = useSetAtom(isDateSelectorOpenAtom);
  const runQuery = useRunQuery();
  const {abortRunningQuery} = useQueryActions();

  const { handleSubmit } = useForm<FormValues>({
    values: {
      searchTerm: searchValue,
      fromTime: selectedStartTime,
      toTime: selectedEndTime,
    },
  });

  const onSubmit =
    (isForced: boolean): SubmitHandler<FormValues> =>
    async () => {
      await runQuery(isForced);
    }

  const onHeaderKeyDown = createShortcutsHandler(headerShortcuts, (shortcut) => {
    switch (shortcut) {
      case "search":
        setDateSelectorOpen(false);
        handleSubmit(onSubmit(true))();
        break;
      case "re-evaluate":
        setDateSelectorOpen(false);
        handleSubmit(onSubmit(false))();
        break;
    }
  });

  const loaderValue = isLoading ? null : 100;
  const loaderColor = useMemo(() => {
    if (isLoading) {
      return "gray" as const;
    }

    if (isQuerySuccess) {
      return "green" as const;
    }

    return "red" as const;
  }, [isLoading, isQuerySuccess]);

  return (
    <>
      <LoaderHolder>
        <ProgressRoot
          value={loaderValue}
          variant="subtle"
          size="xs"
          colorPalette={loaderColor}
        >
          <ProgressBar />
        </ProgressRoot>
      </LoaderHolder>
      <StyledHeader
        onSubmit={handleSubmit(onSubmit(false))}
        onKeyDown={onHeaderKeyDown}
      >
        <QueryContainer>
          <div
            css={css`
              flex: 1;
            `}
          >
            <Editor value={searchValue} onChange={setSearchValue} />
          </div>
          <Timer
            startTime={queryStartTime}
            endTime={queryEndTime}
            isLoading={isLoading}
          />
        </QueryContainer>
        <SearchBarButtons
          isLoading={isLoading}
          onForceSubmit={() => handleSubmit(onSubmit(true))()}
          onTerminateSearch={() =>
            abortRunningQuery("Search terminated by user")
          }
        />
      </StyledHeader>
    </>
  );
};

type SearchBarButtonsProps = {
  isLoading: boolean;
  onForceSubmit: () => void;
  onTerminateSearch: () => void;
};

const SearchBarButtons: React.FC<SearchBarButtonsProps> = ({
  isLoading,
  onForceSubmit,
  onTerminateSearch,
}) => {
  const endTime = useAtomValue(endFullDateAtom);
  const startTime = useAtomValue(startFullDateAtom);
  const isRelativeTimeSelected = useMemo(() => {
    return endTime === DateType.Now || startTime === DateType.Now;
  }, [endTime, startTime]);

  return (
    <ButtonsHolder>
      <Stack gap={3}>
        <DateSelector />
        <Stack gap={3} direction="row">
          <Box position="relative">
            <Tooltip
              content={
                <span>
                  Process Pipeline {!isRelativeTimeSelected && "Only"}{" "}
                  <Shortcut keys={headerShortcuts.getAlias("re-evaluate")} />
                </span>
              }
              showArrow
              positioning={{
                placement: "bottom",
              }}
            >
              <IconButton
                aria-label="Re-evalutate"
                type="submit"
                disabled={isLoading}
              >
                <LuSigma />
              </IconButton>
            </Tooltip>
            {isRelativeTimeSelected && (
              <Tooltip
                content={<span>Relative time is selected, full refresh is required!</span>}
                showArrow
                contentProps={{ css: { "--tooltip-bg": "tomato" } }}
              >
                <Float placement="top-end">
                  <Circle size="3" bg="red" color="white"></Circle>
                </Float>
              </Tooltip>
            )}
          </Box>
          {isLoading ? (
            <Tooltip
              content={<span>Terminate Search</span>}
              showArrow
              positioning={{
                placement: "bottom",
              }}
            >
              <IconButton
                aria-label="Terminate database"
                onClick={() => onTerminateSearch()}
              >
                <LuSearchX />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip
              content={
                <span>
                  Search <Shortcut keys={headerShortcuts.getAlias("search")} />
                </span>
              }
              showArrow
              positioning={{
                placement: "bottom",
              }}
            >
              <IconButton
                aria-label="Search database"
                onClick={() => onForceSubmit()}
              >
                <LuSearch />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <MiniButtons />
      </Stack>
    </ButtonsHolder>
  );
};

const csvConfig = mkConfig({ useKeysAsHeaders: true });

const downloadFile = (filename: string, data: string, mimeType: string) => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const MiniButtons = () => {
  const { table: tableView } = useAtomValue(dataViewModelAtom);

  const {copyCurrentShareLink} = useQueryActions();

  const isDisabled = tableView === undefined;

  const dataAsArray = () => {
    if (tableView === undefined) {
      throw new Error("Table view is undefined");
    }

    return tableView.dataPoints.map((row) => {
      const result: Record<string, unknown> = {};
      for (const key in row.object) {
        result[key] = row.object[key]?.value;
      }

      return result;
    });
  };

  const getCSVValue = () => {
    const data = dataAsArray();

    // @ts-expect-error - generateCsv expects a config object
    return generateCsv(csvConfig)(data) as unknown as string;
  };

  const downloadCsv = () => {
    const csvValue = getCSVValue();
    const filename = `data-export-${new Date().toISOString()}.csv`;
    downloadFile(filename, csvValue, "text/csv");
  };

  const copyCsv = () => {
    const csvValue = getCSVValue();
    navigator.clipboard.writeText(csvValue);
    notifySuccess("CSV copied to clipboard");
  };


  const getJson = () => {
    const data = dataAsArray();

    return JSON.stringify(data);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(getJson());
    notifySuccess("JSON copied to clipboard");
  };

  const downloadJson = () => {
    const filename = `data-export-${new Date().toISOString()}.json`;
    downloadFile(filename, getJson(), "application/json");
  };

  return (
    <Stack gap={3} direction="row">
      <MenuRoot lazyMount unmountOnExit>
        <Tooltip
          content={<span>Export</span>}
          showArrow
          positioning={{ placement: "bottom" }}
        >
          <MenuTrigger asChild disabled={isDisabled}>
            <IconButton aria-label="Export" size="2xs" variant="surface">
              <CiExport />
            </IconButton>
          </MenuTrigger>
        </Tooltip>
        <MenuContent>
          <MenuItem value="json-copy" cursor="pointer" onClick={copyJson}>
            <LuClipboardCopy /> Copy JSON
          </MenuItem>
          <MenuItem value="csv-copy" cursor="pointer" onClick={copyCsv}>
            <LuClipboardCopy /> Copy CSV
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            value="json-download"
            cursor="pointer"
            onClick={downloadJson}
          >
            <LuDownload /> Download JSON
          </MenuItem>
          <MenuItem value="csv-download" cursor="pointer" onClick={downloadCsv}>
            <LuDownload /> Download CSV
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <Tooltip
        content={
          <span>
            Copy External Link{" "}
            <Shortcut keys={searcherShortcuts.getAlias("copy-link")} />
          </span>
        }
        showArrow
        positioning={{ placement: "bottom" }}
      >
        <IconButton
          aria-label="Copy Shareable Link"
          size="2xs"
          variant="surface"
          onClick={copyCurrentShareLink}
        >
          <LuLink />
        </IconButton>
      </Tooltip>
      <SettingsDrawer />
    </Stack>
  );
};

export default Header;
