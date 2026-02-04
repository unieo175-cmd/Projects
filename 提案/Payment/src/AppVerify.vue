<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import SearchFilter from './components/SearchFilter.vue';
import MetricsCards from './components/MetricsCards.vue';
import WithdrawMetricsCards from './components/WithdrawMetricsCards.vue';
import WeeklyReport from './components/WeeklyReport.vue';
import Charts from './components/Charts.vue';
import FraudStats from './components/FraudStats.vue';
import { parseCSV, calculateMetrics, parseWithdrawCSV, calculateWithdrawMetrics, exportDepositToExcel, exportWithdrawToExcel, exportCompareToExcel } from './utils/csvParser';
import HistoryView from './components/HistoryView.vue';
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

// 检测 CSV 文件类型（充值 or 提现）
const detectFileType = (content) => {
  const lines = content.split('\n');
  if (lines.length < 1) return 'unknown';

  const header = lines[0].toLowerCase();

  // 充值文件特征关键字（检查表头）
  const depositKeywords = ['到帳金額', '到账金额', '銀行名稱', '银行名称', '銀行卡編碼', '银行卡编码', '收款商戶', '收款商户'];
  // 提现文件特征关键字（检查表头）
  const withdrawKeywords = ['收款銀行', '收款银行', '收款卡號', '收款卡号', '收款姓名', '收款地址', '出款商戶', '出款商户', '出款卡編碼', '出款卡编码'];

  const hasDepositKeyword = depositKeywords.some(k => header.includes(k.toLowerCase()));
  const hasWithdrawKeyword = withdrawKeywords.some(k => header.includes(k.toLowerCase()));

  // 如果表头不够明确，检查数据行的特征
  if (!hasDepositKeyword && !hasWithdrawKeyword && lines.length > 1) {
    const dataLine = lines[1].toLowerCase();
    // 充值数据通常有 "已充值", "未充值", "信用評分" 等状态
    const depositStatusKeywords = ['已充值', '未充值', '信用評分', '信用评分', '回單驗證', '回单验证'];
    // 提现数据通常有 "转账完成", "转账失败", "通知完成" 等状态
    const withdrawStatusKeywords = ['转账完成', '轉帳完成', '转账失败', '轉帳失敗', '通知完成'];

    const hasDepositStatus = depositStatusKeywords.some(k => dataLine.includes(k.toLowerCase()));
    const hasWithdrawStatus = withdrawStatusKeywords.some(k => dataLine.includes(k.toLowerCase()));

    if (hasDepositStatus && !hasWithdrawStatus) return 'deposit';
    if (hasWithdrawStatus && !hasDepositStatus) return 'withdraw';
  }

  if (hasDepositKeyword && !hasWithdrawKeyword) return 'deposit';
  if (hasWithdrawKeyword && !hasDepositKeyword) return 'withdraw';

  return 'unknown';
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

// 文件输入 refs
const depositFileInput = ref(null);
const withdrawFileInput = ref(null);

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
const DB_VERSION = 2;
const STORE_NAME = 'verifyData';
const HISTORY_STORE_NAME = 'uploadHistory';

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
      // 新增 uploadHistory store
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        const historyStore = db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
        historyStore.createIndex('uploadTime', 'uploadTime', { unique: false });
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

// ===== 上传历史记录管理 =====
const historyList = ref([]);
const showHistoryModal = ref(false);

// 获取数据日期范围
const getDataDateRange = () => {
  let minDate = null;
  let maxDate = null;

  const allRecords = [...depositRecords.value, ...withdrawRecords.value];
  allRecords.forEach(r => {
    const dateStr = r.requestTime ? r.requestTime.split(' ')[0] : null;
    if (dateStr) {
      if (!minDate || dateStr < minDate) minDate = dateStr;
      if (!maxDate || dateStr > maxDate) maxDate = dateStr;
    }
  });

  return { start: minDate || '', end: maxDate || '' };
};

// 生成历史记录 ID
const generateHistoryId = (dateRange) => {
  if (dateRange.start === dateRange.end) {
    return dateRange.start;
  }
  return `${dateRange.start}_${dateRange.end}`;
};

// 保存到历史记录
const saveToHistory = async () => {
  if (!hasDepositData.value && !hasWithdrawData.value) {
    alert('请先导入数据');
    return;
  }

  const dateRange = getDataDateRange();
  const historyId = generateHistoryId(dateRange);

  // 检查是否已存在
  const existing = await loadHistoryById(historyId);
  if (existing) {
    if (!confirm(`日期范围 ${historyId} 的记录已存在，是否覆盖？`)) {
      return;
    }
  }

  // 计算指标摘要
  const depositMet = depositMetrics.value || {};
  const withdrawMet = withdrawMetrics.value || {};

  const historyRecord = {
    id: historyId,
    uploadTime: new Date().toISOString(),
    dataDateRange: dateRange,
    depositFileName: depositFileName.value,
    withdrawFileName: withdrawFileName.value,
    depositRecords: depositRecords.value,
    withdrawRecords: withdrawRecords.value,
    depositCount: depositRecords.value.length,
    withdrawCount: withdrawRecords.value.length,
    metrics: {
      deposit: {
        totalApplicationCount: depositMet.totalApplicationCount || 0,
        successfulCount: depositMet.successfulCount || 0,
        overallSuccessRate: depositMet.overallSuccessRate || 0,
        totalApplicationAmount: depositMet.totalApplicationAmount || 0,
        overallAvgTime: depositMet.overallAvgTime || 0,
      },
      withdraw: {
        totalWithdrawCount: withdrawMet.totalWithdrawCount || 0,
        totalWithdrawAmount: withdrawMet.totalWithdrawAmount || 0,
        avgProcessingTime: withdrawMet.avgProcessingTime || 0,
      },
    }
  };

  try {
    const db = await openDB();
    const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    // 存储完整数据
    const serialized = JSON.stringify(historyRecord);
    store.put({ id: historyId, data: serialized });

    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });

    alert(`已保存到历史记录：${historyId}`);
    await loadHistoryList();
  } catch (e) {
    console.error('保存历史记录失败:', e);
    alert('保存失败: ' + e.message);
  }
};

// 加载历史记录列表
const loadHistoryList = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction([HISTORY_STORE_NAME], 'readonly');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const results = request.result || [];
        historyList.value = results.map(item => {
          try {
            const parsed = JSON.parse(item.data);
            return {
              id: item.id,
              uploadTime: parsed.uploadTime,
              dataDateRange: parsed.dataDateRange,
              depositFileName: parsed.depositFileName,
              withdrawFileName: parsed.withdrawFileName,
              depositCount: parsed.depositCount,
              withdrawCount: parsed.withdrawCount,
              metrics: parsed.metrics,
            };
          } catch {
            return null;
          }
        }).filter(Boolean).sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
        resolve(historyList.value);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('加载历史列表失败:', e);
    return [];
  }
};

// 通过 ID 加载历史记录
const loadHistoryById = async (id) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([HISTORY_STORE_NAME], 'readonly');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const result = request.result?.data;
        if (result) {
          try {
            resolve(JSON.parse(result));
          } catch {
            resolve(null);
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
    console.error('加载历史记录失败:', e);
    return null;
  }
};

// 从历史记录恢复数据
const loadFromHistory = async (id) => {
  const record = await loadHistoryById(id);
  if (!record) {
    alert('未找到该历史记录');
    return;
  }

  // 恢复数据
  depositRecords.value = record.depositRecords || [];
  withdrawRecords.value = record.withdrawRecords || [];
  depositFileName.value = record.depositFileName || '';
  withdrawFileName.value = record.withdrawFileName || '';
  hasDepositData.value = depositRecords.value.length > 0;
  hasWithdrawData.value = withdrawRecords.value.length > 0;

  if (depositRecords.value.length > 0 && depositRecords.value[0].requestTime) {
    dataDate.value = depositRecords.value[0].requestTime.split(' ')[0];
  }

  allRecords.value = depositRecords.value;
  filteredRecords.value = [...depositRecords.value];
  activeTab.value = 'deposit';

  // 保存到当前 session
  await saveDepositToStorage();
  await saveWithdrawToStorage();

  alert(`已加载历史记录：${id}`);
};

// 删除历史记录
const deleteHistory = async (id) => {
  if (!confirm(`确定要删除历史记录 ${id} 吗？`)) return;

  try {
    const db = await openDB();
    const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    store.delete(id);

    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });

    await loadHistoryList();
    alert('已删除历史记录');
  } catch (e) {
    console.error('删除历史记录失败:', e);
    alert('删除失败: ' + e.message);
  }
};

// 页面加载时从 IndexedDB 恢复数据
onMounted(() => {
  loadFromStorage();
  loadHistoryList();
});

// 测试点击
const testClick = () => {
  console.log('=== TEST CLICK ===');
  window.alert('測試成功！');
};

// 打开文件选择器
const openDepositFile = () => {
  console.log('=== openDepositFile 被點擊 ===');
  const input = depositFileInput.value;
  if (input) {
    console.log('觸發 depositFileInput.click()');
    input.value = ''; // 重置以便重新选择同一文件
    input.click();
  } else {
    console.error('depositFileInput ref 不存在');
  }
};

const openWithdrawFile = () => {
  console.log('=== openWithdrawFile 被點擊 ===');
  const input = withdrawFileInput.value;
  if (input) {
    console.log('觸發 withdrawFileInput.click()');
    input.value = '';
    input.click();
  } else {
    console.error('withdrawFileInput ref 不存在');
  }
};

// 拖放处理
const handleDepositDrop = (e) => {
  console.log('=== handleDepositDrop ===');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleDepositUpload({ target: { files } });
  }
};

const handleWithdrawDrop = (e) => {
  console.log('=== handleWithdrawDrop ===');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleWithdrawUpload({ target: { files } });
  }
};

// 清除所有数据
const clearAllData = async () => {
  console.log('=== clearAllData 被點擊 ===');
  if (!confirm('确定要清除所有已导入的数据吗？')) return;

  try {
    await indexedDB.deleteDatabase(DB_NAME);
    console.log('IndexedDB 已清除');

    // 重置所有状态
    depositRecords.value = [];
    withdrawRecords.value = [];
    allRecords.value = [];
    filteredRecords.value = [];
    hasDepositData.value = false;
    hasWithdrawData.value = false;
    depositFileName.value = '';
    withdrawFileName.value = '';
    dataDate.value = '2026-01-01';

    alert('数据已清除，请重新上传 CSV 文件');
  } catch (e) {
    console.error('清除数据失败:', e);
    alert('清除失败: ' + e.message);
  }
};

// 载入测试数据 (从 public/testdata 目录)
const loadTestData = async () => {
  console.log('=== 开始载入测试数据 ===');
  isLoading.value = true;
  loadingProgress.value = 0;
  loadingStatus.value = '正在载入测试数据...';

  try {
    // 载入充值数据
    loadingStatus.value = '正在载入充值数据...';
    loadingProgress.value = 10;
    console.log('正在 fetch /testdata/deposit.csv ...');
    const depositResponse = await fetch('/testdata/deposit.csv');
    console.log('deposit.csv response status:', depositResponse.status);
    if (!depositResponse.ok) {
      throw new Error('无法载入充值数据: ' + depositResponse.status);
    }
    const depositContent = await depositResponse.text();
    console.log('充值 CSV 内容长度:', depositContent.length, '字符');
    console.log('充值 CSV 行数:', depositContent.split('\n').length);
    loadingProgress.value = 30;

    console.log('开始解析充值数据...');
    const depositParsed = parseCSV(depositContent);
    console.log('充值解析结果:', depositParsed.length, '笔');
    if (depositParsed.length > 0) {
      console.log('第一笔充值记录:', JSON.stringify(depositParsed[0], null, 2));
    } else {
      console.warn('警告: 充值数据解析结果为空!');
    }

    depositRecords.value = depositParsed;
    hasDepositData.value = depositParsed.length > 0;
    depositFileName.value = '24437_充值紀錄_20260126_20260201.csv';

    if (depositParsed.length > 0 && depositParsed[0].requestTime) {
      dataDate.value = depositParsed[0].requestTime.split(' ')[0];
    }
    console.log('充值数据载入完成，记录数:', depositParsed.length);

    // 载入提现数据
    loadingStatus.value = '正在载入提现数据...';
    loadingProgress.value = 50;
    console.log('正在 fetch /testdata/withdraw.csv ...');
    const withdrawResponse = await fetch('/testdata/withdraw.csv');
    console.log('withdraw.csv response status:', withdrawResponse.status);
    if (!withdrawResponse.ok) {
      throw new Error('无法载入提现数据: ' + withdrawResponse.status);
    }
    const withdrawContent = await withdrawResponse.text();
    console.log('提现 CSV 内容长度:', withdrawContent.length, '字符');
    console.log('提现 CSV 行数:', withdrawContent.split('\n').length);
    loadingProgress.value = 70;

    console.log('开始解析提现数据...');
    const withdrawParsed = parseWithdrawCSV(withdrawContent);
    console.log('提现解析结果:', withdrawParsed.length, '笔');
    if (withdrawParsed.length > 0) {
      console.log('第一笔提现记录:', JSON.stringify(withdrawParsed[0], null, 2));
    } else {
      console.warn('警告: 提现数据解析结果为空!');
    }

    withdrawRecords.value = withdrawParsed;
    hasWithdrawData.value = withdrawParsed.length > 0;
    withdrawFileName.value = '24455_提現紀錄_20260126_20260201.csv';
    console.log('提现数据载入完成，记录数:', withdrawParsed.length);

    // 更新显示
    allRecords.value = depositParsed;
    filteredRecords.value = [...depositParsed];
    activeTab.value = 'deposit';
    console.log('已更新显示数据, allRecords:', allRecords.value.length, 'filteredRecords:', filteredRecords.value.length);

    loadingProgress.value = 90;
    loadingStatus.value = '正在保存数据...';

    // 保存到 IndexedDB
    await saveDepositToStorage();
    await saveWithdrawToStorage();
    console.log('数据已保存到 IndexedDB');

    loadingProgress.value = 100;
    loadingStatus.value = `测试数据载入完成！充值 ${depositParsed.length} 笔，提现 ${withdrawParsed.length} 笔`;
    console.log('=== 测试数据载入完成 ===');

  } catch (error) {
    console.error('载入测试数据失败:', error);
    console.error('错误堆栈:', error.stack);
    loadingStatus.value = '载入失败: ' + error.message;
    alert('载入测试数据失败: ' + error.message);
  } finally {
    setTimeout(() => {
      isLoading.value = false;
    }, 1000);
  }
};

// 处理充值数据上传
const handleDepositUpload = async (event) => {
  console.log('handleDepositUpload 被调用', event.target.files);
  const file = event.target.files[0];
  if (!file) {
    console.log('没有选择文件');
    return;
  }
  console.log('开始上传文件:', file.name, '大小:', file.size);

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

    // 检测文件类型
    const detectedType = detectFileType(content);
    console.log('检测到文件类型:', detectedType);

    if (detectedType === 'withdraw') {
      isLoading.value = false;
      const confirmSwitch = confirm('检测到这可能是「提现」数据文件，而非「充值」数据文件。\n\n是否要改为导入到「提现数据」？\n\n点击「确定」导入为提现数据\n点击「取消」仍然按充值数据处理');
      if (confirmSwitch) {
        // 切换到提现数据处理
        isLoading.value = true;
        loadingStatus.value = '正在解析提现数据...';
        const parsed = parseWithdrawCSV(content);
        withdrawRecords.value = parsed;
        hasWithdrawData.value = true;
        withdrawFileName.value = file.name;
        allRecords.value = parsed;
        filteredRecords.value = [...parsed];
        activeTab.value = 'withdraw';
        loadingProgress.value = 100;
        loadingStatus.value = `提现数据导入完成！共 ${parsed.length} 笔记录`;
        saveWithdrawToStorage();
        setTimeout(() => { isLoading.value = false; }, 500);
        event.target.value = '';
        return;
      }
      isLoading.value = true;
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
  console.log('handleWithdrawUpload 被调用', event.target.files);
  const file = event.target.files[0];
  if (!file) {
    console.log('没有选择文件');
    return;
  }
  console.log('开始上传提现文件:', file.name, '大小:', file.size);

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

    // 检测文件类型
    const detectedType = detectFileType(content);
    console.log('检测到文件类型:', detectedType);

    if (detectedType === 'deposit') {
      isLoading.value = false;
      const confirmSwitch = confirm('检测到这可能是「充值」数据文件，而非「提现」数据文件。\n\n是否要改为导入到「充值数据」？\n\n点击「确定」导入为充值数据\n点击「取消」仍然按提现数据处理');
      if (confirmSwitch) {
        // 切换到充值数据处理
        isLoading.value = true;
        loadingStatus.value = '正在解析充值数据...';
        const parsed = parseCSV(content);
        depositRecords.value = parsed;
        hasDepositData.value = true;
        depositFileName.value = file.name;
        if (parsed.length > 0 && parsed[0].requestTime) {
          dataDate.value = parsed[0].requestTime.split(' ')[0];
        }
        allRecords.value = parsed;
        filteredRecords.value = [...parsed];
        activeTab.value = 'deposit';
        loadingProgress.value = 100;
        loadingStatus.value = `充值数据导入完成！共 ${parsed.length} 笔记录`;
        saveDepositToStorage();
        setTimeout(() => { isLoading.value = false; }, 500);
        event.target.value = '';
        return;
      }
      isLoading.value = true;
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
  if (activeTab.value === 'history') return true;  // 历史记录页面总是显示
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
            {{ activeTab === 'deposit' ? '充值分析报表' : activeTab === 'withdraw' ? '提现分析报表' : activeTab === 'weekly' ? '日/周报数据汇总' : activeTab === 'history' ? '上传纪录' : '骗分统计' }}
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
            <WeeklyReport :depositRecords="depositRecords" :withdrawRecords="withdrawRecords" />
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
          <template v-else>
            <SearchFilter :records="allRecords" :hideDate="true" @filter="handleFilter" @export="handleExport" @dateChange="handleDateChange" />
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
