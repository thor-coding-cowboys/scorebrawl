import {
	BarChart,
	Bar,
	LineChart,
	Line,
	PieChart,
	Pie,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import type { ChartData } from "./chat-layout";

const CHART_COLORS = [
	"#8b5cf6",
	"#06b6d4",
	"#f59e0b",
	"#ec4899",
	"#10b981",
	"#f97316",
	"#6366f1",
	"#ef4444",
];

const tooltipStyle = {
	backgroundColor: "rgba(24, 24, 27, 0.95)",
	border: "1px solid rgba(255, 255, 255, 0.1)",
	borderRadius: "8px",
	fontSize: 12,
	color: "#e4e4e7",
	padding: "8px 12px",
};

const axisTickStyle = { fontSize: 11, fill: "#a1a1aa" };
const gridStroke = "rgba(255, 255, 255, 0.06)";

export function ChartRenderer({ chart }: { chart: ChartData }) {
	const { type, title, data, xKey, yKeys } = chart;
	const keys = yKeys ?? ["value"];

	return (
		<div className="flex justify-start">
			<div className="w-full max-w-[90%] rounded-lg bg-muted px-4 py-4">
				<h3 className="mb-3 text-sm font-medium">{title}</h3>
				<div className={type === "pie" ? "h-72" : "h-64"}>
					<ResponsiveContainer width="100%" height="100%">
						{type === "bar" ? (
							<BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
								<CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
								<XAxis
									dataKey={xKey ?? "name"}
									tick={axisTickStyle}
									axisLine={{ stroke: gridStroke }}
									tickLine={false}
								/>
								<YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
								<Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
								{keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />}
								{keys.map((key, i) => (
									<Bar
										key={key}
										dataKey={key}
										fill={CHART_COLORS[i % CHART_COLORS.length]}
										radius={[4, 4, 0, 0]}
										maxBarSize={48}
									/>
								))}
							</BarChart>
						) : type === "line" ? (
							<LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
								<CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
								<XAxis
									dataKey={xKey ?? "name"}
									tick={axisTickStyle}
									axisLine={{ stroke: gridStroke }}
									tickLine={false}
								/>
								<YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
								<Tooltip contentStyle={tooltipStyle} />
								{keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />}
								{keys.map((key, i) => (
									<Line
										key={key}
										type="monotone"
										dataKey={key}
										stroke={CHART_COLORS[i % CHART_COLORS.length]}
										strokeWidth={2}
										dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
										activeDot={{ r: 5 }}
									/>
								))}
							</LineChart>
						) : (
							<PieChart>
								<Pie
									data={data}
									dataKey="value"
									nameKey="name"
									cx="50%"
									cy="50%"
									innerRadius={50}
									outerRadius={100}
									paddingAngle={2}
									label={({ name, percent }: { name: string; percent: number }) =>
										`${name} ${(percent * 100).toFixed(0)}%`
									}
									labelLine={{ stroke: "#71717a", strokeWidth: 1 }}
								>
									{data.map((_, i) => (
										<Cell
											key={i}
											fill={CHART_COLORS[i % CHART_COLORS.length]}
											stroke="transparent"
										/>
									))}
								</Pie>
								<Tooltip contentStyle={tooltipStyle} />
							</PieChart>
						)}
					</ResponsiveContainer>
				</div>
			</div>
		</div>
	);
}
