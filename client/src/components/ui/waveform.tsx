import React from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
    className?: string;
    bars?: number;
    active?: boolean;
}

export const Waveform: React.FC<WaveformProps> = ({
    className,
    bars = 5,
    active = false
}) => {
    return (
        <div className={cn("flex items-center gap-1 h-6", className)}>
            {Array.from({ length: bars }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        "w-1 bg-current rounded-full transition-all duration-300 ease-in-out",
                        active ? "animate-pulse" : "h-1 opacity-20"
                    )}
                    style={{
                        height: active ? `${Math.max(20, Math.random() * 100)}%` : '4px',
                        animationDelay: `${i * 0.1}s`
                    }}
                />
            ))}
        </div>
    );
};
