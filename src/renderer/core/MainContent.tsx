import styled from "@emotion/styled";
import { Provider as JotaiProvider, useAtomValue } from "jotai";
import { Provider } from "~components/ui/provider";
import { store } from "./store/store";
import { Toaster } from "~components/ui/toaster";
import { selectedMenuItemAtom, SideMenu } from "./SideMenu";
import { Searcher } from "./Searcher";
import { useMemo } from "react";

const Wrapper = styled.div`
  flex: 1;
  display: flex;
  min-width: 0;
`;

const MainContentInner = () => {
  const selectedItem = useAtomValue(selectedMenuItemAtom);

  const component = useMemo(() => {
    switch (selectedItem) {
      case "searcher":
        return <Searcher />;

      default:
        return "not implemented";
    }
  }, [selectedItem]);

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
    <Provider>
      <JotaiProvider store={store}>
        <MainContentInner />
      </JotaiProvider>
    </Provider>
  );
};

export default MainContent;
