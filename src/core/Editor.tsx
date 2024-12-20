import { atom, useAtomValue, useSetAtom } from "jotai";
import {
  availableColumnsAtom,
  availableControllerParamsAtom,
  queryDataAtom,
} from "./store/queryState";
import { useMemo } from "react";
import { IRecognitionException } from "chevrotain";
import { Suggestion } from "~components/ui/editor/AutoCompleter";
import { Editor as EditorComponent } from "~components/ui/editor/Editor";
import { getPopperRoot } from "./shadowUtils";
import { SUPPORTED_AGG_FUNCTIONS as SUPPORTED_AGG_FUNCTIONS } from "./pipelineEngine/stats";
import { SUPPORTED_BOOLEAN_FUNCTIONS } from "./pipelineEngine/logicalExpression";

export const queryEditorAtom = atom<HTMLTextAreaElement | null>(null);

export type EditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export const Editor = ({ value, onChange }: EditorProps) => {
  const availableColumns = useAtomValue(availableColumnsAtom);
  const data = useAtomValue(queryDataAtom);
  const setQueryEditor = useSetAtom(queryEditorAtom);
  const availableControllerParams = useAtomValue(availableControllerParamsAtom);
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

  const suggestions = useMemo(() => {
    const results: Suggestion[] = [];
    for (const suggestion of data.suggestions ?? []) {
      switch (suggestion.type) {
        case "params":
          results.push(
            ...suggestion.keywords.map(
              (keyword) =>
                ({
                  type: "param",
                  value: keyword,
                  fromPosition: suggestion.fromPosition,
                  toPosition: suggestion.toPosition,
                }) satisfies Suggestion
            )
          );
          break;
        case "keywords":
          results.push(
            ...suggestion.keywords.map(
              (keyword) =>
                ({
                  type: "keyword",
                  value: keyword,
                  fromPosition: suggestion.fromPosition,
                  toPosition: suggestion.toPosition,
                }) satisfies Suggestion
            )
          );
          break;
        case "column":
          availableColumns.forEach((column) =>
            results.push({
              type: "variable",
              value: column,
              fromPosition: suggestion.fromPosition,
              toPosition: suggestion.toPosition,
            })
          );
          break;
        case "function":
          SUPPORTED_AGG_FUNCTIONS.forEach((func) =>
            results.push({
              type: "function",
              value: func,
              fromPosition: suggestion.fromPosition,
              toPosition: suggestion.toPosition,
            })
          );
          break;
        case "booleanFunction":
          SUPPORTED_BOOLEAN_FUNCTIONS.forEach((func) =>
            results.push({
              type: "function",
              value: func,
              fromPosition: suggestion.fromPosition,
              toPosition: suggestion.toPosition,
            })
          );
          break;
        case "controllerParam":
          Object.keys(availableControllerParams).forEach((param) =>
            results.push({
              type: "param",
              value: param,
              fromPosition: suggestion.fromPosition,
              toPosition: suggestion.toPosition,
            })
          );
          break;
        case "paramValue":
          const paramValues = availableControllerParams[suggestion.key];
          if (!paramValues) {
            continue;
          }

          paramValues.forEach((value) =>
            results.push({
              type: "variable",
              value: value,
              fromPosition: suggestion.fromPosition,
              toPosition: suggestion.toPosition,
            })
          );
          break;
      }
    }
    return results;
  }, [data]);

  const popperRoot = getPopperRoot();

  return (
    <EditorComponent
      popperRoot={popperRoot}
      ref={setQueryEditor}
      value={value}
      onChange={onChange}
      highlightData={highlightData}
      suggestions={suggestions}
    />
  );
};
