import { css } from "@emotion/react";
import { parse } from "ansicolor";
import { useAtom } from "jotai";
import React, { useMemo } from "react";
import { formatDataTime } from "../common/formatters";
import { ProcessedData } from "../common/logTypes";
import { isIndexOpen, openIndexesAtom } from "./state";

type DataRowProps = {
  row: ProcessedData;
  index: number;
};

const getColorFromObject = (object: ProcessedData["object"], columnName: string) => {
  const level = object[columnName];
  if (typeof level !== "string") {
    return "rgb(44, 175, 0)";
  }

  switch (level) {
    case "error":
      return "rgb(185, 31, 31)";
    case "warn":
      return "rgb(174, 158, 33)";
    default:
      return "rgb(44, 175, 0)";
  }
};

const DataRow: React.FC<DataRowProps> = ({ row, index }) => {
  const [openIndexes, setOpenIndexes] = useAtom(openIndexesAtom);
  const isOpen = useMemo(() => isIndexOpen(index), [index, openIndexes]);

  const setIsOpen = (value: boolean) => {
    if (value) {
      setOpenIndexes((prev) => [...prev, index]);
    } else {
      setOpenIndexes((prev) => prev.filter((i) => i !== index));
    }
  }

  return (
    <div
      css={css`
        display: flex;
        flex-direction: row;
        &:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        & ::selection {
          background-color: rgba(255, 255, 255, 0.5);
        }
      `}
    >
      <div
        css={css`
          width: 6px;
          border-right: 1px solid rgb(49, 54, 63);
          background-color: ${getColorFromObject(row.object, "level")}; // TODO: this needs to be configurable by user
          margin-right: 0.3rem;
        `}
      />
      <div
        css={css`
          display: flex;
          flex-direction: column;
          flex: 1;
        `}
      >
        <div
          onClick={() => setIsOpen(!isOpen)}
          css={css`
            cursor: pointer;
            display: flex;
            flex-direction: row;
          `}
        >
          <div
            css={css`
              width: 160px;
            `}
          >
            {formatDataTime(row.timestamp)}
          </div>
          <div
            css={css`
              flex: 1;
            `}
          >
            {parse(row.message).spans.map((span, spanIndex) => {
              return (
                <span
                  key={`${spanIndex}`}
                  css={css`
                    ${span.css}
                  `}
                >
                  {span.text}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataRow;
