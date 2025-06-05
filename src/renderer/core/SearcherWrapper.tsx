import { useState } from "react";
import { Searcher } from "./Searcher";
import { Box } from "@chakra-ui/react";

export const SearcherWrapper = () => {
  // TODO: Implement tab selection logic
  const [selectedTab, setSelectedTab] = useState<number>(0);

  return (
    <Box flex={1} display="flex" flexDirection="column">
      <Searcher key={0}/>
    </Box>
  );
};
