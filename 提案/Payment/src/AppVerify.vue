<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import SearchFilter from './components/SearchFilter.vue';
import MetricsCards from './components/MetricsCards.vue';
import WithdrawMetricsCards from './components/WithdrawMetricsCards.vue';
import WeeklyReport from './components/WeeklyReport.vue';
import Charts from './components/Charts.vue';
import FraudStats from './components/FraudStats.vue';
// import PrdPage from './components/PrdPage.vue';  // 暫時隱藏
import PmMetrics from './components/PmMetrics.vue';
import ReportParams from './components/ReportParams.vue';
import { calculateMetrics, calculateWithdrawMetrics, exportDepositToExcel, exportWithdrawToExcel } from './utils/csvParser';
import HistoryView from './components/HistoryView.vue';
import { useAppStorage } from './composables/useAppStorage';
import { useFileUpload } from './composables/useFileUpload';

// ===== Reactive state =====
const allRecords = ref([]);
const filteredRecords = ref([]);
const depositRecords = ref([]);
const withdrawRecords = ref([]);
const isLoading = ref(false);
const loadingProgress = ref(0);
const loadingStatus = ref('等待导入数据...');
const dataDate = ref('2026-01-01');
const dateRange = ref({ dateFrom: '', dateTo: '' });
const hasDepositData = ref(false);
const hasWithdrawData = ref(false);
const depositFileName = ref('');
const withdrawFileName = ref('');
const activeTab = ref('deposit');
const sidebarCollapsed = ref(false);
const activeChannel = ref('all');

const toggleSidebar = () => { sidebarCollapsed.value = !sidebarCollapsed.value; };
const handleChannelChange = (channel) => { activeChannel.value = channel; };

// ===== Composables =====
const {
  historyList,
  loadFromStorage,
  saveDepositToStorage,
  saveWithdrawToStorage,
  saveToHistory,
  loadHistoryList,
  loadFromHistory,
  deleteHistory,
  clearAllData,
} = useAppStorage({
  depositRecords, withdrawRecords, depositFileName, withdrawFileName,
  dataDate, hasDepositData, hasWithdrawData, allRecords, filteredRecords, activeTab,
  depositMetrics: null, withdrawMetrics: null,
});

const {
  depositFileInput,
  withdrawFileInput,
  handleDepositUpload,
  handleWithdrawUpload,
  loadTestData,
} = useFileUpload({
  depositRecords, withdrawRecords, hasDepositData, hasWithdrawData,
  depositFileName, withdrawFileName, dataDate, activeTab,
  allRecords, filteredRecords, isLoading, loadingProgress, loadingStatus,
  saveDepositToStorage, saveWithdrawToStorage,
});

onMounted(() => {
  loadFromStorage();
  loadHistoryList();
});

// ===== Computed metrics =====
const withdrawMetrics = computed(() => {
  if (withdrawRecords.value.length > 0) {
    return calculateWithdrawMetrics(withdrawRecords.value, null);
  }
  return null;
});

const depositMetrics = computed(() => {
  return calculateMetrics(depositRecords.value, withdrawMetrics.value, dataDate.value);
});

const filteredDepositMetrics = computed(() => {
  const effectiveDate = dateRange.value.dateFrom || dataDate.value;
  const startDate = dateRange.value.dateFrom || '';
  const endDate = dateRange.value.dateTo || startDate;
  let filtered = depositRecords.value;
  if (startDate) {
    filtered = depositRecords.value.filter(r => {
      const recordDate = r.requestTime ? r.requestTime.split(' ')[0] : '';
      if (startDate && recordDate < startDate) return false;
      if (endDate && recordDate > endDate) return false;
      return true;
    });
  }
  return calculateMetrics(filtered, withdrawMetrics.value, effectiveDate);
});

const metrics = computed(() => {
  const effectiveDate = dateRange.value.dateFrom || dataDate.value;
  if (activeTab.value === 'withdraw') {
    return calculateWithdrawMetrics(filteredRecords.value, filteredDepositMetrics.value);
  }
  return calculateMetrics(filteredRecords.value, withdrawMetrics.value, effectiveDate);
});

const hasCurrentData = computed(() => {
  if (activeTab.value === 'deposit') return hasDepositData.value;
  if (activeTab.value === 'withdraw') return hasWithdrawData.value;
  if (activeTab.value === 'weekly') return hasDepositData.value || hasWithdrawData.value;
  if (activeTab.value === 'fraud') return true;
  if (activeTab.value === 'params') return true;
  if (activeTab.value === 'history') return true;
  if (activeTab.value === 'pm') return true;
  return false;
});

// ===== Watchers & handlers =====
watch(activeTab, (newTab) => {
  if (newTab === 'deposit' && hasDepositData.value) {
    allRecords.value = depositRecords.value;
    filteredRecords.value = [...depositRecords.value];
  } else if (newTab === 'withdraw' && hasWithdrawData.value) {
    allRecords.value = withdrawRecords.value;
    filteredRecords.value = [...withdrawRecords.value];
  }
});

const handleFilter = (filtered) => { filteredRecords.value = filtered; };

const handleExport = () => {
  const weekRange = dateRange.value.dateFrom ? {
    start: dateRange.value.dateFrom,
    end: dateRange.value.dateTo || dateRange.value.dateFrom,
  } : null;
  if (activeTab.value === 'deposit') {
    exportDepositToExcel(metrics.value, filteredRecords.value, weekRange);
  } else if (activeTab.value === 'withdraw') {
    exportWithdrawToExcel(metrics.value, weekRange);
  }
};

const handleDateChange = ({ dateFrom, dateTo }) => {
  dateRange.value = { dateFrom, dateTo };
};
</script>

<template>
  <div class="app dark-theme">
    <!-- 左侧导航 -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <h1 v-show="!sidebarCollapsed">验证版-数据分析</h1>
        <button class="toggle-btn" @click="toggleSidebar" :title="sidebarCollapsed ? '展开菜单' : '收起菜单'">
          <span class="toggle-icon">{{ sidebarCollapsed ? '»' : '«' }}</span>
        </button>
      </div>
      <nav class="sidebar-nav">
        <button
          class="nav-item"
          :class="{ active: activeTab === 'deposit' }"
          @click="activeTab = 'deposit'"
          :title="sidebarCollapsed ? '充值分析报表' : ''"
        >
          <span class="nav-icon">📊</span>
          <span class="nav-text" v-show="!sidebarCollapsed">充值分析报表</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'withdraw' }"
          @click="activeTab = 'withdraw'"
          :title="sidebarCollapsed ? '提现分析报表' : ''"
        >
          <span class="nav-icon">💰</span>
          <span class="nav-text" v-show="!sidebarCollapsed">提现分析报表</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'weekly' }"
          @click="activeTab = 'weekly'"
          :title="sidebarCollapsed ? '日/周报数据汇总' : ''"
        >
          <span class="nav-icon">📈</span>
          <span class="nav-text" v-show="!sidebarCollapsed">日/周报数据汇总</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'fraud' }"
          @click="activeTab = 'fraud'"
          :title="sidebarCollapsed ? '骗分统计' : ''"
        >
          <span class="nav-icon">🚫</span>
          <span class="nav-text" v-show="!sidebarCollapsed">骗分统计</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'params' }"
          @click="activeTab = 'params'"
          :title="sidebarCollapsed ? '報表三方設定' : ''"
        >
          <span class="nav-icon">⚙️</span>
          <span class="nav-text" v-show="!sidebarCollapsed">報表三方設定</span>
        </button>
        <!-- 暫時隱藏 PRD 文件
        <button
          class="nav-item"
          :class="{ active: activeTab === 'prd' }"
          @click="activeTab = 'prd'"
          :title="sidebarCollapsed ? 'PRD文件' : ''"
        >
          <span class="nav-icon">📋</span>
          <span class="nav-text" v-show="!sidebarCollapsed">PRD文件</span>
        </button>
        -->
        <button
          class="nav-item pm-link"
          :class="{ active: activeTab === 'pm' }"
          @click="activeTab = 'pm'"
          :title="sidebarCollapsed ? 'PM專用' : ''"
        >
          <span class="nav-icon">👤</span>
          <span class="nav-text" v-show="!sidebarCollapsed">PM專用</span>
        </button>
        <!-- 暫時隱藏上傳紀錄功能
        <div class="nav-divider" v-show="!sidebarCollapsed"></div>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'history' }"
          @click="activeTab = 'history'"
          :title="sidebarCollapsed ? '上传纪录' : ''"
        >
          <span class="nav-icon">📜</span>
          <span class="nav-text" v-show="!sidebarCollapsed">上传纪录</span>
        </button>
        -->
      </nav>

      <!-- 数据导入区域 -->
      <div class="import-section" v-show="!sidebarCollapsed">
        <div class="import-title">数据管理</div>

        <!-- 充值数据 -->
        <label class="upload-label" :class="{ 'has-data': hasDepositData }">
          <input type="file" accept=".csv,.xlsx,.xls" @change="handleDepositUpload" />
          <span class="upload-icon">{{ hasDepositData ? '✓' : '📊' }}</span>
          <span class="upload-text">
            <span class="upload-title">充值数据</span>
            <span class="upload-status">{{ hasDepositData ? depositRecords.length.toLocaleString() + ' 笔' : '点击导入' }}</span>
          </span>
        </label>

        <!-- 提现数据 -->
        <label class="upload-label" :class="{ 'has-data': hasWithdrawData }">
          <input type="file" accept=".csv,.xlsx,.xls" @change="handleWithdrawUpload" />
          <span class="upload-icon">{{ hasWithdrawData ? '✓' : '💰' }}</span>
          <span class="upload-text">
            <span class="upload-title">提现数据</span>
            <span class="upload-status">{{ hasWithdrawData ? withdrawRecords.length.toLocaleString() + ' 笔' : '点击导入' }}</span>
          </span>
        </label>

        <!-- 暫時隱藏保存到历史纪录
        <button class="save-history-btn" @click="saveToHistory" :disabled="!hasDepositData && !hasWithdrawData">
          保存到纪录
        </button>
        -->

        <!-- 清除数据按钮 -->
        <button class="clear-all-btn" @click="clearAllData" :disabled="!hasDepositData && !hasWithdrawData">
          清除所有数据
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-wrapper" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <header class="header">
        <div class="header-content">
          <h2 class="page-title">
            <span class="verify-badge">验证版</span>
            {{ activeTab === 'deposit' ? '充值分析报表' : activeTab === 'withdraw' ? '提现分析报表' : activeTab === 'weekly' ? '日/周报数据汇总' : activeTab === 'history' ? '上传纪录' : activeTab === 'prd' ? 'PRD文件' : activeTab === 'pm' ? 'PM專用' : activeTab === 'params' ? '報表三方設定' : '骗分统计' }}
          </h2>
          <div class="data-info">
            <span class="file-info" v-if="depositFileName">📥 充值: {{ depositFileName }}</span>
            <span class="file-info" v-if="withdrawFileName">📥 提现: {{ withdrawFileName }}</span>
            <span class="version-badge">v1.0.0</span>
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

        <div v-else-if="!hasCurrentData && activeTab !== 'fraud'" class="empty-state">
          <div class="empty-icon">📂</div>
          <h2>请先导入数据</h2>
          <p>请从左侧「数据管理」区域导入 CSV 文件</p>
        </div>

        <template v-else>
          <template v-if="activeTab === 'weekly'">
            <WeeklyReport :depositRecords="depositRecords" :withdrawRecords="withdrawRecords" :showFormula="true" />
          </template>
          <template v-else-if="activeTab === 'fraud'">
            <FraudStats />
          </template>
          <template v-else-if="activeTab === 'history'">
            <HistoryView
              :historyList="historyList"
              @load="loadFromHistory"
              @delete="deleteHistory"
              @refresh="loadHistoryList"
            />
          </template>
          <!-- 暫時隱藏 PRD 文件
          <template v-else-if="activeTab === 'prd'">
            <PrdPage :isVerifyVersion="true" />
          </template>
          -->
          <template v-else-if="activeTab === 'params'">
            <ReportParams />
          </template>
          <template v-else-if="activeTab === 'pm'">
            <PmMetrics />
          </template>
          <template v-else>
            <SearchFilter :records="allRecords" :hideDate="true" @filter="handleFilter" @export="handleExport" @dateChange="handleDateChange" />
            <MetricsCards v-if="activeTab === 'deposit'" :metrics="metrics" :dateRange="dateRange" :dataDate="dataDate" :showFormula="true" @channelChange="handleChannelChange" />
            <WithdrawMetricsCards v-else :metrics="metrics" :showFormula="true" />
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
  background: #1a1a2e;
  color: #e0e0e0;
  min-height: 100vh;
}

.app.dark-theme {
  min-height: 100vh;
  display: flex;
  background: #1a1a2e;
}

/* 左侧导航欄 - 深色版 */
.dark-theme .sidebar {
  width: 220px;
  background: linear-gradient(180deg, #16213e 0%, #0f1628 100%);
  min-height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  border-right: 1px solid #2a2a4a;
}

.dark-theme .sidebar.collapsed {
  width: 60px;
}

.dark-theme .sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #2a2a4a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
}

.dark-theme .sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 20px 10px;
}

.dark-theme .sidebar-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: #00d9ff;
  white-space: nowrap;
  overflow: hidden;
}

.dark-theme .toggle-btn {
  background: rgba(0, 217, 255, 0.1);
  border: 1px solid #00d9ff;
  color: #00d9ff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.dark-theme .toggle-btn:hover {
  background: rgba(0, 217, 255, 0.2);
}

.dark-theme .toggle-icon {
  font-size: 16px;
  font-weight: bold;
}

.dark-theme .sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
}

.dark-theme .nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.dark-theme .nav-item:hover {
  background: rgba(0, 217, 255, 0.1);
  color: #00d9ff;
}

.dark-theme .nav-item.active {
  background: rgba(0, 217, 255, 0.15);
  color: #00d9ff;
  border-left-color: #00d9ff;
}

/* PM 專用按鈕樣式 */
.dark-theme .nav-item.pm-link {
  color: #ff9f0a;
}

.dark-theme .nav-item.pm-link:hover {
  background: rgba(255, 159, 10, 0.15);
  color: #ffb84d;
}

.dark-theme .nav-item.pm-link.active {
  background: rgba(255, 159, 10, 0.2);
  color: #ff9f0a;
  border-left-color: #ff9f0a;
}

/* PM 頁面樣式 */
.pm-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.pm-header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #ff9f0a;
}

.pm-header h1 {
  font-size: 32px;
  color: #ff9f0a;
  margin-bottom: 8px;
}

.pm-subtitle {
  color: #888;
  font-size: 16px;
}

.pm-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.pm-card {
  background: #16213e;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #2a3f5f;
}

.pm-card h3 {
  color: #fff;
  font-size: 18px;
  margin-bottom: 12px;
}

.pm-card p {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.5;
}

.pm-btn {
  background: #0a84ff;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
  margin-bottom: 8px;
  transition: background 0.2s;
}

.pm-btn:hover {
  background: #0070e0;
}

.pm-link-btn {
  display: inline-block;
  background: #30d158;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  text-decoration: none;
  transition: background 0.2s;
}

.pm-link-btn:hover {
  background: #28b84d;
}

.dark-theme .nav-icon {
  font-size: 18px;
}

.dark-theme .nav-text {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
}

.dark-theme .sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 14px;
}

.dark-theme .nav-divider {
  height: 1px;
  background: #2a2a4a;
  margin: 8px 20px;
}

/* 数据管理区域 */
.dark-theme .import-section {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid #2a2a4a;
  position: relative;
  z-index: 100;
}

.dark-theme .import-title {
  font-size: 12px;
  color: #00d9ff;
  margin-bottom: 16px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* 数据状态卡片 */
.dark-theme .data-status-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.dark-theme .data-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dark-theme .data-label {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.dark-theme .data-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.dark-theme .data-badge.success {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
}

.dark-theme .data-badge.empty {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.dark-theme .data-status-info {
  margin-bottom: 8px;
}

.dark-theme .record-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

/* 拖放区域样式 */
.dark-theme .drop-zone {
  background: rgba(0, 217, 255, 0.05);
  border: 2px dashed rgba(0, 217, 255, 0.4);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.dark-theme .drop-zone:hover {
  background: rgba(0, 217, 255, 0.15);
  border-color: #00d9ff;
}

.dark-theme .drop-zone.has-data {
  background: rgba(0, 255, 136, 0.1);
  border-color: rgba(0, 255, 136, 0.5);
  border-style: solid;
}

.dark-theme .drop-zone.has-data:hover {
  background: rgba(0, 255, 136, 0.2);
  border-color: #00ff88;
}

.dark-theme .drop-zone-label {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.dark-theme .drop-zone-status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.dark-theme .drop-zone.has-data .drop-zone-status {
  color: #00ff88;
}

/* 侧边栏上传按钮 */
.dark-theme .upload-label {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: rgba(0, 217, 255, 0.08);
  border: 1px solid rgba(0, 217, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.dark-theme .upload-label:hover {
  background: rgba(0, 217, 255, 0.15);
  border-color: #00d9ff;
  transform: translateY(-1px);
}

.dark-theme .upload-label.has-data {
  background: rgba(0, 255, 136, 0.1);
  border-color: rgba(0, 255, 136, 0.4);
}

.dark-theme .upload-label.has-data:hover {
  background: rgba(0, 255, 136, 0.18);
  border-color: #00ff88;
}

/* 隐藏 file input */
.dark-theme .upload-label input[type="file"] {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.dark-theme .upload-icon {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  flex-shrink: 0;
}

.dark-theme .upload-label.has-data .upload-icon {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
}

.dark-theme .upload-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dark-theme .upload-title {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.dark-theme .upload-status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.dark-theme .upload-label.has-data .upload-status {
  color: #00ff88;
  font-weight: 500;
}

/* 保存到历史纪录按钮 */
.dark-theme .save-history-btn {
  width: 100%;
  padding: 10px 12px;
  margin-top: 8px;
  background: rgba(0, 217, 255, 0.1);
  border: 1px solid rgba(0, 217, 255, 0.5);
  border-radius: 6px;
  color: #00d9ff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  z-index: 10;
}

.dark-theme .save-history-btn:hover:not(:disabled) {
  background: rgba(0, 217, 255, 0.2);
  border-color: #00d9ff;
}

.dark-theme .save-history-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.dark-theme .save-history-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 清除所有数据按钮 */
.dark-theme .clear-all-btn {
  width: 100%;
  padding: 10px 12px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid rgba(255, 100, 100, 0.5);
  border-radius: 6px;
  color: #ff6464;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  z-index: 10;
}

.dark-theme .clear-all-btn:hover:not(:disabled) {
  background: rgba(255, 100, 100, 0.2);
  border-color: #ff6464;
}

.dark-theme .clear-all-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.dark-theme .clear-all-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 隐藏但可访问的文件输入 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 隐藏的文件输入 - 使用 opacity 而非 display:none */
.hidden-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  z-index: -1;
}

/* 主内容区 - 深色版 */
.dark-theme .main-wrapper {
  flex: 1;
  margin-left: 220px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  transition: margin-left 0.3s ease;
  background: #1a1a2e;
}

.dark-theme .main-wrapper.sidebar-collapsed {
  margin-left: 60px;
}

.dark-theme .header {
  background: linear-gradient(135deg, #16213e 0%, #1a1a3e 100%);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #2a2a4a;
}

.dark-theme .header-content {
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.dark-theme .page-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dark-theme .verify-badge {
  background: #ff6b35;
  color: #fff;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.dark-theme .data-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dark-theme .data-date,
.dark-theme .file-info {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  background: rgba(0, 217, 255, 0.1);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(0, 217, 255, 0.3);
}

.dark-theme .version-badge {
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.dark-theme .main {
  flex: 1;
  padding: 24px;
  width: 100%;
}

.dark-theme .loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 20px;
  background: #16213e;
  border-radius: 12px;
  border: 1px solid #2a2a4a;
}

.dark-theme .progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 300px;
}

.dark-theme .progress-bar {
  width: 100%;
  height: 8px;
  background: #2a2a4a;
  border-radius: 4px;
  overflow: hidden;
}

.dark-theme .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00d9ff, #00ff88);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.dark-theme .progress-text {
  font-size: 32px;
  font-weight: 700;
  color: #00d9ff;
}

.dark-theme .loading-status {
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
}

.dark-theme .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  text-align: center;
  background: #16213e;
  border-radius: 12px;
  border: 1px solid #2a2a4a;
}

.dark-theme .empty-icon {
  font-size: 80px;
  margin-bottom: 24px;
}

.dark-theme .empty-state h2 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #fff;
}

.dark-theme .empty-state p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
  margin-bottom: 32px;
}

.dark-theme .upload-buttons {
  display: flex;
  gap: 16px;
}

.dark-theme .upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.dark-theme .upload-btn.primary {
  background: linear-gradient(135deg, #00d9ff 0%, #00a8cc 100%);
  color: #fff;
  border: none;
}

.dark-theme .upload-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 217, 255, 0.3);
}

/* 覆盖子组件样式为深色 */
.dark-theme :deep(.filter-container),
.dark-theme :deep(.metrics-container),
.dark-theme :deep(.card),
.dark-theme :deep(.chart-container) {
  background: #16213e !important;
  border: 1px solid #2a2a4a !important;
  color: #e0e0e0 !important;
}

.dark-theme :deep(.filter-row) {
  background: #16213e !important;
}

.dark-theme :deep(input),
.dark-theme :deep(select) {
  background: #0f1628 !important;
  border-color: #2a2a4a !important;
  color: #e0e0e0 !important;
}

.dark-theme :deep(.btn),
.dark-theme :deep(button) {
  background: rgba(0, 217, 255, 0.1) !important;
  border-color: #00d9ff !important;
  color: #00d9ff !important;
}

.dark-theme :deep(.btn:hover),
.dark-theme :deep(button:hover) {
  background: rgba(0, 217, 255, 0.2) !important;
}

.dark-theme :deep(.section-title),
.dark-theme :deep(.card-title),
.dark-theme :deep(h3),
.dark-theme :deep(h4) {
  color: #00d9ff !important;
}

.dark-theme :deep(.metric-value),
.dark-theme :deep(.stat-value) {
  color: #fff !important;
}

.dark-theme :deep(.metric-label),
.dark-theme :deep(.stat-label) {
  color: rgba(255, 255, 255, 0.6) !important;
}

.dark-theme :deep(table) {
  background: #16213e !important;
}

.dark-theme :deep(th) {
  background: #0f1628 !important;
  color: #00d9ff !important;
  border-color: #2a2a4a !important;
}

.dark-theme :deep(td) {
  border-color: #2a2a4a !important;
  color: #e0e0e0 !important;
}

.dark-theme :deep(tr:hover) {
  background: rgba(0, 217, 255, 0.05) !important;
}

@media (max-width: 768px) {
  .dark-theme .sidebar {
    width: 60px;
  }

  .dark-theme .sidebar.collapsed {
    width: 60px;
  }

  .dark-theme .sidebar-header h1 {
    display: none;
  }

  .dark-theme .toggle-btn {
    display: none;
  }

  .dark-theme .nav-text {
    display: none;
  }

  .dark-theme .nav-item {
    justify-content: center;
    padding: 14px;
  }

  .dark-theme .import-section {
    display: none;
  }

  .dark-theme .main-wrapper,
  .dark-theme .main-wrapper.sidebar-collapsed {
    margin-left: 60px;
  }

  .dark-theme .header-content {
    padding: 12px 16px;
  }

  .dark-theme .page-title {
    font-size: 16px;
  }

  .dark-theme .main {
    padding: 16px;
  }
}
</style>
