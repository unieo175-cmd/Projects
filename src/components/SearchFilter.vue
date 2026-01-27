<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['filter', 'export']);

const searchQuery = ref('');
const merchantFilter = ref('all');
const merchantSearch = ref('');
const showMerchantDropdown = ref(false);
const dateFrom = ref('');
const dateTo = ref('');

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

const applyFilters = () => {
  let filtered = [...props.records];

  // Search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(r =>
      r.id.toLowerCase().includes(query) ||
      r.merchant.toLowerCase().includes(query) ||
      r.userId.toLowerCase().includes(query) ||
      r.bankName.toLowerCase().includes(query) ||
      r.status.toLowerCase().includes(query)
    );
  }

  // Merchant filter
  if (merchantFilter.value !== 'all') {
    filtered = filtered.filter(r => r.merchant === merchantFilter.value);
  }

  // Date range
  if (dateFrom.value) {
    filtered = filtered.filter(r => r.requestTime >= dateFrom.value);
  }
  if (dateTo.value) {
    filtered = filtered.filter(r => r.requestTime <= dateTo.value + ' 23:59:59');
  }

  emit('filter', filtered);
};

// Watch for changes and apply filters
watch([searchQuery, merchantFilter, dateFrom, dateTo], applyFilters, { immediate: true });

const resetFilters = () => {
  searchQuery.value = '';
  merchantFilter.value = 'all';
  merchantSearch.value = '';
  dateFrom.value = '';
  dateTo.value = '';
};

const handleExport = () => {
  emit('export');
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
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索流水号、商户、用户ID、银行..."
          class="search-input"
        />
      </div>

      <!-- Merchant Filter with Searchable Dropdown -->
      <div class="filter-group merchant-filter">
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
    </div>

    <div class="filter-row">
      <div class="date-range">
        <label>从</label>
        <input v-model="dateFrom" type="date" class="date-input" />
        <label>到</label>
        <input v-model="dateTo" type="date" class="date-input" />
      </div>

      <button @click="resetFilters" class="reset-btn">重置筛选</button>
      <button @click="handleExport" class="export-btn">匯出 Excel</button>
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
}

.filter-row + .filter-row {
  margin-top: 16px;
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

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #999;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 42px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: #4a4a9e;
  box-shadow: 0 0 0 3px rgba(74, 74, 158, 0.1);
}

.search-input::placeholder {
  color: #999;
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

.reset-btn {
  padding: 10px 20px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
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

@media (max-width: 768px) {
  .search-box {
    min-width: 100%;
  }

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
}
</style>
