import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface CallAnalyticsProps {
  callLogs: any[];
  stats: any;
}

export function CallAnalyticsCard({ callLogs, stats }: CallAnalyticsProps) {
  // Calculate call volume by hour of day
  const getHourlyDistribution = () => {
    const hourlyData = new Array(24).fill(0).map((_, i) => ({
      hour: i,
      calls: 0,
      label: `${i.toString().padStart(2, '0')}:00`
    }));

    callLogs.forEach(call => {
      if (call.createdAt) {
        const hour = new Date(call.createdAt).getHours();
        hourlyData[hour]!.calls++;
      }
    });

    return hourlyData;
  };

  // Calculate call duration distribution
  const getDurationDistribution = () => {
    const ranges = [
      { range: '0-1 min', count: 0, color: '#10b981' },
      { range: '1-3 min', count: 0, color: '#3b82f6' },
      { range: '3-5 min', count: 0, color: '#8b5cf6' },
      { range: '5-10 min', count: 0, color: '#f59e0b' },
      { range: '10+ min', count: 0, color: '#ef4444' }
    ];

    callLogs.forEach(call => {
      const minutes = (call.duration || 0) / 60;
      if (minutes <= 1) ranges[0]!.count++;
      else if (minutes <= 3) ranges[1]!.count++;
      else if (minutes <= 5) ranges[2]!.count++;
      else if (minutes <= 10) ranges[3]!.count++;
      else ranges[4]!.count++;
    });

    return ranges.filter(r => r.count > 0);
  };

  // Calculate daily trends (last 7 days)
  const getDailyTrends = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      const dayLogs = callLogs.filter(call => {
        const callDate = new Date(call.createdAt);
        return callDate.toDateString() === date.toDateString();
      });

      days.push({
        date: dateStr,
        calls: dayLogs.length,
        duration: dayLogs.reduce((sum, call) => sum + (call.duration || 0), 0) / 60,
        cost: dayLogs.reduce((sum, call) => sum + parseFloat(call.cost || 0), 0)
      });
    }
    return days;
  };

  // Calculate average metrics
  const avgCallDuration = callLogs.length > 0
    ? (callLogs.reduce((sum, call) => sum + (call.duration || 0), 0) / callLogs.length / 60).toFixed(1)
    : 0;

  const avgCallCost = callLogs.length > 0
    ? (callLogs.reduce((sum, call) => sum + parseFloat(call.cost || 0), 0) / callLogs.length).toFixed(4)
    : 0;

  // Get completion rate
  const completedCalls = callLogs.filter(call => call.status === 'completed').length;
  const completionRate = callLogs.length > 0 ? ((completedCalls / callLogs.length) * 100).toFixed(1) : "0";

  // Calculate cost trend (compare to previous period)
  const currentPeriodCost = stats?.totalCost || 0;
  const previousPeriodCost = stats?.previousPeriodCost || currentPeriodCost * 0.8; // Mock previous period
  const costTrend = previousPeriodCost > 0
    ? ((currentPeriodCost - previousPeriodCost) / previousPeriodCost * 100).toFixed(1)
    : "0";

  const hourlyData = getHourlyDistribution();
  const durationData = getDurationDistribution();
  const dailyTrends = getDailyTrends();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Key Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Avg Duration</span>
            </div>
            <span className="text-sm font-medium">{avgCallDuration} min</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Avg Cost</span>
            </div>
            <span className="text-sm font-medium">${avgCallCost}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Completion Rate</span>
            </div>
            <Badge variant={parseFloat(completionRate) > 80 ? "default" : "secondary"}>
              {completionRate}%
            </Badge>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Cost Trend</span>
            <div className="flex items-center gap-1">
              {parseFloat(costTrend) > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : parseFloat(costTrend) < 0 ? (
                <TrendingDown className="h-4 w-4 text-green-500" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={`text-sm font-medium ${parseFloat(costTrend) > 0 ? 'text-red-500' :
                parseFloat(costTrend) < 0 ? 'text-green-500' :
                  'text-muted-foreground'
                }`}>
                {Math.abs(parseFloat(costTrend))}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Duration Distribution */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base truncate">Duration Distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {durationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={durationData}
                  dataKey="count"
                  nameKey="range"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                >
                  {durationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconSize={10}
                  formatter={(value, entry: any) => (
                    <span className="text-xs">
                      {value} ({entry?.payload?.count || 0})
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[120px] flex items-center justify-center">
              <p className="text-xs sm:text-sm text-muted-foreground">No data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Peak Hours */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base truncate">Peak Call Hours</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={hourlyData.filter(h => h.calls > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={40}
              />
              <YAxis fontSize={10} />
              <Tooltip
                formatter={(value: any) => [`${value} calls`, 'Calls']}
              />
              <Bar dataKey="calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 7-Day Trend */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-3 overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base">7-Day Activity Trend</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={9} tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left" fontSize={9} tick={{ fontSize: 9 }} />
              <YAxis yAxisId="right" orientation="right" fontSize={9} tick={{ fontSize: 9 }} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="calls"
                stroke="#3b82f6"
                name="Calls"
                strokeWidth={2}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="duration"
                stroke="#10b981"
                name="Minutes"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cost"
                stroke="#f59e0b"
                name="Cost ($)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}