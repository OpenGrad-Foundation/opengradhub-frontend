"use client";

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import EmptyState from './EmptyState';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

type ChartCardProps = {
  title: string;
  variant: 'line' | 'bar';
  data: {
    labels: string[];
    datasets: Array<{ label: string; data: number[] }>;
  };
  isLoading?: boolean;
  emptyHelper?: string;
};

export default function ChartCard({
  title,
  variant,
  data,
  isLoading,
  emptyHelper = 'No data yet',
}: ChartCardProps) {
  const hasData = data.datasets.length > 0 && data.datasets.some((d) => d.data.length > 0);

  return (
    <div className="rounded-[24px] bg-white p-6 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[rgba(3,72,82,0.6)]">
        {title}
      </h3>
      {isLoading ? (
        <div data-testid="chart-skeleton" className="h-48 animate-pulse rounded bg-slate-100" />
      ) : !hasData ? (
        <EmptyState helperText={emptyHelper} />
      ) : (
        // Fixed-height box: with maintainAspectRatio:false the canvas sizes to
        // its container, not the height prop — without this it grows unbounded.
        <div className="relative h-48">
          {variant === 'line' ? (
            <Line data={data} options={{ responsive: true, maintainAspectRatio: false }} />
          ) : (
            <Bar data={data} options={{ responsive: true, maintainAspectRatio: false }} />
          )}
        </div>
      )}
    </div>
  );
}
