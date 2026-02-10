<script setup>
import { ref, onMounted, computed } from 'vue';

// 三方代收银行卡配置
const bankCards = ref([]);

// 新增表单
const newCard = ref({
  cardNumber: '',
  name: ''
});

// 编辑模式
const editingId = ref(null);

// 从 localStorage 加载数据
onMounted(() => {
  const saved = localStorage.getItem('thirdPartyBankCards');
  if (saved) {
    bankCards.value = JSON.parse(saved);
  } else {
    // 预设卡代号（如果没有配置过）
    const defaultCards = [
      { id: 1, cardNumber: 'GB-DahaomenJFB2025', name: '大豪門', createdAt: new Date().toISOString() },
      { id: 2, cardNumber: 'HTc2cdeposit', name: '匯通', createdAt: new Date().toISOString() },
      { id: 3, cardNumber: 'DDFdeposit', name: '豆豆', createdAt: new Date().toISOString() },
      { id: 4, cardNumber: 'UC1020', name: 'UC聚合', createdAt: new Date().toISOString() }
    ];
    bankCards.value = defaultCards;
    saveToStorage();
  }
});

// 保存到 localStorage
const saveToStorage = () => {
  localStorage.setItem('thirdPartyBankCards', JSON.stringify(bankCards.value));
};

// 新增银行卡
const addCard = () => {
  if (!newCard.value.cardNumber.trim()) {
    alert('请输入银行卡代号');
    return;
  }
  if (!newCard.value.name.trim()) {
    alert('请输入中文名称');
    return;
  }

  // 检查是否重复
  const exists = bankCards.value.find(c => c.cardNumber === newCard.value.cardNumber.trim());
  if (exists) {
    alert('该银行卡代号已存在');
    return;
  }

  const card = {
    id: Date.now(),
    cardNumber: newCard.value.cardNumber.trim(),
    name: newCard.value.name.trim(),
    createdAt: new Date().toISOString()
  };

  bankCards.value.push(card);
  saveToStorage();
  resetForm();
};

// 编辑银行卡
const editCard = (card) => {
  editingId.value = card.id;
  newCard.value = {
    cardNumber: card.cardNumber,
    name: card.name
  };
};

// 更新银行卡
const updateCard = () => {
  const index = bankCards.value.findIndex(c => c.id === editingId.value);
  if (index !== -1) {
    // 检查是否与其他卡号重复
    const duplicate = bankCards.value.find(c => c.cardNumber === newCard.value.cardNumber.trim() && c.id !== editingId.value);
    if (duplicate) {
      alert('该银行卡代号已存在');
      return;
    }

    bankCards.value[index] = {
      ...bankCards.value[index],
      cardNumber: newCard.value.cardNumber.trim(),
      name: newCard.value.name.trim(),
      updatedAt: new Date().toISOString()
    };
    saveToStorage();
  }
  resetForm();
};

// 删除银行卡
const deleteCard = (id) => {
  if (confirm('确定要删除这张银行卡配置吗？')) {
    bankCards.value = bankCards.value.filter(c => c.id !== id);
    saveToStorage();
  }
};

// 重置表单
const resetForm = () => {
  editingId.value = null;
  newCard.value = {
    cardNumber: '',
    name: ''
  };
};

// 统计数量
const totalCards = computed(() => bankCards.value.length);
</script>

<template>
  <div class="report-params">
    <!-- 三方代收配置 -->
    <div class="params-section">
      <div class="section-header">
        <h3>三方代收</h3>
        <span class="section-badge">{{ totalCards }} 张卡</span>
      </div>
      <p class="section-desc">輸入三方代收的银行卡代号和对应的中文名称，用于数据报表的计算和显示。</p>

      <!-- 新增/编辑表单 -->
      <div class="form-section">
        <h4>{{ editingId ? '编辑银行卡代号' : '新增银行卡代号' }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>银行卡代号</label>
            <input
              type="text"
              v-model="newCard.cardNumber"
              placeholder="请输入银行卡代号"
              @keyup.enter="editingId ? updateCard() : addCard()"
            />
          </div>
          <div class="form-group">
            <label>中文名称</label>
            <input
              type="text"
              v-model="newCard.name"
              placeholder="请输入中文名称"
              @keyup.enter="editingId ? updateCard() : addCard()"
            />
          </div>
          <div class="form-actions">
            <button v-if="editingId" @click="updateCard" class="btn btn-primary">更新</button>
            <button v-else @click="addCard" class="btn btn-primary">新增</button>
            <button v-if="editingId" @click="resetForm" class="btn btn-secondary">取消</button>
          </div>
        </div>
      </div>

      <!-- 银行卡列表 -->
      <div class="cards-list">
        <div v-if="bankCards.length === 0" class="empty-state">
          <span class="empty-icon">💳</span>
          <p>暂无银行卡配置</p>
          <p class="empty-hint">请在上方新增银行卡代号和中文名称</p>
        </div>
        <table v-else class="cards-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>银行卡代号</th>
              <th>中文名称</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(card, index) in bankCards" :key="card.id">
              <td>{{ index + 1 }}</td>
              <td class="card-number">{{ card.cardNumber }}</td>
              <td>{{ card.name }}</td>
              <td class="actions">
                <button @click="editCard(card)" class="btn-icon" title="编辑">✏️</button>
                <button @click="deleteCard(card.id)" class="btn-icon" title="删除">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-params {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.params-section {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.section-badge {
  background: #4a4a9e;
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.section-desc {
  color: #666;
  font-size: 14px;
  margin: 0 0 20px 0;
}

/* 表单样式 */
.form-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.form-section h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  color: #333;
}

.form-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 200px;
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
  display: flex;
  gap: 8px;
}

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

/* 列表样式 */
.cards-list {
  margin-top: 20px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.empty-hint {
  margin-top: 8px !important;
  font-size: 12px !important;
  color: #bbb;
}

.cards-table {
  width: 100%;
  border-collapse: collapse;
}

.cards-table th,
.cards-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.cards-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
  font-size: 13px;
}

.cards-table td {
  font-size: 14px;
  color: #555;
}

.card-number {
  font-family: monospace;
  color: #4a4a9e;
  font-weight: 500;
}

.actions {
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

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    align-items: stretch;
  }

  .form-group {
    min-width: 100%;
  }

  .form-actions {
    margin-top: 8px;
  }
}
</style>
