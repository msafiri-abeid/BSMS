import dayjs from 'dayjs';

export const getDateRange = (preset) => {
  const today = dayjs().endOf('day');
  const d = dayjs();
  switch (preset) {
    case 'today':
      return { date_from: d.format('YYYY-MM-DD'), date_to: d.format('YYYY-MM-DD') };
    case 'yesterday':
      return { date_from: d.subtract(1, 'day').format('YYYY-MM-DD'), date_to: d.subtract(1, 'day').format('YYYY-MM-DD') };
    case 'this_week':
      return { date_from: d.startOf('week').add(1, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'this_month':
      return { date_from: d.startOf('month').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_month':
      return { date_from: d.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), date_to: d.subtract(1, 'month').endOf('month').format('YYYY-MM-DD') };
    case 'last_7':
      return { date_from: d.subtract(7, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_30':
      return { date_from: d.subtract(30, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_60':
      return { date_from: d.subtract(60, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_90':
      return { date_from: d.subtract(90, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_6_months':
      return { date_from: d.subtract(6, 'month').startOf('month').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_12_months':
      return { date_from: d.subtract(1, 'year').startOf('month').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_year':
      return { date_from: d.subtract(1, 'year').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    default:
      return { date_from: d.subtract(30, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
  }
};

export const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 7 Days', value: 'last_7' },
  { label: 'Last 30 Days', value: 'last_30' },
  { label: 'Last 60 Days', value: 'last_60' },
  { label: 'Last 90 Days', value: 'last_90' },
  { label: 'Last Year', value: 'last_year' },
  { label: 'Custom Range', value: 'custom' },
];

export const TREND_PRESETS = [
  ...DATE_PRESETS,
  { label: 'Last 6 Months', value: 'last_6_months' },
  { label: 'Last 12 Months', value: 'last_12_months' },
];

export const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];
