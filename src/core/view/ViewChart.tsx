import { Card } from "@chakra-ui/react";
import { scaleLinear } from "d3-scale";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { formatDataTimeShort } from "~core/common/formatters";
import { toJsonObject } from "~core/common/logTypes";
import { actualEndTimeAtom, actualStartTimeAtom } from "~core/store/dateState";
import { dataViewModelAtom } from "~core/store/queryState";

const LIMIT = 10000;

export type ViewChartProps = {};
export const ViewChart = ({}: ViewChartProps) => {
  // TODO: use fixed values instead of the actual atoms
  const selectedStartTime = useAtomValue(actualStartTimeAtom);
  const selectedEndTime = useAtomValue(actualEndTimeAtom);

  const { view } = useAtomValue(dataViewModelAtom);

  const scale = useMemo(() => {
    if (!selectedStartTime || !selectedEndTime) {
      return;
    }

    return scaleLinear().domain([
      selectedStartTime.getTime(),
      selectedEndTime.getTime(),
    ]);
  }, [selectedStartTime, selectedEndTime]);

  const isTooBig = (view?.data.length ?? 0) > LIMIT;

  const dataPoints = useMemo(() => {
    if (!view || isTooBig) {
      return undefined;
    }

    return view.data.map((dataPoint) => toJsonObject(dataPoint));
  }, [view, isTooBig]);

  if (isTooBig) {
    return (
      <Card.Root>
        <Card.Body padding={2}>
          <p className="intro">
            Too many data points to display ({"> "}{LIMIT}). Please filter the data or reduce the data by lowering the groups count.
          </p>
        </Card.Body>
      </Card.Root>
    );
  }

  if (!scale || !dataPoints || !view) {
    return null;
  }

  console.log(dataPoints);

  return (
    <div
      className="highlight-bar-charts"
      style={{ userSelect: "none", width: "100%" }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart width={800} height={300} data={dataPoints}>
          <CartesianGrid strokeDasharray="10 10" />
          <XAxis
            scale={scale}
            dataKey={view.XAxis}
            ticks={scale.ticks()}
            domain={scale.domain()}
            tickFormatter={(value) => formatDataTimeShort(value)}
            type="number"
          />
          <YAxis yAxisId="1" />
          <Tooltip content={<CustomTooltip/>}/>
          {view.YAxis.map((yAxis, index) => {
            const color = getRandomColor();
            return (
              <Line
                yAxisId="1"
                type="linear"
                strokeWidth={2}
                key={index}
                dataKey={yAxis}
                stroke={color}
                activeDot={{ r: 8 }}
              />
            );
          })}
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string> & {}) => {
    console.log(active, payload, label);
  if (active && payload && payload.length) {
    return (
      <Card.Root>
        <Card.Body padding={2}> 
          <p className="label">{formatDataTimeShort(label)}</p>
          {payload.slice(0, 10).map((item) => (
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

const getRandomColor = () => {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
};
