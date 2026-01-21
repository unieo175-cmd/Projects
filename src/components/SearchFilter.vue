<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['filter']);

const searchQuery = ref('');
const channelFilter = ref('all');
const merchantFilter = ref('all');
const merchantSearch = ref('');
const showMerchantDropdown = ref(false);
const dateFrom = ref('');
const dateTo = ref('');

// Get unique channels
const uniqueChannels = computed(() => {
  const channels = new Set();
  props.records.forEach(r => {
    if (r.channel) channels.add(r.channel);
  });
  return Array.from(channels);
});

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

  // Channel filter
  if (channelFilter.value !== 'all') {
    filtered = filtered.filter(r => r.channel === channelFilter.value);
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
watch([searchQuery, channelFilter, merchantFilter, dateFrom, dateTo], applyFilters, { immediate: true });

const resetFilters = () => {
  searchQuery.value = '';
  channelFilter.value = 'all';
  merchantFilter.value = 'all';
  merchantSearch.value = '';
  dateFrom.value = '';
  dateTo.value = '';
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

const getChannelIcon = (channel) => {
  switch (channel) {
    case '支付宝': return '💙';
    case '微信': return '💚';
    case '銀行卡': return '💳';
    default: return '📱';
  }
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
          placeholder="搜尋流水號、商戶、用戶ID、銀行..."
          class="search-input"
        />
      </div>

      <!-- Channel Filter -->
      <div class="filter-group">
        <label class="filter-label">渠道</label>
        <select v-model="channelFilter" class="filter-select">
          <option value="all">全部渠道</option>
          <option v-for="channel in uniqueChannels" :key="channel" :value="channel">
            {{ getChannelIcon(channel) }} {{ channel }}
          </option>
        </select>
      </div>

      <!-- Merchant Filter with Searchable Dropdown -->
      <div class="filter-group merchant-filter">
        <label class="filter-label">商戶名稱</label>
        <div class="dropdown-container">
          <input
            v-model="merchantSearch"
            type="text"
            placeholder="搜尋或選擇商戶..."
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
              全部商戶
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
              無符合的商戶
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-row">
      <div class="date-range">
        <label>從</label>
        <input v-model="dateFrom" type="date" class="date-input" />
        <label>到</label>
        <input v-model="dateTo" type="date" class="date-input" />
      </div>

      <button @click="resetFilters" class="reset-btn">重置篩選</button>
    </div>
  </div>
</template>

<style scoped>
.search-filter {
  background: #1c1c1e;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
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
  font-size: 12px;
  color: #8e8e93;
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
  width: 20px;
  height: 20px;
  color: #8e8e93;
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 44px;
  border: 1px solid #3a3a3c;
  border-radius: 10px;
  background: #2c2c2e;
  color: #fff;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #0a84ff;
}

.search-input::placeholder {
  color: #8e8e93;
}

.filter-select {
  padding: 12px 16px;
  border: 1px solid #3a3a3c;
  border-radius: 10px;
  background: #2c2c2e;
  color: #fff;
  font-size: 15px;
  outline: none;
  cursor: pointer;
  min-width: 160px;
}

.filter-select:focus {
  border-color: #0a84ff;
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
  padding: 12px 16px;
  border: 1px solid #3a3a3c;
  border-radius: 10px;
  background: #2c2c2e;
  color: #fff;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}

.merchant-search-input:focus {
  border-color: #0a84ff;
}

.merchant-search-input::placeholder {
  color: #8e8e93;
}

.merchant-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #2c2c2e;
  border: 1px solid #3a3a3c;
  border-radius: 10px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.dropdown-item {
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #fff;
  transition: background 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item:hover {
  background: #3a3a3c;
}

.dropdown-item.active {
  background: #0a84ff;
}

.dropdown-empty {
  padding: 16px;
  text-align: center;
  color: #8e8e93;
  font-size: 14px;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-range label {
  color: #8e8e93;
  font-size: 14px;
}

.date-input {
  padding: 10px 14px;
  border: 1px solid #3a3a3c;
  border-radius: 10px;
  background: #2c2c2e;
  color: #fff;
  font-size: 14px;
  outline: none;
}

.date-input:focus {
  border-color: #0a84ff;
}

.reset-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  background: #3a3a3c;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.reset-btn:hover {
  background: #48484a;
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
