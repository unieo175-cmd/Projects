<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  },
  hideDate: {
    type: Boolean,
    default: false
  },
  hideMerchant: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['filter', 'export', 'dateChange', 'trialCalc']);

const merchantFilter = ref('all');
const trialCalcDone = ref(false);
const trialCalcLoading = ref(false);
const merchantSearch = ref('');
const showMerchantDropdown = ref(false);

// 日期默认为 2026-01-01
const today = new Date().toISOString().split('T')[0];
const yesterday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
})();
const defaultDate = '2026-01-01';
const dateFrom = ref(defaultDate);
const dateTo = ref(defaultDate);


// 日期范围错误信息
const dateRangeError = ref('');

// Get unique merchants with search
const uniqueMerchants = computed(() => {
  const merchants = new Set();
  props.records.forEach(r => {
    if (r.merchant) merchants.add(r.merchant);
  });
  return Array.from(merchants).sort();
});

// Filtered merchants based on search
const filteredMerchants = computed(() => {
  if (!merchantSearch.value) {
    return uniqueMerchants.value.slice(0, 100);
  }
  const search = merchantSearch.value.toLowerCase();
  return uniqueMerchants.value
    .filter(m => m.toLowerCase().includes(search))
    .slice(0, 100);
});

// 验证并自动修正日期范围
const validateDateRange = () => {
  dateRangeError.value = '';
  return true;
};

// 开始日期变更时的防呆
const onDateFromChange = () => {
  if (!dateFrom.value) {
    dateFrom.value = defaultDate;
    return;
  }

  // 开始日期不能超过今日
  if (dateFrom.value > today) {
    dateFrom.value = today;
    dateRangeError.value = '开始日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 如果结束日期早于开始日期，自动修正结束日期
  if (dateTo.value && dateTo.value < dateFrom.value) {
    dateTo.value = dateFrom.value;
    dateRangeError.value = '结束日期已自动修正为开始日期';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (dateFrom.value && dateTo.value) {
    const start = new Date(dateFrom.value);
    const end = new Date(dateTo.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      // 自动将结束日期设为开始日期 + 31 天
      const maxEnd = new Date(start);
      maxEnd.setDate(maxEnd.getDate() + 31);
      const maxEndStr = maxEnd.toISOString().split('T')[0];
      dateTo.value = maxEndStr > today ? today : maxEndStr;
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 结束日期变更时的防呆
const onDateToChange = () => {
  if (!dateTo.value) {
    dateTo.value = dateFrom.value || defaultDate;
    return;
  }

  // 结束日期不能超过今日
  if (dateTo.value > today) {
    dateTo.value = today;
    dateRangeError.value = '结束日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 结束日期不能早于开始日期
  if (dateFrom.value && dateTo.value < dateFrom.value) {
    dateTo.value = dateFrom.value;
    dateRangeError.value = '结束日期不能早于开始日期，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (dateFrom.value && dateTo.value) {
    const start = new Date(dateFrom.value);
    const end = new Date(dateTo.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      // 自动将开始日期设为结束日期 - 31 天
      const minStart = new Date(end);
      minStart.setDate(minStart.getDate() - 31);
      dateFrom.value = minStart.toISOString().split('T')[0];
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

const applyFilters = () => {
  // 验证日期范围（仅在显示日期时）
  if (!props.hideDate && !validateDateRange()) {
    return;
  }

  let filtered = [...props.records];

  // Merchant filter
  if (merchantFilter.value !== 'all') {
    filtered = filtered.filter(r => r.merchant === merchantFilter.value);
  }

  // Date range（仅在显示日期时过滤）
  if (!props.hideDate) {
    if (dateFrom.value) {
      filtered = filtered.filter(r => r.requestTime >= dateFrom.value);
    }
    if (dateTo.value) {
      filtered = filtered.filter(r => r.requestTime <= dateTo.value + ' 23:59:59');
    }
  }

  emit('filter', filtered);
  // 仅在显示日期时发送日期变更事件
  if (!props.hideDate) {
    emit('dateChange', { dateFrom: dateFrom.value, dateTo: dateTo.value });
  } else {
    emit('dateChange', { dateFrom: '', dateTo: '' });
  }
};

// Initial load
watch(() => props.records, () => {
  applyFilters();
}, { immediate: true });

const handleSearch = () => {
  applyFilters();
};

const handleExport = () => {
  emit('export');
};

const handleTrialCalc = () => {
  if (trialCalcLoading.value || trialCalcDone.value) return;
  trialCalcLoading.value = true;
  setTimeout(() => {
    trialCalcLoading.value = false;
    trialCalcDone.value = true;
    emit('trialCalc');
    applyFilters();
  }, 1500);
};

const selectMerchant = (merchant) => {
  merchantFilter.value = merchant;
  merchantSearch.value = merchant === 'all' ? '' : merchant;
  showMerchantDropdown.value = false;
};

const handleMerchantFocus = () => {
  showMerchantDropdown.value = true;
};

const handleMerchantBlur = () => {
  // Delay to allow click on dropdown item
  setTimeout(() => {
    showMerchantDropdown.value = false;
  }, 200);
};
</script>

<template>
  <div class="search-filter">
    <div class="filter-row">
      <!-- Merchant Filter with Searchable Dropdown -->
      <div v-if="!hideMerchant" class="filter-group merchant-filter">
        <label class="filter-label">商户名称</label>
        <div class="dropdown-container">
          <input
            v-model="merchantSearch"
            type="text"
            placeholder="搜索或选择商户..."
            class="merchant-search-input"
            @focus="handleMerchantFocus"
            @blur="handleMerchantBlur"
          />
          <div v-if="showMerchantDropdown" class="merchant-dropdown">
            <div
              class="dropdown-item"
              :class="{ active: merchantFilter === 'all' }"
              @mousedown="selectMerchant('all')"
            >
              全部商户
            </div>
            <div
              v-for="merchant in filteredMerchants"
              :key="merchant"
              class="dropdown-item"
              :class="{ active: merchantFilter === merchant }"
              @mousedown="selectMerchant(merchant)"
            >
              {{ merchant }}
            </div>
            <div v-if="filteredMerchants.length === 0" class="dropdown-empty">
              无符合的商户
            </div>
          </div>
        </div>
      </div>

      <div v-if="!hideDate" class="date-range">
        <label>从</label>
        <input
          v-model="dateFrom"
          type="date"
          class="date-input"
          :max="trialCalcDone ? today : yesterday"
          @change="onDateFromChange"
        />
        <label>到</label>
        <input
          v-model="dateTo"
          type="date"
          class="date-input"
          :max="trialCalcDone ? today : yesterday"
          @change="onDateToChange"
        />
      </div>

      <div class="filter-spacer"></div>

      <button
        type="button"
        class="trial-calc-btn"
        :class="{ done: trialCalcDone, loading: trialCalcLoading }"
        :disabled="trialCalcLoading || trialCalcDone"
        @click="handleTrialCalc"
      >
        <span v-if="trialCalcLoading">试算中...</span>
        <span v-else-if="trialCalcDone">✓ 已完成</span>
        <span v-else>当日资料试算</span>
      </button>

      <button v-if="!hideDate" @click="handleSearch" class="search-btn">查询</button>
      <button @click="handleExport" class="export-btn">导出 Excel</button>
    </div>

    <!-- 日期范围错误信息 -->
    <div v-if="dateRangeError" class="date-error">
      {{ dateRangeError }}
    </div>
  </div>
</template>

<style scoped>
.search-filter {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.filter-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
  align-content: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

/* Merchant Filter Dropdown */
.merchant-filter {
  min-width: 250px;
}

.dropdown-container {
  position: relative;
}

.merchant-search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.merchant-search-input:focus {
  border-color: #4a4a9e;
  box-shadow: 0 0 0 3px rgba(74, 74, 158, 0.1);
}

.merchant-search-input::placeholder {
  color: #999;
}

.merchant-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dropdown-item {
  padding: 10px 14px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item:hover {
  background: #f5f5f5;
}

.dropdown-item.active {
  background: #4a4a9e;
  color: #fff;
}

.dropdown-empty {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-range label {
  color: #666;
  font-size: 14px;
}

.date-input {
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.date-input:focus {
  border-color: #4a4a9e;
  box-shadow: 0 0 0 3px rgba(74, 74, 158, 0.1);
}

.search-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: #4a4a9e;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}


.search-btn:hover {
  background: #3a3a8e;
}

.export-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: #5cb85c;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.export-btn:hover {
  background: #4cae4c;
}

.filter-spacer {
  flex: 1;
}

.trial-calc-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid #4a4a9e;
  border-radius: 6px;
  background: #fff;
  color: #4a4a9e;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}

.trial-calc-btn:hover:not(:disabled) {
  background: #4a4a9e;
  color: #fff;
}

.trial-calc-btn.loading {
  cursor: not-allowed;
  opacity: 0.7;
}

.trial-calc-btn.done {
  border-color: #5cb85c;
  color: #5cb85c;
  cursor: default;
}

.trial-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: trial-btn-spin 0.7s linear infinite;
}

@keyframes trial-btn-spin {
  to { transform: rotate(360deg); }
}

.date-error {
  color: #856404;
  font-size: 14px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  margin-top: 12px;
}

@media (max-width: 768px) {
  .filter-group {
    flex: 1;
    min-width: 140px;
  }

  .merchant-filter {
    min-width: 100%;
  }

  .date-range {
    width: 100%;
  }

  .realtime-checkbox {
    width: 100%;
  }

  .search-btn,
  .export-btn {
    flex: 1;
    margin-left: 0;
  }
}
</style>
