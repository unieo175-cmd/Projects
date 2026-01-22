<script setup>
import { ref, computed, onMounted } from 'vue';
import SearchFilter from './components/SearchFilter.vue';
import MetricsCards from './components/MetricsCards.vue';
import Charts from './components/Charts.vue';
import { parseCSV, calculateMetrics } from './utils/csvParser';

const allRecords = ref([]);
const filteredRecords = ref([]);
const isLoading = ref(true);
const dataDate = ref('2026-01-01');

const metrics = computed(() => {
  return calculateMetrics(filteredRecords.value);
});

// 自動載入資料
const loadData = async () => {
  isLoading.value = true;
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'data.csv');
    const content = await response.text();
    allRecords.value = parseCSV(content);
    filteredRecords.value = [...allRecords.value];
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

const handleFilter = (filtered) => {
  filteredRecords.value = filtered;
};
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <h1>💳 充值數據分析平台</h1>
        <div class="data-info">
          <span class="data-date">📅 資料日期：{{ dataDate }}</span>
          <span class="record-count">📊 共 {{ allRecords.length.toLocaleString() }} 筆數</span>
        </div>
      </div>
    </header>

    <main class="main">
      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        <p>正在載入數據...</p>
      </div>

      <div v-else-if="allRecords.length === 0" class="empty-state">
        <div class="empty-icon">📊</div>
        <h2>無法載入數據</h2>
        <p>請確認資料來源是否正確</p>
      </div>

      <template v-else>
        <SearchFilter :records="allRecords" @filter="handleFilter" />
        <MetricsCards :metrics="metrics" />
        <Charts :records="filteredRecords" />
      </template>
    </main>

    <footer class="footer">
      <p>Payment Analytics Dashboard © 2026</p>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #1c1c1e;
  border-bottom: 1px solid #3a3a3c;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header h1 {
  font-size: 24px;
  font-weight: 700;
}

.data-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.data-date,
.record-count {
  color: #8e8e93;
  font-size: 14px;
  background: #2c2c2e;
  padding: 8px 16px;
  border-radius: 8px;
}

.main {
  flex: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #3a3a3c;
  border-top-color: #0a84ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading p {
  color: #8e8e93;
  font-size: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  text-align: center;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 24px;
}

.empty-state h2 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 12px;
}

.empty-state p {
  color: #8e8e93;
  font-size: 16px;
  margin-bottom: 32px;
}

.footer {
  background: #1c1c1e;
  border-top: 1px solid #3a3a3c;
  padding: 20px;
  text-align: center;
}

.footer p {
  color: #8e8e93;
  font-size: 14px;
}

@media (max-width: 768px) {
  .header-content {
    padding: 12px 16px;
  }

  .header h1 {
    font-size: 18px;
  }

  .main {
    padding: 16px;
  }
}
</style>
