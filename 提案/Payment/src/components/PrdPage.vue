<template>
  <div class="prd-page">
    <div class="prd-header">
      <h1>Payment 驗證版 數據分析 PRD</h1>
      <div class="prd-meta">
        <span class="version">v1.9.9</span>
        <span class="date">2026-02-11</span>
      </div>
    </div>

    <div class="prd-links">
      <div class="link-item">
        <span class="link-label">本地端網址：</span>
        <a href="http://localhost:5173" target="_blank">http://localhost:5173</a>
      </div>
      <div class="link-item">
        <span class="link-label">外部預覽網址：</span>
        <a href="https://techrepublic-algorithm-occasions-reductions.trycloudflare.com" target="_blank">https://techrepublic-algorithm-occasions-reductions.trycloudflare.com</a>
      </div>
    </div>

    <div class="prd-content" v-html="prdHtml"></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  isVerifyVersion: {
    type: Boolean,
    default: false
  }
})

// 驗證版專用章節（6.8 筆數計算表格欄位）
const verifyOnlySection = `
<h3>6.8 筆數計算表格欄位（驗證版專用）</h3>
<table>
  <thead>
    <tr><th>欄位</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>總充值筆數</td><td>自動到帳 + 補單</td></tr>
    <tr><td>補單筆數</td><td>狀態包含「補單」或「商戶確認到帳」且到帳金額 > 0</td></tr>
    <tr><td>無效申請筆數</td><td>狀態包含「未充值」且到帳金額 = 0</td></tr>
    <tr><td>自動到帳筆數</td><td>到帳金額 > 0 且狀態不包含「補單」</td></tr>
    <tr><td>自動到帳時長</td><td>自動到帳的平均處理時間</td></tr>
    <tr><td>平均充值時長</td><td>（自動到帳 + 補單）的平均處理時間</td></tr>
    <tr><td>總提現筆數</td><td>該分類範圍內的所有提現記錄數</td></tr>
    <tr><td>自動提現筆數</td><td>成功提現筆數（轉帳成功且實際轉出金額 ≠ 0）</td></tr>
    <tr><td>自動提現時長</td><td>成功提現的平均處理時間</td></tr>
    <tr><td>平均提現時長</td><td>與自動提現時長相同</td></tr>
  </tbody>
</table>
`

const prdHtmlBase = ref(`
<h2>一、系統概述</h2>
<p>Payment 驗證版數據分析系統用於分析充值與提現數據，提供多維度的數據統計與報表功能。系統支援 CSV/XLSX 檔案導入，自動計算各項指標。</p>

<h3>1.1 系統架構</h3>
<pre>
Payment 驗證版數據分析
├── 充值分析報表
│   ├── 總覽指標
│   ├── 極速（銀行卡）
│   ├── 極速（支付寶）
│   ├── 極速（微信）
│   └── 騙分沒到帳來找
├── 提現分析報表
├── 日/周報數據匯總
│   ├── 指標數據分析
│   └── 筆數計算
├── 騙分統計
├── 報表三方設定
└── PRD文件
</pre>

<hr>

<h2>二、資料清洗規則</h2>

<h3>2.1 簡繁體字符處理</h3>
<p>系統同時支援簡體與繁體中文資料，所有篩選條件皆包含兩種字符集：</p>
<table>
  <thead>
    <tr><th>簡體</th><th>繁體</th><th>用途</th></tr>
  </thead>
  <tbody>
    <tr><td><code>用户确认到帐</code></td><td><code>用戶確認到帳</code></td><td>c2c 點確認判斷</td></tr>
    <tr><td><code>商户确认到帐</code></td><td><code>商戶確認到帳</code></td><td>商戶確認判斷</td></tr>
    <tr><td><code>银商确认到账</code></td><td><code>銀商確認到帳</code></td><td>銀商確認判斷</td></tr>
    <tr><td><code>金额补单</code></td><td><code>金額補單</code></td><td>補單判斷</td></tr>
    <tr><td><code>图文复核(已超时)</code></td><td><code>圖文複核(已超時)</code></td><td>超時判斷</td></tr>
    <tr><td><code>审核中(已超时)</code></td><td><code>審核中(已超時)</code></td><td>超時判斷</td></tr>
    <tr><td><code>明细补单</code></td><td><code>明細補單</code></td><td>明細補單判斷</td></tr>
    <tr><td><code>补</code></td><td><code>補</code></td><td>掉單關鍵字</td></tr>
  </tbody>
</table>

<h3>2.2 狀態正規化（normalizeStatus）</h3>
<p>系統將原始狀態字符串正規化為統一格式，確保統計準確性：</p>
<table>
  <thead>
    <tr><th>原始狀態（含簡繁體）</th><th>正規化後</th></tr>
  </thead>
  <tbody>
    <tr><td>金额补单 / 金額補單</td><td>金额补单</td></tr>
    <tr><td>图文复核(已超时) / 圖文複核(已超時)</td><td>图文复核(已超时)</td></tr>
    <tr><td>审核中(已超时) / 審核中(已超時)</td><td>审核中(已超时)</td></tr>
    <tr><td>未充值 / 未充值</td><td>未充值</td></tr>
  </tbody>
</table>

<h3>2.3 排除條件</h3>
<p>以下記錄在計算時自動排除：</p>
<ul>
  <li>商戶包含 <code>test</code>（不區分大小寫）</li>
  <li>商戶包含 <code>qa</code>（不區分大小寫）</li>
  <li>商戶包含「線下」或「线下」（除非明確指定線下區塊）</li>
</ul>

<h3>2.4 欄位名稱對應</h3>
<p>CSV/XLSX 欄位名稱同時支援簡繁體：</p>
<table>
  <thead>
    <tr><th>繁體欄位名</th><th>簡體欄位名</th><th>系統變數</th></tr>
  </thead>
  <tbody>
    <tr><td>到帳金額</td><td>到账金额</td><td>receivedAmount</td></tr>
    <tr><td>銀行卡編碼</td><td>银行卡编码</td><td>bankCardCode</td></tr>
    <tr><td>銀行名稱</td><td>银行名称</td><td>bankName</td></tr>
    <tr><td>收款商戶</td><td>收款商户</td><td>merchant</td></tr>
    <tr><td>狀態</td><td>状态</td><td>status</td></tr>
    <tr><td>充值金額</td><td>充值金额</td><td>amount</td></tr>
    <tr><td>建立時間</td><td>建立时间</td><td>createTime</td></tr>
    <tr><td>通知時間</td><td>通知时间</td><td>notifyTime</td></tr>
    <tr><td>用戶等級</td><td>用户等级</td><td>userLevel</td></tr>
  </tbody>
</table>

<h3>2.5 處理時間計算</h3>
<pre>
處理時間（秒）= 通知時間 - 建立時間
平均處理時間 = Σ(處理時間) / 有效記錄數
</pre>

<h3>2.6 商戶分類規則</h3>
<table>
  <thead>
    <tr><th>分類</th><th>判斷條件</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>銀行卡</strong></td><td>商戶包含「极速充提3」且不含「支付寶/微信」</td></tr>
    <tr><td><strong>支付寶</strong></td><td>商戶包含「支付寶」或「支付宝」</td></tr>
    <tr><td><strong>微信</strong></td><td>商戶包含「微信」</td></tr>
    <tr><td><strong>線下</strong></td><td>商戶包含「線下」或「线下」</td></tr>
  </tbody>
</table>

<h3>2.7 術語定義</h3>
<table>
  <thead>
    <tr><th>術語</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>極速提</strong></td><td>銀行卡編碼 = <code>AUCTION_PAYMENT_CARD</code> 的記錄，表示透過極速提系統配對的訂單</td></tr>
    <tr><td><strong>一般卡</strong></td><td>銀行卡編碼有值且 ≠ <code>AUCTION_PAYMENT_CARD</code> 的記錄，表示透過一般銀行卡配對的訂單</td></tr>
    <tr><td><strong>c2c</strong></td><td>極速提中用戶確認到帳的訂單，屬於 C2C（用戶對用戶）交易模式</td></tr>
    <tr><td><strong>信評上分</strong></td><td>透過信用評分系統自動上分的訂單</td></tr>
    <tr><td><strong>掉單</strong></td><td>到帳金額 > 0 但需要補單處理的訂單（狀態含「補」字）</td></tr>
  </tbody>
</table>

<hr>

<h2>三、充值分析報表</h2>

<h3>3.1 功能概述</h3>
<p>充值分析報表提供充值數據的總覽與各渠道分析，支援商戶篩選、日期範圍篩選、查詢與匯出 Excel 功能。</p>

<h3>3.2 渠道切換</h3>
<table>
  <thead>
    <tr><th>渠道</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>全部</td><td>顯示所有渠道匯總數據（排除 test/qa）</td></tr>
    <tr><td>極速(銀行卡)</td><td>銀行卡相關商戶（排除 test/qa/線下）</td></tr>
    <tr><td>極速(支付寶)</td><td>商戶名稱包含「支付宝」或「支付寶」</td></tr>
    <tr><td>極速(微信)</td><td>商戶名稱包含「微信」</td></tr>
  </tbody>
</table>

<h3>3.3 全部渠道 - 重要信息</h3>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>總申請筆數</strong></td><td>商戶只排除 test/qa 的筆數加總</td></tr>
    <tr><td><strong>成功率</strong></td><td>到帳金額 ≠ 0 的筆數 ÷ 總申請筆數 × 100%</td></tr>
    <tr><td><strong>總充值成功（含掉單）</strong></td><td>到帳金額 > 0 的筆數</td></tr>
    <tr><td><strong>總充值金額</strong></td><td>到帳金額 > 0 的筆數的到帳金額加總</td></tr>
    <tr><td><strong>平均處理時間</strong></td><td>到帳金額 > 0 的筆數，（通知時間 - 建立時間）的平均時間</td></tr>
    <tr><td><strong>無效申請</strong></td><td>狀態含「取消」或 到帳金額 = 0 的筆數加總</td></tr>
    <tr><td><strong>掉單筆數</strong></td><td>到帳金額 > 0 且狀態含「補」的筆數加總</td></tr>
  </tbody>
</table>

<h3>3.4 圖表分析</h3>

<h4>3.4.1 24小時交易分布</h4>
<p>顯示每小時的充值交易分布圖表，包含：</p>
<ul>
  <li>X 軸：時間（0-23 小時）</li>
  <li>左 Y 軸：金額（柱狀 + 折線）</li>
  <li>右 Y 軸：筆數（柱狀）</li>
</ul>
<p>詳細樣式請參考第九章 UI/UX 設計規範。</p>

<h4>3.4.2 充值成功占比圓餅圖</h4>
<p>顯示各渠道充值成功筆數的占比分布：</p>
<table>
  <thead>
    <tr><th>分類</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>極速銀行卡</strong></td><td>商戶含「极速充提3」且不含支付寶/微信，到帳金額 > 0</td></tr>
    <tr><td><strong>極速支付寶</strong></td><td>商戶含「极速充提3」且含支付寶，到帳金額 > 0</td></tr>
    <tr><td><strong>極速微信</strong></td><td>商戶含「极速充提3」且含微信，到帳金額 > 0</td></tr>
    <tr><td><strong>外部商戶</strong></td><td>商戶以「外部商戶」開頭，到帳金額 > 0</td></tr>
    <tr><td><strong>線下</strong></td><td>商戶含「線下」或「线下」，到帳金額 > 0</td></tr>
  </tbody>
</table>
<p><strong>數據範圍：</strong>所有商戶排除 test/qa，到帳金額 > 0</p>

<h4>3.4.3 銀行金額分佈條形圖</h4>
<p>顯示充值金額前 10 名的銀行分佈：</p>
<table>
  <thead>
    <tr><th>項目</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>數據來源</strong></td><td>所有充值成功記錄（到帳金額 > 0）</td></tr>
    <tr><td><strong>排序方式</strong></td><td>按到帳金額降序排列</td></tr>
    <tr><td><strong>顯示數量</strong></td><td>Top 10 銀行</td></tr>
    <tr><td><strong>金額單位</strong></td><td>萬元</td></tr>
  </tbody>
</table>

<h3>3.5 充值成功時間區段</h3>
<p><strong>資料範圍：</strong>商戶只排除 test/qa，且到帳金額 > 0</p>
<table>
  <thead>
    <tr><th>時間區段</th><th>條件</th></tr>
  </thead>
  <tbody>
    <tr><td>2分鐘內</td><td>處理時間 ≤ 120秒</td></tr>
    <tr><td>2-3分鐘</td><td>121秒 ≤ 處理時間 ≤ 180秒</td></tr>
    <tr><td>3-5分鐘</td><td>181秒 ≤ 處理時間 ≤ 300秒</td></tr>
    <tr><td>5-15分鐘</td><td>301秒 ≤ 處理時間 ≤ 900秒</td></tr>
    <tr><td>15-30分鐘</td><td>901秒 ≤ 處理時間 ≤ 1800秒</td></tr>
    <tr><td>30分鐘以上</td><td>處理時間 ≥ 1801秒</td></tr>
  </tbody>
</table>
<p><strong>處理時間計算：</strong>通知時間 - 建立時間</p>

<h3>3.6 銀行卡區塊計算準則</h3>

<h4>3.6.1 充值申請筆數</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶包含「极速充提3」且不含支付寶/微信/test/qa/線下</td>
    </tr>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值且 ≠ AUCTION_PAYMENT_CARD</td>
    </tr>
    <tr>
      <td><strong>極速提</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD</td>
    </tr>
    <tr>
      <td><strong>建單成功等待無配對</strong></td>
      <td>銀行卡代號為空的筆數</td>
    </tr>
    <tr>
      <td><strong>取無卡06提示</strong></td>
      <td>依據商戶名稱判斷渠道：銀行卡=商戶不含支付寶/支付宝/微信的筆數加總</td>
    </tr>
    <tr>
      <td><strong>充值申請筆數（總）</strong></td>
      <td>一般卡 + 極速提 + 建單成功等待無配對 + 取無卡06提示</td>
    </tr>
  </tbody>
</table>

<h4>3.6.2 成功配對</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值且 ≠ AUCTION_PAYMENT_CARD</td>
    </tr>
    <tr>
      <td><strong>極速提</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD</td>
    </tr>
    <tr>
      <td><strong>金額計算</strong></td>
      <td>使用充值金額（申請金額）計算</td>
    </tr>
  </tbody>
</table>

<h4>3.6.3 訂單成功</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值且 ≠ AUCTION_PAYMENT_CARD，正規化狀態 ≠「未充值」「審核中(已超時)」</td>
    </tr>
    <tr>
      <td><strong>極速提</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，到帳金額 > 0，狀態 ≠「未充值」「審核中(已超時)」</td>
    </tr>
    <tr>
      <td><strong>信評上分</strong></td>
      <td>到帳金額 > 0 且狀態包含「信用」</td>
    </tr>
    <tr>
      <td><strong>平均處理時間</strong></td>
      <td>到帳金額 > 0 的平均處理時間</td>
    </tr>
  </tbody>
</table>

<h4>3.6.4 沒信評降等配卡</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>條件</strong></td>
      <td>銀行卡代號 ≠ AUCTION_PAYMENT_CARD，到帳金額 ≠ 0，用戶等級 ≠ 0 且 ≠ -1</td>
    </tr>
    <tr>
      <td><strong>分組</strong></td>
      <td>按充值金額（申請金額）分組統計：100/200/300/500/1000/1500/2000/3000/5000/6000/7000/8000/9000/10000/15000/20000/30000/其他</td>
    </tr>
  </tbody>
</table>

<h4>3.6.5 c2c 區塊</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>c2c</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，到帳金額 > 0，狀態包含「用戶確認到帳」</td>
    </tr>
    <tr>
      <td><strong>點確認（用戶確認到帳）</strong></td>
      <td>到帳金額 > 0，狀態包含「用戶確認到帳」</td>
    </tr>
    <tr>
      <td><strong>人工審核:通過</strong></td>
      <td>銀行卡代號包含 AUCTION，到帳金額 > 0，狀態包含「金額補單」，處理時間 ≤ 11分鐘</td>
    </tr>
    <tr>
      <td><strong>超過11min補件後成功</strong></td>
      <td>
        條件一：銀行卡代號包含 AUCTION，到帳金額 > 0，狀態包含「金額補單」，處理時間 > 11分鐘<br>
        <strong>+</strong><br>
        條件二：銀行卡代號 = AUCTION_PAYMENT_CARD，到帳金額 > 0，狀態包含「商戶確認到帳」
      </td>
    </tr>
  </tbody>
</table>

<h4>3.6.6 三方代收區塊</h4>
<table>
  <thead>
    <tr><th>項目</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶不含「支付寶/微信/test/qa/線下」，到帳金額 > 0</td>
    </tr>
    <tr>
      <td><strong>資料來源</strong></td>
      <td>報表三方設定（資料庫）</td>
    </tr>
    <tr>
      <td><strong>識別方式</strong></td>
      <td>銀行卡代號以設定的卡代號開頭（不區分大小寫）</td>
    </tr>
    <tr>
      <td><strong>預設卡代號</strong></td>
      <td>大豪門(GB-DahaomenJFB2025)、匯通(HTc2cdeposit)、豆豆(DDFdeposit)、UC聚合(UC1020)</td>
    </tr>
  </tbody>
</table>

<h4>3.6.7 騙分沒到帳來找</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據來源</strong></td>
      <td>騙分統計（依篩選日期範圍加總）</td>
    </tr>
    <tr>
      <td><strong>人工</strong></td>
      <td>渠道 = 銀行卡，類型 = 人工</td>
    </tr>
    <tr>
      <td><strong>信評</strong></td>
      <td>渠道 = 銀行卡，類型 = 信評</td>
    </tr>
  </tbody>
</table>

<h4>3.6.8 商業平台</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶以「外部商戶」開頭</td>
    </tr>
    <tr>
      <td><strong>充值申請</strong></td>
      <td>符合商戶的記錄筆數和充值金額</td>
    </tr>
    <tr>
      <td><strong>充值成功</strong></td>
      <td>狀態不含「未充值」且金額 > 0 的記錄</td>
    </tr>
  </tbody>
</table>

<hr>

<h3>3.7 支付寶區塊計算準則</h3>

<h4>3.7.1 充值申請筆數</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶包含「支付寶」且不含 test/qa/線下</td>
    </tr>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付</td>
    </tr>
    <tr>
      <td><strong>一般寶</strong></td>
      <td>銀行卡代號有值且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 = 支付寶/支付寶(企)/微信支付</td>
    </tr>
    <tr>
      <td><strong>極速提(卡)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付</td>
    </tr>
    <tr>
      <td><strong>極速提(寶)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 = 支付寶/支付寶(企)/微信支付</td>
    </tr>
  </tbody>
</table>

<h4>3.7.2 訂單成功</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>訂單成功條件</strong></td>
      <td>正規化狀態有值且 ≠ 未充值/圖文複核(已超時)/審核中(已超時)</td>
    </tr>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付 + 上述條件</td>
    </tr>
    <tr>
      <td><strong>一般寶</strong></td>
      <td>銀行卡代號有值且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 = 支付寶/支付寶(企)/微信支付 + 上述條件</td>
    </tr>
    <tr>
      <td><strong>極速提(卡)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付 + 上述條件</td>
    </tr>
    <tr>
      <td><strong>極速提(寶)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 = 支付寶/支付寶(企)/微信支付 + 上述條件</td>
    </tr>
    <tr>
      <td><strong>信評上分</strong></td>
      <td>狀態包含「信用評分上分」</td>
    </tr>
    <tr>
      <td><strong>其中信評不含圖文複核</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，到帳金額 > 0，狀態包含「信用評分上分」且 ≠「信用評分上分(圖文覆核)」</td>
    </tr>
  </tbody>
</table>

<h4>3.7.3 c2c 區塊</h4>
<p>（與銀行卡區塊相同公式）</p>

<h4>3.7.4 三方代收區塊</h4>
<table>
  <thead>
    <tr><th>項目</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶含「支付寶」且不含 test/qa/線下，到帳金額 > 0</td>
    </tr>
    <tr>
      <td><strong>資料來源</strong></td>
      <td>報表三方設定（參見第七章）</td>
    </tr>
    <tr>
      <td><strong>識別方式</strong></td>
      <td>銀行卡代號以設定的卡代號開頭（不區分大小寫）</td>
    </tr>
  </tbody>
</table>

<h4>3.7.5 寶轉卡渠道及寶轉寶渠道</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>寶轉卡渠道 申請</strong></td>
      <td>商戶包含「轉卡」，銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 = 支付寶</td>
    </tr>
    <tr>
      <td><strong>寶轉卡渠道 成功</strong></td>
      <td>上述條件 + 到帳金額 ≠ 0</td>
    </tr>
    <tr>
      <td><strong>寶轉寶渠道 申請</strong></td>
      <td>商戶包含「寶)」，銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶</td>
    </tr>
    <tr>
      <td><strong>寶轉寶渠道 成功</strong></td>
      <td>上述條件 + 到帳金額 ≠ 0</td>
    </tr>
    <tr>
      <td><strong>整體 配對成功/提現申請</strong></td>
      <td>
        分子 = 銀行卡訂單成功極速提金額 + 支付寶訂單成功極速提(卡)金額 + 支付寶訂單成功極速提(寶)金額<br>
        分母 = 支付寶提現申請金額 + 銀行卡提現申請金額（來自提現分析）
      </td>
    </tr>
  </tbody>
</table>

<h4>3.7.6 騙分沒到帳來找</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>數據來源</strong></td><td>騙分統計（依篩選日期範圍加總）</td></tr>
    <tr><td><strong>人工</strong></td><td>渠道 = 支付寶，類型 = 人工</td></tr>
    <tr><td><strong>信評</strong></td><td>渠道 = 支付寶，類型 = 信評</td></tr>
  </tbody>
</table>

<hr>

<h3>3.8 微信區塊計算準則</h3>

<h4>3.8.1 充值申請筆數</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶包含「微信」且不含 test/qa/線下</td>
    </tr>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值 且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付</td>
    </tr>
    <tr>
      <td><strong>一般微</strong></td>
      <td>銀行卡代號有值 且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 = 微信支付</td>
    </tr>
    <tr>
      <td><strong>極速提(卡)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付</td>
    </tr>
    <tr>
      <td><strong>極速提(微)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 = 微信支付</td>
    </tr>
    <tr>
      <td><strong>建單成功等待無配對</strong></td>
      <td>銀行卡代號為空的筆數</td>
    </tr>
    <tr>
      <td><strong>總筆數</strong></td>
      <td>一般卡 + 一般微 + 極速提(卡) + 極速提(微)</td>
    </tr>
  </tbody>
</table>

<h4>3.8.2 成功配對</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值 且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付</td>
    </tr>
    <tr>
      <td><strong>一般微</strong></td>
      <td>銀行卡代號有值 且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 = 微信支付</td>
    </tr>
    <tr>
      <td><strong>極速提(卡)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付</td>
    </tr>
    <tr>
      <td><strong>極速提(微)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 = 微信支付</td>
    </tr>
    <tr>
      <td><strong>金額</strong></td>
      <td>使用充值金額（申請金額）計算</td>
    </tr>
  </tbody>
</table>

<h4>3.8.3 訂單成功</h4>
<p><strong>共通條件：</strong>正規化狀態有值 且 ≠「未充值」且 ≠「圖文複核(已超時)」且 ≠「審核中(已超時)」</p>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>一般卡</strong></td>
      <td>銀行卡代號有值 且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付 + 共通條件</td>
    </tr>
    <tr>
      <td><strong>一般微</strong></td>
      <td>銀行卡代號有值 且 ≠ AUCTION_PAYMENT_CARD，銀行名稱 = 微信支付 + 共通條件</td>
    </tr>
    <tr>
      <td><strong>極速提(卡)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 ≠ 支付寶/支付寶(企)/微信支付 + 共通條件</td>
    </tr>
    <tr>
      <td><strong>極速提(微)</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD，銀行名稱 = 微信支付 + 共通條件</td>
    </tr>
    <tr>
      <td><strong>信評上分</strong></td>
      <td>到帳金額 > 0 且 狀態包含「信用」</td>
    </tr>
    <tr>
      <td><strong>平均處理時間</strong></td>
      <td>到帳金額 > 0，用戶等級 ≠ 0 且 ≠ -1 的記錄之處理時間平均值</td>
    </tr>
  </tbody>
</table>

<h4>3.8.4 沒信評降等配卡</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>條件</strong></td>
      <td>銀行卡代號 ≠ AUCTION_PAYMENT_CARD，到帳金額 ≠ 0，用戶等級 ≠ 0 且 ≠ -1</td>
    </tr>
    <tr>
      <td><strong>分組金額</strong></td>
      <td>100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000, 其他</td>
    </tr>
  </tbody>
</table>

<h4>3.8.5 c2c 區塊</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>c2c 總數</strong></td>
      <td>銀行卡代號 = AUCTION_PAYMENT_CARD 且 到帳金額 > 0 且 狀態包含「用戶確認到帳/用户确认到帐」</td>
    </tr>
    <tr>
      <td><strong>點確認（用戶確認到帳）</strong></td>
      <td>到帳金額 > 0 且 狀態包含「用戶確認到帳/用户确认到帐」</td>
    </tr>
    <tr>
      <td><strong>人工審核:通過</strong></td>
      <td>銀行卡代號包含 AUCTION 且 到帳金額 > 0 且 狀態包含「金額補單/金额补单」且 處理時間 ≤ 660秒（11分鐘）</td>
    </tr>
    <tr>
      <td><strong>超過11min補件後成功</strong></td>
      <td>(銀行卡代號包含 AUCTION 且 到帳金額 > 0 且 狀態包含「金額補單/金额补单」且 處理時間 > 660秒) + (銀行卡代號 = AUCTION_PAYMENT_CARD 且 到帳金額 > 0 且 狀態包含「商戶確認到帳/商户确认到帐」)</td>
    </tr>
  </tbody>
</table>

<h4>3.8.6 三方代收區塊</h4>
<table>
  <thead>
    <tr><th>項目</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶含「微信」且不含 test/qa/線下，到帳金額 > 0</td>
    </tr>
    <tr>
      <td><strong>資料來源</strong></td>
      <td>報表三方設定（參見第七章）</td>
    </tr>
    <tr>
      <td><strong>識別方式</strong></td>
      <td>銀行卡代號以設定的卡代號開頭（不區分大小寫）</td>
    </tr>
  </tbody>
</table>

<h4>3.8.7 騙分沒到帳來找</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據來源</strong></td>
      <td>騙分統計（依篩選日期範圍加總）</td>
    </tr>
    <tr>
      <td><strong>人工</strong></td>
      <td>渠道 = 微信，類型 = 人工</td>
    </tr>
    <tr>
      <td><strong>信評</strong></td>
      <td>渠道 = 微信，類型 = 信評</td>
    </tr>
    <tr>
      <td><strong>騙分拉黑</strong></td>
      <td>渠道 = 微信，騙分拉黑筆數</td>
    </tr>
    <tr>
      <td><strong>卡驗及人驗</strong></td>
      <td>渠道 = 微信，卡驗及人驗筆數</td>
    </tr>
  </tbody>
</table>

<h3>3.9 各渠道分頁</h3>
<p>系統支援四個分頁切換：全部、極速(銀行卡)、極速(支付寶)、極速(微信)</p>
<p>各渠道頁面包含：充值申請筆數、成功配對、訂單成功、沒信評降等配卡、c2c區塊、三方代收區塊、騙分沒到帳來找</p>
<p>詳細計算公式請參考 3.6 銀行卡、3.7 支付寶、3.8 微信各區塊計算準則。</p>

<hr>

<h2>四、提現分析報表</h2>

<h3>4.1 功能概述</h3>
<p>提現分析報表提供提現數據的總覽與各渠道分析，支援商戶篩選、日期範圍篩選、查詢與匯出 Excel 功能。</p>

<h3>4.2 篩選功能</h3>
<p>與充值分析相同：商戶名稱、日期範圍、查詢、匯出 Excel</p>

<h3>4.3 渠道切換</h3>
<p>渠道判斷優先使用「收款銀行」，若為空則使用「出款商戶」：</p>
<table>
  <thead>
    <tr><th>渠道</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>全部</td><td>顯示所有渠道匯總數據</td></tr>
    <tr><td>極速(銀行卡)</td><td>收款銀行/出款商戶不含「支付宝/支付寶/微信」</td></tr>
    <tr><td>極速(支付寶)</td><td>收款銀行含「支付宝/支付寶」或 出款商戶含「支付宝/支付寶」</td></tr>
    <tr><td>極速(微信)</td><td>收款銀行含「微信」或 出款商戶含「微信」</td></tr>
  </tbody>
</table>
<h4>判斷順序</h4>
<pre>
1. 若 收款銀行 含「支付宝/支付寶」→ 支付寶渠道
2. 若 收款銀行 含「微信」→ 微信渠道
3. 若 出款商戶 含「支付宝/支付寶」→ 支付寶渠道
4. 若 出款商戶 含「微信」→ 微信渠道
5. 其他 → 銀行卡渠道（預設）
</pre>

<h3>4.4 數據範圍</h3>
<pre>
商戶分類過濾：(銀行卡 + 支付寶 + 微信) + 線下
- 銀行卡：商戶含「极速充提3」且不含支付寶/微信
- 支付寶：商戶含「支付寶/支付宝」
- 微信：商戶含「微信」
- 線下：商戶含「线下/線下」且不含支付寶/微信/极速充提3
</pre>

<h3>4.5 提現成功條件</h3>
<pre>
(說明 = "轉帳完成/转账完成/转帐完成" OR 提現狀態含"提現完成/提现完成")
AND 實際轉出金額 ≠ 0（按訂單號去重）
</pre>

<h3>4.6 提現失敗條件</h3>
<pre>
說明 ≠ "轉帳完成/转账完成/转帐完成/提現完成/提现完成"
AND 實際轉出金額 = 空白或0
AND 提現狀態 ≠ "提現完成/提现完成"（按訂單號去重）
</pre>

<h3>4.7 提现总览</h3>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>提现成功笔数</strong></td><td>(說明=轉帳完成/转账完成 OR 提現狀態含提現完成) 且 實際轉出金額≠0（按訂單號去重）</td><td>符合提現成功條件的筆數</td></tr>
    <tr><td><strong>提现成功金额</strong></td><td>提現成功筆數的實際轉出金額加總（按訂單號去重）</td><td>成功筆數的金額加總</td></tr>
    <tr><td><strong>平均处理时间</strong></td><td>轉帳完成/转账完成 且 實際轉出金額≠0 的處理時間平均（按訂單號去重）</td><td>處理時間 = 通知時間 - 建立時間</td></tr>
    <tr><td><strong>总提现申请笔数</strong></td><td>提現成功筆數 + 提現失敗筆數（按訂單號去重）</td><td>去重後的總記錄數</td></tr>
  </tbody>
</table>

<h3>4.8 平均時間計算公式</h3>
<pre>
若「餘額池建立時間」為空：處理時間 = 通知商戶時間 - 建立時間
若「餘額池建立時間」有值：處理時間 = 通知商戶時間 - 餘額池建立時間

條件：說明 = "轉帳完成/转账完成/转帐完成"（即提現成功）
</pre>
<table>
  <thead>
    <tr><th>CSV 欄位</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>通知商戶時間 / 通知商户时间</td><td>系統通知商戶的時間點</td></tr>
    <tr><td>建立時間 / 建立时间</td><td>訂單建立時間</td></tr>
    <tr><td>餘額池建立時間</td><td>餘額池記錄建立時間（可能為空）</td></tr>
    <tr><td>說明</td><td>轉帳狀態（轉帳完成/转账完成/转帐完成）</td></tr>
  </tbody>
</table>

<h3>4.9 提现成功时间区段</h3>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>总提现申請笔数</strong></td><td>提現成功筆數 + 提現失敗筆數（按訂單號去重）</td><td>時間區段的基準值</td></tr>
    <tr><td><strong>提现成功笔数</strong></td><td>(說明=轉帳完成/转账完成 OR 提現狀態含提現完成) 且 實際轉出金額≠0（按訂單號去重）</td><td>同上</td></tr>
    <tr><td><strong>2分钟内出款</strong></td><td>處理時間 &lt; 120秒（按訂單號去重）</td><td>seconds &lt; 120</td></tr>
    <tr><td><strong>2-5分钟出款</strong></td><td>120秒 ≤ 處理時間 &lt; 300秒（按訂單號去重）</td><td>120 ≤ seconds &lt; 300</td></tr>
    <tr><td><strong>5-15分钟出款</strong></td><td>300秒 ≤ 處理時間 &lt; 900秒（按訂單號去重）</td><td>300 ≤ seconds &lt; 900</td></tr>
    <tr><td><strong>15-30分钟出款</strong></td><td>900秒 ≤ 處理時間 &lt; 1800秒（按訂單號去重）</td><td>900 ≤ seconds &lt; 1800</td></tr>
    <tr><td><strong>超过30分钟出款</strong></td><td>處理時間 ≥ 1800秒（按訂單號去重）</td><td>seconds ≥ 1800</td></tr>
    <tr><td><strong>平均处理时间-卡(Q)</strong></td><td>銀行卡渠道轉帳完成/转账完成的平均時間</td><td>銀行卡渠道專用</td></tr>
    <tr><td><strong>平均处理时间-宝(R)</strong></td><td>支付寶/支付宝渠道轉帳完成/转账完成的平均時間</td><td>支付寶渠道專用</td></tr>
    <tr><td><strong>提现成功率</strong></td><td>提現成功筆數 / 總記錄數 × 100%</td><td>基於原始記錄數</td></tr>
    <tr><td><strong>提现失败笔数</strong></td><td>說明≠轉帳完成/转账完成/提現完成/提现完成 且 實際轉出=空白或0 且 提現狀態≠提現完成/提现完成（按訂單號去重）</td><td>符合失敗條件</td></tr>
    <tr><td><strong>无卡空单率</strong></td><td>JS充值等待最終無配對 / 充值申請 × 100%</td><td>來自充值數據</td></tr>
    <tr><td><strong>订单成功（筆數/金額）</strong></td><td>銀行卡訂單成功 + 支付寶訂單成功（來自充值）</td><td>不含微信</td></tr>
    <tr><td><strong>订单成功占比</strong></td><td>訂單成功筆數 / 總充值成功筆數 × 100%</td><td>來自充值數據</td></tr>
  </tbody>
</table>

<h3>4.10 銀行卡渠道</h3>
<h4>數據範圍</h4>
<pre>商戶不含「支付寶/支付宝/微信」，申請金額 > 0</pre>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>提现申请</strong></td><td>商戶排除支付寶/支付宝/微信，申請金額 > 0 的筆數/出款金額</td><td>筆數和金額分開統計</td></tr>
    <tr><td><strong>充值配对率</strong></td><td>成功配對 / 充值申請 × 100%</td><td>來自充值數據</td></tr>
    <tr><td><strong>充值申请</strong></td><td>來自充值數據：极速银行卡申請筆數</td><td>銀行卡區塊的充值申請總筆數</td></tr>
    <tr><td><strong>成功配对</strong></td><td>來自充值數據：銀行卡代號有值的筆數</td><td>一般卡 + 極速提配對筆數</td></tr>
    <tr><td><strong>配对后成功率</strong></td><td>充值成功 / 成功配對 × 100%</td><td>訂單成功筆數 / 成功配對筆數</td></tr>
    <tr><td><strong>充值成功笔数</strong></td><td>來自充值數據：訂單成功筆數</td><td>一般卡 + 極速提訂單成功筆數</td></tr>
    <tr><td><strong>平均处理时间</strong></td><td>商戶排除支付寶/支付宝/微信 且 轉帳完成/转账完成 且 實際轉出金額≠0 的處理時間平均（按訂單號去重）</td><td>銀行卡渠道專用</td></tr>
  </tbody>
</table>

<h3>4.11 支付寶渠道</h3>
<h4>數據範圍</h4>
<pre>商戶含「支付寶」或「支付宝」，申請金額 > 0</pre>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>提现申请</strong></td><td>商戶含「支付寶/支付宝」，申請金額 > 0 的筆數/出款金額</td><td>筆數和金額分開統計</td></tr>
    <tr><td><strong>充值配对率</strong></td><td>成功配對 / 充值申請 × 100%</td><td>來自充值數據</td></tr>
    <tr><td><strong>充值申请</strong></td><td>來自充值數據：极速支付寶申請筆數</td><td>支付寶區塊的充值申請總筆數</td></tr>
    <tr><td><strong>成功配对</strong></td><td>來自充值數據：銀行卡代號有值的筆數</td><td>一般卡 + 一般寶 + 極速提配對筆數</td></tr>
    <tr><td><strong>配对后成功率</strong></td><td>充值成功 / 成功配對 × 100%</td><td>訂單成功筆數 / 成功配對筆數</td></tr>
    <tr><td><strong>充值成功笔数</strong></td><td>來自充值數據：訂單成功筆數</td><td>一般卡 + 一般寶 + 極速提訂單成功筆數</td></tr>
    <tr><td><strong>平均处理时间</strong></td><td>商戶含支付寶/支付宝 且 轉帳完成/转账完成 且 實際轉出金額≠0 的處理時間平均（按訂單號去重）</td><td>支付寶渠道專用</td></tr>
  </tbody>
</table>

<h3>4.12 微信渠道</h3>
<h4>數據範圍</h4>
<pre>商戶含「微信」，申請金額 > 0</pre>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>提现申请</strong></td><td>商戶含「微信」，申請金額 > 0 的筆數/出款金額</td><td>筆數和金額分開統計</td></tr>
    <tr><td><strong>充值配对率</strong></td><td>成功配對 / 充值申請 × 100%</td><td>來自充值數據</td></tr>
    <tr><td><strong>充值申请</strong></td><td>來自充值數據：极速微信申請筆數</td><td>微信區塊的充值申請總筆數</td></tr>
    <tr><td><strong>成功配对</strong></td><td>來自充值數據：銀行卡代號有值的筆數</td><td>一般卡 + 一般微 + 極速提配對筆數</td></tr>
    <tr><td><strong>配对后成功率</strong></td><td>充值成功 / 成功配對 × 100%</td><td>訂單成功筆數 / 成功配對筆數</td></tr>
    <tr><td><strong>充值成功笔数</strong></td><td>來自充值數據：訂單成功筆數</td><td>一般卡 + 一般微 + 極速提訂單成功筆數</td></tr>
    <tr><td><strong>平均处理时间</strong></td><td>商戶含微信 且 轉帳完成/转账完成 且 實際轉出金額≠0 的處理時間平均（按訂單號去重）</td><td>微信渠道專用</td></tr>
  </tbody>
</table>

<h3>4.13 提現欄位對照表</h3>
<table>
  <thead>
    <tr><th>CSV 欄位名稱</th><th>系統變數</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>訂單號 / 订单号</td><td><code>id</code></td><td>用於去重的唯一識別碼</td></tr>
    <tr><td>說明</td><td><code>transferStatus</code></td><td>轉帳狀態（轉帳完成/转账完成/转帐完成）</td></tr>
    <tr><td>實際轉出金額 / 实际转出金额</td><td><code>actualAmount</code></td><td>實際轉出的金額</td></tr>
    <tr><td>提現狀態 / 提现状态</td><td><code>status</code></td><td>提現狀態（提現完成/提现完成）</td></tr>
    <tr><td>申請金額 / 申请金额</td><td><code>requestAmount</code></td><td>申請提現金額</td></tr>
    <tr><td>出款金額 / 出款金额</td><td><code>payoutAmount</code></td><td>實際出款金額</td></tr>
    <tr><td>出款商戶 / 出款商户</td><td><code>merchant</code></td><td>商戶名稱，用於渠道分類</td></tr>
    <tr><td>建立時間 / 建立时间</td><td><code>createTime</code></td><td>訂單建立時間</td></tr>
    <tr><td>通知時間 / 通知时间</td><td><code>notifyTime</code></td><td>通知完成時間</td></tr>
    <tr><td>處理時間</td><td><code>avgTimeSeconds</code></td><td>通知時間 - 建立時間（秒）</td></tr>
  </tbody>
</table>

<h3>4.14 提現計算流程</h3>
<pre>
1. 商戶分類過濾
   - 過濾出銀行卡/支付寶/微信/線下商戶的記錄
   - 排除不屬於任何分類的記錄

2. 按訂單號去重
   - 同一訂單號保留最後一筆記錄
   - 確保統計不重複

3. 提現成功/失敗判斷
   - 成功：(說明=轉帳完成 OR 提現狀態含提現完成) 且 實際轉出金額≠0
   - 失敗：說明≠轉帳完成/提現完成 且 實際轉出金額=空白或0 且 提現狀態≠提現完成

4. 時間區段分類
   - 依處理時間（秒）分類到對應區段
   - 僅統計提現成功的記錄

5. 渠道統計
   - 依商戶名稱判斷渠道（銀行卡/支付寶/微信）
   - 各渠道獨立計算提現申請和平均時間

6. 從充值數據取得配對率相關數據
   - 充值申請、成功配對、訂單成功等來自 depositMetrics
</pre>

<hr>

<h2>五、日/周報數據匯總</h2>

<h3>5.1 功能概述</h3>
<p>日/周報數據匯總頁面整合充值和提現數據，提供關鍵業務指標的彙整報表，支援日期範圍篩選和 Excel 匯出功能。</p>

<h3>5.2 頁面結構</h3>
<pre>
日/周報數據匯總
├── 日期選擇器（起訖日期）
├── 週報重要指標
│   ├── 充值申請
│   ├── 充值配對
│   ├── 訂單成功（筆數）
│   ├── 訂單成功（金額）
│   ├── 騙分相關
│   └── 提現相關
├── 指標數據分析
│   ├── 充值數據（成功率/3分內占比/平均處理時間）
│   └── 提現數據（成功率/2分內占比/平均處理時間）
└── 匯出功能
</pre>

<h3>5.3 週報重要指標</h3>

<h4>5.3.1 充值申請</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>充值申請筆數</strong></td><td>銀行卡申請筆數 + 支付寶申請筆數</td></tr>
    <tr><td><strong>JS充值等待最終無配對</strong></td><td>銀行卡小計 + 支付寶小計</td></tr>
    <tr><td><strong>無卡空單率</strong></td><td>JS充值等待最終無配對 / 充值申請筆數 × 100%</td></tr>
  </tbody>
</table>

<h4>5.3.2 充值配對</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>充值配對(配一般卡)</strong></td><td>銀行卡一般卡 + 支付寶一般卡 + 一般寶</td></tr>
    <tr><td><strong>充值配對(配JS)</strong></td><td>銀行卡極速提 + 支付寶極速提(卡) + 極速提(寶)</td></tr>
    <tr><td><strong>充值配對總數</strong></td><td>配一般卡 + 配JS</td></tr>
    <tr><td><strong>充值配對率</strong></td><td>充值配對總數 / 充值申請筆數 × 100%</td></tr>
  </tbody>
</table>

<h4>5.3.3 訂單成功（筆數）</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>訂單成功(一般卡)</strong></td><td>銀行卡訂單成功一般卡 + 支付寶訂單成功一般卡 + 一般寶</td></tr>
    <tr><td><strong>訂單成功(Js+一般提)</strong></td><td>銀行卡極速提 + 支付寶極速提(卡) + 極速提(寶)</td></tr>
    <tr><td><strong>訂單成功(加總筆數)</strong></td><td>一般卡 + Js+一般提</td></tr>
    <tr><td><strong>配對後成功率</strong></td><td>訂單成功加總 / 充值配對總數 × 100%</td></tr>
  </tbody>
</table>

<h4>5.3.4 訂單成功（金額）</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>配一般卡充值訂單成功(金額)</strong></td><td>銀行卡訂單成功一般卡金額 + 支付寶訂單成功一般卡金額 + 一般寶金額</td></tr>
    <tr><td><strong>配極速充值訂單成功(金額)</strong></td><td>銀行卡訂單成功極速提金額 + 支付寶極速提(卡)金額 + 極速提(寶)金額</td></tr>
    <tr><td><strong>充值訂單成功(金額)總計</strong></td><td>配一般卡金額 + 配極速金額</td></tr>
  </tbody>
</table>

<h4>5.3.5 騙分相關</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>騙分金額</strong></td><td>銀行卡人工金額 + 銀行卡信評金額 + 支付寶人工金額 + 支付寶信評金額</td></tr>
    <tr><td><strong>騙分成本占比</strong></td><td>騙分金額 / 配極速充值訂單成功(金額) × 100%</td></tr>
    <tr><td><strong>JS提現返利</strong></td><td>提現記錄中的 merchantRebate（提現CSV第8欄H欄「商戶返利」）加總金額</td></tr>
  </tbody>
</table>

<h4>5.3.6 提現相關</h4>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>提現平均時間（卡）</strong></td><td>銀行卡渠道平均處理時間</td></tr>
    <tr><td><strong>提現平均時間（寶）</strong></td><td>支付寶渠道平均處理時間</td></tr>
    <tr><td><strong>提現失敗率</strong></td><td>提現失敗筆數 / 總申請筆數 × 100%</td></tr>
  </tbody>
</table>

<h3>5.4 指標數據分析</h3>

<h4>5.4.1 充值指標計算公式</h4>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>充值成功率</strong></td><td>到帳金額 > 0 的筆數 / 總申請筆數 × 100%</td></tr>
    <tr><td><strong>3分內占比</strong></td><td>處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%</td></tr>
    <tr><td><strong>平均處理時間</strong></td><td>到帳金額 > 0 的處理時間平均</td></tr>
  </tbody>
</table>

<h4>5.4.2 充值分類數據範圍</h4>
<table>
  <thead>
    <tr><th>分類</th><th>數據範圍</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>整體</strong></td><td>商戶只排除 test/qa</td></tr>
    <tr><td><strong>支付寶</strong></td><td>商戶含「支付寶/支付宝」且不含 test/qa/線下</td></tr>
    <tr><td><strong>微信</strong></td><td>商戶含「微信」且不含 test/qa/線下</td></tr>
    <tr><td><strong>金寶</strong></td><td>銀行卡代號 GB 開頭（排除 GB-Dahaomen），排除線下商戶</td></tr>
    <tr><td><strong>極速</strong></td><td>銀行卡代號 AUCTION 開頭，排除線下商戶</td></tr>
    <tr><td><strong>第三方</strong></td><td>銀行卡代號非 AUCTION/GB 開頭，或 GB-Dahaomen 開頭，排除線下商戶</td></tr>
    <tr><td><strong>非正向信評</strong></td><td>狀態以「信用」或「信评」或「信評」開頭</td></tr>
  </tbody>
</table>

<h4>5.4.3 提現指標計算公式</h4>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>提現成功條件</strong></td><td>(說明=轉帳完成/转账完成/转帐完成 OR 提現狀態含提現完成) 且 實際轉出金額≠0</td></tr>
    <tr><td><strong>提現成功率</strong></td><td>提現成功筆數 / 總申請筆數 × 100%</td></tr>
    <tr><td><strong>2分內占比</strong></td><td>處理時間 < 120秒的筆數 / 提現成功筆數 × 100%</td></tr>
    <tr><td><strong>平均處理時間</strong></td><td>提現成功的處理時間平均</td></tr>
  </tbody>
</table>

<h4>5.4.4 提現分類數據範圍</h4>
<p><strong>注意</strong>：所有提現分類均按訂單號去重</p>
<table>
  <thead>
    <tr><th>分類</th><th>數據範圍</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>整體</strong></td><td>(銀行卡 + 支付寶 + 微信) + 線下，按訂單號去重</td></tr>
    <tr><td><strong>支付寶</strong></td><td>merchant 含「支付寶/支付宝」，按訂單號去重</td></tr>
    <tr><td><strong>微信</strong></td><td>merchant 含「微信」，按訂單號去重</td></tr>
    <tr><td><strong>金寶</strong></td><td>payoutCardCode 以 GB 開頭（非 GB-Dahaomen），按訂單號去重</td></tr>
    <tr><td><strong>極速</strong></td><td>payoutCardCode 包含 AUCTION，按訂單號去重</td></tr>
    <tr><td><strong>第三方</strong></td><td>payoutCardCode 不為空且不包含 AUCTION，按訂單號去重</td></tr>
  </tbody>
</table>

<h4>5.4.5 提現欄位說明</h4>
<table>
  <thead>
    <tr><th>欄位代號</th><th>CSV位置</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>merchantRebate</strong></td><td>第8欄（H欄）</td><td>商戶返利金額，用於計算 JS提現返利</td></tr>
  </tbody>
</table>

<h3>5.5 匯出功能</h3>
<table>
  <thead>
    <tr><th>功能</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>匯出 Excel</strong></td><td>將週報數據匯出為 .xlsx 格式</td></tr>
    <tr><td><strong>匯出純文本</strong></td><td>匯出純文字格式報表</td></tr>
  </tbody>
</table>

<h4>5.5.1 導出純文本格式</h4>
<table>
  <thead>
    <tr><th>項目</th><th>格式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>百分比</strong></td><td>整數顯示，無小數點（如 <code>85%</code>）</td></tr>
    <tr><td><strong>三方代收</strong></td><td><code>名稱(卡代號)金額元筆數笔</code>，多個以 <code>/</code> 分隔</td></tr>
    <tr><td><strong>檔案名稱</strong></td><td><code>日周报数据汇总_日期範圍.txt</code></td></tr>
  </tbody>
</table>

<h4>5.5.2 導出 Excel 格式</h4>
<p><strong>工作表結構：</strong></p>
<table>
  <thead>
    <tr><th>工作表</th><th>內容</th></tr>
  </thead>
  <tbody>
    <tr><td>汇总周报数据</td><td>週報重要指標彙總</td></tr>
    <tr><td>总计 银行卡</td><td>銀行卡詳細數據</td></tr>
    <tr><td>总计 支付宝</td><td>支付寶詳細數據</td></tr>
    <tr><td>银行卡渠道</td><td>銀行卡渠道分析</td></tr>
    <tr><td>支付宝渠道</td><td>支付寶渠道分析</td></tr>
    <tr><td>微信渠道</td><td>微信渠道分析</td></tr>
  </tbody>
</table>

<p><strong>三方代收區塊格式：</strong></p>
<table>
  <thead>
    <tr><th>項目</th><th>格式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>標題行</strong></td><td><code>三方代收</code> + 總筆數 + 總金額</td></tr>
    <tr><td><strong>明細行</strong></td><td><code>  名稱(卡代號)</code> + 筆數 + 金額</td></tr>
    <tr><td><strong>資料來源</strong></td><td>動態讀取「報表三方設定」配置的卡代號</td></tr>
  </tbody>
</table>

<hr>

<h2>六、騙分統計</h2>

<h3>6.1 功能概述</h3>
<p>騙分統計頁面用於手動輸入每日騙分數據，記錄儲存於資料庫。日/周報會依日期範圍篩選這些記錄並加總計算。</p>

<h3>6.2 頁面結構</h3>
<pre>
騙分統計
├── 新增/編輯表單
│   ├── 日期選擇
│   ├── 渠道類型選擇（銀行卡/支付寶/微信）
│   └── 統一輸入欄位
├── 搜尋條件（起訖日期）
├── 資料表格（依渠道類型顯示）
└── 操作（編輯/刪除/匯出Excel）
</pre>

<h3>6.3 資料儲存</h3>
<table>
  <thead>
    <tr><th>項目</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>儲存方式</strong></td><td>資料庫</td></tr>
    <tr><td><strong>資料表</strong></td><td>騙分統計資料表</td></tr>
    <tr><td><strong>操作記錄</strong></td><td>資料庫操作日誌</td></tr>
  </tbody>
</table>

<h3>6.4 渠道類型</h3>
<table>
  <thead>
    <tr><th>渠道</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>銀行卡</strong></td><td>銀行卡渠道騙分數據</td></tr>
    <tr><td><strong>支付寶</strong></td><td>支付寶渠道騙分數據</td></tr>
    <tr><td><strong>微信</strong></td><td>微信渠道騙分數據</td></tr>
  </tbody>
</table>

<h3>6.5 統一輸入欄位</h3>
<p>每筆記錄包含日期、渠道類型及以下欄位：</p>
<table>
  <thead>
    <tr><th>欄位</th><th>變數名稱</th><th>類型</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>騙分拉黑</strong></td><td>fraudBlacklistCount</td><td>整數</td><td>騙分拉黑筆數</td></tr>
    <tr><td><strong>卡驗及人驗</strong></td><td>cardVerifyCount</td><td>整數</td><td>卡驗及人驗筆數</td></tr>
    <tr><td><strong>人工筆數</strong></td><td>manualCount</td><td>整數</td><td>騙分沒到帳來找的人工筆數</td></tr>
    <tr><td><strong>人工金額</strong></td><td>manualAmount</td><td>數值</td><td>騙分沒到帳來找的人工金額</td></tr>
    <tr><td><strong>信評筆數</strong></td><td>creditCount</td><td>整數</td><td>信評筆數</td></tr>
    <tr><td><strong>信評金額</strong></td><td>creditAmount</td><td>數值</td><td>信評金額</td></tr>
    <tr><td><strong>未收到款</strong></td><td>noReceiptCount</td><td>整數</td><td>沒上傳回單重複出款充值上分的筆數</td></tr>
    <tr><td><strong>備註</strong></td><td>remark</td><td>文字</td><td>備註說明</td></tr>
  </tbody>
</table>

<h3>6.6 資料驗證規則</h3>
<table>
  <thead>
    <tr><th>規則</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>日期必填</strong></td><td>必須選擇資料日期</td></tr>
    <tr><td><strong>數值檢查</strong></td><td>所有數值欄位不能全為 0</td></tr>
    <tr><td><strong>自動轉換</strong></td><td>空值自動轉換為 0</td></tr>
  </tbody>
</table>

<h3>6.7 與其他模組的關聯</h3>
<table>
  <thead>
    <tr><th>引用位置</th><th>用途</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>日/周報 - 騙分相關</strong></td><td>依日期範圍篩選後加總，計算騙分金額和騙分成本占比</td></tr>
    <tr><td><strong>銀行卡區塊 - 騙分沒到帳來找</strong></td><td>顯示銀行卡渠道的人工/信評數據</td></tr>
    <tr><td><strong>支付寶區塊 - 騙分沒到帳來找</strong></td><td>顯示支付寶渠道的人工/信評數據</td></tr>
    <tr><td><strong>微信區塊 - 騙分沒到帳來找</strong></td><td>顯示微信渠道的人工/信評數據</td></tr>
  </tbody>
</table>

<hr>

<h2>七、報表三方設定</h2>

<h3>7.1 功能概述</h3>
<p>報表三方設定頁面用於配置三方代收銀行卡的代碼對應，系統會依據這些設定動態顯示三方代收數據。設定儲存於資料庫，可進行新增、編輯、刪除操作。</p>

<h3>7.2 頁面結構</h3>
<pre>
報表三方設定
├── 新增/編輯表單
│   ├── 卡代號輸入
│   └── 中文名稱輸入
└── 設定列表
    ├── 序號
    ├── 卡代號
    ├── 中文名稱
    └── 操作（編輯/刪除）
</pre>

<h3>7.3 資料儲存</h3>
<table>
  <thead>
    <tr><th>項目</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>儲存方式</strong></td><td>資料庫</td></tr>
    <tr><td><strong>資料格式</strong></td><td><code>[{id, cardNumber, name, createdAt}]</code></td></tr>
  </tbody>
</table>

<h3>7.4 預設三方代收卡</h3>
<table>
  <thead>
    <tr><th>中文名稱</th><th>卡代號</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>大豪門</strong></td><td>GB-DahaomenJFB2025</td><td>大豪門三方代收</td></tr>
    <tr><td><strong>匯通</strong></td><td>HTc2cdeposit</td><td>匯通三方代收</td></tr>
    <tr><td><strong>豆豆</strong></td><td>DDFdeposit</td><td>豆豆三方代收</td></tr>
    <tr><td><strong>UC聚合</strong></td><td>UC1020</td><td>UC聚合三方代收</td></tr>
  </tbody>
</table>

<h3>7.5 操作功能</h3>
<table>
  <thead>
    <tr><th>功能</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>新增</strong></td><td>輸入卡代號和中文名稱後新增</td></tr>
    <tr><td><strong>編輯</strong></td><td>修改既有設定的卡代號或中文名稱</td></tr>
    <tr><td><strong>刪除</strong></td><td>移除指定的三方代收設定</td></tr>
  </tbody>
</table>

<h3>7.6 資料驗證規則</h3>
<table>
  <thead>
    <tr><th>規則</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>卡代號必填</strong></td><td>不可為空</td></tr>
    <tr><td><strong>中文名稱必填</strong></td><td>不可為空</td></tr>
    <tr><td><strong>唯一性檢查</strong></td><td>卡代號不可重複</td></tr>
  </tbody>
</table>

<h3>7.7 與其他模組的關聯</h3>
<table>
  <thead>
    <tr><th>引用位置</th><th>用途</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>日/周報 Excel 匯出</strong></td><td>動態讀取三方代收設定，依卡代號分組顯示數據</td></tr>
    <tr><td><strong>銀行卡區塊 - 三方代收</strong></td><td>依據設定的卡代號識別三方代收記錄</td></tr>
    <tr><td><strong>支付寶區塊 - 三方代收</strong></td><td>依據設定的卡代號識別三方代收記錄</td></tr>
    <tr><td><strong>微信區塊 - 三方代收</strong></td><td>依據設定的卡代號識別三方代收記錄</td></tr>
  </tbody>
</table>

<h3>7.8 分頁與排序功能</h3>
<h4>分頁功能</h4>
<table>
  <thead>
    <tr><th>功能</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>每頁筆數</strong></td><td>可選擇 10 / 50 / 100 筆</td></tr>
    <tr><td><strong>頁碼導航</strong></td><td>顯示當前頁碼與總頁數</td></tr>
    <tr><td><strong>資料統計</strong></td><td>顯示「第 X 至 Y 項結果，共 Z 項」</td></tr>
  </tbody>
</table>
<h4>排序功能</h4>
<table>
  <thead>
    <tr><th>欄位</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>序號</strong></td><td>支援升序/降序排序</td></tr>
    <tr><td><strong>卡代號</strong></td><td>支援升序/降序排序</td></tr>
    <tr><td><strong>中文名稱</strong></td><td>支援升序/降序排序</td></tr>
    <tr><td><strong>建立時間</strong></td><td>支援升序/降序排序</td></tr>
  </tbody>
</table>

<hr>

<h2>八、欄位對照表</h2>

<h3>8.1 充值數據 CSV 欄位</h3>
<table>
  <thead>
    <tr><th>CSV 欄位名稱</th><th>系統變數</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>到帳金額 / 到账金额</td><td>receivedAmount</td><td>實際到帳金額</td></tr>
    <tr><td>銀行卡編碼 / 银行卡编码</td><td>bankCardCode</td><td>銀行卡代號</td></tr>
    <tr><td>銀行名稱 / 银行名称</td><td>bankName</td><td>銀行名稱</td></tr>
    <tr><td>收款商戶 / 收款商户</td><td>merchant</td><td>商戶名稱</td></tr>
    <tr><td>狀態 / 状态</td><td>status</td><td>訂單狀態</td></tr>
    <tr><td>充值金額 / 充值金额</td><td>amount</td><td>申請充值金額</td></tr>
    <tr><td>建立時間 / 建立时间</td><td>createTime</td><td>訂單建立時間</td></tr>
    <tr><td>通知時間 / 通知时间</td><td>notifyTime</td><td>通知完成時間</td></tr>
    <tr><td>用戶等級 / 用户等级</td><td>userLevel</td><td>用戶信用等級</td></tr>
  </tbody>
</table>

<h3>8.2 提現數據 CSV 欄位</h3>
<table>
  <thead>
    <tr><th>CSV 欄位名稱</th><th>系統變數</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>收款銀行 / 收款银行</td><td>receivingBank</td><td>收款銀行名稱</td></tr>
    <tr><td>收款卡號 / 收款卡号</td><td>receivingCardNo</td><td>收款卡號</td></tr>
    <tr><td>收款姓名</td><td>receivingName</td><td>收款人姓名</td></tr>
    <tr><td>出款商戶 / 出款商户</td><td>payoutMerchant</td><td>出款商戶名稱</td></tr>
    <tr><td>出款卡編碼 / 出款卡编码</td><td>payoutCardCode</td><td>出款卡代號</td></tr>
  </tbody>
</table>

<h3>8.3 銀行卡代號分類</h3>
<table>
  <thead>
    <tr><th>代碼前綴</th><th>分類</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>AUCTION_PAYMENT_CARD</td><td>c2c / 極速提</td><td>極速提卡/提寶</td></tr>
    <tr><td>gb-*（非三方代收）</td><td>一般卡 / 金寶</td><td>一般銀行卡</td></tr>
    <tr><td>auction-*</td><td>極速</td><td>極速充提</td></tr>
    <tr><td colspan="3"><strong>三方代收（動態配置，來源：報表三方設定）</strong></td></tr>
    <tr><td>GB-DahaomenJFB2025</td><td>大豪門</td><td>預設三方代收</td></tr>
    <tr><td>HTc2cdeposit</td><td>匯通</td><td>預設三方代收</td></tr>
    <tr><td>DDFdeposit</td><td>豆豆</td><td>預設三方代收</td></tr>
    <tr><td>UC1020</td><td>UC聚合</td><td>預設三方代收</td></tr>
  </tbody>
</table>

<h3>8.4 狀態關鍵字</h3>
<table>
  <thead>
    <tr><th>狀態關鍵字</th><th>用途</th></tr>
  </thead>
  <tbody>
    <tr><td><code>用户确认到帐</code> / <code>用戶確認到帳</code></td><td>c2c 點確認判斷</td></tr>
    <tr><td><code>商户确认到帐</code> / <code>商戶確認到帳</code></td><td>超過11min補件後成功判斷</td></tr>
    <tr><td><code>银商确认到账</code> / <code>銀商確認到帳</code></td><td>微信平均時間計算</td></tr>
    <tr><td><code>金額補單</code> / <code>金额补单</code></td><td>人工審核判斷</td></tr>
    <tr><td><code>明细补单</code> / <code>明細補單</code></td><td>微信平均時間計算</td></tr>
    <tr><td><code>信用評分上分</code> / <code>信用评分上分</code></td><td>信評上分判斷</td></tr>
    <tr><td><code>信用評分上分(圖文覆核)</code></td><td>信評含圖文複核</td></tr>
    <tr><td><code>未充值</code></td><td>無效申請判斷</td></tr>
    <tr><td><code>審核中(已超時)</code> / <code>审核中(已超时)</code></td><td>超時判斷</td></tr>
    <tr><td><code>圖文複核(已超時)</code> / <code>图文复核(已超时)</code></td><td>圖文複核超時</td></tr>
    <tr><td><code>補</code> / <code>补</code></td><td>掉單判斷</td></tr>
  </tbody>
</table>

<hr>

<h2>九、UI/UX 設計規範</h2>

<h3>9.1 色彩規範</h3>
<table>
  <thead>
    <tr><th>元素</th><th>顏色</th></tr>
  </thead>
  <tbody>
    <tr><td>主色調（Header/按鈕）</td><td>#0a84ff（藍色）</td></tr>
    <tr><td>成功/表頭</td><td>#30d158（綠色）</td></tr>
    <tr><td>背景</td><td>#1a1a2e（深藍）</td></tr>
    <tr><td>卡片背景</td><td>#16213e（深藍灰）</td></tr>
    <tr><td>警告</td><td>#ff9f0a（橙色）</td></tr>
    <tr><td>錯誤</td><td>#ff453a（紅色）</td></tr>
    <tr><td>文字</td><td>#e0e0e0（淺灰）</td></tr>
  </tbody>
</table>

<h3>9.2 響應式設計</h3>
<table>
  <thead>
    <tr><th>斷點</th><th>佈局調整</th></tr>
  </thead>
  <tbody>
    <tr><td>&gt; 1200px</td><td>6列網格</td></tr>
    <tr><td>768px - 1200px</td><td>2-3列網格，側邊欄收縮</td></tr>
    <tr><td>&lt; 768px</td><td>單列網格，側邊欄僅顯示圖標</td></tr>
  </tbody>
</table>

<h3>9.3 交互設計</h3>
<ul>
  <li>區塊可展開/收合</li>
  <li>商戶下拉支持搜索</li>
  <li>Hover 時顯示詳細 Tooltip</li>
  <li>數據載入顯示進度條</li>
  <li>每個指標下方顯示計算公式說明（驗證版）</li>
</ul>

<h4>9.3.1 版本差異（主版本 vs 驗證版）</h4>
<table>
  <thead>
    <tr><th>功能</th><th>主版本 (5173)</th><th>驗證版 (5178)</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>公式說明</strong></td><td>隱藏</td><td>顯示</td></tr>
    <tr><td><strong>計算值欄位</strong></td><td>隱藏</td><td>顯示</td></tr>
  </tbody>
</table>

<h4>9.3.2 區塊佈局</h4>
<table>
  <thead>
    <tr><th>頁面</th><th>佈局方式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>銀行卡</strong></td><td>c2c + 三方代收 並排；骗分 + 商業平台 並排</td></tr>
    <tr><td><strong>支付寶</strong></td><td>c2c + 三方代收 並排；骗分 + 寶轉卡渠道 並排</td></tr>
    <tr><td><strong>微信</strong></td><td>c2c + 三方代收 並排；骗分 獨立（佔50%寬度）</td></tr>
  </tbody>
</table>

<h4>9.3.3 提現分析區塊</h4>
<table>
  <thead>
    <tr><th>功能</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>可收合區塊</strong></td><td>銀行卡/支付寶/微信渠道區塊可點擊標題收合</td></tr>
    <tr><td><strong>表格格式</strong></td><td>3欄：項目、筆數/百分比、金額</td></tr>
    <tr><td><strong>提现成功率筆數</strong></td><td>橘色顯示 (#ff9500)</td></tr>
  </tbody>
</table>

<h3>9.4 24小時交易分布圖表</h3>
<table>
  <thead>
    <tr><th>元素</th><th>樣式</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>X 軸</strong></td><td>時間（0-23 小時）</td></tr>
    <tr><td><strong>左 Y 軸</strong></td><td>金額（柱狀 + 折線）</td></tr>
    <tr><td><strong>右 Y 軸</strong></td><td>筆數（柱狀）</td></tr>
    <tr><td><strong>金額柱狀</strong></td><td>綠色漸層 <code>#4ecdc4</code> → <code>#44a08d</code></td></tr>
    <tr><td><strong>筆數柱狀</strong></td><td>紫色漸層 <code>#667eea</code> → <code>#764ba2</code></td></tr>
    <tr><td><strong>金額折線</strong></td><td>橘色 <code>#ff9500</code>，線寬 1.5px</td></tr>
    <tr><td><strong>折線圓點</strong></td><td>實心橘色 <code>#ff9500</code>，半徑 1.5px</td></tr>
    <tr><td><strong>背景網格</strong></td><td>水平虛線 <code>#e0e0e0</code></td></tr>
    <tr><td><strong>圖例位置</strong></td><td>圖表下方</td></tr>
  </tbody>
</table>

<hr>

<h2>十、版本記錄</h2>
<table>
  <thead>
    <tr><th>版本</th><th>日期</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>v1.9.9</td><td>2026-02-11</td><td>提現渠道切換新增判斷順序說明（4.3節）；同步 CRITERIA.md 內容</td></tr>
    <tr><td>v1.9.8</td><td>2026-02-11</td><td>新增術語定義（2.7節）；平均時間公式改用 CSV 欄位名稱（4.8節）；移除渠道統計的程式變數名稱（4.10-4.12節）</td></tr>
    <tr><td>v1.9.7</td><td>2026-02-11</td><td>提現渠道切換說明改用實際條件（收款銀行/出款商戶）取代 remark 變數</td></tr>
    <tr><td>v1.9.6</td><td>2026-02-11</td><td>修正 csvParser.js 商業平台邏輯：改為「外部商戶開頭」匹配（符合準則 3.9 節）</td></tr>
    <tr><td>v1.9.5</td><td>2026-02-11</td><td>騙分統計資料儲存位置改為資料庫（6.1、6.3節）</td></tr>
    <tr><td>v1.9.4</td><td>2026-02-11</td><td>補充 merchantRebate 欄位說明（5.3.5、5.4.5）：提現CSV第8欄H欄「商戶返利」，用於計算 JS提現返利</td></tr>
    <tr><td>v1.9.3</td><td>2026-02-11</td><td>補充提現分析報表完整內容（4.3-4.13）：數據範圍、提現成功/失敗條件、提现总览、平均時間、时间区段、渠道詳細公式、欄位對照表、計算流程；更新提現失敗條件含「說明≠提現完成/提现完成」</td></tr>
    <tr><td>v1.9.2</td><td>2026-02-11</td><td>商業平台數據範圍修正為「外部商戶開頭」（3.6.8節），與 CRITERIA 同步</td></tr>
    <tr><td>v1.9.1</td><td>2026-02-11</td><td>補充微信區塊完整公式（3.8.2-3.8.7：成功配對、訂單成功、沒信評降等配卡、c2c區塊、三方代收區塊、騙分沒到帳來找）；補充欄位對照表（8.2提現數據CSV欄位、8.4狀態關鍵字）</td></tr>
    <tr><td>v1.9.0</td><td>2026-02-11</td><td>重組章節架構：銀行卡/支付寶/微信區塊計算準則合併為充值分析報表（第三章）的子章節（3.6-3.8）；新增充值成功時間區段（3.5節）；新增提現成功時間區段（4.2節）；新增報表三方設定分頁/排序功能（7.8節）；章節重新編號（共10章）</td></tr>
    <tr><td>v1.0.0</td><td>2026-02-04</td><td>初版：新增 c2c 與三方代收區塊計算準則</td></tr>
    <tr><td>v1.1.0</td><td>2026-02-04</td><td>完整版：新增所有區塊計算準則（充值申請、訂單成功、沒信評降等、商業平台、寶轉卡/寶轉寶等）</td></tr>
    <tr><td>v1.2.0</td><td>2026-02-04</td><td>新增資料清洗規則（簡繁體處理、狀態正規化、排除條件、欄位對應）</td></tr>
    <tr><td>v1.3.0</td><td>2026-02-05</td><td>新增日週報數據匯總（充值/提現指標定義、計算公式、分類篩選條件、筆數計算表格欄位）</td></tr>
    <tr><td>v1.4.0</td><td>2026-02-05</td><td>新增充值分析報表、提現分析報表、騙分統計完整說明</td></tr>
    <tr><td>v1.5.0</td><td>2026-02-06</td><td>新增充值/提現分析報表各分頁資料範圍說明、日/週報數據來源說明</td></tr>
    <tr><td>v1.5.1</td><td>2026-02-06</td><td>修正「全部」分頁資料範圍：計入所有商戶（包含外部商戶），僅排除 test/qa</td></tr>
    <tr><td>v1.5.2</td><td>2026-02-06</td><td>完善各分頁資料範圍說明：全部(排除test/qa)、銀行卡(排除test/qa/線下)、支付寶(只計算支付寶商戶)、微信(只計算微信商戶)</td></tr>
    <tr><td>v1.5.3</td><td>2026-02-06</td><td>修正總申請筆數公式：商戶只排除 test/qa 的筆數加總</td></tr>
    <tr><td>v1.5.4</td><td>2026-02-06</td><td>修正充值成功時間區段邊界：2分鐘內(≤120)、2-3分鐘(121≤t≤180)、3-5分鐘(181≤t≤300) 等</td></tr>
    <tr><td>v1.5.5</td><td>2026-02-06</td><td>移除「處理時間分布」區塊，新增「24小時交易分布」圖表顯示每小時充值成功筆數與金額</td></tr>
    <tr><td>v1.6.0</td><td>2026-02-06</td><td>新增日週報區塊（第八章）：週報重要指標、指標數據分析、騙分統計欄位完整公式</td></tr>
    <tr><td>v1.7.0</td><td>2026-02-06</td><td>新增騙分統計完整欄位定義、資料驗證規則、與其他模組關聯</td></tr>
    <tr><td>v1.7.1</td><td>2026-02-06</td><td>簡化取無卡06提示公式說明，移除極速06統計表引用</td></tr>
    <tr><td>v1.7.2</td><td>2026-02-06</td><td>修正銀行名稱簡繁體支援：支付宝/支付寶、支付宝(企)/支付寶(企)</td></tr>
    <tr><td>v1.7.3</td><td>2026-02-06</td><td>修正 CSV 欄位映射：transferStatus 從 matches[28] 改為 matches[29]</td></tr>
    <tr><td>v1.7.4</td><td>2026-02-06</td><td>提現成功判斷嚴格遵循準則：移除 status fallback，僅依據「說明=轉帳完成 AND 實際轉出金額≠0」</td></tr>
    <tr><td>v1.7.5</td><td>2026-02-06</td><td>移除取无卡06提示硬編碼：移除日期判斷邏輯，統一設為 0（待提供极速06统计表數據）</td></tr>
    <tr><td>v1.7.6</td><td>2026-02-06</td><td>5173 日週報指标数据分析移除「計算值」欄位，5178 保留顯示</td></tr>
    <tr><td>v1.8.0</td><td>2026-02-09</td><td>新增日/周報數據匯總、騙分統計完整文件，補上本地端及外部預覽網址</td></tr>
    <tr><td>v1.8.1</td><td>2026-02-10</td><td>新增 24小時交易分布圖表樣式：折線橘色實心圓點、圖例移至下方；完善匯出功能格式</td></tr>
    <tr><td>v1.8.2</td><td>2026-02-10</td><td>新增 showFormula 屬性控制公式說明顯示；充值分析區塊佈局調整（c2c+三方代收並排）；提現分析區塊可收合、表格3欄格式、提现成功率筆數橘色；選單調整</td></tr>
    <tr><td>v1.8.5</td><td>2026-02-10</td><td>修正 csvParser.js 商業平台計算邏輯：精確匹配 CNX交易所/外部商戶_500彩</td></tr>
    <tr><td>v1.8.4</td><td>2026-02-10</td><td>同步驗證版 PRD 與 CRITERIA.md：騙分統計統一表單、商業平台數據範圍修正</td></tr>
    <tr><td>v1.8.3</td><td>2026-02-10</td><td>新增報表三方設定章節；騙分統計改為統一表單+渠道類型選擇；三方代收區塊改為動態配置；修正預設卡代號</td></tr>
  </tbody>
</table>
`)

// 根據版本動態組合內容
const prdHtml = computed(() => {
  if (props.isVerifyVersion) {
    // 驗證版：在 6.7 與其他模組的關聯後插入 6.8 筆數計算表格欄位
    return prdHtmlBase.value.replace(
      '<hr>\n\n<h2>八、欄位對照表</h2>',
      verifyOnlySection + '<hr>\n\n<h2>八、欄位對照表</h2>'
    )
  }
  return prdHtmlBase.value
})
</script>

<style scoped>
.prd-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  background: #1a1a2e;
  min-height: 100vh;
  color: #e0e0e0;
}

.prd-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 2px solid #0a84ff;
}

.prd-header h1 {
  margin: 0;
  font-size: 28px;
  color: #ffffff;
}

.prd-meta {
  display: flex;
  gap: 16px;
}

.prd-meta .version {
  background: #0a84ff;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: 600;
}

.prd-meta .date {
  color: #888;
  line-height: 28px;
}

.prd-links {
  background: #16213e;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 24px;
  border-left: 4px solid #0a84ff;
}

.prd-links .link-item {
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.prd-links .link-label {
  color: #888;
  min-width: 120px;
}

.prd-links a {
  color: #0a84ff;
  text-decoration: none;
  word-break: break-all;
}

.prd-links a:hover {
  text-decoration: underline;
  color: #30d158;
}

.prd-content :deep(h2) {
  color: #0a84ff;
  font-size: 22px;
  margin-top: 32px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.prd-content :deep(h3) {
  color: #30d158;
  font-size: 18px;
  margin-top: 24px;
  margin-bottom: 12px;
}

.prd-content :deep(h4) {
  color: #ff9f0a;
  font-size: 16px;
  margin-top: 20px;
  margin-bottom: 10px;
}

.prd-content :deep(p) {
  line-height: 1.8;
  margin-bottom: 12px;
  color: #ccc;
}

.prd-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  background: #16213e;
  border-radius: 8px;
  overflow: hidden;
}

.prd-content :deep(th) {
  background: #0f3460;
  color: #fff;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  border: 1px solid #1a1a2e;
}

.prd-content :deep(td) {
  padding: 10px 12px;
  border: 1px solid #1a1a2e;
  color: #ddd;
  vertical-align: top;
}

.prd-content :deep(tr:hover td) {
  background: #1f4068;
}

.prd-content :deep(code) {
  background: #0f3460;
  color: #ff9f0a;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.prd-content :deep(pre) {
  background: #0f3460;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e0e0e0;
  border-left: 4px solid #0a84ff;
}

.prd-content :deep(ul),
.prd-content :deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.prd-content :deep(li) {
  margin: 8px 0;
  line-height: 1.6;
  color: #ccc;
}

.prd-content :deep(hr) {
  border: none;
  border-top: 1px solid #333;
  margin: 32px 0;
}

.prd-content :deep(strong) {
  color: #fff;
}
</style>
