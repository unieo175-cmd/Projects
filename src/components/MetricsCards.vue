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
const showWechatC2c = ref(false);
const showWechatThirdParty = ref(false);
const showWechatFraud = ref(false);
const showC2c = ref(true);
const showFraud = ref(true);
const showCommercial = ref(true);
const showTime = ref(true);
const showNoCreditDowngradeDetails = ref(false);
const showAlipayNoCreditDowngradeDetails = ref(false);
const showAlipayC2c = ref(true);
const showAlipayFraud = ref(true);
const showMinuteAnalysis = ref(true);
const showThirdParty = ref(true);
const showAlipayThirdParty = ref(true);
const showWechatNoCreditDowngradeDetails = ref(false);

// 金額區間列表
const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];

// 第一区域：重要信息
// 公式：
// - 總申請筆數 = 所有充值筆數
// - 成功率 = 充值成功筆數 (AP > 0) / 總申請筆數
// - 總申請金額 = 充值成功筆數金額加總
// - 平均時間 = 充值成功筆數的 (通知時間 - 建立時間) 平均
// - 掉單筆數 = 充值成功 (AP > 0) 且狀態包含「補」
const generalCards = computed(() => [
  {
    title: '总申请笔数',
    value: (props.metrics.totalApplicationCount || 0).toLocaleString(),
    unit: `(成功率 ${(props.metrics.overallSuccessRate || 0).toFixed(2)}%)`,
    color: '#0a84ff',
    icon: '📊',
    formula: '極速銀行卡+支付寶+微信 成功配對筆數'
  },
  {
    title: '总充值成功（含掉单）',
    value: (props.metrics.successfulCount || 0).toLocaleString(),
    unit: '笔',
    color: '#30d158',
    icon: '✅',
    formula: '實際收到金額 > 0 的筆數'
  },
  {
    title: '总申请金额',
    value: formatAmount(props.metrics.totalApplicationAmount || 0),
    unit: '元',
    color: '#30d158',
    icon: '💰',
    formula: '實際收到金額 > 0 的金額加總'
  },
  {
    title: '平均处理时间',
    value: formatTime(props.metrics.overallAvgTime),
    unit: '',
    color: '#0a84ff',
    icon: '⏱️',
    formula: '實際收到金額 > 0 的處理時間平均'
  },
  {
    title: '无效申请',
    value: (props.metrics.invalidApplicationCount || 0).toLocaleString(),
    unit: `(${(props.metrics.invalidApplicationRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '❌',
    formula: '狀態含"取消" 或 實際收到金額=0'
  },
  {
    title: '掉单笔数',
    value: (props.metrics.overallDropOrderCount || 0).toLocaleString(),
    unit: `(${(props.metrics.overallDropOrderRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '⚠️',
    formula: '實際收到金額>0 且 狀態含"補"'
  }
]);

// 第三区域：时间分布
const timeCards = computed(() => [
  {
    title: '2分钟内',
    value: (props.metrics.within2MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within2MinRatio || 0).toFixed(2)}%)`,
    color: '#30d158',
    icon: '⚡',
    formula: '處理時間 <= 120秒'
  },
  {
    title: '3-5分钟',
    value: (props.metrics.within3to5MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within3to5MinRatio || 0).toFixed(2)}%)`,
    color: '#5e5ce6',
    icon: '🕐',
    formula: '處理時間 180~300秒'
  },
  {
    title: '5-15分钟',
    value: (props.metrics.within5to15MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within5to15MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕑',
    formula: '處理時間 300~900秒'
  },
  {
    title: '15-30分钟',
    value: (props.metrics.within15to30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within15to30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕒',
    formula: '處理時間 900~1800秒'
  },
  {
    title: '30分钟以上',
    value: (props.metrics.over30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.over30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '🕓',
    formula: '處理時間 > 1800秒'
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
        极速(银行卡)
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'alipay' }"
        @click="activeChannel = 'alipay'"
      >
        极速(支付宝)
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'wechat' }"
        @click="activeChannel = 'wechat'"
      >
        极速(微信)
      </button>
    </div>

    <!-- ========== 全部渠道 ========== -->
    <template v-if="activeChannel === 'all'">
      <!-- 重要信息 -->
      <div class="metrics-section">
        <div class="section-header" @click="showGeneral = !showGeneral">
          <h3 class="section-title">重要信息</h3>
          <span class="toggle-icon">{{ showGeneral ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showGeneral" class="metrics-grid six-grid">
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
            <div v-if="card.formula" class="card-formula">{{ card.formula }}</div>
          </div>
        </div>
      </div>

      <!-- 处理时间分布 -->
      <div class="metrics-section">
        <div class="section-header" @click="showTime = !showTime">
          <h3 class="section-title">处理时间分布</h3>
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
            <div v-if="card.formula" class="card-formula">{{ card.formula }}</div>
          </div>
        </div>
      </div>

      <!-- 充值成功時間區段 -->
      <div class="metrics-section">
        <div class="section-header" @click="showMinuteAnalysis = !showMinuteAnalysis">
          <h3 class="section-title">充值成功時間區段</h3>
          <span class="toggle-icon">{{ showMinuteAnalysis ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showMinuteAnalysis" class="minute-analysis-content">
          <table class="minute-table">
            <thead>
              <tr>
                <th>項目</th>
                <th>筆數/百分比</th>
                <th>金額</th>
                <th>計算公式</th>
              </tr>
            </thead>
            <tbody>
              <tr class="highlight-row">
                <td>总充值成功（含掉单）</td>
                <td>{{ (metrics.minuteAnalysisTotalCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.minuteAnalysisTotalAmount || 0) }} 元</td>
                <td class="formula-cell">實際收到金額 > 0 的筆數/金額</td>
              </tr>
              <tr>
                <td>2分鐘內</td>
                <td>{{ (metrics.minuteWithin2MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin2MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin2MinAmount || 0) }} 元</td>
                <td class="formula-cell">處理時間 <= 120秒</td>
              </tr>
              <tr>
                <td>2-3分鐘</td>
                <td>{{ (metrics.minuteWithin2to3MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin2to3MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin2to3MinAmount || 0) }} 元</td>
                <td class="formula-cell">處理時間 120~180秒</td>
              </tr>
              <tr>
                <td>3-5分鐘</td>
                <td>{{ (metrics.minuteWithin3to5MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin3to5MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin3to5MinAmount || 0) }} 元</td>
                <td class="formula-cell">處理時間 180~300秒</td>
              </tr>
              <tr>
                <td>5-15分鐘</td>
                <td>{{ (metrics.minuteWithin5to15MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin5to15MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin5to15MinAmount || 0) }} 元</td>
                <td class="formula-cell">處理時間 300~900秒</td>
              </tr>
              <tr>
                <td>15-30分鐘</td>
                <td>{{ (metrics.minuteWithin15to30MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin15to30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin15to30MinAmount || 0) }} 元</td>
                <td class="formula-cell">處理時間 900~1800秒</td>
              </tr>
              <tr>
                <td>30分鐘以上</td>
                <td>{{ (metrics.minuteOver30MinCount || 0).toLocaleString() }} ({{ (metrics.minuteOver30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteOver30MinAmount || 0) }} 元</td>
                <td class="formula-cell">處理時間 > 1800秒</td>
              </tr>
              <tr class="divider-row">
                <td colspan="4"></td>
              </tr>
              <tr>
                <td>无效申请</td>
                <td>{{ (metrics.minuteInvalidCount || 0).toLocaleString() }}</td>
                <td>-- / ({{ (metrics.minuteInvalidRatio || 0).toFixed(2) }}%)</td>
                <td class="formula-cell">狀態含"取消" 或 實際收到金額=0</td>
              </tr>
              <tr>
                <td>掉单</td>
                <td>{{ (metrics.minuteDropCount || 0).toLocaleString() }}</td>
                <td>-- / ({{ (metrics.minuteDropRatio || 0).toFixed(2) }}%)</td>
                <td class="formula-cell">實際收到金額>0 且 狀態含"補"</td>
              </tr>
              <tr class="highlight-row">
                <td>平均時間</td>
                <td>{{ formatTime(metrics.minuteAvgTime) }}</td>
                <td>--</td>
                <td class="formula-cell">實際收到金額>0 的處理時間平均</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ========== 银行卡渠道 ========== -->
    <template v-else-if="activeChannel === 'bankCard'">
      <!-- 极速（银行卡） -->
      <div class="metrics-section">
        <div class="section-header" @click="showJisu = !showJisu">
          <h3 class="section-title">极速（银行卡）</h3>
          <span class="toggle-icon">{{ showJisu ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showJisu" class="jisu-content">
          <!-- 1. 充值申请笔数 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申请笔数</span>
              <span class="block-value">{{ (metrics.jisuApplicationCount || 0).toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提</span>
                <span class="detail-value">{{ (metrics.expressCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">建单成功等待无配对</span>
                <span class="detail-value">0</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">0</span>
              </div>
            </div>
          </div>

          <!-- 2. 成功配对笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">成功配对</span>
              <span class="block-value">{{ (metrics.totalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.totalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.normalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提</span>
                <span class="detail-value">{{ (metrics.expressMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.expressMatchAmount || 0) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 3. 订单成功笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">订单成功</span>
              <span class="block-value">{{ (metrics.totalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.totalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.normalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提</span>
                <span class="detail-value">{{ (metrics.expressOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.expressOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信评上分</span>
                <span class="detail-value">{{ (metrics.creditScoreSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.creditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.creditScoreAvgTime) }}</span>
              </div>
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header clickable" @click="showNoCreditDowngradeDetails = !showNoCreditDowngradeDetails">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.noCreditDowngradeTotal || 0).toLocaleString() }} 笔 / {{ formatTime(metrics.noCreditDowngradeAvgTime) }}
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
                <span class="detail-value">{{ (metrics.noCreditDowngradeByAmount?.[amt] || 0).toLocaleString() }} 笔</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">其他金额</span>
                <span class="detail-value">{{ (metrics.noCreditDowngradeByAmount?.['other'] || 0).toLocaleString() }} 笔</span>
              </div>
            </div>
          </div>

          <!-- 說明區塊 -->
          <div class="jisu-block note-block">
            <div class="block-header">
              <span class="block-title">說明</span>
            </div>
            <div class="block-details note-content">
              <div>充值申请笔数：商戶含"极速充提3"且非支付寶/微信</div>
              <div>成功配对：有bankCardCode的記錄</div>
              <div>订单成功：receivedAmount > 0</div>
              <div v-if="metrics.normalCardAppCount === 0">一般卡：尚缺公式計算</div>
              <div v-if="metrics.expressCardAppCount === 0">极速提：尚缺公式計算</div>
            </div>
          </div>
        </div>
      </div>

      <!-- c2c 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showC2c = !showC2c">
          <h3 class="section-title">c2c</h3>
          <span class="section-value">{{ (metrics.c2cCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.c2cAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showC2c ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showC2c" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">点确认（用户确认到账）</span>
            <span class="detail-value">{{ (metrics.c2cConfirmCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">点确认（用户确认到账）-平均时间</span>
            <span class="detail-value">{{ formatTime(metrics.c2cConfirmAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">人工审核:通过</span>
            <span class="detail-value">{{ (metrics.c2cManualAuditCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">审核-成功平均时间</span>
            <span class="detail-value">{{ formatTime(metrics.c2cAuditSuccessAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">超过11min补件后才成功</span>
            <span class="detail-value">{{ (metrics.c2cOver11MinSuccessCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">骗分拉黑</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">卡验及人验</span>
            <span class="detail-value">0 笔</span>
          </div>
        </div>
      </div>

      <!-- 三方代收 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showThirdParty = !showThirdParty">
          <h3 class="section-title">三方代收（一般卡訂單成功）</h3>
          <span class="section-value">{{ (metrics.thirdPartyCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showThirdParty ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showThirdParty" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">GB-DahaomenJFB</span>
            <span class="detail-value">{{ (metrics.thirdPartyDahaomenCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyDahaomenAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">汇通 (HTc2cdeposit)</span>
            <span class="detail-value">{{ (metrics.thirdPartyHuitongCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyHuitongAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">豆豆 (DDFdeposit)</span>
            <span class="detail-value">{{ (metrics.thirdPartyDoudouCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyDoudouAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">UC聚合 (UC1020)</span>
            <span class="detail-value">{{ (metrics.thirdPartyUCCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyUCAmount || 0) }} 元</span>
          </div>
        </div>
      </div>

      <!-- 骗分没到账来找 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showFraud = !showFraud">
          <h3 class="section-title">骗分没到账来找</h3>
          <span class="section-value">0 笔 / 0 元</span>
          <span class="toggle-icon">{{ showFraud ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showFraud" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">人工</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信评</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">没上传回单重复出款充值上分</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
        </div>
      </div>

      <!-- 商业平台 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showCommercial = !showCommercial">
          <h3 class="section-title">商业平台</h3>
          <span class="section-value">{{ (metrics.cnxApplicationCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.cnxSuccessAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showCommercial ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showCommercial" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">外部充值成功</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">未收单</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-header">极速充提3(银行卡)_CNX交易所</div>
          <div class="detail-item">
            <span class="detail-label">充值申请</span>
            <span class="detail-value">{{ (metrics.cnxApplicationCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.cnxApplicationAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">充值成功笔数</span>
            <span class="detail-value">{{ (metrics.cnxSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.cnxSuccessAmount || 0) }} 元</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 支付宝渠道 ========== -->
    <template v-else-if="activeChannel === 'alipay'">
      <!-- 极速（支付宝） -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipay = !showAlipay">
          <h3 class="section-title">极速（支付宝）</h3>
          <span class="toggle-icon">{{ showAlipay ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipay" class="jisu-content">
          <!-- 1. 充值申请笔数 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申请笔数</span>
              <span class="block-value">{{ (metrics.alipayApplicationCount || 0).toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">一般宝</span>
                <span class="detail-value">{{ (metrics.alipayExpressCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(卡)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTikaCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(宝)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTibaoCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">建单成功等待无配对</span>
                <span class="detail-value">0</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">0</span>
              </div>
            </div>
          </div>

          <!-- 2. 成功配对笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">成功配对</span>
              <span class="block-value">{{ (metrics.alipayTotalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayTotalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayNormalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">一般宝</span>
                <span class="detail-value">{{ (metrics.alipayExpressCardAppCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayExpressBaoMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(卡)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTikaCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTikaMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(宝)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTibaoCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTibaoMatchAmount || 0) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 3. 订单成功笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">订单成功</span>
              <span class="block-value">{{ (metrics.alipayTotalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayTotalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayNormalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">一般宝</span>
                <span class="detail-value">{{ (metrics.alipayBaoOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(卡)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTikaOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTikaOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(宝)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTibaoOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTibaoOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信评上分</span>
                <span class="detail-value">{{ (metrics.alipayCreditScoreSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayCreditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.alipayCreditScoreAvgTime) }}</span>
              </div>
              <div class="detail-item sub-item">
                <span class="detail-label">其中信评不含图文复核</span>
                <span class="detail-value">{{ (metrics.alipayCreditNoTuwenCount || 0).toLocaleString() }} 笔 / {{ formatTime(metrics.alipayCreditNoTuwenAvgTime) }}</span>
              </div>
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header clickable" @click="showAlipayNoCreditDowngradeDetails = !showAlipayNoCreditDowngradeDetails">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.alipayNoCreditDowngradeTotal || 0).toLocaleString() }} 笔 / {{ formatTime(metrics.alipayNoCreditDowngradeAvgTime) }}
                <span class="toggle-arrow">{{ showAlipayNoCreditDowngradeDetails ? '▼' : '▶' }}</span>
              </span>
            </div>
            <div v-show="showAlipayNoCreditDowngradeDetails" class="block-details amount-list">
              <div
                v-for="amt in amountRanges"
                :key="amt"
                class="detail-item"
              >
                <span class="detail-label">{{ amt.toLocaleString() }} 元</span>
                <span class="detail-value">{{ (metrics.alipayNoCreditDowngradeByAmount?.[amt] || 0).toLocaleString() }} 笔</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">其他金额</span>
                <span class="detail-value">{{ (metrics.alipayNoCreditDowngradeByAmount?.['other'] || 0).toLocaleString() }} 笔</span>
              </div>
            </div>
          </div>

          <!-- 說明區塊 -->
          <div class="jisu-block note-block">
            <div class="block-header">
              <span class="block-title">說明</span>
            </div>
            <div class="block-details note-content">
              <div>一般寶 有 +70</div>
              <div>极速提宝 有 +100</div>
              <div v-if="metrics.alipayNormalCardAppCount === 0">一般卡：尚缺公式計算</div>
              <div v-if="metrics.alipayJisuTikaCount === 0">极速提(卡)：尚缺公式計算</div>
              <div v-if="metrics.alipayJisuTibaoCount === 0">极速提(宝)：尚缺公式計算</div>
            </div>
          </div>
        </div>
      </div>

      <!-- c2c 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipayC2c = !showAlipayC2c">
          <h3 class="section-title">c2c</h3>
          <span class="section-value">{{ (metrics.alipayC2cCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayC2cAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showAlipayC2c ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipayC2c" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">点确认（用户确认到账）</span>
            <span class="detail-value">{{ (metrics.alipayC2cConfirmCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">点确认（用户确认到账）-平均时间</span>
            <span class="detail-value">{{ formatTime(metrics.alipayC2cConfirmAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">人工审核:通过</span>
            <span class="detail-value">{{ (metrics.alipayC2cManualAuditCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">审核-成功平均时间</span>
            <span class="detail-value">{{ formatTime(metrics.alipayC2cAuditSuccessAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">超过11min补件后才成功</span>
            <span class="detail-value">{{ (metrics.alipayC2cOver11MinSuccessCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">骗分拉黑</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">卡验及人验</span>
            <span class="detail-value">0 笔</span>
          </div>
        </div>
      </div>

      <!-- 三方代收 区域（支付寶） -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipayThirdParty = !showAlipayThirdParty">
          <h3 class="section-title">三方代收（一般卡訂單成功）</h3>
          <span class="section-value">{{ (metrics.alipayThirdPartyCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showAlipayThirdParty ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipayThirdParty" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">GB-DahaomenJFB</span>
            <span class="detail-value">{{ (metrics.alipayThirdPartyDahaomenCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyDahaomenAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">汇通 (HTc2cdeposit)</span>
            <span class="detail-value">{{ (metrics.alipayThirdPartyHuitongCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyHuitongAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">豆豆 (DDFdeposit)</span>
            <span class="detail-value">{{ (metrics.alipayThirdPartyDoudouCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyDoudouAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">UC聚合 (UC1020)</span>
            <span class="detail-value">{{ (metrics.alipayThirdPartyUCCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyUCAmount || 0) }} 元</span>
          </div>
        </div>
      </div>

      <!-- 骗分没到账来找 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipayFraud = !showAlipayFraud">
          <h3 class="section-title">骗分没到账来找</h3>
          <span class="section-value">0 笔 / 0 元</span>
          <span class="toggle-icon">{{ showAlipayFraud ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipayFraud" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">人工</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信评</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">没上传回单重复出款充值上分</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
        </div>
        <div class="section-note">
          <div class="note-title">說明：</div>
          <div class="note-content">
            <div>人工：尚缺公式計算</div>
            <div>信评：尚缺公式計算</div>
            <div>没上传回单重复出款充值上分：尚缺公式計算</div>
          </div>
        </div>
      </div>

      <!-- 宝转卡渠道及宝转宝渠道 提现申请笔数统计 -->
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">宝转卡渠道及宝转宝渠道 提现申请笔数统计</h3>
        </div>
        <div class="c2c-content">
          <div class="detail-header">宝转卡渠道，配支付宝提现</div>
          <div class="detail-item">
            <span class="detail-label">申请</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanKaCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanKaAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">成功</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanKaSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanKaSuccessAmount || 0) }} 元</span>
          </div>

          <div class="detail-header">宝转宝渠道，配银行卡提现</div>
          <div class="detail-item">
            <span class="detail-label">申请</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanBaoCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanBaoAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">成功</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanBaoSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanBaoSuccessAmount || 0) }} 元</span>
          </div>

          <div class="detail-item summary-item">
            <span class="detail-label">整体 配对成功/提现申请</span>
            <span class="detail-value highlight">0%</span>
          </div>
          <div class="detail-item summary-item">
            <span class="detail-label">整体-提现成功/提现申请</span>
            <span class="detail-value highlight">0%</span>
          </div>
        </div>
        <div class="section-note">
          <div class="note-title">說明：</div>
          <div class="note-content">
            <div>宝转卡渠道申请/成功：尚缺公式計算</div>
            <div>宝转宝渠道申请/成功：尚缺公式計算</div>
            <div>整体 配对成功/提现申请：尚缺公式計算</div>
            <div>整体-提现成功/提现申请：尚缺公式計算</div>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 微信渠道 ========== -->
    <template v-else-if="activeChannel === 'wechat'">
      <!-- 极速（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechat = !showWechat">
          <h3 class="section-title">极速（微信）</h3>
          <span class="toggle-icon">{{ showWechat ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechat" class="jisu-content">
          <!-- 1. 充值申请笔数 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申请笔数</span>
              <span class="block-value">{{ (metrics.wechatApplicationCount || 0).toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速</span>
                <span class="detail-value">{{ (metrics.wechatExpressCardAppCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">建单成功等待无配对</span>
                <span class="detail-value">0</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">0</span>
              </div>
            </div>
          </div>

          <!-- 2. 成功配对笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">成功配对</span>
              <span class="block-value">{{ (metrics.wechatTotalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatTotalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatNormalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速</span>
                <span class="detail-value">{{ (metrics.wechatExpressMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatExpressMatchAmount || 0) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 3. 订单成功笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">订单成功</span>
              <span class="block-value">{{ (metrics.wechatTotalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatTotalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatNormalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速</span>
                <span class="detail-value">{{ (metrics.wechatExpressOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatExpressOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信评上分</span>
                <span class="detail-value">{{ (metrics.wechatCreditScoreSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatCreditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.wechatCreditScoreAvgTime) }}</span>
              </div>
              <div class="detail-item sub-item">
                <span class="detail-label">其中信评不含图文复核</span>
                <span class="detail-value">0 笔 / 00:00:00</span>
              </div>
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header clickable" @click="showWechatNoCreditDowngradeDetails = !showWechatNoCreditDowngradeDetails">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.wechatNoCreditDowngradeTotal || 0).toLocaleString() }} 笔 / {{ formatTime(metrics.wechatNoCreditDowngradeAvgTime) }}
                <span class="toggle-arrow">{{ showWechatNoCreditDowngradeDetails ? '▼' : '▶' }}</span>
              </span>
            </div>
            <div v-show="showWechatNoCreditDowngradeDetails" class="block-details amount-list">
              <div
                v-for="amt in amountRanges"
                :key="amt"
                class="detail-item"
              >
                <span class="detail-label">{{ amt.toLocaleString() }} 元</span>
                <span class="detail-value">{{ (metrics.wechatNoCreditDowngradeByAmount?.[amt] || 0).toLocaleString() }} 笔</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">其他金额</span>
                <span class="detail-value">{{ (metrics.wechatNoCreditDowngradeByAmount?.['other'] || 0).toLocaleString() }} 笔</span>
              </div>
            </div>
          </div>

          <!-- 說明區塊 -->
          <div class="jisu-block note-block">
            <div class="block-header">
              <span class="block-title">說明</span>
            </div>
            <div class="block-details note-content">
              <div>充值申请笔数：商戶含"微信"</div>
              <div>成功配对：有bankCardCode的記錄</div>
              <div>订单成功：receivedAmount > 0</div>
              <div v-if="metrics.wechatNormalCardAppCount === 0">一般卡：尚缺公式計算</div>
              <div v-if="metrics.wechatExpressCardAppCount === 0">极速：尚缺公式計算</div>
            </div>
          </div>
        </div>
      </div>

      <!-- c2c 区域（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechatC2c = !showWechatC2c">
          <h3 class="section-title">c2c</h3>
          <span class="section-value">0 笔 / 0 元</span>
          <span class="toggle-icon">{{ showWechatC2c ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechatC2c" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">点确认（用户确认到账）</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">点确认（用户确认到账）-平均时间</span>
            <span class="detail-value">00:00:00</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">人工审核:通过</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">审核-成功平均时间</span>
            <span class="detail-value">00:00:00</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">超过11min补件后才成功</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">骗分拉黑</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">卡验及人验</span>
            <span class="detail-value">0 笔</span>
          </div>
        </div>
      </div>

      <!-- 三方代收 区域（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechatThirdParty = !showWechatThirdParty">
          <h3 class="section-title">三方代收（一般卡訂單成功）</h3>
          <span class="section-value">0 笔 / 0 元</span>
          <span class="toggle-icon">{{ showWechatThirdParty ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechatThirdParty" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">GB-DahaomenJFB</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">汇通 (HTc2cdeposit)</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">豆豆 (DDFdeposit)</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">UC聚合 (UC1020)</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
        </div>
      </div>

      <!-- 骗分没到账来找 区域（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechatFraud = !showWechatFraud">
          <h3 class="section-title">骗分没到账来找</h3>
          <span class="section-value">0 笔 / 0 元</span>
          <span class="toggle-icon">{{ showWechatFraud ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechatFraud" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">人工</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信评</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">没上传回单重复出款充值上分</span>
            <span class="detail-value">0 笔 / 0 元</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.metrics-container {
  margin-bottom: 20px;
}

/* 渠道切換按鈕 */
.channel-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: #fff;
  padding: 6px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.channel-tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.channel-tab:hover {
  color: #333;
  background: #f5f5f5;
}

.channel-tab.active {
  background: #4a4a9e;
  color: #fff;
}

.metrics-section {
  margin-bottom: 16px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.section-header:hover {
  background: #fafafa;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.toggle-icon {
  color: #999;
  font-size: 12px;
}

.section-value {
  font-size: 15px;
  font-weight: 600;
  color: #4a4a9e;
  flex: 1;
  text-align: right;
  margin-right: 12px;
}

/* c2c 區域樣式 */
.c2c-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
}

.metrics-grid {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.four-grid {
  grid-template-columns: repeat(4, 1fr);
}

.five-grid {
  grid-template-columns: repeat(5, 1fr);
}

.six-grid {
  grid-template-columns: repeat(6, 1fr);
}

.metric-card {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.card-icon {
  font-size: 14px;
}

.card-title {
  font-size: 12px;
  color: #666;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.card-unit {
  font-size: 11px;
  font-weight: 400;
  color: #999;
}

.card-formula {
  font-size: 10px;
  color: #999;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e8e8e8;
  font-family: monospace;
  line-height: 1.4;
}

/* 極速區域樣式 */
.jisu-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px;
}

.jisu-block {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8e8e8;
}

.block-header.clickable {
  cursor: pointer;
  transition: background 0.2s;
  margin: -14px -14px 12px -14px;
  padding: 14px;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid #e8e8e8;
}

.block-header.clickable:hover {
  background: #f0f0f0;
}

.toggle-arrow {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

.amount-list {
  max-height: 300px;
  overflow-y: auto;
}

.block-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.block-value {
  font-size: 14px;
  font-weight: 600;
  color: #4a4a9e;
}

.block-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: #666;
}

.detail-value {
  font-size: 13px;
  color: #333;
  font-family: monospace;
}

.detail-item.sub-item {
  padding-left: 16px;
}

.detail-item.sub-item .detail-label {
  color: #999;
}

.detail-header {
  font-size: 13px;
  font-weight: 600;
  color: #4a4a9e;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e8e8e8;
}

.detail-item.summary-item {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #e8e8e8;
}

.detail-item.summary-item .detail-label {
  font-weight: 600;
  color: #333;
}

.detail-value.highlight {
  color: #5cb85c;
  font-weight: 700;
  font-size: 15px;
}

/* 說明區塊樣式 */
.jisu-block.note-block {
  background: #f8f9fa;
  border: 1px dashed #ddd;
}

.jisu-block.note-block .block-header {
  border-bottom: 1px dashed #ddd;
}

.jisu-block.note-block .block-title {
  color: #666;
}

.note-content {
  font-size: 12px;
  color: #999;
  line-height: 1.8;
}

.note-content div {
  padding-left: 8px;
  border-left: 2px solid #ddd;
  margin-bottom: 4px;
}

/* 說明區塊（用於 section 底部） */
.section-note {
  padding: 12px 20px;
  background: #f8f9fa;
  border-top: 1px solid #f0f0f0;
}

.note-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

/* 充值分鐘分析樣式 */
.minute-analysis-content {
  padding: 16px 20px;
}

.minute-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.minute-table th {
  background: #5cb85c;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 12px 16px;
  text-align: left;
}

.minute-table th:nth-child(2),
.minute-table th:nth-child(3) {
  text-align: right;
}

.minute-table th:nth-child(4) {
  text-align: left;
  font-weight: 500;
}

.minute-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
}

.minute-table td:nth-child(2) {
  text-align: right;
  color: #4a4a9e;
  font-weight: 600;
}

.minute-table td:nth-child(3) {
  text-align: right;
  color: #666;
}

.minute-table tr:last-child td {
  border-bottom: none;
}

.minute-table tr:hover {
  background: #fafafa;
}

.minute-table tr.highlight-row {
  background: #e8f5e9;
}

.minute-table tr.highlight-row td {
  color: #333;
  font-weight: 600;
}

.minute-table tr.highlight-row td:nth-child(2) {
  color: #5cb85c;
}

.minute-table tr.divider-row td {
  padding: 6px 0;
  background: #f5f5f5;
  border-bottom: none;
}

.minute-table td.formula-cell {
  font-size: 11px;
  color: #999;
  font-family: monospace;
  text-align: left;
}

@media (max-width: 1200px) {
  .four-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .five-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .six-grid {
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
  .six-grid {
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
  .six-grid {
    grid-template-columns: 1fr;
  }

  .card-value {
    font-size: 18px;
  }
}
</style>
