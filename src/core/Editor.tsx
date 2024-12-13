import styled from "@emotion/styled";
import { atom } from "jotai";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from 'react-dom';

import { css } from "@emotion/react";
import { IRecognitionException } from "chevrotain";
import { usePopper } from 'react-popper';
import { Coordinates, getCaretCoordinates } from './getCoordinates';
import { allData } from "./qql";
import { HighlightData } from "./qql/grammar";
import { getPopperRoot } from "./shadowUtils";
import { store } from "./state";

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
  highlightData: HighlightData[],
) => {
  const result: (string | HighlightedText)[] = [];

  // sort highlight data by start offset
  highlightData.sort((a, b) => a.token.startOffset - b.token.startOffset);

  let currentIndex = 0;
  highlightData.forEach((data) => {
    const { startOffset, endOffset } = data.token;

    if (!startOffset || !endOffset) {
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
      return {color: "rgb(105, 105, 177)"};

    case "column":
      return {color: "rgb(105, 177, 105)"};

    case "string":
      return {color: "rgb(177, 105, 105)"};
    
    case "function":
      return {color: "rgb(177, 105, 177)"};
    
    case "error":
      return {color: "red", textDecoration: "wavy underline red"};
  }

  return {color: "gray"};
};

const renderChunks = (text: string, highlightData: HighlightData[]) => {
  const render = splitTextToChunks(text, highlightData).map<React.ReactNode>(
    (chunk, index) => {
      if (typeof chunk === "string") {
        return chunk;
      }

      const style = typeToStyle(chunk.type);

      return <span key={index} style={style}>{chunk.value}</span>;
    }
  );

  if (render.length === 0) {
    return text;
  }

  return render.reduce((prev, curr) => [prev, curr]);
};

export const Editor = ({ value, onChange }: EditorProps) => {
  const [referenceElement, setReferenceElement] = React.useState<HTMLTextAreaElement | null>(null);


  const highlightData = useMemo(() => {
    const resp = allData(value);

    console.log("errors", resp.parserError);

    const errorHighlightData = resp.parserError.map((error: IRecognitionException) => {
      return {
        type: "error",
        message: error.message,
        token: {
          startOffset: error.token.startOffset,
          endOffset: error.token.endOffset,
        },
      }
    });
    return [...resp.highlight, ...errorHighlightData];
  }, [value]);

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

  useEffect(() => {
    if (!referenceElement) return;
    store.set(queryEditorAtom, referenceElement);
  }, [referenceElement]);

  const [pos, setPos] = useState<Coordinates>({
    top: 0,
    left: 0,
    height: 0,
  });

  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const [arrowElement, setArrowElement] = useState(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    modifiers: [
      // { name: 'arrow', options: { element: arrowElement } },
      { name: 'offset', options: { offset: [pos.left, -70 + pos.top] }},
    ]});

  const root = getPopperRoot();

  return (
    <EditorWrapper>
      <StyledPre>{renderChunks(textToRender, highlightData)}</StyledPre>
      <TextareaCustom
        value={value}
        ref={setReferenceElement}
        data-enable-grammarly="false"
        style={{
          position: "relative",
        }}
        onChange={(e) => {
          if (!referenceElement) return;

          onChange(e.target.value);
          setPos(getCaretCoordinates(referenceElement, e.currentTarget.selectionStart));
        }}
      />
      {
        root && createPortal(<div  css={css`
          background-color: #686868;
          padding: 0.1rem 0.3rem;
          border-radius: 2px;
          display: flex;
          flex-direction: column;
          font-size: 0.8rem;
          z-index: 1;
        `} ref={setPopperElement} style={styles.popper} {...attributes.popper}>
            <span>Test</span>
            <span>b</span>
        </div>, root)
      }
    </EditorWrapper>
  );
};

