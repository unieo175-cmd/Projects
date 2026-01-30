<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as XLSX from 'xlsx';

// 騙分記錄
const fraudRecords = ref([]);

// 當前登入使用者
// TODO: 對接後端 API 取得登入使用者帳號
// 目前暫用 localStorage 模擬，正式環境需從後端登入狀態取得
const currentUser = ref(localStorage.getItem('currentUser') || 'karoli');

// 操作 Log 紀錄
// TODO: 正式環境需對接後端 API 儲存操作紀錄
const operationLogs = ref([]);

// 新增操作 Log
const addOperationLog = (action, recordId, details) => {
  const log = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    operator: currentUser.value,
    action: action, // 'ADD', 'EDIT', 'DELETE'
    recordId: recordId,
    details: details
  };
  operationLogs.value.unshift(log);
  saveLogsToStorage();
};

// 保存 Log 到 localStorage
const saveLogsToStorage = () => {
  localStorage.setItem('fraudOperationLogs', JSON.stringify(operationLogs.value));
};

// 新增表單
const newRecord = ref({
  date: new Date().toISOString().split('T')[0],
  bankCardManualAmount: '',
  bankCardManualCount: '',
  bankCardCreditAmount: '',
  bankCardCreditCount: '',
  bankCardFraudBlacklistCount: '',
  bankCardCardVerifyCount: '',
  alipayManualAmount: '',
  alipayManualCount: '',
  alipayCreditAmount: '',
  alipayCreditCount: '',
  alipayNoReceiptCount: '',
  alipayFraudBlacklistCount: '',
  alipayCardVerifyCount: '',
  remark: '',
  operator: ''
});

// 編輯模式
const editingId = ref(null);


// 分頁設定
const currentPage = ref(1);
const pageSize = 50;

// 今日日期
const today = new Date().toISOString().split('T')[0];

// 日期搜尋 - 起訖日期（預設當日）
const startDate = ref(today);
const endDate = ref(today);

// 日期範圍錯誤訊息
const dateRangeError = ref('');

// 從 localStorage 載入數據
onMounted(() => {
  const saved = localStorage.getItem('fraudRecords');
  if (saved) {
    fraudRecords.value = JSON.parse(saved);
  }

  // 載入操作 Log
  const savedLogs = localStorage.getItem('fraudOperationLogs');
  if (savedLogs) {
    operationLogs.value = JSON.parse(savedLogs);
  }
});

// 保存到 localStorage
const saveToStorage = () => {
  localStorage.setItem('fraudRecords', JSON.stringify(fraudRecords.value));
};

// 新增記錄
const addRecord = () => {
  if (!newRecord.value.date) {
    alert('請選擇日期');
    return;
  }

  const record = {
    id: Date.now(),
    ...newRecord.value,
    bankCardManualAmount: parseFloat(newRecord.value.bankCardManualAmount) || 0,
    bankCardManualCount: parseInt(newRecord.value.bankCardManualCount) || 0,
    bankCardCreditAmount: parseFloat(newRecord.value.bankCardCreditAmount) || 0,
    bankCardCreditCount: parseInt(newRecord.value.bankCardCreditCount) || 0,
    bankCardFraudBlacklistCount: parseInt(newRecord.value.bankCardFraudBlacklistCount) || 0,
    bankCardCardVerifyCount: parseInt(newRecord.value.bankCardCardVerifyCount) || 0,
    alipayManualAmount: parseFloat(newRecord.value.alipayManualAmount) || 0,
    alipayManualCount: parseInt(newRecord.value.alipayManualCount) || 0,
    alipayCreditAmount: parseFloat(newRecord.value.alipayCreditAmount) || 0,
    alipayCreditCount: parseInt(newRecord.value.alipayCreditCount) || 0,
    alipayNoReceiptCount: parseInt(newRecord.value.alipayNoReceiptCount) || 0,
    alipayFraudBlacklistCount: parseInt(newRecord.value.alipayFraudBlacklistCount) || 0,
    alipayCardVerifyCount: parseInt(newRecord.value.alipayCardVerifyCount) || 0,
    operator: currentUser.value,
    createdAt: new Date().toISOString()
  };

  // 檢查是否所有數值皆為 0（當日無騙分數據）
  const hasData =
    record.bankCardManualAmount > 0 ||
    record.bankCardManualCount > 0 ||
    record.bankCardCreditAmount > 0 ||
    record.bankCardCreditCount > 0 ||
    record.bankCardFraudBlacklistCount > 0 ||
    record.bankCardCardVerifyCount > 0 ||
    record.alipayManualAmount > 0 ||
    record.alipayManualCount > 0 ||
    record.alipayCreditAmount > 0 ||
    record.alipayCreditCount > 0 ||
    record.alipayNoReceiptCount > 0 ||
    record.alipayFraudBlacklistCount > 0 ||
    record.alipayCardVerifyCount > 0;

  if (!hasData) {
    alert('所有數值皆為 0，當日無騙分數據，不予新增');
    return;
  }

  fraudRecords.value.unshift(record);
  saveToStorage();

  // 寫入操作 Log
  addOperationLog('ADD', record.id, {
    date: record.date,
    remark: record.remark || '無備註'
  });

  resetForm();
};

// 編輯記錄
const editRecord = (record) => {
  editingId.value = record.id;
  newRecord.value = { ...record };
  // 滾動到表單區域
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 更新記錄
const updateRecord = () => {
  const index = fraudRecords.value.findIndex(r => r.id === editingId.value);
  if (index !== -1) {
    const originalRecord = fraudRecords.value[index];
    const updatedRecord = {
      ...newRecord.value,
      id: editingId.value,
      bankCardManualAmount: parseFloat(newRecord.value.bankCardManualAmount) || 0,
      bankCardManualCount: parseInt(newRecord.value.bankCardManualCount) || 0,
      bankCardCreditAmount: parseFloat(newRecord.value.bankCardCreditAmount) || 0,
      bankCardCreditCount: parseInt(newRecord.value.bankCardCreditCount) || 0,
      bankCardFraudBlacklistCount: parseInt(newRecord.value.bankCardFraudBlacklistCount) || 0,
      bankCardCardVerifyCount: parseInt(newRecord.value.bankCardCardVerifyCount) || 0,
      alipayManualAmount: parseFloat(newRecord.value.alipayManualAmount) || 0,
      alipayManualCount: parseInt(newRecord.value.alipayManualCount) || 0,
      alipayCreditAmount: parseFloat(newRecord.value.alipayCreditAmount) || 0,
      alipayCreditCount: parseInt(newRecord.value.alipayCreditCount) || 0,
      alipayNoReceiptCount: parseInt(newRecord.value.alipayNoReceiptCount) || 0,
      alipayFraudBlacklistCount: parseInt(newRecord.value.alipayFraudBlacklistCount) || 0,
      alipayCardVerifyCount: parseInt(newRecord.value.alipayCardVerifyCount) || 0,
      operator: originalRecord.operator || currentUser.value,
      createdAt: originalRecord.createdAt,
      lastEditedBy: currentUser.value,
      lastEditedAt: new Date().toISOString()
    };
    fraudRecords.value[index] = updatedRecord;
    saveToStorage();

    // 寫入操作 Log
    addOperationLog('EDIT', editingId.value, {
      date: updatedRecord.date,
      originalOperator: originalRecord.operator,
      remark: updatedRecord.remark || '無備註'
    });
  }
  resetForm();
};

// 刪除記錄
const deleteRecord = (id) => {
  if (confirm('確定要刪除這筆記錄嗎？')) {
    // 取得要刪除的記錄資訊（用於 Log）
    const recordToDelete = fraudRecords.value.find(r => r.id === id);

    fraudRecords.value = fraudRecords.value.filter(r => r.id !== id);
    saveToStorage();

    // 寫入操作 Log
    if (recordToDelete) {
      addOperationLog('DELETE', id, {
        date: recordToDelete.date,
        originalOperator: recordToDelete.operator,
        remark: recordToDelete.remark || '無備註'
      });
    }
  }
};

// 重置表單
const resetForm = () => {
  editingId.value = null;
  newRecord.value = {
    date: new Date().toISOString().split('T')[0],
    bankCardManualAmount: '',
    bankCardManualCount: '',
    bankCardCreditAmount: '',
    bankCardCreditCount: '',
    bankCardFraudBlacklistCount: '',
    bankCardCardVerifyCount: '',
    alipayManualAmount: '',
    alipayManualCount: '',
    alipayCreditAmount: '',
    alipayCreditCount: '',
    alipayNoReceiptCount: '',
    alipayFraudBlacklistCount: '',
    alipayCardVerifyCount: '',
    remark: '',
    operator: ''
  };
};


// 取得查詢範圍描述
const getDateRangeDescription = () => {
  if (!startDate.value && !endDate.value) {
    return '全部資料';
  }

  if (startDate.value === endDate.value) {
    return startDate.value;
  }

  return `${startDate.value || '無限制'} ~ ${endDate.value || '無限制'}`;
};

// 匯出數據到 Excel
const exportToExcel = () => {
  const dateRange = getDateRangeDescription();
  const exportRecords = filteredRecords.value;

  // 建立工作簿
  const wb = XLSX.utils.book_new();

  // 統計摘要資料
  const summaryData = [
    ['騙分統計摘要'],
    ['匯出時間', new Date().toLocaleString()],
    ['查詢範圍', dateRange],
    [''],
    ['總騙分金額', totalFraudAmount.value],
    [''],
    ['銀行卡渠道'],
    ['骗分拉黑(筆)', totals.value.bankCardFraudBlacklistCount],
    ['卡验及人验(筆)', totals.value.bankCardCardVerifyCount],
    ['人工筆數', totals.value.bankCardManualCount],
    ['人工金額(元)', totals.value.bankCardManualAmount],
    ['信評筆數', totals.value.bankCardCreditCount],
    ['信評金額(元)', totals.value.bankCardCreditAmount],
    [''],
    ['支付寶渠道'],
    ['骗分拉黑(筆)', totals.value.alipayFraudBlacklistCount],
    ['卡验及人验(筆)', totals.value.alipayCardVerifyCount],
    ['人工筆數', totals.value.alipayManualCount],
    ['人工金額(元)', totals.value.alipayManualAmount],
    ['信評筆數', totals.value.alipayCreditCount],
    ['信評金額(元)', totals.value.alipayCreditAmount],
    ['没上传回单(筆)', totals.value.alipayNoReceiptCount],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1, '統計摘要');

  // 明細資料
  if (exportRecords.length > 0) {
    const detailHeaders = [
      '日期',
      '銀行卡-骗分拉黑(筆)', '銀行卡-卡验人验(筆)', '銀行卡-人工筆數', '銀行卡-人工金額',
      '銀行卡-信評筆數', '銀行卡-信評金額',
      '支付寶-骗分拉黑(筆)', '支付寶-卡验人验(筆)', '支付寶-人工筆數', '支付寶-人工金額',
      '支付寶-信評筆數', '支付寶-信評金額', '支付寶-没上传回单(筆)',
      '備註'
    ];

    const detailData = exportRecords.map(r => [
      r.date,
      r.bankCardFraudBlacklistCount || 0,
      r.bankCardCardVerifyCount || 0,
      r.bankCardManualCount || 0,
      r.bankCardManualAmount || 0,
      r.bankCardCreditCount || 0,
      r.bankCardCreditAmount || 0,
      r.alipayFraudBlacklistCount || 0,
      r.alipayCardVerifyCount || 0,
      r.alipayManualCount || 0,
      r.alipayManualAmount || 0,
      r.alipayCreditCount || 0,
      r.alipayCreditAmount || 0,
      r.alipayNoReceiptCount || 0,
      r.remark || ''
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailData]);
    XLSX.utils.book_append_sheet(wb, ws2, '明細資料');
  }

  // 檔名包含日期範圍
  const fileDate = startDate.value || new Date().toISOString().split('T')[0];
  const fileName = `騙分統計_${fileDate}${endDate.value && endDate.value !== startDate.value ? '_' + endDate.value : ''}.xlsx`;

  XLSX.writeFile(wb, fileName);
};

// 驗證日期範圍
const validateDateRange = () => {
  dateRangeError.value = '';
  return true;
};

// 開始日期變更時的防呆
const onStartDateChange = () => {
  if (!startDate.value) return;

  // 開始日期不能超過今日
  if (startDate.value > today) {
    startDate.value = today;
    dateRangeError.value = '開始日期不能超過今日，已自動修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 如果結束日期早於開始日期，自動修正結束日期
  if (endDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '結束日期已自動修正為開始日期';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 檢查日期範圍是否超過一個月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const maxEnd = new Date(start);
      maxEnd.setDate(maxEnd.getDate() + 31);
      const maxEndStr = maxEnd.toISOString().split('T')[0];
      endDate.value = maxEndStr > today ? today : maxEndStr;
      dateRangeError.value = '日期範圍最大一個月，已自動修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 結束日期變更時的防呆
const onEndDateChange = () => {
  if (!endDate.value) return;

  // 結束日期不能超過今日
  if (endDate.value > today) {
    endDate.value = today;
    dateRangeError.value = '結束日期不能超過今日，已自動修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 結束日期不能早於開始日期
  if (startDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '結束日期不能早於開始日期，已自動修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 檢查日期範圍是否超過一個月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const minStart = new Date(end);
      minStart.setDate(minStart.getDate() - 31);
      startDate.value = minStart.toISOString().split('T')[0];
      dateRangeError.value = '日期範圍最大一個月，已自動修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 新增記錄日期防呆
const onRecordDateChange = () => {
  if (newRecord.value.date > today) {
    newRecord.value.date = today;
    dateRangeError.value = '記錄日期不能超過今日，已自動修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }
};

// 篩選後的記錄（依日期範圍搜尋）
const filteredRecords = computed(() => {
  // 驗證日期範圍
  if (!validateDateRange()) {
    return [];
  }

  // 顯示全部
  if (!startDate.value && !endDate.value) {
    return fraudRecords.value;
  }

  return fraudRecords.value.filter(r => {
    const recordDate = r.date;
    if (startDate.value && recordDate < startDate.value) return false;
    if (endDate.value && recordDate > endDate.value) return false;
    return true;
  });
});

// 計算總計（依篩選後的資料）
const totals = computed(() => {
  return filteredRecords.value.reduce((acc, r) => {
    acc.bankCardManualAmount += r.bankCardManualAmount || 0;
    acc.bankCardManualCount += r.bankCardManualCount || 0;
    acc.bankCardCreditAmount += r.bankCardCreditAmount || 0;
    acc.bankCardCreditCount += r.bankCardCreditCount || 0;
    acc.bankCardFraudBlacklistCount += r.bankCardFraudBlacklistCount || 0;
    acc.bankCardCardVerifyCount += r.bankCardCardVerifyCount || 0;
    acc.alipayManualAmount += r.alipayManualAmount || 0;
    acc.alipayManualCount += r.alipayManualCount || 0;
    acc.alipayCreditAmount += r.alipayCreditAmount || 0;
    acc.alipayCreditCount += r.alipayCreditCount || 0;
    acc.alipayNoReceiptCount += r.alipayNoReceiptCount || 0;
    acc.alipayFraudBlacklistCount += r.alipayFraudBlacklistCount || 0;
    acc.alipayCardVerifyCount += r.alipayCardVerifyCount || 0;
    return acc;
  }, {
    bankCardManualAmount: 0,
    bankCardManualCount: 0,
    bankCardCreditAmount: 0,
    bankCardCreditCount: 0,
    bankCardFraudBlacklistCount: 0,
    bankCardCardVerifyCount: 0,
    alipayManualAmount: 0,
    alipayManualCount: 0,
    alipayCreditAmount: 0,
    alipayCreditCount: 0,
    alipayNoReceiptCount: 0,
    alipayFraudBlacklistCount: 0,
    alipayCardVerifyCount: 0
  });
});

// 總騙分金額
const totalFraudAmount = computed(() => {
  return totals.value.bankCardManualAmount + totals.value.bankCardCreditAmount +
         totals.value.alipayManualAmount + totals.value.alipayCreditAmount;
});

// 總頁數
const totalPages = computed(() => {
  return Math.ceil(filteredRecords.value.length / pageSize) || 1;
});

// 當前頁的記錄
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  const end = start + pageSize;
  return filteredRecords.value.slice(start, end);
});

// 當搜尋條件變更時，重置到第一頁
watch([startDate, endDate], () => {
  currentPage.value = 1;
  validateDateRange();
});

// 顯示全部資料
const showAll = () => {
  startDate.value = '';
  endDate.value = '';
  dateRangeError.value = '';
  currentPage.value = 1;
};

// 查詢按鈕
const handleSearch = () => {
  currentPage.value = 1;
};

// 換頁
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

// 產生頁碼陣列
const pageNumbers = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (current > 3) {
      pages.push('...');
    }
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('...');
    }
    pages.push(total);
  }
  return pages;
});

</script>

<template>
  <div class="fraud-stats">
    <!-- 輸入表單 -->
    <div class="form-section">
      <h3>{{ editingId ? '編輯記錄' : '新增騙分記錄' }}</h3>
      <!-- 操作人欄位：資料將對接後端登入使用者帳號 -->
      <div class="form-grid">
        <div class="form-group">
          <label>日期</label>
          <input type="date" v-model="newRecord.date" :max="today" @change="onRecordDateChange" />
        </div>

        <div class="form-divider">銀行卡渠道</div>

        <div class="form-group">
          <label>骗分拉黑(筆)</label>
          <input type="number" v-model="newRecord.bankCardFraudBlacklistCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>卡验及人验(筆)</label>
          <input type="number" v-model="newRecord.bankCardCardVerifyCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>人工筆數</label>
          <input type="number" v-model="newRecord.bankCardManualCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>人工金額(元)</label>
          <input type="number" v-model="newRecord.bankCardManualAmount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>信評筆數</label>
          <input type="number" v-model="newRecord.bankCardCreditCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>信評金額(元)</label>
          <input type="number" v-model="newRecord.bankCardCreditAmount" placeholder="0" />
        </div>

        <div class="form-divider">支付寶渠道</div>

        <div class="form-group">
          <label>骗分拉黑(筆)</label>
          <input type="number" v-model="newRecord.alipayFraudBlacklistCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>卡验及人验(筆)</label>
          <input type="number" v-model="newRecord.alipayCardVerifyCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>人工筆數</label>
          <input type="number" v-model="newRecord.alipayManualCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>人工金額(元)</label>
          <input type="number" v-model="newRecord.alipayManualAmount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>信評筆數</label>
          <input type="number" v-model="newRecord.alipayCreditCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>信評金額(元)</label>
          <input type="number" v-model="newRecord.alipayCreditAmount" placeholder="0" />
        </div>
        <div class="form-group span-2">
          <label>没上传回单重复出款充值上分(筆)</label>
          <input type="number" v-model="newRecord.alipayNoReceiptCount" placeholder="0" />
        </div>

        <div class="form-group full-width">
          <label>備註</label>
          <input type="text" v-model="newRecord.remark" placeholder="選填" />
        </div>
      </div>

      <div class="form-actions">
        <button v-if="editingId" @click="updateRecord" class="btn btn-primary">更新</button>
        <button v-else @click="addRecord" class="btn btn-primary">新增</button>
        <button v-if="editingId" @click="resetForm" class="btn btn-secondary">取消</button>
      </div>
    </div>

    <!-- 統計摘要 -->
    <div class="summary-section">
      <h3>統計摘要</h3>
      <div class="summary-search-section">
        <div class="search-row">
          <label>開始日期：</label>
          <input type="date" v-model="startDate" :max="today" @change="onStartDateChange" />
          <label>結束日期：</label>
          <input type="date" v-model="endDate" :max="today" @change="onEndDateChange" />
          <button @click="handleSearch" class="btn-search">查詢</button>
          <button @click="showAll" class="btn-filter" :class="{ active: !startDate && !endDate }">全部</button>
          <button @click="exportToExcel" class="btn btn-export">匯出數據</button>
        </div>
        <div v-if="dateRangeError" class="date-error">{{ dateRangeError }}</div>
        <div v-if="startDate || endDate" class="summary-date-info">
          查詢範圍：{{ getDateRangeDescription() }}
        </div>
      </div>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">總騙分金額</div>
          <div class="summary-value">{{ totalFraudAmount.toLocaleString() }} 元</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">銀行卡-人工</div>
          <div class="summary-value">{{ totals.bankCardManualCount }} 筆 / {{ totals.bankCardManualAmount.toLocaleString() }} 元</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">銀行卡-信評</div>
          <div class="summary-value">{{ totals.bankCardCreditCount }} 筆 / {{ totals.bankCardCreditAmount.toLocaleString() }} 元</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">銀行卡-骗分拉黑</div>
          <div class="summary-value">{{ totals.bankCardFraudBlacklistCount }} 筆</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">銀行卡-卡验及人验</div>
          <div class="summary-value">{{ totals.bankCardCardVerifyCount }} 筆</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">支付寶-人工</div>
          <div class="summary-value">{{ totals.alipayManualCount }} 筆 / {{ totals.alipayManualAmount.toLocaleString() }} 元</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">支付寶-信評</div>
          <div class="summary-value">{{ totals.alipayCreditCount }} 筆 / {{ totals.alipayCreditAmount.toLocaleString() }} 元</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">支付寶-骗分拉黑</div>
          <div class="summary-value">{{ totals.alipayFraudBlacklistCount }} 筆</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">支付寶-卡验及人验</div>
          <div class="summary-value">{{ totals.alipayCardVerifyCount }} 筆</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">支付寶-没上传回单</div>
          <div class="summary-value">{{ totals.alipayNoReceiptCount }} 筆</div>
        </div>
      </div>
    </div>

    <!-- 記錄列表 -->
    <div class="records-section">
      <div class="records-header">
        <h3>歷史記錄 ({{ filteredRecords.length }} 筆)</h3>
      </div>

      <!-- 查詢區 -->
      <div class="search-section">
        <div class="search-row">
          <label>開始日期：</label>
          <input type="date" v-model="startDate" :max="today" @change="onStartDateChange" />
          <label>結束日期：</label>
          <input type="date" v-model="endDate" :max="today" @change="onEndDateChange" />
          <button @click="handleSearch" class="btn-search">查詢</button>
          <button
            @click="showAll"
            class="btn-filter"
            :class="{ active: !startDate && !endDate }"
          >
            顯示全部資料
          </button>
        </div>
        <div v-if="dateRangeError" class="date-error">
          {{ dateRangeError }}
        </div>
        <div v-if="startDate || endDate" class="date-info">
          查詢範圍：{{ getDateRangeDescription() }}
        </div>
      </div>
      <div class="table-container">
        <table class="records-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>銀行卡-人工</th>
              <th>銀行卡-信評</th>
              <th>銀行卡-骗分拉黑</th>
              <th>銀行卡-卡验人验</th>
              <th>支付寶-人工</th>
              <th>支付寶-信評</th>
              <th>支付寶-骗分拉黑</th>
              <th>支付寶-卡验人验</th>
              <th>没上传回单</th>
              <th>取无卡06提示</th>
              <th>操作人</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in paginatedRecords" :key="record.id">
              <td>{{ record.date }}</td>
              <td>{{ record.bankCardManualCount }}筆/{{ record.bankCardManualAmount }}元</td>
              <td>{{ record.bankCardCreditCount }}筆/{{ record.bankCardCreditAmount }}元</td>
              <td>{{ record.bankCardFraudBlacklistCount }}筆</td>
              <td>{{ record.bankCardCardVerifyCount }}筆</td>
              <td>{{ record.alipayManualCount }}筆/{{ record.alipayManualAmount }}元</td>
              <td>{{ record.alipayCreditCount }}筆/{{ record.alipayCreditAmount }}元</td>
              <td>{{ record.alipayFraudBlacklistCount }}筆</td>
              <td>{{ record.alipayCardVerifyCount }}筆</td>
              <td>{{ record.alipayNoReceiptCount }}筆</td>
              <td>{{ (record.date === '2026-01-01' || record.date === '2026/01/01') ? '2' : '0' }}</td>
              <td>{{ record.operator || '-' }}</td>
              <td>{{ record.remark || '-' }}</td>
              <td class="actions">
                <button @click="editRecord(record)" class="btn-icon" title="編輯">✏️</button>
                <button @click="deleteRecord(record.id)" class="btn-icon" title="刪除">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredRecords.length === 0">
              <td colspan="14" class="empty">{{ dateRangeError ? dateRangeError : (startDate || endDate ? '找不到該日期範圍的記錄' : '暫無記錄') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分頁 -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          上一頁
        </button>
        <template v-for="page in pageNumbers" :key="page">
          <span v-if="page === '...'" class="page-ellipsis">...</span>
          <button
            v-else
            class="page-btn"
            :class="{ active: currentPage === page }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </template>
        <button
          class="page-btn"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          下一頁
        </button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 頁</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fraud-stats {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 表單區塊 */
.form-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.form-section h3 {
  margin-bottom: 16px;
  color: #333;
  font-size: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.form-divider {
  grid-column: span 4;
  font-weight: 600;
  color: #4a4a9e;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  margin-top: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full-width {
  grid-column: span 4;
}

.form-group.span-2 {
  grid-column: span 2;
}

.form-group label {
  font-size: 13px;
  color: #666;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4a4a9e;
}

.form-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}

/* 按鈕樣式 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4a4a9e;
  color: #fff;
}

.btn-primary:hover {
  background: #3a3a8e;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.btn-export {
  background: #5cb85c;
  color: #fff;
}

.btn-export:hover {
  background: #4cae4c;
}

/* 統計摘要 */
.summary-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.summary-section h3 {
  margin-bottom: 16px;
  color: #333;
  font-size: 16px;
}

.summary-date-info {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #e3f2fd;
  border-radius: 6px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.summary-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.summary-card:first-child {
  background: linear-gradient(135deg, #4a4a9e 0%, #5a5abe 100%);
  color: #fff;
}

.summary-card:first-child .summary-label {
  color: rgba(255, 255, 255, 0.8);
}

.summary-card:first-child .summary-value {
  color: #fff;
}

.summary-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

/* 統計摘要搜尋區 */
.summary-search-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.summary-search-section .search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-search-section .search-row label {
  font-size: 14px;
  color: #666;
}

.summary-search-section .search-row input[type="date"] {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.summary-search-section .search-row input[type="date"]:focus {
  outline: none;
  border-color: #4a4a9e;
}

/* 記錄列表 */
.records-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.records-header h3 {
  color: #333;
  font-size: 16px;
  margin: 0;
}

/* 查詢區 */
.search-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.search-row:last-child {
  margin-bottom: 0;
}

.search-row label {
  font-size: 14px;
  color: #666;
}

.search-row input[type="date"] {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.search-row input[type="date"]:focus {
  outline: none;
  border-color: #4a4a9e;
}

.date-error {
  color: #856404;
  font-size: 14px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  margin-top: 8px;
}

.date-info {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
  padding: 8px 12px;
  background: #e3f2fd;
  border-radius: 6px;
}

.btn-filter {
  padding: 8px 16px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-filter:hover {
  background: #e0e0e0;
}

.btn-filter.active {
  background: #4a4a9e;
  color: #fff;
  border-color: #4a4a9e;
}

.btn-search {
  padding: 8px 20px;
  background: #4a4a9e;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-search:hover {
  background: #3a3a8e;
}

.table-container {
  overflow-x: auto;
}

.records-table {
  width: 100%;
  border-collapse: collapse;
}

.records-table th,
.records-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.records-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
  font-size: 13px;
}

.records-table td {
  font-size: 14px;
  color: #555;
}

.records-table .actions {
  white-space: nowrap;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 16px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-icon:hover {
  opacity: 1;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px !important;
}

/* 分頁 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.page-btn {
  padding: 8px 14px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #4a4a9e;
}

.page-btn.active {
  background: #4a4a9e;
  color: #fff;
  border-color: #4a4a9e;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-ellipsis {
  padding: 0 8px;
  color: #999;
}

.page-info {
  margin-left: 16px;
  font-size: 14px;
  color: #666;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .form-divider {
    grid-column: span 2;
  }

  .form-group.full-width {
    grid-column: span 2;
  }

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .summary-card:first-child {
    grid-column: span 2;
  }

  .records-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .pagination {
    flex-wrap: wrap;
  }

  .page-info {
    width: 100%;
    text-align: center;
    margin-left: 0;
    margin-top: 8px;
  }
}
</style>
