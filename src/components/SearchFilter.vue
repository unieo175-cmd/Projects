<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['filter', 'export']);

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

      <div class="date-range">
        <label>从</label>
        <input v-model="dateFrom" type="date" class="date-input" />
        <label>到</label>
        <input v-model="dateTo" type="date" class="date-input" />
      </div>

      <button @click="handleSearch" class="search-btn">查詢</button>
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
  margin-left: auto;
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

  .search-btn,
  .export-btn {
    flex: 1;
    margin-left: 0;
  }
}
</style>
