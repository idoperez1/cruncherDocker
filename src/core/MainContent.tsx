import { Tabs } from "@chakra-ui/react";
import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { useEffect, useState } from "react";
import { LuChartArea, LuLogs, LuTable } from "react-icons/lu";
import { Provider } from "~components/ui/provider";
import { QueryProvider } from "./common/interface";
import type { ProcessedData } from "./common/logTypes";
import { DataFormatType } from "./common/queryUtils";
import DataLog from "./events/DataLog";
import Header from "./Header";
import { TableView } from "./table/TableView";
import { Tooltip } from "~components/ui/tooltip";
import { Provider as JotaiProvider } from "jotai";
import { store } from "./state";
import { isDateSelectorOpen } from "./DateSelector";
import { globalShortcuts } from "./keymaps";
import { getCruncherRoot } from "./shadowUtils";

const MainContainer = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: rgb(17, 18, 23);
`;

const useData = () => {
  const [objects, setObjects] = useState<ProcessedData[]>([]);
  const [dataViewModel, setDataViewModel] = useState<DataFormatType>();

  const updateData = (
    objects: ProcessedData[],
    dataViewModel: DataFormatType
  ) => {
    setObjects(objects);
    setDataViewModel(dataViewModel);
  };

  return {
    objects: objects,
    dataViewModel: dataViewModel,
    setData: updateData,
  };
};

type MainContentProps = {
  controller: QueryProvider;
};

const MainContent: React.FC<MainContentProps> = ({ controller }) => {
  const { objects, dataViewModel, setData } = useData();

  const [selectedTab, setSelectedTab] = useState<string | null>("logs");

  const dataType = dataViewModel?.type ?? "events";

  useEffect(() => {
    if (dataType === "events") {
      setSelectedTab("logs");
    } else {
      setSelectedTab("table");
    }
  }, [dataType]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const root = getCruncherRoot();
      if (!root) {
        return;
      }


      if (globalShortcuts.isPressed(e, "select-time")) {
        e.preventDefault();
        store.set(isDateSelectorOpen, (prev) => !prev);
      } else if (globalShortcuts.isPressed(e, "query")) {
        e.preventDefault();
        const queryElem = root.querySelector("#cruncher-search");
        store.set(isDateSelectorOpen, false);
        // required to focus on the input after the tab is changed
        setTimeout(() => queryElem?.focus(), 0);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <Provider>
      <JotaiProvider store={store}>
        <MainContainer id="cruncher-inner-root">
          <Header controller={controller} onDataChange={setData} />
          <Tabs.Root
            lazyMount
            unmountOnExit
            value={selectedTab}
            css={css`
              flex: 1;
              display: flex;
              flex-direction: column;
              min-height: 0;
            `}
            onValueChange={(e) => setSelectedTab(e.value)}
          >
            <Tabs.List zIndex={10}>
              <Tabs.Trigger value="logs">
                <LuLogs /> Logs
              </Tabs.Trigger>
              <Tabs.Trigger
                value="table"
                disabled={
                  dataViewModel?.type === undefined ||
                  dataViewModel.type === "events"
                }
              >
                <LuTable /> Table
              </Tabs.Trigger>
              <Tooltip content="TBD Not Implemented yet">
                <Tabs.Trigger value="view" disabled={true}>
                  <LuChartArea /> View
                </Tabs.Trigger>
              </Tooltip>
            </Tabs.List>
            <Tabs.Content
              value="logs"
              minH="0"
              flex={1}
              display={"flex"}
              flexDirection={"column"}
            >
              <DataLog logs={objects} />
            </Tabs.Content>
            <Tabs.Content
              value="table"
              minH="0"
              flex={1}
              display={"flex"}
              flexDirection={"column"}
            >
              {dataViewModel?.type === "table" && (
                <TableView
                  columns={dataViewModel.columns}
                  dataPoints={dataViewModel.dataPoints}
                />
              )}
            </Tabs.Content>
          </Tabs.Root>
          <div id="cruncher-popovers" css={css`z-index: 11;`}></div>
        </MainContainer>
      </JotaiProvider>
    </Provider>
  );
};

export default MainContent;
