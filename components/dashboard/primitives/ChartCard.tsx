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
  compact?: boolean;
  wholeNumbers?: boolean;
  emptyHelper?: string;
};

export default function ChartCard({
  title,
  variant,
  data,
  isLoading,
  compact = false,
  wholeNumbers = false,
  emptyHelper = 'No data yet',
}: ChartCardProps) {
  const hasData = data.datasets.length > 0 && data.datasets.some((d) => d.data.length > 0);

  const chartData = compact ? {
    ...data,
    datasets: data.datasets.map(dataset => ({ ...dataset, borderColor: '#078645', backgroundColor: '#0abe62', pointHoverBackgroundColor: '#0abe62', borderWidth: 2, pointRadius: 0, pointHitRadius: 12, pointHoverRadius: 4 })),
  } : data;

  return (
    <div className={compact ? "min-w-0" : "rounded-[24px] bg-white p-6 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"}>
      <h3 className={compact ? "mb-4 text-lg font-semibold text-[var(--color-text)]" : "mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[rgba(3,72,82,0.6)]"}>
        {title}
      </h3>
      {isLoading ? (
        <div data-testid="chart-skeleton" className={`${compact ? "h-44 sm:h-48" : "h-64 sm:h-72"} w-full animate-pulse rounded bg-slate-100`} />
      ) : !hasData ? (
        compact ? <p className="py-4 text-sm text-[var(--color-text-muted)]">{emptyHelper}</p> : <EmptyState helperText={emptyHelper} />
      ) : (
        <div className={`relative ${compact ? "h-44 sm:h-48" : "h-64 sm:h-72"} w-full`}>
          {variant === 'line' ? (
            <Line
              aria-label={title}
              role="img"
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  ...((wholeNumbers || compact) ? { y: {
                    ...(wholeNumbers ? { beginAtZero: true } : {}),
                    ticks: { ...(wholeNumbers ? { precision: 0 } : {}), ...(compact ? { maxTicksLimit: 5 } : {}) },
                    ...(compact ? { border: { display: false }, grid: { color: 'rgba(3,72,82,0.06)' } } : {}),
                  } } : {}),
                  x: {
                    ...(compact ? { border: { display: false }, grid: { display: false } } : {}),
                    ticks: {
                      ...(compact ? { maxTicksLimit: 6, maxRotation: 0 } : {}),
                      callback: function(value) {
                        const label = this.getLabelForValue(value as number);
                        if (typeof label === 'string' && label.length > 12) {
                          return label.substring(0, 10) + '...';
                        }
                        return label;
                      }
                    }
                  }
                },
                plugins: {
                  legend: { display: !compact },
                  tooltip: {
                    callbacks: {
                      title: (context) => context[0].label
                    }
                  }
                }
              }}
            />
          ) : (
            <Bar
              aria-label={title}
              role="img"
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  ...((wholeNumbers || compact) ? { y: {
                    ...(wholeNumbers ? { beginAtZero: true } : {}),
                    ticks: { ...(wholeNumbers ? { precision: 0 } : {}), ...(compact ? { maxTicksLimit: 5 } : {}) },
                    ...(compact ? { border: { display: false }, grid: { color: 'rgba(3,72,82,0.06)' } } : {}),
                  } } : {}),
                  x: {
                    ...(compact ? { border: { display: false }, grid: { display: false } } : {}),
                    ticks: {
                      ...(compact ? { maxTicksLimit: 6, maxRotation: 0 } : {}),
                      callback: function(value) {
                        const label = this.getLabelForValue(value as number);
                        if (typeof label === 'string' && label.length > 12) {
                          return label.substring(0, 10) + '...';
                        }
                        return label;
                      }
                    }
                  }
                },
                plugins: {
                  legend: { display: !compact },
                  tooltip: {
                    callbacks: {
                      title: (context) => context[0].label
                    }
                  }
                }
              }}
            />
          )}
        </div>
      )}
      {compact && hasData && !isLoading && (
        <div className="sr-only">
          <table>
            <caption>{title} by month</caption>
            <thead><tr><th scope="col">Month</th>{data.datasets.map(d => <th scope="col" key={d.label}>{d.label}</th>)}</tr></thead>
            <tbody>{data.labels.map((label, i) => <tr key={label}><th scope="row">{label}</th>{data.datasets.map(d => <td key={d.label}>{d.data[i]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
