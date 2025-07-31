<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import WeekView from './components/WeekView.vue';
import HoursSummary from './components/HoursSummary.vue';
import TimelineModal from './components/TimelineModal.vue';
import TargetSettings from './components/TargetSettings.vue';
import AwServerApi from './services/awServerApi';
import { useDailyTargets } from './composables/useDailyTargets';
import type { WeeklyTimeData, WeeklyTarget } from './types';

const api = new AwServerApi();
const timeData = ref<WeeklyTimeData | undefined>();
const loading = ref(false);
const error = ref<string>('');
const connectionStatus = ref<'connected' | 'disconnected' | 'checking'>('checking');

// Get the weekly target from the composable
const { weeklyTarget: composableWeeklyTarget } = useDailyTargets();

// Convert composable target to the format expected by HoursSummary
const weeklyTarget = computed<WeeklyTarget>(() => {
  const totalHours = composableWeeklyTarget.value;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return { hours, minutes };
});

// Auto-refresh settings
const autoRefreshInterval = ref<number | null>(null);
const refreshIntervalMinutes = 0.5; // Refresh every 2 minutes
const lastUpdateTime = ref<Date | null>(null);

// Timeline modal state
const isTimelineModalOpen = ref(false);
const selectedDate = ref<Date | null>(null);

// Settings modal state
const isSettingsModalOpen = ref(false);

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

const loadTimeData = async (isAutoRefresh = false) => {
  // Don't show loading spinner for auto-refresh to avoid UI flickering
  if (!isAutoRefresh) {
    loading.value = true;
  }
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
    lastUpdateTime.value = new Date();
  } catch (err) {
    if (connectionStatus.value !== 'disconnected') {
      connectionStatus.value = 'disconnected';
    }
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    timeData.value = undefined;
  } finally {
    if (!isAutoRefresh) {
      loading.value = false;
    }
  }
};

const onWeekChanged = (start: Date, end: Date) => {
  currentWeek.value = { start, end };
  loadTimeData();
};

const retryLoad = () => {
  loadTimeData();
};

const startAutoRefresh = () => {
  // Clear existing interval if any
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value);
  }
  
  // Set up new interval (convert minutes to milliseconds)
  autoRefreshInterval.value = setInterval(() => {
    // Only auto-refresh if connected and not in loading state
    if (connectionStatus.value === 'connected' && !loading.value) {
      loadTimeData(true);
    }
  }, refreshIntervalMinutes * 60 * 1000);
};

const stopAutoRefresh = () => {
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value);
    autoRefreshInterval.value = null;
  }
};

const openTimeline = (dateStr: string) => {
  selectedDate.value = new Date(dateStr);
  isTimelineModalOpen.value = true;
};

const closeTimelineModal = () => {
  isTimelineModalOpen.value = false;
  selectedDate.value = null;
};

const openSettings = () => {
  isSettingsModalOpen.value = true;
};

const closeSettings = () => {
  isSettingsModalOpen.value = false;
};

onMounted(() => {
  loadTimeData();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="header-top">
        <h1>Work Hours Tracker</h1>
        <button @click="openSettings" class="settings-btn" title="Configure Daily Targets">
          ⚙️ Settings
        </button>
      </div>
      <p>Track your weekly computer usage and stay productive</p>
      <div class="connection-status" :class="connectionStatus">
        <span class="status-indicator"></span>
        <span class="status-text">
          {{ connectionStatus === 'connected' ? 'Connected to ActivityWatch Server' : 
             connectionStatus === 'disconnected' ? 'Disconnected from ActivityWatch Server' : 
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
        :last-update-time="lastUpdateTime"
        @retry="retryLoad"
        @open-timeline="openTimeline"
        @manual-refresh="retryLoad"
      />
    </main>
    
    <footer class="app-footer">
      <p>Powered by ActivityWatch • Built with Vue 3</p>
    </footer>
    
    <!-- Timeline Modal -->
    <TimelineModal 
      :is-open="isTimelineModalOpen"
      :selected-date="selectedDate"
      @close="closeTimelineModal"
    />

    <!-- Settings Modal -->
    <div v-if="isSettingsModalOpen" class="modal-overlay" @click="closeSettings">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Settings</h2>
          <button @click="closeSettings" class="close-btn">✕</button>
        </div>
        <TargetSettings :time-data="timeData" />
      </div>
    </div>
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

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.settings-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #007bff;
  border-radius: 6px;
  background: white;
  color: #007bff;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.settings-btn:hover {
  background: #007bff;
  color: white;
  transform: translateY(-1px);
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

  .header-top {
    flex-direction: column;
    gap: 1rem;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 0;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 1rem;
}

.modal-header h2 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f8f9fa;
  color: #495057;
}
</style>
