import { ref } from 'vue';

const DB_NAME = 'VerifyDataDB';
const DB_VERSION = 2;
const STORE_NAME = 'verifyData';
const HISTORY_STORE_NAME = 'uploadHistory';

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
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        const historyStore = db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
        historyStore.createIndex('uploadTime', 'uploadTime', { unique: false });
      }
    };
  });
};

const saveToIndexedDB = async (key, data) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const serialized = JSON.stringify(data);
    store.put({ id: key, data: serialized });
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  } catch (e) {
    console.error('IndexedDB 保存失败:', e);
  }
};

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
        if (result) {
          try { resolve(JSON.parse(result)); } catch { resolve(result); }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (e) {
    console.error('IndexedDB 读取失败:', e);
    return null;
  }
};

export function useAppStorage({
  depositRecords,
  withdrawRecords,
  depositFileName,
  withdrawFileName,
  dataDate,
  hasDepositData,
  hasWithdrawData,
  allRecords,
  filteredRecords,
  activeTab,
  depositMetrics,
  withdrawMetrics,
}) {
  const historyList = ref([]);
  const showHistoryModal = ref(false);

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

  const saveWithdrawToStorage = async () => {
    try {
      await saveToIndexedDB('withdrawRecords', withdrawRecords.value);
      await saveToIndexedDB('withdrawFileName', withdrawFileName.value);
      console.log('提现数据已保存到 IndexedDB，记录数:', withdrawRecords.value.length);
    } catch (e) {
      console.error('保存提现数据失败:', e);
    }
  };

  const loadFromStorage = async () => {
    try {
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

  // ===== 历史记录管理 =====
  const getDataDateRange = () => {
    let minDate = null;
    let maxDate = null;
    const all = [...depositRecords.value, ...withdrawRecords.value];
    all.forEach(r => {
      const dateStr = r.requestTime ? r.requestTime.split(' ')[0] : null;
      if (dateStr) {
        if (!minDate || dateStr < minDate) minDate = dateStr;
        if (!maxDate || dateStr > maxDate) maxDate = dateStr;
      }
    });
    return { start: minDate || '', end: maxDate || '' };
  };

  const generateHistoryId = (range) => {
    if (range.start === range.end) return range.start;
    return `${range.start}_${range.end}`;
  };

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
            try { resolve(JSON.parse(result)); } catch { resolve(null); }
          } else {
            resolve(null);
          }
        };
        request.onerror = () => { db.close(); reject(request.error); };
      });
    } catch (e) {
      console.error('加载历史记录失败:', e);
      return null;
    }
  };

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
            } catch { return null; }
          }).filter(Boolean).sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
          resolve(historyList.value);
        };
        request.onerror = () => { db.close(); reject(request.error); };
      });
    } catch (e) {
      console.error('加载历史列表失败:', e);
      return [];
    }
  };

  const saveToHistory = async () => {
    if (!hasDepositData.value && !hasWithdrawData.value) {
      alert('请先导入数据');
      return;
    }
    const range = getDataDateRange();
    const historyId = generateHistoryId(range);

    const existing = await loadHistoryById(historyId);
    if (existing) {
      if (!confirm(`日期范围 ${historyId} 的记录已存在，是否覆盖？`)) return;
    }

    const depositMet = depositMetrics?.value || {};
    const withdrawMet = withdrawMetrics?.value || {};

    const historyRecord = {
      id: historyId,
      uploadTime: new Date().toISOString(),
      dataDateRange: range,
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
      },
    };

    try {
      const db = await openDB();
      const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(HISTORY_STORE_NAME);
      store.put({ id: historyId, data: JSON.stringify(historyRecord) });
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
      });
      alert(`已保存到历史记录：${historyId}`);
      await loadHistoryList();
    } catch (e) {
      console.error('保存历史记录失败:', e);
      alert('保存失败: ' + e.message);
    }
  };

  const loadFromHistory = async (id) => {
    const record = await loadHistoryById(id);
    if (!record) { alert('未找到该历史记录'); return; }

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

    await saveDepositToStorage();
    await saveWithdrawToStorage();
    alert(`已加载历史记录：${id}`);
  };

  const deleteHistory = async (id) => {
    if (!confirm(`确定要删除历史记录 ${id} 吗？`)) return;
    try {
      const db = await openDB();
      const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(HISTORY_STORE_NAME);
      store.delete(id);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
      });
      await loadHistoryList();
      alert('已删除历史记录');
    } catch (e) {
      console.error('删除历史记录失败:', e);
      alert('删除失败: ' + e.message);
    }
  };

  const clearAllData = async () => {
    console.log('=== clearAllData 被點擊 ===');
    if (!confirm('确定要清除所有已导入的数据吗？')) return;
    try {
      await indexedDB.deleteDatabase(DB_NAME);
      console.log('IndexedDB 已清除');
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

  return {
    historyList,
    showHistoryModal,
    loadFromStorage,
    saveDepositToStorage,
    saveWithdrawToStorage,
    saveToHistory,
    loadHistoryList,
    loadFromHistory,
    deleteHistory,
    clearAllData,
  };
}
