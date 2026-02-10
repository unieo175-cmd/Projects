<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as XLSX from 'xlsx';

// 骗分记录
const fraudRecords = ref([]);

// 当前登录用户
// TODO: 对接后端 API 获取登录用户账号
// 目前暂用 localStorage 模拟，正式环境需从后端登录状态获取
const currentUser = ref(localStorage.getItem('currentUser') || 'karoli');

// 操作 Log 记录
// TODO: 正式环境需对接后端 API 存储操作记录
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

// 渠道类型选项
const channelTypes = ['银行卡', '支付宝', '微信'];

// 新增表单
const newRecord = ref({
  date: new Date().toISOString().split('T')[0],
  type: '银行卡',
  manualAmount: '',
  manualCount: '',
  creditAmount: '',
  creditCount: '',
  noReceiptCount: '',
  fraudBlacklistCount: '',
  cardVerifyCount: '',
  remark: '',
  operator: ''
});

// 编辑模式
const editingId = ref(null);


// 分页设置
const currentPage = ref(1);
const pageSize = 50;

// 今日日期
const today = new Date().toISOString().split('T')[0];

// 日期搜索 - 起讫日期（默认显示全部）
const startDate = ref('');
const endDate = ref('');

// 日期范围错误信息
const dateRangeError = ref('');

// 从 localStorage 加载数据
onMounted(() => {
  const saved = localStorage.getItem('fraudRecords');
  if (saved) {
    fraudRecords.value = JSON.parse(saved);
  }

  // 加载操作 Log
  const savedLogs = localStorage.getItem('fraudOperationLogs');
  if (savedLogs) {
    operationLogs.value = JSON.parse(savedLogs);
  }
});

// 保存到 localStorage
const saveToStorage = () => {
  localStorage.setItem('fraudRecords', JSON.stringify(fraudRecords.value));
};

// 新增记录
const addRecord = () => {
  if (!newRecord.value.date) {
    alert('请选择日期');
    return;
  }

  const record = {
    id: Date.now(),
    date: newRecord.value.date,
    type: newRecord.value.type,
    manualAmount: parseFloat(newRecord.value.manualAmount) || 0,
    manualCount: parseInt(newRecord.value.manualCount) || 0,
    creditAmount: parseFloat(newRecord.value.creditAmount) || 0,
    creditCount: parseInt(newRecord.value.creditCount) || 0,
    noReceiptCount: parseInt(newRecord.value.noReceiptCount) || 0,
    fraudBlacklistCount: parseInt(newRecord.value.fraudBlacklistCount) || 0,
    cardVerifyCount: parseInt(newRecord.value.cardVerifyCount) || 0,
    remark: newRecord.value.remark,
    operator: currentUser.value,
    createdAt: new Date().toISOString()
  };

  // 检查是否所有数值皆为 0（当日无骗分数据）
  const hasData =
    record.manualAmount > 0 ||
    record.manualCount > 0 ||
    record.creditAmount > 0 ||
    record.creditCount > 0 ||
    record.noReceiptCount > 0 ||
    record.fraudBlacklistCount > 0 ||
    record.cardVerifyCount > 0;

  if (!hasData) {
    alert('所有数值皆为 0，当日无骗分数据，不予新增');
    return;
  }

  fraudRecords.value.unshift(record);
  saveToStorage();

  // 写入操作 Log
  addOperationLog('ADD', record.id, {
    date: record.date,
    type: record.type,
    remark: record.remark || '无备注'
  });

  resetForm();
};

// 编辑记录
const editRecord = (record) => {
  editingId.value = record.id;
  newRecord.value = { ...record };
  // 滚动到表单区域
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 更新记录
const updateRecord = () => {
  const index = fraudRecords.value.findIndex(r => r.id === editingId.value);
  if (index !== -1) {
    const originalRecord = fraudRecords.value[index];
    const updatedRecord = {
      id: editingId.value,
      date: newRecord.value.date,
      type: newRecord.value.type,
      manualAmount: parseFloat(newRecord.value.manualAmount) || 0,
      manualCount: parseInt(newRecord.value.manualCount) || 0,
      creditAmount: parseFloat(newRecord.value.creditAmount) || 0,
      creditCount: parseInt(newRecord.value.creditCount) || 0,
      noReceiptCount: parseInt(newRecord.value.noReceiptCount) || 0,
      fraudBlacklistCount: parseInt(newRecord.value.fraudBlacklistCount) || 0,
      cardVerifyCount: parseInt(newRecord.value.cardVerifyCount) || 0,
      remark: newRecord.value.remark,
      operator: originalRecord.operator || currentUser.value,
      createdAt: originalRecord.createdAt,
      lastEditedBy: currentUser.value,
      lastEditedAt: new Date().toISOString()
    };
    fraudRecords.value[index] = updatedRecord;
    saveToStorage();

    // 写入操作 Log
    addOperationLog('EDIT', editingId.value, {
      date: updatedRecord.date,
      type: updatedRecord.type,
      originalOperator: originalRecord.operator,
      remark: updatedRecord.remark || '无备注'
    });
  }
  resetForm();
};

// 删除记录
const deleteRecord = (id) => {
  if (confirm('确定要删除这笔记录吗？')) {
    // 获取要删除的记录信息（用于 Log）
    const recordToDelete = fraudRecords.value.find(r => r.id === id);

    fraudRecords.value = fraudRecords.value.filter(r => r.id !== id);
    saveToStorage();

    // 写入操作 Log
    if (recordToDelete) {
      addOperationLog('DELETE', id, {
        date: recordToDelete.date,
        originalOperator: recordToDelete.operator,
        remark: recordToDelete.remark || '无备注'
      });
    }
  }
};

// 重置表单
const resetForm = () => {
  editingId.value = null;
  newRecord.value = {
    date: new Date().toISOString().split('T')[0],
    type: '银行卡',
    manualAmount: '',
    manualCount: '',
    creditAmount: '',
    creditCount: '',
    noReceiptCount: '',
    fraudBlacklistCount: '',
    cardVerifyCount: '',
    remark: '',
    operator: ''
  };
};


// 获取查询范围描述
const getDateRangeDescription = () => {
  if (!startDate.value && !endDate.value) {
    return '全部数据';
  }

  if (startDate.value === endDate.value) {
    return startDate.value;
  }

  return `${startDate.value || '无限制'} ~ ${endDate.value || '无限制'}`;
};

// 导出数据到 Excel
const exportToExcel = () => {
  const dateRange = getDateRangeDescription();
  const exportRecords = filteredRecords.value;

  // 创建工作簿
  const wb = XLSX.utils.book_new();

  // 统计摘要数据
  const summaryData = [
    ['骗分统计摘要'],
    ['导出时间', new Date().toLocaleString()],
    ['查询范围', dateRange],
    [''],
    ['总骗分金额', totalFraudAmount.value],
    [''],
    ['骗分拉黑(笔)', totals.value.fraudBlacklistCount],
    ['卡验及人验(笔)', totals.value.cardVerifyCount],
    ['人工笔数', totals.value.manualCount],
    ['人工金额(元)', totals.value.manualAmount],
    ['信评笔数', totals.value.creditCount],
    ['信评金额(元)', totals.value.creditAmount],
    ['没上传回单重复出款充值上分(笔)', totals.value.noReceiptCount],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1, '统计摘要');

  // 明细数据
  if (exportRecords.length > 0) {
    const detailHeaders = [
      '日期', '渠道类型',
      '骗分拉黑(笔)', '卡验人验(笔)', '人工笔数', '人工金额',
      '信评笔数', '信评金额', '没上传回单重复出款充值上分(笔)',
      '备注'
    ];

    const detailData = exportRecords.map(r => [
      r.date,
      r.type || '银行卡',
      r.fraudBlacklistCount || 0,
      r.cardVerifyCount || 0,
      r.manualCount || 0,
      r.manualAmount || 0,
      r.creditCount || 0,
      r.creditAmount || 0,
      r.noReceiptCount || 0,
      r.remark || ''
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailData]);
    XLSX.utils.book_append_sheet(wb, ws2, '明细数据');
  }

  // 文件名包含日期范围
  const fileDate = startDate.value || new Date().toISOString().split('T')[0];
  const fileName = `骗分统计_${fileDate}${endDate.value && endDate.value !== startDate.value ? '_' + endDate.value : ''}.xlsx`;

  XLSX.writeFile(wb, fileName);
};

// 验证日期范围
const validateDateRange = () => {
  dateRangeError.value = '';
  return true;
};

// 开始日期变更时的防呆
const onStartDateChange = () => {
  if (!startDate.value) return;

  // 开始日期不能超过今日
  if (startDate.value > today) {
    startDate.value = today;
    dateRangeError.value = '开始日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 如果结束日期早于开始日期，自动修正结束日期
  if (endDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '结束日期已自动修正为开始日期';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const maxEnd = new Date(start);
      maxEnd.setDate(maxEnd.getDate() + 31);
      const maxEndStr = maxEnd.toISOString().split('T')[0];
      endDate.value = maxEndStr > today ? today : maxEndStr;
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 结束日期变更时的防呆
const onEndDateChange = () => {
  if (!endDate.value) return;

  // 结束日期不能超过今日
  if (endDate.value > today) {
    endDate.value = today;
    dateRangeError.value = '结束日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 结束日期不能早于开始日期
  if (startDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '结束日期不能早于开始日期，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const minStart = new Date(end);
      minStart.setDate(minStart.getDate() - 31);
      startDate.value = minStart.toISOString().split('T')[0];
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 新增记录日期防呆
const onRecordDateChange = () => {
  if (newRecord.value.date > today) {
    newRecord.value.date = today;
    dateRangeError.value = '记录日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }
};

// 筛选后的记录（依日期范围搜索）
const filteredRecords = computed(() => {
  // 验证日期范围
  if (!validateDateRange()) {
    return [];
  }

  // 显示全部
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

// 计算总计（依筛选后的数据）
const totals = computed(() => {
  return filteredRecords.value.reduce((acc, r) => {
    acc.manualAmount += r.manualAmount || 0;
    acc.manualCount += r.manualCount || 0;
    acc.creditAmount += r.creditAmount || 0;
    acc.creditCount += r.creditCount || 0;
    acc.noReceiptCount += r.noReceiptCount || 0;
    acc.fraudBlacklistCount += r.fraudBlacklistCount || 0;
    acc.cardVerifyCount += r.cardVerifyCount || 0;
    return acc;
  }, {
    manualAmount: 0,
    manualCount: 0,
    creditAmount: 0,
    creditCount: 0,
    noReceiptCount: 0,
    fraudBlacklistCount: 0,
    cardVerifyCount: 0
  });
});

// 总骗分金额
const totalFraudAmount = computed(() => {
  return totals.value.manualAmount + totals.value.creditAmount;
});

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredRecords.value.length / pageSize) || 1;
});

// 当前页的记录
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  const end = start + pageSize;
  return filteredRecords.value.slice(start, end);
});

// 当搜索条件变更时，重置到第一页
watch([startDate, endDate], () => {
  currentPage.value = 1;
  validateDateRange();
});

// 显示全部数据
const showAll = () => {
  startDate.value = '';
  endDate.value = '';
  dateRangeError.value = '';
  currentPage.value = 1;
};

// 查询按钮
const handleSearch = () => {
  currentPage.value = 1;
};

// 换页
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

// 获取类型徽章样式
const getTypeBadgeClass = (type) => {
  switch (type) {
    case '支付宝': return 'type-alipay';
    case '微信': return 'type-wechat';
    default: return 'type-bankcard';
  }
};

// 生成页码数组
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
    <!-- 输入表单 -->
    <div class="form-section">
      <h3>{{ editingId ? '编辑记录' : '新增骗分记录' }}</h3>

      <!-- 日期和类型选择 -->
      <div class="form-header-row">
        <div class="form-group">
          <label>日期</label>
          <input type="date" v-model="newRecord.date" :max="today" @change="onRecordDateChange" />
        </div>
        <div class="form-group">
          <label>渠道类型</label>
          <select v-model="newRecord.type">
            <option v-for="type in channelTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>
      </div>

      <!-- 输入字段 -->
      <div class="form-fields-grid">
        <div class="form-group">
          <label>骗分拉黑(笔)</label>
          <input type="number" v-model="newRecord.fraudBlacklistCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>卡验及人验(笔)</label>
          <input type="number" v-model="newRecord.cardVerifyCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>人工笔数</label>
          <input type="number" v-model="newRecord.manualCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>人工金额(元)</label>
          <input type="number" v-model="newRecord.manualAmount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>信评笔数</label>
          <input type="number" v-model="newRecord.creditCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>信评金额(元)</label>
          <input type="number" v-model="newRecord.creditAmount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>没上传回单重复出款充值上分(笔)</label>
          <input type="number" v-model="newRecord.noReceiptCount" placeholder="0" />
        </div>
        <div class="form-group">
          <label>备注</label>
          <input type="text" v-model="newRecord.remark" placeholder="选填" />
        </div>
      </div>

      <div class="form-actions">
        <button v-if="editingId" @click="updateRecord" class="btn btn-primary">更新</button>
        <button v-else @click="addRecord" class="btn btn-primary">新增</button>
        <button v-if="editingId" @click="resetForm" class="btn btn-secondary">取消</button>
      </div>
    </div>

    <!-- 统计摘要 -->
    <div class="summary-section">
      <h3>统计摘要</h3>
      <!-- 统计卡片 -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">骗分拉黑</div>
          <div class="summary-value">{{ totals.fraudBlacklistCount }} 笔</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">卡验及人验</div>
          <div class="summary-value">{{ totals.cardVerifyCount }} 笔</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">人工</div>
          <div class="summary-value">{{ totals.manualCount }} 笔 / {{ totals.manualAmount.toLocaleString() }} 元</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">信评</div>
          <div class="summary-value">{{ totals.creditCount }} 笔 / {{ totals.creditAmount.toLocaleString() }} 元</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">没上传回单重复出款充值上分</div>
          <div class="summary-value">{{ totals.noReceiptCount }} 笔</div>
        </div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div class="records-section">
      <div class="records-header">
        <h3>历史记录 ({{ filteredRecords.length }} 笔)</h3>
      </div>

      <!-- 查询区 -->
      <div class="search-section">
        <div class="search-row">
          <label>开始日期：</label>
          <input type="date" v-model="startDate" :max="today" @change="onStartDateChange" />
          <label>结束日期：</label>
          <input type="date" v-model="endDate" :max="today" @change="onEndDateChange" />
          <button @click="handleSearch" class="btn-search">查询</button>
        </div>
        <div v-if="dateRangeError" class="date-error">
          {{ dateRangeError }}
        </div>
        <div v-if="startDate || endDate" class="date-info">
          查询范围：{{ getDateRangeDescription() }}
        </div>
      </div>
      <div class="table-container">
        <table class="records-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>渠道类型</th>
              <th>人工</th>
              <th>信评</th>
              <th>骗分拉黑</th>
              <th>卡验人验</th>
              <th>没上传回单重复出款充值上分</th>
              <th>操作人</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in paginatedRecords" :key="record.id">
              <td>{{ record.date }}</td>
              <td>
                <span class="type-badge" :class="getTypeBadgeClass(record.type)">
                  {{ record.type || '银行卡' }}
                </span>
              </td>
              <td>{{ record.manualCount || 0 }}笔/{{ record.manualAmount || 0 }}元</td>
              <td>{{ record.creditCount || 0 }}笔/{{ record.creditAmount || 0 }}元</td>
              <td>{{ record.fraudBlacklistCount || 0 }}笔</td>
              <td>{{ record.cardVerifyCount || 0 }}笔</td>
              <td>{{ record.noReceiptCount || 0 }}笔</td>
              <td>{{ record.operator || '-' }}</td>
              <td>{{ record.remark || '-' }}</td>
              <td class="actions">
                <button @click="editRecord(record)" class="btn-icon" title="编辑">✏️</button>
                <button @click="deleteRecord(record.id)" class="btn-icon" title="删除">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredRecords.length === 0">
              <td colspan="10" class="empty">{{ dateRangeError ? dateRangeError : (startDate || endDate ? '找不到该日期范围的记录' : '暂无记录') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          上一页
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
          下一页
        </button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
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

/* 表单区块 */
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

.form-header-row {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 20px;
}

.form-header-row .form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-header-row .form-group input[type="date"] {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  height: 42px;
  box-sizing: border-box;
}

.form-header-row .form-group select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  min-width: 120px;
  height: 42px;
  background: #fff;
  cursor: pointer;
  box-sizing: border-box;
}

.form-header-row .form-group select:focus,
.form-header-row .form-group input:focus {
  outline: none;
  border-color: #4a4a9e;
}

.form-fields-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
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

/* 统计摘要 */
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.summary-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  border: 1px solid #e8e8e8;
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

/* 记录列表 */
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

/* 查询区 */
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

/* 类型徽章 */
.type-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.type-bankcard {
  background: #e3f2fd;
  color: #1565c0;
}

.type-alipay {
  background: #e8f5e9;
  color: #2e7d32;
}

.type-wechat {
  background: #e8f5e9;
  color: #388e3c;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px !important;
}

/* 分页 */
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
  .form-header-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .form-header-row .form-group {
    width: 100%;
  }

  .form-header-row .form-group input[type="date"],
  .form-header-row .form-group select {
    width: 100%;
  }

  .form-fields-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
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
