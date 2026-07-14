<template>
  <div class="qrcode-verify">
    <!-- 篩選區 -->
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>從</label>
          <input type="date" v-model="filters.dateFrom" />
        </div>
        <div class="filter-group">
          <label>到</label>
          <input type="date" v-model="filters.dateTo" />
        </div>
        <div class="filter-group">
          <label>商戶</label>
          <select v-model="filters.merchant">
            <option value="">全部</option>
            <option value="极速充提3_启航">极速充提3_启航</option>
            <option value="极速充提3_杏彩">极速充提3_杏彩</option>
            <option value="极速充提3_杏耀">极速充提3_杏耀</option>
            <option value="极速充提3_沐鸣2">极速充提3_沐鸣2</option>
          </select>
        </div>
        <div class="filter-group filter-grow">
          <label>任務編號</label>
          <input type="text" v-model="filters.orderNo" placeholder="此條件將會忽略其他查詢條件" />
        </div>
        <div class="filter-group">
          <label>用戶ID</label>
          <input type="text" v-model="filters.userId" placeholder="輸入用戶ID" />
        </div>
        <div class="filter-group">
          <label>類型</label>
          <select v-model="filters.type">
            <option value="">全部</option>
            <option value="qrcode驗證">qrcode驗證</option>
            <option value="姓氏驗證">姓氏驗證</option>
          </select>
        </div>
        <div class="filter-group">
          <label>狀態</label>
          <select v-model="filters.status">
            <option value="">全部</option>
            <option value="success">成功</option>
            <option value="fail">失敗</option>
            <option value="pending">app解析中</option>
          </select>
        </div>
        <div class="filter-group">
          <button class="btn-search" @click="search">查詢</button>
        </div>
        <div class="filter-group filter-page">
          <label>顯示</label>
          <select v-model="pageSize" class="select-sm">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
          <span class="text-muted">項結果</span>
        </div>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>任務編號</th>
            <th>類型</th>
            <th>商戶</th>
            <th>用戶姓名</th>
            <th>用戶帳號</th>
            <th>用戶ID</th>
            <th>原始QRCode</th>
            <th>解析URL</th>
            <th>設備號</th>
            <th>狀態</th>
            <th>原因</th>
            <th>時間標籤</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pagedData.length === 0">
            <td colspan="12" class="empty-row">沒有符合的結果</td>
          </tr>
          <tr v-for="(row, idx) in pagedData" :key="idx">
            <td>{{ row.taskNo }}</td>
            <td>{{ row.type }}</td>
            <td>{{ row.merchant }}</td>
            <td>{{ row.userName }}</td>
            <td>{{ row.userAccount ? '*'.repeat(row.userAccount.length - 3) + row.userAccount.slice(-3) : '-' }}</td>
            <td>{{ row.userId }}</td>
            <td><a href="#" class="url-link" @click.prevent="openImage(row.qrcodeUrl)">查看QRCode</a></td>
            <td class="col-url"><a href="#" class="url-link" @click.prevent="openImage(row.parsedUrl)">{{ row.parsedUrl }}</a></td>
            <td>{{ row.deviceName || '-' }}</td>
            <td>
              <span class="badge" :class="'badge-' + row.status">{{ { success: '成功', fail: '失敗', pending: 'app解析中' }[row.status] }}</span>
            </td>
            <td>
              <template v-if="row.type === '姓氏驗證'">
                <div>• 姓氏驗證：{{ row.nameVerifyStatus === 'success' ? '成功' : '失敗' }}</div>
                <div>• QR Code：{{ row.status === 'success' ? '成功' : row.status === 'pending' ? 'App解析中' : '失敗－' + (row.reason || '') + (row.qrcodeName ? '（' + row.qrcodeName + '）' : '') }}</div>
              </template>
              <template v-else>{{ row.reason ? row.reason + '（' + row.qrcodeName + '）' : '-' }}</template>
            </td>
            <td class="col-time">
              <div>提交：{{ row.createTime }}</div>
              <div>解析：{{ row.parsedTime || '-' }}</div>
              <div>app完成：{{ row.completedTime || '-' }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分頁 -->
    <div class="pagination-bar">
      <span>顯示第 {{ filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1 }} 至 {{ Math.min(currentPage * pageSize, filteredData.length) }} 項結果，共 {{ filteredData.length }} 項</span>
      <div class="pagination">
        <button @click="currentPage = Math.max(1, currentPage - 1)">&lt;</button>
        <button @click="currentPage = Math.min(totalPages || 1, currentPage + 1)">&gt;</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const filters = ref({
  dateFrom: '2026-01-01',
  dateTo: '2026-01-01',
  merchant: '',
  orderNo: '',
  userId: '',
  type: '',
  status: ''
});

const pageSize = ref(10);
const currentPage = ref(1);

const mockData = ref([
  { taskNo: 'VRF20260323001', type: 'qrcode驗證', merchant: '极速充提3_启航', userName: '王大明', userAccount: '18299193021', userId: '6133570', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/131103_aB3xKdRm7P_qrcode.jpg', parsedUrl: 'https://qr.alipay.com/fkx10456xfjjzab65fwmb6e', status: 'success', reason: '', createTime: '2026-03-23 13:11:03', parsedTime: '2026-03-23 13:11:08', completedTime: '2026-03-23 13:11:45' },
  { taskNo: 'VRF20260323002', type: '姓氏驗證', merchant: '极速充提3_杏彩', userName: '李小華', userAccount: '13812345678', userId: '2878225', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/132510_pQ4wNeYj8K_qrcode.jpg', parsedUrl: 'HTTPS://QR.ALIPAY.COM/FKX20225KDJWP9AB83NWC0F', status: 'fail', reason: '異名提現', qrcodeName: '趙國虎', deviceName: 'Device-A01', createTime: '2026-03-23 13:25:10', parsedTime: '2026-03-23 13:25:15', completedTime: '2026-03-23 13:25:52' },
  { taskNo: 'VRF20260323003', type: 'qrcode驗證', merchant: '极速充提3_杏彩', userName: '張志偉', userAccount: '15966778899', userId: '3292660', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/133804_mT5vLcWh2F_qrcode.jpg', parsedUrl: 'https://d.alipay.com/i/?scheme=alipays%3a%2f%2fplatformapi%2fstartapp%3fappId%3d20000067%26url%3dhttps%253A%252F%252Frender.alipay.com%252Fp%252Ff%252Ffd-ixpo0ega%252Findex.html', status: 'pending', reason: '', createTime: '2026-03-23 13:38:04', parsedTime: '', completedTime: '' },
  { taskNo: 'VRF20260323004', type: '姓氏驗證', merchant: '极速充提3_杏耀', userName: '黃寶寶', userAccount: '17623456789', userId: '258784', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/135022_rG6uHbVk9D_qrcode.jpg', parsedUrl: 'https://qr.alipay.com/fkx30784htqwnzc92kplf18', status: 'fail', reason: '異名提現', qrcodeName: '周志豐', deviceName: 'Device-B03', createTime: '2026-03-23 13:50:22', parsedTime: '2026-03-23 13:50:28', completedTime: '2026-03-23 13:51:04' },
  { taskNo: 'VRF20260323005', type: 'qrcode驗證', merchant: '极速充提3_沐鸣2', userName: '周小珠', userAccount: '13987654321', userId: '3109040', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/140130_sX7tJaUn3C_qrcode.jpg', parsedUrl: 'HTTPS://QR.ALIPAY.COM/FKX40940RJSME7BV56DPA2C', status: 'success', reason: '', createTime: '2026-03-23 14:01:30', parsedTime: '2026-03-23 14:01:36', completedTime: '2026-03-23 14:02:11' },
  { taskNo: 'VRF20260323006', type: '姓氏驗證', merchant: '极速充提3_杏彩', userName: '陳美玲', userAccount: '18611223344', userId: '87212', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/141406_wK8sEzTq4B_qrcode.jpg', parsedUrl: '', status: 'pending', reason: '', createTime: '2026-03-23 14:14:06', parsedTime: '', completedTime: '' },
  { taskNo: 'VRF20260323007', type: 'qrcode驗證', merchant: '极速充提3_杏耀', userName: '吳永生', userAccount: '15533445566', userId: '979457', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/142815_nH9rDySpA5_qrcode.jpg', parsedUrl: 'https://d.alipay.com/i/?scheme=alipays%3a%2f%2fplatformapi%2fstartapp%3fappId%3d20000067%26url%3dhttps%253A%252F%252Frender.alipay.com%252Fp%252Ff%252Ffd-jkq9457z%252Findex.html', status: 'fail', reason: '異名提現', qrcodeName: '張瑞琳', deviceName: 'Device-A02', createTime: '2026-03-23 14:28:15', parsedTime: '2026-03-23 14:28:21', completedTime: '2026-03-23 14:28:58' },
  { taskNo: 'VRF20260323008', type: '姓氏驗證', merchant: '极速充提3_启航', userName: '林志豪', userAccount: '17799887766', userId: '653601', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/143540_jF2qCxRo6E_qrcode.jpg', parsedUrl: 'https://qr.alipay.com/fkx50601vpqbr3ck78ygt5d', status: 'success', reason: '', createTime: '2026-03-23 14:35:40', parsedTime: '2026-03-23 14:35:45', completedTime: '2026-03-23 14:36:22' },
  { taskNo: 'VRF20260323009', type: 'qrcode驗證', merchant: '极速充提3_杏彩', userName: '趙國強', userAccount: '13644556677', userId: '55785', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/144404_kD3pBwQm7G_qrcode.jpg', parsedUrl: 'HTTPS://QR.ALIPAY.COM/FKX60785LMNWQ4XZ29HPB7E', status: 'pending', reason: '', createTime: '2026-03-23 14:44:04', parsedTime: '', completedTime: '' },
  { taskNo: 'VRF20260323010', type: '姓氏驗證', merchant: '极速充提3_沐鸣2', userName: '鄭雅婷', userAccount: '18977665544', userId: '1028453', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/145518_hC4oAvPl8H_qrcode.jpg', parsedUrl: 'https://qr.alipay.com/fkx70453sdfjk2nm81bwc9g', status: 'fail', reason: '異名提現', qrcodeName: '劉世豐', deviceName: 'Device-C05', createTime: '2026-03-23 14:55:18', parsedTime: '2026-03-23 14:55:24', completedTime: '2026-03-23 14:56:01' },
  { taskNo: 'VRF20260323011', type: 'qrcode驗證', merchant: '极速充提3_启航', userName: '劉建國', userAccount: '15122334455', userId: '4521087', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/150233_gB5nZuOk9J_qrcode.jpg', parsedUrl: 'https://d.alipay.com/i/?scheme=alipays%3a%2f%2fplatformapi%2fstartapp%3fappId%3d20000067%26url%3dhttps%253A%252F%252Frender.alipay.com%252Fp%252Ff%252Ffd-abc1087w%252Findex.html', status: 'success', reason: '', createTime: '2026-03-23 15:02:33', parsedTime: '2026-03-23 15:02:39', completedTime: '2026-03-23 15:03:14' },
  { taskNo: 'VRF20260323012', type: '姓氏驗證', merchant: '极速充提3_杏耀', userName: '許家豪', userAccount: '17866778899', userId: '762310', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/151147_fA6mYtNj2K_qrcode.jpg', parsedUrl: 'HTTPS://QR.ALIPAY.COM/FKX80310YWTRP5GH43KQD6F', status: 'fail', reason: '異名提現', qrcodeName: '王秀芳', deviceName: 'Device-B03', createTime: '2026-03-23 15:11:47', parsedTime: '2026-03-23 15:11:53', completedTime: '2026-03-23 15:12:30' },
  { taskNo: 'VRF20260323013', type: 'qrcode驗證', merchant: '极速充提3_杏彩', userName: '蔡明宏', userAccount: '13755443322', userId: '1893204', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/152055_eZ7lXsMi3L_qrcode.jpg', parsedUrl: '', status: 'pending', reason: '', createTime: '2026-03-23 15:20:55', parsedTime: '', completedTime: '' },
  { taskNo: 'VRF20260323014', type: '姓氏驗證', merchant: '极速充提3_沐鸣2', userName: '謝佳穎', userAccount: '18500112233', userId: '3450921', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/153312_dY8kWrLh4M_qrcode.jpg', parsedUrl: 'https://qr.alipay.com/fkx90921qwert6yh52mnb3j', status: 'pending', reason: '', createTime: '2026-03-23 15:33:12', parsedTime: '', completedTime: '' },
  { taskNo: 'VRF20260323015', type: 'qrcode驗證', merchant: '极速充提3_启航', userName: '楊淑芬', userAccount: '13900998877', userId: '5678234', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/154108_cX9jVqKg5N_qrcode.jpg', parsedUrl: 'https://d.alipay.com/i/?scheme=alipays%3a%2f%2fplatformapi%2fstartapp%3fappId%3d20000067%26url%3dhttps%253A%252F%252Frender.alipay.com%252Fp%252Ff%252Ffd-xyz8234k%252Findex.html', status: 'fail', reason: '異名提現', qrcodeName: '陳國棟', deviceName: 'Device-A01', createTime: '2026-03-23 15:41:08', parsedTime: '2026-03-23 15:41:14', completedTime: '2026-03-23 15:41:49' },
  { taskNo: 'VRF20260323016', type: '姓氏驗證', merchant: '极速充提3_杏彩', userName: '何志明', userAccount: '17711223344', userId: '2345678', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/155230_bW2iUpJf6P_qrcode.jpg', parsedUrl: 'HTTPS://QR.ALIPAY.COM/FKX15678NMKPW8RJ67LXC4H', status: 'success', reason: '', createTime: '2026-03-23 15:52:30', parsedTime: '2026-03-23 15:52:36', completedTime: '2026-03-23 15:53:10' },
  { taskNo: 'VRF20260323017', type: 'qrcode驗證', merchant: '极速充提3_杏耀', userName: '郭美麗', userAccount: '15688997766', userId: '891023', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/160544_aV3hToIe7Q_qrcode.jpg', parsedUrl: '', status: 'pending', reason: '', createTime: '2026-03-23 16:05:44', parsedTime: '', completedTime: '' },
  { taskNo: 'VRF20260323018', type: '姓氏驗證', merchant: '极速充提3_沐鸣2', userName: '呂文杰', userAccount: '18366554433', userId: '4567890', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/161827_zU4gSnHd8R_qrcode.jpg', parsedUrl: 'https://qr.alipay.com/fkx27890hjklm3nq94bwf5t', status: 'fail', reason: '異名提現', qrcodeName: '林瑞祥', deviceName: 'Device-C05', createTime: '2026-03-23 16:18:27', parsedTime: '2026-03-23 16:18:33', completedTime: '2026-03-23 16:19:08' },
  { taskNo: 'VRF20260323019', type: 'qrcode驗證', merchant: '极速充提3_启航', userName: '范承恩', userAccount: '13422113344', userId: '7890123', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/163055_yT5fRmGc9S_qrcode.jpg', parsedUrl: 'https://d.alipay.com/i/?scheme=alipays%3a%2f%2fplatformapi%2fstartapp%3fappId%3d20000067%26url%3dhttps%253A%252F%252Frender.alipay.com%252Fp%252Ff%252Ffd-pqr0123s%252Findex.html', status: 'success', reason: '', createTime: '2026-03-23 16:30:55', parsedTime: '2026-03-23 16:31:01', completedTime: '2026-03-23 16:31:38' },
  { taskNo: 'VRF20260323020', type: '姓氏驗證', merchant: '极速充提3_杏彩', userName: '沈慧君', userAccount: '17955664433', userId: '1234567', nameVerifyStatus: 'success', qrcodeUrl: 'https://pre.channel.1-pay.co/share_storage/cn/payment_qrcode/2026/03/23/164510_xS6eQlFb2T_qrcode.jpg', parsedUrl: 'HTTPS://QR.ALIPAY.COM/FKX34567BVCXZ9WE15MNA2K', status: 'fail', reason: '異名提現', qrcodeName: '黃大龍', deviceName: 'Device-A02', createTime: '2026-03-23 16:45:10', parsedTime: '2026-03-23 16:45:16', completedTime: '2026-03-23 16:45:53' },
]);

const filteredData = computed(() => {
  return mockData.value.filter(row => {
    if (filters.value.merchant && row.merchant !== filters.value.merchant) return false;
    if (filters.value.userId && row.userId !== filters.value.userId) return false;
    if (filters.value.type && row.type !== filters.value.type) return false;
    if (filters.value.status && row.status !== filters.value.status) return false;
    if (filters.value.orderNo && row.taskNo !== filters.value.orderNo) return false;
    return true;
  });
});

const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredData.value.slice(start, start + pageSize.value);
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / pageSize.value));

function search() {
  currentPage.value = 1;
}

function openImage(url) {
  window.open(url, '_blank', 'width=500,height=600');
}
</script>

<style scoped>
.qrcode-verify {
  padding: 20px;
}

/* 篩選區 */
.filter-panel {
  background: #fff;
  border-radius: 6px;
  padding: 18px 24px;
  margin-bottom: 20px;
  border: 1px solid #e8e8e8;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group label {
  font-size: 14px;
  color: #333;
  font-weight: 500;
  white-space: nowrap;
}

.filter-group input[type="date"],
.filter-group input[type="text"],
.filter-group select {
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
}

.filter-group input[type="date"]:focus,
.filter-group input[type="text"]:focus,
.filter-group select:focus {
  border-color: #4a4a9e;
}

.filter-group input[type="date"] {
  width: 150px;
}

.filter-group select {
  min-width: 100px;
}

.filter-grow {
  flex: 1;
  min-width: 200px;
}

.filter-grow input[type="text"] {
  width: 100%;
}

.btn-search {
  padding: 6px 20px;
  background: #4a4a9e;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-search:hover {
  background: #3a3a8e;
}

.filter-page {
  margin-left: auto;
}

.select-sm {
  width: 60px !important;
  min-width: 60px !important;
}

.text-muted {
  font-size: 13px;
  color: #888;
}

/* 表格 */
.table-container {
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

thead tr {
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #4a4a8a;
  font-size: 13px;
  white-space: nowrap;
}

td {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
  color: #333;
}

tbody tr:hover {
  background: #f5f7ff;
}

tbody tr:last-child td {
  border-bottom: none;
}

.empty-row {
  text-align: center;
  color: #bbb;
  padding: 48px 16px !important;
  font-size: 14px;
}

.col-info {
  min-width: 280px;
  line-height: 1.6;
}

.col-info .text-muted {
  color: #888;
  font-size: 12px;
}

.col-qrcode-urls {
  min-width: 300px;
  font-size: 12px;
  word-break: break-all;
  line-height: 1.5;
}

.qr-label {
  font-size: 11px;
  color: #999;
  font-weight: 500;
}

.col-url {
  max-width: 220px;
  word-break: break-all;
  font-size: 12px;
}

.url-link {
  color: #1976d2;
  text-decoration: none;
}

.url-link:hover {
  text-decoration: underline;
}

/* Badge */
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge-success {
  background: #e8f5e9;
  color: #2e7d32;
}

.badge-fail {
  background: #ffebee;
  color: #c62828;
}

.badge-pending {
  background: #fff3e0;
  color: #e65100;
}

/* 分頁 */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 4px;
  font-size: 13px;
  color: #888;
}

.pagination {
  display: flex;
  gap: 6px;
}

.pagination button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: all 0.2s;
}

.pagination button:hover {
  border-color: #4a4a9e;
  color: #4a4a9e;
}
</style>
