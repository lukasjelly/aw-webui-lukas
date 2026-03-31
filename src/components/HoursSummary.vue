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
        <div class="hours-display">{{ formatHoursMinutes(adjustedTotalHours) }}</div>

        <div class="target-progress">
          <div class="target-info">
              <div class="target-display">
                <span class="target-label">Target: {{ targetDisplayText }}</span>
            </div>
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
          <div v-for="day in filteredDailyBreakdown" :key="day.date" class="day-item" @click="openTimeline(day.date)"
            :class="{ 'is-today': day.date === todayDateStr, 'today-animate': day.date === todayDateStr && animatingToday }"
            :title="`Click to view timeline for ${formatDayName(day.date)}, ${formatDayDate(day.date)}`">
            <div class="day-info">
              <div class="day-name">{{ formatDayName(day.date) }}</div>
              <div class="day-date">{{ formatDayDate(day.date) }}</div>
            </div>
            <div class="hours-bar">
              <div class="hours-fill" 
                   :style="{ height: `${getBarHeight(day.hours, day.date, day.inactiveHours)}%` }"
                   :class="{ 'target-met': isDailyTargetMet(day.hours, day.date, day.inactiveHours), 'below-target': !isDailyTargetMet(day.hours, day.date, day.inactiveHours) }"></div>
            </div>
            <div class="day-hours" :class="{ 'target-met': isDailyTargetMet(day.hours, day.date, day.inactiveHours), 'below-target': !isDailyTargetMet(day.hours, day.date, day.inactiveHours) }">
              {{ formatHoursMinutes(getAdjustedHours(day.hours, day.inactiveHours)) }}
              <div class="day-target">
                <span v-if="hasTargetForDate(day.date)">Target: {{ getDailyTargetText(day.date) }}</span>
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
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import type { WeeklyTimeData, WeeklyTarget } from '../types';
import { useDailyTargets } from '../composables/useDailyTargets';

interface Props {
  timeData?: WeeklyTimeData;
  loading?: boolean;
  error?: string;
  target?: WeeklyTarget;
  lastUpdateTime?: Date | null;
  isCurrentWeek?: boolean;
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

// Initialize daily targets composable
const { getDailyTargetForDate: getComposableDailyTarget, weeklyTarget, weekMode, awkOffsetMinutes } = useDailyTargets();

const getTodayDateStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayDateStr = ref<string>(getTodayDateStr());

let midnightTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleMidnightUpdate = () => {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  midnightTimer = setTimeout(() => {
    todayDateStr.value = getTodayDateStr();
    scheduleMidnightUpdate();
  }, msUntilMidnight);
};

onMounted(() => {
  scheduleMidnightUpdate();
});

onUnmounted(() => {
  if (midnightTimer !== null) clearTimeout(midnightTimer);
});

const animatingToday = ref(false);

watch(() => props.loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading && props.isCurrentWeek) {
    animatingToday.value = false;
    requestAnimationFrame(() => {
      animatingToday.value = true;
    });
  }
});

const filteredDailyBreakdown = computed(() => {
  if (!props.timeData?.dailyBreakdown) return [];
  if (weekMode.value !== 'work') return props.timeData.dailyBreakdown;
  return props.timeData.dailyBreakdown.filter(day => {
    const [year, month, d] = day.date.split('-').map(Number);
    const dow = new Date(year, month - 1, d).getDay();
    return dow !== 0 && dow !== 6;
  });
});

const getAdjustedHours = (rawHours: number, inactiveHours: number = 0): number => {
  if (rawHours <= 0) return rawHours;
  const budgetHours = awkOffsetMinutes.value / 60;
  const usedBreak = Math.min(inactiveHours, budgetHours);
  return rawHours + usedBreak;
};

const adjustedTotalHours = computed(() => {
  return filteredDailyBreakdown.value.reduce((sum, day) => sum + getAdjustedHours(day.hours, day.inactiveHours), 0);
});

const maxHours = computed(() => {
  if (!filteredDailyBreakdown.value.length) return 8;
  return Math.max(...filteredDailyBreakdown.value.map(d => getAdjustedHours(d.hours, d.inactiveHours)), 8);
});

const targetTotalHours = computed(() => {
  // Use the weekly target from the composable if available, otherwise fall back to props
  return weeklyTarget.value || (props.target.hours + (props.target.minutes / 60));
});

const targetDisplayText = computed(() => {
  const totalHours = weeklyTarget.value;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
});

const progressPercentage = computed(() => {
  if (!props.timeData) return 0;
  return Math.min((adjustedTotalHours.value / targetTotalHours.value) * 100, 100);
});

const hasExceededTarget = computed(() => {
  if (!props.timeData) return false;
  return adjustedTotalHours.value > targetTotalHours.value;
});

const remainingHours = computed(() => {
  if (!props.timeData) return targetTotalHours.value;
  return Math.max(targetTotalHours.value - adjustedTotalHours.value, 0);
});

const remainingText = computed(() => {
  if (!props.timeData) return `${targetTotalHours.value.toFixed(1)}h remaining`;

  if (hasExceededTarget.value) {
    const excess = adjustedTotalHours.value - targetTotalHours.value;
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

const getDailyTargetForDate = (dateStr: string): number => {
  return getComposableDailyTarget(dateStr);
};

const hasTargetForDate = (dateStr: string): boolean => {
  return getDailyTargetForDate(dateStr) > 0;
};

const getBarHeight = (rawHours: number, dateStr: string, inactiveHours: number = 0): number => {
  const hours = getAdjustedHours(rawHours, inactiveHours);
  if (!hasTargetForDate(dateStr)) {
    return (hours / maxHours.value) * 100;
  }
  const dailyTarget = getDailyTargetForDate(dateStr);
  return Math.min((hours / dailyTarget) * 100, 100);
};

const isDailyTargetMet = (rawHours: number, dateStr: string, inactiveHours: number = 0): boolean => {
  if (!hasTargetForDate(dateStr)) {
    return true;
  }
  const hours = getAdjustedHours(rawHours, inactiveHours);
  const dailyTarget = getDailyTargetForDate(dateStr);
  const roundedHours = Math.round(hours * 1000) / 1000;
  const roundedTarget = Math.round(dailyTarget * 1000) / 1000;
  return roundedHours >= roundedTarget;
};

const isWeekend = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
};

const getDailyTargetText = (dateStr: string): string => {
  const dailyTarget = getDailyTargetForDate(dateStr);
  if (!dailyTarget) return '';
  return formatHoursMinutes(dailyTarget);
};

const formatDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const formatDayDate = (dateStr: string): string => {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
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

// Weekly target stepper functions removed — target is now set in the Settings panel
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

.target-stepper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.target-stepper-btn {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.target-stepper-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}

.target-stepper-btn:disabled {
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
  opacity: 0.5;
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

.day-item.is-today {
  border: 1px solid rgba(39, 174, 96, 0.35);
}

@keyframes todayFade {
  0%   { box-shadow: none; background: transparent; }
  15%  { box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.7); background: rgba(39, 174, 96, 0.15); }
  35%  { box-shadow: none; background: transparent; }
  50%  { box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.5); background: rgba(39, 174, 96, 0.1); }
  100% { box-shadow: none; background: transparent; }
}

.day-item.today-animate {
  animation: todayFade 2.2s ease-in-out 1s forwards;
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
