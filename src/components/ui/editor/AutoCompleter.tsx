import { Card } from "@chakra-ui/react";
import { css } from "@emotion/react";
import { useEffect, useRef } from "react";
import { AiOutlineFunction } from "react-icons/ai";
import { VscSymbolKeyword, VscSymbolParameter, VscSymbolVariable } from "react-icons/vsc";

export type Suggestion = {
  type: "keyword" | "function" | "variable" | "param";
  value: string;
  fromPosition: number;
  toPosition?: number;
};

export type AutoCompleterProps = {
  suggestions: Suggestion[];
  hoveredItem?: number;
};

const getSuggestionIcon = (suggestion: Suggestion) => {
  switch (suggestion.type) {
    case "keyword":
      return <VscSymbolKeyword />;
    case "function":
      return <AiOutlineFunction />;
    case "variable":
      return <VscSymbolVariable />;
    case "param":
      return <VscSymbolParameter />;
  }
}

export const AutoCompleter = ({
  suggestions,
  hoveredItem,
}: AutoCompleterProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // scroll to hovered item
  useEffect(() => {
    if (!scrollerRef.current || hoveredItem === undefined) return;

    const element = scrollerRef.current.children[hoveredItem];
    if (!element) return;
    element.scrollIntoView();
  }, [hoveredItem]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card.Root width="200px" overflow="hidden" zIndex={1}>
      <Card.Body
        ref={scrollerRef}
        padding="0"
        fontSize="sm"
        lineHeight={1}
        overflow="auto"
        maxH={100}
      >
        {suggestions.sort((a, b) => {
          // keyword should be shown first then functions
          if (a.type === "keyword" && b.type !== "keyword") {
            return -1;
          }
          if (a.type !== "keyword" && b.type === "keyword") {
            return 1;
          }

          if (a.type === "function" && b.type !== "function") {
            return -1;
          }
          if (a.type !== "function" && b.type === "function") {
            return 1;
          }

          return 0;
        }).map((suggestion, index) => (
          <span
            css={css`
              padding: 0.2rem 0.6rem;
              display: flex;
              gap: 5px;
              ${hoveredItem === index &&
              css`
                background-color: #686;
              `}
            `}
            key={index}
          >
            {getSuggestionIcon(suggestion)}
            {suggestion.value}
          </span>
        ))}
      </Card.Body>
    </Card.Root>
  );
};
