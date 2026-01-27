<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import SearchFilter from './components/SearchFilter.vue';
import MetricsCards from './components/MetricsCards.vue';
import WithdrawMetricsCards from './components/WithdrawMetricsCards.vue';
import WeeklyReport from './components/WeeklyReport.vue';
import Charts from './components/Charts.vue';
import { parseCSV, calculateMetrics, parseWithdrawCSV, calculateWithdrawMetrics, exportDepositToExcel, exportWithdrawToExcel } from './utils/csvParser';

const allRecords = ref([]);
const filteredRecords = ref([]);
const depositRecords = ref([]); // 充值數據（保留以供提現計算使用）
const withdrawRecords = ref([]); // 提現數據
const isLoading = ref(true);
const loadingProgress = ref(0);
const loadingStatus = ref('准备加载...');
const dataDate = ref('2026-01-01');

// 分頁切換
const activeTab = ref('deposit'); // 'deposit', 'withdraw', or 'weekly'

// 渠道切換（用於控制 Charts 顯示）
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay'

const handleChannelChange = (channel) => {
  activeChannel.value = channel;
};

// 充值指標（用於計算提現的充值配对率）
const depositMetrics = computed(() => {
  return calculateMetrics(depositRecords.value);
});

const metrics = computed(() => {
  if (activeTab.value === 'withdraw') {
    return calculateWithdrawMetrics(filteredRecords.value, depositMetrics.value);
  }
  return calculateMetrics(filteredRecords.value);
});

// 自动加载数据（含进度显示）
const loadData = async (type = 'deposit') => {
  isLoading.value = true;
  loadingProgress.value = 0;
  loadingStatus.value = '正在下载数据...';

  const csvFile = type === 'deposit' ? 'data.csv' : 'withdraw.csv';

  try {
    loadingProgress.value = 10;
    const response = await fetch(import.meta.env.BASE_URL + csvFile);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    loadingProgress.value = 30;
    loadingStatus.value = '正在读取数据...';

    const content = await response.text();
    console.log('CSV 内容长度:', content.length);

    loadingProgress.value = 50;
    loadingStatus.value = '正在解析数据...';

    const parsed = type === 'deposit' ? parseCSV(content) : parseWithdrawCSV(content);
    console.log('解析结果:', parsed.length, '笔记录');

    loadingProgress.value = 80;
    loadingStatus.value = '正在处理记录...';

    if (type === 'deposit') {
      depositRecords.value = parsed;
    } else {
      withdrawRecords.value = parsed;
      // 如果还没加载充值数据，先加载
      if (depositRecords.value.length === 0) {
        loadingStatus.value = '正在加载充值数据...';
        const depositResponse = await fetch(import.meta.env.BASE_URL + 'data.csv');
        if (depositResponse.ok) {
          const depositContent = await depositResponse.text();
          depositRecords.value = parseCSV(depositContent);
          console.log('充值数据加载完成:', depositRecords.value.length, '笔');
        }
      }
    }

    allRecords.value = parsed;
    filteredRecords.value = [...parsed];

    loadingProgress.value = 100;
    loadingStatus.value = `完成！共 ${parsed.length} 笔记录`;
    console.log('加载完成 - allRecords:', allRecords.value.length);

  } catch (error) {
    console.error('Error loading data:', error);
    loadingStatus.value = '加载失败: ' + error.message;
  } finally {
    setTimeout(() => {
      isLoading.value = false;
    }, 500);
  }
};

// 加载周报数据（同时加载充值和提现）
const loadWeeklyData = async () => {
  isLoading.value = true;
  loadingProgress.value = 0;
  loadingStatus.value = '正在加载周报数据...';

  try {
    // 加载充值数据
    loadingProgress.value = 20;
    loadingStatus.value = '正在加载充值数据...';
    const depositResponse = await fetch(import.meta.env.BASE_URL + 'data.csv');
    if (depositResponse.ok) {
      const depositContent = await depositResponse.text();
      depositRecords.value = parseCSV(depositContent);
    }

    // 加载提现数据
    loadingProgress.value = 60;
    loadingStatus.value = '正在加载提现数据...';
    const withdrawResponse = await fetch(import.meta.env.BASE_URL + 'withdraw.csv');
    if (withdrawResponse.ok) {
      const withdrawContent = await withdrawResponse.text();
      withdrawRecords.value = parseWithdrawCSV(withdrawContent);
    }

    loadingProgress.value = 100;
    loadingStatus.value = '周报数据加载完成！';

  } catch (error) {
    console.error('Error loading weekly data:', error);
    loadingStatus.value = '加载失败: ' + error.message;
  } finally {
    setTimeout(() => {
      isLoading.value = false;
    }, 500);
  }
};

// 监听分页切换
watch(activeTab, (newTab) => {
  if (newTab === 'weekly') {
    loadWeeklyData();
  } else {
    loadData(newTab);
  }
});

onMounted(() => {
  loadData('deposit');
});

const handleFilter = (filtered) => {
  filteredRecords.value = filtered;
};

const handleExport = () => {
  if (activeTab.value === 'deposit') {
    exportDepositToExcel(metrics.value, filteredRecords.value);
  } else if (activeTab.value === 'withdraw') {
    exportWithdrawToExcel(metrics.value);
  }
};
</script>

<template>
  <div class="app">
    <!-- 左側導航 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>数据分析</h1>
      </div>
      <nav class="sidebar-nav">
        <button
          class="nav-item"
          :class="{ active: activeTab === 'deposit' }"
          @click="activeTab = 'deposit'"
        >
          <span class="nav-icon">📊</span>
          <span class="nav-text">充值分析報表</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'withdraw' }"
          @click="activeTab = 'withdraw'"
        >
          <span class="nav-icon">💰</span>
          <span class="nav-text">提现分析報表</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'weekly' }"
          @click="activeTab = 'weekly'"
        >
          <span class="nav-icon">📈</span>
          <span class="nav-text">周报</span>
        </button>
      </nav>
    </aside>

    <!-- 主內容區 -->
    <div class="main-wrapper">
      <header class="header">
        <div class="header-content">
          <h2 class="page-title">
            {{ activeTab === 'deposit' ? '充值分析報表' : activeTab === 'withdraw' ? '提现分析報表' : '周报' }}
          </h2>
          <div class="data-info">
            <span class="data-date">📅 数据日期：{{ dataDate }}</span>
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
          <h2>无法加载数据</h2>
          <p>请确认数据来源是否正确</p>
        </div>

        <template v-else>
          <template v-if="activeTab === 'weekly'">
            <WeeklyReport :depositRecords="depositRecords" :withdrawRecords="withdrawRecords" />
          </template>
          <template v-else>
            <SearchFilter :records="allRecords" @filter="handleFilter" @export="handleExport" />
            <MetricsCards v-if="activeTab === 'deposit'" :metrics="metrics" @channelChange="handleChannelChange" />
            <WithdrawMetricsCards v-else :metrics="metrics" />
            <Charts v-if="activeTab === 'deposit' && activeChannel === 'all'" :records="filteredRecords" />
          </template>
        </template>
      </main>
    </div>
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
  background: #f5f7fa;
  color: #333;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
}

/* 左側導航欄 */
.sidebar {
  width: 220px;
  background: linear-gradient(180deg, #4a4a9e 0%, #3a3a8e 100%);
  min-height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-left-color: #fff;
}

.nav-icon {
  font-size: 18px;
}

.nav-text {
  font-weight: 500;
}

/* 主內容區 */
.main-wrapper {
  flex: 1;
  margin-left: 220px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #4a4a9e 0%, #5a5abe 100%);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-content {
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.data-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.data-date,
.record-count {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  background: rgba(255, 255, 255, 0.15);
  padding: 6px 14px;
  border-radius: 6px;
}

.main {
  flex: 1;
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
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a4a9e, #5cb85c);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 32px;
  font-weight: 700;
  color: #4a4a9e;
}

.loading-status {
  color: #666;
  font-size: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 24px;
}

.empty-state h2 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.empty-state p {
  color: #666;
  font-size: 16px;
  margin-bottom: 32px;
}

@media (max-width: 768px) {
  .sidebar {
    width: 60px;
  }

  .sidebar-header h1 {
    display: none;
  }

  .nav-text {
    display: none;
  }

  .nav-item {
    justify-content: center;
    padding: 14px;
  }

  .main-wrapper {
    margin-left: 60px;
  }

  .header-content {
    padding: 12px 16px;
  }

  .page-title {
    font-size: 16px;
  }

  .main {
    padding: 16px;
  }
}
</style>
