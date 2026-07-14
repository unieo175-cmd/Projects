<script setup>
import { formatTime, formatAmount, formatAmountInteger } from '../utils/csvParser';

defineProps({
  weeklyMetrics: Object,
  depositMetrics: Object,
  withdrawMetrics: Object,
  showFormula: Boolean,
  showMetricsAnalysisValues: Boolean,
  analysisMetrics: Array,
})
</script>

<template>
  <!-- ========== 区块七：指标数据分析 ========== -->
  <div class="report-section">
    <div class="section-header">
      <h3>指标数据分析</h3>
    </div>
    <div class="analysis-table-container">
      <table class="analysis-table">
        <thead>
          <tr>
            <th rowspan="2" class="category-header">分类</th>
            <th :colspan="showMetricsAnalysisValues ? 4 : 3" class="group-header deposit-header">充值数据</th>
            <th :colspan="showMetricsAnalysisValues ? 4 : 3" class="group-header withdraw-header">提现数据</th>
          </tr>
          <tr>
            <th class="sub-header deposit-sub">成功率</th>
            <th v-if="showMetricsAnalysisValues" class="sub-header deposit-sub">计算值</th>
            <th class="sub-header deposit-sub">3分内占比</th>
            <th class="sub-header deposit-sub">平均处理时间</th>
            <th class="sub-header withdraw-sub">成功率</th>
            <th v-if="showMetricsAnalysisValues" class="sub-header withdraw-sub">计算值</th>
            <th class="sub-header withdraw-sub">2分内占比</th>
            <th class="sub-header withdraw-sub">平均处理时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in analysisMetrics" :key="row.category">
            <td class="category-cell">{{ row.category }}</td>
            <td class="rate-cell">{{ row.successRate.toFixed(2) }}%</td>
            <td v-if="showMetricsAnalysisValues" class="debug-cell">{{ row.debugDeposit }}</td>
            <td class="rate-cell">{{ row.within3MinRate.toFixed(2) }}%</td>
            <td class="time-cell">{{ formatTime(row.avgTime) }}</td>
            <td class="withdraw-rate-cell">{{ row.withdrawSuccessRate === null ? '--' : row.withdrawSuccessRate.toFixed(2) + '%' }}</td>
            <td v-if="showMetricsAnalysisValues" class="debug-cell">{{ row.debugWithdraw }}</td>
            <td class="withdraw-rate-cell">{{ row.withdrawWithin3MinRate === null ? '--' : row.withdrawWithin3MinRate.toFixed(2) + '%' }}</td>
            <td class="withdraw-time-cell">{{ row.withdrawAvgTime === null ? '--' : formatTime(row.withdrawAvgTime) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="showFormula" class="section-formula">
      <strong>充值計算公式說明：</strong><br>
      - 整體數據範圍：商戶只排除 test/qa（不排除線下、外部商戶等）<br>
      - 支付寶數據範圍：商戶含「支付寶/支付宝」且排除 test/qa/線下<br>
      - 微信數據範圍：商戶含「微信」且排除 test/qa/線下<br>
      - 金寶數據範圍：銀行卡代號 GB 開頭（非 GB-Dahaomen），排除線下商戶<br>
      - 極速數據範圍：銀行卡代號 AUCTION 開頭，排除線下商戶<br>
      - 第三方數據範圍：銀行卡代號非 AUCTION/GB 開頭（含 GB-Dahaomen），排除線下商戶<br>
      - 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%<br>
      - 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%<br>
      - 平均處理時間 = 到帳金額 > 0 的處理時間平均<br>
      <br>
      <strong>提現計算公式說明：</strong><br>
      - 整體數據範圍：商戶分類（銀行卡+支付寶+微信+線下），按訂單號去重<br>
      - 支付寶數據範圍：商戶含「支付寶/支付宝」，按訂單號去重<br>
      - 微信數據範圍：商戶含「微信」，按訂單號去重<br>
      - 金寶數據範圍：出款卡代號 GB 開頭（非 GB-Dahaomen），按訂單號去重<br>
      - 極速數據範圍：出款卡代號含 AUCTION，按訂單號去重<br>
      - 第三方數據範圍：出款卡代號有值且不含 AUCTION，按訂單號去重<br>
      - 提現成功條件：說明=轉帳完成/转账完成 且 實際轉出金額≠0<br>
      - 成功率 = 提現成功筆數 / 總申請筆數 × 100%<br>
      - 2分内占比 = 處理時間 < 120秒的筆數 / 提現成功筆數 × 100%<br>
      - 平均處理時間 = 提現成功的處理時間平均
    </div>
  </div>
</template>

<style scoped>
.analysis-table-container {
  overflow-x: auto;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.analysis-table thead {
  background: #5cb85c;
}

.analysis-table th {
  padding: 12px 16px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.analysis-table th:first-child {
  border-top-left-radius: 8px;
}

.analysis-table th:last-child {
  border-top-right-radius: 8px;
}

.analysis-table tbody tr {
  transition: background 0.2s;
}

.analysis-table tbody tr:hover {
  background: #fafafa;
}

.analysis-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.analysis-table td {
  padding: 12px 16px;
  font-size: 13px;
  color: #333;
  border: 1px solid #e0e0e0;
  text-align: center;
}

.analysis-table .category-cell {
  color: #333;
  font-weight: 600;
  text-align: left;
  background: #f8f9fa;
}

.analysis-table .rate-cell {
  color: #5cb85c;
  font-family: monospace;
}

.analysis-table .debug-cell {
  color: #999;
  font-size: 11px;
  font-family: monospace;
  background: #f9f9f9;
}

.analysis-table .time-cell {
  color: #4a4a9e;
  font-family: monospace;
}

.analysis-table .group-header {
  text-align: center;
  font-size: 14px;
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.analysis-table .deposit-header {
  background: #5cb85c;
  border-left: 2px solid #5cb85c;
}

.analysis-table .withdraw-header {
  background: #4a4a9e;
  border-right: 2px solid #4a4a9e;
}

.analysis-table .withdraw-rate-cell {
  color: #4a4a9e;
  font-family: monospace;
}

.analysis-table .withdraw-time-cell {
  color: #7c4dff;
  font-family: monospace;
}

.analysis-table .category-header {
  background: #9e9e9e;
  vertical-align: middle;
  text-align: center;
}

.analysis-table .sub-header {
  font-size: 12px;
  font-weight: 600;
  background: #f5f5f5;
  color: #333;
}

.analysis-table .sub-header.deposit-sub {
  background: #e8f5e9;
  color: #2e7d32;
}

.analysis-table .sub-header.withdraw-sub {
  background: #e8eaf6;
  color: #3949ab;
}

@media (max-width: 768px) {
  .analysis-table th,
  .analysis-table td {
    padding: 10px 12px;
    font-size: 12px;
  }
}
</style>
