import { useState, useEffect } from "react"
import { PieChart, Pie, Cell } from "recharts"

export default function TrafficSpeedometerGlass({
    name,
    tps: serverTps,
}: {
    name: string
    tps: number
}) {
    const [tps, setTps] = useState(serverTps)

    useEffect(() => {
        const interval = setInterval(() => {
            setTps(Math.random() * 100)
        }, 800)
        return () => clearInterval(interval)
    }, [])

    function getColor(value: number) {
        if (value < 40) return "#10B981AA"
        if (value < 70) return "#F59E0BAA"
        return "#EF4444AA"
    }

    const activeColor = getColor(tps)

    const data = [
        { name: "traffic", value: Math.min(tps, 100) },
        { name: "rest", value: 100 - Math.min(tps, 100) },
    ]

    return (
        <div className="relative flex flex-col items-center justify-center w-full h-60 rounded-3xl p-6 bg-bright/5 backdrop-blur-md border border-bright/10 shadow-xl">
            <div className="text-lg font-semibold mb-4 text-bright/80 tracking-wide drop-shadow">
                {name}
            </div>

            <div className="relative w-full h-[100px] flex items-end justify-center">
                {/* Ticks */}
                <div className="absolute bottom-0 left-1/2 translate-x-[-51%] w-40 h-[110px] z-10 pr-50">
                    {[...Array(21)].map((_, i) => {
                        const deg = -90 + i * 9
                        const long = i % 5 === 0
                        return (
                            <div
                                key={i}
                                className={`absolute bottom-0 left-1/2 origin-bottom ${long ? "h-6 w-[3px]" : "h-3 w-0.5"
                                    }`}
                                style={{
                                    transform: `rotate(${deg}deg) translateY(-90px)`,
                                    backgroundColor: long
                                        ? "rgba(255,255,255,0.8)"
                                        : "rgba(255,255,255,0.3)",
                                }}
                            ></div>
                        )
                    })}
                </div>

                {/* Gauge arc */}
                <div>
                    <PieChart width={224} height={150}>
                        <Pie
                            data={data}
                            startAngle={180}
                            endAngle={0}
                            innerRadius={90.8}
                            outerRadius={112}
                            dataKey="value"
                            stroke="none"
                            cx="50%"
                            cy="105%"
                            isAnimationActive={true}
                            animationDuration={400}
                            animationEasing="ease-out"
                        >
                            {data.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={index === 0 ? activeColor : "rgba(255,255,255,0.1)"}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </div>

                {/* Glow */}
                <div
                    className="absolute bottom-2.5 w-40 h-20 rounded-full blur-2xl opacity-50"
                    style={{
                        background: `radial-gradient(circle at center, ${activeColor}, transparent 70%)`,
                    }}
                ></div>

                {/* Value */}
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
                    <div
                        className="text-4xl font-bold drop-shadow-lg"
                        style={{ color: activeColor }}
                    >
                        {tps.toFixed(1)}
                    </div>
                    <div className="text-sm text-bright/60">req/s</div>
                </div>
            </div>
        </div>
    )
}
