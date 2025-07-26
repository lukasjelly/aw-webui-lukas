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
        <div class="hours-display">{{ timeData.totalHours }}h</div>
      </div>

      <div class="daily-breakdown">
        <h4>Daily Breakdown</h4>
        <div class="daily-grid">
          <div 
            v-for="day in timeData.dailyBreakdown" 
            :key="day.date"
            class="day-item"
          >
            <div class="day-info">
              <div class="day-name">{{ formatDayName(day.date) }}</div>
              <div class="day-date">{{ formatDayDate(day.date) }}</div>
            </div>
            <div class="hours-bar">
              <div 
                class="hours-fill"
                :style="{ height: `${getBarHeight(day.hours)}%` }"
              ></div>
            </div>
            <div class="day-hours">{{ day.hours }}h</div>
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
import type { WeeklyTimeData } from '../types';

interface Props {
  timeData?: WeeklyTimeData;
  loading?: boolean;
  error?: string;
}

interface Emits {
  (e: 'retry'): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const maxHours = computed(() => {
  if (!props.timeData?.dailyBreakdown) return 8;
  return Math.max(...props.timeData.dailyBreakdown.map(d => d.hours), 8);
});

const getBarHeight = (hours: number): number => {
  return (hours / maxHours.value) * 100;
};

const formatDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  console.log('formatDayName - dateStr:', dateStr, 'parsed date:', date.toDateString(), 'day of week:', date.getDay());
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const formatDayDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

.daily-breakdown h4 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.1rem;
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
  color: #27ae60;
  font-size: 0.9rem;
  margin-top: 0.5rem;
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
  background: linear-gradient(0deg, #27ae60, #2ecc71);
  transition: height 0.5s ease;
  border-radius: 0 0 4px 4px;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #7f8c8d;
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
}
</style>
