<template>
  <div class="pm-metrics">
    <!-- Loading 遮罩 -->
    <div class="loading-overlay" v-if="isLoading">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ loadingText }}</div>
      </div>
    </div>

    <!-- 數據上傳區塊 -->
    <div class="upload-section">
      <div class="upload-header">
        <h3>數據上傳（PM專用）</h3>
        <span class="upload-note">此頁面使用獨立數據，不與其他頁面共用</span>
      </div>
      <div class="upload-buttons">
        <div class="upload-item">
          <label class="upload-btn deposit-btn">
            <input type="file" accept=".csv" @change="handleDepositUpload" hidden />
            <span class="btn-icon">📥</span>
            <span class="btn-text">上傳充值數據</span>
          </label>
          <span class="upload-status" v-if="depositRecords.length > 0">
            ✓ 已載入 {{ depositRecords.length.toLocaleString() }} 筆
          </span>
          <span class="upload-filename" v-if="depositFileName">📄 {{ depositFileName }}</span>
        </div>
        <div class="upload-item">
          <label class="upload-btn withdraw-btn">
            <input type="file" accept=".csv" @change="handleWithdrawUpload" hidden />
            <span class="btn-icon">📤</span>
            <span class="btn-text">上傳提現數據（上週）</span>
          </label>
          <span class="upload-status" v-if="withdrawRecords.length > 0">
            ✓ 已載入 {{ withdrawRecords.length.toLocaleString() }} 筆
          </span>
          <span class="upload-filename" v-if="withdrawFileName">📄 {{ withdrawFileName }}</span>
        </div>
        <div class="upload-item">
          <label class="upload-btn prev-withdraw-btn">
            <input type="file" accept=".csv" @change="handlePrevWithdrawUpload" hidden />
            <span class="btn-icon">📤</span>
            <span class="btn-text">上傳提現數據（上上週）</span>
          </label>
          <span class="upload-status" v-if="prevWithdrawRecords.length > 0">
            ✓ 已載入 {{ prevWithdrawRecords.length.toLocaleString() }} 筆
          </span>
          <span class="upload-filename" v-if="prevWithdrawFileName">📄 {{ prevWithdrawFileName }}</span>
        </div>
        <button class="clear-btn" @click="clearData" v-if="depositRecords.length > 0 || withdrawRecords.length > 0 || prevWithdrawRecords.length > 0">
          <span>🗑️ 清除數據</span>
        </button>
      </div>
    </div>

    <!-- 指標數據表格 -->
    <div class="report-section" v-if="pmAnalysisMetrics && pmAnalysisMetrics.length > 0">
      <div class="section-header">
        <h3>指標數據分析（PM專用）</h3>
        <span class="section-note">此計算邏輯獨立於日週報，可依需求調整</span>
      </div>
      <div class="analysis-table-container">
        <table class="analysis-table">
          <thead>
            <tr>
              <th rowspan="2" class="category-header">分類</th>
              <th colspan="3" class="group-header deposit-header">充值數據</th>
              <th colspan="3" class="group-header withdraw-header">提現數據</th>
            </tr>
            <tr>
              <th class="sub-header deposit-sub">成功率</th>
              <th class="sub-header deposit-sub">3分內佔比</th>
              <th class="sub-header deposit-sub">平均處理時間</th>
              <th class="sub-header withdraw-sub">成功率</th>
              <th class="sub-header withdraw-sub">2分內佔比</th>
              <th class="sub-header withdraw-sub">平均處理時間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pmAnalysisMetrics" :key="row.category">
              <td class="category-cell">{{ row.category }}</td>
              <td class="rate-cell">{{ row.successRate.toFixed(2) }}%</td>
              <td class="rate-cell">{{ row.within3MinRate.toFixed(2) }}%</td>
              <td class="time-cell">{{ formatTimeHMS(row.avgTime) }}</td>
              <td class="withdraw-rate-cell">{{ row.withdrawSuccessRate === null ? '--' : row.withdrawSuccessRate.toFixed(2) + '%' }}</td>
              <td class="withdraw-rate-cell">{{ row.withdrawWithin3MinRate === null ? '--' : row.withdrawWithin3MinRate.toFixed(2) + '%' }}</td>
              <td class="withdraw-time-cell">{{ row.withdrawAvgTime === null ? '--' : formatTimeHMS(row.withdrawAvgTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="formula-section">
        <div class="formula-title">計算公式說明</div>
        <div class="formula-note">※ 以上數據皆已剔除線下 / test / qa 的商戶</div>
        <div class="formula-content">
          <div class="formula-group">
            <div class="formula-group-title">充值數據</div>
            <div class="formula-item"><span class="formula-label">成功率：</span>自動到帳筆數 ÷ 總充值筆數 × 100%</div>
            <div class="formula-item"><span class="formula-label">3分內佔比：</span>自動到帳中處理時間 ≤ 180秒的筆數 ÷ 自動到帳筆數 × 100%</div>
            <div class="formula-item"><span class="formula-label">平均處理時間：</span>自動到帳筆數的平均處理時間（通知時間 - 建立時間）</div>
          </div>
          <div class="formula-group">
            <div class="formula-group-title">提現數據</div>
            <div class="formula-item"><span class="formula-label">成功率：</span>提現成功筆數 ÷ 總提現筆數 × 100%</div>
            <div class="formula-item"><span class="formula-label">2分內佔比：</span>提現成功中處理時間 ≤ 120秒的筆數 ÷ 提現成功筆數 × 100%</div>
            <div class="formula-item"><span class="formula-label">平均處理時間：</span>提現成功筆數的平均時間，公式 IF(V="", Q-T, Q-V)</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 筆數計算表格 -->
    <div class="report-section" v-if="pmCountMetrics && pmCountMetrics.length > 0">
      <div class="section-header">
        <h3>筆數計算（PM專用）</h3>
      </div>
      <div class="analysis-table-container">
        <table class="analysis-table">
          <thead>
            <tr>
              <th rowspan="2" class="category-header">分類</th>
              <th colspan="6" class="group-header deposit-header">充值</th>
              <th colspan="3" class="group-header withdraw-header">提現</th>
            </tr>
            <tr>
              <th class="sub-header deposit-sub">總充值筆數<br/>(自動到帳+補單)</th>
              <th class="sub-header deposit-sub">補單筆數</th>
              <th class="sub-header deposit-sub">無效申請筆數</th>
              <th class="sub-header deposit-sub">自動到帳筆數</th>
              <th class="sub-header deposit-sub">自動到帳時長</th>
              <th class="sub-header deposit-sub">平均充值時長</th>
              <th class="sub-header withdraw-sub">總提現筆數</th>
              <th class="sub-header withdraw-sub">提現成功筆數</th>
              <th class="sub-header withdraw-sub">平均提現時長</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pmCountMetrics" :key="row.category">
              <td class="category-cell">{{ row.category }}</td>
              <td class="count-cell">{{ row.totalDepositCount.toLocaleString() }}</td>
              <td class="count-cell">{{ row.manualCount.toLocaleString() }}</td>
              <td class="count-cell">{{ row.invalidCount.toLocaleString() }}</td>
              <td class="count-cell">{{ row.autoDepositCount.toLocaleString() }}</td>
              <td class="time-cell">{{ formatTimeHMS(row.autoDepositTime) }}</td>
              <td class="time-cell">{{ formatTimeHMS(row.avgDepositTime) }}</td>
              <td class="withdraw-count-cell">{{ row.totalWithdrawCount === null ? '/' : row.totalWithdrawCount.toLocaleString() }}</td>
              <td class="withdraw-count-cell">{{ row.autoWithdrawCount === null ? '/' : row.autoWithdrawCount.toLocaleString() }}</td>
              <td class="withdraw-time-cell">{{ row.avgWithdrawTime === null ? '/' : formatTimeHMS(row.avgWithdrawTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="formula-section">
        <div class="formula-title">計算公式說明</div>
        <div class="formula-note">※ 以上數據皆已剔除線下 / test / qa 的商戶</div>
        <div class="formula-content">
          <div class="formula-group">
            <div class="formula-group-title">充值</div>
            <div class="formula-item"><span class="formula-label">自動到帳：</span>到帳金額 > 0 且狀態不包含「補單」</div>
            <div class="formula-item"><span class="formula-label">補單：</span>到帳金額 > 0 且狀態包含「補單」或「商戶確認到帳」</div>
            <div class="formula-item"><span class="formula-label">總充值筆數：</span>自動到帳 + 補單</div>
            <div class="formula-item"><span class="formula-label">無效申請：</span>到帳金額 = 0 且狀態包含「未充值」</div>
            <div class="formula-item"><span class="formula-label">自動到帳時長：</span>自動到帳筆數的平均處理時間（通知時間 - 建立時間）</div>
            <div class="formula-item"><span class="formula-label">平均充值時長：</span>（自動到帳 + 補單）的平均處理時間</div>
          </div>
          <div class="formula-group">
            <div class="formula-group-title">提現</div>
            <div class="formula-item"><span class="formula-label">提現成功：</span>轉帳成功 且 實際轉出金額 ≠ 0</div>
            <div class="formula-item"><span class="formula-label">平均提現時長：</span>提現成功筆數的平均時間，公式 IF(V="", Q-T, Q-V)</div>
            <div class="formula-item formula-sub">Q = 通知商戶時間, T = 建立時間, V = 剩餘池建立時間</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 充值分析區塊（商戶分類 + 補單類型整合） -->
    <div class="report-section" v-if="combinedDepositAnalysis && combinedDepositAnalysis.length > 0">
      <div class="section-header">
        <h3>充值分析</h3>
        <span class="section-note">範圍：到帳金額 ≠ 0，排除線下/test/qa</span>
      </div>
      <div class="analysis-table-container">
        <table class="analysis-table">
          <thead>
            <tr>
              <th class="category-header">分類</th>
              <th class="sub-header deposit-sub">筆數</th>
              <th class="sub-header deposit-sub">佔比</th>
              <th class="sub-header deposit-sub">總金額</th>
              <th class="sub-header deposit-sub">金額佔比</th>
              <th class="sub-header deposit-sub">平均時間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in combinedDepositAnalysis" :key="row.category" :class="{ 'total-row': row.isTotal, 'group-header-row': row.isGroupHeader }">
              <td class="category-cell" :class="{ 'indent-cell': row.isSubItem }">{{ row.category }}</td>
              <td class="count-cell">{{ row.count.toLocaleString() }}</td>
              <td class="rate-cell">{{ row.countPercent.toFixed(2) }}%</td>
              <td class="amount-cell">{{ row.totalAmount.toLocaleString() }}</td>
              <td class="rate-cell">{{ row.amountPercent.toFixed(2) }}%</td>
              <td class="time-cell">{{ formatTimeHMS(row.avgTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 充值平均時長分析區塊 -->
    <div class="report-section" v-if="depositTimeAnalysis">
      <div class="section-header">
        <h3>充值平均時長分析</h3>
        <span class="section-note">範圍：自動到帳，排除線下/test/qa</span>
      </div>

      <!-- 摘要卡片 -->
      <div class="alipay-summary">
        <div class="summary-card">
          <div class="summary-label">自動到帳筆數</div>
          <div class="summary-value">{{ depositTimeAnalysis.totalCount.toLocaleString() }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">整體平均時間</div>
          <div class="summary-value">{{ depositTimeAnalysis.overallAvgSeconds !== null ? formatTimeHMS(depositTimeAnalysis.overallAvgSeconds) : '--' }}</div>
        </div>
      </div>

      <!-- 原因分析 -->
      <div class="insights-section">
        <div class="insights-title">原因分析</div>
        <ul class="insights-list">
          <li v-for="(item, i) in depositTimeAnalysis.insights" :key="i"
              :class="['insight-item', `insight-${item.type}`]">
            <span class="insight-icon">{{ item.type === 'warn' ? '⚠' : item.type === 'good' ? '✓' : 'ℹ' }}</span>
            {{ item.text }}
          </li>
        </ul>
      </div>

      <!-- 每日平均處理時間 -->
      <div class="sub-section">
        <div class="sub-section-title">每日平均處理時間</div>
        <div class="analysis-table-container">
          <table class="analysis-table">
            <thead>
              <tr>
                <th class="alipay-th">日期</th>
                <th class="alipay-th">自動到帳筆數</th>
                <th class="alipay-th">平均時間</th>
                <th class="alipay-th warn-th">&gt;3分鐘筆數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in depositTimeAnalysis.dailyData" :key="row.date">
                <td class="alipay-date-cell">{{ row.date }}</td>
                <td class="alipay-count-cell">{{ row.totalCount.toLocaleString() }}</td>
                <td class="alipay-time-cell" :class="{ 'warn-cell': row.avgSeconds !== null && row.avgSeconds > 180 }">
                  {{ row.avgSeconds !== null ? formatTimeHMS(row.avgSeconds) : '--' }}
                </td>
                <td class="alipay-warn-cell" :class="{ 'warn-highlight': row.over3MinCount > 0 }">
                  {{ row.over3MinCount.toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 渠道 × 時間區段 cross-tab -->
      <div class="sub-section" v-if="depositTimeAnalysis.channelBreakdown.length > 0">
        <div class="sub-section-title">渠道拆解 × 時間區段分佈（分母 = 自動到帳筆數）</div>
        <div class="analysis-table-container">
          <table class="analysis-table">
            <thead>
              <tr>
                <th class="alipay-th" rowspan="2">渠道</th>
                <th class="alipay-th" rowspan="2">自動到帳筆數</th>
                <th class="alipay-th" rowspan="2">平均時間</th>
                <th class="alipay-th" colspan="5" style="background:#1e4a6e;">時間區段佔比</th>
              </tr>
              <tr>
                <th class="alipay-th">{{ depositTimeAnalysis.channelBreakdown[0].distribution[0].label }}</th>
                <th class="alipay-th">{{ depositTimeAnalysis.channelBreakdown[0].distribution[1].label }}</th>
                <th class="alipay-th">{{ depositTimeAnalysis.channelBreakdown[0].distribution[2].label }}</th>
                <th class="alipay-th">{{ depositTimeAnalysis.channelBreakdown[0].distribution[3].label }}</th>
                <th class="alipay-th warn-th">{{ depositTimeAnalysis.channelBreakdown[0].distribution[4].label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in depositTimeAnalysis.channelBreakdown" :key="row.channel"
                  :class="{ 'total-row': row.channel === '整體' }">
                <td class="alipay-channel-cell">{{ row.channel }}</td>
                <td class="alipay-count-cell">{{ row.totalCount.toLocaleString() }}</td>
                <td class="alipay-time-cell" :class="{ 'warn-cell': row.avgSeconds !== null && row.avgSeconds > 180 }">
                  {{ row.avgSeconds !== null ? formatTimeHMS(row.avgSeconds) : '--' }}
                </td>
                <td v-for="b in row.distribution" :key="b.label"
                    class="alipay-pct-cell"
                    :class="{ 'warn-cell': b.label === '> 10分' && b.percent > 10 }">
                  {{ b.percent.toFixed(1) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 提現時間分析區塊 -->
    <div class="report-section" v-if="withdrawTimeAnalysis">
      <div class="section-header">
        <h3>提現時間分析</h3>
        <span class="section-note">範圍：整體，排除線下/test/qa，去重</span>
      </div>

      <!-- 摘要卡片 -->
      <div class="alipay-summary">
        <div class="summary-card">
          <div class="summary-label">申請筆數</div>
          <div class="summary-value">{{ withdrawTimeAnalysis.totalApply.toLocaleString() }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">成功筆數</div>
          <div class="summary-value">{{ withdrawTimeAnalysis.totalSuccess.toLocaleString() }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">整體平均時間</div>
          <div class="summary-value">{{ withdrawTimeAnalysis.overallAvgSeconds !== null ? formatTimeHMS(withdrawTimeAnalysis.overallAvgSeconds) : '--' }}</div>
        </div>
      </div>

      <!-- 拉長原因分析 -->
      <div class="insights-section">
        <div class="insights-title">原因分析</div>
        <ul class="insights-list">
          <li v-for="(item, i) in withdrawTimeAnalysis.insights" :key="i"
              :class="['insight-item', `insight-${item.type}`]">
            <span class="insight-icon">{{ item.type === 'warn' ? '⚠' : item.type === 'good' ? '✓' : 'ℹ' }}</span>
            {{ item.text }}
          </li>
        </ul>
      </div>

      <!-- 每日平均處理時間 -->
      <div class="sub-section">
        <div class="sub-section-title">每日平均處理時間</div>
        <div class="analysis-table-container">
          <table class="analysis-table">
            <thead>
              <tr>
                <th class="alipay-th">日期</th>
                <th class="alipay-th">申請筆數</th>
                <th class="alipay-th">成功筆數</th>
                <th class="alipay-th">平均時間</th>
                <th class="alipay-th warn-th">&gt;30分鐘筆數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in withdrawTimeAnalysis.dailyData" :key="row.date">
                <td class="alipay-date-cell">{{ row.date }}</td>
                <td class="alipay-count-cell">{{ row.totalApply.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ row.successCount.toLocaleString() }}</td>
                <td class="alipay-time-cell" :class="{ 'warn-cell': row.avgSeconds !== null && row.avgSeconds > 1800 }">
                  {{ row.avgSeconds !== null ? formatTimeHMS(row.avgSeconds) : '--' }}
                </td>
                <td class="alipay-warn-cell" :class="{ 'warn-highlight': row.over30Count > 0 }">
                  {{ row.over30Count.toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 渠道 × 時間區段 cross-tab -->
      <div class="sub-section">
        <div class="sub-section-title">渠道拆解 × 時間區段分佈（分母 = 申請筆數）</div>
        <div class="analysis-table-container">
          <table class="analysis-table">
            <thead>
              <tr>
                <th class="alipay-th" rowspan="2">渠道</th>
                <th class="alipay-th" rowspan="2">申請筆數</th>
                <th class="alipay-th" rowspan="2">成功筆數</th>
                <th class="alipay-th" rowspan="2">平均時間</th>
                <th class="alipay-th" colspan="5" style="background:#1e4a6e;">時間區段佔比</th>
              </tr>
              <tr>
                <th class="alipay-th">{{ withdrawTimeAnalysis.channelBreakdown[0].distribution[0].label }}</th>
                <th class="alipay-th">{{ withdrawTimeAnalysis.channelBreakdown[0].distribution[1].label }}</th>
                <th class="alipay-th">{{ withdrawTimeAnalysis.channelBreakdown[0].distribution[2].label }}</th>
                <th class="alipay-th">{{ withdrawTimeAnalysis.channelBreakdown[0].distribution[3].label }}</th>
                <th class="alipay-th warn-th">{{ withdrawTimeAnalysis.channelBreakdown[0].distribution[4].label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in withdrawTimeAnalysis.channelBreakdown" :key="row.channel"
                  :class="{ 'channel-total-row': row.channel === '整體' }">
                <td class="alipay-date-cell">{{ row.channel }}</td>
                <td class="alipay-count-cell">{{ row.totalApply.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ row.successCount.toLocaleString() }}</td>
                <td class="alipay-time-cell" :class="{ 'warn-cell': row.avgSeconds !== null && row.avgSeconds > 1800 }">
                  {{ row.avgSeconds !== null ? formatTimeHMS(row.avgSeconds) : '--' }}
                </td>
                <td v-for="d in row.distribution" :key="d.label"
                    class="rate-cell"
                    :class="{ 'warn-rate': d.label === '> 30分' && d.percent > 0 }">
                  {{ d.percent.toFixed(1) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 提現週度對比分析 -->
    <div class="report-section" v-if="withdrawComparison">
      <div class="section-header">
        <h3>提現分析（週度對比）</h3>
        <span class="section-note">上上週 vs 上週，已去重（以流水號為準）</span>
      </div>

      <!-- 整體比較 -->
      <div class="sub-section">
        <div class="sub-section-title">整體比較</div>
        <div class="analysis-table-container">
          <table class="analysis-table">
            <thead>
              <tr>
                <th class="alipay-th">指標</th>
                <th class="alipay-th">上上週</th>
                <th class="alipay-th">上週</th>
                <th class="alipay-th">變化</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="category-cell">申請筆數</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.total.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.total.toLocaleString() }}</td>
                <td class="alipay-count-cell" :class="withdrawComparison.diff.total.val >= 0 ? 'diff-up' : 'diff-down'">
                  {{ withdrawComparison.diff.total.val >= 0 ? '+' : '' }}{{ withdrawComparison.diff.total.val.toLocaleString() }}
                  （{{ withdrawComparison.diff.total.val >= 0 ? '+' : '' }}{{ withdrawComparison.diff.total.pct.toFixed(1) }}%）
                </td>
              </tr>
              <tr>
                <td class="category-cell">成功筆數</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.succ.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.succ.toLocaleString() }}</td>
                <td class="alipay-count-cell" :class="withdrawComparison.diff.succ.val >= 0 ? 'diff-up' : 'diff-down'">
                  {{ withdrawComparison.diff.succ.val >= 0 ? '+' : '' }}{{ withdrawComparison.diff.succ.val.toLocaleString() }}
                </td>
              </tr>
              <tr class="total-row">
                <td class="category-cell">成功率</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.succRate.toFixed(2) }}%</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.succRate.toFixed(2) }}%</td>
                <td class="alipay-count-cell" :class="withdrawComparison.diff.succRate.val >= 0 ? 'diff-up' : 'diff-down'">
                  {{ withdrawComparison.diff.succRate.val >= 0 ? '+' : '' }}{{ withdrawComparison.diff.succRate.val.toFixed(2) }}%
                </td>
              </tr>
              <tr>
                <td class="category-cell">請求金額</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.reqAmt.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.reqAmt.toLocaleString() }}</td>
                <td class="alipay-count-cell" :class="withdrawComparison.diff.reqAmt.val >= 0 ? 'diff-up' : 'diff-down'">
                  {{ withdrawComparison.diff.reqAmt.val >= 0 ? '+' : '' }}{{ Math.round(withdrawComparison.diff.reqAmt.val).toLocaleString() }}
                </td>
              </tr>
              <tr>
                <td class="category-cell">成功到帳金額</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.succAmt.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.succAmt.toLocaleString() }}</td>
                <td class="alipay-count-cell" :class="withdrawComparison.diff.succAmt.val >= 0 ? 'diff-up' : 'diff-down'">
                  {{ withdrawComparison.diff.succAmt.val >= 0 ? '+' : '' }}{{ Math.round(withdrawComparison.diff.succAmt.val).toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 渠道明細 -->
      <div class="sub-section">
        <div class="sub-section-title">渠道明細</div>
        <div class="analysis-table-container">
          <table class="analysis-table">
            <thead>
              <tr>
                <th class="alipay-th" rowspan="2">渠道</th>
                <th class="alipay-th" colspan="3">上上週</th>
                <th class="alipay-th" colspan="3">上週</th>
                <th class="alipay-th" rowspan="2">成功率變化</th>
              </tr>
              <tr>
                <th class="alipay-th">申請</th>
                <th class="alipay-th">成功</th>
                <th class="alipay-th">成功率</th>
                <th class="alipay-th">申請</th>
                <th class="alipay-th">成功</th>
                <th class="alipay-th">成功率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ch in [['支付宝','支付寶'],['银行卡','銀行卡'],['微信','微信']]" :key="ch[0]">
                <td class="alipay-channel-cell">{{ ch[1] }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.chStats[ch[0]].apply.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.chStats[ch[0]].succ.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.prev.chStats[ch[0]].apply > 0 ? withdrawComparison.prev.chStats[ch[0]].succRate.toFixed(2) + '%' : '--' }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.chStats[ch[0]].apply.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.chStats[ch[0]].succ.toLocaleString() }}</td>
                <td class="alipay-count-cell">{{ withdrawComparison.curr.chStats[ch[0]].apply > 0 ? withdrawComparison.curr.chStats[ch[0]].succRate.toFixed(2) + '%' : '--' }}</td>
                <td class="alipay-count-cell"
                    :class="withdrawComparison.prev.chStats[ch[0]].apply > 0 && withdrawComparison.curr.chStats[ch[0]].apply > 0
                      ? (withdrawComparison.curr.chStats[ch[0]].succRate - withdrawComparison.prev.chStats[ch[0]].succRate >= 0 ? 'diff-up' : 'diff-down')
                      : ''">
                  <template v-if="withdrawComparison.prev.chStats[ch[0]].apply > 0 && withdrawComparison.curr.chStats[ch[0]].apply > 0">
                    {{ (withdrawComparison.curr.chStats[ch[0]].succRate - withdrawComparison.prev.chStats[ch[0]].succRate) >= 0 ? '+' : '' }}{{ (withdrawComparison.curr.chStats[ch[0]].succRate - withdrawComparison.prev.chStats[ch[0]].succRate).toFixed(2) }}%
                  </template>
                  <template v-else>--</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 日期成功筆數列表 -->
      <div class="sub-section">
        <div class="sub-section-title">日期成功筆數列表</div>
        <div class="comparison-daily-wrapper">
          <!-- 上上週 -->
          <div class="comparison-daily-col">
            <div class="comparison-week-label">上上週</div>
            <div class="analysis-table-container">
              <table class="analysis-table">
                <thead>
                  <tr>
                    <th class="alipay-th">日期</th>
                    <th class="alipay-th">申請</th>
                    <th class="alipay-th">成功</th>
                    <th class="alipay-th">成功率</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in withdrawComparison.prev.daily" :key="row.date"
                      :class="{ 'warn-row': row.succRate < withdrawComparison.prev.succRate - 5 }">
                    <td class="alipay-date-cell">{{ row.date }}</td>
                    <td class="alipay-count-cell">{{ row.apply.toLocaleString() }}</td>
                    <td class="alipay-count-cell">{{ row.succ.toLocaleString() }}</td>
                    <td class="alipay-count-cell" :class="{ 'warn-cell': row.succRate < withdrawComparison.prev.succRate - 5 }">{{ row.succRate.toFixed(2) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <!-- 上週 -->
          <div class="comparison-daily-col">
            <div class="comparison-week-label">上週</div>
            <div class="analysis-table-container">
              <table class="analysis-table">
                <thead>
                  <tr>
                    <th class="alipay-th">日期</th>
                    <th class="alipay-th">申請</th>
                    <th class="alipay-th">成功</th>
                    <th class="alipay-th">成功率</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in withdrawComparison.curr.daily" :key="row.date"
                      :class="{ 'warn-row': row.succRate < withdrawComparison.curr.succRate - 5 }">
                    <td class="alipay-date-cell">{{ row.date }}</td>
                    <td class="alipay-count-cell">{{ row.apply.toLocaleString() }}</td>
                    <td class="alipay-count-cell">{{ row.succ.toLocaleString() }}</td>
                    <td class="alipay-count-cell" :class="{ 'warn-cell': row.succRate < withdrawComparison.curr.succRate - 5 }">{{ row.succRate.toFixed(2) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- 小結 + 觀察（提現分析週度對比） -->
    <div class="report-section insights-standalone" v-if="withdrawComparison">
      <div class="insights-title">小結 + 觀察</div>
      <ul class="insights-list">
        <li v-for="(item, i) in withdrawComparison.insights" :key="i"
            :class="['insight-item', `insight-${item.type}`]">
          <span class="insight-icon">{{ item.type === 'warn' ? '⚠' : item.type === 'good' ? '✓' : 'ℹ' }}</span>
          {{ item.text }}
        </li>
      </ul>
    </div>

    <!-- 無數據提示 -->
    <div class="empty-state" v-if="!pmCountMetrics && !pmAnalysisMetrics && depositRecords.length === 0">
      <div class="empty-icon">📊</div>
      <h3>請先導入數據</h3>
      <p>請從左側導入充值或提現數據後再查看指標</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { parseCSV, parseWithdrawCSV } from '../utils/csvParser'
import { usePmMetrics } from '../composables/usePmMetrics'

/**
 * =====================================================
 * PM專用計算準則 (供後續邏輯比對用)
 * =====================================================
 *
 * 【一、數據範圍定義】
 * ┌─────────────┬────────────────────────────────────────────────────────────┐
 * │ 分類        │ 篩選條件                                                    │
 * ├─────────────┼────────────────────────────────────────────────────────────┤
 * │ 整體        │ 商戶排除包含「線下」、「test」、「qa」的商戶名稱              │
 * │ 支付寶      │ 商戶包含「支付宝」或「支付寶」                               │
 * │ 微信        │ 商戶包含「微信」                                            │
 * │ 金寶        │ 商戶排除線下/test/qa，銀行卡代號 GB 開頭（排除 GB-DAHAOMEN） │
 * │ 極速        │ 商戶排除線下/test/qa，銀行卡代號 AUCTION 開頭               │
 * │ 三方        │ 商戶排除線下/test/qa，銀行卡代號非 GB/AUCTION 開頭，或 GB-DAHAOMEN │
 * │ 非正向信評  │ 商戶排除線下/test/qa，狀態以「信用」或「信評」開頭           │
 * └─────────────┴────────────────────────────────────────────────────────────┘
 *
 * 【二、充值筆數計算】
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ 指標            │ 計算公式                                                │
 * ├─────────────────┼────────────────────────────────────────────────────────┤
 * │ 自動到帳        │ 到帳金額 > 0 且狀態不包含「補單」                        │
 * │ 補單            │ 到帳金額 > 0 且狀態包含「補單」或「商戶確認到帳」         │
 * │ 總充值筆數      │ 自動到帳 + 補單                                         │
 * │ 無效申請        │ 到帳金額 = 0 且狀態包含「未充值」                        │
 * │ 自動到帳時長    │ 自動到帳筆數的平均處理時間（通知時間 - 建立時間）         │
 * │ 平均充值時長    │（自動到帳 + 補單）的平均處理時間                         │
 * └─────────────────┴────────────────────────────────────────────────────────┘
 *
 * 【三、提現筆數計算】
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ 指標            │ 計算公式                                                │
 * ├─────────────────┼────────────────────────────────────────────────────────┤
 * │ 提現成功        │ 轉帳成功 且 實際轉出金額 ≠ 0                            │
 * │ 平均提現時長    │ 提現成功筆數的平均時間                                   │
 * │                 │ 公式：IF(V="", Q-T, Q-V)                                │
 * │                 │ Q = 通知商戶時間, T = 建立時間, V = 剩餘池建立時間       │
 * └─────────────────┴────────────────────────────────────────────────────────┘
 *
 * 【四、充值指標數據分析】
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ 指標            │ 計算公式                                                │
 * ├─────────────────┼────────────────────────────────────────────────────────┤
 * │ 成功率          │ 自動到帳筆數 ÷ 總充值筆數 × 100%                        │
 * │ 3分內佔比       │ 自動到帳中處理時間 ≤ 180秒的筆數 ÷ 自動到帳筆數 × 100%  │
 * │ 平均處理時間    │ 自動到帳筆數的平均處理時間（通知時間 - 建立時間）         │
 * └─────────────────┴────────────────────────────────────────────────────────┘
 *
 * 【五、提現指標數據分析】
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ 指標            │ 計算公式                                                │
 * ├─────────────────┼────────────────────────────────────────────────────────┤
 * │ 成功率          │ 提現成功筆數 ÷ 總提現筆數 × 100%                        │
 * │ 2分內佔比       │ 提現成功中處理時間 ≤ 120秒的筆數 ÷ 提現成功筆數 × 100%  │
 * │ 平均處理時間    │ 提現成功筆數的平均時間                                   │
 * │                 │ 公式：IF(V="", Q-T, Q-V)                                │
 * │                 │ Q = 通知商戶時間, T = 建立時間, V = 剩餘池建立時間       │
 * └─────────────────┴────────────────────────────────────────────────────────┘
 *
 * =====================================================
 */

// ===== IndexedDB 持久化 (比照數據管理) =====
const PM_DB_NAME = 'PmMetricsDB'
const PM_DB_VERSION = 1
const PM_STORE_NAME = 'pmData'

// 打開 IndexedDB 數據庫
const openPmDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PM_DB_NAME, PM_DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(PM_STORE_NAME)) {
        db.createObjectStore(PM_STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

// 保存數據到 IndexedDB
const saveToPmDB = async (key, data) => {
  try {
    const db = await openPmDB()
    const transaction = db.transaction([PM_STORE_NAME], 'readwrite')
    const store = transaction.objectStore(PM_STORE_NAME)
    const serialized = JSON.stringify(data)
    store.put({ id: key, data: serialized })

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close()
        console.log(`PM專用 - 已保存到 IndexedDB: ${key}`)
        resolve()
      }
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
    })
  } catch (e) {
    console.error('IndexedDB 保存失敗:', e)
  }
}

// 從 IndexedDB 讀取數據
const loadFromPmDB = async (key) => {
  try {
    const db = await openPmDB()
    const transaction = db.transaction([PM_STORE_NAME], 'readonly')
    const store = transaction.objectStore(PM_STORE_NAME)
    const request = store.get(key)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close()
        const result = request.result?.data
        if (result) {
          try {
            const parsed = JSON.parse(result)
            console.log(`PM專用 - 從 IndexedDB 載入 ${key}:`, parsed.length, '筆')
            resolve(parsed)
          } catch {
            resolve(result)
          }
        } else {
          resolve(null)
        }
      }
      request.onerror = () => {
        db.close()
        reject(request.error)
      }
    })
  } catch (e) {
    console.error('IndexedDB 讀取失敗:', e)
    return null
  }
}

// 清除 IndexedDB 數據
const clearPmDB = async () => {
  try {
    const db = await openPmDB()
    const transaction = db.transaction([PM_STORE_NAME], 'readwrite')
    const store = transaction.objectStore(PM_STORE_NAME)
    store.clear()

    return new Promise((resolve) => {
      transaction.oncomplete = () => {
        db.close()
        console.log('PM專用 - IndexedDB 已清除')
        resolve()
      }
    })
  } catch (e) {
    console.error('清除 IndexedDB 失敗:', e)
  }
}

// ===== 本地數據存儲 (PM專用獨立數據) =====
const depositRecords = ref([])
const withdrawRecords = ref([])
const prevWithdrawRecords = ref([])
const depositFileName = ref('')
const withdrawFileName = ref('')
const prevWithdrawFileName = ref('')
const isLoading = ref(false)
const loadingText = ref('載入中...')
const uploadError = ref('')
const expandedManualType = ref(null)

// 切換補單類型展開狀態
const toggleManualType = (type) => {
  expandedManualType.value = expandedManualType.value === type ? null : type
}

// 頁面載入時從 IndexedDB 恢復數據
onMounted(async () => {
  console.log('PM專用 - 組件已掛載，開始從 IndexedDB 載入數據')
  loadingText.value = '正在載入已保存的數據...'
  isLoading.value = true

  try {
    const savedDeposit = await loadFromPmDB('pm_deposit_records')
    if (savedDeposit && savedDeposit.length > 0) {
      depositRecords.value = savedDeposit
      console.log('PM專用 - 充值數據已恢復，記錄數:', savedDeposit.length)
    }
    const savedDepositFileName = await loadFromPmDB('pm_deposit_filename')
    if (savedDepositFileName) {
      depositFileName.value = savedDepositFileName
    }

    const savedWithdraw = await loadFromPmDB('pm_withdraw_records')
    if (savedWithdraw && savedWithdraw.length > 0) {
      withdrawRecords.value = savedWithdraw
      console.log('PM專用 - 提現數據已恢復，記錄數:', savedWithdraw.length)
    }
    const savedWithdrawFileName = await loadFromPmDB('pm_withdraw_filename')
    if (savedWithdrawFileName) {
      withdrawFileName.value = savedWithdrawFileName
    }

    const savedPrevWithdraw = await loadFromPmDB('pm_prev_withdraw_records')
    if (savedPrevWithdraw && savedPrevWithdraw.length > 0) {
      prevWithdrawRecords.value = savedPrevWithdraw
    }
    const savedPrevWithdrawFileName = await loadFromPmDB('pm_prev_withdraw_filename')
    if (savedPrevWithdrawFileName) {
      prevWithdrawFileName.value = savedPrevWithdrawFileName
    }
  } catch (error) {
    console.error('從 IndexedDB 載入數據失敗:', error)
  } finally {
    isLoading.value = false
  }

  console.log('PM專用 - 數據載入完成:', {
    充值筆數: depositRecords.value.length,
    提現筆數: withdrawRecords.value.length
  })
})

// ===== 檔案類型檢測 =====
const detectFileType = (content) => {
  const lines = content.split('\n')
  if (lines.length < 1) return 'unknown'

  const header = lines[0].toLowerCase()

  // 充值文件特征關鍵字（檢查表頭）
  const depositKeywords = ['到帳金額', '到账金额', '銀行名稱', '银行名称', '銀行卡編碼', '银行卡编码', '收款商戶', '收款商户']
  // 提現文件特征關鍵字（檢查表頭）
  const withdrawKeywords = ['收款銀行', '收款银行', '收款卡號', '收款卡号', '收款姓名', '收款地址', '出款商戶', '出款商户', '出款卡編碼', '出款卡编码']

  const hasDepositKeyword = depositKeywords.some(k => header.includes(k.toLowerCase()))
  const hasWithdrawKeyword = withdrawKeywords.some(k => header.includes(k.toLowerCase()))

  if (hasDepositKeyword && !hasWithdrawKeyword) return 'deposit'
  if (hasWithdrawKeyword && !hasDepositKeyword) return 'withdraw'

  return 'unknown'
}

// ===== 檔案上傳處理 =====
const handleDepositUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  uploadError.value = ''
  loadingText.value = '正在解析充值數據...'
  isLoading.value = true

  // 延遲一小段時間讓 loading 畫面顯示
  await new Promise(resolve => setTimeout(resolve, 100))

  try {
    const content = await file.text()
    loadingText.value = '正在驗證檔案格式...'

    // 防呆：檢測檔案類型
    const fileType = detectFileType(content)
    if (fileType === 'withdraw') {
      uploadError.value = '錯誤：您上傳的是提現數據，請使用「上傳提現數據」按鈕'
      alert('錯誤：您上傳的是提現數據，請使用「上傳提現數據」按鈕')
      return
    }
    if (fileType === 'unknown') {
      const confirmed = confirm('無法確認檔案類型，是否仍要作為充值數據載入？')
      if (!confirmed) return
    }

    loadingText.value = '正在處理數據...'
    const result = parseCSV(content)
    const records = result.records || result

    // 防呆：檢查是否有有效記錄
    if (!records || records.length === 0) {
      uploadError.value = '錯誤：檔案中沒有有效的充值記錄'
      alert('錯誤：檔案中沒有有效的充值記錄')
      return
    }

    loadingText.value = '正在保存數據...'
    depositRecords.value = records
    depositFileName.value = file.name
    // 保存到 IndexedDB
    await saveToPmDB('pm_deposit_records', records)
    await saveToPmDB('pm_deposit_filename', file.name)
    console.log('PM專用 - 充值數據已保存，記錄數:', records.length)
    console.log('PM專用 - 充值數據載入:', depositRecords.value.length, '筆')
  } catch (error) {
    console.error('充值數據解析錯誤:', error)
    uploadError.value = '充值數據解析失敗：' + error.message
    alert('充值數據解析失敗：' + error.message)
  } finally {
    isLoading.value = false
    event.target.value = '' // 重置 input 以允許重新上傳同一檔案
  }
}

const handleWithdrawUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  uploadError.value = ''
  loadingText.value = '正在解析提現數據...'
  isLoading.value = true

  // 延遲一小段時間讓 loading 畫面顯示
  await new Promise(resolve => setTimeout(resolve, 100))

  try {
    const content = await file.text()
    loadingText.value = '正在驗證檔案格式...'

    // 防呆：檢測檔案類型
    const fileType = detectFileType(content)
    if (fileType === 'deposit') {
      uploadError.value = '錯誤：您上傳的是充值數據，請使用「上傳充值數據」按鈕'
      alert('錯誤：您上傳的是充值數據，請使用「上傳充值數據」按鈕')
      return
    }
    if (fileType === 'unknown') {
      const confirmed = confirm('無法確認檔案類型，是否仍要作為提現數據載入？')
      if (!confirmed) return
    }

    loadingText.value = '正在處理數據...'
    const result = parseWithdrawCSV(content)
    const records = result.records || result

    // 防呆：檢查是否有有效記錄
    if (!records || records.length === 0) {
      uploadError.value = '錯誤：檔案中沒有有效的提現記錄'
      alert('錯誤：檔案中沒有有效的提現記錄')
      return
    }

    loadingText.value = '正在保存數據...'
    withdrawRecords.value = records
    withdrawFileName.value = file.name
    // 保存到 IndexedDB
    await saveToPmDB('pm_withdraw_records', records)
    await saveToPmDB('pm_withdraw_filename', file.name)
    console.log('PM專用 - 提現數據已保存，記錄數:', records.length)
    console.log('PM專用 - 提現數據載入:', withdrawRecords.value.length, '筆')
  } catch (error) {
    console.error('提現數據解析錯誤:', error)
    alert('提現數據解析失敗：' + error.message)
  } finally {
    isLoading.value = false
    event.target.value = ''
  }
}

const handlePrevWithdrawUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  uploadError.value = ''
  loadingText.value = '正在解析對比提現數據...'
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 100))
  try {
    const content = await file.text()
    const fileType = detectFileType(content)
    if (fileType === 'deposit') {
      alert('錯誤：您上傳的是充值數據，請上傳提現數據')
      return
    }
    const result = parseWithdrawCSV(content)
    const records = result.records || result
    if (!records || records.length === 0) {
      alert('錯誤：檔案中沒有有效的提現記錄')
      return
    }
    prevWithdrawRecords.value = records
    prevWithdrawFileName.value = file.name
    await saveToPmDB('pm_prev_withdraw_records', records)
    await saveToPmDB('pm_prev_withdraw_filename', file.name)
  } catch (error) {
    alert('對比提現數據解析失敗：' + error.message)
  } finally {
    isLoading.value = false
    event.target.value = ''
  }
}

const clearData = async () => {
  depositRecords.value = []
  withdrawRecords.value = []
  prevWithdrawRecords.value = []
  depositFileName.value = ''
  withdrawFileName.value = ''
  prevWithdrawFileName.value = ''
  await clearPmDB()
  console.log('PM專用 - 數據已清除')
}

// 格式化時間（分秒）
const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}分${secs}秒`
}

// 格式化時間（時:分:秒）
const formatTimeHMS = (seconds) => {
  if (seconds === null || seconds === undefined || seconds < 0) return '--'
  const totalSeconds = Math.round(seconds)
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const { pmAnalysisMetrics, pmCountMetrics, combinedDepositAnalysis, depositStatusAnalysis, manualOrderAnalysis, depositTimeAnalysis, withdrawTimeAnalysis } = usePmMetrics(depositRecords, withdrawRecords)

const withdrawComparison = computed(() => {
  if (withdrawRecords.value.length === 0 || prevWithdrawRecords.value.length === 0) return null

  const isExcluded = (merchant) => {
    if (!merchant) return false
    const m = merchant.toLowerCase()
    return merchant.includes('線下') || merchant.includes('线下') || m.includes('test') || m.includes('qa')
  }

  const dedup = (rows) => {
    const seen = new Set()
    return rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
  }

  const analyzeWeek = (rows) => {
    const data = dedup(rows.filter(r => !isExcluded(r.merchant)))
    const total = data.length
    const succ = data.filter(r => r.isAutoWithdraw === 1)
    const succRate = total > 0 ? succ.length / total * 100 : 0
    const reqAmt = data.reduce((s, r) => s + (r.requestAmount || 0), 0)
    const succAmt = succ.reduce((s, r) => s + (r.actualAmount || 0), 0)

    // 渠道
    const channels = ['支付宝', '银行卡', '微信']
    const chStats = {}
    channels.forEach(ch => {
      const chRows = data.filter(r => r.remark === ch)
      const chSucc = chRows.filter(r => r.isAutoWithdraw === 1)
      chStats[ch] = {
        apply: chRows.length,
        succ: chSucc.length,
        succRate: chRows.length > 0 ? chSucc.length / chRows.length * 100 : 0,
        reqAmt: chRows.reduce((s, r) => s + (r.requestAmount || 0), 0),
        succAmt: chSucc.reduce((s, r) => s + (r.actualAmount || 0), 0)
      }
    })

    // 每日
    const dailyMap = {}
    data.forEach(r => {
      const date = (r.requestTime || '').substring(0, 10)
      if (!date) return
      if (!dailyMap[date]) dailyMap[date] = { apply: 0, succ: 0, succAmt: 0 }
      dailyMap[date].apply++
      if (r.isAutoWithdraw === 1) { dailyMap[date].succ++; dailyMap[date].succAmt += (r.actualAmount || 0) }
    })
    const daily = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({ date, apply: d.apply, succ: d.succ, succRate: d.apply > 0 ? d.succ / d.apply * 100 : 0, succAmt: d.succAmt }))

    return { total, succ: succ.length, succRate, reqAmt, succAmt, chStats, daily }
  }

  const curr = analyzeWeek(withdrawRecords.value)
  const prev = analyzeWeek(prevWithdrawRecords.value)

  const diff = (a, b) => ({ val: b - a, pct: a !== 0 ? (b - a) / a * 100 : 0 })

  // 觀察
  const insights = []
  const rateDiff = curr.succRate - prev.succRate
  if (Math.abs(rateDiff) >= 2) {
    insights.push({ type: rateDiff > 0 ? 'good' : 'warn', text: `成功率${rateDiff > 0 ? '上升' : '下降'} ${Math.abs(rateDiff).toFixed(1)}%（${prev.succRate.toFixed(1)}% → ${curr.succRate.toFixed(1)}%）` })
  } else {
    insights.push({ type: 'info', text: `成功率持平（${prev.succRate.toFixed(1)}% → ${curr.succRate.toFixed(1)}%）` })
  }
  const applyDiff = curr.total - prev.total
  insights.push({ type: 'info', text: `申請量${applyDiff >= 0 ? '增加' : '減少'} ${Math.abs(applyDiff).toLocaleString()} 筆（${applyDiff >= 0 ? '+' : ''}${(applyDiff / prev.total * 100).toFixed(1)}%）` })

  // 渠道異常偵測
  const chNames = { '支付宝': '支付寶', '银行卡': '銀行卡', '微信': '微信' }
  Object.entries(chNames).forEach(([key, label]) => {
    const c = curr.chStats[key], p = prev.chStats[key]
    if (!c || !p || p.apply === 0) return
    const d = c.succRate - p.succRate
    if (Math.abs(d) >= 3) {
      insights.push({ type: d > 0 ? 'good' : 'warn', text: `${label} 成功率${d > 0 ? '改善' : '下滑'} ${Math.abs(d).toFixed(1)}%（${p.succRate.toFixed(1)}% → ${c.succRate.toFixed(1)}%）` })
    }
  })

  // 最低日
  const worstDay = [...curr.daily].sort((a, b) => a.succRate - b.succRate)[0]
  if (worstDay && worstDay.succRate < curr.succRate - 5) {
    insights.push({ type: 'warn', text: `本週最低點：${worstDay.date}，成功率 ${worstDay.succRate.toFixed(1)}%（${worstDay.succ.toLocaleString()} / ${worstDay.apply.toLocaleString()} 筆）` })
  }

  return { curr, prev, diff: { total: diff(prev.total, curr.total), succ: diff(prev.succ, curr.succ), succRate: diff(prev.succRate, curr.succRate), reqAmt: diff(prev.reqAmt, curr.reqAmt), succAmt: diff(prev.succAmt, curr.succAmt) }, insights }
})
</script>

<style scoped>
.pm-metrics {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 報表區塊 */
.report-section {
  background: #16213e;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #2a3f5f;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #2a3f5f;
  padding-bottom: 12px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #ff9f0a;
  margin: 0;
}

.section-note {
  font-size: 12px;
  color: #666;
  background: #1a1a2e;
  padding: 4px 8px;
  border-radius: 4px;
}

/* 指標數據表格 */
.analysis-table-container {
  overflow-x: auto;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.analysis-table th,
.analysis-table td {
  padding: 10px 12px;
  text-align: center;
  border: 1px solid #2a3f5f;
}

.category-header {
  background: #0f3460;
  color: #fff;
  font-weight: 600;
  width: 80px;
}

.group-header {
  font-weight: 600;
  color: #fff;
}

.deposit-header {
  background: #1e5f74;
}

.withdraw-header {
  background: #7b4b94;
}

.sub-header {
  font-weight: 500;
  font-size: 12px;
}

.deposit-sub {
  background: #1e5f74;
  color: #ccc;
}

.withdraw-sub {
  background: #7b4b94;
  color: #ccc;
}

.category-cell {
  background: #0f3460;
  color: #fff;
  font-weight: 500;
  text-align: left;
  padding-left: 16px;
}

.rate-cell {
  background: #1a3a4a;
  color: #4ade80;
}

.debug-cell {
  background: #1a3a4a;
  color: #888;
  font-size: 11px;
}

.time-cell {
  background: #1a3a4a;
  color: #60a5fa;
}

.withdraw-rate-cell {
  background: #2d2a4a;
  color: #c084fc;
}

.withdraw-time-cell {
  background: #2d2a4a;
  color: #f472b6;
}

/* 筆數計算表格 */
.count-cell {
  background: #1a3a4a;
  color: #fbbf24;
  font-weight: 500;
}

.amount-cell {
  background: #1a3a4a;
  color: #34d399;
  font-weight: 500;
}

/* 總計列樣式 */
.total-row td {
  background: #0f3460 !important;
  font-weight: 600;
  border-top: 2px solid #ff9f0a;
}

.total-row .category-cell {
  color: #ff9f0a;
}

/* 子區塊 */
.sub-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #2a3f5f;
}

.sub-section:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.sub-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 12px;
}

/* 縮排子項目 */
.indent-cell {
  padding-left: 24px !important;
  color: #a78bfa !important;
  font-size: 12px;
}

/* 群組標題列 */
.group-header-row td {
  background: #1a2744 !important;
  font-weight: 600;
  border-top: 1px solid #3d5a80;
}

.withdraw-count-cell {
  background: #2d2a4a;
  color: #a78bfa;
  font-weight: 500;
}

/* 空狀態 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  background: #16213e;
  border-radius: 8px;
  border: 1px solid #2a3f5f;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  color: #fff;
  margin-bottom: 8px;
}

.empty-state p {
  color: #888;
  font-size: 14px;
}

/* 數據上傳區塊 */
.upload-section {
  background: #16213e;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #2a3f5f;
  margin-bottom: 20px;
}

.upload-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #2a3f5f;
  padding-bottom: 12px;
}

.upload-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #ff9f0a;
  margin: 0;
}

.upload-note {
  font-size: 12px;
  color: #888;
  background: #1a1a2e;
  padding: 4px 8px;
  border-radius: 4px;
}

.upload-buttons {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.upload-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.deposit-btn {
  background: linear-gradient(135deg, #1e5f74 0%, #2a7f9f 100%);
  color: #fff;
}

.deposit-btn:hover {
  background: linear-gradient(135deg, #2a7f9f 0%, #3a9fbf 100%);
  transform: translateY(-1px);
}

.withdraw-btn {
  background: linear-gradient(135deg, #7b4b94 0%, #9b6bb4 100%);
  color: #fff;
}

.withdraw-btn:hover {
  background: linear-gradient(135deg, #9b6bb4 0%, #bb8bd4 100%);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 16px;
}

.btn-text {
  white-space: nowrap;
}

.upload-status {
  font-size: 12px;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
}

.upload-filename {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #3d3d5c;
  color: #ccc;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
  margin-left: auto;
}

.clear-btn:hover {
  background: #4d4d6c;
  color: #fff;
}

/* 公式說明區塊 */
.formula-section {
  margin-top: 16px;
  padding: 16px;
  background: #1a1a2e;
  border-radius: 6px;
  border: 1px solid #2a3f5f;
}

.formula-title {
  font-size: 14px;
  font-weight: 600;
  color: #ff9f0a;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a3f5f;
}

.formula-note {
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
}

.formula-content {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.formula-group {
  flex: 1;
  min-width: 280px;
}

.formula-group-title {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 8px;
}

.formula-item {
  font-size: 12px;
  color: #aaa;
  line-height: 1.8;
  padding-left: 8px;
  border-left: 2px solid #2a3f5f;
  margin-bottom: 4px;
}

.formula-item .formula-label {
  color: #ccc;
  font-weight: 500;
}

.formula-item.formula-sub {
  margin-left: 16px;
  font-size: 11px;
  color: #888;
  border-left-color: #3d4f5f;
}

/* Loading 遮罩 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px 60px;
  background: #1a1a2e;
  border-radius: 12px;
  border: 1px solid #2a3f5f;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #2a3f5f;
  border-top-color: #ff9f0a;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: #fff;
  font-weight: 500;
}

/* 補單類型分析 */
.manual-order-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.manual-order-card {
  flex: 1;
  min-width: 280px;
  background: #1a1a2e;
  border: 1px solid #2a3f5f;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.manual-order-card:hover {
  border-color: #ff9f0a;
}

.manual-order-card.expanded {
  border-color: #ff9f0a;
}

.card-header {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #0f3460;
}

.card-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.card-count {
  font-size: 18px;
  font-weight: 700;
  color: #fbbf24;
  margin-right: 12px;
}

.card-toggle {
  font-size: 12px;
  color: #888;
  transition: transform 0.2s;
}

.manual-order-card.expanded .card-toggle {
  color: #ff9f0a;
}

.card-details {
  padding: 12px;
  background: #16213e;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.detail-table th,
.detail-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #2a3f5f;
}

.detail-table th {
  background: #1a1a2e;
  color: #888;
  font-weight: 500;
  font-size: 12px;
}

.detail-table td {
  color: #ccc;
}

.detail-table td:nth-child(2),
.detail-table td:nth-child(3) {
  text-align: right;
  color: #4ade80;
}

.detail-table tr:last-child td {
  border-bottom: none;
}

/* 支付寶提現時間分析 */
.alipay-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.summary-card {
  flex: 1;
  min-width: 130px;
  background: #1a1a2e;
  border: 1px solid #2a3f5f;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.summary-card-warn {
  border-color: #f87171;
}

.summary-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #60a5fa;
}

.summary-card-warn .summary-value {
  color: #f87171;
}

.alipay-th {
  background: #1e4a6e;
  color: #ccc;
  font-weight: 500;
  font-size: 12px;
}

.warn-th {
  background: #5a2020;
  color: #fca5a5;
}

.merchant-th {
  text-align: left;
  padding-left: 16px;
}

.alipay-date-cell {
  background: #0f3460;
  color: #fff;
  font-weight: 500;
}

.alipay-count-cell {
  background: #1a3a4a;
  color: #fbbf24;
  font-weight: 500;
}

.alipay-time-cell {
  background: #1a3a4a;
  color: #60a5fa;
}

.alipay-warn-cell {
  background: #1a3a4a;
  color: #aaa;
}

.alipay-merchant-cell {
  background: #0f3460;
  color: #e2e8f0;
  text-align: left;
  padding-left: 16px;
  font-size: 12px;
}

.warn-cell {
  color: #f87171 !important;
}

.warn-highlight {
  color: #f87171 !important;
  font-weight: 600;
}

.warn-label {
  color: #f87171 !important;
}

.warn-rate {
  color: #f87171 !important;
}

/* 原因分析 */
.insights-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #1a1a2e;
  border-radius: 6px;
  border: 1px solid #2a3f5f;
}

.insights-title {
  font-size: 13px;
  font-weight: 600;
  color: #ff9f0a;
  margin-bottom: 10px;
}

.insights-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.insight-item {
  font-size: 13px;
  line-height: 1.6;
  padding: 6px 10px;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.insight-icon {
  flex-shrink: 0;
  font-style: normal;
}

.insight-warn {
  background: rgba(248, 113, 113, 0.1);
  color: #fca5a5;
  border-left: 3px solid #f87171;
}

.insight-good {
  background: rgba(74, 222, 128, 0.1);
  color: #86efac;
  border-left: 3px solid #4ade80;
}

.insight-info {
  background: rgba(96, 165, 250, 0.1);
  color: #93c5fd;
  border-left: 3px solid #60a5fa;
}

.channel-total-row td {
  background: #0f3460 !important;
  font-weight: 600;
  border-bottom: 2px solid #ff9f0a;
}

.channel-total-row .alipay-date-cell {
  color: #ff9f0a !important;
}

/* 小結+觀察獨立區塊 */
.insights-standalone {
  padding: 16px 20px;
}

/* 上上週提現上傳按鈕 */
.prev-withdraw-btn {
  background: linear-gradient(135deg, #4b5b94 0%, #6b7bb4 100%);
  color: #fff;
}

.prev-withdraw-btn:hover {
  background: linear-gradient(135deg, #6b7bb4 0%, #8b9bd4 100%);
  transform: translateY(-1px);
}

/* 變化欄位（週度對比） */
.diff-up {
  color: #4ade80 !important;
  font-weight: 600;
}

.diff-down {
  color: #f87171 !important;
  font-weight: 600;
}

/* 週度對比 - 每日兩欄並排 */
.comparison-daily-wrapper {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.comparison-daily-col {
  flex: 1;
  min-width: 280px;
}

.comparison-week-label {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 8px;
  padding: 4px 10px;
  background: #1a2744;
  border-radius: 4px;
  display: inline-block;
}

/* 低於週均-5% 的日期列 */
.warn-row td {
  background: rgba(248, 113, 113, 0.06) !important;
}

/* 渠道名稱欄 */
.alipay-channel-cell {
  background: #0f3460;
  color: #fff;
  font-weight: 500;
  text-align: left;
  padding-left: 16px;
}

</style>
