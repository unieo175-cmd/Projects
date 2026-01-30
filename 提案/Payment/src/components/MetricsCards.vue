<script setup>
import { ref, computed, watch } from 'vue';
import { formatTime, formatTimeMinutes, formatAmount } from '../utils/csvParser';

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  },
  dateRange: {
    type: Object,
    default: () => ({ dateFrom: '', dateTo: '' })
  },
  dataDate: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['channelChange']);

// 渠道切换
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay', 'wechat'

// 当渠道改变时通知父组件
watch(activeChannel, (newChannel) => {
  emit('channelChange', newChannel);
});

// 控制区域显示/隐藏
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
const showAlipayC2c = ref(true);
const showAlipayFraud = ref(true);
const showMinuteAnalysis = ref(true);
const showThirdParty = ref(true);
const showAlipayThirdParty = ref(true);

// 金额区间列表
const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];

// 从 localStorage 读取骗分统计数据
const fraudStats = computed(() => {
  const defaultStats = {
    bankCard: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    alipay: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    wechat: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0 }
  };

  try {
    const stored = localStorage.getItem('fraudRecords');
    if (!stored) {
      return defaultStats;
    }

    const records = JSON.parse(stored);
    if (!Array.isArray(records)) {
      return defaultStats;
    }

    // 如果没有选择日期范围，使用 dataDate 作为默认（单日）
    let dateFrom = props.dateRange?.dateFrom || '';
    let dateTo = props.dateRange?.dateTo || '';

    // 如果两个日期都是空的，使用 dataDate 作为单日筛选
    if (!dateFrom && !dateTo && props.dataDate) {
      dateFrom = props.dataDate;
      dateTo = props.dataDate;
    }

    // 如果只有开始日期没有结束日期，视为单日筛选
    if (dateFrom && !dateTo) {
      dateTo = dateFrom;
    }

    // 过滤符合日期范围的记录
    let filteredRecords = records;
    if (dateFrom || dateTo) {
      filteredRecords = records.filter(r => {
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
        return true;
      });
    }

  // 初始化结果
  const result = {
    bankCard: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    alipay: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    wechat: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0 }
  };

  // 加总所有符合条件的记录
  filteredRecords.forEach(r => {
    // 银行卡
    result.bankCard.manualCount += parseFloat(r.bankCardManualCount) || 0;
    result.bankCard.manualAmount += parseFloat(r.bankCardManualAmount) || 0;
    result.bankCard.creditCount += parseFloat(r.bankCardCreditCount) || 0;
    result.bankCard.creditAmount += parseFloat(r.bankCardCreditAmount) || 0;
    result.bankCard.fraudBlacklistCount += parseFloat(r.bankCardFraudBlacklistCount) || 0;
    result.bankCard.cardVerifyCount += parseFloat(r.bankCardCardVerifyCount) || 0;

    // 支付宝
    result.alipay.manualCount += parseFloat(r.alipayManualCount) || 0;
    result.alipay.manualAmount += parseFloat(r.alipayManualAmount) || 0;
    result.alipay.creditCount += parseFloat(r.alipayCreditCount) || 0;
    result.alipay.creditAmount += parseFloat(r.alipayCreditAmount) || 0;
    result.alipay.noReceiptCount += parseFloat(r.alipayNoReceiptCount) || 0;
    result.alipay.fraudBlacklistCount += parseFloat(r.alipayFraudBlacklistCount) || 0;
    result.alipay.cardVerifyCount += parseFloat(r.alipayCardVerifyCount) || 0;
  });

    return result;
  } catch (e) {
    console.error('读取骗分统计数据失败:', e);
    return defaultStats;
  }
});

// 第一区域：重要信息
// 公式：
// - 总申请笔数 = 所有充值笔数
// - 成功率 = 充值成功笔数 (AP > 0) / 总申请笔数
// - 总申请金额 = 充值成功笔数金额加总
// - 平均时间 = 充值成功笔数的 (通知时间 - 建立时间) 平均
// - 掉单笔数 = 充值成功 (AP > 0) 且状态包含「补」
const generalCards = computed(() => [
  {
    title: '总申请笔数',
    value: (props.metrics.totalApplicationCount || 0).toLocaleString(),
    unit: `(成功率 ${(props.metrics.overallSuccessRate || 0).toFixed(2)}%)`,
    color: '#0a84ff',
    icon: '📊',
    formula: '极速银行卡+支付宝+微信 成功配对笔数'
  },
  {
    title: '总充值成功（含掉单）',
    value: (props.metrics.successfulCount || 0).toLocaleString(),
    unit: '笔',
    color: '#30d158',
    icon: '✅',
    formula: '实际收到金额 > 0 的笔数'
  },
  {
    title: '总充值金额',
    value: formatAmount(props.metrics.totalApplicationAmount || 0),
    unit: '元',
    color: '#30d158',
    icon: '💰',
    formula: '实际收到金额 > 0 的金额加总'
  },
  {
    title: '平均处理时间',
    value: formatTime(props.metrics.overallAvgTime),
    unit: '',
    color: '#0a84ff',
    icon: '⏱️',
    formula: '实际收到金额 > 0 的处理时间平均'
  },
  {
    title: '无效申请',
    value: (props.metrics.invalidApplicationCount || 0).toLocaleString(),
    unit: `(${(props.metrics.invalidApplicationRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '❌',
    formula: '状态含"取消" 或 实际收到金额=0'
  },
  {
    title: '掉单笔数',
    value: (props.metrics.overallDropOrderCount || 0).toLocaleString(),
    unit: `(${(props.metrics.overallDropOrderRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '⚠️',
    formula: '实际收到金额>0 且 状态含"補"'
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
    formula: '处理时间 <= 120秒'
  },
  {
    title: '3-5分钟',
    value: (props.metrics.within3to5MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within3to5MinRatio || 0).toFixed(2)}%)`,
    color: '#5e5ce6',
    icon: '🕐',
    formula: '处理时间 180~300秒'
  },
  {
    title: '5-15分钟',
    value: (props.metrics.within5to15MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within5to15MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕑',
    formula: '处理时间 300~900秒'
  },
  {
    title: '15-30分钟',
    value: (props.metrics.within15to30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within15to30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕒',
    formula: '处理时间 900~1800秒'
  },
  {
    title: '30分钟以上',
    value: (props.metrics.over30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.over30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '🕓',
    formula: '处理时间 > 1800秒'
  }
]);
</script>

<template>
  <div class="metrics-container">
    <!-- 渠道切换 -->
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

      <!-- 充值成功时间区段 -->
      <div class="metrics-section">
        <div class="section-header" @click="showMinuteAnalysis = !showMinuteAnalysis">
          <h3 class="section-title">充值成功时间区段</h3>
          <span class="toggle-icon">{{ showMinuteAnalysis ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showMinuteAnalysis" class="minute-analysis-content">
          <table class="minute-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>笔数/百分比</th>
                <th>金额</th>
                <th>计算公式</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>总申请笔数</td>
                <td>{{ (metrics.totalApplicationCount || 0).toLocaleString() }}</td>
                <td>--</td>
                <td class="formula-cell">银行卡+支付宝+微信 总申请笔数</td>
              </tr>
              <tr>
                <td>总充值成功（含掉单）</td>
                <td>{{ (metrics.minuteAnalysisTotalCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.minuteAnalysisTotalAmount || 0) }} 元</td>
                <td class="formula-cell">实际收到金额 > 0 的笔数</td>
              </tr>
              <tr>
                <td>2分钟内</td>
                <td>{{ (metrics.minuteWithin2MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin2MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin2MinAmount || 0) }} 元</td>
                <td class="formula-cell">处理时间 <= 120秒</td>
              </tr>
              <tr>
                <td>2-3分钟</td>
                <td>{{ (metrics.minuteWithin2to3MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin2to3MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin2to3MinAmount || 0) }} 元</td>
                <td class="formula-cell">处理时间 120~180秒</td>
              </tr>
              <tr>
                <td>3-5分钟</td>
                <td>{{ (metrics.minuteWithin3to5MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin3to5MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin3to5MinAmount || 0) }} 元</td>
                <td class="formula-cell">处理时间 180~300秒</td>
              </tr>
              <tr>
                <td>5-15分钟</td>
                <td>{{ (metrics.minuteWithin5to15MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin5to15MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin5to15MinAmount || 0) }} 元</td>
                <td class="formula-cell">处理时间 300~900秒</td>
              </tr>
              <tr>
                <td>15-30分钟</td>
                <td>{{ (metrics.minuteWithin15to30MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin15to30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin15to30MinAmount || 0) }} 元</td>
                <td class="formula-cell">处理时间 900~1800秒</td>
              </tr>
              <tr>
                <td>30分钟以上</td>
                <td>{{ (metrics.minuteOver30MinCount || 0).toLocaleString() }} ({{ (metrics.minuteOver30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteOver30MinAmount || 0) }} 元</td>
                <td class="formula-cell">处理时间 > 1800秒</td>
              </tr>
              <tr class="divider-row">
                <td colspan="4"></td>
              </tr>
              <tr>
                <td>无效申请</td>
                <td>{{ (metrics.minuteInvalidCount || 0).toLocaleString() }}</td>
                <td>-- / ({{ (metrics.minuteInvalidRatio || 0).toFixed(2) }}%)</td>
                <td class="formula-cell">到账金额=0 且 银行卡代号不为空</td>
              </tr>
              <tr>
                <td>掉单</td>
                <td>{{ (metrics.minuteDropCount || 0).toLocaleString() }}</td>
                <td>-- / ({{ (metrics.minuteDropRatio || 0).toFixed(2) }}%)</td>
                <td class="formula-cell">实际收到金额>0 且 状态含"補"</td>
              </tr>
              <tr class="highlight-row">
                <td>平均处理时间</td>
                <td>{{ formatTime(metrics.minuteAvgTime) }}</td>
                <td>--</td>
                <td class="formula-cell">实际收到金额>0 的处理时间平均</td>
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
                <span class="detail-value">{{ (metrics.waitingForMatchCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">{{ (metrics.noCard06Count || 0).toLocaleString() }}</span>
              </div>
            </div>
            <div class="block-formula">
              <strong>数据范围：</strong>商户不含支付宝/微信/test/qa/线下<br>
              <strong>一般卡：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD<br>
              <strong>极速提：</strong>银行卡代号=AUCTION_PAYMENT_CARD<br>
              <strong>建单成功等待无配对：</strong>有商户名称但银行卡号为空的笔数<br>
              <strong>取无卡06提示：</strong>数据来源：极速06统计表
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
            <div class="block-formula">
              <strong>成功配对：</strong>银行卡代号有值的记录<br>
              <strong>金额：</strong>使用充值金额（申请金额）计算
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
              <div class="detail-item">
                <span class="detail-label">平均处理时间</span>
                <span class="detail-value">{{ formatTime(metrics.noCreditDowngradeAvgTime) }}</span>
              </div>
            </div>
            <div class="block-formula">
              <strong>订单成功条件：</strong>正规化状态有值、≠未充值、≠审核中(已超时)<br>
              <strong>一般卡：</strong>银行卡代号有值、≠AUCTION + 上述条件<br>
              <strong>极速提：</strong>银行卡代号=AUCTION、到账金额>0 + 上述条件<br>
              <strong>信评上分：</strong>到账金额>0 且状态包含「信用」<br>
              <strong>平均处理时间：</strong>没信评降等配卡的平均处理时间
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.noCreditDowngradeTotal || 0).toLocaleString() }} 笔
              </span>
            </div>
            <div class="block-details amount-list scrollable-list">
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
            <div class="block-formula">无信评降等配卡的笔数，按申请金额分组统计</div>
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
            <span class="detail-label">点确认（用户确认到账）-平均处理时间</span>
            <span class="detail-value">{{ formatTimeMinutes(metrics.c2cConfirmAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">人工审核:通过</span>
            <span class="detail-value">{{ (metrics.c2cManualAuditCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">审核-成功平均处理时间</span>
            <span class="detail-value">{{ formatTimeMinutes(metrics.c2cAuditSuccessAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">超过11min补件后才成功</span>
            <span class="detail-value">{{ (metrics.c2cOver11MinSuccessCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="section-formula">银行卡代码含"c2c" 的订单成功笔数/金额</div>
        </div>
      </div>

      <!-- 三方代收 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showThirdParty = !showThirdParty">
          <h3 class="section-title">三方代收（一般卡订单成功）</h3>
          <span class="section-value">{{ (metrics.thirdPartyCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showThirdParty ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showThirdParty" class="c2c-content">
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
          <div class="detail-item">
            <span class="detail-label">其他</span>
            <span class="detail-value">{{ (metrics.thirdPartyOtherCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyOtherAmount || 0) }} 元</span>
          </div>
          <div class="section-formula">
            数据范围：商户不含支付宝/微信/test/qa，排除线下充值商户<br>
            三方代收计算公式：<br>
            - 汇通 = 银行卡代号 HTc2c 开头<br>
            - 豆豆 = 银行卡代号 DDF 开头<br>
            - UC聚合 = 银行卡代号 uc1020 开头<br>
            - 其他 = 到账金额 ≠ 0，包含 GB-Dahaomen/Dahaomen 开头，排除汇通/豆豆/UC及 auction/gb 开头
          </div>
        </div>
      </div>

      <!-- 骗分没到账来找 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showFraud = !showFraud">
          <h3 class="section-title">骗分没到账来找</h3>
          <span class="section-value">{{ formatAmount(fraudStats.bankCard.manualAmount + fraudStats.bankCard.creditAmount) }} 元 / {{ (fraudStats.bankCard.manualCount + fraudStats.bankCard.creditCount).toLocaleString() }} 笔</span>
          <span class="toggle-icon">{{ showFraud ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showFraud" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">人工</span>
            <span class="detail-value">{{ formatAmount(fraudStats.bankCard.manualAmount) }} 元 / {{ fraudStats.bankCard.manualCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信评</span>
            <span class="detail-value">{{ formatAmount(fraudStats.bankCard.creditAmount) }} 元 / {{ fraudStats.bankCard.creditCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-divider"></div>
          <div class="detail-item">
            <span class="detail-label">骗分拉黑</span>
            <span class="detail-value">{{ fraudStats.bankCard.fraudBlacklistCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">卡验及人验</span>
            <span class="detail-value">{{ fraudStats.bankCard.cardVerifyCount.toLocaleString() }} 笔</span>
          </div>
          <div class="section-formula">数据來源：骗分统计（依筛选日期范围加总）</div>
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
          <div class="section-formula">商户含"CNX" 的充值申請/成功笔数金额</div>
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
                <span class="detail-value">{{ (metrics.alipayWaitingForMatchCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">0</span>
              </div>
            </div>
            <div class="block-formula">
              <strong>数据范围：</strong>商户含「支付宝」或「支付宝」<br>
              <strong>一般卡：</strong>银行卡代号有值、≠AUCTION_PAYMENT_CARD、银行名称≠支付宝/支付宝(企)/微信支付<br>
              <strong>一般宝：</strong>银行卡代号有值、≠AUCTION_PAYMENT_CARD、银行名称=支付宝/支付宝(企)/微信支付<br>
              <strong>极速提(卡)：</strong>银行卡代号=AUCTION_PAYMENT_CARD、银行名称≠支付宝/支付宝(企)/微信支付<br>
              <strong>极速提(宝)：</strong>银行卡代号=AUCTION_PAYMENT_CARD、银行名称=支付宝/支付宝(企)/微信支付<br>
              <strong>建单成功等待无配对：</strong>有商户名称但银行卡号为空的笔数<br>
              <strong>取无卡06提示：</strong>数据来源：极速06统计表
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
            <div class="block-formula">
              <strong>成功配对：</strong>银行卡代号有值的记录<br>
              <strong>金额：</strong>使用充值金额（申请金额）计算<br>
              <strong>分类逻辑：</strong>同充值申请的分类条件
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
              <div class="detail-item">
                <span class="detail-label">平均处理时间</span>
                <span class="detail-value">{{ formatTime(metrics.alipayNoCreditDowngradeAvgTime) }}</span>
              </div>
            </div>
            <div class="block-formula">
              <strong>订单成功条件：</strong>正规化状态有值、≠未充值、≠审核中(已超时)、≠图文复核(已超时)<br>
              <strong>一般卡：</strong>银行卡代号有值、≠AUCTION、银行名称≠支付宝/微信 + 上述条件<br>
              <strong>一般宝：</strong>银行卡代号有值、≠AUCTION、银行名称=支付宝/微信 + 上述条件<br>
              <strong>极速提(卡)：</strong>银行卡代号=AUCTION、银行名称≠支付宝/微信 + 上述条件<br>
              <strong>极速提(宝)：</strong>银行卡代号=AUCTION、银行名称=支付宝/微信 + 上述条件<br>
              <strong>信评上分：</strong>正规化状态包含「信用评分上分」<br>
              <strong>平均处理时间：</strong>没信评降等配卡的平均处理时间
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.alipayNoCreditDowngradeTotal || 0).toLocaleString() }} 笔
              </span>
            </div>
            <div class="block-details amount-list scrollable-list">
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
            <div class="block-formula">无信评降等配卡的笔数，按申请金额分组统计</div>
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
            <span class="detail-label">点确认（用户确认到账）-平均处理时间</span>
            <span class="detail-value">{{ formatTimeMinutes(metrics.alipayC2cConfirmAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">人工审核:通过</span>
            <span class="detail-value">{{ (metrics.alipayC2cManualAuditCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">审核-成功平均处理时间</span>
            <span class="detail-value">{{ formatTimeMinutes(metrics.alipayC2cAuditSuccessAvgTime) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">超过11min补件后才成功</span>
            <span class="detail-value">{{ (metrics.alipayC2cOver11MinSuccessCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="section-formula">银行卡代码含"c2c" 的订单成功笔数/金额</div>
        </div>
      </div>

      <!-- 三方代收 区域（支付宝） -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipayThirdParty = !showAlipayThirdParty">
          <h3 class="section-title">三方代收（一般卡订单成功）</h3>
          <span class="section-value">{{ (metrics.alipayThirdPartyCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyAmount || 0) }} 元</span>
          <span class="toggle-icon">{{ showAlipayThirdParty ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipayThirdParty" class="c2c-content">
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
          <div class="detail-item">
            <span class="detail-label">其他</span>
            <span class="detail-value">{{ (metrics.alipayThirdPartyOtherCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyOtherAmount || 0) }} 元</span>
          </div>
          <div class="section-formula">
            数据范围：商户含「支付宝」，排除线下充值商户<br>
            三方代收计算公式：<br>
            - 汇通 = 银行卡代号 HTc2c 开头<br>
            - 豆豆 = 银行卡代号 DDF 开头<br>
            - UC聚合 = 银行卡代号 uc1020 开头<br>
            - 其他 = 到账金额 ≠ 0，包含 GB-Dahaomen/Dahaomen 开头，排除汇通/豆豆/UC及 auction/gb 开头
          </div>
        </div>
      </div>

      <!-- 骗分没到账来找 区域 -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipayFraud = !showAlipayFraud">
          <h3 class="section-title">骗分没到账来找</h3>
          <span class="section-value">{{ formatAmount(fraudStats.alipay.manualAmount + fraudStats.alipay.creditAmount) }} 元 / {{ (fraudStats.alipay.manualCount + fraudStats.alipay.creditCount).toLocaleString() }} 笔</span>
          <span class="toggle-icon">{{ showAlipayFraud ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipayFraud" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">人工</span>
            <span class="detail-value">{{ formatAmount(fraudStats.alipay.manualAmount) }} 元 / {{ fraudStats.alipay.manualCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信评</span>
            <span class="detail-value">{{ formatAmount(fraudStats.alipay.creditAmount) }} 元 / {{ fraudStats.alipay.creditCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">没上传回单重复出款充值上分</span>
            <span class="detail-value">{{ fraudStats.alipay.noReceiptCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-divider"></div>
          <div class="detail-item">
            <span class="detail-label">骗分拉黑</span>
            <span class="detail-value">{{ fraudStats.alipay.fraudBlacklistCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">卡验及人验</span>
            <span class="detail-value">{{ fraudStats.alipay.cardVerifyCount.toLocaleString() }} 笔</span>
          </div>
          <div class="section-formula">数据來源：骗分统计（依筛选日期范围加总）</div>
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
            <span class="detail-value highlight">{{ (metrics.alipayOverallMatchRate || 0).toFixed(2) }}%</span>
          </div>
          <div class="section-formula">
            整体 配对成功/提现申请 计算公式：<br>
            分子 = 银行卡订单成功极速提金额 + 支付宝订单成功极速提(卡)金额 + 支付宝订单成功极速提(宝)金额<br>
            分母 = 支付宝提现申请金额 + 银行卡提现申请金额（来自提现分析）
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
            <div class="block-formula">
              商户含"微信"
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
            <div class="block-formula">银行卡代码不为空 的笔数/申请金额</div>
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
              <div class="detail-item">
                <span class="detail-label">平均处理时间</span>
                <span class="detail-value">{{ formatTime(metrics.wechatNoCreditDowngradeAvgTime) }}</span>
              </div>
            </div>
            <div class="block-formula">
              实际收到金额 > 0 的笔数/金额<br>
              <strong>平均处理时间：</strong>没信评降等配卡的平均处理时间
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.wechatNoCreditDowngradeTotal || 0).toLocaleString() }} 笔
              </span>
            </div>
            <div class="block-details amount-list scrollable-list">
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
            <div class="block-formula">无信评降等配卡的笔数，按申请金额分组统计</div>
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
            <span class="detail-label">点确认（用户确认到账）-平均处理时间</span>
            <span class="detail-value">00:00:00</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">人工审核:通过</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">审核-成功平均处理时间</span>
            <span class="detail-value">00:00:00</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">超过11min补件后才成功</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="section-formula">银行卡代码含"c2c" 的订单成功笔数/金额</div>
        </div>
      </div>

      <!-- 三方代收 区域（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechatThirdParty = !showWechatThirdParty">
          <h3 class="section-title">三方代收（一般卡订单成功）</h3>
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
          <div class="section-formula">银行卡代码为特定三方代收代码 的订单成功笔数/金额</div>
        </div>
      </div>

      <!-- 骗分没到账来找 区域（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechatFraud = !showWechatFraud">
          <h3 class="section-title">骗分没到账来找</h3>
          <span class="section-value">{{ formatAmount(fraudStats.wechat.manualAmount + fraudStats.wechat.creditAmount) }} 元 / {{ (fraudStats.wechat.manualCount + fraudStats.wechat.creditCount).toLocaleString() }} 笔</span>
          <span class="toggle-icon">{{ showWechatFraud ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechatFraud" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">人工</span>
            <span class="detail-value">{{ formatAmount(fraudStats.wechat.manualAmount) }} 元 / {{ fraudStats.wechat.manualCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信评</span>
            <span class="detail-value">{{ formatAmount(fraudStats.wechat.creditAmount) }} 元 / {{ fraudStats.wechat.creditCount.toLocaleString() }} 笔</span>
          </div>
          <div class="detail-divider"></div>
          <div class="detail-item">
            <span class="detail-label">骗分拉黑</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">卡验及人验</span>
            <span class="detail-value">0 笔</span>
          </div>
          <div class="section-formula">数据來源：骗分统计（依筛选日期范围加总）</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.metrics-container {
  margin-bottom: 20px;
}

/* 渠道切换按钮 */
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

/* c2c 区域样式 */
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

/* 极速区域样式 */
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

.scrollable-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  background: #f9f9fb;
  border-radius: 6px;
  border: 1px solid #e8e8f0;
}

.scrollable-list::-webkit-scrollbar {
  width: 6px;
}

.scrollable-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollable-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.scrollable-list::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
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

.detail-divider {
  height: 1px;
  background: #e8e8e8;
  margin: 8px 0;
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

.block-formula {
  font-size: 11px;
  color: #999;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e8e8e8;
  font-family: monospace;
}

.section-formula {
  font-size: 11px;
  color: #999;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e8e8e8;
  font-family: monospace;
}

/* 说明区块样式 */
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

/* 说明区块（用于 section 底部） */
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

/* 充值分钟分析样式 */
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
