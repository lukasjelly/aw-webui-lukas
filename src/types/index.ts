// Types for ActivityWatch API responses
export interface AWEvent {
  id: number;
  timestamp: string;
  duration: number;
  data: Record<string, any>;
}

export interface AWBucket {
  id: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  data: Record<string, any>;
}

export interface AWEventData {
  app?: string;
  title?: string;
  url?: string;
  domain?: string;
  [key: string]: any;
}

export interface WeeklyTimeData {
  startDate: Date;
  endDate: Date;
  totalHours: number;
  dailyBreakdown: {
    date: string;
    hours: number;
  }[];
}

export interface WeeklyTarget {
  hours: number;
  minutes: number;
}

export type DistributionMode = 'custom';

export interface DailyTarget {
  day: string; // 'monday', 'tuesday', etc.
  hours: number;
}

export interface DailyTargetsConfig {
  mode: DistributionMode;
  customTargets: Record<string, number>; // { monday: 7, tuesday: 6.5, etc. }
  weeklyTarget: number;
  lockedDays: Record<string, boolean>; // { monday: true, tuesday: false, etc. }
  lastModified: Date;
}

export interface ApiError {
  message: string;
  status?: number;
}
