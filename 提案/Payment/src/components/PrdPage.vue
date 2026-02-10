<template>
  <div class="prd-page">
    <div class="prd-header">
      <h1>Payment 驗證版 數據分析 PRD</h1>
      <div class="prd-meta">
        <span class="version">v1.8.3</span>
        <span class="date">2026-02-10</span>
      </div>
    </div>

    <div class="prd-links">
      <div class="link-item">
        <span class="link-label">本地端網址：</span>
        <a href="http://localhost:5173" target="_blank">http://localhost:5173</a>
      </div>
      <div class="link-item">
        <span class="link-label">外部預覽網址：</span>
        <a href="https://telecharger-enclosure-finish-presently.trycloudflare.com" target="_blank">https://telecharger-enclosure-finish-presently.trycloudflare.com</a>
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

// 驗證版專用章節（8.7 筆數計算表格欄位）
const verifyOnlySection = `
<h3>8.7 筆數計算表格欄位（驗證版專用）</h3>
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

<h3>1.2 資料清洗規則</h3>

<h4>1.2.1 簡繁體字符處理</h4>
<p>系統同時支援簡體與繁體中文資料，篩選條件包含兩種字符集：</p>
<table>
  <thead>
    <tr><th>簡體</th><th>繁體</th><th>用途</th></tr>
  </thead>
  <tbody>
    <tr><td>用户确认到帐</td><td>用戶確認到帳</td><td>c2c 點確認判斷</td></tr>
    <tr><td>商户确认到帐</td><td>商戶確認到帳</td><td>商戶確認判斷</td></tr>
    <tr><td>银商确认到账</td><td>銀商確認到帳</td><td>銀商確認判斷</td></tr>
    <tr><td>金额补单</td><td>金額補單</td><td>補單判斷</td></tr>
    <tr><td>图文复核(已超时)</td><td>圖文複核(已超時)</td><td>超時判斷</td></tr>
    <tr><td>审核中(已超时)</td><td>審核中(已超時)</td><td>超時判斷</td></tr>
    <tr><td>明细补单</td><td>明細補單</td><td>明細補單判斷</td></tr>
    <tr><td>补</td><td>補</td><td>掉單關鍵字</td></tr>
  </tbody>
</table>

<h4>1.2.2 狀態正規化（normalizeStatus）</h4>
<p>系統將原始狀態字符串正規化為統一格式：</p>
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

<h4>1.2.3 排除條件</h4>
<p>CSV 導入時自動排除：</p>
<ul>
  <li>商戶包含 <code>test</code>（不區分大小寫）</li>
  <li>商戶包含 <code>qa</code>（不區分大小寫）</li>
</ul>
<p>各分頁額外排除條件（詳見 1.2.6）：</p>
<ul>
  <li><strong>全部分頁</strong>：不額外排除線下商戶</li>
  <li><strong>銀行卡/支付寶/微信分頁</strong>：額外排除含「線下」或「线下」的商戶</li>
</ul>

<h4>1.2.4 欄位名稱對應</h4>
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

<h4>1.2.5 處理時間計算</h4>
<pre>
處理時間（秒）= 通知時間 - 建立時間
平均處理時間 = Σ(處理時間) / 有效記錄數
</pre>

<h4>1.2.6 充值/提現分析報表 資料範圍</h4>
<p>各分頁標籤的資料篩選範圍如下：</p>
<table>
  <thead>
    <tr><th>分頁</th><th>資料範圍</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>全部</strong></td>
      <td>排除 <code>test</code>、<code>qa</code></td>
      <td>計入所有商戶（包含線下、外部商戶等），僅排除 test/qa</td>
    </tr>
    <tr>
      <td><strong>極速（銀行卡）</strong></td>
      <td>排除 <code>test</code>、<code>qa</code>、<code>線下</code>/<code>线下</code></td>
      <td>銀行卡相關商戶，排除線下</td>
    </tr>
    <tr>
      <td><strong>極速（支付寶）</strong></td>
      <td>只計算支付寶商戶</td>
      <td>商戶名稱包含「支付宝」或「支付寶」</td>
    </tr>
    <tr>
      <td><strong>極速（微信）</strong></td>
      <td>只計算微信商戶</td>
      <td>商戶名稱包含「微信」</td>
    </tr>
  </tbody>
</table>

<h4>1.2.7 日/週報數據匯總 資料來源</h4>
<p>日/週報數據匯總的計算來源：</p>
<pre>
日/週報數據 = 充值/提現分析數據 + 騙分統計 加總計算
</pre>
<p>具體包含：</p>
<ul>
  <li><strong>充值指標</strong>：來自充值分析報表的各分類數據</li>
  <li><strong>提現指標</strong>：來自提現分析報表的各分類數據</li>
  <li><strong>騙分數據</strong>：來自騙分統計的匯總數據</li>
</ul>

<hr>

<h2>二、銀行卡區塊計算準則</h2>

<h3>2.1 充值申請筆數</h3>
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

<h3>2.2 成功配對</h3>
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

<h3>2.3 訂單成功</h3>
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

<h3>2.4 沒信評降等配卡</h3>
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

<h3>2.5 c2c 區塊</h3>
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

<h3>2.6 三方代收區塊</h3>
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
      <td>報表三方設定（localStorage: <code>thirdPartyBankCards</code>）</td>
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

<h3>2.7 騙分沒到帳來找</h3>
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

<h3>2.8 商業平台</h3>
<table>
  <thead>
    <tr><th>項目</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>數據範圍</strong></td>
      <td>商戶 = CNX交易所 或 外部商戶_500彩</td>
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

<h2>三、支付寶區塊計算準則</h2>

<h3>3.1 充值申請筆數</h3>
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

<h3>3.2 訂單成功</h3>
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

<h3>3.3 c2c 區塊</h3>
<p>（與銀行卡區塊相同公式）</p>

<h3>3.4 三方代收區塊</h3>
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
      <td>報表三方設定（參見第九章）</td>
    </tr>
    <tr>
      <td><strong>識別方式</strong></td>
      <td>銀行卡代號以設定的卡代號開頭（不區分大小寫）</td>
    </tr>
  </tbody>
</table>

<h3>3.5 寶轉卡渠道及寶轉寶渠道</h3>
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

<hr>

<h2>四、微信區塊計算準則</h2>

<h3>4.1 充值申請筆數</h3>
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
      <td><strong>其他欄位</strong></td>
      <td>（與支付寶區塊相同結構）</td>
    </tr>
  </tbody>
</table>

<h3>4.2 c2c 區塊</h3>
<p>（與銀行卡區塊相同公式）</p>

<h3>4.3 三方代收區塊</h3>
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
      <td>報表三方設定（參見第九章）</td>
    </tr>
    <tr>
      <td><strong>識別方式</strong></td>
      <td>銀行卡代號以設定的卡代號開頭（不區分大小寫）</td>
    </tr>
  </tbody>
</table>

<hr>

<h2>五、充值分析報表</h2>

<h3>5.1 重要訊息</h3>
<p><strong>資料範圍：</strong>商戶只排除 test/qa</p>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>總申請筆數</strong></td>
      <td>商戶只排除 test/qa 的筆數加總</td>
    </tr>
    <tr>
      <td><strong>成功率</strong></td>
      <td>到帳金額 ≠ 0 的筆數 ÷ 總申請筆數 × 100%</td>
    </tr>
    <tr>
      <td><strong>總充值成功（含掉單）</strong></td>
      <td>到帳金額 > 0 的筆數</td>
    </tr>
    <tr>
      <td><strong>總充值金額</strong></td>
      <td>到帳金額 > 0 的筆數的到帳金額加總</td>
    </tr>
    <tr>
      <td><strong>平均處理時間</strong></td>
      <td>到帳金額 > 0 的筆數，（通知時間 - 建立時間）的平均時間</td>
    </tr>
    <tr>
      <td><strong>無效申請</strong></td>
      <td>狀態含「取消」或 到帳金額 = 0 的筆數加總</td>
    </tr>
    <tr>
      <td><strong>掉單筆數</strong></td>
      <td>到帳金額 > 0 且狀態含「補」的筆數加總</td>
    </tr>
  </tbody>
</table>

<h3>5.2 充值成功時間區段</h3>
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

<h3>5.3 各渠道分頁</h3>
<p>系統支援四個分頁切換：全部、極速(銀行卡)、極速(支付寶)、極速(微信)</p>
<p>各渠道頁面包含：充值申請筆數、成功配對、訂單成功、c2c區塊、三方代收區塊、騙分統計等</p>

<hr>

<h2>六、提現分析報表</h2>

<h3>6.1 提現總覽</h3>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>提現成功筆數</strong></td>
      <td>(說明=轉帳完成/转账完成 OR 提現狀態含提現完成) 且 實際轉出金額≠0（按訂單號去重）</td>
    </tr>
    <tr>
      <td><strong>提現成功金額</strong></td>
      <td>提現成功記錄的實際轉出金額加總</td>
    </tr>
    <tr>
      <td><strong>平均處理時間</strong></td>
      <td>提現成功記錄的處理時間平均（按訂單號去重）</td>
    </tr>
    <tr>
      <td><strong>總提現申請筆數</strong></td>
      <td>提現成功筆數 + 提現失敗筆數（按訂單號去重）</td>
    </tr>
    <tr>
      <td><strong>提現成功率</strong></td>
      <td>提現成功筆數 ÷ 總提現申請筆數 × 100%</td>
    </tr>
    <tr>
      <td><strong>提現失敗筆數</strong></td>
      <td>transferStatus ≠ "轉帳完成" 的筆數</td>
    </tr>
    <tr>
      <td><strong>無卡空單率</strong></td>
      <td>無配對卡的提現筆數 ÷ 總提現申請筆數 × 100%</td>
    </tr>
  </tbody>
</table>

<h3>6.2 提現成功時間區段</h3>
<table>
  <thead>
    <tr><th>時間區段</th><th>條件</th></tr>
  </thead>
  <tbody>
    <tr><td>2分鐘內出款</td><td>提現成功 且處理時間 &lt; 120秒</td></tr>
    <tr><td>2-5分鐘出款</td><td>提現成功 且 120秒 ≤ 處理時間 &lt; 300秒</td></tr>
    <tr><td>5-15分鐘出款</td><td>提現成功 且 300秒 ≤ 處理時間 &lt; 900秒</td></tr>
    <tr><td>15-30分鐘出款</td><td>提現成功 且 900秒 ≤ 處理時間 &lt; 1800秒</td></tr>
    <tr><td>超過30分鐘出款</td><td>提現成功 且處理時間 ≥ 1800秒</td></tr>
  </tbody>
</table>

<h3>6.3 各渠道提現數據</h3>
<p>系統支援四個分頁：全部、極速(銀行卡)、極速(支付寶)、極速(微信)</p>
<table>
  <thead>
    <tr><th>指標</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>提現申請</td><td>該渠道的提現申請筆數與金額</td></tr>
    <tr><td>充值配對率</td><td>成功配對筆數 ÷ 充值申請筆數 × 100%</td></tr>
    <tr><td>配對後成功率</td><td>充值成功筆數 ÷ 成功配對筆數 × 100%</td></tr>
    <tr><td>平均處理時間</td><td>提現成功 且 實際轉出金額≠0 的處理時間平均（按訂單號去重）</td></tr>
  </tbody>
</table>

<hr>

<h2>七、騙分統計</h2>

<h3>7.1 數據結構</h3>
<p>騙分統計採用手動輸入方式，每筆記錄包含日期、渠道類型及統一輸入欄位。</p>

<h3>7.2 渠道類型</h3>
<table>
  <thead>
    <tr><th>渠道</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>銀行卡</td><td>銀行卡渠道騙分數據</td></tr>
    <tr><td>支付寶</td><td>支付寶渠道騙分數據</td></tr>
    <tr><td>微信</td><td>微信渠道騙分數據</td></tr>
  </tbody>
</table>

<h3>7.3 統一輸入欄位</h3>
<table>
  <thead>
    <tr><th>欄位</th><th>說明</th></tr>
  </thead>
  <tbody>
    <tr><td>骗分拉黑(笔)</td><td>被判定為騙分並拉黑的筆數</td></tr>
    <tr><td>卡验及人验(笔)</td><td>需要卡驗或人工驗證的筆數</td></tr>
    <tr><td>人工笔数</td><td>人工處理的騙分筆數</td></tr>
    <tr><td>人工金额(元)</td><td>人工處理的騙分金額</td></tr>
    <tr><td>信评笔数</td><td>信評相關的騙分筆數</td></tr>
    <tr><td>信评金额(元)</td><td>信評相關的騙分金額</td></tr>
    <tr><td>没上传回单(笔)</td><td>沒上傳回單重複出款充值上分的筆數</td></tr>
    <tr><td>备注</td><td>備註說明</td></tr>
  </tbody>
</table>

<h3>7.4 統計計算</h3>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>總騙分金額</strong></td>
      <td>人工金額加總 + 信評金額加總（依篩選日期範圍，跨所有渠道）</td>
    </tr>
    <tr>
      <td><strong>騙分拉黑(筆)</strong></td>
      <td>騙分拉黑筆數加總</td>
    </tr>
    <tr>
      <td><strong>卡驗及人驗(筆)</strong></td>
      <td>卡驗及人驗筆數加總</td>
    </tr>
    <tr>
      <td><strong>人工筆數/金額</strong></td>
      <td>人工筆數加總 / 人工金額加總</td>
    </tr>
    <tr>
      <td><strong>信評筆數/金額</strong></td>
      <td>信評筆數加總 / 信評金額加總</td>
    </tr>
    <tr>
      <td><strong>未收到款(筆)</strong></td>
      <td>沒上傳回單重複出款充值上分筆數加總</td>
    </tr>
  </tbody>
</table>

<h3>7.5 日期篩選規則</h3>
<ul>
  <li>支援起迄日期範圍查詢</li>
  <li>開始日期不能超過今日</li>
  <li>結束日期不能早於開始日期</li>
  <li>日期範圍最大一個月</li>
</ul>

<hr>

<h2>八、日週報數據匯總</h2>

<h3>8.1 數據範圍與排除規則</h3>
<table>
  <thead>
    <tr><th>項目</th><th>規則說明</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>排除商戶</strong></td>
      <td>商戶名稱包含「線下」「线下」「test」「qa」（不分大小寫）</td>
    </tr>
    <tr>
      <td><strong>整體範圍</strong></td>
      <td>排除上述商戶後的所有記錄</td>
    </tr>
    <tr>
      <td><strong>提現去重</strong></td>
      <td>整體提現需依訂單ID去重</td>
    </tr>
  </tbody>
</table>

<h3>8.2 充值指標定義</h3>
<table>
  <thead>
    <tr><th>指標</th><th>定義</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>自動到帳</strong></td>
      <td>到帳金額 > 0 且狀態不包含「補單」</td>
    </tr>
    <tr>
      <td><strong>補單</strong></td>
      <td>到帳金額 > 0 且狀態包含「補單」或「商戶確認到帳」</td>
    </tr>
    <tr>
      <td><strong>總充值筆數</strong></td>
      <td>自動到帳筆數 + 補單筆數</td>
    </tr>
    <tr>
      <td><strong>無效申請</strong></td>
      <td>到帳金額 = 0 且狀態包含「未充值」</td>
    </tr>
  </tbody>
</table>

<h3>8.3 充值指標計算公式</h3>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>成功率</strong></td>
      <td>自動到帳筆數 ÷ 總充值筆數 × 100%</td>
    </tr>
    <tr>
      <td><strong>3分內佔比</strong></td>
      <td>自動到帳中處理時間 ≤ 180秒的筆數 ÷ 自動到帳筆數 × 100%</td>
    </tr>
    <tr>
      <td><strong>平均處理時間</strong></td>
      <td>自動到帳筆數的「通知時間 - 建立時間」平均值</td>
    </tr>
    <tr>
      <td><strong>自動到帳時長</strong></td>
      <td>自動到帳筆數的平均處理時間</td>
    </tr>
    <tr>
      <td><strong>平均充值時長</strong></td>
      <td>（自動到帳 + 補單）的平均處理時間</td>
    </tr>
  </tbody>
</table>

<h3>8.4 提現指標定義</h3>
<table>
  <thead>
    <tr><th>指標</th><th>定義</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>成功提現</strong></td>
      <td>轉帳狀態 = 「轉帳完成」且實際轉出金額 ≠ 0</td>
    </tr>
    <tr>
      <td><strong>轉帳成功判斷</strong></td>
      <td>transferStatus = '轉帳完成'/'转帐完成'/'转账完成' 或 status 包含 '提現完成'/'提现完成'</td>
    </tr>
    <tr>
      <td><strong>總提現筆數</strong></td>
      <td>該分類範圍內的所有提現記錄數</td>
    </tr>
    <tr>
      <td><strong>自動提現筆數</strong></td>
      <td>成功提現筆數</td>
    </tr>
  </tbody>
</table>

<h3>8.5 提現指標計算公式</h3>
<table>
  <thead>
    <tr><th>指標</th><th>計算公式</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>提現成功條件</strong></td>
      <td>(說明=轉帳完成/转账完成/转帐完成 OR 提現狀態含提現完成) 且 實際轉出金額≠0</td>
    </tr>
    <tr>
      <td><strong>成功率</strong></td>
      <td>提現成功筆數 ÷ 總申請筆數 × 100%</td>
    </tr>
    <tr>
      <td><strong>2分內占比</strong></td>
      <td>處理時間 &lt; 120秒的筆數 ÷ 提現成功筆數 × 100%</td>
    </tr>
    <tr>
      <td><strong>平均處理時間</strong></td>
      <td>提現成功的處理時間平均</td>
    </tr>
  </tbody>
</table>

<h3>8.6 分類篩選條件</h3>
<table>
  <thead>
    <tr><th>分類</th><th>充值篩選條件</th><th>提現篩選條件</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>整體</strong></td>
      <td>排除線下/test/qa</td>
      <td>排除線下/test/qa + 依訂單ID去重</td>
    </tr>
    <tr>
      <td><strong>支付寶</strong></td>
      <td>商戶包含「支付宝」或「支付寶」</td>
      <td>排除線下/test/qa + 收款銀行包含「支付宝」或「支付寶」</td>
    </tr>
    <tr>
      <td><strong>微信</strong></td>
      <td>商戶包含「微信」</td>
      <td>排除線下/test/qa + 收款銀行包含「微信」</td>
    </tr>
    <tr>
      <td><strong>金寶</strong></td>
      <td>排除線下/test/qa + 銀行卡代號 GB 開頭（排除 GB-DAHAOMEN）</td>
      <td>排除線下/test/qa + 出款卡編碼 GB 開頭（排除 GB-DAHAOMEN）</td>
    </tr>
    <tr>
      <td><strong>極速</strong></td>
      <td>排除線下/test/qa + 銀行卡代號 AUCTION 開頭</td>
      <td>排除線下/test/qa + 出款卡編碼包含 AUCTION</td>
    </tr>
    <tr>
      <td><strong>三方</strong></td>
      <td>排除線下/test/qa + 非 GB/AUCTION 開頭，或 GB-DAHAOMEN</td>
      <td>排除線下/test/qa + 出款卡編碼非 GB/AUCTION 開頭，但 GB-DAHAOMEN 屬於三方</td>
    </tr>
    <tr>
      <td><strong>非正向信評</strong></td>
      <td>排除線下/test/qa + 狀態以「信用」「信评」「信評」開頭</td>
      <td>無提現數據</td>
    </tr>
  </tbody>
</table>

<hr>

<h2>九、欄位對照表</h2>

<h3>9.1 充值數據欄位</h3>
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

<h3>9.2 關鍵代碼識別</h3>
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

<hr>

<h2>十、版本記錄</h2>
<table>
  <thead>
    <tr><th>版本</th><th>日期</th><th>說明</th></tr>
  </thead>
  <tbody>
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
    <tr><td>v1.8.3</td><td>2026-02-10</td><td>新增報表三方設定章節；騙分統計改為統一表單+渠道類型選擇；三方代收區塊改為動態配置；修正預設卡代號</td></tr>
  </tbody>
</table>
`)

// 根據版本動態組合內容
const prdHtml = computed(() => {
  if (props.isVerifyVersion) {
    // 驗證版：在 8.6 分類篩選條件後插入 8.7 筆數計算表格欄位
    return prdHtmlBase.value.replace(
      '<hr>\n\n<h2>九、欄位對照表</h2>',
      verifyOnlySection + '<hr>\n\n<h2>九、欄位對照表</h2>'
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
