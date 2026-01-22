// CSV Parser utility for payment data
export const parseCSV = (content) => {
  // 移除 BOM 字元
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split('\n');
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

  console.log(`CSV 解析完成：共 ${lines.length} 行，解析出 ${records.length} 筆有效記錄`);
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

  // ===== 極速區域指標 =====
  // 資料範圍：排除支付寶和微信，且到賬金額不為0
  const jisuRecords = records.filter(r => {
    const merchantLower = r.merchant.toLowerCase();
    const hasAlipay = merchantLower.includes('支付宝') || merchantLower.includes('支付寶');
    const hasWechat = merchantLower.includes('微信');
    return !hasAlipay && !hasWechat;
  });

  // ===== 1. 充值申請筆數 =====
  // 一般卡：銀行卡代號有值且不等於AUCTION_PAYMENT_CARD
  const normalCardForApp = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode !== 'AUCTION_PAYMENT_CARD'
  );
  // 極速：銀行卡代號=AUCTION_PAYMENT_CARD
  const expressCardForApp = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD'
  );
  const jisuApplicationCount = normalCardForApp.length + expressCardForApp.length;

  // ===== 2. 成功配對筆數/金額 =====
  // 一般卡：銀行卡代號有值且不等於AUCTION_PAYMENT_CARD，計算筆數和充值金額(amount)總和
  const normalMatchCount = normalCardForApp.length;
  const normalMatchAmount = normalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 極速：銀行卡代號=AUCTION_PAYMENT_CARD，計算筆數和充值金額(amount)總和
  const expressMatchCount = expressCardForApp.length;
  const expressMatchAmount = expressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 總計
  const totalMatchCount = normalMatchCount + expressMatchCount;
  const totalMatchAmount = normalMatchAmount + expressMatchAmount;

  // ===== 3. 訂單成功筆數/金額 =====
  // 一般卡：銀行卡代號有值且不是AUCTION_PAYMENT_CARD，到帳金額不為0，狀態有值且不是「未充值」「審核中(已超時)」
  const normalOrderSuccess = jisuRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('審核中(已超時)')
  );
  const normalOrderSuccessCount = normalOrderSuccess.length;
  const normalOrderSuccessAmount = normalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 極速：銀行卡代號=AUCTION_PAYMENT_CARD，到帳金額不為0，狀態有值且不是「未充值」「審核中(已超時)」
  const expressOrderSuccess = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('審核中(已超時)')
  );
  const expressOrderSuccessCount = expressOrderSuccess.length;
  const expressOrderSuccessAmount = expressOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 信評上分：到帳金額不為0且狀態包含「信用」
  const creditScoreSuccess = jisuRecords.filter(r =>
    r.receivedAmount > 0 && r.status && r.status.includes('信用')
  );
  const creditScoreSuccessCount = creditScoreSuccess.length;
  const creditScoreSuccessAmount = creditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 信評上分平均時間（通知時間-建立時間）
  const creditScoreWithTime = creditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const creditScoreAvgTime = creditScoreWithTime.length > 0
    ? creditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / creditScoreWithTime.length
    : 0;

  // 訂單成功總計
  const totalOrderSuccessCount = normalOrderSuccessCount + expressOrderSuccessCount;
  const totalOrderSuccessAmount = normalOrderSuccessAmount + expressOrderSuccessAmount;

  // ===== 4. 没信评降等配卡 =====
  // 條件：銀行卡代號不等於AUCTION_PAYMENT_CARD，到帳金額不為0，用戶等級不為0和-1
  const noCreditDowngradeRecords = jisuRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    r.userLevel !== '0' &&
    r.userLevel !== '-1'
  );

  // 依據充值金額區間計算筆數
  const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];
  const noCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => {
    noCreditDowngradeByAmount[amt] = noCreditDowngradeRecords.filter(r => r.amount === amt).length;
  });

  // 没信评降等配卡 - 平均時間
  // 條件：排除支付寶和微信商戶，用戶等級不為0和-1，到帳金額>0
  const noCreditDowngradeForAvgTime = jisuRecords.filter(r =>
    r.userLevel !== '0' &&
    r.userLevel !== '-1' &&
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const noCreditDowngradeAvgTime = noCreditDowngradeForAvgTime.length > 0
    ? noCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / noCreditDowngradeForAvgTime.length
    : 0;
  // 其他金額
  const knownAmounts = new Set(amountRanges);
  noCreditDowngradeByAmount['other'] = noCreditDowngradeRecords.filter(r => !knownAmounts.has(r.amount)).length;

  const noCreditDowngradeTotal = noCreditDowngradeRecords.length;

  // ===== 5. c2c =====
  // 數據範圍：排除支付寶、微信、qa、test、線下（jisuRecords已處理）

  // 標題：銀行卡代號=AUCTION_PAYMENT_CARD，到帳金額>0，狀態包含「用户确认到帐」
  const c2cRecords = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status && r.status.includes('用户确认到帐')
  );
  const c2cCount = c2cRecords.length;
  const c2cAmount = c2cRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 1. 點確認：狀態包含「用户确认到帐」且到帳金額>0
  const c2cConfirmRecords = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && r.status.includes('用户确认到帐')
  );
  const c2cConfirmCount = c2cConfirmRecords.length;

  // 2. 點確認的平均處理時間
  const c2cConfirmWithTime = c2cConfirmRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const c2cConfirmAvgTime = c2cConfirmWithTime.length > 0
    ? c2cConfirmWithTime.reduce((sum, r) => sum + r.processingTime, 0) / c2cConfirmWithTime.length
    : 0;

  // 3. 人工审核:通过：狀態包含「金額補單」且到帳金額>0，處理時間<=11分鐘
  const c2cManualAuditRecords = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && r.status.includes('金額補單') &&
    r.processingTime !== null &&
    r.processingTime >= 0 &&
    r.processingTime <= 660 // 11分鐘 = 660秒
  );
  const c2cManualAuditCount = c2cManualAuditRecords.length;

  // 4. 审核-成功平均時間：人工审核通过的平均處理時間
  const c2cAuditSuccessAvgTime = c2cManualAuditRecords.length > 0
    ? c2cManualAuditRecords.reduce((sum, r) => sum + r.processingTime, 0) / c2cManualAuditRecords.length
    : 0;

  // 5. 超過11min補件後才成功
  // Part 1: 金額補單, M>0, 處理時間 > 11分鐘
  const c2cOver11MinBuDanCount = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && r.status.includes('金額補單') &&
    r.processingTime !== null &&
    r.processingTime > 660 // > 11分鐘
  ).length;

  // Part 2: 支付宝商戶, 狀態含「商户确认」, M>0
  const c2cMerchantConfirmCount = records.filter(r => {
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    return hasAlipay &&
      r.receivedAmount > 0 &&
      r.status && r.status.includes('商户确认');
  }).length;

  const c2cOver11MinSuccessCount = c2cOver11MinBuDanCount + c2cMerchantConfirmCount;

  // ===== 支付寶商戶數據 =====
  const alipayRecords = records.filter(r => {
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    return hasAlipay;
  });

  // 支付寶 - 充值申請筆數
  const alipayNormalCardForApp = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode !== 'AUCTION_PAYMENT_CARD'
  );
  const alipayExpressCardForApp = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD'
  );
  const alipayApplicationCount = alipayNormalCardForApp.length + alipayExpressCardForApp.length;

  // 支付寶 - 成功配對
  const alipayNormalMatchCount = alipayNormalCardForApp.length;
  const alipayNormalMatchAmount = alipayNormalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const alipayExpressMatchCount = alipayExpressCardForApp.length;
  const alipayExpressMatchAmount = alipayExpressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const alipayTotalMatchCount = alipayNormalMatchCount + alipayExpressMatchCount;
  const alipayTotalMatchAmount = alipayNormalMatchAmount + alipayExpressMatchAmount;

  // 支付寶 - 訂單成功
  const alipayNormalOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('審核中(已超時)')
  );
  const alipayNormalOrderSuccessCount = alipayNormalOrderSuccess.length;
  const alipayNormalOrderSuccessAmount = alipayNormalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  const alipayExpressOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('審核中(已超時)')
  );
  const alipayExpressOrderSuccessCount = alipayExpressOrderSuccess.length;
  const alipayExpressOrderSuccessAmount = alipayExpressOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 支付寶 - 信評上分
  const alipayCreditScoreSuccess = alipayRecords.filter(r =>
    r.receivedAmount > 0 && r.status && r.status.includes('信用')
  );
  const alipayCreditScoreSuccessCount = alipayCreditScoreSuccess.length;
  const alipayCreditScoreSuccessAmount = alipayCreditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);
  const alipayCreditScoreWithTime = alipayCreditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const alipayCreditScoreAvgTime = alipayCreditScoreWithTime.length > 0
    ? alipayCreditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayCreditScoreWithTime.length
    : 0;

  const alipayTotalOrderSuccessCount = alipayNormalOrderSuccessCount + alipayExpressOrderSuccessCount;
  const alipayTotalOrderSuccessAmount = alipayNormalOrderSuccessAmount + alipayExpressOrderSuccessAmount;

  // 支付寶 - 没信评降等配卡
  const alipayNoCreditDowngradeRecords = alipayRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    r.userLevel !== '0' &&
    r.userLevel !== '-1'
  );
  const alipayNoCreditDowngradeTotal = alipayNoCreditDowngradeRecords.length;

  // 支付寶 - 平均時間
  const alipayNoCreditDowngradeForAvgTime = alipayRecords.filter(r =>
    r.userLevel !== '0' &&
    r.userLevel !== '-1' &&
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const alipayNoCreditDowngradeAvgTime = alipayNoCreditDowngradeForAvgTime.length > 0
    ? alipayNoCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayNoCreditDowngradeForAvgTime.length
    : 0;

  // ===== 微信商戶數據 =====
  const wechatRecords = records.filter(r => {
    const hasWechat = r.merchant.includes('微信');
    return hasWechat;
  });

  // 微信 - 充值申請筆數
  const wechatNormalCardForApp = wechatRecords.filter(r =>
    r.bankCardCode && r.bankCardCode !== 'AUCTION_PAYMENT_CARD'
  );
  const wechatExpressCardForApp = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD'
  );
  const wechatApplicationCount = wechatNormalCardForApp.length + wechatExpressCardForApp.length;

  // 微信 - 成功配對
  const wechatNormalMatchCount = wechatNormalCardForApp.length;
  const wechatNormalMatchAmount = wechatNormalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatExpressMatchCount = wechatExpressCardForApp.length;
  const wechatExpressMatchAmount = wechatExpressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatTotalMatchCount = wechatNormalMatchCount + wechatExpressMatchCount;
  const wechatTotalMatchAmount = wechatNormalMatchAmount + wechatExpressMatchAmount;

  // 微信 - 訂單成功
  const wechatNormalOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('審核中(已超時)')
  );
  const wechatNormalOrderSuccessCount = wechatNormalOrderSuccess.length;
  const wechatNormalOrderSuccessAmount = wechatNormalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  const wechatExpressOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('審核中(已超時)')
  );
  const wechatExpressOrderSuccessCount = wechatExpressOrderSuccess.length;
  const wechatExpressOrderSuccessAmount = wechatExpressOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 微信 - 信評上分
  const wechatCreditScoreSuccess = wechatRecords.filter(r =>
    r.receivedAmount > 0 && r.status && r.status.includes('信用')
  );
  const wechatCreditScoreSuccessCount = wechatCreditScoreSuccess.length;
  const wechatCreditScoreSuccessAmount = wechatCreditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);
  const wechatCreditScoreWithTime = wechatCreditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const wechatCreditScoreAvgTime = wechatCreditScoreWithTime.length > 0
    ? wechatCreditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / wechatCreditScoreWithTime.length
    : 0;

  const wechatTotalOrderSuccessCount = wechatNormalOrderSuccessCount + wechatExpressOrderSuccessCount;
  const wechatTotalOrderSuccessAmount = wechatNormalOrderSuccessAmount + wechatExpressOrderSuccessAmount;

  // 微信 - 没信评降等配卡
  const wechatNoCreditDowngradeRecords = wechatRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    r.userLevel !== '0' &&
    r.userLevel !== '-1'
  );
  const wechatNoCreditDowngradeTotal = wechatNoCreditDowngradeRecords.length;

  // 微信 - 平均時間
  const wechatNoCreditDowngradeForAvgTime = wechatRecords.filter(r =>
    r.userLevel !== '0' &&
    r.userLevel !== '-1' &&
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const wechatNoCreditDowngradeAvgTime = wechatNoCreditDowngradeForAvgTime.length > 0
    ? wechatNoCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / wechatNoCreditDowngradeForAvgTime.length
    : 0;

  // ===== 6. 商業平台 - 极速充提3(银行卡)_CNX交易所 =====
  // 充值_申请：bankCardCode不為空 且 merchant = "极速充提3(银行卡)_CNX交易所"
  const cnxRecords = records.filter(r =>
    r.bankCardCode && r.bankCardCode !== '' &&
    r.merchant === '极速充提3(银行卡)_CNX交易所'
  );
  const cnxApplicationCount = cnxRecords.length;
  const cnxApplicationAmount = cnxRecords.reduce((sum, r) => sum + r.amount, 0);

  // 充值成功筆數：狀態包含「已充值」且充值金額>0
  const cnxSuccessRecords = cnxRecords.filter(r =>
    r.status && r.status.includes('已充值') &&
    r.amount > 0
  );
  const cnxSuccessCount = cnxSuccessRecords.length;
  const cnxSuccessAmount = cnxSuccessRecords.reduce((sum, r) => sum + r.amount, 0);

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

    // 極速區域指標
    // 1. 充值申請
    jisuApplicationCount,
    normalCardAppCount: normalCardForApp.length,
    expressCardAppCount: expressCardForApp.length,
    // 2. 成功配對
    normalMatchCount,
    normalMatchAmount,
    expressMatchCount,
    expressMatchAmount,
    totalMatchCount,
    totalMatchAmount,
    // 3. 訂單成功
    normalOrderSuccessCount,
    normalOrderSuccessAmount,
    expressOrderSuccessCount,
    expressOrderSuccessAmount,
    creditScoreSuccessCount,
    creditScoreSuccessAmount,
    creditScoreAvgTime,
    totalOrderSuccessCount,
    totalOrderSuccessAmount,
    // 4. 没信评降等配卡
    noCreditDowngradeTotal,
    noCreditDowngradeByAmount,
    noCreditDowngradeAvgTime,
    // 5. c2c
    c2cCount,
    c2cAmount,
    c2cConfirmCount,
    c2cConfirmAvgTime,
    c2cManualAuditCount,
    c2cAuditSuccessAvgTime,
    c2cOver11MinSuccessCount,
    // 支付寶商戶
    alipayApplicationCount,
    alipayNormalCardAppCount: alipayNormalCardForApp.length,
    alipayExpressCardAppCount: alipayExpressCardForApp.length,
    alipayNormalMatchCount,
    alipayNormalMatchAmount,
    alipayExpressMatchCount,
    alipayExpressMatchAmount,
    alipayTotalMatchCount,
    alipayTotalMatchAmount,
    alipayNormalOrderSuccessCount,
    alipayNormalOrderSuccessAmount,
    alipayExpressOrderSuccessCount,
    alipayExpressOrderSuccessAmount,
    alipayCreditScoreSuccessCount,
    alipayCreditScoreSuccessAmount,
    alipayCreditScoreAvgTime,
    alipayTotalOrderSuccessCount,
    alipayTotalOrderSuccessAmount,
    alipayNoCreditDowngradeTotal,
    alipayNoCreditDowngradeAvgTime,
    // 微信商戶
    wechatApplicationCount,
    wechatNormalCardAppCount: wechatNormalCardForApp.length,
    wechatExpressCardAppCount: wechatExpressCardForApp.length,
    wechatNormalMatchCount,
    wechatNormalMatchAmount,
    wechatExpressMatchCount,
    wechatExpressMatchAmount,
    wechatTotalMatchCount,
    wechatTotalMatchAmount,
    wechatNormalOrderSuccessCount,
    wechatNormalOrderSuccessAmount,
    wechatExpressOrderSuccessCount,
    wechatExpressOrderSuccessAmount,
    wechatCreditScoreSuccessCount,
    wechatCreditScoreSuccessAmount,
    wechatCreditScoreAvgTime,
    wechatTotalOrderSuccessCount,
    wechatTotalOrderSuccessAmount,
    wechatNoCreditDowngradeTotal,
    wechatNoCreditDowngradeAvgTime,

    // 6. 商業平台
    cnxApplicationCount,
    cnxApplicationAmount,
    cnxSuccessCount,
    cnxSuccessAmount,

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

// ===== 提現 CSV 解析 =====
export const parseWithdrawCSV = (content) => {
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split('\n');
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const matches = line.match(/\"=\"\"([^\"]*)\"\"\"/g);
    if (!matches || matches.length < 20) continue;

    const clean = (m) => m.replace(/^\"=\"\"/, '').replace(/\"\"\"$/, '').trim();

    const record = {
      id: clean(matches[0]),
      parentId: clean(matches[1]),
      agent: clean(matches[2]),
      merchant: clean(matches[3]),
      platformOrderId: clean(matches[4]),
      merchantOrderId: clean(matches[5]),
      requestAmount: parseFloat(clean(matches[6]).replace(/,/g, '')) || 0,
      merchantRebate: parseFloat(clean(matches[7]).replace(/,/g, '')) || 0,
      actualAmount: parseFloat(clean(matches[8]).replace(/,/g, '')) || 0,
      receivingBank: clean(matches[9]),
      receivingCard: clean(matches[10]),
      receivingName: clean(matches[11]),
      receivingAddress: clean(matches[12]),
      poolId: clean(matches[13]),
      status: clean(matches[14]),
      merchantReceiveStatus: clean(matches[15]),
      notifyMerchantTime: clean(matches[16]),
      userId: clean(matches[17]),
      userLevel: clean(matches[18]),
      requestTime: clean(matches[19]),
      poolCreateTime: clean(matches[20]),
      remainPoolCreateTime: clean(matches[21]),
      transferId: clean(matches[22]),
      payoutMerchant: clean(matches[23]),
      payoutCardCode: clean(matches[24]),
      payoutBank: clean(matches[25]),
      payoutAccount: clean(matches[26]),
      payoutAmount: parseFloat(clean(matches[27]).replace(/,/g, '')) || 0,
      remark: matches[28] ? clean(matches[28]) : ''
    };

    // 計算處理時間（通知商戶時間 - 建立時間）
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

  console.log(`提現 CSV 解析完成：共 ${lines.length} 行，解析出 ${records.length} 筆有效記錄`);
  return records;
};

// 計算提現指標
export const calculateWithdrawMetrics = (records) => {
  // 總提現筆數（以實際轉出金額 > 0 為準）
  const successRecords = records.filter(r => r.actualAmount > 0);
  const totalWithdrawCount = successRecords.length;

  // 總提現金額
  const totalWithdrawAmount = successRecords.reduce((sum, r) => sum + r.actualAmount, 0);

  // 提現狀態分佈
  const statusDistribution = {};
  records.forEach(r => {
    const status = r.status || '未知';
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  });

  // 平均處理時間
  const recordsWithTime = records.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const avgProcessingTime = recordsWithTime.length > 0
    ? recordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / recordsWithTime.length
    : 0;

  return {
    totalWithdrawCount,
    totalWithdrawAmount,
    statusDistribution,
    avgProcessingTime,
    totalRecords: records.length
  };
};
