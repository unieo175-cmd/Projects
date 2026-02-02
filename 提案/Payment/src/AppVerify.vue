<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import SearchFilter from './components/SearchFilter.vue';
import MetricsCards from './components/MetricsCards.vue';
import WithdrawMetricsCards from './components/WithdrawMetricsCards.vue';
import WeeklyReport from './components/WeeklyReport.vue';
import Charts from './components/Charts.vue';
import FraudStats from './components/FraudStats.vue';
import { parseCSV, calculateMetrics, parseWithdrawCSV, calculateWithdrawMetrics, exportDepositToExcel, exportWithdrawToExcel } from './utils/csvParser';
import * as XLSX from 'xlsx';

// 解析 XLSX 文件转换为 CSV 格式内容
const parseXLSXToCSV = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(firstSheet);
};

// 获取文件扩展名
const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

const allRecords = ref([]);
const filteredRecords = ref([]);
const depositRecords = ref([]);
const withdrawRecords = ref([]);
const isLoading = ref(false);
const loadingProgress = ref(0);
const loadingStatus = ref('等待导入数据...');
const dataDate = ref('2026-01-01');
const dateRange = ref({ dateFrom: '', dateTo: '' });

// 数据导入状态
const hasDepositData = ref(false);
const hasWithdrawData = ref(false);
const depositFileName = ref('');
const withdrawFileName = ref('');

// 分页切换
const activeTab = ref('deposit');

// 侧边栏伸缩
const sidebarCollapsed = ref(false);
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

// 渠道切换
const activeChannel = ref('all');

const handleChannelChange = (channel) => {
  activeChannel.value = channel;
};

// 文件上传限制 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// IndexedDB 数据库名称和版本
const DB_NAME = 'VerifyDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'verifyData';

// 打开 IndexedDB 数据库
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// 保存数据到 IndexedDB (使用 JSON 序列化)
const saveToIndexedDB = async (key, data) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    // 使用 JSON 序列化确保数据可以被存储
    const serialized = JSON.stringify(data);
    store.put({ id: key, data: serialized });

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (e) {
    console.error('IndexedDB 保存失败:', e);
  }
};

// 从 IndexedDB 读取数据
const loadFromIndexedDB = async (key) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const result = request.result?.data;
        // 解析 JSON 数据
        if (result) {
          try {
            resolve(JSON.parse(result));
          } catch {
            resolve(result);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('IndexedDB 读取失败:', e);
    return null;
  }
};

// 保存充值数据
const saveDepositToStorage = async () => {
  try {
    await saveToIndexedDB('depositRecords', depositRecords.value);
    await saveToIndexedDB('depositFileName', depositFileName.value);
    await saveToIndexedDB('dataDate', dataDate.value);
    console.log('充值数据已保存到 IndexedDB，记录数:', depositRecords.value.length);
  } catch (e) {
    console.error('保存充值数据失败:', e);
  }
};

// 保存提现数据
const saveWithdrawToStorage = async () => {
  try {
    await saveToIndexedDB('withdrawRecords', withdrawRecords.value);
    await saveToIndexedDB('withdrawFileName', withdrawFileName.value);
    console.log('提现数据已保存到 IndexedDB，记录数:', withdrawRecords.value.length);
  } catch (e) {
    console.error('保存提现数据失败:', e);
  }
};

// 从 IndexedDB 加载数据
const loadFromStorage = async () => {
  try {
    // 加载充值数据
    const savedDeposit = await loadFromIndexedDB('depositRecords');
    if (savedDeposit && savedDeposit.length > 0) {
      depositRecords.value = savedDeposit;
      hasDepositData.value = true;
      depositFileName.value = await loadFromIndexedDB('depositFileName') || '';
      dataDate.value = await loadFromIndexedDB('dataDate') || '';
      allRecords.value = savedDeposit;
      filteredRecords.value = [...savedDeposit];
      console.log('充值数据已从 IndexedDB 恢复，记录数:', savedDeposit.length);
    }

    // 加载提现数据
    const savedWithdraw = await loadFromIndexedDB('withdrawRecords');
    if (savedWithdraw && savedWithdraw.length > 0) {
      withdrawRecords.value = savedWithdraw;
      hasWithdrawData.value = true;
      withdrawFileName.value = await loadFromIndexedDB('withdrawFileName') || '';
      console.log('提现数据已从 IndexedDB 恢复，记录数:', savedWithdraw.length);
    }
  } catch (e) {
    console.error('加载数据失败:', e);
  }
};

// 页面加载时从 IndexedDB 恢复数据
onMounted(() => {
  loadFromStorage();
});

// 处理充值数据上传
const handleDepositUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    alert('文件大小超过 500MB 限制，请选择较小的文件');
    event.target.value = '';
    return;
  }

  isLoading.value = true;
  loadingProgress.value = 0;
  loadingStatus.value = '正在读取充值数据...';

  try {
    loadingProgress.value = 30;
    const ext = getFileExtension(file.name);
    let content;

    if (ext === 'xlsx' || ext === 'xls') {
      loadingStatus.value = '正在解析 Excel 文件...';
      content = await parseXLSXToCSV(file);
    } else {
      content = await file.text();
    }

    loadingProgress.value = 60;
    loadingStatus.value = '正在解析充值数据...';

    const parsed = parseCSV(content);
    depositRecords.value = parsed;
    hasDepositData.value = true;
    depositFileName.value = file.name;

    // 提取数据日期
    if (parsed.length > 0 && parsed[0].requestTime) {
      dataDate.value = parsed[0].requestTime.split(' ')[0];
    }

    // 更新显示并切换到充值页面
    allRecords.value = parsed;
    filteredRecords.value = [...parsed];
    activeTab.value = 'deposit';

    loadingProgress.value = 100;
    loadingStatus.value = `充值数据导入完成！共 ${parsed.length} 笔记录`;

    // 保存到 IndexedDB
    saveDepositToStorage();

  } catch (error) {
    console.error('Error loading deposit data:', error);
    loadingStatus.value = '导入失败: ' + error.message;
  } finally {
    setTimeout(() => {
      isLoading.value = false;
    }, 500);
    event.target.value = '';
  }
};

// 处理提现数据上传
const handleWithdrawUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    alert('文件大小超过 500MB 限制，请选择较小的文件');
    event.target.value = '';
    return;
  }

  isLoading.value = true;
  loadingProgress.value = 0;
  loadingStatus.value = '正在读取提现数据...';

  try {
    loadingProgress.value = 30;
    const ext = getFileExtension(file.name);
    let content;

    if (ext === 'xlsx' || ext === 'xls') {
      loadingStatus.value = '正在解析 Excel 文件...';
      content = await parseXLSXToCSV(file);
    } else {
      content = await file.text();
    }

    loadingProgress.value = 60;
    loadingStatus.value = '正在解析提现数据...';

    const parsed = parseWithdrawCSV(content);
    withdrawRecords.value = parsed;
    hasWithdrawData.value = true;
    withdrawFileName.value = file.name;

    // 更新显示并切换到提现页面
    allRecords.value = parsed;
    filteredRecords.value = [...parsed];
    activeTab.value = 'withdraw';

    loadingProgress.value = 100;
    loadingStatus.value = `提现数据导入完成！共 ${parsed.length} 笔记录`;

    // 保存到 IndexedDB
    saveWithdrawToStorage();

  } catch (error) {
    console.error('Error loading withdraw data:', error);
    loadingStatus.value = '导入失败: ' + error.message;
  } finally {
    setTimeout(() => {
      isLoading.value = false;
    }, 500);
    event.target.value = '';
  }
};

// 提现指标
const withdrawMetrics = computed(() => {
  if (withdrawRecords.value.length > 0) {
    return calculateWithdrawMetrics(withdrawRecords.value, null);
  }
  return null;
});

// 充值指标
const depositMetrics = computed(() => {
  return calculateMetrics(depositRecords.value, withdrawMetrics.value, dataDate.value);
});

// 按日期筛选的充值指标
const filteredDepositMetrics = computed(() => {
  const effectiveDate = dateRange.value.dateFrom || dataDate.value;
  // 如果只有开始日期，视为单日筛选
  const startDate = dateRange.value.dateFrom || '';
  const endDate = dateRange.value.dateTo || startDate;

  // 筛选充值记录
  let filtered = depositRecords.value;
  if (startDate) {
    filtered = depositRecords.value.filter(r => {
      const recordDate = r.requestTime ? r.requestTime.split(' ')[0] : '';
      if (startDate && recordDate < startDate) return false;
      if (endDate && recordDate > endDate) return false;
      return true;
    });
  }

  console.log('filteredDepositMetrics:', { startDate, endDate, totalRecords: depositRecords.value.length, filteredRecords: filtered.length });

  return calculateMetrics(filtered, withdrawMetrics.value, effectiveDate);
});

const metrics = computed(() => {
  const effectiveDate = dateRange.value.dateFrom || dataDate.value;
  if (activeTab.value === 'withdraw') {
    return calculateWithdrawMetrics(filteredRecords.value, filteredDepositMetrics.value);
  }
  return calculateMetrics(filteredRecords.value, withdrawMetrics.value, effectiveDate);
});

// 监听分页切换
watch(activeTab, (newTab) => {
  if (newTab === 'deposit' && hasDepositData.value) {
    allRecords.value = depositRecords.value;
    filteredRecords.value = [...depositRecords.value];
  } else if (newTab === 'withdraw' && hasWithdrawData.value) {
    allRecords.value = withdrawRecords.value;
    filteredRecords.value = [...withdrawRecords.value];
  } else if (newTab === 'weekly' || newTab === 'fraud') {
    // 周报和骗分统计不需要切换数据
  }
});

const handleFilter = (filtered) => {
  filteredRecords.value = filtered;
};

const handleExport = () => {
  const weekRange = dateRange.value.dateFrom ? {
    start: dateRange.value.dateFrom,
    end: dateRange.value.dateTo || dateRange.value.dateFrom
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

// 判断当前页面是否有数据
const hasCurrentData = computed(() => {
  if (activeTab.value === 'deposit') return hasDepositData.value;
  if (activeTab.value === 'withdraw') return hasWithdrawData.value;
  if (activeTab.value === 'weekly') return hasDepositData.value || hasWithdrawData.value;
  if (activeTab.value === 'fraud') return true;
  return false;
});
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
      </nav>

      <!-- 数据导入区域 -->
      <div class="import-section" v-show="!sidebarCollapsed">
        <div class="import-title">导入数据</div>
        <div class="import-item">
          <label class="import-btn">
            <input type="file" accept=".csv,.xlsx,.xls" @change="handleDepositUpload" hidden />
            <span class="import-icon">📥</span>
            <span>充值数据</span>
          </label>
          <span class="import-status" v-if="hasDepositData">✓</span>
        </div>
        <div class="import-item">
          <label class="import-btn">
            <input type="file" accept=".csv,.xlsx,.xls" @change="handleWithdrawUpload" hidden />
            <span class="import-icon">📥</span>
            <span>提现数据</span>
          </label>
          <span class="import-status" v-if="hasWithdrawData">✓</span>
        </div>
        <div class="import-hint">支持 CSV/Excel，限制: 500MB</div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-wrapper" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <header class="header">
        <div class="header-content">
          <h2 class="page-title">
            <span class="verify-badge">验证版</span>
            {{ activeTab === 'deposit' ? '充值分析报表' : activeTab === 'withdraw' ? '提现分析报表' : activeTab === 'weekly' ? '日/周报数据汇总' : '骗分统计' }}
          </h2>
          <div class="data-info">
            <span class="data-date" v-if="dataDate">📅 数据日期：{{ dataDate }}</span>
            <span class="file-info" v-if="depositFileName">充值: {{ depositFileName }}</span>
            <span class="file-info" v-if="withdrawFileName">提现: {{ withdrawFileName }}</span>
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
          <p>点击左侧「导入数据」按钮上传 CSV 或 Excel 文件</p>
          <div class="upload-buttons">
            <label v-if="activeTab === 'deposit' || activeTab === 'weekly'" class="upload-btn primary">
              <input type="file" accept=".csv,.xlsx,.xls" @change="handleDepositUpload" hidden />
              📥 导入充值数据
            </label>
            <label v-if="activeTab === 'withdraw' || activeTab === 'weekly'" class="upload-btn primary">
              <input type="file" accept=".csv,.xlsx,.xls" @change="handleWithdrawUpload" hidden />
              📥 导入提现数据
            </label>
          </div>
        </div>

        <template v-else>
          <template v-if="activeTab === 'weekly'">
            <WeeklyReport :depositRecords="depositRecords" :withdrawRecords="withdrawRecords" />
          </template>
          <template v-else-if="activeTab === 'fraud'">
            <FraudStats />
          </template>
          <template v-else>
            <SearchFilter :records="allRecords" @filter="handleFilter" @export="handleExport" @dateChange="handleDateChange" />
            <MetricsCards v-if="activeTab === 'deposit'" :metrics="metrics" :dateRange="dateRange" :dataDate="dataDate" @channelChange="handleChannelChange" />
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

/* 数据导入区域 */
.dark-theme .import-section {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid #2a2a4a;
}

.dark-theme .import-title {
  font-size: 12px;
  color: #00d9ff;
  margin-bottom: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.dark-theme .import-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.dark-theme .import-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 217, 255, 0.1);
  border: 1px solid #00d9ff;
  border-radius: 6px;
  color: #00d9ff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.dark-theme .import-btn:hover {
  background: rgba(0, 217, 255, 0.2);
}

.dark-theme .import-icon {
  font-size: 16px;
}

.dark-theme .import-status {
  color: #00ff88;
  font-size: 16px;
}

.dark-theme .import-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 8px;
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
