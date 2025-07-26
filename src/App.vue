<script setup lang="ts">
import { ref, onMounted } from 'vue';
import WeekView from './components/WeekView.vue';
import HoursSummary from './components/HoursSummary.vue';
import AwServerApi from './services/awServerApi';
import type { WeeklyTimeData, WeeklyTarget } from './types';

const api = new AwServerApi();
const timeData = ref<WeeklyTimeData | undefined>();
const loading = ref(false);
const error = ref<string>('');
const connectionStatus = ref<'connected' | 'disconnected' | 'checking'>('checking');

// Default target: 38 hours and 20 minutes per week (configurable)
const weeklyTarget: WeeklyTarget = { hours: 38, minutes: 20 };

// Calculate current week (Wednesday to Tuesday)
const getCurrentWeek = (): { start: Date; end: Date } => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Find the most recent Wednesday (or current day if it's Wednesday)
  let daysToSubtract;
  switch (dayOfWeek) {
    case 0: // Sunday - go back 4 days to Wednesday
      daysToSubtract = 4;
      break;
    case 1: // Monday - go back 5 days to Wednesday
      daysToSubtract = 5;
      break;
    case 2: // Tuesday - go back 6 days to Wednesday
      daysToSubtract = 6;
      break;
    case 3: // Wednesday - this is the start (0 days back)
      daysToSubtract = 0;
      break;
    case 4: // Thursday - go back 1 day to Wednesday
      daysToSubtract = 1;
      break;
    case 5: // Friday - go back 2 days to Wednesday
      daysToSubtract = 2;
      break;
    case 6: // Saturday - go back 3 days to Wednesday
      daysToSubtract = 3;
      break;
    default:
      daysToSubtract = 0;
  }
  
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { start: weekStart, end: weekEnd };
};

const currentWeek = ref(getCurrentWeek());

const loadTimeData = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    // Check connection first
    connectionStatus.value = 'checking';
    const isConnected = await api.checkConnection();
    
    if (!isConnected) {
      connectionStatus.value = 'disconnected';
      throw new Error('Cannot connect to ActivityWatch server. Please ensure ActivityWatch is running.');
    }
    
    connectionStatus.value = 'connected';
    timeData.value = await api.getWeeklyTimeData(
      currentWeek.value.start,
      currentWeek.value.end
    );
  } catch (err) {
    if (connectionStatus.value !== 'disconnected') {
      connectionStatus.value = 'disconnected';
    }
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    timeData.value = undefined;
  } finally {
    loading.value = false;
  }
};

const onWeekChanged = (start: Date, end: Date) => {
  currentWeek.value = { start, end };
  loadTimeData();
};

const retryLoad = () => {
  loadTimeData();
};

onMounted(() => {
  loadTimeData();
});
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>ActivityWatch Dashboard</h1>
      <p>Track your weekly computer usage and stay productive</p>
      <div class="connection-status" :class="connectionStatus">
        <span class="status-indicator"></span>
        <span class="status-text">
          {{ connectionStatus === 'connected' ? 'Connected to ActivityWatch' : 
             connectionStatus === 'disconnected' ? 'Disconnected from ActivityWatch' : 
             'Checking connection...' }}
        </span>
      </div>
    </header>
    
    <main class="app-main">
      <WeekView 
        :week-start="currentWeek.start"
        :week-end="currentWeek.end"
        @week-changed="onWeekChanged"
      />
      
      <HoursSummary 
        :time-data="timeData"
        :loading="loading"
        :error="error"
        :target="weeklyTarget"
        @retry="retryLoad"
      />
    </main>
    
    <footer class="app-footer">
      <p>Powered by ActivityWatch • Built with Vue 3</p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-header {
  text-align: center;
  padding: 2rem 1rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 2.5rem;
  font-weight: 700;
}

.app-header p {
  margin: 0;
  color: #7f8c8d;
  font-size: 1.1rem;
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.connection-status.connected {
  background: rgba(39, 174, 96, 0.1);
  color: #27ae60;
}

.connection-status.disconnected {
  background: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
}

.connection-status.checking {
  background: rgba(52, 152, 219, 0.1);
  color: #3498db;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.checking .status-indicator {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.app-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.app-footer {
  text-align: center;
  padding: 2rem 1rem;
  color: #7f8c8d;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .app-header h1 {
    font-size: 2rem;
  }
  
  .app-main {
    padding: 1rem;
  }
}
</style>
