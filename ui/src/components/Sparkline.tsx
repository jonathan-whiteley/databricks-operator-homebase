// ui/src/components/Sparkline.tsx
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function Sparkline({
  data, dataKey = "value", color = "#FF3621", height = 56,
}: {
  data: Record<string, number | string>[];
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip cursor={false} contentStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
