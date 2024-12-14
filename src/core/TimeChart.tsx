import { scaleLinear } from "d3-scale";
import {
    useMemo,
    useRef,
    useState
} from "react";

import { Card } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    TooltipProps,
    XAxis,
    YAxis
} from "recharts";
import { formatDataTimeShort } from "./common/formatters";
import {
    actualEndTimeAtom,
    actualStartTimeAtom
} from "./store/dateState";
import { objectsAtom } from "./store/queryState";
const initialData = [
  {
    name: 1,
    cost: 4.11,
    impression: 100,
    time: new Date(2021, 0, 1).getTime(),
  },
  {
    name: 2,
    cost: 2.39,
    impression: 120,
    time: new Date(2021, 0, 2).getTime(),
  },
  {
    name: 3,
    cost: 1.37,
    impression: 150,
    time: new Date(2021, 0, 3).getTime(),
  },
  {
    name: 4,
    cost: 1.16,
    impression: 180,
    time: new Date(2021, 0, 4).getTime(),
  },
  {
    name: 5,
    cost: 2.29,
    impression: 200,
    time: new Date(2021, 0, 5).getTime(),
  },
  { name: 6, cost: 3, impression: 499, time: new Date(2021, 0, 6).getTime() },
  { name: 7, cost: 0.53, impression: 50, time: new Date(2021, 0, 7).getTime() },
  {
    name: 8,
    cost: 2.52,
    impression: 100,
    time: new Date(2021, 0, 8).getTime(),
  },
  {
    name: 9,
    cost: 1.79,
    impression: 200,
    time: new Date(2021, 0, 9).getTime(),
  },
  {
    name: 10,
    cost: 2.94,
    impression: 222,
    time: new Date(2021, 0, 10).getTime(),
  },
  {
    name: 11,
    cost: 4.3,
    impression: 210,
    time: new Date(2021, 0, 11).getTime(),
  },
  {
    name: 12,
    cost: 4.41,
    impression: 300,
    time: new Date(2021, 0, 12).getTime(),
  },
  {
    name: 13,
    cost: 2.1,
    impression: 50,
    time: new Date(2021, 0, 13).getTime(),
  },
  { name: 14, cost: 8, impression: 190, time: new Date(2021, 0, 14).getTime() },
  { name: 15, cost: 0, impression: 300, time: new Date(2021, 0, 15).getTime() },
  { name: 16, cost: 9, impression: 400, time: new Date(2021, 0, 16).getTime() },
  { name: 17, cost: 3, impression: 200, time: new Date(2021, 0, 17).getTime() },
  { name: 18, cost: 2, impression: 50, time: new Date(2021, 0, 18).getTime() },
  { name: 19, cost: 3, impression: 100, time: new Date(2021, 0, 19).getTime() },
  { name: 20, cost: 7, impression: 100, time: new Date(2021, 0, 20).getTime() },
];

export const TimeChart = () => {
  const [state, setState] = useState({
    // data: initialData,
    left: "dataMin",
    right: "dataMax",
    top: "dataMax+1",
    bottom: "dataMin-1",
    top2: "dataMax+20",
    bottom2: "dataMin-20",
    animation: true,
  });

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
  const scale =
    selectedStartTime &&
    selectedEndTime &&
    scaleLinear().domain([
      selectedStartTime.getTime(),
      selectedEndTime.getTime(),
    ]);

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

    console.log("buckets", buckets, objects);

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
        <LineChart
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
            allowDataOverflow
            scale={scale}
            dataKey="timestamp"
            ticks={scale.ticks()}
            domain={scale.domain()}
            tickFormatter={(value) => formatDataTimeShort(new Date(value))}
            type="number"
          />
          <YAxis
            allowDataOverflow
            domain={[state.bottom, state.top]}
            type="number"
            yAxisId="1"
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            yAxisId="1"
            type="natural"
            dataKey="count"
            stroke="#8884d8"
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <Card.Root>
        <Card.Body padding={2}>
          <p className="label">{formatDataTimeShort(label)}</p>
          {payload.map((item) => (
            <p key={item.dataKey} className="intro">
              {item.dataKey} : {item.value}
            </p>
          ))}
        </Card.Body>
      </Card.Root>
    );
  }

  return null;
};
