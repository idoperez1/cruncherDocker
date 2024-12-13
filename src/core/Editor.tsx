import styled from "@emotion/styled";
import { atom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
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

const keywords = ["hey", "hello"];

const splitToAtoms = (text: string) => {
  const atoms = text.split(" ");
  const render = atoms.map<React.ReactNode>((atom) => {
    if (keywords.includes(atom)) {
      return <span style={{ color: "red" }}>{atom}</span>;
    }
    return atom;
  });

  return render.reduce((prev, curr) => [prev, ' ', curr]);
};

export const Editor = ({ value, onChange }: EditorProps) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);

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
    if (!editorRef.current) return;
    store.set(queryEditorAtom, editorRef.current);
  }, [editorRef]);

  return (
    <EditorWrapper>
      <StyledPre>{splitToAtoms(textToRender)}</StyledPre>
      <TextareaCustom
        value={value}
        ref={editorRef}
        data-enable-grammarly="false"
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </EditorWrapper>
  );
};
