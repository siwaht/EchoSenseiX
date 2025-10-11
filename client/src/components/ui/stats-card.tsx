import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  bgColor?: string;
  iconColor?: string;
  testId?: string;
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon, 
  bgColor = "from-blue-500 to-blue-600",
  iconColor = "text-white",
  testId
}: StatsCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden border-0 text-white shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 cursor-pointer group",
      `bg-gradient-to-br ${bgColor}`
    )}>
      {/* Animated background overlay */}
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors duration-300"></div>
      
      {/* Subtle animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Content */}
      <div className="relative p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-white/80 mb-1 truncate transition-colors duration-300 group-hover:text-white/90" data-testid={`${testId}-title`}>
              {title}
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 truncate transition-all duration-300 group-hover:text-white group-hover:scale-105" data-testid={`${testId}-value`}>
              {value}
            </p>
            {change && (
              <p className={cn(
                "text-sm font-medium transition-colors duration-300",
                changeType === "positive" && "text-green-200 group-hover:text-green-100",
                changeType === "negative" && "text-red-200 group-hover:text-red-100",
                changeType === "neutral" && "text-white/70 group-hover:text-white/80"
              )} data-testid={`${testId}-change`}>
                {change}
              </p>
            )}
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0 transition-all duration-300 group-hover:bg-white/30 group-hover:scale-110 group-hover:rotate-3">
            <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:scale-110", iconColor)} />
          </div>
        </div>
        
        {/* Subtle bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
      </div>
    </Card>
  );
}
