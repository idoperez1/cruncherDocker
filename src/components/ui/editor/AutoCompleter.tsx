import { Card } from "@chakra-ui/react";
import { css } from "@emotion/react";
import { useEffect, useRef } from "react";

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
        {suggestions.map((suggestion, index) => (
          <span
            css={css`
              padding: 0.2rem 0.6rem;
              ${hoveredItem === index &&
              css`
                background-color: #686;
              `}
            `}
            key={index}
          >
            {suggestion.value}
          </span>
        ))}
      </Card.Body>
    </Card.Root>
  );
};
