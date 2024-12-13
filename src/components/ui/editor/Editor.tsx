import styled from "@emotion/styled";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { usePopper } from "react-popper";
import { AutoCompleter, Suggestion } from "./AutoCompleter";
import { HighlightData, TextHighlighter } from "./Highlighter";
import { Coordinates, getCaretCoordinates } from "./getCoordinates";

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
  suggestions: Suggestion[];
  highlightData: HighlightData[];
  popperRoot: Element | undefined | null;
};

export const Editor = React.forwardRef<HTMLTextAreaElement, EditorProps>(({ value, onChange, suggestions, popperRoot, highlightData }, ref) => {
  const [referenceElement, setReferenceElement] =
    React.useState<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!referenceElement || !ref) return;

    if (typeof ref === "function") {
      ref(referenceElement);
    } else {
      ref.current = referenceElement;
    }
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

  const filteredSuggestions = useMemo(() => {
    const results = new Set<Suggestion>();
    for (const suggestion of suggestions) {
      // filter suggestions based on cursor position
      if (cursorPosition < suggestion.fromPosition) continue;
      if (suggestion.toPosition && cursorPosition > suggestion.toPosition)
        continue;

      results.add(suggestion);
    }

    return Array.from(results).filter((suggestion) =>
      writtenWord ? suggestion.value.startsWith(writtenWord) : true
    );
  }, [suggestions, cursorPosition, writtenWord]);

  const acceptCompletion = () => {
    onChange(
      value.slice(0, cursorPosition - writtenWord.length) +
        filteredSuggestions[hoveredCompletionItem].value +
        value.slice(cursorPosition)
    );
    setIsCompleterOpen(false);
  };

  const advanceHoveredItem = () => {
    setHoveredCompletionItem((prev) => {
      if (prev === filteredSuggestions.length - 1) {
        return 0;
      }

      return prev + 1;
    });
  };

  const retreatHoveredItem = () => {
    setHoveredCompletionItem((prev) => {
      if (prev === 0) {
        return filteredSuggestions.length - 1;
      }

      return prev - 1;
    });
  };

  return (
    <EditorWrapper>
      <TextHighlighter value={value} highlightData={highlightData}/>
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

          if (isCompleterOpen && filteredSuggestions.length > 0) {
            // if open and down arrow - move selection down
            if (e.key === "ArrowDown") {
              e.preventDefault();
              advanceHoveredItem();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              retreatHoveredItem();
            }

            if (e.key === "Enter") {
              e.preventDefault();
              acceptCompletion();
            }

            if (e.key === "Tab") {
              e.preventDefault();
              retreatHoveredItem();
            } else if (e.key == "Tab") {
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
        popperRoot &&
        createPortal(
          <div
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
          >
            <AutoCompleter
              suggestions={filteredSuggestions}
              hoveredItem={hoveredCompletionItem}
            />
          </div>,
          popperRoot
        )}
    </EditorWrapper>
  );
});

