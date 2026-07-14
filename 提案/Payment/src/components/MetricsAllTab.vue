<script setup>
import { ref } from 'vue';
import { formatTime, formatAmount } from '../utils/csvParser';

defineProps({
  metrics: { type: Object, default: () => ({}) },
  showFormula: { type: Boolean, default: false },
  generalCards: { type: Array, default: () => [] },
  isMultiDay: { type: Boolean, default: false },
  xAxisRuleText: { type: String, default: '' },
  maxAmount: { type: Number, default: 1 },
  maxCount: { type: Number, default: 1 },
  chartData: { type: Array, default: () => [] },
  amountLinePoints: { type: Array, default: () => [] },
  amountLinePolylinePoints: { type: String, default: '' }
});

const showGeneral = ref(true);
const showTime = ref(true);
const showMinuteAnalysis = ref(true);
</script>

<template>
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
              <span v-if="card.unit" class="card-unit" :style="{ color: card.unitColor || card.color }">{{ card.unit }}</span>
              <span v-if="card.successCount" class="card-unit">
                (<span :style="{ color: card.successColor }">{{ card.successCount }}</span>/<span style="color: #8e8e93">{{ card.totalCount }}</span>)
              </span>
            </div>
                      </div>
        </div>
      </div>

      <!-- 日交易分析（span >= 2 日才顯示） -->
      <div v-if="isMultiDay" class="metrics-section">
        <div class="section-header" @click="showTime = !showTime">
          <div>
            <h3 class="section-title">日交易分析</h3>
            <p class="chart-axis-rule">{{ xAxisRuleText }}</p>
          </div>
          <span class="toggle-icon">{{ showTime ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showTime" class="hourly-distribution">
          <div class="hourly-chart-wrapper">
            <!-- 左 Y 軸：金額 -->
            <div class="y-axis y-axis-left">
              <span>{{ (maxAmount / 10000).toFixed(0) }}萬</span>
              <span>{{ (maxAmount / 20000).toFixed(0) }}萬</span>
              <span>0</span>
            </div>
            <!-- 圖表區域 -->
            <div class="hourly-chart-container">
              <!-- 金額與筆數長條圖 -->
              <div class="hourly-chart">
                <!-- 背景虛線網格 -->
                <div class="grid-lines">
                  <div class="grid-line"></div>
                  <div class="grid-line"></div>
                  <div class="grid-line"></div>
                  <div class="grid-line"></div>
                  <div class="grid-line"></div>
                </div>
                <!-- 金額折線 -->
                <svg class="amount-line-svg" :viewBox="`0 0 ${chartData.length * 10} 100`" preserveAspectRatio="none">
                  <polyline
                    :points="amountLinePolylinePoints"
                    class="amount-line"
                    vector-effect="non-scaling-stroke"
                  />
                  <circle
                    v-for="(point, index) in amountLinePoints"
                    :key="index"
                    :cx="(index + 0.5) * 10"
                    :cy="100 - point.percent"
                    r="1.5"
                    class="amount-point"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
                <div
                  v-for="item in chartData"
                  :key="item.label"
                  class="hour-bar-group"
                >
                  <div class="hour-tooltip">
                    <div class="tooltip-label">{{ item.label }}</div>
                    <div class="tooltip-amount">金額：{{ (item.amount / 10000).toFixed(2) }}萬</div>
                    <div class="tooltip-count">筆數：{{ item.count.toLocaleString() }}筆</div>
                  </div>
                  <div class="bar-pair">
                    <div class="bar-count" :style="{ height: item.countPercent + '%' }"></div>
                  </div>
                  <span v-if="item.showLabel" class="hour-label">{{ item.label }}</span>
                </div>
              </div>
            </div>
            <!-- 右 Y 軸：筆數 -->
            <div class="y-axis y-axis-right">
              <span>{{ maxCount.toLocaleString() }}筆</span>
              <span>{{ Math.round(maxCount / 2).toLocaleString() }}筆</span>
              <span>0</span>
            </div>
          </div>
          <!-- 圖例 -->
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-line amount-line"></span>金額（左軸折線）</span>
            <span class="legend-item"><span class="legend-color count-bar-color"></span>筆數（右軸柱狀）</span>
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
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>总申请笔数</td>
                <td>{{ (metrics.totalApplicationCount || 0).toLocaleString() }}</td>
                <td>--</td>
              </tr>
              <tr>
                <td>总充值成功（含掉单）</td>
                <td>{{ (metrics.minuteAnalysisTotalCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.minuteAnalysisTotalAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>2分钟内</td>
                <td>{{ (metrics.minuteWithin2MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin2MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin2MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>2-3分钟</td>
                <td>{{ (metrics.minuteWithin2to3MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin2to3MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin2to3MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>3-5分钟</td>
                <td>{{ (metrics.minuteWithin3to5MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin3to5MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin3to5MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>5-15分钟</td>
                <td>{{ (metrics.minuteWithin5to15MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin5to15MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin5to15MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>15-30分钟</td>
                <td>{{ (metrics.minuteWithin15to30MinCount || 0).toLocaleString() }} ({{ (metrics.minuteWithin15to30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteWithin15to30MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>30分钟以上</td>
                <td>{{ (metrics.minuteOver30MinCount || 0).toLocaleString() }} ({{ (metrics.minuteOver30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.minuteOver30MinAmount || 0) }} 元</td>
              </tr>
              <tr class="divider-row">
                <td colspan="3"></td>
              </tr>
              <tr>
                <td>未成功申请</td>
                <td>{{ (metrics.minuteInvalidCount || 0).toLocaleString() }}</td>
                <td>-- / ({{ (metrics.minuteInvalidRatio || 0).toFixed(2) }}%)</td>
              </tr>
              <tr>
                <td>掉单</td>
                <td>{{ (metrics.minuteDropCount || 0).toLocaleString() }}</td>
                <td>-- / ({{ (metrics.minuteDropRatio || 0).toFixed(2) }}%)</td>
              </tr>
              <tr>
                <td>无卡空单率</td>
                <td>{{ ((metrics.jisuApplicationCount + metrics.alipayApplicationCount) > 0 ? (metrics.jsWaitingNoMatch / (metrics.jisuApplicationCount + metrics.alipayApplicationCount) * 100) : 0).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr>
                <td>订单成功（笔数/金额）</td>
                <td>{{ ((metrics.totalOrderSuccessCount || 0) + (metrics.alipayTotalOrderSuccessCount || 0)).toLocaleString() }} 笔</td>
                <td>{{ formatAmount((metrics.totalOrderSuccessAmount || 0) + (metrics.alipayTotalOrderSuccessAmount || 0)) }} 元</td>
              </tr>
              <tr>
                <td>订单成功占比</td>
                <td>{{ (metrics.minuteAnalysisTotalCount > 0 ? (((metrics.totalOrderSuccessCount || 0) + (metrics.alipayTotalOrderSuccessCount || 0)) / metrics.minuteAnalysisTotalCount * 100) : 0).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr class="highlight-row">
                <td>平均处理时间</td>
                <td>{{ formatTime(metrics.minuteAvgTime) }}</td>
                <td>--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
</template>
