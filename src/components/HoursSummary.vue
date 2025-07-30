<template>
  <div class="hours-summary">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <span>Loading time data...</span>
    </div>

    <div v-else-if="error" class="error">
      <h3>⚠️ Error</h3>
      <p>{{ error }}</p>
      <button @click="$emit('retry')" class="retry-btn">Retry</button>
    </div>

    <div v-else-if="timeData" class="summary-content">
      <div class="total-hours">
        <h3>Total Hours This Week</h3>
        <div class="hours-display">{{ formatHoursMinutes(timeData.totalHours) }}</div>

        <div class="target-progress">
          <div class="target-info">
            <span class="target-label">Target: {{ targetDisplayText }}</span>
            <span class="remaining-label" :class="remainingClass">
              {{ remainingText }}
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"
              :class="{ 'exceeded': hasExceededTarget }"></div>
          </div>
          <div class="progress-percentage">{{ Math.round(progressPercentage) }}%</div>
        </div>
      </div>

      <div class="daily-breakdown">
        <h4>Daily Breakdown <span class="clickable-hint">(Click on any day for timeline)</span></h4>
        <div class="daily-grid">
          <div v-for="day in timeData.dailyBreakdown" :key="day.date" class="day-item" @click="openTimeline(day.date)"
            :title="`Click to view timeline for ${formatDayName(day.date)}, ${formatDayDate(day.date)}`">
            <div class="day-info">
              <div class="day-name">{{ formatDayName(day.date) }}</div>
              <div class="day-date">{{ formatDayDate(day.date) }}</div>
            </div>
            <div class="hours-bar">
              <div class="hours-fill" 
                   :style="{ height: `${getBarHeight(day.hours, day.date)}%` }"
                   :class="{ 'target-met': isDailyTargetMet(day.hours, day.date), 'below-target': !isDailyTargetMet(day.hours, day.date) }"></div>
            </div>
            <div class="day-hours" :class="{ 'target-met': isDailyTargetMet(day.hours, day.date), 'below-target': !isDailyTargetMet(day.hours, day.date) }">
              {{ formatHoursMinutes(day.hours) }}
              <div class="day-target">
                <span v-if="!isWeekend(day.date)">Target: {{ getDailyTargetText(day.date) }}</span>
                <span v-else>&nbsp;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-data">
      <p>No time data available for this week.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WeeklyTimeData, WeeklyTarget } from '../types';

interface Props {
  timeData?: WeeklyTimeData;
  loading?: boolean;
  error?: string;
  target?: WeeklyTarget;
  lastUpdateTime?: Date | null;
}

interface Emits {
  (e: 'retry'): void;
  (e: 'open-timeline', date: string): void;
  (e: 'manual-refresh'): void;
}

const props = withDefaults(defineProps<Props>(), {
  target: () => ({ hours: 34, minutes: 10 })
});
const emit = defineEmits<Emits>();

const maxHours = computed(() => {
  if (!props.timeData?.dailyBreakdown) return 8;
  return Math.max(...props.timeData.dailyBreakdown.map(d => d.hours), 8);
});

const targetTotalHours = computed(() => {
  return props.target.hours + (props.target.minutes / 60);
});

const targetDisplayText = computed(() => {
  const hours = props.target.hours;
  const minutes = props.target.minutes;

  if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
});

const progressPercentage = computed(() => {
  if (!props.timeData) return 0;
  return Math.min((props.timeData.totalHours / targetTotalHours.value) * 100, 100);
});

const hasExceededTarget = computed(() => {
  if (!props.timeData) return false;
  return props.timeData.totalHours > targetTotalHours.value;
});

const remainingHours = computed(() => {
  if (!props.timeData) return targetTotalHours.value;
  return Math.max(targetTotalHours.value - props.timeData.totalHours, 0);
});

const remainingText = computed(() => {
  if (!props.timeData) return `${targetTotalHours.value.toFixed(1)}h remaining`;

  if (hasExceededTarget.value) {
    const excess = props.timeData.totalHours - targetTotalHours.value;
    return `+${excess.toFixed(1)}h over target!`;
  }

  if (remainingHours.value === 0) {
    return 'Target achieved!';
  }

  const hours = Math.floor(remainingHours.value);
  const minutes = Math.round((remainingHours.value - hours) * 60);

  if (hours === 0) {
    return `${minutes}min remaining`;
  } else if (minutes === 0) {
    return `${hours}h remaining`;
  } else {
    return `${hours}h ${minutes}min remaining`;
  }
});

const remainingClass = computed(() => {
  if (!props.timeData) return '';

  if (hasExceededTarget.value) {
    return 'exceeded';
  } else if (remainingHours.value === 0) {
    return 'achieved';
  } else {
    return 'remaining';
  }
});

const dailyTargetHours = computed(() => {
  return targetTotalHours.value / 5; // Divide weekly target by 5 workdays
});

const getBarHeight = (hours: number, dateStr: string): number => {
  if (isWeekend(dateStr)) {
    // For weekends, use the max hours across all days for scaling
    return (hours / maxHours.value) * 100;
  } else {
    // For weekdays, show progress against daily target
    return Math.min((hours / dailyTargetHours.value) * 100, 100);
  }
};

const isDailyTargetMet = (hours: number, dateStr: string): boolean => {
  if (isWeekend(dateStr)) {
    return true; // Weekends are always "met" since no target
  }
  return hours >= dailyTargetHours.value;
};

const isWeekend = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
};

const getDailyTargetText = (dateStr: string): string => {
  if (isWeekend(dateStr)) {
    return ''; // No target for weekends
  }
  return formatHoursMinutes(dailyTargetHours.value);
};

const formatDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const formatDayDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
};

const formatHoursMinutes = (hours: number): string => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0 && minutes === 0) {
    return '0h 0m';
  } else if (wholeHours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
};

const openTimeline = (dateStr: string) => {
  emit('open-timeline', dateStr);
};
</script>

<style scoped>
.hours-summary {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  color: #666;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e3e3e3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error {
  text-align: center;
  padding: 2rem;
  color: #e74c3c;
}

.error h3 {
  margin: 0 0 1rem 0;
}

.retry-btn {
  padding: 0.5rem 1rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}

.retry-btn:hover {
  background: #2980b9;
}

.total-hours {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
}

.total-hours h3 {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  opacity: 0.9;
}

.hours-display {
  font-size: 3rem;
  font-weight: bold;
  margin: 0;
}

.target-progress {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.target-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.target-label {
  opacity: 0.9;
}

.remaining-label {
  font-weight: 600;
}

.remaining-label.exceeded {
  color: #f39c12;
}

.remaining-label.achieved {
  color: #2ecc71;
}

.remaining-label.remaining {
  color: #ecf0f1;
}

.progress-bar {
  background: rgba(255, 255, 255, 0.2);
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2ecc71, #27ae60);
  transition: width 0.5s ease;
  border-radius: 4px;
}

.progress-fill.exceeded {
  background: linear-gradient(90deg, #f39c12, #e67e22);
}

.progress-percentage {
  text-align: center;
  font-size: 0.8rem;
  opacity: 0.9;
}

.daily-breakdown h4 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.clickable-hint {
  font-size: 0.8rem;
  color: #666;
  font-weight: 400;
  font-style: italic;
}

.daily-grid {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: flex-end;
  min-height: 120px;
}

.day-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.day-item:hover {
  background: rgba(52, 152, 219, 0.1);
  transform: translateY(-2px);
}

.day-item:active {
  transform: translateY(0);
}

.day-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.day-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.day-date {
  color: #7f8c8d;
  font-size: 0.8rem;
}

.day-hours {
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.day-hours.target-met {
  color: #27ae60; /* Green when target is met */
}

.day-hours.below-target {
  color: #f39c12; /* Orange when below target */
}

.day-target {
  font-size: 0.75rem;
  color: #95a5a6;
  font-weight: 400;
  margin-top: 0.25rem;
}

.hours-bar {
  background: #ecf0f1;
  width: 20px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  position: relative;
}

.hours-fill {
  width: 100%;
  transition: height 0.5s ease;
  border-radius: 0 0 4px 4px;
}

.hours-fill.target-met {
  background: linear-gradient(0deg, #27ae60, #2ecc71); /* Green when target is met */
}

.hours-fill.below-target {
  background: linear-gradient(0deg, #f39c12, #e67e22); /* Orange when below target */
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #7f8c8d;
}

.auto-refresh-status {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #ecf0f1;
}

.last-updated {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #7f8c8d;
}

.update-icon {
  font-size: 0.9rem;
  animation: rotate 2s linear infinite;
  transition: transform 0.3s ease;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 50%;
  background: transparent;
}

.update-icon:hover {
  transform: scale(1.1);
  background: rgba(52, 152, 219, 0.1);
}

.update-text {
  color: #5a6c7d;
}

.auto-refresh-indicator {
  color: #95a5a6;
  font-style: italic;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .daily-grid {
    gap: 0.5rem;
  }

  .day-name {
    font-size: 0.8rem;
  }

  .day-date {
    font-size: 0.7rem;
  }

  .hours-bar {
    width: 16px;
    height: 50px;
  }

  .hours-display {
    font-size: 2rem;
  }

  .last-updated {
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
  }

  .auto-refresh-indicator {
    font-size: 0.75rem;
  }
}
</style>
