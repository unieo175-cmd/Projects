// CSV Parser utility for payment data
export const parseCSV = (content) => {
  const lines = content.split('\n');
  const records = [];

  // Status categories based on specification
  const successStatuses = ['已充值', '信用評分上分', '回單驗證上分', '用戶确认到账', '用户确认到帐', '银商确认到账', '信評上分', '自動補單', '商戶回調上分'];
  const buDanKeywords = ['補單', '补单'];
  const weiChongZhiKeywords = ['未充值'];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const matches = line.match(/"=""([^"]*)"""/g);
    if (!matches || matches.length < 20) continue;

    const clean = (m) => m.replace(/^"=""/, '').replace(/"""$/, '').trim();

    // 標準化銀行名稱（移除「行動」前綴，簡體轉繁體）
    const normalizeBankName = (name) => {
      // 簡體轉繁體對照表（常見銀行名稱用字）
      const s2t = {
        '银': '銀', '国': '國', '农': '農', '业': '業', '发': '發',
        '储': '儲', '汇': '匯', '兴': '興', '进': '進', '开': '開',
        '华': '華', '东': '東', '贸': '貿', '经': '經', '广': '廣',
        '营': '營', '产': '產', '达': '達', '运': '運', '长': '長',
        '关': '關', '陆': '陸', '专': '專', '实': '實', '张': '張',
        '万': '萬', '红': '紅', '办': '辦', '处': '處', '网': '網',
        '联': '聯', '众': '眾', '浙': '浙', '苏': '蘇', '辽': '遼'
      };

      let normalized = name.replace(/^(行動|行动)/, '');
      for (const [s, t] of Object.entries(s2t)) {
        normalized = normalized.split(s).join(t);
      }
      return normalized;
    };

    const record = {
      id: clean(matches[0]),
      agent: clean(matches[1]),
      merchant: clean(matches[2]),
      amount: parseFloat(clean(matches[3]).replace(/,/g, '')) || 0,
      memo: clean(matches[4]),
      receivingMerchant: clean(matches[5]),
      bankCardCode: clean(matches[6]),
      bankCard: clean(matches[7]),
      bankName: normalizeBankName(clean(matches[8])),
      platformOrderId: clean(matches[9]),
      merchantOrderId: clean(matches[10]),
      transferId: clean(matches[11]),
      receivedAmount: parseFloat(clean(matches[12]).replace(/,/g, '')) || 0,
      status: clean(matches[13]),
      merchantReceiveStatus: clean(matches[14]),
      merchantCreditStatus: clean(matches[15]),
      requestTime: clean(matches[16]),
      detailReceiveTime: clean(matches[17]),
      detailArriveTime: clean(matches[18]),
      notifyMerchantTime: clean(matches[19]),
      userId: matches[21] ? clean(matches[21]) : '',
      userIP: matches[22] ? clean(matches[22]) : '',
      userLevel: matches[23] ? clean(matches[23]) : '',
    };

    // Categorize status
    record.isSuccess = successStatuses.some(s => record.status.includes(s)) && record.receivedAmount > 0;
    record.isBuDan = buDanKeywords.some(k => record.status.includes(k));
    record.isInvalid = weiChongZhiKeywords.some(k => record.status.includes(k));

    // Determine channel based on merchant name
    const merchantName = record.merchant;
    const hasJiSu = merchantName.includes('极速充提3');
    const hasAlipay = merchantName.includes('支付宝') || merchantName.includes('支付寶');
    const hasWechat = merchantName.includes('微信');

    if (hasJiSu && hasAlipay) {
      record.channel = '支付宝';
    } else if (hasJiSu && hasWechat) {
      record.channel = '微信';
    } else if (hasJiSu && !hasAlipay && !hasWechat) {
      record.channel = '銀行卡';
    } else {
      record.channel = '其他';
    }

    // Calculate processing time in seconds
    if (record.requestTime && record.notifyMerchantTime &&
        !record.requestTime.includes('0000') && !record.notifyMerchantTime.includes('0000')) {
      const req = new Date(record.requestTime);
      const notify = new Date(record.notifyMerchantTime);
      record.processingTime = (notify - req) / 1000;
      if (record.processingTime < 0 || record.processingTime > 86400) {
        record.processingTime = null;
      }
    } else {
      record.processingTime = null;
    }

    // 過濾掉商戶名稱包含「线下」、「test」、「qa」的記錄
    const merchantLower = record.merchant.toLowerCase();
    if (record.merchant.includes('线下') || record.merchant.includes('線下') ||
        merchantLower.includes('test') || merchantLower.includes('qa')) {
      continue;
    }

    records.push(record);
  }

  return records;
};

export const calculateMetrics = (records) => {
  // 總申請：狀態不包含未充值的筆數
  const validRecords = records.filter(r => !r.isInvalid);
  const invalidRecords = records.filter(r => r.isInvalid);
  const allRecords = records;

  // 總申請金額
  const totalApplicationAmount = validRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalApplicationCount = validRecords.length;

  // 計算各時間區間的筆數
  const validWithTime = validRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);

  // 2分鐘內 (0-120秒)
  const within2Min = validWithTime.filter(r => r.processingTime <= 120);
  // 3-5分鐘 (180-300秒)
  const within3to5Min = validWithTime.filter(r => r.processingTime > 120 && r.processingTime <= 300);
  // 5-15分鐘 (300-900秒)
  const within5to15Min = validWithTime.filter(r => r.processingTime > 300 && r.processingTime <= 900);
  // 15-30分鐘 (900-1800秒)
  const within15to30Min = validWithTime.filter(r => r.processingTime > 900 && r.processingTime <= 1800);
  // 30分鐘以上 (>1800秒)
  const over30Min = validWithTime.filter(r => r.processingTime > 1800);

  // 計算平均時間 (不包含未充值的筆數)
  const avgTime = validWithTime.length > 0
    ? validWithTime.reduce((sum, r) => sum + r.processingTime, 0) / validWithTime.length
    : 0;

  // 中位數時間
  const sortedTimes = validWithTime.map(r => r.processingTime).sort((a, b) => a - b);
  const medianTime = sortedTimes.length > 0
    ? sortedTimes[Math.floor(sortedTimes.length / 2)]
    : 0;

  // 成功相關指標 (保留舊的)
  const successRecords = records.filter(r => r.isSuccess);
  const buDanRecords = records.filter(r => r.isBuDan && r.receivedAmount > 0);
  const totalAmount = records.filter(r => r.receivedAmount > 0).reduce((sum, r) => sum + r.receivedAmount, 0);

  const totalBase = totalApplicationCount + invalidRecords.length;

  return {
    // 新指標
    totalApplicationCount,
    totalApplicationAmount,
    within2MinCount: within2Min.length,
    within2MinRatio: totalApplicationCount > 0 ? (within2Min.length / totalApplicationCount) * 100 : 0,
    within3to5MinCount: within3to5Min.length,
    within3to5MinRatio: totalApplicationCount > 0 ? (within3to5Min.length / totalApplicationCount) * 100 : 0,
    within5to15MinCount: within5to15Min.length,
    within5to15MinRatio: totalApplicationCount > 0 ? (within5to15Min.length / totalApplicationCount) * 100 : 0,
    within15to30MinCount: within15to30Min.length,
    within15to30MinRatio: totalApplicationCount > 0 ? (within15to30Min.length / totalApplicationCount) * 100 : 0,
    over30MinCount: over30Min.length,
    over30MinRatio: totalApplicationCount > 0 ? (over30Min.length / totalApplicationCount) * 100 : 0,
    invalidCount: invalidRecords.length,
    invalidRatio: totalBase > 0 ? (invalidRecords.length / totalBase) * 100 : 0,
    avgTimeSeconds: avgTime,
    medianTimeSeconds: medianTime,

    // 舊指標 (保留兼容)
    totalAmount,
    totalCount: records.filter(r => r.receivedAmount > 0).length,
    autoSuccessCount: successRecords.length,
    dropOrderCount: buDanRecords.length,
    dropOrderRatio: totalApplicationCount > 0 ? (buDanRecords.length / totalApplicationCount) * 100 : 0,
    successRate: totalBase > 0 ? (successRecords.length / totalBase) * 100 : 0
  };
};

export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}分${secs}秒`;
};

export const formatAmount = (amount) => {
  return amount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Get unique channels from records
export const getUniqueChannels = (records) => {
  const channels = new Set();
  records.forEach(r => {
    if (r.channel) channels.add(r.channel);
  });
  return Array.from(channels);
};

// Get unique merchants from records
export const getUniqueMerchants = (records) => {
  const merchants = new Set();
  records.forEach(r => {
    if (r.merchant) merchants.add(r.merchant);
  });
  return Array.from(merchants).sort();
};
