<template>
  <div class="remain-pool">
    <!-- 篩選區 -->
    <div class="filter-panel">
      <div class="filter-header">
        <h3>極速提現剩餘池</h3>
        <button class="btn-reload" @click="reload">頁面重載</button>
      </div>
      <div class="filter-row">
        <label>商戶</label>
        <select v-model="filters.merchant">
          <option value="">全部</option>
          <option value="极速充提3_启航">极速充提3_启航</option>
          <option value="极速充提3_杏彩">极速充提3_杏彩</option>
          <option value="极速充提3_杏耀">极速充提3_杏耀</option>
          <option value="极速充提3_沐鸣2">极速充提3_沐鸣2</option>
        </select>
        <label>單號查詢</label>
        <input type="text" v-model="filters.orderNo" placeholder="此條件將會忽略其他查詢條件" class="input-wide" />
        <label>申請金額</label>
        <input type="text" v-model="filters.amount" />
        <label>餘額</label>
        <input type="text" v-model="filters.balance" />
        <label>用戶ID</label>
        <input type="text" v-model="filters.userId" />
      </div>
      <div class="filter-row">
        <input type="text" v-model="filters.extra" />
        <label>用戶名</label>
        <input type="text" v-model="filters.username" />
        <label class="checkbox-label">
          <input type="checkbox" v-model="filters.priorityOnly" />
          優先配對
        </label>
        <div class="filter-right">
          <label>搜尋：</label>
          <input type="text" v-model="filters.search" />
          <label>顯示</label>
          <select v-model="pageSize">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
          <span>項結果</span>
        </div>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" /></th>
            <th>ID</th>
            <th>商戶<br/>用戶ID<br/>用戶名</th>
            <th>用戶訊息</th>
            <th>用戶註冊日期</th>
            <th>剩餘總額<br/>餘額</th>
            <th>可拆？</th>
            <th>可拆剩餘筆數</th>
            <th>處理中</th>
            <th>時間</th>
            <th>建單維護訊息</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in pagedData" :key="idx">
            <td class="col-check"><input type="checkbox" /></td>
            <td class="col-id">
              <span v-if="row.priority" class="badge-priority">優先配對</span>
              <div>{{ row.wdrNo }}</div>
              <div class="text-muted">{{ row.subId }}</div>
            </td>
            <td>
              <div>{{ row.merchant }}</div>
              <div class="text-muted">{{ row.merchantUserId }}</div>
              <div class="text-muted">{{ row.merchantUsername }}</div>
            </td>
            <td class="col-withdraw-info">
              <div>用戶姓名：{{ row.withdrawName }}</div>
              <div>卡號: {{ row.cardNoMasked }}</div>
              <a href="#" class="qrcode-link" @click.prevent="openQrcode(row)">qrcode</a>
            </td>
            <td>{{ row.regDate }}<br/>{{ row.regTime }}</td>
            <td>{{ row.totalAmount.toFixed(2) }}<br/>{{ row.balance.toFixed(2) }}</td>
            <td>{{ row.splittable ? '是' : '否' }}</td>
            <td>{{ row.remainCount }}</td>
            <td>{{ row.processing || '' }}</td>
            <td class="col-time">
              <div>過期時間: {{ row.expireTime }}</div>
              <div>建立時間: {{ row.createTime }}</div>
            </td>
            <td class="col-actions">
              <button class="btn-action btn-info">配對資訊</button>
              <button class="btn-action btn-priority">優先配對</button>
              <button class="btn-action btn-release">釋放</button>
              <button class="btn-action btn-cancel">取消</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分頁 -->
    <div class="pagination-bar">
      <span>顯示第 {{ (currentPage - 1) * pageSize + 1 }} 至 {{ Math.min(currentPage * pageSize, mockData.length) }} 項結果，共 {{ mockData.length }} 項</span>
      <div class="pagination">
        <button @click="currentPage = Math.max(1, currentPage - 1)">&lt;</button>
        <button v-for="p in totalPages" :key="p" :class="{ active: p === currentPage }" @click="currentPage = p">{{ p }}</button>
        <button @click="currentPage = Math.min(totalPages, currentPage + 1)">&gt;</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const filters = ref({
  merchant: '',
  orderNo: '',
  amount: '',
  balance: '',
  userId: '',
  extra: '',
  username: '',
  priorityOnly: false,
  search: ''
});

const pageSize = ref(10);
const currentPage = ref(1);

const mockData = ref([
  { priority: true, wdrNo: 'WDR00037020260323130752000020320', subId: 'QH_11261392', merchant: '极速充提3_启航', merchantUserId: '6133570', merchantUsername: 'bkf8888@qh', withdrawName: '王大明', cardNoMasked: '*****est', regDate: '2025-09-06', regTime: '23:35:25', totalAmount: 800, balance: 800, splittable: true, remainCount: 5, processing: '', expireTime: '2026-03-23 16:31:03', createTime: '2026-03-23 13:11:03' },
  { priority: false, wdrNo: 'WDR00037320260323131546000020520', subId: '15706695', merchant: '极速充提3_杏彩', merchantUserId: '2878225', merchantUsername: 'CGJY88', withdrawName: '李小華', cardNoMasked: '*****629', regDate: '2020-03-03', regTime: '14:44:57', totalAmount: 200, balance: 200, splittable: false, remainCount: 4, processing: '', expireTime: '2026-03-23 16:52:03', createTime: '2026-03-23 13:32:03' },
  { priority: false, wdrNo: 'WDR00037320260323133654000021260', subId: '15706707', merchant: '极速充提3_杏彩', merchantUserId: '3292660', merchantUsername: 'yj6766', withdrawName: '張志偉', cardNoMasked: '*****766', regDate: '2022-02-14', regTime: '15:36:57', totalAmount: 1200, balance: 1200, splittable: true, remainCount: 4, processing: '', expireTime: '2026-03-23 16:58:04', createTime: '2026-03-23 13:38:04' },
  { priority: false, wdrNo: 'WDR00037320260323134242000021550', subId: '15706710', merchant: '极速充提3_杏彩', merchantUserId: '2878225', merchantUsername: 'CGJY88', withdrawName: '李小華', cardNoMasked: '*****629', regDate: '2020-03-03', regTime: '14:44:57', totalAmount: 200, balance: 200, splittable: false, remainCount: 4, processing: '', expireTime: '2026-03-23 17:10:04', createTime: '2026-03-23 13:50:04' },
  { priority: true, wdrNo: 'WDR00037320260323141135000022210', subId: '15706720', merchant: '极速充提3_杏彩', merchantUserId: '87212', merchantUsername: 'baidu666', withdrawName: '陳美玲', cardNoMasked: '*****666', regDate: '2013-07-04', regTime: '16:18:00', totalAmount: 200, balance: 200, splittable: false, remainCount: 4, processing: '', expireTime: '2026-03-23 17:34:06', createTime: '2026-03-23 14:14:06' },
  { priority: true, wdrNo: 'WDR00037320260323141801000022430', subId: '15706724', merchant: '极速充提3_杏彩', merchantUserId: '55785', merchantUsername: '76777011', withdrawName: '趙國強', cardNoMasked: '*****011', regDate: '2013-04-23', regTime: '12:46:57', totalAmount: 100, balance: 100, splittable: false, remainCount: 4, processing: '', expireTime: '2026-03-23 17:41:04', createTime: '2026-03-23 14:21:04' },
  { priority: false, wdrNo: 'WDR00037420260323133519000021200', subId: '6346306', merchant: '极速充提3_杏耀', merchantUserId: '258784', merchantUsername: 'baobao0629', withdrawName: '黃寶寶', cardNoMasked: '*****784', regDate: '2018-11-28', regTime: '11:37:57', totalAmount: 100, balance: 100, splittable: false, remainCount: 4, processing: '', expireTime: '2026-03-23 16:57:04', createTime: '2026-03-23 13:37:04' },
  { priority: false, wdrNo: 'WDR00037420260323133806000021280', subId: '6346308', merchant: '极速充提3_杏耀', merchantUserId: '979457', merchantUsername: 'wys10211', withdrawName: '吳永生', cardNoMasked: '*****211', regDate: '2022-10-21', regTime: '11:04:24', totalAmount: 500, balance: 500, splittable: true, remainCount: 4, processing: '', expireTime: '2026-03-23 17:00:04', createTime: '2026-03-23 13:40:04' },
  { priority: false, wdrNo: 'WDR00037420260323144122000023310', subId: '6346337', merchant: '极速充提3_杏耀', merchantUserId: '653601', merchantUsername: 'mvp5185', withdrawName: '林志豪', cardNoMasked: '*****185', regDate: '2020-10-12', regTime: '22:16:44', totalAmount: 800, balance: 800, splittable: true, remainCount: 4, processing: '', expireTime: '2026-03-23 18:04:04', createTime: '2026-03-23 14:44:04' },
  { priority: true, wdrNo: 'WDR00037620260323130742000020310', subId: '15706691', merchant: '极速充提3_沐鸣2', merchantUserId: '3109040', merchantUsername: 'xiaozhu29@xc5', withdrawName: '周小珠', cardNoMasked: '*****xc5', regDate: '2020-10-23', regTime: '09:45:07', totalAmount: 200, balance: 200, splittable: false, remainCount: 7, processing: '', expireTime: '2026-03-23 16:29:05', createTime: '2026-03-23 13:09:05' },
]);

const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return mockData.value.slice(start, start + pageSize.value);
});

const totalPages = computed(() => Math.ceil(mockData.value.length / pageSize.value));

function reload() {
  currentPage.value = 1;
}

function openQrcode(row) {
  const w = window.open('', '_blank', 'width=420,height=620');
  w.document.write(`
    <!DOCTYPE html>
    <html><head><title>QR Code</title>
    <style>
      body { display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:sans-serif; background:#f5f5f5; }
      .card { width:340px; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.15); }
      .header { background:#1677FF; text-align:center; padding:24px 0 16px; }
      .header .logo { font-size:28px; font-weight:700; color:white; letter-spacing:2px; }
      .header .sub { font-size:20px; font-weight:600; color:white; margin-top:8px; }
      .body { background:white; padding:28px 32px 20px; text-align:center; }
      .qr-img { width:240px; height:240px; background:#eee; display:flex; align-items:center; justify-content:center; margin:0 auto; border:1px solid #ddd; font-size:14px; color:#999; }
      .name { margin-top:16px; font-size:16px; color:#333; }
      .footer { background:#1677FF; text-align:center; padding:14px 0; }
      .footer .scan { font-size:18px; font-weight:600; color:white; }
      .footer .tip { font-size:12px; color:rgba(255,255,255,0.8); margin-top:6px; }
    </style></head><body>
    <div class="card">
      <div class="header">
        <div class="logo">支 支付宝</div>
        <div class="sub">推荐使用支付宝</div>
      </div>
      <div class="body">
        <div class="qr-img">QR Code</div>
        <div class="name">${row.withdrawName}</div>
      </div>
      <div class="footer">
        <div class="scan">打开支付宝[扫一扫]</div>
        <div class="tip">申请官方收钱码：拨打95188-6</div>
      </div>
    </div>
    </body></html>
  `);
  w.document.close();
}
</script>

<style scoped>
.remain-pool {
  padding: 16px;
}

.filter-panel {
  background: white;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-header h3 {
  font-size: 16px;
  color: #333;
}

.btn-reload {
  padding: 6px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
}

.btn-reload:hover {
  background: #f5f5f5;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.filter-row label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
}

.filter-row input[type="text"],
.filter-row select {
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  min-width: 100px;
}

.filter-row select {
  min-width: 120px;
}

.input-wide {
  min-width: 260px !important;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-right select {
  width: 60px;
  min-width: 60px;
}

.filter-right span {
  font-size: 13px;
  color: #555;
}

/* 表格 */
.table-container {
  background: white;
  border-radius: 8px;
  overflow-x: auto;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

thead {
  background: #f8f9fa;
}

th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}

tr:hover {
  background: #f8f9ff;
}

.col-check {
  width: 40px;
  text-align: center;
}

.col-id {
  min-width: 280px;
  font-size: 12px;
  word-break: break-all;
}

.col-withdraw-info {
  min-width: 160px;
  font-size: 12px;
}

.qrcode-link {
  color: #1976d2;
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
}

.qrcode-link:hover {
  color: #0d47a1;
}

.col-time {
  min-width: 220px;
  font-size: 12px;
}

.col-actions {
  white-space: nowrap;
}

.text-muted {
  color: #888;
  font-size: 12px;
}

.badge-priority {
  display: inline-block;
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ff9800;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 11px;
  margin-bottom: 4px;
}

/* 操作按鈕 */
.btn-action {
  padding: 4px 12px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 4px;
  background: white;
}

.btn-info {
  color: #1976d2;
  border-color: #1976d2;
}
.btn-info:hover {
  background: #e3f2fd;
}

.btn-priority {
  color: #2e7d32;
  border-color: #2e7d32;
}
.btn-priority:hover {
  background: #e8f5e9;
}

.btn-release {
  color: #00897b;
  border-color: #00897b;
}
.btn-release:hover {
  background: #e0f2f1;
}

.btn-cancel {
  color: #c62828;
  border-color: #c62828;
}
.btn-cancel:hover {
  background: #ffebee;
}

/* 分頁 */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-size: 13px;
  color: #666;
}

.pagination {
  display: flex;
  gap: 4px;
}

.pagination button {
  padding: 4px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
}

.pagination button.active {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}

.pagination button:hover:not(.active) {
  background: #f5f5f5;
}
</style>
