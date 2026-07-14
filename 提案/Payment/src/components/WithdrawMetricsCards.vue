<script setup>
import { ref, computed } from 'vue';
import { formatTime, formatAmount, formatAmountInteger } from '../utils/csvParser';

// 格式化时间为 mm:ss 格式（先四捨五入到整數秒，與 formatTime 一致）
const formatTimeShort = (seconds) => {
  if (!seconds || seconds < 0) return '00:00';
  const roundedSeconds = Math.round(seconds);
  const mins = Math.floor(roundedSeconds / 60);
  const secs = roundedSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  },
  showFormula: {
    type: Boolean,
    default: false
  }
});

// 渠道切换
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay', 'wechat'

// 控制区域显示/隐藏
const showTimeSection = ref(true);
const showBankCardSection = ref(true);
const showAlipaySection = ref(true);
const showWechatSection = ref(true);

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
        <div class="section-header">
          <h3 class="section-title">重要信息</h3>
        </div>
        <div class="metrics-grid four-grid">
          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">💰</span>
              <span class="card-title">提现成功金额</span>
            </div>
            <div class="card-value" style="color: #30d158;">
              {{ formatAmountInteger(metrics.totalWithdrawAmount || 0) }}
              <span class="card-unit">元</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">📝</span>
              <span class="card-title">提现申请笔数</span>
            </div>
            <div class="card-value" style="color: #8e8e93;">
              {{ (metrics.withdrawSuccessTotalCount || 0).toLocaleString() }}
              <span class="card-unit">笔</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">✅</span>
              <span class="card-title">提现成功笔数</span>
            </div>
            <div class="card-value" style="color: #ff9500;">
              {{ (metrics.totalWithdrawCount || 0).toLocaleString() }}
              <span class="card-unit">笔</span>
              <span class="card-rate">（{{ (metrics.withdrawSuccessRate || 0).toFixed(2) }}%）</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">⏱️</span>
              <span class="card-title">平均处理时间</span>
            </div>
            <div class="card-value" style="color: #0a84ff;">
              {{ formatTime(metrics.avgProcessingTime) }}
            </div>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          <strong>提现成功金额：</strong>状态为「转账完成」的提现金额总和<br>
          <strong>提现申请笔数：</strong>总提现申请笔数（按訂單號去重）<br>
          <strong>提现成功笔数：</strong>提现成功笔数，成功率 = 提现成功笔数 / 总提现申请笔数 × 100%<br>
          <strong>平均处理时间：</strong>所有成功提现的处理时间平均值
        </div>
      </div>

      <!-- 提现成功时间区段 -->
      <div class="metrics-section">
        <div class="section-header" @click="showTimeSection = !showTimeSection">
          <h3 class="section-title">提现成功时间区段</h3>
          <span class="toggle-icon">{{ showTimeSection ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showTimeSection" class="minute-analysis-content">
          <table class="minute-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>笔数/百分比</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              <tr class="highlight-row">
                <td>提现申请笔数</td>
                <td>{{ (metrics.withdrawSuccessTotalCount || 0).toLocaleString() }}</td>
                <td>--</td>
              </tr>
              <tr>
                <td>2分钟内出款</td>
                <td>{{ (metrics.withdrawWithin2MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin2MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin2MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>2-5分钟出款</td>
                <td>{{ (metrics.withdrawWithin2to5MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin2to5MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin2to5MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>5-15分钟出款</td>
                <td>{{ (metrics.withdrawWithin5to15MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin5to15MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin5to15MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>15-30分钟出款</td>
                <td>{{ (metrics.withdrawWithin15to30MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin15to30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin15to30MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>超过30分钟出款</td>
                <td>{{ (metrics.withdrawOver30MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawOver30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawOver30MinAmount || 0) }} 元</td>
              </tr>
              <tr class="sub-row">
                <td class="indent">平均处理时间-卡(Q)</td>
                <td>{{ formatTimeShort(metrics.bankCardAvgTime) }}</td>
                <td>--</td>
              </tr>
              <tr class="sub-row">
                <td class="indent">平均处理时间-宝(R)</td>
                <td>{{ formatTimeShort(metrics.alipayAvgTime) }}</td>
                <td>--</td>
              </tr>
              <tr class="divider-row">
                <td colspan="3"></td>
              </tr>
              <tr>
                <td>提现成功笔数</td>
                <td>{{ (metrics.totalWithdrawCount || 0).toLocaleString() }} ({{ (metrics.withdrawSuccessRate || 0).toFixed(2) }}%)</td>
                <td>--</td>
              </tr>
              <tr>
                <td>提现失败笔数</td>
                <td>{{ (metrics.withdrawFailedCount || 0).toLocaleString() }}</td>
                <td>--</td>
              </tr>
              <tr class="highlight-row">
                <td>平均处理时间</td>
                <td>{{ formatTimeShort(metrics.avgProcessingTime) }}</td>
                <td>--</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="showFormula && showTimeSection" class="section-formula">
          <strong>时间区段：</strong>根据提现申请时间到转账完成时间的间隔进行分类统计<br>
          <strong>平均处理时间：</strong>转账完成且实际转出金额≠0 的处理时间平均（按订单号去重）
        </div>
      </div>
    </template>

    <!-- ========== 银行卡渠道 ========== -->
    <template v-else-if="activeChannel === 'bankCard'">
      <div class="metrics-section">
        <div class="section-header" @click="showBankCardSection = !showBankCardSection">
          <h3 class="section-title">重要信息</h3>
          <span class="toggle-icon">{{ showBankCardSection ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showBankCardSection" class="minute-analysis-content">
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
                <td>提现申请</td>
                <td>{{ (metrics.bankCardWithdrawCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.bankCardWithdrawAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>充值配对率</td>
                <td>{{ ((metrics.bankCardMatchRate || 0) * 100).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr>
                <td>配对后成功率</td>
                <td>{{ ((metrics.bankCardSuccessAfterMatchRate || 0) * 100).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr class="highlight-row">
                <td>平均处理时间</td>
                <td>{{ formatTime(metrics.bankCardAvgTime) }}</td>
                <td>--</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="showFormula && showBankCardSection" class="section-formula">
          <strong>提现申请：</strong>银行卡渠道的提现申请笔数和金额<br>
          <strong>充值配对率：</strong>充值成功配對的總筆數 / 充值申請的總筆數 × 100%<br>
          <strong>配对后成功率：</strong>充值成功總筆數 / 充值成功配對的總筆數 × 100%<br>
          <strong>平均处理时间：</strong>银行卡渠道成功提现的平均处理时间
        </div>
      </div>
    </template>

    <!-- ========== 支付宝渠道 ========== -->
    <template v-else-if="activeChannel === 'alipay'">
      <div class="metrics-section">
        <div class="section-header" @click="showAlipaySection = !showAlipaySection">
          <h3 class="section-title">重要信息</h3>
          <span class="toggle-icon">{{ showAlipaySection ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipaySection" class="minute-analysis-content">
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
                <td>提现申请</td>
                <td>{{ (metrics.alipayWithdrawCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.alipayWithdrawAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>充值配对率</td>
                <td>{{ ((metrics.alipayMatchRate || 0) * 100).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr>
                <td>配对后成功率</td>
                <td>{{ ((metrics.alipaySuccessAfterMatchRate || 0) * 100).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr class="highlight-row">
                <td>平均处理时间</td>
                <td>{{ formatTime(metrics.alipayAvgTime) }}</td>
                <td>--</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="showFormula && showAlipaySection" class="section-formula">
          <strong>提现申请：</strong>支付宝渠道的提现申请笔数和金额<br>
          <strong>充值配对率：</strong>充值成功配對的總筆數 / 充值申請的總筆數 × 100%<br>
          <strong>配对后成功率：</strong>充值成功總筆數 / 充值成功配對的總筆數 × 100%<br>
          <strong>平均处理时间：</strong>支付宝渠道成功提现的平均处理时间
        </div>
      </div>
    </template>

    <!-- ========== 微信渠道 ========== -->
    <template v-else-if="activeChannel === 'wechat'">
      <div class="metrics-section">
        <div class="section-header" @click="showWechatSection = !showWechatSection">
          <h3 class="section-title">重要信息</h3>
          <span class="toggle-icon">{{ showWechatSection ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechatSection" class="minute-analysis-content">
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
                <td>提现申请</td>
                <td>{{ (metrics.wechatWithdrawCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.wechatWithdrawAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>充值配对率</td>
                <td>{{ ((metrics.wechatMatchRate || 0) * 100).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr>
                <td>配对后成功率</td>
                <td>{{ ((metrics.wechatSuccessAfterMatchRate || 0) * 100).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr class="highlight-row">
                <td>平均处理时间</td>
                <td>{{ formatTime(metrics.wechatAvgTime) }}</td>
                <td>--</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="showFormula && showWechatSection" class="section-formula">
          <strong>提现申请：</strong>微信渠道的提现申请笔数和金额<br>
          <strong>充值配对率：</strong>充值成功配對的總筆數 / 充值申請的總筆數 × 100%<br>
          <strong>配对后成功率：</strong>充值成功總筆數 / 充值成功配對的總筆數 × 100%<br>
          <strong>平均处理时间：</strong>微信渠道成功提现的平均处理时间
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
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  user-select: none;
}

.section-header:hover {
  background: #fafafa;
}

.toggle-icon {
  font-size: 12px;
  color: #999;
  transition: transform 0.2s;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0;
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

.card-rate {
  font-size: 14px;
  font-weight: 500;
  color: #0a84ff;
  margin-left: 4px;
}

/* 提现内容 - 表格样式 */
.withdraw-table-content {
  padding: 16px;
}

.withdraw-detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.withdraw-detail-table th,
.withdraw-detail-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.withdraw-detail-table th {
  background: #5cb85c;
  color: #fff;
  font-weight: 600;
}

.withdraw-detail-table th:nth-child(2),
.withdraw-detail-table td:nth-child(2) {
  text-align: right;
  font-family: monospace;
  color: #4a4a9e;
  font-weight: 600;
}

.withdraw-detail-table tr:hover {
  background: #fafafa;
}

.withdraw-detail-table tr.sub-row {
  background: #fafafa;
}

.withdraw-detail-table tr.sub-row td.indent {
  padding-left: 32px;
  color: #666;
}

.withdraw-detail-table tr.highlight-row {
  background: #e8f5e9;
}

.withdraw-detail-table tr.highlight-row:hover {
  background: #dcedc8;
}

/* 说明区块 */
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

/* 提现成功时间区段 - 表格样式 */
.minute-analysis-content {
  padding: 16px;
}

.minute-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.minute-table th,
.minute-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.minute-table th {
  background: #5cb85c;
  color: #fff;
  font-weight: 600;
}

.minute-table th:nth-child(2),
.minute-table th:nth-child(3),
.minute-table td:nth-child(2),
.minute-table td:nth-child(3) {
  text-align: right;
}

.minute-table td {
  color: #333;
}

.minute-table td:nth-child(2) {
  color: #4a4a9e;
  font-family: monospace;
  font-weight: 600;
}

.minute-table td:nth-child(3) {
  color: #5cb85c;
  font-family: monospace;
}

.minute-table tr:hover {
  background: #fafafa;
}

.minute-table tr.highlight-row {
  background: #e8f5e9;
}

.minute-table tr.highlight-row:hover {
  background: #dcedc8;
}

.minute-table tr.divider-row td {
  padding: 4px;
  background: #f5f5f5;
  border-bottom: none;
}

.minute-table tr.sub-row {
  background: #fafafa;
}

.minute-table tr.sub-row td.indent {
  padding-left: 32px;
  color: #666;
}

@media (max-width: 1200px) {
  .four-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .five-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .five-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .four-grid {
    grid-template-columns: 1fr;
  }

  .five-grid {
    grid-template-columns: 1fr;
  }

  .status-label {
    width: 150px;
  }
}

/* 高亮行 - 平均处理时间等关键指标用不同颜色区分 */
.highlight-row {
  background-color: #f0f7ff !important;
}

.highlight-row td {
  color: #1a5fb4 !important;
  font-weight: 600;
}

/* 公式说明样式 */
.section-formula {
  font-size: 12px;
  color: #888;
  margin: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  line-height: 1.8;
}

.section-formula strong {
  color: #666;
}
</style>
