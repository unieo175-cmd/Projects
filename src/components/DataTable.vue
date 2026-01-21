<script setup>
import { ref, computed } from 'vue';
import { formatAmount, formatTime } from '../utils/csvParser';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
});

const currentPage = ref(1);
const pageSize = ref(20);
const sortKey = ref('requestTime');
const sortOrder = ref('desc');

const sortedRecords = computed(() => {
  return [...props.records].sort((a, b) => {
    let aVal = a[sortKey.value];
    let bVal = b[sortKey.value];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
});

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return sortedRecords.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(props.records.length / pageSize.value);
});

const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'desc';
  }
};

const getStatusClass = (record) => {
  if (record.isSuccess) return 'status-success';
  if (record.isInvalid) return 'status-invalid';
  if (record.isBuDan) return 'status-budan';
  return 'status-pending';
};

const getStatusText = (record) => {
  // Simplify status display
  const status = record.status;
  if (status.includes('已充值')) return '已充值';
  if (status.includes('信用評分上分')) return '信用評分上分';
  if (status.includes('银商确认到账')) return '銀商確認';
  if (status.includes('用户确认到帐')) return '用戶確認';
  if (status.includes('未充值')) return '未充值';
  if (status.includes('補單')) return '補單';
  return status.substring(0, 10) + (status.length > 10 ? '...' : '');
};

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const visiblePages = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(total);
    }
  }

  return pages;
});
</script>

<template>
  <div class="data-table-container">
    <div class="table-header">
      <h3>交易明細</h3>
      <span class="record-count">共 {{ records.length.toLocaleString() }} 筆數</span>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th @click="handleSort('id')" class="sortable">
              流水號
              <span v-if="sortKey === 'id'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="handleSort('merchant')" class="sortable">
              商戶
              <span v-if="sortKey === 'merchant'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="handleSort('amount')" class="sortable">
              充值金額
              <span v-if="sortKey === 'amount'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="handleSort('receivedAmount')" class="sortable">
              到帳金額
              <span v-if="sortKey === 'receivedAmount'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th>狀態</th>
            <th>銀行</th>
            <th @click="handleSort('requestTime')" class="sortable">
              請求時間
              <span v-if="sortKey === 'requestTime'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th>處理時間</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in paginatedRecords" :key="record.id">
            <td class="id-cell">{{ record.id }}</td>
            <td class="merchant-cell" :title="record.merchant">
              {{ record.merchant.length > 20 ? record.merchant.substring(0, 20) + '...' : record.merchant }}
            </td>
            <td class="amount-cell">{{ formatAmount(record.amount) }}</td>
            <td class="amount-cell" :class="{ 'zero-amount': record.receivedAmount === 0 }">
              {{ formatAmount(record.receivedAmount) }}
            </td>
            <td>
              <span :class="['status-badge', getStatusClass(record)]">
                {{ getStatusText(record) }}
              </span>
            </td>
            <td>{{ record.bankName }}</td>
            <td class="time-cell">{{ record.requestTime }}</td>
            <td class="time-cell">{{ formatTime(record.processingTime) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button @click="goToPage(1)" :disabled="currentPage === 1" class="page-btn">
        «
      </button>
      <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1" class="page-btn">
        ‹
      </button>

      <template v-for="page in visiblePages" :key="page">
        <span v-if="page === '...'" class="page-ellipsis">...</span>
        <button
          v-else
          @click="goToPage(page)"
          :class="['page-btn', { active: page === currentPage }]"
        >
          {{ page }}
        </button>
      </template>

      <button @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages" class="page-btn">
        ›
      </button>
      <button @click="goToPage(totalPages)" :disabled="currentPage === totalPages" class="page-btn">
        »
      </button>

      <select v-model="pageSize" class="page-size-select">
        <option :value="10">10 筆/頁</option>
        <option :value="20">20 筆/頁</option>
        <option :value="50">50 筆/頁</option>
        <option :value="100">100 筆/頁</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.data-table-container {
  background: #1c1c1e;
  border-radius: 16px;
  padding: 20px;
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.table-header h3 {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.record-count {
  color: #8e8e93;
  font-size: 14px;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #3a3a3c;
}

.data-table th {
  color: #8e8e93;
  font-weight: 500;
  white-space: nowrap;
  position: sticky;
  top: 0;
  background: #1c1c1e;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  color: #fff;
}

.sort-icon {
  margin-left: 4px;
  color: #0a84ff;
}

.data-table td {
  color: #fff;
}

.data-table tbody tr:hover {
  background: #2c2c2e;
}

.id-cell {
  font-family: monospace;
  font-size: 13px;
  color: #8e8e93 !important;
}

.merchant-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount-cell {
  font-family: monospace;
  text-align: right !important;
}

.zero-amount {
  color: #ff453a !important;
}

.time-cell {
  font-size: 13px;
  white-space: nowrap;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.status-success {
  background: rgba(48, 209, 88, 0.2);
  color: #30d158;
}

.status-invalid {
  background: rgba(255, 69, 58, 0.2);
  color: #ff453a;
}

.status-budan {
  background: rgba(255, 159, 10, 0.2);
  color: #ff9f0a;
}

.status-pending {
  background: rgba(142, 142, 147, 0.2);
  color: #8e8e93;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  border: 1px solid #3a3a3c;
  border-radius: 8px;
  background: #2c2c2e;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #3a3a3c;
  border-color: #48484a;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn.active {
  background: #0a84ff;
  border-color: #0a84ff;
}

.page-ellipsis {
  color: #8e8e93;
  padding: 0 8px;
}

.page-size-select {
  margin-left: 16px;
  padding: 8px 12px;
  border: 1px solid #3a3a3c;
  border-radius: 8px;
  background: #2c2c2e;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
</style>
