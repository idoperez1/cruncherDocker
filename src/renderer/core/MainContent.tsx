import styled from "@emotion/styled";
import { Provider as JotaiProvider, useAtomValue } from "jotai";
import { Provider } from "~components/ui/provider";
import { Toaster } from "~components/ui/toaster";
import { selectedMenuItemAtom, SideMenu } from "./SideMenu";
import { useMemo } from "react";
import { SearcherWrapper } from "./SearcherWrapper";
import { useControllerInitializer } from "./search";
import { Box, ProgressCircle } from "@chakra-ui/react";
import { useApplicationStore } from "./store/store";
import { WebsocketProvider } from "./websocket_bridge";

const Wrapper = styled.div`
  flex: 1;
  display: flex;
  min-width: 0;
  height: 100%;
  background-color: rgb(17, 18, 23);
`;

const MainContentInner = () => {
  useControllerInitializer();
  const selectedItem = useAtomValue(selectedMenuItemAtom);
  const isInitialized = useApplicationStore((state) => state.isInitialized);

  const component = useMemo(() => {
    switch (selectedItem) {
      case "searcher":
        return <SearcherWrapper />;

      default:
        return "not implemented";
    }
  }, [selectedItem]);

  if (!isInitialized) {
    return (
      <Box
        justifyContent={"center"}
        alignItems="center"
        flex={1}
        display="flex"
      >
        <ProgressCircle.Root value={null} size="lg">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
      </Box>
    );
  }

  return (
    <Wrapper>
      <Toaster />
      <SideMenu />
      {component}
    </Wrapper>
  );
};

const MainContent = () => {
  return (
    <WebsocketProvider>
      <Provider>
        <JotaiProvider>
          <MainContentInner />
        </JotaiProvider>
      </Provider>
    </WebsocketProvider>
  );
};

export default MainContent;
