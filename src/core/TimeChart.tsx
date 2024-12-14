import { scaleLinear } from "d3-scale";
import { useMemo, useRef, useState } from "react";

import { Card } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { formatDataTimeShort } from "./common/formatters";
import { actualEndTimeAtom, actualStartTimeAtom } from "./store/dateState";
import { objectsAtom } from "./store/queryState";

export const TimeChart = () => {
  const objects = useAtomValue(objectsAtom);

  const ref = useRef(null);

  const [refAreaLeft, setRefAreaLeft] = useState<number>();
  const [refAreaRight, setRefAreaRight] = useState<number>();

  const rangeSelected = () => {
    setRefAreaLeft(undefined);
    setRefAreaRight(undefined);
  };

  const selectedStartTime = useAtomValue(actualStartTimeAtom);
  const selectedEndTime = useAtomValue(actualEndTimeAtom);
  const scale = useMemo(() => {
    if (!selectedStartTime || !selectedEndTime) {
      return;
    }

    return scaleLinear().domain([
      selectedStartTime.getTime(),
      selectedEndTime.getTime(),
    ]);
  }, [selectedStartTime, selectedEndTime]);

  const dataBuckets = useMemo(() => {
    if (!scale) {
      return;
    }

    const buckets: Record<number, number> = {};
    const ticks = scale.ticks(100);

    objects.forEach((object) => {
      // round timestamp to the nearest tick
      const timestamp = ticks.reduce((prev, curr) =>
        Math.abs(curr - object.timestamp) < Math.abs(prev - object.timestamp)
          ? curr
          : prev
      );
      if (!buckets[timestamp]) {
        buckets[timestamp] = 0;
      }

      buckets[timestamp] += 1;
    });

    return Object.entries(buckets).map(([timestamp, count]) => ({
      timestamp: parseInt(timestamp),
      count,
    }));
  }, [objects, scale]);

  if (!scale) {
    return null;
  }

  return (
    <div
      className="highlight-bar-charts"
      style={{ userSelect: "none", width: "100%" }}
    >
      <ResponsiveContainer width="100%" height={100}>
        <BarChart
          width={800}
          ref={ref}
          height={400}
          data={dataBuckets}
          onMouseDown={(e) => {
            if (e.chartX === undefined) return;
            setRefAreaLeft(scale.invert(e.chartX));
          }}
          onMouseMove={(e) => {
            if (!refAreaLeft) return;
            if (e.chartX === undefined) return;

            setRefAreaRight(scale.invert(e.chartX));
          }}
          onMouseUp={rangeSelected}
        >
          <CartesianGrid strokeDasharray="10 10" />
          <XAxis
            scale={scale}
            dataKey="timestamp"
            ticks={scale.ticks()}
            domain={scale.domain()}
            tickFormatter={(value) => formatDataTimeShort(new Date(value))}
            type="number"
          />
          <YAxis
            domain={[0, "dataMax + 1"]}
            type="number"
            yAxisId="1"
          />
          <Tooltip
            content={
              <CustomTooltip leftArea={refAreaLeft} rightArea={refAreaRight} />
            }
          />
          <Bar
            yAxisId="1"
            dataKey="count"
            stroke="#302d6d"
            fill="#8884d8"
            maxBarSize={10}
            animationDuration={300}
          />
          {/* <Line
            yAxisId="1"
            type="natural"
            dataKey="impression"
            stroke="#82ca9d"
            animationDuration={300}
          /> */}

          {refAreaLeft && refAreaRight ? (
            <ReferenceArea
              yAxisId="1"
              x1={refAreaLeft}
              x2={refAreaRight}
              strokeOpacity={0.3}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const CustomTooltip = ({
  active,
  payload,
  label,
  leftArea,
  rightArea,
}: TooltipProps<number, string> & {
  leftArea: undefined | number;
  rightArea: undefined | number;
}) => {
  if (active && payload && payload.length) {
    return (
      <Card.Root>
        <Card.Body padding={2}>
          {leftArea && rightArea ? (
            <p className="intro">
              {formatDataTimeShort(new Date(leftArea))} to{" "}
              {formatDataTimeShort(new Date(rightArea))}
            </p>
          ) : (
            <>
              <p className="label">{formatDataTimeShort(label)}</p>
              {payload.map((item) => (
                <p key={item.dataKey} className="intro">
                  {item.dataKey} : {item.value}
                </p>
              ))}
            </>
          )}
        </Card.Body>
      </Card.Root>
    );
  }

  return null;
};
