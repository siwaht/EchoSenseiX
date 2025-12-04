import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { Progress } from "@/components/ui/progress";
import {
  DollarSign, CreditCard,
  Download, ArrowUpRight, ArrowDownRight,
  Activity, Wallet
} from "lucide-react";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfMonth, eachDayOfInterval } from 'date-fns';

interface PaymentAnalyticsProps {
  transactions: any[];
  organizations: any[];
  billingData: any;
}

export function PaymentAnalytics({ transactions, organizations }: PaymentAnalyticsProps) {
  const [timeRange, setTimeRange] = useState("30d");
  const [selectedOrg, setSelectedOrg] = useState("all");

  // Calculate date range
  const getDateRange = () => {
    const end = new Date();
    let start = new Date();

    switch (timeRange) {
      case "7d":
        start = subDays(end, 7);
        break;
      case "30d":
        start = subDays(end, 30);
        break;
      case "90d":
        start = subDays(end, 90);
        break;
      case "1y":
        start = subDays(end, 365);
        break;
      case "mtd":
        start = startOfMonth(end);
        break;
      default:
        start = subDays(end, 30);
    }

    return { start, end };
  };

  const { start, end } = getDateRange();

  // Filter transactions by date range and organization
  const filteredTransactions = transactions.filter(t => {
    const date = new Date(t.createdAt);
    const inDateRange = date >= start && date <= end;
    const inOrg = selectedOrg === "all" || t.organizationId === selectedOrg;
    return inDateRange && inOrg;
  });

  // Calculate metrics
  const totalRevenue = filteredTransactions
    .filter(t => t.status === "completed")
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const pendingRevenue = filteredTransactions
    .filter(t => t.status === "pending")
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const failedTransactions = filteredTransactions
    .filter(t => t.status === "failed").length;

  const successRate = filteredTransactions.length > 0
    ? (filteredTransactions.filter(t => t.status === "completed").length / filteredTransactions.length * 100)
    : 0;

  // Calculate growth
  const previousPeriod = {
    start: subDays(start, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))),
    end: start
  };

  const previousTransactions = transactions.filter(t => {
    const date = new Date(t.createdAt);
    return date >= previousPeriod.start && date < previousPeriod.end;
  });

  const previousRevenue = previousTransactions
    .filter(t => t.status === "completed")
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const revenueGrowth = previousRevenue > 0
    ? ((totalRevenue - previousRevenue) / previousRevenue * 100)
    : 0;

  // Prepare chart data - Revenue over time
  const days = eachDayOfInterval({ start, end });
  const revenueByDay = days.map(day => {
    const dayTransactions = filteredTransactions.filter(t => {
      const date = new Date(t.createdAt);
      return format(date, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && t.status === "completed";
    });

    return {
      date: format(day, 'MMM dd'),
      revenue: dayTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      transactions: dayTransactions.length
    };
  });

  // Payment methods breakdown
  const paymentMethods = filteredTransactions.reduce((acc, t) => {
    const method = t.paymentMethod || 'other';
    if (!acc[method]) acc[method] = { count: 0, amount: 0 };
    acc[method].count++;
    acc[method].amount += parseFloat(t.amount || 0);
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  const paymentMethodData = Object.entries(paymentMethods).map(([method, data]) => ({
    name: method.charAt(0).toUpperCase() + method.slice(1),
    value: (data as { count: number; amount: number }).amount,
    count: (data as { count: number; amount: number }).count
  }));

  // Organization revenue breakdown
  const orgRevenue = organizations.map(org => {
    const orgTransactions = filteredTransactions.filter(t =>
      t.organizationId === org.id && t.status === "completed"
    );
    return {
      name: org.name,
      revenue: orgTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      transactions: orgTransactions.length,
      avgTransaction: orgTransactions.length > 0
        ? orgTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) / orgTransactions.length
        : 0
    };
  }).filter(o => o.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const exportData = () => {
    const csvContent = [
      ['Date', 'Transaction ID', 'Organization', 'Amount', 'Status', 'Payment Method'],
      ...filteredTransactions.map(t => [
        format(new Date(t.createdAt), 'yyyy-MM-dd'),
        t.id,
        organizations.find(o => o.id === t.organizationId)?.name || 'Unknown',
        t.amount,
        t.status,
        t.paymentMethod || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="mtd">Month to date</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organizations</SelectItem>
            {organizations.map(org => (
              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={exportData} className="ml-auto" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {revenueGrowth > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{revenueGrowth.toFixed(1)}%</span>
                </>
              ) : revenueGrowth < 0 ? (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">{revenueGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <span>No change</span>
              )}
              <span className="ml-1">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingRevenue.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              {filteredTransactions.filter(t => t.status === "pending").length} transactions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <Progress value={successRate} className="h-2 mt-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {failedTransactions} failed transactions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${filteredTransactions.length > 0
                ? (totalRevenue / filteredTransactions.filter(t => t.status === "completed").length).toFixed(2)
                : '0.00'}
            </div>
            <div className="text-xs text-muted-foreground">
              From {filteredTransactions.filter(t => t.status === "completed").length} completed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Daily revenue over selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueByDay}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Breakdown by payment gateway</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Organizations */}
        <Card>
          <CardHeader>
            <CardTitle>Top Organizations</CardTitle>
            <CardDescription>By revenue contribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orgRevenue.slice(0, 5).map((org, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div>
                      <p className="text-sm font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {org.transactions} transactions • Avg ${org.avgTransaction.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">${org.revenue.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {((org.revenue / totalRevenue) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}