<script setup>
import { ref, computed, watch } from 'vue';
import { formatTime, formatAmount } from '../utils/csvParser';

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['channelChange']);

// 渠道切換
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay', 'wechat'

// 當渠道改變時通知父組件
watch(activeChannel, (newChannel) => {
  emit('channelChange', newChannel);
});

// 控制區域顯示/隱藏
const showGeneral = ref(true);
const showJisu = ref(true);
const showAlipay = ref(true);
const showWechat = ref(true);
const showC2c = ref(true);
const showFraud = ref(true);
const showCommercial = ref(true);
const showTime = ref(true);
const showNoCreditDowngradeDetails = ref(false);

// 金額區間列表
const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];

// 第一區域：重要資訊
const generalCards = computed(() => [
  {
    title: '總申請筆數',
    value: (props.metrics.totalApplicationCount || 0).toLocaleString(),
    unit: `(成功率 ${(props.metrics.successRate || 0).toFixed(2)}%)`,
    color: '#0a84ff',
    icon: '📊'
  },
  {
    title: '總申請金額',
    value: formatAmount(props.metrics.totalApplicationAmount || 0),
    unit: '元',
    color: '#30d158',
    icon: '💰'
  },
  {
    title: '平均處理時間',
    value: formatTime(props.metrics.avgTimeSeconds),
    unit: '',
    color: '#0a84ff',
    icon: '⏱️'
  },
  {
    title: '無效申請',
    value: (props.metrics.invalidCount || 0).toLocaleString(),
    unit: `(${(props.metrics.invalidRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '❌'
  },
  {
    title: '掉單筆數',
    value: (props.metrics.dropOrderCount || 0).toLocaleString(),
    unit: `(${(props.metrics.dropOrderRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '⚠️'
  }
]);

// 第三區域：時間分佈
const timeCards = computed(() => [
  {
    title: '2分鐘內',
    value: (props.metrics.within2MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within2MinRatio || 0).toFixed(2)}%)`,
    color: '#30d158',
    icon: '⚡'
  },
  {
    title: '3-5分鐘',
    value: (props.metrics.within3to5MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within3to5MinRatio || 0).toFixed(2)}%)`,
    color: '#5e5ce6',
    icon: '🕐'
  },
  {
    title: '5-15分鐘',
    value: (props.metrics.within5to15MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within5to15MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕑'
  },
  {
    title: '15-30分鐘',
    value: (props.metrics.within15to30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within15to30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕒'
  },
  {
    title: '30分鐘以上',
    value: (props.metrics.over30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.over30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '🕓'
  }
]);
</script>

<template>
  <div class="metrics-container">
    <!-- 渠道切換 -->
    <div class="channel-tabs">
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'all' }"
        @click="activeChannel = 'all'"
      >
        全部
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'bankCard' }"
        @click="activeChannel = 'bankCard'"
      >
        銀行卡
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'alipay' }"
        @click="activeChannel = 'alipay'"
      >
        支付寶
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'wechat' }"
        @click="activeChannel = 'wechat'"
      >
        微信
      </button>
    </div>

    <!-- ========== 全部渠道 ========== -->
    <template v-if="activeChannel === 'all'">
      <!-- 重要資訊 -->
      <div class="metrics-section">
        <div class="section-header" @click="showGeneral = !showGeneral">
          <h3 class="section-title">重要資訊</h3>
          <span class="toggle-icon">{{ showGeneral ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showGeneral" class="metrics-grid five-grid">
          <div
            v-for="card in generalCards"
            :key="card.title"
            class="metric-card"
          >
            <div class="card-header">
              <span class="card-icon">{{ card.icon }}</span>
              <span class="card-title">{{ card.title }}</span>
            </div>
            <div class="card-value" :style="{ color: card.color }">
              {{ card.value }}
              <span class="card-unit">{{ card.unit }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 處理時間分佈 -->
      <div class="metrics-section">
        <div class="section-header" @click="showTime = !showTime">
          <h3 class="section-title">處理時間分佈</h3>
          <span class="toggle-icon">{{ showTime ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showTime" class="metrics-grid five-grid">
          <div
            v-for="card in timeCards"
            :key="card.title"
            class="metric-card"
          >
            <div class="card-header">
              <span class="card-icon">{{ card.icon }}</span>
              <span class="card-title">{{ card.title }}</span>
            </div>
            <div class="card-value" :style="{ color: card.color }">
              {{ card.value }}
              <span class="card-unit">{{ card.unit }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 銀行卡渠道 ========== -->
    <template v-else-if="activeChannel === 'bankCard'">
      <!-- 極速（銀行卡） -->
      <div class="metrics-section">
        <div class="section-header" @click="showJisu = !showJisu">
          <h3 class="section-title">極速（銀行卡）</h3>
          <span class="toggle-icon">{{ showJisu ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showJisu" class="jisu-content">
          <!-- 1. 充值申請筆數 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申請筆數</span>
              <span class="block-value">{{ (metrics.jisuApplicationCount || 0).toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.expressCardAppCount || 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- 2. 成功配對筆數/金額 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">成功配對</span>
              <span class="block-value">{{ (metrics.totalMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.totalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.normalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.expressMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.expressMatchAmount || 0) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 3. 訂單成功筆數/金額 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">訂單成功</span>
              <span class="block-value">{{ (metrics.totalOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.totalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.normalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.expressOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.expressOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信評上分</span>
                <span class="detail-value">{{ (metrics.creditScoreSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.creditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.creditScoreAvgTime) }}</span>
              </div>
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header clickable" @click="showNoCreditDowngradeDetails = !showNoCreditDowngradeDetails">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.noCreditDowngradeTotal || 0).toLocaleString() }} 筆 / {{ formatTime(metrics.noCreditDowngradeAvgTime) }}
                <span class="toggle-arrow">{{ showNoCreditDowngradeDetails ? '▼' : '▶' }}</span>
              </span>
            </div>
            <div v-show="showNoCreditDowngradeDetails" class="block-details amount-list">
              <div
                v-for="amt in amountRanges"
                :key="amt"
                class="detail-item"
              >
                <span class="detail-label">{{ amt.toLocaleString() }} 元</span>
                <span class="detail-value">{{ (metrics.noCreditDowngradeByAmount?.[amt] || 0).toLocaleString() }} 筆</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">其他金額</span>
                <span class="detail-value">{{ (metrics.noCreditDowngradeByAmount?.['other'] || 0).toLocaleString() }} 筆</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- c2c 區域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showC2c = !showC2c">
          <h3 class="section-title">c2c</h3>
          <span class="section-value">{{ (metrics.c2cCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.c2cAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showC2c ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showC2c" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">點確認（用戶確認到帳）</span>
            <span class="detail-value">{{ (metrics.c2cConfirmCount || 0).toLocaleString() }} 筆</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">點確認（用戶確認到帳）-平均時間</span>
            <span class="detail-value">{{ formatTime(metrics.c2cConfirmAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">人工审核:通过</span>
            <span class="detail-value">{{ (metrics.c2cManualAuditCount || 0).toLocaleString() }} 筆</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">审核-成功平均時間</span>
            <span class="detail-value">{{ formatTime(metrics.c2cAuditSuccessAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">超過11min補件後才成功</span>
            <span class="detail-value">{{ (metrics.c2cOver11MinSuccessCount || 0).toLocaleString() }} 筆</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">騙分拉黑</span>
            <span class="detail-value">0 筆</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">卡验及人验</span>
            <span class="detail-value">0 筆</span>
          </div>
        </div>
      </div>

      <!-- 骗分没到账来找 區域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showFraud = !showFraud">
          <h3 class="section-title">骗分没到账来找</h3>
          <span class="section-value">0 筆 / 0.00 元</span>
          <span class="toggle-icon">{{ showFraud ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showFraud" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">人工</span>
            <span class="detail-value">0 筆 / 0.00 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信评</span>
            <span class="detail-value">0 筆 / 0.00 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">没上传回单重复出款充值上分</span>
            <span class="detail-value">0 筆 / 0.00 元</span>
          </div>
        </div>
      </div>

      <!-- 商業平台 區域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showCommercial = !showCommercial">
          <h3 class="section-title">商業平台</h3>
          <span class="toggle-icon">{{ showCommercial ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showCommercial" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">外部充值成功</span>
            <span class="detail-value">0 筆 / 0.00 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">未收单</span>
            <span class="detail-value">0 筆</span>
          </div>
          <div class="detail-header">极速充提3(银行卡)_CNX交易所</div>
          <div class="detail-item">
            <span class="detail-label">充值申請</span>
            <span class="detail-value">{{ (metrics.cnxApplicationCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.cnxApplicationAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">充值成功筆數</span>
            <span class="detail-value">{{ (metrics.cnxSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.cnxSuccessAmount || 0) }} 元</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 支付寶渠道 ========== -->
    <template v-else-if="activeChannel === 'alipay'">
      <!-- 極速（支付寶） -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipay = !showAlipay">
          <h3 class="section-title">極速（支付寶）</h3>
          <span class="toggle-icon">{{ showAlipay ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipay" class="jisu-content">
          <!-- 1. 充值申請筆數 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申請筆數</span>
              <span class="block-value">{{ (metrics.alipayApplicationCount || 0).toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.alipayExpressCardAppCount || 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- 2. 成功配對筆數/金額 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">成功配對</span>
              <span class="block-value">{{ (metrics.alipayTotalMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.alipayTotalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.alipayNormalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.alipayExpressMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.alipayExpressMatchAmount || 0) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 3. 訂單成功筆數/金額 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">訂單成功</span>
              <span class="block-value">{{ (metrics.alipayTotalOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.alipayTotalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.alipayNormalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.alipayExpressOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.alipayExpressOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信評上分</span>
                <span class="detail-value">{{ (metrics.alipayCreditScoreSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.alipayCreditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.alipayCreditScoreAvgTime) }}</span>
              </div>
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">{{ (metrics.alipayNoCreditDowngradeTotal || 0).toLocaleString() }} 筆 / {{ formatTime(metrics.alipayNoCreditDowngradeAvgTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 微信渠道 ========== -->
    <template v-else-if="activeChannel === 'wechat'">
      <!-- 極速（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechat = !showWechat">
          <h3 class="section-title">極速（微信）</h3>
          <span class="toggle-icon">{{ showWechat ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechat" class="jisu-content">
          <!-- 1. 充值申請筆數 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申請筆數</span>
              <span class="block-value">{{ (metrics.wechatApplicationCount || 0).toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.wechatExpressCardAppCount || 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- 2. 成功配對筆數/金額 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">成功配對</span>
              <span class="block-value">{{ (metrics.wechatTotalMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.wechatTotalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.wechatNormalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.wechatExpressMatchCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.wechatExpressMatchAmount || 0) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 3. 訂單成功筆數/金額 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">訂單成功</span>
              <span class="block-value">{{ (metrics.wechatTotalOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.wechatTotalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.wechatNormalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">極速</span>
                <span class="detail-value">{{ (metrics.wechatExpressOrderSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.wechatExpressOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信評上分</span>
                <span class="detail-value">{{ (metrics.wechatCreditScoreSuccessCount || 0).toLocaleString() }} 筆 / {{ formatAmount(metrics.wechatCreditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.wechatCreditScoreAvgTime) }}</span>
              </div>
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">{{ (metrics.wechatNoCreditDowngradeTotal || 0).toLocaleString() }} 筆 / {{ formatTime(metrics.wechatNoCreditDowngradeAvgTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.metrics-container {
  margin-bottom: 24px;
}

/* 渠道切換按鈕 */
.channel-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: #1c1c1e;
  padding: 8px;
  border-radius: 12px;
}

.channel-tab {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: #8e8e93;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.channel-tab:hover {
  color: #fff;
  background: #2c2c2e;
}

.channel-tab.active {
  background: #0a84ff;
  color: #fff;
}

.metrics-section {
  margin-bottom: 20px;
  background: #1c1c1e;
  border-radius: 16px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.section-header:hover {
  background: #2c2c2e;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.toggle-icon {
  color: #8e8e93;
  font-size: 12px;
}

.section-value {
  font-size: 16px;
  font-weight: 700;
  color: #0a84ff;
  flex: 1;
  text-align: right;
  margin-right: 12px;
}

/* c2c 區域樣式 */
.c2c-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 20px 16px;
}

.metrics-grid {
  display: grid;
  gap: 12px;
  padding: 0 16px 16px;
}

.five-grid {
  grid-template-columns: repeat(5, 1fr);
}

.metric-card {
  background: #2c2c2e;
  border-radius: 12px;
  padding: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.card-icon {
  font-size: 16px;
}

.card-title {
  font-size: 13px;
  color: #8e8e93;
}

.card-value {
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.card-unit {
  font-size: 12px;
  font-weight: 400;
  color: #8e8e93;
}

/* 極速區域樣式 */
.jisu-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 0 16px 16px;
}

.jisu-block {
  background: #2c2c2e;
  border-radius: 12px;
  padding: 16px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #3a3a3c;
}

.block-header.clickable {
  cursor: pointer;
  transition: background 0.2s;
  margin: -16px -16px 16px -16px;
  padding: 16px;
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid #3a3a3c;
}

.block-header.clickable:hover {
  background: #3a3a3c;
}

.toggle-arrow {
  margin-left: 8px;
  font-size: 12px;
  color: #8e8e93;
}

.amount-list {
  max-height: 300px;
  overflow-y: auto;
}

.block-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.block-value {
  font-size: 16px;
  font-weight: 700;
  color: #0a84ff;
}

.block-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: #8e8e93;
}

.detail-value {
  font-size: 13px;
  color: #fff;
  font-family: monospace;
}

.detail-header {
  font-size: 14px;
  font-weight: 600;
  color: #0a84ff;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #3a3a3c;
}

@media (max-width: 1200px) {
  .five-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .jisu-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .five-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .jisu-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 500px) {
  .five-grid {
    grid-template-columns: 1fr;
  }

  .card-value {
    font-size: 20px;
  }
}
</style>
