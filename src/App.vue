<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import SearchFilter from './components/SearchFilter.vue';
import MetricsCards from './components/MetricsCards.vue';
import WithdrawMetricsCards from './components/WithdrawMetricsCards.vue';
import Charts from './components/Charts.vue';
import { parseCSV, calculateMetrics, parseWithdrawCSV, calculateWithdrawMetrics } from './utils/csvParser';

const allRecords = ref([]);
const filteredRecords = ref([]);
const isLoading = ref(true);
const loadingProgress = ref(0);
const loadingStatus = ref('準備載入...');
const dataDate = ref('2026-01-01');

// 分頁切換
const activeTab = ref('deposit'); // 'deposit' or 'withdraw'

// 渠道切換（用於控制 Charts 顯示）
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay'

const handleChannelChange = (channel) => {
  activeChannel.value = channel;
};

const metrics = computed(() => {
  if (activeTab.value === 'withdraw') {
    return calculateWithdrawMetrics(filteredRecords.value);
  }
  return calculateMetrics(filteredRecords.value);
});

// 自動載入資料（含進度顯示）
const loadData = async (type = 'deposit') => {
  isLoading.value = true;
  loadingProgress.value = 0;
  loadingStatus.value = '正在下載數據...';

  const csvFile = type === 'deposit' ? 'data.csv' : 'withdraw.csv';

  try {
    loadingProgress.value = 10;
    const response = await fetch(import.meta.env.BASE_URL + csvFile);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    loadingProgress.value = 30;
    loadingStatus.value = '正在讀取數據...';

    const content = await response.text();
    console.log('CSV 內容長度:', content.length);

    loadingProgress.value = 50;
    loadingStatus.value = '正在解析數據...';

    const parsed = type === 'deposit' ? parseCSV(content) : parseWithdrawCSV(content);
    console.log('解析結果:', parsed.length, '筆記錄');

    loadingProgress.value = 80;
    loadingStatus.value = '正在處理記錄...';

    allRecords.value = parsed;
    filteredRecords.value = [...parsed];

    loadingProgress.value = 100;
    loadingStatus.value = `完成！共 ${parsed.length} 筆記錄`;
    console.log('載入完成 - allRecords:', allRecords.value.length);

  } catch (error) {
    console.error('Error loading data:', error);
    loadingStatus.value = '載入失敗: ' + error.message;
  } finally {
    setTimeout(() => {
      isLoading.value = false;
    }, 500);
  }
};

// 監聽分頁切換
watch(activeTab, (newTab) => {
  loadData(newTab);
});

onMounted(() => {
  loadData('deposit');
});

const handleFilter = (filtered) => {
  filteredRecords.value = filtered;
};
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <h1>💳 數據分析</h1>
        <div class="tab-container">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'deposit' }"
            @click="activeTab = 'deposit'"
          >
            充值
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'withdraw' }"
            @click="activeTab = 'withdraw'"
          >
            提現
          </button>
        </div>
        <div class="data-info">
          <span class="data-date">📅 資料日期：{{ dataDate }}</span>
          <span class="record-count">📊 共 {{ allRecords.length.toLocaleString() }} 筆數</span>
        </div>
      </div>
    </header>

    <main class="main">
      <div v-if="isLoading" class="loading">
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ loadingProgress }}%</div>
        </div>
        <p class="loading-status">{{ loadingStatus }}</p>
      </div>

      <div v-else-if="allRecords.length === 0" class="empty-state">
        <div class="empty-icon">📊</div>
        <h2>無法載入數據</h2>
        <p>請確認資料來源是否正確</p>
      </div>

      <template v-else>
        <SearchFilter :records="allRecords" @filter="handleFilter" />
        <MetricsCards v-if="activeTab === 'deposit'" :metrics="metrics" @channelChange="handleChannelChange" />
        <WithdrawMetricsCards v-else :metrics="metrics" />
        <Charts v-if="activeTab === 'deposit' && activeChannel === 'all'" :records="filteredRecords" />
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

.tab-container {
  display: flex;
  gap: 8px;
  background: #2c2c2e;
  padding: 4px;
  border-radius: 10px;
}

.tab-btn {
  padding: 10px 24px;
  border: none;
  background: transparent;
  color: #8e8e93;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  background: #0a84ff;
  color: #fff;
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
  gap: 20px;
}

.progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 300px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #3a3a3c;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0a84ff, #30d158);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 32px;
  font-weight: 700;
  color: #0a84ff;
}

.loading-status {
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
