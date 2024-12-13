import styled from "@emotion/styled";
import { atom, useAtomValue } from "jotai";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { css } from "@emotion/react";
import { IRecognitionException } from "chevrotain";
import { usePopper } from "react-popper";
import { SUPPORTED_FUNCTIONS } from "./common/queryUtils";
import { Coordinates, getCaretCoordinates } from "./getCoordinates";
import { HighlightData } from "./qql/grammar";
import { getPopperRoot } from "./shadowUtils";
import { queryDataAtom, store, availableColumnsAtom } from "./state";
import { set } from "date-fns";
import { MenuContent, MenuItem } from "~components/ui/menu";
import { Card } from "@chakra-ui/react";

export const queryEditorAtom = atom<HTMLTextAreaElement>();

const StyledPre = styled.pre`
  /* background-color: #f8f8f8; */
`;

const EditorWrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  gap: 0;
  min-height: 100px;

  & pre,
  & textarea {
    grid-area: 1 / 1 / 2 / 2;
    overflow: hidden;
    white-space: pre-wrap; /* Allows textarea to scroll horizontally */

    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      "system-ui",
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      "Noto Sans",
      sans-serif,
      "Apple Color Emoji",
      "Segoe UI Emoji",
      "Segoe UI Symbol",
      "Noto Color Emoji";
    border: 1px solid #d2d6dc;
    word-spacing: 0;
    letter-spacing: normal;
    /* font-size: 14px; */
    outline: 0;
    padding: 8px;
    -webkit-appearance: none;
    -moz-appearance: none;
    -ms-appearance: none;
    appearance: none;
    text-align: start;
    border-radius: var(--chakra-radii-l2);
    --focus-color: var(--chakra-colors-color-palette-focus-ring);
    --error-color: var(--chakra-colors-border-error);
    font-size: var(--chakra-font-sizes-md);
    line-height: 1.25rem;
    scroll-padding-bottom: var(--chakra-spacing-2);
    background: var(--chakra-colors-transparent);
    --bg-currentcolor: var(--chakra-colors-transparent);
    border-width: 1px;
    border-color: var(--chakra-colors-border);
    --focus-ring-color: var(--chakra-colors-color-palette-focus-ring);
  }
`;

const TextareaCustom = styled.textarea`
  color: transparent;
  resize: none;

  width: 100%;
  min-width: 0;
  position: relative;

  background-color: transparent;
  border: none;
  caret-color: #fff;

  &:focus-visible {
    outline-offset: 0px;
    outline-width: var(--focus-ring-width, 1px);
    outline-color: var(--focus-ring-color);
    outline-style: var(--focus-ring-style, solid);
    border-color: var(--focus-ring-color);
  }
`;

export type EditorProps = {
  value: string;
  onChange: (value: string) => void;
};

type HighlightedText = {
  type: string;
  value: string;
};

export const splitTextToChunks = (
  text: string,
  highlightData: HighlightData[]
) => {
  const result: (string | HighlightedText)[] = [];

  // sort highlight data by start offset
  highlightData.sort((a, b) => a.token.startOffset - b.token.startOffset);

  let currentIndex = 0;
  highlightData.forEach((data) => {
    const { startOffset, endOffset } = data.token;

    if (
      startOffset === undefined ||
      Number.isNaN(startOffset) ||
      endOffset === undefined ||
      Number.isNaN(endOffset)
    ) {
      return;
    }

    // Add the text before the token (if any)
    if (currentIndex < startOffset) {
      result.push(text.slice(currentIndex, startOffset));
    }

    // Add the token text
    result.push({
      type: data.type,
      value: text.slice(startOffset, (endOffset ?? startOffset) + 1),
    });

    // Update the current index to the end of the token
    currentIndex = (endOffset ?? startOffset) + 1;
  });

  // Add any remaining text after the last token
  if (currentIndex < text.length) {
    result.push(text.slice(currentIndex));
  }

  return result;
};

const typeToStyle = (type: string) => {
  switch (type) {
    case "keyword":
      return { color: "rgb(105, 105, 177)" };

    case "column":
      return { color: "rgb(105, 177, 105)" };

    case "string":
      return { color: "rgb(177, 105, 105)" };

    case "function":
      return { color: "rgb(177, 105, 177)" };

    case "error":
      return { color: "red", textDecoration: "wavy underline red" };
  }

  return { color: "gray" };
};

const renderChunks = (text: string, highlightData: HighlightData[]) => {
  const render = splitTextToChunks(text, highlightData).map<React.ReactNode>(
    (chunk, index) => {
      if (typeof chunk === "string") {
        return chunk;
      }

      const style = typeToStyle(chunk.type);

      return (
        <span key={index} style={style}>
          {chunk.value}
        </span>
      );
    }
  );

  if (render.length === 0) {
    return text;
  }

  return render.reduce((prev, curr) => [prev, curr]);
};

export const Editor = ({ value, onChange }: EditorProps) => {
  const [referenceElement, setReferenceElement] =
    React.useState<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!referenceElement) return;
    store.set(queryEditorAtom, referenceElement);
  }, [referenceElement]);

  const [pos, setPos] = useState<Coordinates>({
    top: 0,
    left: 0,
    height: 0,
  });

  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom-start",
    modifiers: [
      { name: "offset", options: { offset: [pos.left, -70 + pos.top] } },
    ],
  });

  const root = getPopperRoot();

  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [isCompleterOpen, setIsCompleterOpen] = useState(false);

  const [hoveredCompletionItem, setHoveredCompletionItem] = useState<number>(0);

  const writtenWord = useMemo(() => {
    const text = value.slice(0, cursorPosition);
    const lastSpace = text.lastIndexOf(" ");
    let word = text.slice(lastSpace + 1, cursorPosition);
    // trim everything before special characters [a-zA-Z0-9_]
    const specialCharIndex = word.search(/[^a-zA-Z0-9_]/);
    if (specialCharIndex !== -1) {
      word = word.slice(specialCharIndex + 1);
    }

    return word;
  }, [cursorPosition, value]);

  const availableColumns = useAtomValue(availableColumnsAtom);
  const data = useAtomValue(queryDataAtom);

  const suggestions = useMemo(() => {
    const results = new Set<string>();
    for (const suggestion of data.suggestions) {
      // filter suggestions based on cursor position
      if (cursorPosition < suggestion.fromPosition) continue;
      if (suggestion.toPosition && cursorPosition > suggestion.toPosition)
        continue;

      switch (suggestion.type) {
        case "keywords":
          suggestion.keywords.forEach((keyword) => results.add(keyword));
          break;
        case "column":
          availableColumns.forEach((column) => results.add(column));
          break;
        case "function":
          SUPPORTED_FUNCTIONS.forEach((func) => results.add(func));
          break;
      }
    }

    return Array.from(results).filter((suggestion) =>
      writtenWord ? suggestion.startsWith(writtenWord) : true
    );
  }, [data, cursorPosition, availableColumns, writtenWord]);

  const acceptCompletion = () => {
    onChange(
      value.slice(0, cursorPosition - writtenWord.length) +
        suggestions[hoveredCompletionItem] +
        value.slice(cursorPosition)
    );
    setIsCompleterOpen(false);
  };

  const advanceHoveredItem = () => {
    setHoveredCompletionItem((prev) => {
      if (prev === suggestions.length - 1) {
        return 0;
      }

      return prev + 1;
    });
  };

  const retreatHoveredItem = () => {
    setHoveredCompletionItem((prev) => {
      if (prev === 0) {
        return suggestions.length - 1;
      }

      return prev - 1;
    });
  };

  return (
    <EditorWrapper>
      <TextHighlighter value={value} />
      <TextareaCustom
        value={value}
        ref={setReferenceElement}
        data-enable-grammarly="false"
        style={{
          position: "relative",
        }}
        onKeyDown={(e) => {
          // if key is esc - close completer
          if (e.key === "Escape") {
            setIsCompleterOpen(false);
          }
          if (e.key === " " && e.ctrlKey) {
            setIsCompleterOpen(true);
          }

          if (isCompleterOpen) {
            // if open and down arrow - move selection down
            if (e.key === "ArrowDown") {
              e.preventDefault();
              advanceHoveredItem();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              retreatHoveredItem();
            }

            if (e.key === "Enter" && suggestions.length > 0) {
              e.preventDefault();
              acceptCompletion();
            }

            if (e.key === "Tab" && e.shiftKey && suggestions.length > 0) {
              e.preventDefault();
              retreatHoveredItem();
            } else if (e.key == "Tab" && suggestions.length > 0) {
              e.preventDefault();
              advanceHoveredItem();
            }
          }

          setCursorPosition(e.currentTarget.selectionStart);
        }}
        onChange={(e) => {
          if (!referenceElement) return;

          onChange(e.target.value);
          setCursorPosition(e.currentTarget.selectionStart);
          setIsCompleterOpen(true);
          setHoveredCompletionItem(0);
          setPos(
            getCaretCoordinates(
              referenceElement,
              e.currentTarget.selectionStart
            )
          );
        }}
      />
      {isCompleterOpen &&
        root &&
        createPortal(
          <div
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
          >
            <AutoCompleter
              suggestions={suggestions}
              hoveredItem={hoveredCompletionItem}
            />
          </div>,
          root
        )}
    </EditorWrapper>
  );
};

export type HighlighterProps = {
  value: string;
};

export const TextHighlighter = ({ value }: HighlighterProps) => {
  const data = useAtomValue(queryDataAtom);

  const highlightData = useMemo(() => {
    const errorHighlightData = data.parserError.map(
      (error: IRecognitionException) => {
        return {
          type: "error",
          message: error.message,
          token: {
            startOffset: error.token.startOffset,
            endOffset: error.token.endOffset,
          },
        };
      }
    );
    return [...data.highlight, ...errorHighlightData];
  }, [data]);

  const textToRender = useMemo(() => {
    let text = value;
    if (text[text.length - 1] == "\n") {
      // If the last character is a newline character
      text += " "; // Add a placeholder space character to the final line
    }
    // Update code
    return text
      .replace(new RegExp("&", "g"), "&")
      .replace(new RegExp("<", "g"), "<"); /* Global RegExp */
  }, [value]);

  return <StyledPre>{renderChunks(textToRender, highlightData)}</StyledPre>;
};

export type AutoCompleterProps = {
  suggestions: string[];
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
            {suggestion}
          </span>
        ))}
      </Card.Body>
    </Card.Root>
  );
};
