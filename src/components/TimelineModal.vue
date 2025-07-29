<template>
  <div v-if="isOpen" class="modal-backdrop" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ formatDate(selectedDate) }} Timeline</h3>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>
      
      <div class="modal-body">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <span>Loading timeline data...</span>
        </div>
        
        <div v-else-if="error" class="error">
          <p>{{ error }}</p>
          <button @click="loadTimelineData" class="retry-btn">Retry</button>
        </div>
        
        <div v-else-if="timelineData && timelineData.length > 0" class="timeline">
          <div class="timeline-stats">
            <div class="stat-item">
              <span class="stat-label">Total Active Time:</span>
              <span class="stat-value active">{{ totalActiveTime }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Inactive Time:</span>
              <span class="stat-value inactive">{{ totalInactiveTime }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Active Periods:</span>
              <span class="stat-value">{{ activePeriodsCount }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Inactive Periods:</span>
              <span class="stat-value">{{ inactivePeriodsCount }}</span>
            </div>
          </div>
          
          <div class="timeline-container">
            <div class="timeline-scale">
              <div v-for="hour in 24" :key="hour" class="hour-mark">
                {{ formatHour(hour - 1) }}
              </div>
            </div>
            
            <div class="timeline-events">
              <div 
                v-for="(event, index) in timelineData" 
                :key="index"
                class="timeline-event"
                :class="event.type"
                :style="getEventStyle(event)"
                :title="`${event.type === 'active' ? 'Active' : 'Inactive'} period: ${formatTime(event.start)} to ${formatTime(event.end)} (${formatDuration(event.duration)})`"
              >
                <div class="event-content">
                  <div class="event-duration">{{ formatDuration(event.duration) }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="time-periods">
            <h4>Time Periods ({{ activePeriodsCount }} active, {{ inactivePeriodsCount }} inactive)</h4>
            <div class="periods-items">
              <div 
                v-for="(event, index) in timelineData" 
                :key="index"
                class="period-item"
                :class="event.type"
              >
                <div class="period-info">
                  <div class="period-type">{{ event.type === 'active' ? 'Active' : 'Inactive' }}</div>
                  <div class="period-time">
                    {{ formatTime(event.start) }} - {{ formatTime(event.end) }}
                  </div>
                </div>
                <div class="period-duration" :class="event.type">{{ formatDuration(event.duration) }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="no-data">
          <p>No activity data available for this day.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import AwServerApi from '../services/awServerApi';

interface TimelineEvent {
  start: Date;
  end: Date;
  duration: number;
  type: 'active' | 'inactive';
}

interface Props {
  isOpen: boolean;
  selectedDate: Date | null;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const api = new AwServerApi();
const timelineData = ref<TimelineEvent[]>([]);
const totalActiveSeconds = ref(0);
const totalInactiveSeconds = ref(0);
const loading = ref(false);
const error = ref('');

const totalActiveTime = computed(() => {
  if (totalActiveSeconds.value === 0) return '0h 0m';
  
  const totalMinutes = totalActiveSeconds.value / 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  
  return `${hours}h ${minutes}m`;
});

const totalInactiveTime = computed(() => {
  if (totalInactiveSeconds.value === 0) return '0h 0m';
  
  const totalMinutes = totalInactiveSeconds.value / 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  
  return `${hours}h ${minutes}m`;
});

const activePeriodsCount = computed(() => {
  return timelineData.value.filter(event => event.type === 'active').length;
});

const inactivePeriodsCount = computed(() => {
  return timelineData.value.filter(event => event.type === 'inactive').length;
});

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatHour = (hour: number): string => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const getEventStyle = (event: TimelineEvent) => {
  const dayStart = new Date(event.start);
  dayStart.setHours(0, 0, 0, 0);
  
  const startMinutes = (event.start.getTime() - dayStart.getTime()) / (1000 * 60);
  const durationMinutes = event.duration / 60;
  
  const startPercent = (startMinutes / (24 * 60)) * 100;
  const widthPercent = (durationMinutes / (24 * 60)) * 100;
  
  return {
    left: `${startPercent}%`,
    width: `${Math.max(widthPercent, 0.5)}%`
  };
};

const loadTimelineData = async () => {
  if (!props.selectedDate) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    const data = await api.getDayTimelineData(props.selectedDate);
    timelineData.value = data.events;
    totalActiveSeconds.value = data.totalActiveSeconds;
    totalInactiveSeconds.value = data.totalInactiveSeconds;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load timeline data';
    timelineData.value = [];
    totalActiveSeconds.value = 0;
    totalInactiveSeconds.value = 0;
  } finally {
    loading.value = false;
  }
};

const closeModal = () => {
  emit('close');
};

watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.selectedDate) {
    loadTimelineData();
  }
});

watch(() => props.selectedDate, () => {
  if (props.isOpen && props.selectedDate) {
    loadTimelineData();
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.3rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #e9ecef;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
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

.timeline-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}

.stat-value.active {
  color: #27ae60;
}

.stat-value.inactive {
  color: #e74c3c;
}

.timeline-container {
  position: relative;
  margin-bottom: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.timeline-scale {
  display: flex;
  background: #f1f3f4;
  border-bottom: 1px solid #ddd;
}

.hour-mark {
  flex: 1;
  padding: 0.5rem 0.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: #666;
  border-right: 1px solid #ddd;
}

.hour-mark:last-child {
  border-right: none;
}

.timeline-events {
  position: relative;
  height: 80px;
  background: linear-gradient(to right, 
    transparent 0%, transparent calc(100%/24 - 1px), 
    #ddd calc(100%/24 - 1px), #ddd calc(100%/24), 
    transparent calc(100%/24));
  background-size: calc(100%/24) 100%;
}

.timeline-event {
  position: absolute;
  top: 8px;
  height: 64px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0.5rem;
  color: white;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.2s;
  overflow: hidden;
}

.timeline-event.active {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
}

.timeline-event.inactive {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

.timeline-event:hover {
  transform: translateY(-2px);
  z-index: 10;
}

.event-content {
  overflow: hidden;
  text-align: center;
  width: 100%;
}

.event-duration {
  font-size: 0.75rem;
  font-weight: 600;
}

.time-periods h4 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.periods-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
}

.period-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.period-item.active {
  border-left: 3px solid #27ae60;
}

.period-item.inactive {
  border-left: 3px solid #e74c3c;
}

.period-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.period-type {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.period-item.active .period-type {
  color: #27ae60;
}

.period-item.inactive .period-type {
  color: #e74c3c;
}

.period-time {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.period-duration {
  font-size: 0.9rem;
  font-weight: 600;
}

.period-duration.active {
  color: #27ae60;
}

.period-duration.inactive {
  color: #e74c3c;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
}

@media (max-width: 768px) {
  .modal-content {
    margin: 0.5rem;
    max-height: 95vh;
  }
  
  .timeline-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .timeline-events {
    height: 60px;
  }
  
  .timeline-event {
    height: 44px;
    padding: 0.25rem;
  }
  
  .period-item {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .period-info {
    width: 100%;
  }
}
</style>
