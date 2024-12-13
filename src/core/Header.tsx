import styled from "@emotion/styled";
import type React from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { ProgressBar, ProgressRoot } from "~components/ui/progress";

import { css } from "@emotion/react";
import { Badge, IconButton, Stack } from "@chakra-ui/react";
import { Mutex } from "async-mutex";
import { useAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuSearch, LuSearchCode } from "react-icons/lu";
import { Shortcut } from "~components/ui/shortcut";
import { Tooltip } from "~components/ui/tooltip";
import { parse } from "~core/qql";
import { QueryProvider } from "./common/interface";
import { ProcessedData } from "./common/logTypes";
import { DataFormatType, getPipelineItems } from "./common/queryUtils";
import { DateSelector, isDateSelectorOpen } from "./DateSelector";
import {
  compareFullDates,
  endFullDateAtom,
  FullDate,
  isTimeNow,
  startFullDateAtom,
} from "./dateState";
import { headerShortcuts } from "./keymaps";
import { searchQuery, store } from "./state";
import {Editor} from "~core/Editor.tsx";

const StyledHeader = styled.form`
  display: flex;
  gap: 0.4rem;
  flex-direction: row;
  padding: 0.3rem;
`;

const QueryContainer = styled.div`
  position: relative;
  flex: 1;
  display: flex;
`;

const ButtonsHolder = styled.div`
  display: flex;
`;

const LoaderHolder = styled.div`
  display: flex;
  flex-direction: column;
  /* padding: 0 0.9rem; */
  height: 5px;
`;

type HeaderProps = {
  onDataChange: (data: ProcessedData[], currentView: DataFormatType) => void;
  controller: QueryProvider;
};

type FormValues = {
  searchTerm: string;
  fromTime: FullDate | undefined;
  toTime: FullDate | undefined;
};

type QueryExecutionHistory = {
  search: string[];
  start: FullDate;
  end: FullDate;
};

const Header: React.FC<HeaderProps> = ({ controller, onDataChange }) => {
  const [isLoading, setIsLoading] = useState(false);

  const [lastExecutedQuery, setLastExecutedQuery] =
    useState<QueryExecutionHistory>();
  const [cachedData, setCachedData] = useState<ProcessedData[]>([]);

  const [selectedStartDate] = useAtom(startFullDateAtom);
  const [selectedEndDate] = useAtom(endFullDateAtom);

  const abortController = useRef(new AbortController());
  const submitMutex = useRef(new Mutex());

  const [queryStartTime, setQueryStartTime] = useState<Date>();
  const [queryEndTime, setQueryEndTime] = useState<Date>();

  const compareQueries = (query1: string[], query2: string[]) => {
    if (query1.length !== query2.length) {
      return false;
    }

    for (let i = 0; i < query1.length; i++) {
      if (query1[i] !== query2[i]) {
        return false;
      }
    }

    return true;
  };

  const compareExecutions = (
    exec1: QueryExecutionHistory,
    exec2: QueryExecutionHistory | undefined
  ) => {
    if (exec2 === undefined) {
      return false;
    }

    if (!compareQueries(exec1.search, exec2.search)) {
      return false;
    }

    if (compareFullDates(exec1.start, exec2.start) !== 0) {
      return false;
    }

    if (compareFullDates(exec1.end, exec2.end) !== 0) {
      return false;
    }

    return true;
  };

  const [searchValue, setSearchValue] = useAtom(searchQuery);
  const [isQuerySuccess, setIsQuerySuccess] = useState(true);

  const { register, handleSubmit } = useForm<FormValues>({
    values: {
      searchTerm: searchValue,
      fromTime: selectedStartDate,
      toTime: selectedEndDate,
    },
  });

  const doSubmit = async (values: FormValues, isForced: boolean) => {
    if (values.fromTime === undefined) {
      // TODO: return error
      return;
    }

    if (values.toTime === undefined) {
      // TODO: return error
      return;
    }

    const fromTime = isTimeNow(values.fromTime) ? new Date() : values.fromTime;
    const toTime = isTimeNow(values.toTime) ? new Date() : values.toTime;

    if (fromTime.getTime() > toTime.getTime()) {
      // TODO: return error
      return;
    }

    const parsedTree = parse(values.searchTerm);
    let dataForPipelines: ProcessedData[] = [];
    const cancelToken = abortController.current.signal;
    try {
      setIsLoading(true);
      setQueryStartTime(new Date());
      setQueryEndTime(undefined);

      const executionQuery = {
        search: parsedTree.search,
        start: fromTime,
        end: toTime,
      };

      if (!isForced && compareExecutions(executionQuery, lastExecutedQuery)) {
        console.log("using cached data");
        dataForPipelines = cachedData;
      } else {
        try {
          dataForPipelines = await controller.query(parsedTree.search, {
            fromTime: fromTime,
            toTime: toTime,
            cancelToken: cancelToken,
          });
          setLastExecutedQuery(executionQuery);

          setCachedData(dataForPipelines);
          setIsQuerySuccess(true);
        } catch (error) {
          if (cancelToken.aborted) {
            return; // don't continue if the request was aborted
          }

          console.error("Error executing query: ", error);
          setIsQuerySuccess(false);
          throw error;
        }
      }

      console.log(parsedTree);

      const finalData = getPipelineItems(dataForPipelines, parsedTree.pipeline);
      console.log(finalData);

      onDataChange(dataForPipelines, finalData);
    } finally {
      setIsLoading(false);
      setQueryEndTime(new Date());
    }
  };

  const onSubmit =
    (isForced: boolean): SubmitHandler<FormValues> =>
    async (values) => {
      if (isLoading) {
        abortController.current.abort("New query submitted");

        // reset abort controller
        abortController.current = new AbortController();
      }

      await submitMutex.current.runExclusive(async () => {
        await doSubmit(values, isForced);
      });
    };

  const onHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (headerShortcuts.isPressed(e, "search")) {
      e.preventDefault();
      store.set(isDateSelectorOpen, false);
      handleSubmit(onSubmit(true))();
    } else if (headerShortcuts.isPressed(e, "re-evaluate")) {
      e.preventDefault();
      store.set(isDateSelectorOpen, false);
      handleSubmit(onSubmit(false))();
    }
  };

  const loaderValue = isLoading ? null : 100;
  const loaderColor = useMemo(() => {
    if (isLoading) {
      return "gray" as const;
    }

    if (isQuerySuccess) {
      return "green" as const;
    }

    return "red" as const;
  }, [isLoading, isQuerySuccess]);

  return (
    <>
      <LoaderHolder>
        <ProgressRoot
          value={loaderValue}
          variant="subtle"
          size="xs"
          colorPalette={loaderColor}
        >
          <ProgressBar />
        </ProgressRoot>
      </LoaderHolder>
      <StyledHeader
        onSubmit={handleSubmit(onSubmit(false))}
        onKeyDown={onHeaderKeyDown}
      >
        <QueryContainer>
          <div css={css`
              flex: 1;
          `}>
            <Editor value={searchValue} onChange={setSearchValue}/>
          </div>
          {/*<Textarea*/}
          {/*  id="cruncher-search"*/}
          {/*  size="xl"*/}
          {/*  height={120}*/}
          {/*  placeholder="Query..."*/}
          {/*  {...register("searchTerm", {*/}
          {/*    onChange: (e) => {*/}
          {/*      setSearchValue(e.target.value);*/}
          {/*    },*/}
          {/*  })}*/}
          {/*/>*/}
          <Timer
            startTime={queryStartTime}
            endTime={queryEndTime}
            isLoading={isLoading}
          />
        </QueryContainer>
        <SearchBarButtons
          isLoading={isLoading}
          onForceSubmit={() => handleSubmit(onSubmit(true))()}
        />
      </StyledHeader>
    </>
  );
};

const TimerHolder = styled.div`
  display: flex;
  position: absolute;
  right: 0.4rem;
  top: 0.4rem;
`;

type TimerProps = {
  startTime: Date | undefined;
  endTime: Date | undefined;
  isLoading: boolean;
};

const CustomBadge = styled(Badge)`
  font-family: monospace;
  justify-content: center;
`;

const Timer = ({ startTime, endTime, isLoading }: TimerProps) => {
  // if loading render elapsed time from startTime
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    setElapsedTime(0);
  }, [startTime]);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setElapsedTime((prev) => prev + 10);
      }, 10);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <TimerHolder>
        <CustomBadge>{formatElapsedTime(elapsedTime)}</CustomBadge>
      </TimerHolder>
    );
  }

  if (endTime === undefined || startTime === undefined) {
    return <TimerHolder></TimerHolder>;
  }

  return (
    <TimerHolder>
      <CustomBadge>{formatRange(startTime, endTime)}</CustomBadge>
    </TimerHolder>
  );
};

const formatRange = (start: Date, end: Date) => {
  const elapsedMilliseconds = Math.abs(end.getTime() - start.getTime());
  return formatElapsedTime(elapsedMilliseconds);
};


const formatElapsedTime = (elapsedMilliseconds: number) => {
  if (elapsedMilliseconds < 1000) {
    // if less than 1 second - show milliseconds
    return `${elapsedMilliseconds}ms`;
  }

  if (elapsedMilliseconds < 10000) {
    // if less than 10 seconds - show not rounded
    return `${(elapsedMilliseconds / 1000).toFixed(2)}s`;
  }

  if (elapsedMilliseconds < 60000) {
    // if less than 1 minute - show seconds
    return `${Math.round(elapsedMilliseconds / 1000)}s`;
  }

  return `${Math.floor(elapsedMilliseconds / 60000)}m ${Math.floor((elapsedMilliseconds % 60000) / 1000)}s`;
};

type SearchBarButtonsProps = {
  isLoading: boolean;
  onForceSubmit: () => void;
};

const SearchBarButtons: React.FC<SearchBarButtonsProps> = ({
  isLoading,
  onForceSubmit,
}) => {
  return (
    <ButtonsHolder>
      <Stack gap={3}>
        <DateSelector />
        <Stack gap={3} direction="row">
          <Tooltip
            content={
              <span>
                Re-evaluate{" "}
                <Shortcut keys={headerShortcuts.getAlias("re-evaluate")} />
              </span>
            }
            showArrow
            positioning={{
              placement: "bottom",
            }}
          >
            <IconButton
              aria-label="Re-evalutate"
              type="submit"
              disabled={isLoading}
            >
              <LuSearchCode />
            </IconButton>
          </Tooltip>
          <Tooltip
            content={
              <span>
                Search <Shortcut keys={headerShortcuts.getAlias("search")} />
              </span>
            }
            showArrow
            positioning={{
              placement: "bottom",
            }}
          >
            <IconButton
              aria-label="Search database "
              onClick={() => onForceSubmit()}
              disabled={isLoading}
            >
              <LuSearch />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </ButtonsHolder>
  );
};

export default Header;
