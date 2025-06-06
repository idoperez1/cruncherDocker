import { Box, Button, IconButton } from "@chakra-ui/react";
import { atom, createStore, Provider, useAtom } from "jotai";
import { VscClose } from "react-icons/vsc";
import { UrlNavigationSchema } from "src/plugins_engine/protocol_out";
import { v4 as uuidv4 } from "uuid";
import { parseDate } from "~lib/dateUtils";
import { createSignal } from "~lib/utils";
import { Searcher, SearcherProps } from "./Searcher";
import {
  globalShortcuts,
  useShortcuts
} from "./keymaps";
import { useMessageEvent } from "./search";

const createNewTab = (props: Omit<SearcherProps, "readySignal">) => {
  return {
    store: createStore(),
    label: "New Search",
    props: props,
    key: uuidv4(),
    readySignal: createSignal<() => void>(),
  };
};

type Tab = {
  store: ReturnType<typeof createStore>;
  label: string;
  props: Omit<SearcherProps, "readySignal">;
  key: string;
  readySignal: ReturnType<typeof createSignal<() => void>>;
};

const tabsAtom = atom<Tab[]>([createNewTab({})]);
const selectedAtom = atom(0);

export const useTabs = () => {
  const [tabs, setTabs] = useAtom(tabsAtom);
  const [selectedTab, setSelectedTab] = useAtom(selectedAtom);

  const addTab = (props: Omit<SearcherProps, "readySignal">) => {
    const createdTab = createNewTab(props);
    setTabs((prev) => [...prev, createdTab]);

    return {
      index: tabs.length,
      createdTab: createdTab,
    };
  };

  const getNextAvailableTab = (tabIndex: number) => {
    if (tabIndex === 0) {
      if (tabs.length === 1) {
        throw new Error("No next tab available, only one tab exists");
      }

      const nextTab = tabs[1];
      return nextTab;
    }

    const nextTab = tabs[tabIndex - 1];
    if (!nextTab) {
      throw new Error(`No next tab available for index ${tabIndex}`);
    }

    return nextTab;
  };

  const removeTab = (key: string) => {
    if (tabs.length === 1) {
      console.warn("Cannot remove the last tab, at least one tab must remain");
      return;
    }

    const selectedTabInfo = tabs[selectedTab];
    const originalTabIndex = tabs.findIndex((tab) => tab.key === key);
    if (originalTabIndex === -1) {
      console.warn(`Tab with key ${key} not found, cannot remove`);
      return;
    }

    const newTabs = tabs.filter((tab) => tab.key !== key);

    setTabs(newTabs);
    if (selectedTab === originalTabIndex) {
      const tab = getNextAvailableTab(originalTabIndex);
      const tabIndex = newTabs.findIndex((t) => t.key === tab.key);
      setSelectedTab(tabIndex);
    } else {
      const newSelectedIndex = newTabs.findIndex(
        (tab) => tab.key === selectedTabInfo.key
      );
      setSelectedTab(newSelectedIndex);
    }
  };

  return { tabs, addTab, removeTab, selectedTab, setSelectedTab };
};

export const SearcherWrapper = () => {
  // TODO: Implement tab selection logic
  const { tabs, addTab, removeTab, selectedTab, setSelectedTab } = useTabs();

  useMessageEvent(UrlNavigationSchema, {
    callback: async (urlNavigationMessage) => {
      console.log("URL Navigation message received:", urlNavigationMessage);

      const parsedUrl = new URL(urlNavigationMessage.payload.url);

      const startFullDate = parsedUrl.searchParams.get("startTime");
      const endFullDate = parsedUrl.searchParams.get("endTime");
      const searchQuery = parsedUrl.searchParams.get("searchQuery");
      const initialStartTime = parseDate(startFullDate) ?? undefined;
      const initialEndTime = parseDate(endFullDate) ?? undefined;
      const initialQuery = searchQuery || "";

      console.log("Parsed URL parameters:", {
        startFullDate: initialStartTime,
        endFullDate: initialEndTime,
        searchQuery: initialQuery,
      });

      // create new tab
      const createdTab = addTab({
        initialQuery: {
          startFullDate: initialStartTime,
          endFullDate: initialEndTime,
          searchQuery: initialQuery,
        },
      });
      setSelectedTab(createdTab.index);
      const runQuery = await createdTab.createdTab.readySignal.wait();
      runQuery();
    },
  });

  useShortcuts(globalShortcuts, (shortcut) => {
    switch (shortcut) {
      case "create-new-tab": {
        const created = addTab({});
        setSelectedTab(created.index);
        break;
      }
      case "close-tab":
        if (tabs.length > 1) {
          removeTab(tabs[selectedTab].key);
        }
        break;
    }
  });

  const selectedTabInfo = tabs[selectedTab];

  return (
    <Box flex={1} display="flex" flexDirection="column">
      <Box>
        {tabs.map((tab, index) => (
          <Button
            key={tab.key}
            marginRight={2}
            marginBottom={2}
            variant="surface"
            color={selectedTab === index ? "white" : "gray"}
            margin={0}
            alignItems="center"
            lineHeight={1}
            borderRadius={0}
            borderTop={
              selectedTab === index
                ? "4px solid #3182ce"
                : "4px solid transparent"
            }
            onClick={() => setSelectedTab(index)}
          >
            <span>{tab.label}</span>
            {/* show only on hover */}
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation(); // prevent the button click from selecting the tab
                removeTab(tab.key);
              }}
            >
              <VscClose />
            </IconButton>
            {/* <IconButton
              size="2xs"
              variant="ghost"
              onClick={() => {
                removeTab(index);
                if (selectedTab === index) {
                  setSelectedTab(0); // switch to the first tab if the current one is closed
                }
              }}
            >
              <span aria-label="Close tab">×</span>
            </IconButton> */}
          </Button>
          // <Button
          //   key={index}
          //   onClick={() => setSelectedTab(index)}
          //   variant={selectedTab === index ? "solid" : "outline"}
          // >
          //   {tab.label} {selectedTab === index && " (active)"}
          // </Button>
        ))}
      </Box>
      {selectedTabInfo && (
        <Provider store={selectedTabInfo.store}>
          <Searcher
            key={selectedTabInfo.key}
            {...selectedTabInfo.props}
            readySignal={selectedTabInfo.readySignal}
          />
        </Provider>
      )}
    </Box>
  );
};
