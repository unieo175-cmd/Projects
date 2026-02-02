// CSV Parser utility for payment data
export const parseCSV = (content) => {
  // 移除 BOM 字元
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split('\n');
  const records = [];

  // ===== 資料清洗統計 =====
  let totalRows = 0;
  let skippedEmpty = 0;
  let skippedShortColumns = 0;
  let skippedTestQa = 0;

  // Status categories based on specification
  const successStatuses = ['已充值', '信用評分上分', '回單驗證上分', '用戶确认到账', '用户确认到帐', '银商确认到账', '信評上分', '自動補單', '商戶回調上分'];
  const buDanKeywords = ['補單', '补单'];
  const weiChongZhiKeywords = ['未充值'];

  for (let i = 1; i < lines.length; i++) {
    totalRows++;
    const line = lines[i];
    if (!line.trim()) {
      skippedEmpty++;
      continue;
    }

    // 支援兩種 CSV 格式：
    // 1. Excel 格式: "=""value"""
    // 2. Google Sheets 格式: value 或 "value"
    let matches = line.match(/"=""([^"]*)"""/g);
    let clean;

    if (matches && matches.length >= 20) {
      // Excel 格式
      clean = (m) => m.replace(/^"=""/, '').replace(/"""$/, '').trim();
    } else {
      // Google Sheets 普通 CSV 格式 - 使用 CSV 解析
      matches = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          matches.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      matches.push(current); // 最后一个栏位

      if (matches.length < 20) {
        skippedShortColumns++;
        continue;
      }
      clean = (m) => (m || '').trim();
    }

    // 标准化银行名称（移除「行动」前缀，简体转繁体）
    const normalizeBankName = (name) => {
      // 简体转繁体对照表（常见银行名称用字）
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
      receivedAmount: parseFloat(clean(matches[12]).replace(/,/g, '')) || 0,  // AP栏：实际到账金额
      status: clean(matches[13]),  // N栏：状态
      merchantReceiveStatus: clean(matches[14]),
      merchantCreditStatus: clean(matches[15]),
      requestTime: clean(matches[16]).replace(/\//g, '-'),  // Q栏：请求日期，统一格式为 YYYY-MM-DD
      detailReceiveTime: clean(matches[17]),
      detailArriveTime: clean(matches[18]),
      notifyMerchantTime: clean(matches[19]),  // T栏：通知商户时间
      userId: matches[21] ? clean(matches[21]) : '',
      userIP: matches[22] ? clean(matches[22]) : '',
      userLevel: matches[23] ? clean(matches[23]) : '',
      receiptVerifyResultTime: matches[37] ? clean(matches[37]) : '',  // AL栏：回单验证结果时间
      anProcessingTime: matches[39] ? clean(matches[39]) : '',  // AN栏：处理时间（已计算好的值）
      aoStatus: matches[40] ? clean(matches[40]) : '',  // AO栏：状态（用于微信平均处理时间过滤）
    };

    // 正规化状态（去除多余字体）
    const normalizeStatus = (status) => {
      if (!status) return status;
      if (status.startsWith('微信補單') || status.startsWith('微信补单')) return '微信补单';
      if (status.startsWith('用户确认到帐') || status.startsWith('用戶確認到帳')) return '用户确认到帐';
      if (status.startsWith('明細補單') || status.startsWith('明细补单')) return '明细补单';
      if (status.startsWith('金额补单') || status.startsWith('金额补单')) return '金额补单';
      if (status.startsWith('未充值')) return '未充值';
      if (status.startsWith('信用評分上分<br>') || status.startsWith('信用评分上分<br>')) return '信用評分上分';
      if (status.startsWith('審核中') || status.startsWith('审核中')) return '审核中(已超时)';
      if (status.startsWith('图文复核(已超时)') || status.startsWith('图文复核(已超时)')) return '图文复核(已超时)';
      return status;
    };
    record.normalizedStatus = normalizeStatus(record.status);

    // AO栏：是否自动充值 - 根据 Excel 公式判断
    // 关键字：已充值、信用评分上分、回单验证上分、用户确认到账、用户确认到帐、银商确认到账、信评上分、自动补单
    record.isAutoDeposit =
      record.status.includes('已充值') ||
      record.status.includes('信用評分上分') ||
      record.status.includes('回單驗證上分') ||
      record.status.includes('用戶确认到账') ||
      record.status.includes('用户确认到帐') ||
      record.status.includes('银商确认到账') ||
      record.status.includes('信評上分') ||
      record.status.includes('自動補單') || record.status.includes('自动补单');

    // Categorize status (保留原有邏輯)
    record.isSuccess = record.isAutoDeposit && record.receivedAmount > 0;
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

    // AN栏：处理时间 - 直接使用 Google Sheets 已计算好的值
    // 格式为 HH:MM:SS，需转换为秒数
    record.processingTime = null;

    const parseTimeToSeconds = (timeStr) => {
      if (!timeStr || timeStr.trim() === '') return null;
      const parts = timeStr.split(':');
      if (parts.length === 3) {
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const s = parseInt(parts[2], 10) || 0;
        return h * 3600 + m * 60 + s;
      }
      return null;
    };

    // 優先使用 AN 欄的值
    if (record.anProcessingTime) {
      record.processingTime = parseTimeToSeconds(record.anProcessingTime);
    }

    // 如果 AN 栏为空，fallback 到计算 T-Q 或 AL-Q
    if (record.processingTime === null) {
      const parseDateTime = (dateStr) => {
        if (!dateStr || dateStr.includes('0000-00-00') || dateStr === '0000-00-00 00:00:00') return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
      };

      const reqTime = parseDateTime(record.requestTime);
      const notifyTime = parseDateTime(record.notifyMerchantTime);
      const receiptTime = parseDateTime(record.receiptVerifyResultTime);

      if (reqTime) {
        if (notifyTime) {
          const diff = (notifyTime - reqTime) / 1000;
          if (diff >= 0 && diff <= 86400) {
            record.processingTime = diff;
          }
        }
        if (record.processingTime === null && receiptTime) {
          const diff = (receiptTime - reqTime) / 1000;
          if (diff >= 0 && diff <= 86400) {
            record.processingTime = diff;
          }
        }
      }
    }

    // AN栏：是否3分钟内 (<=180秒)
    record.isWithin3Min = record.processingTime !== null && record.processingTime < 180;

    // 过滤掉商户名称包含「test」、「qa」的记录（不剔除线下商户）
    const merchantLower = record.merchant.toLowerCase();
    if (merchantLower.includes('test') || merchantLower.includes('qa')) {
      skippedTestQa++;
      continue;
    }

    records.push(record);
  }

  // ===== 輸出資料清洗統計 =====
  console.log('='.repeat(60));
  console.log('【充值 CSV 資料清洗結果】');
  console.log(`  CSV 總行數（不含標題）: ${totalRows.toLocaleString()}`);
  console.log(`  跳過（空行）: ${skippedEmpty.toLocaleString()}`);
  console.log(`  跳過（欄位不足）: ${skippedShortColumns.toLocaleString()}`);
  console.log(`  跳過（test/qa 商戶）: ${skippedTestQa.toLocaleString()}`);
  console.log(`  清洗後有效記錄數: ${records.length.toLocaleString()}`);
  console.log('='.repeat(60));

  return records;
};

// ===== 优化版计算函数 - 使用单次遍历 =====
export const calculateMetrics = (records, withdrawMetrics = null, dataDate = null) => {
  const startTime = performance.now();
  const TIMEOUT_MS = 180000; // 180秒超时

  // 超时检查函数
  const checkTimeout = () => {
    if (performance.now() - startTime > TIMEOUT_MS) {
      throw new Error('计算超时，请减少数据量后重试');
    }
  };

  // ===== 预定义常量和帮助函数 =====
  const AUCTION_CARD = 'AUCTION_PAYMENT_CARD';
  const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];
  const amountRangesSet = new Set(amountRanges);

  // 三方代收判断函数
  const isThirdPartyDahaomen = (code) => code && (code.startsWith('GB-Dahaomen') || code.startsWith('Dahaomen'));
  const isThirdPartyHuitong = (code) => code && code.startsWith('HTc2c');
  const isThirdPartyDoudou = (code) => code && code.startsWith('DDF');
  const isThirdPartyUC = (code) => code && code.toLowerCase().startsWith('uc1020');
  const isKnownThirdParty = (code) => isThirdPartyHuitong(code) || isThirdPartyDoudou(code) || isThirdPartyUC(code);

  // ===== 初始化累加器 =====
  // 全局指标
  let successfulCount = 0, successfulAmount = 0;
  let invalidApplicationCount = 0;
  let dropOrderCount = 0;
  let recordsWithAmountAndTimeSum = 0, recordsWithAmountAndTimeCount = 0;

  // 分钟分析
  let minuteAnalysisTotalCount = 0, minuteAnalysisTotalAmount = 0;
  let minuteWithin2MinCount = 0, minuteWithin2MinAmount = 0;
  let minuteWithin2to3MinCount = 0, minuteWithin2to3MinAmount = 0;
  let minuteWithin3to5MinCount = 0, minuteWithin3to5MinAmount = 0;
  let minuteWithin5to15MinCount = 0, minuteWithin5to15MinAmount = 0;
  let minuteWithin15to30MinCount = 0, minuteWithin15to30MinAmount = 0;
  let minuteOver30MinCount = 0, minuteOver30MinAmount = 0;
  let minuteInvalidCount = 0, minuteDropCount = 0;
  let minuteAnalysisTimeSum = 0, minuteAnalysisTimeCount = 0;

  // 旧时间分布
  let within2MinCount = 0, within3to5MinCount = 0, within5to15MinCount = 0, within15to30MinCount = 0, over30MinCount = 0;
  let validRecordsCount = 0, invalidRecordsCount = 0;
  let validWithTimeSum = 0, validWithTimeCount = 0;
  const sortedTimesArray = [];

  // 极速区域（银行卡）
  let normalCardAppCount = 0, expressCardAppCount = 0, waitingForMatchCount = 0;
  let normalMatchAmount = 0, expressMatchAmount = 0;
  let normalOrderSuccessCount = 0, normalOrderSuccessAmount = 0;
  let expressOrderSuccessCount = 0, expressOrderSuccessAmount = 0;
  let creditScoreSuccessCount = 0, creditScoreSuccessAmount = 0, creditScoreTimeSum = 0, creditScoreTimeCount = 0;
  let creditScoreNoImageCount = 0, creditScoreNoImageTimeSum = 0, creditScoreNoImageTimeCount = 0;
  const noCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => { noCreditDowngradeByAmount[amt] = 0; });
  noCreditDowngradeByAmount['other'] = 0;
  let noCreditDowngradeTotal = 0;
  let noCreditDowngradeTimeSum = 0, noCreditDowngradeTimeCount = 0;

  // c2c (银行卡)
  let c2cCount = 0, c2cAmount = 0, c2cConfirmCount = 0, c2cConfirmTimeSum = 0, c2cConfirmTimeCount = 0;
  let c2cManualAuditCount = 0, c2cAuditTimeSum = 0;
  let c2cOver11MinSuccessCount = 0, c2cFraudBlacklistCount = 0, c2cCardVerifyCount = 0;

  // 三方代收（银行卡）
  let thirdPartyCount = 0, thirdPartyAmount = 0;
  let thirdPartyDahaomenCount = 0, thirdPartyDahaomenAmount = 0;
  let thirdPartyHuitongCount = 0, thirdPartyHuitongAmount = 0;
  let thirdPartyDoudouCount = 0, thirdPartyDoudouAmount = 0;
  let thirdPartyUCCount = 0, thirdPartyUCAmount = 0;
  let thirdPartyOtherCount = 0, thirdPartyOtherAmount = 0;

  // 支付宝
  let alipayNormalCardAppCount = 0, alipayExpressCardAppCount = 0, alipayJisuTikaCount = 0, alipayJisuTibaoCount = 0;
  let alipayWaitingForMatchCount = 0;
  let alipayNormalMatchAmount = 0, alipayExpressBaoMatchAmount = 0, alipayJisuTikaMatchAmount = 0, alipayJisuTibaoMatchAmount = 0;
  let alipayNormalOrderSuccessCount = 0, alipayNormalOrderSuccessAmount = 0;
  let alipayBaoOrderSuccessCount = 0, alipayBaoOrderSuccessAmount = 0;
  let alipayJisuTikaOrderSuccessCount = 0, alipayJisuTikaOrderSuccessAmount = 0;
  let alipayJisuTibaoOrderSuccessCount = 0, alipayJisuTibaoOrderSuccessAmount = 0;
  let alipayCreditScoreSuccessCount = 0, alipayCreditScoreSuccessAmount = 0, alipayCreditScoreTimeSum = 0, alipayCreditScoreTimeCount = 0;
  let alipayCreditNoTuwenCount = 0, alipayCreditNoTuwenTimeSum = 0, alipayCreditNoTuwenTimeCount = 0;
  const alipayNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => { alipayNoCreditDowngradeByAmount[amt] = 0; });
  alipayNoCreditDowngradeByAmount['other'] = 0;
  let alipayNoCreditDowngradeTotal = 0;
  let alipayNoCreditDowngradeTimeSum = 0, alipayNoCreditDowngradeTimeCount = 0;

  // 支付宝 c2c
  let alipayC2cCount = 0, alipayC2cAmount = 0, alipayC2cConfirmCount = 0, alipayC2cConfirmTimeSum = 0, alipayC2cConfirmTimeCount = 0;
  let alipayC2cManualAuditCount = 0, alipayC2cAuditTimeSum = 0;
  let alipayC2cOver11MinSuccessCount = 0, alipayC2cFraudBlacklistCount = 0, alipayC2cCardVerifyCount = 0;

  // 支付宝三方代收
  let alipayThirdPartyCount = 0, alipayThirdPartyAmount = 0;
  let alipayThirdPartyDahaomenCount = 0, alipayThirdPartyDahaomenAmount = 0;
  let alipayThirdPartyHuitongCount = 0, alipayThirdPartyHuitongAmount = 0;
  let alipayThirdPartyDoudouCount = 0, alipayThirdPartyDoudouAmount = 0;
  let alipayThirdPartyUCCount = 0, alipayThirdPartyUCAmount = 0;
  let alipayThirdPartyOtherCount = 0, alipayThirdPartyOtherAmount = 0;

  // 支付宝宝转卡/宝转宝
  let alipayBaoZhuanKaCount = 0, alipayBaoZhuanKaAmount = 0, alipayBaoZhuanKaSuccessCount = 0, alipayBaoZhuanKaSuccessAmount = 0;
  let alipayBaoZhuanBaoCount = 0, alipayBaoZhuanBaoAmount = 0, alipayBaoZhuanBaoSuccessCount = 0, alipayBaoZhuanBaoSuccessAmount = 0;

  // 微信
  let wechatNormalCardAppCount = 0, wechatExpressBaoAppCount = 0, wechatJisuTikaAppCount = 0, wechatJisuTibaoAppCount = 0;
  let wechatWaitingForMatchCount = 0;
  let wechatNormalMatchAmount = 0, wechatExpressBaoMatchAmount = 0, wechatJisuTikaMatchAmount = 0, wechatJisuTibaoMatchAmount = 0;
  let wechatNormalOrderSuccessCount = 0, wechatNormalOrderSuccessAmount = 0;
  let wechatBaoOrderSuccessCount = 0, wechatBaoOrderSuccessAmount = 0;
  let wechatJisuTikaOrderSuccessCount = 0, wechatJisuTikaOrderSuccessAmount = 0;
  let wechatJisuTibaoOrderSuccessCount = 0, wechatJisuTibaoOrderSuccessAmount = 0;
  let wechatCreditScoreSuccessCount = 0, wechatCreditScoreSuccessAmount = 0, wechatCreditScoreTimeSum = 0, wechatCreditScoreTimeCount = 0;
  const wechatNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => { wechatNoCreditDowngradeByAmount[amt] = 0; });
  wechatNoCreditDowngradeByAmount['other'] = 0;
  let wechatNoCreditDowngradeTotal = 0;
  let wechatNoCreditDowngradeTimeSum = 0, wechatNoCreditDowngradeTimeCount = 0;

  // CNX
  let cnxApplicationCount = 0, cnxApplicationAmount = 0, cnxSuccessCount = 0, cnxSuccessAmount = 0;

  // JS等待无配对
  let bankCardWaitingNoMatch = 0, alipayWaitingNoMatch = 0;

  // 微信平均时间正则
  const wechatValidStatusPattern = /信用評分上分|金额补单|银商确认到账|回單驗證上分|用户确认到帐|已充值\(短信\)|已充值\(微信短信\)|已充值|回單隨機信評上分|信用評分上分\(圖文覆核\)|明细补单/;

  // ===== 单次遍历所有记录 =====
  const len = records.length;
  for (let i = 0; i < len; i++) {
    // 每10000条检查一次超时
    if (i % 10000 === 0) checkTimeout();

    const r = records[i];
    const merchant = r.merchant || '';
    const merchantLower = merchant.toLowerCase();
    const bankCardCode = r.bankCardCode || '';
    const bankName = r.bankName || '';
    const status = r.status || '';
    const normalizedStatus = r.normalizedStatus || '';
    const receivedAmount = r.receivedAmount || 0;
    const amount = r.amount || 0;
    const processingTime = r.processingTime;
    const hasValidTime = processingTime !== null && processingTime >= 0;
    const userLevel = parseFloat(r.userLevel) || 0;

    // 商户类型判断（预计算）
    const hasJiSu = merchant.includes('极速充提3');
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');
    const hasWechat = merchant.includes('微信');
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = merchant.includes('線下') || merchant.includes('线下');

    // 银行名称判断
    const isBaoBank = bankName === '支付宝' || bankName === '支付宝(企)' || bankName === '微信支付';
    const isAuctionCard = bankCardCode === AUCTION_CARD;

    // 状态判断
    const hasBuDan = status.includes('補') || status.includes('补');
    const hasCredit = status.includes('信用');
    const hasUserConfirm = status.includes('用户确认到帐');
    const hasBuDanStatus = status.includes('金額補單') || status.includes('金额补单');
    const hasMerchantConfirm = status.includes('商户确认到帐');
    const isNotCharged = normalizedStatus === '未充值';
    const isTimeout = normalizedStatus === '审核中(已超时)' || normalizedStatus === '图文复核(已超时)';

    // ===== 全局指标 =====
    // 分类记录
    // 總申請 = (銀行卡 + 支付寶 + 微信) + 線下
    const isInBankCard = hasJiSu && !hasAlipay && !hasWechat;
    const isInAlipay = hasAlipay;
    const isInWechat = hasWechat;
    const isInOffline = hasOffline && !hasAlipay && !hasWechat && !hasJiSu; // 線下且非其他分類
    const isInCategory = isInBankCard || isInAlipay || isInWechat || isInOffline;

    if (isInCategory) {
      if (receivedAmount > 0) {
        successfulCount++;
        successfulAmount += receivedAmount;
        if (hasBuDan) dropOrderCount++;

        // 分钟分析
        minuteAnalysisTotalCount++;
        minuteAnalysisTotalAmount += receivedAmount;
        if (hasValidTime) {
          minuteAnalysisTimeSum += processingTime;
          minuteAnalysisTimeCount++;
          if (processingTime < 120) { minuteWithin2MinCount++; minuteWithin2MinAmount += receivedAmount; }
          else if (processingTime < 180) { minuteWithin2to3MinCount++; minuteWithin2to3MinAmount += receivedAmount; }
          else if (processingTime < 300) { minuteWithin3to5MinCount++; minuteWithin3to5MinAmount += receivedAmount; }
          else if (processingTime < 900) { minuteWithin5to15MinCount++; minuteWithin5to15MinAmount += receivedAmount; }
          else if (processingTime < 1800) { minuteWithin15to30MinCount++; minuteWithin15to30MinAmount += receivedAmount; }
          else { minuteOver30MinCount++; minuteOver30MinAmount += receivedAmount; }
        }
        if (hasBuDan) minuteDropCount++;
      } else if (bankCardCode) {
        invalidApplicationCount++;
        minuteInvalidCount++;
      }
    }

    // 平均时间（全局）
    if (receivedAmount > 0 && hasValidTime) {
      recordsWithAmountAndTimeSum += processingTime;
      recordsWithAmountAndTimeCount++;
    }

    // 旧版时间分布
    if (!r.isInvalid) {
      validRecordsCount++;
      if (hasValidTime) {
        validWithTimeSum += processingTime;
        validWithTimeCount++;
        sortedTimesArray.push(processingTime);
        if (processingTime < 120) within2MinCount++;
        else if (processingTime < 300) within3to5MinCount++;
        else if (processingTime < 900) within5to15MinCount++;
        else if (processingTime < 1800) within15to30MinCount++;
        else over30MinCount++;
      }
    } else {
      invalidRecordsCount++;
    }

    // ===== 极速区域（银行卡）处理 =====
    const isJisuRecord = hasJiSu && !hasAlipay && !hasWechat && !hasTest && !hasQa && !hasOffline;
    if (isJisuRecord) {
      // 充值申请分类
      if (bankCardCode) {
        if (isAuctionCard) {
          expressCardAppCount++;
          expressMatchAmount += amount;
        } else {
          normalCardAppCount++;
          normalMatchAmount += amount;
        }
      } else {
        waitingForMatchCount++;
        bankCardWaitingNoMatch++;
      }

      // 订单成功
      if (bankCardCode && !isAuctionCard && !isNotCharged && !isTimeout) {
        normalOrderSuccessCount++;
        normalOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && receivedAmount > 0 && status && !status.includes('未充值') && !status.includes('审核中(已超时)')) {
        expressOrderSuccessCount++;
        expressOrderSuccessAmount += receivedAmount;
      }

      // 信评上分
      if (receivedAmount > 0 && hasCredit) {
        creditScoreSuccessCount++;
        creditScoreSuccessAmount += receivedAmount;
        if (hasValidTime) {
          creditScoreTimeSum += processingTime;
          creditScoreTimeCount++;
        }
      }
      // 信评不含图文复核
      if (isAuctionCard && receivedAmount > 0 && hasCredit && status !== '信用評分上分(圖文覆核)') {
        creditScoreNoImageCount++;
        if (hasValidTime) {
          creditScoreNoImageTimeSum += processingTime;
          creditScoreNoImageTimeCount++;
        }
      }

      // 没信评降等配卡
      if (!isAuctionCard && receivedAmount !== 0 && userLevel !== 0 && userLevel !== -1) {
        noCreditDowngradeTotal++;
        const roundedAmt = Math.round(amount);
        if (amountRangesSet.has(roundedAmt)) {
          noCreditDowngradeByAmount[roundedAmt]++;
        } else {
          noCreditDowngradeByAmount['other']++;
        }
      }
      // 没信评平均时间
      if (receivedAmount > 0 && hasValidTime) {
        noCreditDowngradeTimeSum += processingTime;
        noCreditDowngradeTimeCount++;
      }

      // c2c
      if (isAuctionCard && receivedAmount > 0 && hasUserConfirm) {
        c2cCount++;
        c2cAmount += receivedAmount;
      }
      if (receivedAmount > 0 && hasUserConfirm) {
        c2cConfirmCount++;
        if (hasValidTime) {
          c2cConfirmTimeSum += processingTime;
          c2cConfirmTimeCount++;
        }
      }
      // 人工审核
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime <= 660) {
        c2cManualAuditCount++;
        c2cAuditTimeSum += processingTime;
      }
      // 超过11min补件后成功
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 660) {
        c2cOver11MinSuccessCount++;
      }
      if (bankCardCode && bankCardCode.includes('AUCTION_PAYMENT_CARD') && receivedAmount > 0 && hasMerchantConfirm) {
        c2cOver11MinSuccessCount++;
      }

      // 三方代收
      if (bankCardCode && receivedAmount > 0 && !hasOffline) {
        const codeLower = bankCardCode.toLowerCase();
        if (isThirdPartyHuitong(bankCardCode)) {
          thirdPartyCount++; thirdPartyAmount += receivedAmount;
          thirdPartyHuitongCount++; thirdPartyHuitongAmount += receivedAmount;
        } else if (isThirdPartyDoudou(bankCardCode)) {
          thirdPartyCount++; thirdPartyAmount += receivedAmount;
          thirdPartyDoudouCount++; thirdPartyDoudouAmount += receivedAmount;
        } else if (isThirdPartyUC(bankCardCode)) {
          thirdPartyCount++; thirdPartyAmount += receivedAmount;
          thirdPartyUCCount++; thirdPartyUCAmount += receivedAmount;
        } else if (isThirdPartyDahaomen(bankCardCode)) {
          thirdPartyCount++; thirdPartyAmount += receivedAmount;
          thirdPartyDahaomenCount++; thirdPartyDahaomenAmount += receivedAmount;
          thirdPartyOtherCount++; thirdPartyOtherAmount += receivedAmount;
        } else if (!codeLower.startsWith('gb') && !codeLower.startsWith('auction')) {
          thirdPartyCount++; thirdPartyAmount += receivedAmount;
          thirdPartyOtherCount++; thirdPartyOtherAmount += receivedAmount;
        }
      }
    }

    // ===== 支付宝商户处理 =====
    const isAlipayRecord = hasAlipay && !hasTest && !hasQa && !hasOffline;
    if (isAlipayRecord) {
      // 充值申请分类
      if (!bankCardCode) {
        alipayWaitingForMatchCount++;
        alipayWaitingNoMatch++;
      } else if (isAuctionCard) {
        if (isBaoBank) {
          alipayJisuTibaoCount++;
          alipayJisuTibaoMatchAmount += amount;
        } else {
          alipayJisuTikaCount++;
          alipayJisuTikaMatchAmount += amount;
        }
      } else {
        if (isBaoBank) {
          alipayExpressCardAppCount++;
          alipayExpressBaoMatchAmount += amount;
        } else {
          alipayNormalCardAppCount++;
          alipayNormalMatchAmount += amount;
        }
      }

      // 订单成功
      const isValidStatus = normalizedStatus && !isNotCharged && !isTimeout;
      if (bankCardCode && !isAuctionCard && !isBaoBank && isValidStatus) {
        alipayNormalOrderSuccessCount++;
        alipayNormalOrderSuccessAmount += receivedAmount;
      }
      if (bankCardCode && !isAuctionCard && isBaoBank && isValidStatus) {
        alipayBaoOrderSuccessCount++;
        alipayBaoOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && !isBaoBank && isValidStatus) {
        alipayJisuTikaOrderSuccessCount++;
        alipayJisuTikaOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && isBaoBank && isValidStatus) {
        alipayJisuTibaoOrderSuccessCount++;
        alipayJisuTibaoOrderSuccessAmount += receivedAmount;
      }

      // 信评上分
      if (status.includes('信用評分上分')) {
        alipayCreditScoreSuccessCount++;
        alipayCreditScoreSuccessAmount += receivedAmount;
        if (hasValidTime) {
          alipayCreditScoreTimeSum += processingTime;
          alipayCreditScoreTimeCount++;
        }
      }
      // 信评不含图文复核
      if (isAuctionCard && receivedAmount > 0 && status.includes('信用評分上分') && status !== '信用評分上分(圖文覆核)') {
        alipayCreditNoTuwenCount++;
        if (hasValidTime) {
          alipayCreditNoTuwenTimeSum += processingTime;
          alipayCreditNoTuwenTimeCount++;
        }
      }

      // 没信评降等配卡
      if (!isAuctionCard && receivedAmount !== 0 && userLevel !== 0 && userLevel !== -1) {
        alipayNoCreditDowngradeTotal++;
        const roundedAmt = Math.round(amount);
        if (amountRangesSet.has(roundedAmt)) {
          alipayNoCreditDowngradeByAmount[roundedAmt]++;
        } else {
          alipayNoCreditDowngradeByAmount['other']++;
        }
      }
      if (receivedAmount > 0 && hasValidTime) {
        alipayNoCreditDowngradeTimeSum += processingTime;
        alipayNoCreditDowngradeTimeCount++;
      }

      // 支付宝 c2c
      if (isAuctionCard && receivedAmount > 0 && hasUserConfirm) {
        alipayC2cCount++;
        alipayC2cAmount += receivedAmount;
      }
      if (receivedAmount > 0 && hasUserConfirm) {
        alipayC2cConfirmCount++;
        if (hasValidTime) {
          alipayC2cConfirmTimeSum += processingTime;
          alipayC2cConfirmTimeCount++;
        }
      }
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 0 && processingTime <= 660) {
        alipayC2cManualAuditCount++;
        alipayC2cAuditTimeSum += processingTime;
      }
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 660) {
        alipayC2cOver11MinSuccessCount++;
      }
      if (bankCardCode && bankCardCode.includes('AUCTION_PAYMENT_CARD') && receivedAmount > 0 && hasMerchantConfirm) {
        alipayC2cOver11MinSuccessCount++;
      }

      // 支付宝三方代收
      if (bankCardCode && receivedAmount > 0 && !hasOffline) {
        const codeLower = bankCardCode.toLowerCase();
        if (isThirdPartyHuitong(bankCardCode)) {
          alipayThirdPartyCount++; alipayThirdPartyAmount += receivedAmount;
          alipayThirdPartyHuitongCount++; alipayThirdPartyHuitongAmount += receivedAmount;
        } else if (isThirdPartyDoudou(bankCardCode)) {
          alipayThirdPartyCount++; alipayThirdPartyAmount += receivedAmount;
          alipayThirdPartyDoudouCount++; alipayThirdPartyDoudouAmount += receivedAmount;
        } else if (isThirdPartyUC(bankCardCode)) {
          alipayThirdPartyCount++; alipayThirdPartyAmount += receivedAmount;
          alipayThirdPartyUCCount++; alipayThirdPartyUCAmount += receivedAmount;
        } else if (isThirdPartyDahaomen(bankCardCode)) {
          alipayThirdPartyCount++; alipayThirdPartyAmount += receivedAmount;
          alipayThirdPartyDahaomenCount++; alipayThirdPartyDahaomenAmount += receivedAmount;
          alipayThirdPartyOtherCount++; alipayThirdPartyOtherAmount += receivedAmount;
        } else if (!codeLower.startsWith('gb') && !codeLower.startsWith('auction')) {
          alipayThirdPartyCount++; alipayThirdPartyAmount += receivedAmount;
          alipayThirdPartyOtherCount++; alipayThirdPartyOtherAmount += receivedAmount;
        }
      }

      // 宝转卡/宝转宝
      if (merchant.includes('转卡') && isAuctionCard && bankName === '支付宝') {
        alipayBaoZhuanKaCount++;
        alipayBaoZhuanKaAmount += amount;
        if (receivedAmount !== 0) {
          alipayBaoZhuanKaSuccessCount++;
          alipayBaoZhuanKaSuccessAmount += receivedAmount;
        }
      }
      if (merchant.includes('宝)') && isAuctionCard && bankName !== '支付宝') {
        alipayBaoZhuanBaoCount++;
        alipayBaoZhuanBaoAmount += amount;
        if (receivedAmount !== 0) {
          alipayBaoZhuanBaoSuccessCount++;
          alipayBaoZhuanBaoSuccessAmount += receivedAmount;
        }
      }
    }

    // ===== 微信商户处理 =====
    const isWechatRecord = hasWechat && !hasTest && !hasQa && !hasOffline;
    if (isWechatRecord) {
      // 充值申请分类
      if (!bankCardCode) {
        wechatWaitingForMatchCount++;
      } else if (isAuctionCard) {
        if (isBaoBank) {
          wechatJisuTibaoAppCount++;
          wechatJisuTibaoMatchAmount += amount;
        } else {
          wechatJisuTikaAppCount++;
          wechatJisuTikaMatchAmount += amount;
        }
      } else {
        if (isBaoBank) {
          wechatExpressBaoAppCount++;
          wechatExpressBaoMatchAmount += amount;
        } else {
          wechatNormalCardAppCount++;
          wechatNormalMatchAmount += amount;
        }
      }

      // 订单成功
      const isValidStatus = normalizedStatus && !isNotCharged && !isTimeout;
      if (bankCardCode && !isAuctionCard && !isBaoBank && isValidStatus) {
        wechatNormalOrderSuccessCount++;
        wechatNormalOrderSuccessAmount += receivedAmount;
      }
      if (bankCardCode && !isAuctionCard && isBaoBank && isValidStatus) {
        wechatBaoOrderSuccessCount++;
        wechatBaoOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && !isBaoBank && isValidStatus) {
        wechatJisuTikaOrderSuccessCount++;
        wechatJisuTikaOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && isBaoBank && isValidStatus) {
        wechatJisuTibaoOrderSuccessCount++;
        wechatJisuTibaoOrderSuccessAmount += receivedAmount;
      }

      // 微信信评上分
      if (receivedAmount > 0 && hasCredit) {
        wechatCreditScoreSuccessCount++;
        wechatCreditScoreSuccessAmount += receivedAmount;
        if (hasValidTime) {
          wechatCreditScoreTimeSum += processingTime;
          wechatCreditScoreTimeCount++;
        }
      }

      // 微信没信评降等配卡
      if (!isAuctionCard && receivedAmount !== 0 && userLevel !== 0 && userLevel !== -1) {
        wechatNoCreditDowngradeTotal++;
        const roundedAmt = Math.round(amount);
        if (amountRangesSet.has(roundedAmt)) {
          wechatNoCreditDowngradeByAmount[roundedAmt]++;
        } else {
          wechatNoCreditDowngradeByAmount['other']++;
        }
      }
      // 微信平均时间
      if (r.aoStatus && wechatValidStatusPattern.test(r.aoStatus) && hasValidTime) {
        wechatNoCreditDowngradeTimeSum += processingTime;
        wechatNoCreditDowngradeTimeCount++;
      }
    }

    // ===== CNX交易所 =====
    if (bankCardCode && merchant === '极速充提3(银行卡)_CNX交易所') {
      cnxApplicationCount++;
      cnxApplicationAmount += amount;
      if (status.includes('已充值') && amount > 0) {
        cnxSuccessCount++;
        cnxSuccessAmount += amount;
      }
    }
  }

  // ===== 计算衍生指标 =====
  checkTimeout();

  const noCard06Count = (dataDate === '2026-01-01') ? 2 : 0;
  const jisuApplicationCount = normalCardAppCount + expressCardAppCount + waitingForMatchCount + noCard06Count;
  const totalMatchCount = normalCardAppCount + expressCardAppCount;
  const totalMatchAmount = normalMatchAmount + expressMatchAmount;
  const totalOrderSuccessCount = normalOrderSuccessCount + expressOrderSuccessCount;
  const totalOrderSuccessAmount = normalOrderSuccessAmount + expressOrderSuccessAmount;
  const totalApplicationCount = successfulCount + invalidApplicationCount;

  // 支付宝合计
  const alipayApplicationCount = alipayNormalCardAppCount + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount;
  const alipayTotalMatchCount = alipayNormalCardAppCount + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount;
  const alipayTotalMatchAmount = alipayNormalMatchAmount + alipayExpressBaoMatchAmount + alipayJisuTikaMatchAmount + alipayJisuTibaoMatchAmount;
  const alipayTotalOrderSuccessCount = alipayNormalOrderSuccessCount + alipayBaoOrderSuccessCount + alipayJisuTikaOrderSuccessCount + alipayJisuTibaoOrderSuccessCount;
  const alipayTotalOrderSuccessAmount = alipayNormalOrderSuccessAmount + alipayBaoOrderSuccessAmount + alipayJisuTikaOrderSuccessAmount + alipayJisuTibaoOrderSuccessAmount;

  // 微信合计
  const wechatApplicationCount = wechatNormalCardAppCount + wechatExpressBaoAppCount + wechatJisuTikaAppCount + wechatJisuTibaoAppCount;
  const wechatTotalMatchCount = wechatNormalCardAppCount + wechatExpressBaoAppCount + wechatJisuTikaAppCount + wechatJisuTibaoAppCount;
  const wechatTotalMatchAmount = wechatNormalMatchAmount + wechatExpressBaoMatchAmount + wechatJisuTikaMatchAmount + wechatJisuTibaoMatchAmount;
  const wechatTotalOrderSuccessCount = wechatNormalOrderSuccessCount + wechatBaoOrderSuccessCount + wechatJisuTikaOrderSuccessCount + wechatJisuTibaoOrderSuccessCount;
  const wechatTotalOrderSuccessAmount = wechatNormalOrderSuccessAmount + wechatBaoOrderSuccessAmount + wechatJisuTikaOrderSuccessAmount + wechatJisuTibaoOrderSuccessAmount;

  // JS等待无配对
  const jsWaitingNoMatch = (bankCardWaitingNoMatch + 2) + alipayWaitingNoMatch;

  // 整体配对成功率
  const withdrawBankCardAmount = withdrawMetrics?.bankCardWithdrawAmount || 0;
  const withdrawAlipayAmount = withdrawMetrics?.alipayWithdrawAmount || 0;
  const alipayOverallMatchDenominator = withdrawAlipayAmount + withdrawBankCardAmount;
  const alipayOverallMatchNumerator = expressOrderSuccessAmount + alipayJisuTikaOrderSuccessAmount + alipayJisuTibaoOrderSuccessAmount;
  const alipayOverallMatchRate = alipayOverallMatchDenominator > 0 ? (alipayOverallMatchNumerator / alipayOverallMatchDenominator) * 100 : 0;

  // 中位数计算
  sortedTimesArray.sort((a, b) => a - b);
  const medianTime = sortedTimesArray.length > 0 ? sortedTimesArray[Math.floor(sortedTimesArray.length / 2)] : 0;

  const elapsed = performance.now() - startTime;
  console.log(`calculateMetrics 完成，耗时: ${elapsed.toFixed(2)}ms，处理 ${records.length} 条记录`);

  return {
    // 全部-重要信息指标
    totalApplicationCount,
    successfulCount,
    overallSuccessRate: totalApplicationCount > 0 ? (successfulCount / totalApplicationCount) * 100 : 0,
    totalApplicationAmount: successfulAmount,
    overallAvgTime: recordsWithAmountAndTimeCount > 0 ? recordsWithAmountAndTimeSum / recordsWithAmountAndTimeCount : 0,
    overallDropOrderCount: dropOrderCount,
    overallDropOrderRatio: successfulCount > 0 ? (dropOrderCount / successfulCount) * 100 : 0,
    invalidApplicationCount,
    invalidApplicationRatio: totalApplicationCount > 0 ? (invalidApplicationCount / totalApplicationCount) * 100 : 0,

    // 充值分钟分析
    minuteAnalysisTotalCount,
    minuteAnalysisTotalAmount,
    minuteWithin2MinCount,
    minuteWithin2MinAmount,
    minuteWithin2MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin2MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin2to3MinCount,
    minuteWithin2to3MinAmount,
    minuteWithin2to3MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin2to3MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin3to5MinCount,
    minuteWithin3to5MinAmount,
    minuteWithin3to5MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin3to5MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin5to15MinCount,
    minuteWithin5to15MinAmount,
    minuteWithin5to15MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin5to15MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin15to30MinCount,
    minuteWithin15to30MinAmount,
    minuteWithin15to30MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin15to30MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteOver30MinCount,
    minuteOver30MinAmount,
    minuteOver30MinRatio: minuteAnalysisTotalCount > 0 ? (minuteOver30MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteInvalidCount,
    minuteInvalidRatio: (minuteAnalysisTotalCount + minuteInvalidCount) > 0 ? (minuteInvalidCount / (minuteAnalysisTotalCount + minuteInvalidCount)) * 100 : 0,
    minuteDropCount,
    minuteDropRatio: minuteAnalysisTotalCount > 0 ? (minuteDropCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteAvgTime: minuteAnalysisTimeCount > 0 ? minuteAnalysisTimeSum / minuteAnalysisTimeCount : 0,

    // 时间分布指标
    within2MinCount,
    within2MinRatio: totalApplicationCount > 0 ? (within2MinCount / totalApplicationCount) * 100 : 0,
    within3to5MinCount,
    within3to5MinRatio: totalApplicationCount > 0 ? (within3to5MinCount / totalApplicationCount) * 100 : 0,
    within5to15MinCount,
    within5to15MinRatio: totalApplicationCount > 0 ? (within5to15MinCount / totalApplicationCount) * 100 : 0,
    within15to30MinCount,
    within15to30MinRatio: totalApplicationCount > 0 ? (within15to30MinCount / totalApplicationCount) * 100 : 0,
    over30MinCount,
    over30MinRatio: totalApplicationCount > 0 ? (over30MinCount / totalApplicationCount) * 100 : 0,
    invalidCount: invalidRecordsCount,
    invalidRatio: (totalApplicationCount + invalidRecordsCount) > 0 ? (invalidRecordsCount / (totalApplicationCount + invalidRecordsCount)) * 100 : 0,
    avgTimeSeconds: validWithTimeCount > 0 ? validWithTimeSum / validWithTimeCount : 0,
    medianTimeSeconds: medianTime,

    // 极速区域指标
    jisuApplicationCount,
    normalCardAppCount,
    expressCardAppCount,
    waitingForMatchCount,
    noCard06Count,
    normalMatchCount: normalCardAppCount,
    normalMatchAmount,
    expressMatchCount: expressCardAppCount,
    expressMatchAmount,
    totalMatchCount,
    totalMatchAmount,
    normalOrderSuccessCount,
    normalOrderSuccessAmount,
    expressOrderSuccessCount,
    expressOrderSuccessAmount,
    creditScoreSuccessCount,
    creditScoreSuccessAmount,
    creditScoreAvgTime: creditScoreTimeCount > 0 ? creditScoreTimeSum / creditScoreTimeCount : 0,
    creditScoreNoImageCount,
    creditScoreNoImageAvgTime: creditScoreNoImageTimeCount > 0 ? creditScoreNoImageTimeSum / creditScoreNoImageTimeCount : 0,
    totalOrderSuccessCount,
    totalOrderSuccessAmount,
    noCreditDowngradeTotal,
    noCreditDowngradeByAmount,
    noCreditDowngradeAvgTime: noCreditDowngradeTimeCount > 0 ? noCreditDowngradeTimeSum / noCreditDowngradeTimeCount : 0,

    // c2c
    c2cCount,
    c2cAmount,
    c2cConfirmCount,
    c2cConfirmAvgTime: c2cConfirmTimeCount > 0 ? c2cConfirmTimeSum / c2cConfirmTimeCount : 0,
    c2cManualAuditCount,
    c2cAuditSuccessAvgTime: c2cManualAuditCount > 0 ? c2cAuditTimeSum / c2cManualAuditCount : 0,
    c2cOver11MinSuccessCount,
    c2cFraudBlacklistCount,
    c2cCardVerifyCount,

    // 三方代收
    thirdPartyCount,
    thirdPartyAmount,
    thirdPartyDahaomenCount,
    thirdPartyDahaomenAmount,
    thirdPartyHuitongCount,
    thirdPartyHuitongAmount,
    thirdPartyDoudouCount,
    thirdPartyDoudouAmount,
    thirdPartyUCCount,
    thirdPartyUCAmount,
    thirdPartyOtherCount,
    thirdPartyOtherAmount,

    // 支付宝商户
    alipayApplicationCount,
    alipayNormalCardAppCount,
    alipayExpressCardAppCount,
    alipayJisuTikaCount,
    alipayJisuTibaoCount,
    alipayWaitingForMatchCount,
    alipayNormalMatchCount: alipayNormalCardAppCount,
    alipayNormalMatchAmount,
    alipayExpressBaoMatchAmount,
    alipayJisuTikaMatchAmount,
    alipayJisuTibaoMatchAmount,
    alipayTotalMatchCount,
    alipayTotalMatchAmount,
    alipayNormalOrderSuccessCount,
    alipayNormalOrderSuccessAmount,
    alipayBaoOrderSuccessCount,
    alipayBaoOrderSuccessAmount,
    alipayJisuTikaOrderSuccessCount,
    alipayJisuTikaOrderSuccessAmount,
    alipayJisuTibaoOrderSuccessCount,
    alipayJisuTibaoOrderSuccessAmount,
    alipayCreditScoreSuccessCount,
    alipayCreditScoreSuccessAmount,
    alipayCreditScoreAvgTime: alipayCreditScoreTimeCount > 0 ? alipayCreditScoreTimeSum / alipayCreditScoreTimeCount : 0,
    alipayCreditNoTuwenCount,
    alipayCreditNoTuwenAvgTime: alipayCreditNoTuwenTimeCount > 0 ? alipayCreditNoTuwenTimeSum / alipayCreditNoTuwenTimeCount : 0,
    alipayTotalOrderSuccessCount,
    alipayTotalOrderSuccessAmount,
    alipayNoCreditDowngradeTotal,
    alipayNoCreditDowngradeByAmount,
    alipayNoCreditDowngradeAvgTime: alipayNoCreditDowngradeTimeCount > 0 ? alipayNoCreditDowngradeTimeSum / alipayNoCreditDowngradeTimeCount : 0,
    alipayNoCard06Count: 0,

    // 支付宝 c2c
    alipayC2cCount,
    alipayC2cAmount,
    alipayC2cConfirmCount,
    alipayC2cConfirmAvgTime: alipayC2cConfirmTimeCount > 0 ? alipayC2cConfirmTimeSum / alipayC2cConfirmTimeCount : 0,
    alipayC2cManualAuditCount,
    alipayC2cAuditSuccessAvgTime: alipayC2cManualAuditCount > 0 ? alipayC2cAuditTimeSum / alipayC2cManualAuditCount : 0,
    alipayC2cOver11MinSuccessCount,
    alipayC2cFraudBlacklistCount,
    alipayC2cCardVerifyCount,

    // 支付宝三方代收
    alipayThirdPartyCount,
    alipayThirdPartyAmount,
    alipayThirdPartyDahaomenCount,
    alipayThirdPartyDahaomenAmount,
    alipayThirdPartyHuitongCount,
    alipayThirdPartyHuitongAmount,
    alipayThirdPartyDoudouCount,
    alipayThirdPartyDoudouAmount,
    alipayThirdPartyUCCount,
    alipayThirdPartyUCAmount,
    alipayThirdPartyOtherCount,
    alipayThirdPartyOtherAmount,

    // 支付宝宝转卡/宝转宝
    alipayBaoZhuanKaCount,
    alipayBaoZhuanKaAmount,
    alipayBaoZhuanKaSuccessCount,
    alipayBaoZhuanKaSuccessAmount,
    alipayBaoZhuanBaoCount,
    alipayBaoZhuanBaoAmount,
    alipayBaoZhuanBaoSuccessCount,
    alipayBaoZhuanBaoSuccessAmount,
    alipayOverallMatchRate,

    // 微信商户
    wechatApplicationCount,
    wechatNormalCardAppCount,
    wechatExpressBaoAppCount,
    wechatJisuTikaAppCount,
    wechatJisuTibaoAppCount,
    wechatWaitingForMatchCount,
    wechatNormalMatchCount: wechatNormalCardAppCount,
    wechatNormalMatchAmount,
    wechatExpressBaoMatchCount: wechatExpressBaoAppCount,
    wechatExpressBaoMatchAmount,
    wechatJisuTikaMatchCount: wechatJisuTikaAppCount,
    wechatJisuTikaMatchAmount,
    wechatJisuTibaoMatchCount: wechatJisuTibaoAppCount,
    wechatJisuTibaoMatchAmount,
    wechatTotalMatchCount,
    wechatTotalMatchAmount,
    wechatNormalOrderSuccessCount,
    wechatNormalOrderSuccessAmount,
    wechatBaoOrderSuccessCount,
    wechatBaoOrderSuccessAmount,
    wechatJisuTikaOrderSuccessCount,
    wechatJisuTikaOrderSuccessAmount,
    wechatJisuTibaoOrderSuccessCount,
    wechatJisuTibaoOrderSuccessAmount,
    wechatTotalOrderSuccessCount,
    wechatTotalOrderSuccessAmount,
    wechatCreditScoreSuccessCount,
    wechatCreditScoreSuccessAmount,
    wechatCreditScoreAvgTime: wechatCreditScoreTimeCount > 0 ? wechatCreditScoreTimeSum / wechatCreditScoreTimeCount : 0,
    wechatNoCreditDowngradeTotal,
    wechatNoCreditDowngradeByAmount,
    wechatNoCreditDowngradeAvgTime: wechatNoCreditDowngradeTimeCount > 0 ? wechatNoCreditDowngradeTimeSum / wechatNoCreditDowngradeTimeCount : 0,

    // CNX
    cnxApplicationCount,
    cnxApplicationAmount,
    cnxSuccessCount,
    cnxSuccessAmount,

    // JS等待无配对
    jsWaitingNoMatch,
  };
};

// ===== 保留旧版函数作为备份 =====
export const calculateMetricsLegacy = (records, withdrawMetrics = null, dataDate = null) => {
  // ===== 全部-重要信息 =====
  // 数据范围：排除 test/qa，不排除线下
  // 分类逻辑：依商户名称判断
  const allRecords = records;

  // 銀行卡：极速充提3 且不含支付宝/微信
  const bankCardForTotal = records.filter(r => {
    const hasJiSu = r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const hasWechat = r.merchant.includes('微信');
    return hasJiSu && !hasAlipay && !hasWechat;
  });

  // 支付寶：包含支付宝/支付寶
  const alipayForTotal = records.filter(r => {
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    return hasAlipay;
  });

  // 微信：包含微信
  const wechatForTotal = records.filter(r => {
    const hasWechat = r.merchant.includes('微信');
    return hasWechat;
  });

  // 其他：不符合银行卡、支付宝、微信的记录
  const otherForTotal = records.filter(r => {
    const hasJiSu = r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const hasWechat = r.merchant.includes('微信');
    // 不符合任何已知类别的记录
    return !hasAlipay && !hasWechat && !hasJiSu;
  });

  // 充值成功笔数 = 银行卡+支付宝+微信+其他 且 到账金额 > 0
  const allCategoryRecords = [...bankCardForTotal, ...alipayForTotal, ...wechatForTotal, ...otherForTotal];
  const successfulRecords = allCategoryRecords.filter(r => r.receivedAmount > 0);
  const successfulCount = successfulRecords.length;

  // 无效申请 = 到账金额 = 0 且 银行卡代号不为空（有配卡但未到账）
  const invalidApplicationRecords = allCategoryRecords.filter(r => r.receivedAmount === 0 && r.bankCardCode !== '');
  const invalidApplicationCount = invalidApplicationRecords.length;

  // 总申请笔数 = 总充值成功 + 无效申请
  const totalApplicationCount = successfulCount + invalidApplicationCount;

  // 成功率 = 充值成功笔数 / 总申请笔数
  const overallSuccessRate = totalApplicationCount > 0 ? (successfulCount / totalApplicationCount) * 100 : 0;

  // 无效申请比例 = 无效申请 / 总申请笔数
  const invalidApplicationRatio = totalApplicationCount > 0 ? (invalidApplicationCount / totalApplicationCount) * 100 : 0;

  // 总申请金额 = 充值成功笔数的金额加总
  const totalApplicationAmount = successfulRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 平均时间 = AVERAGEIFS(AN:AN, M:M, ">0")
  // AN = processingTime, M = receivedAmount
  // 计算所有 receivedAmount > 0 且 processingTime 有值的记录平均时间
  const recordsWithAmountAndTime = records.filter(r =>
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const overallAvgTime = recordsWithAmountAndTime.length > 0
    ? recordsWithAmountAndTime.reduce((sum, r) => sum + r.processingTime, 0) / recordsWithAmountAndTime.length
    : 0;

  // 掉单笔数 = 充值成功 (AP > 0) 且状态包含「补」
  const dropOrderRecords = successfulRecords.filter(r =>
    r.status && (r.status.includes('補') || r.status.includes('补'))
  );
  const dropOrderCount = dropOrderRecords.length;
  const dropOrderRatio = successfulCount > 0 ? (dropOrderCount / successfulCount) * 100 : 0;

  // ===== 充值成功时间区段 =====
  // 使用成功配对记录（与重要讯息一致：银行卡+支付宝+微信 成功配对）
  // 总充值成功（含掉单）= 成功配对 且 AP>0
  const minuteAnalysisRecords = allCategoryRecords.filter(r => r.receivedAmount > 0);
  const minuteAnalysisTotalCount = minuteAnalysisRecords.length;
  const minuteAnalysisTotalAmount = minuteAnalysisRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 有处理时间的成功记录
  const minuteAnalysisWithTime = minuteAnalysisRecords.filter(r =>
    r.processingTime !== null && r.processingTime >= 0
  );

  // 2分钟内 (< TIME(0,2,0))
  const minuteWithin2Min = minuteAnalysisWithTime.filter(r => r.processingTime < 120);
  const minuteWithin2MinAmount = minuteWithin2Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin2MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin2Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 2-3分钟 (>= TIME(0,2,0) 且 < TIME(0,3,0))
  const minuteWithin2to3Min = minuteAnalysisWithTime.filter(r => r.processingTime >= 120 && r.processingTime < 180);
  const minuteWithin2to3MinAmount = minuteWithin2to3Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin2to3MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin2to3Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 3-5分钟 (>= TIME(0,3,0) 且 < TIME(0,5,0))
  const minuteWithin3to5Min = minuteAnalysisWithTime.filter(r => r.processingTime >= 180 && r.processingTime < 300);
  const minuteWithin3to5MinAmount = minuteWithin3to5Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin3to5MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin3to5Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 5-15分钟 (>= TIME(0,5,0) 且 < TIME(0,15,0))
  const minuteWithin5to15Min = minuteAnalysisWithTime.filter(r => r.processingTime >= 300 && r.processingTime < 900);
  const minuteWithin5to15MinAmount = minuteWithin5to15Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin5to15MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin5to15Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 15-30分钟 (>= TIME(0,15,0) 且 < TIME(0,30,0))
  const minuteWithin15to30Min = minuteAnalysisWithTime.filter(r => r.processingTime >= 900 && r.processingTime < 1800);
  const minuteWithin15to30MinAmount = minuteWithin15to30Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin15to30MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin15to30Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 30分钟以上 (>= TIME(0,30,0))
  const minuteOver30Min = minuteAnalysisWithTime.filter(r => r.processingTime >= 1800);
  const minuteOver30MinAmount = minuteOver30Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteOver30MinRatio = minuteAnalysisTotalCount > 0 ? (minuteOver30Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 无效申请 = 到账金额=0 且 银行卡代号不为空（已成功配对但未到账）
  const minuteInvalidRecords = allCategoryRecords.filter(r => r.receivedAmount === 0 && r.bankCardCode !== '');
  const minuteInvalidCount = minuteInvalidRecords.length;
  const minuteTotalForRatio = minuteAnalysisTotalCount + minuteInvalidCount;
  const minuteInvalidRatio = minuteTotalForRatio > 0 ? (minuteInvalidCount / minuteTotalForRatio) * 100 : 0;

  // 掉单 = 成功配对 且 AP>0 且状态有补单字眼（与重要讯息一致）
  const minuteDropRecords = minuteAnalysisRecords.filter(r =>
    r.status && (r.status.includes('補') || r.status.includes('补'))
  );
  const minuteDropCount = minuteDropRecords.length;
  const minuteDropRatio = minuteAnalysisTotalCount > 0 ? (minuteDropCount / minuteAnalysisTotalCount) * 100 : 0;

  // 平均时间 = 成功配对 且 AP>0 的平均时间
  const minuteAvgTime = minuteAnalysisWithTime.length > 0
    ? minuteAnalysisWithTime.reduce((sum, r) => sum + r.processingTime, 0) / minuteAnalysisWithTime.length
    : 0;

  // 旧指标（保留向下兼容）
  const validRecords = records.filter(r => !r.isInvalid);
  const invalidRecords = records.filter(r => r.isInvalid);

  // 计算各时间区间的笔数
  const validWithTime = validRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);

  // 2分钟内 (< 120秒)
  const within2Min = validWithTime.filter(r => r.processingTime < 120);
  // 3-5分钟 (>= 120 且 < 300秒)
  const within3to5Min = validWithTime.filter(r => r.processingTime >= 120 && r.processingTime < 300);
  // 5-15分钟 (>= 300 且 < 900秒)
  const within5to15Min = validWithTime.filter(r => r.processingTime >= 300 && r.processingTime < 900);
  // 15-30分钟 (>= 900 且 < 1800秒)
  const within15to30Min = validWithTime.filter(r => r.processingTime >= 900 && r.processingTime < 1800);
  // 30分钟以上 (>= 1800秒)
  const over30Min = validWithTime.filter(r => r.processingTime >= 1800);

  // 计算平均时间 (不包含未充值的笔数)
  const avgTime = validWithTime.length > 0
    ? validWithTime.reduce((sum, r) => sum + r.processingTime, 0) / validWithTime.length
    : 0;

  // 中位数时间
  const sortedTimes = validWithTime.map(r => r.processingTime).sort((a, b) => a - b);
  const medianTime = sortedTimes.length > 0
    ? sortedTimes[Math.floor(sortedTimes.length / 2)]
    : 0;

  // 成功相关指标 (保留旧的)
  const successRecords = records.filter(r => r.isSuccess);
  const buDanRecords = records.filter(r => r.isBuDan && r.receivedAmount > 0);
  const totalAmount = records.filter(r => r.receivedAmount > 0).reduce((sum, r) => sum + r.receivedAmount, 0);

  const totalBase = totalApplicationCount + invalidRecords.length;

  // ===== 极速区域指标 =====
  // 资料范围：商户包含「极速充提3」且不包含支付宝、微信、test、qa、线下
  const jisuRecords = records.filter(r => {
    const hasJiSu = r.merchant.includes('极速充提3');
    const merchantLower = r.merchant.toLowerCase();
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const hasWechat = r.merchant.includes('微信');
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = r.merchant.includes('線下') || r.merchant.includes('线下');
    return hasJiSu && !hasAlipay && !hasWechat && !hasTest && !hasQa && !hasOffline;
  });

  // ===== 1. 充值申请笔数 =====
  // 一般卡：银行卡代号有值且不等于AUCTION_PAYMENT_CARD
  const normalCardForApp = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode !== 'AUCTION_PAYMENT_CARD'
  );
  // 极速：银行卡代号=AUCTION_PAYMENT_CARD
  const expressCardForApp = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD'
  );
  // 建单成功等待无配对：有商户名称但银行卡号为空
  const waitingForMatchCount = jisuRecords.filter(r => !r.bankCardCode).length;

  // 取无卡06提示：来自外部资料（极速06统计表）
  // 只有 2026-01-01 的数据显示 2，其他日期显示 0
  const noCard06Count = (dataDate === '2026-01-01') ? 2 : 0;

  // 充值申请笔数 = 一般卡 + 极速提 + 建单成功等待无配对 + 取无卡06提示
  const jisuApplicationCount = normalCardForApp.length + expressCardForApp.length + waitingForMatchCount + noCard06Count;

  // ===== 2. 成功配对笔数/金额 =====
  // 一般卡：银行卡代号有值且不等于AUCTION_PAYMENT_CARD，计算笔数和充值金额(amount)总和
  const normalMatchCount = normalCardForApp.length;
  const normalMatchAmount = normalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 极速：银行卡代号=AUCTION_PAYMENT_CARD，计算笔数和充值金额(amount)总和
  const expressMatchCount = expressCardForApp.length;
  const expressMatchAmount = expressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 总计
  const totalMatchCount = normalMatchCount + expressMatchCount;
  const totalMatchAmount = normalMatchAmount + expressMatchAmount;

  // ===== 3. 订单成功笔数/金额 =====
  // 一般卡：银行卡代号有值且不是AUCTION_PAYMENT_CARD，正规化状态不等于「未充值」「审核中(已超时)」
  const normalOrderSuccess = jisuRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const normalOrderSuccessCount = normalOrderSuccess.length;
  const normalOrderSuccessAmount = normalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);


  // 极速提：银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态有值且不包含「未充值」「审核中(已超时)」
  const expressOrderSuccess = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('审核中(已超时)')
  );
  const expressOrderSuccessCount = expressOrderSuccess.length;
  const expressOrderSuccessAmount = expressOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 信评上分：到账金额不为0且状态包含「信用」
  const creditScoreSuccess = jisuRecords.filter(r =>
    r.receivedAmount > 0 && r.status && r.status.includes('信用')
  );
  const creditScoreSuccessCount = creditScoreSuccess.length;
  const creditScoreSuccessAmount = creditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 信评上分平均时间（通知时间-建立时间）
  const creditScoreWithTime = creditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const creditScoreAvgTime = creditScoreWithTime.length > 0
    ? creditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / creditScoreWithTime.length
    : 0;

  // 订单成功总计
  const totalOrderSuccessCount = normalOrderSuccessCount + expressOrderSuccessCount;
  const totalOrderSuccessAmount = normalOrderSuccessAmount + expressOrderSuccessAmount;

  // ===== 4. 没信评降等配卡 =====
  // 条件：银行卡代号不等于AUCTION_PAYMENT_CARD，到账金额不为0，用户等级不为0和-1
  const noCreditDowngradeRecords = jisuRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    parseFloat(r.userLevel) !== 0 &&
    parseFloat(r.userLevel) !== -1
  );

  // 依据充值金额区间计算笔数
  const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];
  const noCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => {
    noCreditDowngradeByAmount[amt] = noCreditDowngradeRecords.filter(r => Math.round(r.amount) === amt).length;
  });

  // 没信评降等配卡 - 平均时间
  // 条件：排除支付宝和微信商户，到账金额>0
  const noCreditDowngradeForAvgTime = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const noCreditDowngradeAvgTime = noCreditDowngradeForAvgTime.length > 0
    ? noCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / noCreditDowngradeForAvgTime.length
    : 0;
  // 其他金额
  const knownAmounts = new Set(amountRanges);
  noCreditDowngradeByAmount['other'] = noCreditDowngradeRecords.filter(r => !knownAmounts.has(Math.round(r.amount))).length;

  const noCreditDowngradeTotal = noCreditDowngradeRecords.length;

  // ===== 5. c2c =====
  // 数据范围：排除支付宝、微信、qa、test、线下（jisuRecords已处理）

  // 标题：银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「用户确认到帐」
  const c2cRecords = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status && r.status.includes('用户确认到帐')
  );
  const c2cCount = c2cRecords.length;
  const c2cAmount = c2cRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 1. 点确认：状态包含「用户确认到帐」且到账金额>0
  const c2cConfirmRecords = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && r.status.includes('用户确认到帐')
  );
  const c2cConfirmCount = c2cConfirmRecords.length;

  // 2. 点确认的平均处理时间
  const c2cConfirmWithTime = c2cConfirmRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const c2cConfirmAvgTime = c2cConfirmWithTime.length > 0
    ? c2cConfirmWithTime.reduce((sum, r) => sum + r.processingTime, 0) / c2cConfirmWithTime.length
    : 0;

  // 3. 人工审核:通过：bankCardCode包含AUCTION, 状态包含「金額補單/金额补单」且到账金额>0，处理时间<=11分钟
  const c2cManualAuditRecords = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime >= 0 &&
    r.processingTime <= 660 // 11分钟 = 660秒
  );
  const c2cManualAuditCount = c2cManualAuditRecords.length;

  // 4. 审核-成功平均时间：人工审核通过的平均处理时间
  const c2cAuditSuccessAvgTime = c2cManualAuditRecords.length > 0
    ? c2cManualAuditRecords.reduce((sum, r) => sum + r.processingTime, 0) / c2cManualAuditRecords.length
    : 0;

  // 5. 超过11min补件后才成功
  // Note: 此处使用 jisuRecords (银行卡)，支付宝的 c2c 计算在 alipayRecords 部分
  // Part 1: bankCardCode包含AUCTION, receivedAmount>0, status包含金額補單, 处理时间 > 11分钟
  const c2cOver11MinBuDanCount = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime > 660 // > 11分钟
  ).length;

  // Part 2: bankCardCode=AUCTION_PAYMENT_CARD, receivedAmount>0, 状态含「商户确认到帐」
  const c2cMerchantConfirmCount = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION_PAYMENT_CARD') &&
    r.receivedAmount > 0 &&
    r.status && r.status.includes('商户确认到帐')
  ).length;

  const c2cOver11MinSuccessCount = c2cOver11MinBuDanCount + c2cMerchantConfirmCount;

  // ===== 三方代收（銀行卡）=====
  // 三方代收判断函数
  const isThirdPartyDahaomen = (code) => code && (code.startsWith('GB-Dahaomen') || code.startsWith('Dahaomen'));
  const isThirdPartyHuitong = (code) => code && code.startsWith('HTc2c');
  const isThirdPartyDoudou = (code) => code && code.startsWith('DDF');
  const isThirdPartyUC = (code) => code && code.toLowerCase().startsWith('uc1020');
  // GB-DahaomenJFB 归类到「其他」，不再作为已知三方
  const isKnownThirdParty = (code) => isThirdPartyHuitong(code) || isThirdPartyDoudou(code) || isThirdPartyUC(code);
  // 排除线下充值商户（繁体「线下」+ 简体「线下」）
  const isOfflineMerchant = (merchant) => merchant && (merchant.includes('線下') || merchant.includes('线下'));

  // 条件：bankCardCode 非 gb/auction 开头（不区分大小写），或是特定三方代收代码
  // 充值成功：receivedAmount > 0，排除线下充值商户
  const thirdPartyRecords = jisuRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toLowerCase();
    // 已知三方代收要保留（包含 Dahaomen，雖然它歸類到其他）
    if (isKnownThirdParty(r.bankCardCode) || isThirdPartyDahaomen(r.bankCardCode)) return true;
    if (code.startsWith('gb') || code.startsWith('auction')) return false;
    return true;
  });
  const thirdPartyCount = thirdPartyRecords.length;
  const thirdPartyAmount = thirdPartyRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 各三方代收明細
  // GB-DahaomenJFB = GB-Dahaomen 开头 + Dahaomen 开头，排除线下充值商户
  const thirdPartyDahaomenRecords = jisuRecords.filter(r =>
    isThirdPartyDahaomen(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyDahaomenCount = thirdPartyDahaomenRecords.length;
  const thirdPartyDahaomenAmount = thirdPartyDahaomenRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 汇通 = HTc2c 开头，排除线下充值商户
  const thirdPartyHuitongRecords = jisuRecords.filter(r =>
    isThirdPartyHuitong(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyHuitongCount = thirdPartyHuitongRecords.length;
  const thirdPartyHuitongAmount = thirdPartyHuitongRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 豆豆 = DDF 开头，排除线下充值商户
  const thirdPartyDoudouRecords = jisuRecords.filter(r =>
    isThirdPartyDoudou(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyDoudouCount = thirdPartyDoudouRecords.length;
  const thirdPartyDoudouAmount = thirdPartyDoudouRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // UC聚合 = uc1020 开头（不区分大小写），排除线下充值商户
  const thirdPartyUCRecords = jisuRecords.filter(r =>
    isThirdPartyUC(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyUCCount = thirdPartyUCRecords.length;
  const thirdPartyUCAmount = thirdPartyUCRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 其他三方 = 非已知三方代收的其他三方卡号（包含 Dahaomen），排除线下充值商户
  // 三方卡号定义：排除 auction 开头、排除 gb 开头，但包含 Dahaomen（归类到其他）
  const thirdPartyOtherRecords = jisuRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    // 排除已知的三種三方代收（汇通、豆豆、UC）
    if (isKnownThirdParty(r.bankCardCode)) return false;
    // Dahaomen 歸類到其他
    if (isThirdPartyDahaomen(r.bankCardCode)) return true;
    const code = r.bankCardCode.toLowerCase();
    // 排除 auction 和 gb 开头
    if (code.startsWith('auction') || code.startsWith('gb')) return false;
    return true;
  });
  const thirdPartyOtherCount = thirdPartyOtherRecords.length;
  const thirdPartyOtherAmount = thirdPartyOtherRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付宝商户数据 =====
  // 数据范围：排除 test/qa/线下
  const alipayRecords = records.filter(r => {
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const merchantLower = r.merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = r.merchant.includes('線下') || r.merchant.includes('线下');
    return hasAlipay && !hasTest && !hasQa && !hasOffline;
  });

  // 支付宝 - 充值申请笔数
  // 一般卡：银行卡代号有值、不等于AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付
  const alipayNormalCardForApp = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付'
  );
  // 一般宝：银行卡代号有值且不等于AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付，再加70
  const alipayExpressCardForApp = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付')
  );
  const alipayExpressCardAppCount = alipayExpressCardForApp.length;

  // 极速提卡：银行卡代号=AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付
  const alipayJisuTikaForApp = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付'
  );
  const alipayJisuTikaCount = alipayJisuTikaForApp.length;

  // 极速提宝：银行卡代号=AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付，再加100
  const alipayJisuTibaoForApp = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付')
  );
  const alipayJisuTibaoCount = alipayJisuTibaoForApp.length;

  const alipayApplicationCount = alipayNormalCardForApp.length + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount;

  // 支付宝 - 建单成功等待无配对：有商户名称但银行卡号为空
  const alipayWaitingForMatchCount = alipayRecords.filter(r => !r.bankCardCode).length;

  // 支付宝 - 成功配对
  const alipayNormalMatchCount = alipayNormalCardForApp.length;
  const alipayNormalMatchAmount = alipayNormalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 一般宝金额
  const alipayExpressBaoMatchAmount = alipayExpressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 极速提(卡)金额
  const alipayJisuTikaMatchAmount = alipayJisuTikaForApp.reduce((sum, r) => sum + r.amount, 0);
  // 极速提(宝)金额
  const alipayJisuTibaoMatchAmount = alipayJisuTibaoForApp.reduce((sum, r) => sum + r.amount, 0);
  // 成功配对总计 = 一般卡 + 一般宝 + 极速提(卡) + 极速提(宝)
  const alipayTotalMatchCount = alipayNormalMatchCount + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount;
  const alipayTotalMatchAmount = alipayNormalMatchAmount + alipayExpressBaoMatchAmount + alipayJisuTikaMatchAmount + alipayJisuTibaoMatchAmount;

  // 支付宝 - 订单成功（使用 normalizedStatus，与 Excel AO 列一致）
  // 一般卡：bankCardCode有值且≠AUCTION_PAYMENT_CARD, bankName不为支付宝/支付宝(企)/微信支付, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayNormalOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付' &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayNormalOrderSuccessCount = alipayNormalOrderSuccess.length;
  const alipayNormalOrderSuccessAmount = alipayNormalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 一般宝：bankCardCode有值且≠AUCTION_PAYMENT_CARD, bankName为支付宝/支付宝(企)/微信支付, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayBaoOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付') &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayBaoOrderSuccessCount = alipayBaoOrderSuccess.length;
  const alipayBaoOrderSuccessAmount = alipayBaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(卡)：bankCardCode=AUCTION_PAYMENT_CARD, bankName不为支付宝/支付宝(企)/微信支付, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayJisuTikaOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付' &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayJisuTikaOrderSuccessCount = alipayJisuTikaOrderSuccess.length;
  const alipayJisuTikaOrderSuccessAmount = alipayJisuTikaOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(宝)：bankCardCode=AUCTION_PAYMENT_CARD, bankName为支付宝/支付宝(企)/微信支付, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayJisuTibaoOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付') &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayJisuTibaoOrderSuccessCount = alipayJisuTibaoOrderSuccess.length;
  const alipayJisuTibaoOrderSuccessAmount = alipayJisuTibaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 支付寶 - 信評上分：status包含「信用評分上分」
  const alipayCreditScoreSuccess = alipayRecords.filter(r =>
    r.status && r.status.includes('信用評分上分')
  );
  const alipayCreditScoreSuccessCount = alipayCreditScoreSuccess.length;
  const alipayCreditScoreSuccessAmount = alipayCreditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);
  const alipayCreditScoreWithTime = alipayCreditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const alipayCreditScoreAvgTime = alipayCreditScoreWithTime.length > 0
    ? alipayCreditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayCreditScoreWithTime.length
    : 0;

  // 其中信评不含图文复核：bankCardCode=AUCTION_PAYMENT_CARD, receivedAmount>0, status包含「信用評分上分」但≠「信用評分上分(圖文覆核)」
  const alipayCreditNoTuwen = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    r.status.includes('信用評分上分') &&
    r.status !== '信用評分上分(圖文覆核)'
  );
  const alipayCreditNoTuwenCount = alipayCreditNoTuwen.length;
  const alipayCreditNoTuwenWithTime = alipayCreditNoTuwen.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const alipayCreditNoTuwenAvgTime = alipayCreditNoTuwenWithTime.length > 0
    ? alipayCreditNoTuwenWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayCreditNoTuwenWithTime.length
    : 0;

  // 订单成功总计
  const alipayTotalOrderSuccessCount = alipayNormalOrderSuccessCount + alipayBaoOrderSuccessCount + alipayJisuTikaOrderSuccessCount + alipayJisuTibaoOrderSuccessCount;
  const alipayTotalOrderSuccessAmount = alipayNormalOrderSuccessAmount + alipayBaoOrderSuccessAmount + alipayJisuTikaOrderSuccessAmount + alipayJisuTibaoOrderSuccessAmount;

  // 支付寶 - 没信评降等配卡：bankCardCode≠AUCTION_PAYMENT_CARD, receivedAmount≠0, userLevel≠0且≠-1
  const alipayNoCreditDowngradeRecords = alipayRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    parseFloat(r.userLevel) !== 0 &&
    parseFloat(r.userLevel) !== -1
  );
  const alipayNoCreditDowngradeTotal = alipayNoCreditDowngradeRecords.length;

  // 支付宝 - 没信评降等配卡 依据金额区间计算笔数
  const alipayNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => {
    alipayNoCreditDowngradeByAmount[amt] = alipayNoCreditDowngradeRecords.filter(r => Math.round(r.amount) === amt).length;
  });
  // 其他金额
  alipayNoCreditDowngradeByAmount['other'] = alipayNoCreditDowngradeRecords.filter(r => !amountRanges.includes(Math.round(r.amount))).length;

  // 支付宝 - 平均时间：receivedAmount > 0
  const alipayNoCreditDowngradeForAvgTime = alipayRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const alipayNoCreditDowngradeAvgTime = alipayNoCreditDowngradeForAvgTime.length > 0
    ? alipayNoCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayNoCreditDowngradeForAvgTime.length
    : 0;

  // ===== 支付寶 c2c =====
  // 标题：银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「用户确认到帐」
  const alipayC2cRecords = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status && r.status.includes('用户确认到帐')
  );
  const alipayC2cCount = alipayC2cRecords.length;
  const alipayC2cAmount = alipayC2cRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 1. 点确认：状态包含「用户确认到帐」且到账金额>0
  const alipayC2cConfirmRecords = alipayRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && r.status.includes('用户确认到帐')
  );
  const alipayC2cConfirmCount = alipayC2cConfirmRecords.length;

  // 2. 点确认的平均处理时间
  const alipayC2cConfirmWithTime = alipayC2cConfirmRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const alipayC2cConfirmAvgTime = alipayC2cConfirmWithTime.length > 0
    ? alipayC2cConfirmWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayC2cConfirmWithTime.length
    : 0;

  // 3. 人工审核:通过：bankCardCode包含AUCTION，到账金额>0，状态包含「金額補單/金额补单」，处理时间<=11分钟
  const alipayC2cManualAuditRecords = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime > 0 &&
    r.processingTime <= 660
  );
  const alipayC2cManualAuditCount = alipayC2cManualAuditRecords.length;

  // 4. 审核-成功平均时间
  const alipayC2cAuditSuccessAvgTime = alipayC2cManualAuditRecords.length > 0
    ? alipayC2cManualAuditRecords.reduce((sum, r) => sum + r.processingTime, 0) / alipayC2cManualAuditRecords.length
    : 0;

  // 5. 超过11min补件后才成功
  // Part 1: bankCardCode包含AUCTION, receivedAmount>0, status包含金額補單/金额补单, processingTime>11分钟
  const alipayC2cOver11MinBuDanCount = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime > 660
  ).length;

  // Part 2: bankCardCode包含AUCTION_PAYMENT_CARD, receivedAmount>0, status包含商户确认到帐
  const alipayC2cMerchantConfirmCount = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION_PAYMENT_CARD') &&
    r.receivedAmount > 0 &&
    r.status && r.status.includes('商户确认到帐')
  ).length;

  const alipayC2cOver11MinSuccessCount = alipayC2cOver11MinBuDanCount + alipayC2cMerchantConfirmCount;

  // ===== 支付宝 - 三方代收（一般卡订单成功）=====
  // 条件：bankCardCode 非 gb/auction 开头（不区分大小写），或是特定三方代收代码
  // 充值成功：receivedAmount > 0，排除线下充值商户
  const alipayThirdPartyRecords = alipayRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toLowerCase();
    // 已知三方代收要保留（包含 Dahaomen，雖然它歸類到其他）
    if (isKnownThirdParty(r.bankCardCode) || isThirdPartyDahaomen(r.bankCardCode)) return true;
    if (code.startsWith('gb') || code.startsWith('auction')) return false;
    return true;
  });
  const alipayThirdPartyCount = alipayThirdPartyRecords.length;
  const alipayThirdPartyAmount = alipayThirdPartyRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 各三方代收明細
  // GB-DahaomenJFB = GB-Dahaomen 开头 + Dahaomen 开头，排除线下充值商户
  const alipayThirdPartyDahaomenRecords = alipayRecords.filter(r =>
    isThirdPartyDahaomen(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyDahaomenCount = alipayThirdPartyDahaomenRecords.length;
  const alipayThirdPartyDahaomenAmount = alipayThirdPartyDahaomenRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 汇通 = HTc2c 开头，排除线下充值商户
  const alipayThirdPartyHuitongRecords = alipayRecords.filter(r =>
    isThirdPartyHuitong(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyHuitongCount = alipayThirdPartyHuitongRecords.length;
  const alipayThirdPartyHuitongAmount = alipayThirdPartyHuitongRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 豆豆 = DDF 开头，排除线下充值商户
  const alipayThirdPartyDoudouRecords = alipayRecords.filter(r =>
    isThirdPartyDoudou(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyDoudouCount = alipayThirdPartyDoudouRecords.length;
  const alipayThirdPartyDoudouAmount = alipayThirdPartyDoudouRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // UC聚合 = uc1020 开头（不区分大小写），排除线下充值商户
  const alipayThirdPartyUCRecords = alipayRecords.filter(r =>
    isThirdPartyUC(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyUCCount = alipayThirdPartyUCRecords.length;
  const alipayThirdPartyUCAmount = alipayThirdPartyUCRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 支付宝 - 其他三方（包含 Dahaomen），排除线下充值商户
  const alipayThirdPartyOtherRecords = alipayRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    // 排除已知的三種三方代收（汇通、豆豆、UC）
    if (isKnownThirdParty(r.bankCardCode)) return false;
    // Dahaomen 歸類到其他
    if (isThirdPartyDahaomen(r.bankCardCode)) return true;
    const code = r.bankCardCode.toLowerCase();
    // 排除 auction 和 gb 开头
    if (code.startsWith('auction') || code.startsWith('gb')) return false;
    return true;
  });
  const alipayThirdPartyOtherCount = alipayThirdPartyOtherRecords.length;
  const alipayThirdPartyOtherAmount = alipayThirdPartyOtherRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付寶 - 宝转卡渠道，配支付宝提现 =====
  // 申请：merchant包含"转卡", bankCardCode=AUCTION_PAYMENT_CARD, bankName=支付宝
  const alipayBaoZhuanKaRecords = alipayRecords.filter(r =>
    r.merchant && r.merchant.includes('转卡') &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName === '支付宝'
  );
  const alipayBaoZhuanKaCount = alipayBaoZhuanKaRecords.length;
  const alipayBaoZhuanKaAmount = alipayBaoZhuanKaRecords.reduce((sum, r) => sum + r.amount, 0);

  // 成功：merchant包含"转卡", bankCardCode=AUCTION_PAYMENT_CARD, bankName=支付宝, receivedAmount<>0
  const alipayBaoZhuanKaSuccessRecords = alipayRecords.filter(r =>
    r.merchant && r.merchant.includes('转卡') &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName === '支付宝' &&
    r.receivedAmount !== 0
  );
  const alipayBaoZhuanKaSuccessCount = alipayBaoZhuanKaSuccessRecords.length;
  const alipayBaoZhuanKaSuccessAmount = alipayBaoZhuanKaSuccessRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付寶 - 宝转宝渠道，配银行卡提现 =====
  // 申请：merchant包含"宝)", bankCardCode=AUCTION_PAYMENT_CARD, bankName≠支付宝
  const alipayBaoZhuanBaoRecords = alipayRecords.filter(r =>
    r.merchant && r.merchant.includes('宝)') &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝'
  );
  const alipayBaoZhuanBaoCount = alipayBaoZhuanBaoRecords.length;
  const alipayBaoZhuanBaoAmount = alipayBaoZhuanBaoRecords.reduce((sum, r) => sum + r.amount, 0);

  // 成功：merchant包含"宝)", bankCardCode=AUCTION_PAYMENT_CARD, bankName≠支付宝, receivedAmount<>0
  const alipayBaoZhuanBaoSuccessRecords = alipayRecords.filter(r =>
    r.merchant && r.merchant.includes('宝)') &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.receivedAmount !== 0
  );
  const alipayBaoZhuanBaoSuccessCount = alipayBaoZhuanBaoSuccessRecords.length;
  const alipayBaoZhuanBaoSuccessAmount = alipayBaoZhuanBaoSuccessRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付寶 - 整体 配对成功/提现申请 =====
  // 分子：银行卡订单成功极速提金额 + 支付宝订单成功极速提(卡)金额 + 支付宝订单成功极速提(宝)金额
  const alipayOverallMatchNumerator =
    expressOrderSuccessAmount +
    alipayJisuTikaOrderSuccessAmount +
    alipayJisuTibaoOrderSuccessAmount;

  // 分母：支付宝提现申请金额 + 银行卡提现申请金额（来自提现分析）
  // 如果有提现数据，使用提现数据；否则使用充值数据中的宝转卡/宝转宝
  const withdrawBankCardAmount = withdrawMetrics?.bankCardWithdrawAmount || 0;
  const withdrawAlipayAmount = withdrawMetrics?.alipayWithdrawAmount || 0;
  const alipayOverallMatchDenominator = withdrawAlipayAmount + withdrawBankCardAmount;

  // 整体 配对成功/提现申请 百分比
  const alipayOverallMatchRate = alipayOverallMatchDenominator > 0
    ? (alipayOverallMatchNumerator / alipayOverallMatchDenominator) * 100
    : 0;

  // ===== 微信商户数据 =====
  // 数据范围：排除 test/qa/线下
  const wechatRecords = records.filter(r => {
    const hasWechat = r.merchant.includes('微信');
    const merchantLower = r.merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = r.merchant.includes('線下') || r.merchant.includes('线下');
    return hasWechat && !hasTest && !hasQa && !hasOffline;
  });

  // 微信 - 充值申请笔数（比照支付宝逻辑，4个分类）
  // 一般卡：银行卡代号有值、不等于AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付
  const wechatNormalCardForApp = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付'
  );
  // 一般宝：银行卡代号有值且不等于AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付
  const wechatExpressBaoForApp = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付')
  );
  // 极速提(卡)：银行卡代号=AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付
  const wechatJisuTikaForApp = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付'
  );
  // 极速提(宝)：银行卡代号=AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付
  const wechatJisuTibaoForApp = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付')
  );
  // 建单成功等待无配对：银行卡代号为空
  const wechatWaitingForMatchCount = wechatRecords.filter(r => !r.bankCardCode).length;

  const wechatApplicationCount = wechatNormalCardForApp.length + wechatExpressBaoForApp.length + wechatJisuTikaForApp.length + wechatJisuTibaoForApp.length;

  // 微信 - 成功配对（4个分类）
  const wechatNormalMatchCount = wechatNormalCardForApp.length;
  const wechatNormalMatchAmount = wechatNormalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatExpressBaoMatchCount = wechatExpressBaoForApp.length;
  const wechatExpressBaoMatchAmount = wechatExpressBaoForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatJisuTikaMatchCount = wechatJisuTikaForApp.length;
  const wechatJisuTikaMatchAmount = wechatJisuTikaForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatJisuTibaoMatchCount = wechatJisuTibaoForApp.length;
  const wechatJisuTibaoMatchAmount = wechatJisuTibaoForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatTotalMatchCount = wechatNormalMatchCount + wechatExpressBaoMatchCount + wechatJisuTikaMatchCount + wechatJisuTibaoMatchCount;
  const wechatTotalMatchAmount = wechatNormalMatchAmount + wechatExpressBaoMatchAmount + wechatJisuTikaMatchAmount + wechatJisuTibaoMatchAmount;

  // 微信 - 订单成功（4个分类，比照支付宝）
  // 一般卡
  const wechatNormalOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付' &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatNormalOrderSuccessCount = wechatNormalOrderSuccess.length;
  const wechatNormalOrderSuccessAmount = wechatNormalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 一般宝
  const wechatBaoOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付') &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatBaoOrderSuccessCount = wechatBaoOrderSuccess.length;
  const wechatBaoOrderSuccessAmount = wechatBaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(卡)
  const wechatJisuTikaOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' &&
    r.bankName !== '支付宝(企)' &&
    r.bankName !== '微信支付' &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatJisuTikaOrderSuccessCount = wechatJisuTikaOrderSuccess.length;
  const wechatJisuTikaOrderSuccessAmount = wechatJisuTikaOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(宝)
  const wechatJisuTibaoOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付宝(企)' || r.bankName === '微信支付') &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatJisuTibaoOrderSuccessCount = wechatJisuTibaoOrderSuccess.length;
  const wechatJisuTibaoOrderSuccessAmount = wechatJisuTibaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  const wechatTotalOrderSuccessCount = wechatNormalOrderSuccessCount + wechatBaoOrderSuccessCount + wechatJisuTikaOrderSuccessCount + wechatJisuTibaoOrderSuccessCount;
  const wechatTotalOrderSuccessAmount = wechatNormalOrderSuccessAmount + wechatBaoOrderSuccessAmount + wechatJisuTikaOrderSuccessAmount + wechatJisuTibaoOrderSuccessAmount;

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

  // 微信 - 没信评降等配卡
  const wechatNoCreditDowngradeRecords = wechatRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    parseFloat(r.userLevel) !== 0 &&
    parseFloat(r.userLevel) !== -1
  );
  const wechatNoCreditDowngradeTotal = wechatNoCreditDowngradeRecords.length;

  // 微信 - 没信评降等配卡 依据金额区间计算笔数
  const wechatNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => {
    wechatNoCreditDowngradeByAmount[amt] = wechatNoCreditDowngradeRecords.filter(r => Math.round(r.amount) === amt).length;
  });
  // 其他金额
  wechatNoCreditDowngradeByAmount['other'] = wechatNoCreditDowngradeRecords.filter(r => !amountRanges.includes(Math.round(r.amount))).length;

  // 微信 - 平均时间（比照Excel公式：AO栏匹配特定状态）
  // Excel公式：=AVERAGE(FILTER('微信'!AN3:AN10001, REGEXMATCH('微信'!AO3:AO10001, "信用評分上分|金额补单|银商确认到账|回單驗證上分|用户确认到帐|已充值(短信)|已充值(微信短信)|已充值|回單隨機信評上分|信用評分上分(圖文覆核)|明细补单")))
  const wechatValidStatusPattern = /信用評分上分|金额补单|银商确认到账|回單驗證上分|用户确认到帐|已充值\(短信\)|已充值\(微信短信\)|已充值|回單隨機信評上分|信用評分上分\(圖文覆核\)|明细补单/;
  const wechatNoCreditDowngradeForAvgTime = wechatRecords.filter(r =>
    r.aoStatus &&
    wechatValidStatusPattern.test(r.aoStatus) &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );

  const wechatNoCreditDowngradeAvgTime = wechatNoCreditDowngradeForAvgTime.length > 0
    ? wechatNoCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / wechatNoCreditDowngradeForAvgTime.length
    : 0;

  // ===== 6. 商业平台 - 极速充提3(银行卡)_CNX交易所 =====
  // 充值_申请：bankCardCode不为空 且 merchant = "极速充提3(银行卡)_CNX交易所"
  const cnxRecords = records.filter(r =>
    r.bankCardCode && r.bankCardCode !== '' &&
    r.merchant === '极速充提3(银行卡)_CNX交易所'
  );
  const cnxApplicationCount = cnxRecords.length;
  const cnxApplicationAmount = cnxRecords.reduce((sum, r) => sum + r.amount, 0);

  // 充值成功笔数：状态包含「已充值」且充值金额>0
  const cnxSuccessRecords = cnxRecords.filter(r =>
    r.status && r.status.includes('已充值') &&
    r.amount > 0
  );
  const cnxSuccessCount = cnxSuccessRecords.length;
  const cnxSuccessAmount = cnxSuccessRecords.reduce((sum, r) => sum + r.amount, 0);

  // ===== JS充值等待最终无配对 =====
  // 公式：（銀行卡的建单成功等待无配对＋取无卡06提示）＋（支付寶的建单成功等待无配对＋取无卡06提示）
  // 建单成功等待无配对 = bankCardCode 为空的记录数
  // 取无卡06提示 = 暂时硬编码（后续需调整，待提供06数据）

  // 銀行卡部分
  // 建单成功等待无配对：bankCardCode 为空
  const bankCardWaitingNoMatch = jisuRecords.filter(r => !r.bankCardCode || r.bankCardCode === '').length;
  // 取无卡06提示：暂时硬编码为 2（TODO: 后续需从06数据计算）
  const bankCard06NoMatch = 2;
  const bankCardJsWaitingNoMatch = bankCardWaitingNoMatch + bankCard06NoMatch;

  // 支付寶部分
  // 建单成功等待无配对：bankCardCode 为空
  const alipayWaitingNoMatch = alipayRecords.filter(r => !r.bankCardCode || r.bankCardCode === '').length;
  // 取无卡06提示：暂时硬编码为 0（TODO: 后续需从06数据计算）
  const alipay06NoMatch = 0;
  const alipayJsWaitingNoMatch = alipayWaitingNoMatch + alipay06NoMatch;

  // 总计
  const jsWaitingNoMatch = bankCardJsWaitingNoMatch + alipayJsWaitingNoMatch;

  return {
    // 全部-重要信息指标
    totalApplicationCount,
    successfulCount,
    overallSuccessRate,
    totalApplicationAmount,
    overallAvgTime,
    overallDropOrderCount: dropOrderCount,
    overallDropOrderRatio: dropOrderRatio,
    invalidApplicationCount,
    invalidApplicationRatio,

    // 充值分钟分析
    minuteAnalysisTotalCount,
    minuteAnalysisTotalAmount,
    minuteWithin2MinCount: minuteWithin2Min.length,
    minuteWithin2MinAmount,
    minuteWithin2MinRatio,
    minuteWithin2to3MinCount: minuteWithin2to3Min.length,
    minuteWithin2to3MinAmount,
    minuteWithin2to3MinRatio,
    minuteWithin3to5MinCount: minuteWithin3to5Min.length,
    minuteWithin3to5MinAmount,
    minuteWithin3to5MinRatio,
    minuteWithin5to15MinCount: minuteWithin5to15Min.length,
    minuteWithin5to15MinAmount,
    minuteWithin5to15MinRatio,
    minuteWithin15to30MinCount: minuteWithin15to30Min.length,
    minuteWithin15to30MinAmount,
    minuteWithin15to30MinRatio,
    minuteOver30MinCount: minuteOver30Min.length,
    minuteOver30MinAmount,
    minuteOver30MinRatio,
    minuteInvalidCount,
    minuteInvalidRatio,
    minuteDropCount,
    minuteDropRatio,
    minuteAvgTime,

    // 时间分布指标
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

    // 极速区域指标
    // 1. 充值申请
    jisuApplicationCount,
    normalCardAppCount: normalCardForApp.length,
    expressCardAppCount: expressCardForApp.length,
    waitingForMatchCount,
    noCard06Count,
    // 2. 成功配对
    normalMatchCount,
    normalMatchAmount,
    expressMatchCount,
    expressMatchAmount,
    totalMatchCount,
    totalMatchAmount,
    // 3. 订单成功
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
    // 6. 三方代收（銀行卡）
    thirdPartyCount,
    thirdPartyAmount,
    thirdPartyDahaomenCount,
    thirdPartyDahaomenAmount,
    thirdPartyHuitongCount,
    thirdPartyHuitongAmount,
    thirdPartyDoudouCount,
    thirdPartyDoudouAmount,
    thirdPartyUCCount,
    thirdPartyUCAmount,
    thirdPartyOtherCount,
    thirdPartyOtherAmount,
    // 支付宝商户
    alipayApplicationCount,
    alipayNormalCardAppCount: alipayNormalCardForApp.length,
    alipayExpressCardAppCount,
    alipayJisuTikaCount,
    alipayWaitingForMatchCount,
    alipayJisuTibaoCount,
    alipayNormalMatchCount,
    alipayNormalMatchAmount,
    alipayExpressBaoMatchAmount,
    alipayJisuTikaMatchAmount,
    alipayJisuTibaoMatchAmount,
    alipayTotalMatchCount,
    alipayTotalMatchAmount,
    alipayNormalOrderSuccessCount,
    alipayNormalOrderSuccessAmount,
    alipayBaoOrderSuccessCount,
    alipayBaoOrderSuccessAmount,
    alipayJisuTikaOrderSuccessCount,
    alipayJisuTikaOrderSuccessAmount,
    alipayJisuTibaoOrderSuccessCount,
    alipayJisuTibaoOrderSuccessAmount,
    alipayCreditScoreSuccessCount,
    alipayCreditScoreSuccessAmount,
    alipayCreditScoreAvgTime,
    alipayCreditNoTuwenCount,
    alipayCreditNoTuwenAvgTime,
    alipayTotalOrderSuccessCount,
    alipayTotalOrderSuccessAmount,
    alipayNoCreditDowngradeTotal,
    alipayNoCreditDowngradeByAmount,
    alipayNoCreditDowngradeAvgTime,
    // 支付寶 c2c
    alipayC2cCount,
    alipayC2cAmount,
    alipayC2cConfirmCount,
    alipayC2cConfirmAvgTime,
    alipayC2cManualAuditCount,
    alipayC2cAuditSuccessAvgTime,
    alipayC2cOver11MinSuccessCount,
    // 支付寶 - 三方代收
    alipayThirdPartyCount,
    alipayThirdPartyAmount,
    alipayThirdPartyDahaomenCount,
    alipayThirdPartyDahaomenAmount,
    alipayThirdPartyHuitongCount,
    alipayThirdPartyHuitongAmount,
    alipayThirdPartyDoudouCount,
    alipayThirdPartyDoudouAmount,
    alipayThirdPartyUCCount,
    alipayThirdPartyUCAmount,
    alipayThirdPartyOtherCount,
    alipayThirdPartyOtherAmount,
    // 支付寶 - 宝转卡/宝转宝
    alipayBaoZhuanKaCount,
    alipayBaoZhuanKaAmount,
    alipayBaoZhuanKaSuccessCount,
    alipayBaoZhuanKaSuccessAmount,
    alipayBaoZhuanBaoCount,
    alipayBaoZhuanBaoAmount,
    alipayBaoZhuanBaoSuccessCount,
    alipayBaoZhuanBaoSuccessAmount,
    alipayOverallMatchRate,
    // 微信商户（比照支付宝4个分类）
    wechatApplicationCount,
    wechatNormalCardAppCount: wechatNormalCardForApp.length,
    wechatExpressBaoAppCount: wechatExpressBaoForApp.length,
    wechatJisuTikaCount: wechatJisuTikaForApp.length,
    wechatJisuTibaoCount: wechatJisuTibaoForApp.length,
    wechatWaitingForMatchCount,
    // 成功配对
    wechatNormalMatchCount,
    wechatNormalMatchAmount,
    wechatExpressBaoMatchCount,
    wechatExpressBaoMatchAmount,
    wechatJisuTikaMatchCount,
    wechatJisuTikaMatchAmount,
    wechatJisuTibaoMatchCount,
    wechatJisuTibaoMatchAmount,
    wechatTotalMatchCount,
    wechatTotalMatchAmount,
    // 订单成功
    wechatNormalOrderSuccessCount,
    wechatNormalOrderSuccessAmount,
    wechatBaoOrderSuccessCount,
    wechatBaoOrderSuccessAmount,
    wechatJisuTikaOrderSuccessCount,
    wechatJisuTikaOrderSuccessAmount,
    wechatJisuTibaoOrderSuccessCount,
    wechatJisuTibaoOrderSuccessAmount,
    wechatCreditScoreSuccessCount,
    wechatCreditScoreSuccessAmount,
    wechatCreditScoreAvgTime,
    wechatTotalOrderSuccessCount,
    wechatTotalOrderSuccessAmount,
    wechatNoCreditDowngradeTotal,
    wechatNoCreditDowngradeByAmount,
    wechatNoCreditDowngradeAvgTime,

    // 6. 商业平台
    cnxApplicationCount,
    cnxApplicationAmount,
    cnxSuccessCount,
    cnxSuccessAmount,

    // 旧指标 (保留兼容)
    totalAmount,
    totalCount: records.filter(r => r.receivedAmount > 0).length,
    autoSuccessCount: successRecords.length,
    dropOrderCount: buDanRecords.length,
    dropOrderRatio: totalApplicationCount > 0 ? (buDanRecords.length / totalApplicationCount) * 100 : 0,
    successRate: totalBase > 0 ? (successRecords.length / totalBase) * 100 : 0,

    // JS充值等待最终无配对
    jsWaitingNoMatch,
    bankCardJsWaitingNoMatch,
    alipayJsWaitingNoMatch
  };
};

export const formatTime = (seconds) => {
  if (seconds === null || seconds === undefined || seconds < 0) return '-';
  if (seconds === 0) return '00:00:00';
  // 先四舍五入到整数秒
  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const mins = Math.floor((roundedSeconds % 3600) / 60);
  const secs = roundedSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 只显示分钟的时间格式（用于c2c平均时间）
export const formatTimeMinutes = (seconds) => {
  if (seconds === null || seconds === undefined || seconds < 0) return '-';
  if (seconds === 0) return '0分';
  const mins = Math.round(seconds / 60);
  return `${mins}分`;
};

export const formatAmount = (amount) => {
  return Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// ===== 提现 CSV 解析 =====
export const parseWithdrawCSV = (content) => {
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split('\n');
  const records = [];

  // ===== 資料清洗統計 =====
  let totalRows = 0;
  let skippedEmpty = 0;
  let skippedShortColumns = 0;
  let skippedTestQa = 0;
  let skippedOffline = 0;

  console.log('提现 CSV 解析：总行数', lines.length);

  for (let i = 1; i < lines.length; i++) {
    totalRows++;
    const line = lines[i];
    if (!line.trim()) {
      skippedEmpty++;
      continue;
    }

    // 支援兩種 CSV 格式：
    // 1. Excel 格式: "=""value"""
    // 2. Google Sheets 格式: value 或 "value"
    let matches = line.match(/\"=\"\"([^\"]*)\"\"\"/g);
    let clean;

    // 至少需要 15 欄（到 status 欄位）
    if (matches && matches.length >= 15) {
      // Excel 格式
      clean = (m) => m ? m.replace(/^\"=\"\"/, '').replace(/\"\"\"$/, '').trim() : '';
    } else {
      // Google Sheets 普通 CSV 格式 - 使用 CSV 解析
      matches = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          matches.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      matches.push(current);
      // 至少需要 15 欄（到 status 欄位）
      if (matches.length < 15) {
        skippedShortColumns++;
        continue;
      }
      clean = (m) => (m || '').trim();
    }

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
      requestTime: clean(matches[19]).replace(/\//g, '-'), // 统一日期格式为 YYYY-MM-DD
      poolCreateTime: matches[20] ? clean(matches[20]) : '',
      remainPoolCreateTime: matches[21] ? clean(matches[21]) : '',
      transferId: matches[22] ? clean(matches[22]) : '',
      payoutMerchant: matches[23] ? clean(matches[23]) : '',
      payoutCardCode: matches[24] ? clean(matches[24]) : '',
      payoutBank: matches[25] ? clean(matches[25]) : '',
      payoutAccount: matches[26] ? clean(matches[26]) : '',
      payoutAmount: matches[27] ? parseFloat(clean(matches[27]).replace(/,/g, '')) || 0 : 0,
      remark: '', // 不從 CSV 讀取，後面會根據 receivingBank 計算
      transferStatus: matches[29] ? clean(matches[29]) : '' // AE 栏位 - 转账状态 (转账完成/转账失败)
    };

    // 调试：打印第一条记录的关键字段
    if (i === 1) {
      console.log('提现第一条记录 - status:', record.status, ', transferStatus:', record.transferStatus, ', merchantReceiveStatus:', record.merchantReceiveStatus);
      console.log('提现第一条记录 - 列数:', matches.length, ', matches[14]:', matches[14], ', matches[29]:', matches[29]);
    }

    // 计算 isAutoWithdraw (AD栏位公式)：IF(AC="转账完成" AND P="通知完成", 1, 0)
    // 若 transferStatus 为空则用 status 字段判断
    const hasTransferStatus = record.transferStatus && record.transferStatus.trim() !== '';
    const isTransferDone = hasTransferStatus
      ? (record.transferStatus === '转账完成' || record.transferStatus === '轉帳完成' || record.transferStatus === '转帐完成')
      : (record.status && (record.status.includes('提現完成') || record.status.includes('提现完成')));
    const isNotifyDone = record.merchantReceiveStatus === '通知完成';
    record.isAutoWithdraw = (isTransferDone && isNotifyDone) ? 1 : 0;

    // remark 从 receivingBank（收款銀行）欄位計算，不從 CSV 讀取
    // 優先使用 receivingBank，若為空則用商戶名稱判斷
    const receivingBank = record.receivingBank || '';
    const merchantName = record.merchant || '';

    if (receivingBank.includes('支付宝') || receivingBank.includes('支付寶')) {
      record.remark = '支付宝';
    } else if (receivingBank.includes('微信')) {
      record.remark = '微信';
    } else if (merchantName.includes('支付宝') || merchantName.includes('支付寶')) {
      record.remark = '支付宝';
    } else if (merchantName.includes('微信')) {
      record.remark = '微信';
    } else {
      record.remark = '银行卡';
    }

    // 计算处理时间 (AE公式)：IF(V="", Q-T, Q-V)
    // Q = notifyMerchantTime (通知商户时间), T = requestTime (建立时间), V = remainPoolCreateTime (剩余池建立时间)
    // 如果 V 为空：使用 Q - T
    // 如果 V 不为空：使用 Q - V
    record.avgTimeSeconds = null;

    const qTime = record.notifyMerchantTime && record.notifyMerchantTime !== '' && !record.notifyMerchantTime.startsWith('0000')
      ? new Date(record.notifyMerchantTime) : null;
    const tTime = record.requestTime && record.requestTime !== '' && !record.requestTime.startsWith('0000')
      ? new Date(record.requestTime) : null;
    const vTime = record.remainPoolCreateTime && record.remainPoolCreateTime !== '' && !record.remainPoolCreateTime.startsWith('0000')
      ? new Date(record.remainPoolCreateTime) : null;

    if (qTime && !isNaN(qTime)) {
      if (!vTime || isNaN(vTime)) {
        // V 为空，使用 Q - T
        if (tTime && !isNaN(tTime)) {
          record.avgTimeSeconds = (qTime - tTime) / 1000;
        }
      } else {
        // V 不为空，使用 Q - V
        record.avgTimeSeconds = (qTime - vTime) / 1000;
      }
    }

    // 过滤无效时间
    if (record.avgTimeSeconds !== null && (record.avgTimeSeconds < 0 || record.avgTimeSeconds > 86400)) {
      record.avgTimeSeconds = null;
    }

    // 过滤掉商户名称包含「线下」、「test」、「qa」的记录
    const merchantLower = record.merchant.toLowerCase();
    if (merchantLower.includes('test') || merchantLower.includes('qa')) {
      skippedTestQa++;
      continue;
    }
    if (record.merchant.includes('线下') || record.merchant.includes('線下')) {
      skippedOffline++;
      continue;
    }

    records.push(record);
  }

  // ===== 輸出資料清洗統計 =====
  console.log('='.repeat(60));
  console.log('【提現 CSV 資料清洗結果】');
  console.log(`  CSV 總行數（不含標題）: ${totalRows.toLocaleString()}`);
  console.log(`  跳過（空行）: ${skippedEmpty.toLocaleString()}`);
  console.log(`  跳過（欄位不足）: ${skippedShortColumns.toLocaleString()}`);
  console.log(`  跳過（test/qa 商戶）: ${skippedTestQa.toLocaleString()}`);
  console.log(`  跳過（线下/線下 商戶）: ${skippedOffline.toLocaleString()}`);
  console.log(`  清洗後有效記錄數: ${records.length.toLocaleString()}`);
  console.log('='.repeat(60));

  return records;
};

// ===== 匯出功能 =====
import * as XLSX from 'xlsx';

// 汇出充值数据到 Excel
export const exportDepositToExcel = (metrics, filteredRecords, weekRange = null) => {
  const wb = XLSX.utils.book_new();

  // 工作表1: 重要信息 + 处理时间分布 + 充值成功时间区段 (整合)
  const overviewData = [
    ['=== 重要信息 ===', '', ''],
    ['项目', '数值', '说明'],
    ['总申请笔数', metrics.totalApplicationCount || 0, '银行卡+支付宝+微信 成功配对'],
    ['总充值成功（含掉单）', metrics.successfulCount || 0, '笔'],
    ['成功率', `${(metrics.overallSuccessRate || 0).toFixed(2)}%`, ''],
    ['总申请金额', metrics.totalApplicationAmount || 0, '元'],
    ['平均处理时间', formatTime(metrics.overallAvgTime), ''],
    ['无效申请', metrics.invalidApplicationCount || 0, `${(metrics.invalidApplicationRatio || 0).toFixed(2)}%`],
    ['掉单笔数', metrics.overallDropOrderCount || 0, `${(metrics.overallDropOrderRatio || 0).toFixed(2)}%`],
    ['', '', ''],
    ['=== 处理时间分布 ===', '', ''],
    ['时间区段', '笔数', '百分比'],
    ['2分钟内', metrics.within2MinCount || 0, `${(metrics.within2MinRatio || 0).toFixed(2)}%`],
    ['3-5分钟', metrics.within3to5MinCount || 0, `${(metrics.within3to5MinRatio || 0).toFixed(2)}%`],
    ['5-15分钟', metrics.within5to15MinCount || 0, `${(metrics.within5to15MinRatio || 0).toFixed(2)}%`],
    ['15-30分钟', metrics.within15to30MinCount || 0, `${(metrics.within15to30MinRatio || 0).toFixed(2)}%`],
    ['30分钟以上', metrics.over30MinCount || 0, `${(metrics.over30MinRatio || 0).toFixed(2)}%`],
    ['', '', ''],
    ['=== 充值成功时间区段 ===', '', ''],
    ['项目', '笔数/百分比', '金额'],
    ['总充值成功（含掉单）', metrics.minuteAnalysisTotalCount || 0, `${formatAmount(metrics.minuteAnalysisTotalAmount || 0)} 元`],
    ['2分钟内', `${metrics.minuteWithin2MinCount || 0} (${(metrics.minuteWithin2MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin2MinAmount || 0)} 元`],
    ['2-3分钟', `${metrics.minuteWithin2to3MinCount || 0} (${(metrics.minuteWithin2to3MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin2to3MinAmount || 0)} 元`],
    ['3-5分钟', `${metrics.minuteWithin3to5MinCount || 0} (${(metrics.minuteWithin3to5MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin3to5MinAmount || 0)} 元`],
    ['5-15分钟', `${metrics.minuteWithin5to15MinCount || 0} (${(metrics.minuteWithin5to15MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin5to15MinAmount || 0)} 元`],
    ['15-30分钟', `${metrics.minuteWithin15to30MinCount || 0} (${(metrics.minuteWithin15to30MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin15to30MinAmount || 0)} 元`],
    ['30分钟以上', `${metrics.minuteOver30MinCount || 0} (${(metrics.minuteOver30MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteOver30MinAmount || 0)} 元`],
    ['', '', ''],
    ['无效申请', metrics.minuteInvalidCount || 0, `${(metrics.minuteInvalidRatio || 0).toFixed(2)}%`],
    ['掉单', metrics.minuteDropCount || 0, `${(metrics.minuteDropRatio || 0).toFixed(2)}%`],
    ['平均时间', formatTime(metrics.minuteAvgTime), ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, ws1, '总览');

  // 银行卡金额区间（与页面一致）
  const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];
  const noCreditByAmount = metrics.noCreditDowngradeByAmount || {};

  // 工作表2: 銀行卡渠道
  const bankCardChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.jisuApplicationCount || 0, ''],
    ['  一般卡', metrics.normalCardAppCount || 0, ''],
    ['  极速提', metrics.expressCardAppCount || 0, ''],
    ['', '', ''],
    ['成功配对', metrics.totalMatchCount || 0, `${formatAmount(metrics.totalMatchAmount || 0)} 元`],
    ['  一般卡', metrics.normalMatchCount || 0, `${formatAmount(metrics.normalMatchAmount || 0)} 元`],
    ['  极速提', metrics.expressMatchCount || 0, `${formatAmount(metrics.expressMatchAmount || 0)} 元`],
    ['', '', ''],
    ['订单成功', metrics.totalOrderSuccessCount || 0, `${formatAmount(metrics.totalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.normalOrderSuccessCount || 0, `${formatAmount(metrics.normalOrderSuccessAmount || 0)} 元`],
    ['  极速提', metrics.expressOrderSuccessCount || 0, `${formatAmount(metrics.expressOrderSuccessAmount || 0)} 元`],
    ['  信评上分', metrics.creditScoreSuccessCount || 0, `${formatAmount(metrics.creditScoreSuccessAmount || 0)} 元`],
    ['', '', ''],
    ['没信评降等配卡', metrics.noCreditDowngradeTotal || 0, formatTime(metrics.noCreditDowngradeAvgTime)],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, noCreditByAmount[amt] || 0, '']),
    [`  其他`, noCreditByAmount['other'] || 0, ''],
    ['', '', ''],
    ['c2c', metrics.c2cCount || 0, `${formatAmount(metrics.c2cAmount || 0)} 元`],
    ['  点确认', metrics.c2cConfirmCount || 0, formatTime(metrics.c2cConfirmAvgTime)],
    ['  人工审核:通过', metrics.c2cManualAuditCount || 0, formatTime(metrics.c2cAuditSuccessAvgTime)],
    ['  超过11min补件后成功', metrics.c2cOver11MinSuccessCount || 0, ''],
    ['', '', ''],
    ['三方代收', metrics.thirdPartyCount || 0, `${formatAmount(metrics.thirdPartyAmount || 0)} 元`],
    ['  汇通', metrics.thirdPartyHuitongCount || 0, `${formatAmount(metrics.thirdPartyHuitongAmount || 0)} 元`],
    ['  豆豆', metrics.thirdPartyDoudouCount || 0, `${formatAmount(metrics.thirdPartyDoudouAmount || 0)} 元`],
    ['  UC聚合', metrics.thirdPartyUCCount || 0, `${formatAmount(metrics.thirdPartyUCAmount || 0)} 元`],
    ['  其他', metrics.thirdPartyOtherCount || 0, `${formatAmount(metrics.thirdPartyOtherAmount || 0)} 元`],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(bankCardChannel);
  XLSX.utils.book_append_sheet(wb, ws2, '银行卡渠道');

  // 支付宝金额区间（与页面一致）
  const alipayNoCreditByAmount = metrics.alipayNoCreditDowngradeByAmount || {};

  // 工作表3: 支付寶渠道
  const alipayChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.alipayApplicationCount || 0, ''],
    ['  一般卡', metrics.alipayNormalCardAppCount || 0, ''],
    ['  一般宝', metrics.alipayExpressCardAppCount || 0, ''],
    ['  极速提(卡)', metrics.alipayJisuTikaCount || 0, ''],
    ['  极速提(宝)', metrics.alipayJisuTibaoCount || 0, ''],
    ['', '', ''],
    ['成功配对', metrics.alipayTotalMatchCount || 0, `${formatAmount(metrics.alipayTotalMatchAmount || 0)} 元`],
    ['', '', ''],
    ['订单成功', metrics.alipayTotalOrderSuccessCount || 0, `${formatAmount(metrics.alipayTotalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.alipayNormalOrderSuccessCount || 0, `${formatAmount(metrics.alipayNormalOrderSuccessAmount || 0)} 元`],
    ['  一般宝', metrics.alipayBaoOrderSuccessCount || 0, `${formatAmount(metrics.alipayBaoOrderSuccessAmount || 0)} 元`],
    ['  极速提(卡)', metrics.alipayJisuTikaOrderSuccessCount || 0, `${formatAmount(metrics.alipayJisuTikaOrderSuccessAmount || 0)} 元`],
    ['  极速提(宝)', metrics.alipayJisuTibaoOrderSuccessCount || 0, `${formatAmount(metrics.alipayJisuTibaoOrderSuccessAmount || 0)} 元`],
    ['  信评上分', metrics.alipayCreditScoreSuccessCount || 0, `${formatAmount(metrics.alipayCreditScoreSuccessAmount || 0)} 元`],
    ['', '', ''],
    ['没信评降等配卡', metrics.alipayNoCreditDowngradeTotal || 0, formatTime(metrics.alipayNoCreditDowngradeAvgTime)],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, alipayNoCreditByAmount[amt] || 0, '']),
    [`  其他`, alipayNoCreditByAmount['other'] || 0, ''],
    ['', '', ''],
    ['c2c', metrics.alipayC2cCount || 0, `${formatAmount(metrics.alipayC2cAmount || 0)} 元`],
    ['', '', ''],
    ['三方代收', metrics.alipayThirdPartyCount || 0, `${formatAmount(metrics.alipayThirdPartyAmount || 0)} 元`],
    ['', '', ''],
    ['宝转卡渠道 申请', metrics.alipayBaoZhuanKaCount || 0, `${formatAmount(metrics.alipayBaoZhuanKaAmount || 0)} 元`],
    ['宝转卡渠道 成功', metrics.alipayBaoZhuanKaSuccessCount || 0, `${formatAmount(metrics.alipayBaoZhuanKaSuccessAmount || 0)} 元`],
    ['宝转宝渠道 申请', metrics.alipayBaoZhuanBaoCount || 0, `${formatAmount(metrics.alipayBaoZhuanBaoAmount || 0)} 元`],
    ['宝转宝渠道 成功', metrics.alipayBaoZhuanBaoSuccessCount || 0, `${formatAmount(metrics.alipayBaoZhuanBaoSuccessAmount || 0)} 元`],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(alipayChannel);
  XLSX.utils.book_append_sheet(wb, ws3, '支付宝渠道');

  // 微信金额区间（与页面一致）
  const wechatNoCreditByAmount = metrics.wechatNoCreditDowngradeByAmount || {};

  // 工作表4: 微信渠道（比照支付宝4个分类）
  const wechatChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.wechatApplicationCount || 0, ''],
    ['  一般卡', metrics.wechatNormalCardAppCount || 0, ''],
    ['  一般宝', metrics.wechatExpressBaoAppCount || 0, ''],
    ['  极速提(卡)', metrics.wechatJisuTikaCount || 0, ''],
    ['  极速提(宝)', metrics.wechatJisuTibaoCount || 0, ''],
    ['  建单成功等待无配对', metrics.wechatWaitingForMatchCount || 0, ''],
    ['', '', ''],
    ['成功配对', metrics.wechatTotalMatchCount || 0, `${formatAmount(metrics.wechatTotalMatchAmount || 0)} 元`],
    ['  一般卡', metrics.wechatNormalMatchCount || 0, `${formatAmount(metrics.wechatNormalMatchAmount || 0)} 元`],
    ['  一般宝', metrics.wechatExpressBaoMatchCount || 0, `${formatAmount(metrics.wechatExpressBaoMatchAmount || 0)} 元`],
    ['  极速提(卡)', metrics.wechatJisuTikaMatchCount || 0, `${formatAmount(metrics.wechatJisuTikaMatchAmount || 0)} 元`],
    ['  极速提(宝)', metrics.wechatJisuTibaoMatchCount || 0, `${formatAmount(metrics.wechatJisuTibaoMatchAmount || 0)} 元`],
    ['', '', ''],
    ['订单成功', metrics.wechatTotalOrderSuccessCount || 0, `${formatAmount(metrics.wechatTotalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.wechatNormalOrderSuccessCount || 0, `${formatAmount(metrics.wechatNormalOrderSuccessAmount || 0)} 元`],
    ['  一般宝', metrics.wechatBaoOrderSuccessCount || 0, `${formatAmount(metrics.wechatBaoOrderSuccessAmount || 0)} 元`],
    ['  极速提(卡)', metrics.wechatJisuTikaOrderSuccessCount || 0, `${formatAmount(metrics.wechatJisuTikaOrderSuccessAmount || 0)} 元`],
    ['  极速提(宝)', metrics.wechatJisuTibaoOrderSuccessCount || 0, `${formatAmount(metrics.wechatJisuTibaoOrderSuccessAmount || 0)} 元`],
    ['  信评上分', metrics.wechatCreditScoreSuccessCount || 0, `${formatAmount(metrics.wechatCreditScoreSuccessAmount || 0)} 元`],
    ['', '', ''],
    ['没信评降等配卡', metrics.wechatNoCreditDowngradeTotal || 0, formatTime(metrics.wechatNoCreditDowngradeAvgTime)],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, wechatNoCreditByAmount[amt] || 0, '']),
    [`  其他`, wechatNoCreditByAmount['other'] || 0, ''],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(wechatChannel);
  XLSX.utils.book_append_sheet(wb, ws4, '微信渠道');

  // 下載檔案
  let dateRange = '';
  if (weekRange && weekRange.start) {
    if (weekRange.start === weekRange.end) {
      dateRange = weekRange.start;
    } else {
      dateRange = `${weekRange.start}_${weekRange.end}`;
    }
  } else {
    const now = new Date();
    dateRange = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  XLSX.writeFile(wb, `充值分析报表_${dateRange}.xlsx`);
};

// 汇出提现数据到 Excel
export const exportWithdrawToExcel = (metrics, weekRange = null) => {
  const wb = XLSX.utils.book_new();

  // 工作表1: 提现总览
  const overview = [
    ['项目', '数值'],
    ['总提现笔数', metrics.totalWithdrawCount || 0],
    ['总提现金额', `${formatAmount(metrics.totalWithdrawAmount || 0)} 元`],
    ['平均处理时间', formatTime(metrics.avgProcessingTime)],
    ['总记录数', metrics.totalRecords || 0],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(overview);
  XLSX.utils.book_append_sheet(wb, ws1, '提现总览');

  // 工作表2: 銀行卡渠道
  const bankCardWithdraw = [
    ['项目', '数值'],
    ['提现申请', `${metrics.bankCardWithdrawCount || 0} 笔 / ${formatAmount(metrics.bankCardWithdrawAmount || 0)} 元`],
    ['充值配对率', `${((metrics.bankCardMatchRate || 0) * 100).toFixed(2)}%`],
    ['  充值申请', `${metrics.bankCardDepositAppCount || 0} 笔`],
    ['  成功配对', `${metrics.bankCardDepositMatchCount || 0} 笔`],
    ['配对后成功率', `${((metrics.bankCardSuccessAfterMatchRate || 0) * 100).toFixed(2)}%`],
    ['  充值成功笔数', `${metrics.bankCardDepositSuccessCount || 0} 笔`],
    ['平均时间', formatTime(metrics.bankCardAvgTime)],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(bankCardWithdraw);
  XLSX.utils.book_append_sheet(wb, ws2, '银行卡提现');

  // 工作表3: 支付寶渠道
  const alipayWithdraw = [
    ['项目', '数值'],
    ['提现申请', `${metrics.alipayWithdrawCount || 0} 笔 / ${formatAmount(metrics.alipayWithdrawAmount || 0)} 元`],
    ['充值配对率', `${((metrics.alipayMatchRate || 0) * 100).toFixed(2)}%`],
    ['  充值申请', `${metrics.alipayDepositAppCount || 0} 笔`],
    ['  成功配对', `${metrics.alipayDepositMatchCount || 0} 笔`],
    ['配对后成功率', `${((metrics.alipaySuccessAfterMatchRate || 0) * 100).toFixed(2)}%`],
    ['  充值成功笔数', `${metrics.alipayDepositSuccessCount || 0} 笔`],
    ['平均时间', formatTime(metrics.alipayAvgTime)],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(alipayWithdraw);
  XLSX.utils.book_append_sheet(wb, ws3, '支付宝提现');

  // 工作表4: 微信渠道
  const wechatWithdraw = [
    ['项目', '数值'],
    ['提现申请', `${metrics.wechatWithdrawCount || 0} 笔 / ${formatAmount(metrics.wechatWithdrawAmount || 0)} 元`],
    ['充值配对率', `${((metrics.wechatMatchRate || 0) * 100).toFixed(2)}%`],
    ['  充值申请', `${metrics.wechatDepositAppCount || 0} 笔`],
    ['  成功配对', `${metrics.wechatDepositMatchCount || 0} 笔`],
    ['配对后成功率', `${((metrics.wechatSuccessAfterMatchRate || 0) * 100).toFixed(2)}%`],
    ['  充值成功笔数', `${metrics.wechatDepositSuccessCount || 0} 笔`],
    ['平均时间', formatTime(metrics.wechatAvgTime)],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(wechatWithdraw);
  XLSX.utils.book_append_sheet(wb, ws4, '微信提现');

  // 工作表5: 状态分布
  if (metrics.statusDistribution) {
    const statusData = [['状态', '笔数']];
    Object.entries(metrics.statusDistribution).forEach(([status, count]) => {
      statusData.push([status, count]);
    });
    const ws5 = XLSX.utils.aoa_to_sheet(statusData);
    XLSX.utils.book_append_sheet(wb, ws5, '状态分布');
  }

  // 下載檔案
  let dateRange = '';
  if (weekRange && weekRange.start) {
    if (weekRange.start === weekRange.end) {
      dateRange = weekRange.start;
    } else {
      dateRange = `${weekRange.start}_${weekRange.end}`;
    }
  } else {
    const now = new Date();
    dateRange = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  XLSX.writeFile(wb, `提现分析报表_${dateRange}.xlsx`);
};

// 汇出周报数据到 Excel
export const exportWeeklyToExcel = async (weeklyMetrics, analysisMetrics, weekRange, depositMetrics, withdrawMetrics, onProgress) => {
  const startTime = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000; // 10分钟超时

  // 检查是否超时
  const checkTimeout = () => {
    if (Date.now() - startTime > TIMEOUT_MS) {
      throw new Error('导出超时，请减少数据量后重试');
    }
  };

  // 进度回调
  const reportProgress = (step, total, message) => {
    if (onProgress) {
      onProgress({ step, total, message, elapsed: Date.now() - startTime });
    }
  };

  try {
    reportProgress(1, 5, '初始化...');
    await new Promise(resolve => setTimeout(resolve, 0)); // 让 UI 更新

    const wb = XLSX.utils.book_new();
    const m = weeklyMetrics || {};
    const a = analysisMetrics || {};
    const dm = depositMetrics || {};  // 从 depositMetrics 获取银行卡和支付宝的详细数据
    const wm = withdrawMetrics || {};  // 从 withdrawMetrics 获取提现数据

  // 安全数值处理，避免 #DIV/0!
  const safeNum = (val) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '';
    return val;
  };

  // 百分比格式化（显示2位小数，如 0.07%）
  const formatPercent = (val) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '';
    return (val * 100).toFixed(2) + '%';
  };

  // 时间格式化（秒数转 HH:MM:SS）
  const formatTimeHHMMSS = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds) || !isFinite(seconds) || seconds === 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 解析日期
  let month = '';
  let date = '';
  if (weekRange && weekRange.start) {
    const startDate = new Date(weekRange.start);
    month = startDate.getMonth() + 1;
    date = startDate.getDate();
  }

  // 工作表1: 汇总周报数据
  const summaryHeaders = [
    '', '充直申请', 'JS充值等待最终无配对(可能是用户取消 或等不到)', '充值配对\n(配一般卡)', '充值配对(配JS)', '充值配对\n(配一般提)',
    '订单成功\n(加总笔数)', '订单成功\n(一般卡)', '订单成功\n(Js+一般提)', '充值卡在待审核\n(7/21起系统查核中笔数有列入)',
    '未充值\n(7/21起不含等待无配对)', '无卡空单率', '充直订单成功(金额)', '配一般卡\n充直订单成功(金额)', '配极速\n充直订单成功(金额)',
    '充直订单成功(金额)', '提现平均时间(卡)', '提现平均时间(宝)', '骗分', '骗分成本占比', 'JS提现返利'
  ];
  const summaryData = [
    '日期当天',
    safeNum(m.depositApplicationCount || 0),
    safeNum(m.jsWaitingNoMatch || 0),
    safeNum(m.matchNormalCard || 0),
    safeNum(m.matchJS || 0),
    safeNum(m.matchNormalWithdraw || 0),
    safeNum(m.orderSuccessTotal || 0),
    safeNum(m.orderSuccessNormalCard || 0),
    safeNum(m.orderSuccessJS || 0),
    safeNum(m.depositPendingReview || ''),
    safeNum(m.notDeposited || ''),
    formatPercent(m.emptyOrderRate || 0),  // 无卡空单率：显示百分比格式
    safeNum(m.orderSuccessAmountTotal || 0),
    safeNum(m.orderSuccessAmountNormalCard || 0),
    safeNum(m.orderSuccessAmountJS || 0),
    safeNum(m.orderSuccessAmountTotal || ''),
    formatTimeHHMMSS(m.withdrawAvgTimeBankCard || 0),  // 提现平均时间(卡)：HH:MM:SS格式
    formatTimeHHMMSS(m.withdrawAvgTimeAlipay || 0),  // 提现平均时间(宝)：HH:MM:SS格式
    safeNum(m.fraudAmount || 0),
    formatPercent(m.fraudCostRatio || 0),  // 骗分成本占比：显示百分比格式
    safeNum(m.jsWithdrawRebate || 0)
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([summaryHeaders, summaryData]);
  XLSX.utils.book_append_sheet(wb, ws1, '汇总周报数据');

  checkTimeout();
  reportProgress(2, 5, '生成汇总周报数据...');
  await new Promise(resolve => setTimeout(resolve, 0));

  // 工作表2: 总计 银行卡 (使用 dm = depositMetrics, wm = withdrawMetrics)
  // 计算充值配对率和配对后成功率
  const bankCardMatchRate = dm.jisuApplicationCount > 0 ? dm.totalMatchCount / dm.jisuApplicationCount : 0;
  const bankCardSuccessAfterMatchRate = dm.totalMatchCount > 0 ? dm.totalOrderSuccessCount / dm.totalMatchCount : 0;
  // 获取没信评降等配卡的数据
  const noCreditByAmt = dm.noCreditDowngradeByAmount || {};
  const bankCardData = [
    ['JS数据_', month, ' /', date],
    ['充值申请', safeNum(dm.jisuApplicationCount || 0), '笔(', safeNum(dm.normalCardAppCount || 0), '一般卡/', safeNum(dm.expressCardAppCount || 0), '极速提/', safeNum(dm.waitingForMatchCount || 0), '建单成功等待无配对/', safeNum(dm.noCard06Count || 0), '取无卡06提示)'],
    ['成功配对', safeNum(dm.totalMatchCount || 0), '笔/', safeNum(dm.totalMatchAmount || 0), '元'],
    ['- 一般卡', safeNum(dm.normalMatchCount || 0), '笔/', safeNum(dm.normalMatchAmount || 0), '元'],
    ['- 极速提', safeNum(dm.expressMatchCount || 0), '笔/', safeNum(dm.expressMatchAmount || 0), '元'],
    ['订单成功', safeNum(dm.totalOrderSuccessCount || 0), '笔/', safeNum(dm.totalOrderSuccessAmount || 0), '元'],
    ['- 一般卡', safeNum(dm.normalOrderSuccessCount || 0), '笔/', safeNum(dm.normalOrderSuccessAmount || 0), '元', '(汇通', safeNum(dm.thirdPartyHuitongAmount || 0), '元', safeNum(dm.thirdPartyHuitongCount || 0), '笔/', '豆豆', safeNum(dm.thirdPartyDoudouAmount || 0), '元', safeNum(dm.thirdPartyDoudouCount || 0), '笔/', 'UC聚合', safeNum(dm.thirdPartyUCAmount || 0), '元', safeNum(dm.thirdPartyUCCount || 0), '笔)'],
    ['- 极速提', safeNum(dm.expressOrderSuccessCount || 0), '笔/', safeNum(dm.expressOrderSuccessAmount || 0), '元'],
    ['(信评上分', safeNum(dm.creditScoreSuccessCount || 0), '笔', formatTimeHHMMSS(dm.creditScoreAvgTime || 0), '', '', '', '', '', '', '/其中信评不含图文复核', safeNum(dm.creditScoreNoImageCount || 0), '笔', formatTimeHHMMSS(dm.creditScoreNoImageAvgTime || 0), ')'],
    [],
    ['没信评降等配卡', '100元', safeNum(noCreditByAmt[100] || 0), '笔', '200元', safeNum(noCreditByAmt[200] || 0), '笔', '300元', safeNum(noCreditByAmt[300] || 0), '笔', '500元', safeNum(noCreditByAmt[500] || 0), '笔', '1000元', safeNum(noCreditByAmt[1000] || 0), '笔'],
    ['', '1500元', safeNum(noCreditByAmt[1500] || 0), '笔', '2000元', safeNum(noCreditByAmt[2000] || 0), '笔', '3000元', safeNum(noCreditByAmt[3000] || 0), '笔', '5000元', safeNum(noCreditByAmt[5000] || 0), '笔', '6000元', safeNum(noCreditByAmt[6000] || 0), '笔'],
    ['', '7000元', safeNum(noCreditByAmt[7000] || 0), '笔', '8000元', safeNum(noCreditByAmt[8000] || 0), '笔', '9000元', safeNum(noCreditByAmt[9000] || 0), '笔', '10000元', safeNum(noCreditByAmt[10000] || 0), '笔', '15000元', safeNum(noCreditByAmt[15000] || 0), '笔'],
    ['', '20000元', safeNum(noCreditByAmt[20000] || 0), '笔', '30000元', safeNum(noCreditByAmt[30000] || 0), '笔', '其他', safeNum(noCreditByAmt['other'] || 0), '笔', '总计=', safeNum(dm.noCreditDowngradeTotal || 0), '笔'],
    ['^空单_'],
    ['平均时间：', formatTimeHHMMSS(dm.noCreditDowngradeAvgTime || 0)],
    [],
    ['提现申请', safeNum(wm.bankCardWithdrawCount || 0), '笔(极速)/', safeNum(wm.bankCardWithdrawAmount || 0), '元'],
    ['充值配对率', formatPercent(bankCardMatchRate), '(成功配对', safeNum(dm.totalMatchCount || 0), '笔/充值申请', safeNum(dm.jisuApplicationCount || 0), '笔)'],
    ['配对后成功率', formatPercent(bankCardSuccessAfterMatchRate), '(充值成功', safeNum(dm.totalOrderSuccessCount || 0), '笔/成功配对', safeNum(dm.totalMatchCount || 0), '笔)'],
    ['平均时间：', formatTimeHHMMSS(m.withdrawAvgTimeBankCard || 0)],
    [],
    ['c2c ', safeNum(dm.c2cCount || 0), '笔点确认平均', formatTimeHHMMSS(dm.c2cConfirmAvgTime || 0), '、人工审核:通过', safeNum(dm.c2cManualAuditCount || 0), '笔审核-成功平均', formatTimeHHMMSS(dm.c2cAuditSuccessAvgTime || 0), '、', safeNum(dm.c2cOver11MinSuccessCount || 0), '笔用户较久补材料后成功', '、骗分拉黑', safeNum(dm.c2cFraudBlacklistCount || 0), '+卡验及人验', safeNum(dm.c2cCardVerifyCount || 0), '笔'],
    [],
    ['骗分没到账来找'],
    ['人工  ', safeNum(m.fraudBankCardManual || ''), '元/', safeNum(m.fraudBankCardManualCount || ''), '笔'],
    ['信评 ', safeNum(m.fraudBankCardCredit || 0), '元/', safeNum(m.fraudBankCardCreditCount || 0), '笔'],
    ['没上传回单重复出款充值上分', safeNum(dm.noReceiptDuplicateCount || 0), '笔']
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(bankCardData);
  XLSX.utils.book_append_sheet(wb, ws2, '总计 银行卡');

  checkTimeout();
  reportProgress(3, 5, '生成银行卡数据...');
  await new Promise(resolve => setTimeout(resolve, 0));

  // 工作表3: 总计 支付宝 (使用 dm = depositMetrics, wm = withdrawMetrics)
  // 计算支付宝充值配对率和配对后成功率
  const alipayMatchRate = dm.alipayApplicationCount > 0 ? dm.alipayTotalMatchCount / dm.alipayApplicationCount : 0;
  const alipaySuccessAfterMatchRate = dm.alipayTotalMatchCount > 0 ? dm.alipayTotalOrderSuccessCount / dm.alipayTotalMatchCount : 0;
  // 获取支付宝没信评降等配卡的数据
  const alipayNoCreditByAmt = dm.alipayNoCreditDowngradeByAmount || {};
  const alipayData = [
    ['JS数据_', month, ' /', date, '【支付宝】'],
    ['充值申请', safeNum(dm.alipayApplicationCount || 0), '笔(', safeNum(dm.alipayNormalCardAppCount || 0), '一般卡/', safeNum(dm.alipayExpressCardAppCount || 0), '一般宝/', safeNum(dm.alipayJisuTikaCount || 0), '极速提卡/', safeNum(dm.alipayJisuTibaoCount || 0), '极速提宝/', safeNum(dm.alipayWaitingForMatchCount || 0), '建单成功等待无配对/', safeNum(dm.alipayNoCard06Count || 0), '取无卡06提示)'],
    ['成功配对', safeNum(dm.alipayTotalMatchCount || 0), '笔/', safeNum(dm.alipayTotalMatchAmount || 0), '元'],
    ['- 一般卡', safeNum(dm.alipayNormalMatchCount || 0), '笔/', safeNum(dm.alipayNormalMatchAmount || 0), '元'],
    ['-一般宝', safeNum(dm.alipayExpressCardAppCount || 0), '笔/', safeNum(dm.alipayExpressBaoMatchAmount || 0), '元'],
    ['-极速提(卡)', safeNum(dm.alipayJisuTikaCount || 0), '笔/', safeNum(dm.alipayJisuTikaMatchAmount || 0), '元'],
    ['-极速提(宝)', safeNum(dm.alipayJisuTibaoCount || 0), '笔/', safeNum(dm.alipayJisuTibaoMatchAmount || 0), '元'],
    ['订单成功', safeNum(dm.alipayTotalOrderSuccessCount || 0), '笔/', safeNum(dm.alipayTotalOrderSuccessAmount || 0), '元'],
    ['- 一般卡', safeNum(dm.alipayNormalOrderSuccessCount || 0), '笔/', safeNum(dm.alipayNormalOrderSuccessAmount || 0), '元', '(汇通', safeNum(dm.alipayThirdPartyHuitongAmount || 0), '元', safeNum(dm.alipayThirdPartyHuitongCount || 0), '笔/', '豆豆', safeNum(dm.alipayThirdPartyDoudouAmount || 0), '元', safeNum(dm.alipayThirdPartyDoudouCount || 0), '笔/', 'UC聚合', safeNum(dm.alipayThirdPartyUCAmount || 0), '元', safeNum(dm.alipayThirdPartyUCCount || 0), '笔)'],
    ['-一般宝', safeNum(dm.alipayBaoOrderSuccessCount || 0), '笔/', safeNum(dm.alipayBaoOrderSuccessAmount || 0), '元'],
    ['-极速提(卡)', safeNum(dm.alipayJisuTikaOrderSuccessCount || 0), '笔/', safeNum(dm.alipayJisuTikaOrderSuccessAmount || 0), '元'],
    ['-极速提(宝)', safeNum(dm.alipayJisuTibaoOrderSuccessCount || 0), '笔/', safeNum(dm.alipayJisuTibaoOrderSuccessAmount || 0), '元'],
    ['(信评上分', safeNum(dm.alipayCreditScoreSuccessCount || 0), '笔', formatTimeHHMMSS(dm.alipayCreditScoreAvgTime || 0), '', '', '/其中信评不含图文复核', safeNum(dm.alipayCreditNoTuwenCount || 0), '笔', formatTimeHHMMSS(dm.alipayCreditNoTuwenAvgTime || 0), ')'],
    ['没信评降等配卡', '100元', safeNum(alipayNoCreditByAmt[100] || 0), '笔', '200元', safeNum(alipayNoCreditByAmt[200] || 0), '笔', '300元', safeNum(alipayNoCreditByAmt[300] || 0), '笔', '500元', safeNum(alipayNoCreditByAmt[500] || 0), '笔', '1000元', safeNum(alipayNoCreditByAmt[1000] || 0), '笔'],
    ['', '1500元', safeNum(alipayNoCreditByAmt[1500] || 0), '笔', '2000元', safeNum(alipayNoCreditByAmt[2000] || 0), '笔', '3000元', safeNum(alipayNoCreditByAmt[3000] || 0), '笔', '5000元', safeNum(alipayNoCreditByAmt[5000] || 0), '笔', '6000元', safeNum(alipayNoCreditByAmt[6000] || 0), '笔'],
    ['', '7000元', safeNum(alipayNoCreditByAmt[7000] || 0), '笔', '8000元', safeNum(alipayNoCreditByAmt[8000] || 0), '笔', '9000元', safeNum(alipayNoCreditByAmt[9000] || 0), '笔', '10000元', safeNum(alipayNoCreditByAmt[10000] || 0), '笔', '15000元', safeNum(alipayNoCreditByAmt[15000] || 0), '笔'],
    ['', '20000元', safeNum(alipayNoCreditByAmt[20000] || 0), '笔', '30000元', safeNum(alipayNoCreditByAmt[30000] || 0), '笔', '其他', safeNum(alipayNoCreditByAmt['other'] || 0), '笔', '总计=', safeNum(dm.alipayNoCreditDowngradeTotal || 0), '笔'],
    ['平均时间：', formatTimeHHMMSS(dm.alipayNoCreditDowngradeAvgTime || 0)],
    [],
    ['提现申请', safeNum(wm.alipayWithdrawCount || 0), '笔(极速)/', safeNum(wm.alipayWithdrawAmount || 0), '元'],
    ['充值配对率', formatPercent(alipayMatchRate), ' (成功配对', safeNum(dm.alipayTotalMatchCount || 0), '笔/充值申请', safeNum(dm.alipayApplicationCount || 0), '笔)'],
    ['配对后成功率', formatPercent(alipaySuccessAfterMatchRate), ' (充值成功', safeNum(dm.alipayTotalOrderSuccessCount || 0), '笔/成功配对', safeNum(dm.alipayTotalMatchCount || 0), '笔)'],
    ['平均时间', formatTimeHHMMSS(m.withdrawAvgTimeAlipay || 0)],
    [],
    ['c2c ', safeNum(dm.alipayC2cCount || 0), '筆点确认平均', formatTimeHHMMSS(dm.alipayC2cConfirmAvgTime || 0), '、人工审核:通过', safeNum(dm.alipayC2cManualAuditCount || 0), '笔审核-成功平均', formatTimeHHMMSS(dm.alipayC2cAuditSuccessAvgTime || 0), '、', safeNum(dm.alipayC2cOver11MinSuccessCount || 0), '笔用户较久补材料后成功', '、骗分拉黑', safeNum(dm.alipayC2cFraudBlacklistCount || 0), '+卡验及人验', safeNum(dm.alipayC2cCardVerifyCount || 0), '笔'],
    [],
    ['骗分没到账来找'],
    ['人工  ', safeNum(m.fraudAlipayManual || ''), '元/', safeNum(m.fraudAlipayManualCount || ''), '笔'],
    ['信评 ', safeNum(m.fraudAlipayCredit || 0), '元/', safeNum(m.fraudAlipayCreditCount || 0), '笔'],
    ['没上传回单重复出款充值上分', safeNum(dm.alipayNoReceiptDuplicateCount || 0), '笔'],
    ['微信 充成功', safeNum(dm.wechatTotalOrderSuccessAmount || 0), '元/', safeNum(dm.wechatTotalOrderSuccessCount || 0), '笔', ',提现', safeNum(wm.wechatWithdrawAmount || 0), '元'],
    [],
    ['宝转卡渠道，配支付宝提现 申请', safeNum(dm.alipayBaoZhuanKaAmount || 0), '元/', safeNum(dm.alipayBaoZhuanKaCount || 0), '笔', ',成功', safeNum(dm.alipayBaoZhuanKaSuccessAmount || 0), '元/', safeNum(dm.alipayBaoZhuanKaSuccessCount || 0), '笔'],
    ['宝转宝渠道，配银行卡提现 申请', safeNum(dm.alipayBaoZhuanBaoAmount || 0), '元/', safeNum(dm.alipayBaoZhuanBaoCount || 0), '笔', ',成功', safeNum(dm.alipayBaoZhuanBaoSuccessAmount || 0), '元/', safeNum(dm.alipayBaoZhuanBaoSuccessCount || 0), '笔'],
    // 整体 配对成功$/提现申请$ = (银行卡极速提成功金额 + 支付宝极速提(卡)成功金额 + 极速提(宝)成功金额) / (银行卡提现金额 + 支付宝提现金额)
    ['整体 配对成功$/提现申请$', (() => {
      const numerator = (dm.expressOrderSuccessAmount || 0) + (dm.alipayJisuTikaOrderSuccessAmount || 0) + (dm.alipayJisuTibaoOrderSuccessAmount || 0);
      const denominator = (wm.bankCardWithdrawAmount || 0) + (wm.alipayWithdrawAmount || 0);
      return denominator > 0 ? formatPercent(numerator / denominator) : '';
    })()]
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(alipayData);
  XLSX.utils.book_append_sheet(wb, ws3, '总计 支付宝');

  checkTimeout();
  reportProgress(4, 5, '生成支付宝数据...');
  await new Promise(resolve => setTimeout(resolve, 0));

  // 下載檔案
  reportProgress(5, 5, '导出Excel文件...');
  await new Promise(resolve => setTimeout(resolve, 0));

  let dateRange = '';
  if (weekRange && weekRange.start) {
    if (weekRange.start === weekRange.end) {
      dateRange = weekRange.start;
    } else {
      dateRange = `${weekRange.start}_${weekRange.end}`;
    }
  } else {
    const now = new Date();
    dateRange = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  XLSX.writeFile(wb, `日周报数据汇总_${dateRange}.xlsx`);

  const elapsed = Date.now() - startTime;
  console.log(`导出完成，耗时: ${(elapsed / 1000).toFixed(2)}秒`);
  return { success: true, elapsed };

  } catch (error) {
    console.error('导出失败:', error);
    throw error;
  }
};

// 汇出充值数据为纯文字
export const exportDepositToText = (metrics, weekRange, withdrawMetrics = null, weeklyMetrics = null) => {
  const m = metrics || {};
  const wm = withdrawMetrics || {};
  const wkm = weeklyMetrics || {};

  // 安全數值處理
  const safeNum = (val, defaultVal = 0) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return defaultVal;
    return val;
  };

  // 从对象中获取金额区间数量
  const getAmountCount = (obj, amt) => {
    if (!obj || typeof obj !== 'object') return 0;
    return safeNum(obj[amt], 0);
  };

  // 格式化时间 (秒数转 HH:MM:SS 或 M:SS)
  const formatTimeText = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '';
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化百分比
  const formatPercent = (val) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '';
    return (val * 100).toFixed(2) + '%';
  };

  // 解析日期
  let month = '';
  let day = '';
  if (weekRange && weekRange.start) {
    const startDate = new Date(weekRange.start);
    month = startDate.getMonth() + 1;
    day = startDate.getDate();
  }

  // 计算配对率
  const bankCardMatchRate = m.jisuApplicationCount > 0 ? m.totalMatchCount / m.jisuApplicationCount : 0;
  const bankCardSuccessAfterMatchRate = m.totalMatchCount > 0 ? m.totalOrderSuccessCount / m.totalMatchCount : 0;
  const alipayMatchRate = m.alipayApplicationCount > 0 ? m.alipayTotalMatchCount / m.alipayApplicationCount : 0;
  const alipaySuccessAfterMatchRate = m.alipayTotalMatchCount > 0 ? m.alipayTotalOrderSuccessCount / m.alipayTotalMatchCount : 0;

  // 银行卡区块
  const bankCardText = `JS数据_${month}/${day}
充值申请${safeNum(m.jisuApplicationCount)}笔(${safeNum(m.normalCardAppCount)}一般卡/${safeNum(m.expressCardAppCount)}极速提/${safeNum(m.waitingForMatchCount)}建单成功等待无配对/${safeNum(m.noCard06Count)}取无卡06提示)
成功配对${safeNum(m.totalMatchCount)}笔/${safeNum(m.totalMatchAmount)}元
-一般卡${safeNum(m.normalMatchCount)}笔/${safeNum(m.normalMatchAmount)}元
-极速提${safeNum(m.expressMatchCount)}笔/${safeNum(m.expressMatchAmount)}元
订单成功${safeNum(m.totalOrderSuccessCount)}笔/${safeNum(m.totalOrderSuccessAmount)}元
-一般卡${safeNum(m.normalOrderSuccessCount)}笔/${safeNum(m.normalOrderSuccessAmount)}元(汇通${safeNum(m.thirdPartyHuitongAmount)}元${safeNum(m.thirdPartyHuitongCount)}笔/豆豆${safeNum(m.thirdPartyDoudouAmount)}元${safeNum(m.thirdPartyDoudouCount)}笔/UC聚合${safeNum(m.thirdPartyUCAmount)}元${safeNum(m.thirdPartyUCCount)}笔)
-极速提${safeNum(m.expressOrderSuccessCount)}笔/${safeNum(m.expressOrderSuccessAmount)}元
(信评上分${safeNum(m.creditScoreSuccessCount)}笔${formatTimeText(m.creditScoreAvgTime)}/其中信评不含图文复核${safeNum(m.creditScoreNoImageCount)}笔${formatTimeText(m.creditScoreNoImageAvgTime)})

#.没信评降等配卡-100/${getAmountCount(m.noCreditDowngradeByAmount, 100)}笔200/${getAmountCount(m.noCreditDowngradeByAmount, 200)}笔300/${getAmountCount(m.noCreditDowngradeByAmount, 300)}笔500/${getAmountCount(m.noCreditDowngradeByAmount, 500)}笔1000/${getAmountCount(m.noCreditDowngradeByAmount, 1000)}笔1500/${getAmountCount(m.noCreditDowngradeByAmount, 1500)}笔2000/${getAmountCount(m.noCreditDowngradeByAmount, 2000)}笔3000/${getAmountCount(m.noCreditDowngradeByAmount, 3000)}笔5000/${getAmountCount(m.noCreditDowngradeByAmount, 5000)}笔6000/${getAmountCount(m.noCreditDowngradeByAmount, 6000)}笔7000/${getAmountCount(m.noCreditDowngradeByAmount, 7000)}笔8000/${getAmountCount(m.noCreditDowngradeByAmount, 8000)}笔9000/${getAmountCount(m.noCreditDowngradeByAmount, 9000)}笔10000/${getAmountCount(m.noCreditDowngradeByAmount, 10000)}笔15000/${getAmountCount(m.noCreditDowngradeByAmount, 15000)}笔20000/${getAmountCount(m.noCreditDowngradeByAmount, 20000)}笔30000/${getAmountCount(m.noCreditDowngradeByAmount, 30000)}笔=${safeNum(m.noCreditDowngradeTotal)}
^空单_
平均时间${formatTimeText(m.noCreditDowngradeAvgTime)}

提现申请${safeNum(wm.bankCardWithdrawCount)}笔(极速)/${safeNum(wm.bankCardWithdrawAmount)}元
充值配对率${formatPercent(bankCardMatchRate)}(成功配对${safeNum(m.totalMatchCount)}笔/充值申请${safeNum(m.jisuApplicationCount)}笔)
配对后成功率${formatPercent(bankCardSuccessAfterMatchRate)}(充值成功${safeNum(m.totalOrderSuccessCount)}笔/成功配对${safeNum(m.totalMatchCount)}笔)
平均时间${formatTimeText(wm.bankCardAvgTime)}

c2c${safeNum(m.c2cCount)}笔点确认平均${formatTimeText(m.c2cConfirmAvgTime)}、人工审核:通过${safeNum(m.c2cManualAuditCount)}笔审核-成功平均${formatTimeText(m.c2cAuditSuccessAvgTime)}、${safeNum(m.c2cOver11MinSuccessCount)}笔用户较久补材料后成功、骗分拉黑${safeNum(wkm.fraudBankCardFraudBlacklistCount)}+卡验及人验${safeNum(wkm.fraudBankCardCardVerifyCount)}笔

骗分没到账来找
人工${safeNum(wkm.fraudBankCardManual, '')}元/${safeNum(wkm.fraudBankCardManualCount, '')}笔
信评${safeNum(wkm.fraudBankCardCredit)}元/${safeNum(wkm.fraudBankCardCreditCount)}笔`;

  // 支付宝区块
  const alipayText = `JS数据_${month}/${day}【支付宝】
充值申请${safeNum(m.alipayApplicationCount)}笔(${safeNum(m.alipayNormalCardAppCount)}一般卡/${safeNum(m.alipayExpressCardAppCount)}一般宝/${safeNum(m.alipayJisuTikaCount)}极速提卡/${safeNum(m.alipayJisuTibaoCount)}极速提宝/${safeNum(m.alipayWaitingForMatchCount)}建单成功等待无配对/${safeNum(m.alipayNoCard06Count)}取无卡06提示)
成功配对${safeNum(m.alipayTotalMatchCount)}笔/${safeNum(m.alipayTotalMatchAmount)}元
-一般卡${safeNum(m.alipayNormalMatchCount)}笔/${safeNum(m.alipayNormalMatchAmount)}元
-一般宝${safeNum(m.alipayExpressCardAppCount)}笔/${safeNum(m.alipayExpressBaoMatchAmount)}元
-极速提(卡)${safeNum(m.alipayJisuTikaCount)}笔/${safeNum(m.alipayJisuTikaMatchAmount)}元
-极速提(宝)${safeNum(m.alipayJisuTibaoCount)}笔/${safeNum(m.alipayJisuTibaoMatchAmount)}元
订单成功${safeNum(m.alipayTotalOrderSuccessCount)}笔/${safeNum(m.alipayTotalOrderSuccessAmount)}元
-一般卡${safeNum(m.alipayNormalOrderSuccessCount)}笔/${safeNum(m.alipayNormalOrderSuccessAmount)}元(汇通${safeNum(m.alipayThirdPartyHuitongAmount)}元${safeNum(m.alipayThirdPartyHuitongCount)}笔/豆豆${safeNum(m.alipayThirdPartyDoudouAmount)}元${safeNum(m.alipayThirdPartyDoudouCount)}笔/UC聚合${safeNum(m.alipayThirdPartyUCAmount)}元${safeNum(m.alipayThirdPartyUCCount)}笔)
-一般宝${safeNum(m.alipayBaoOrderSuccessCount)}笔/${safeNum(m.alipayBaoOrderSuccessAmount)}元
-极速提(卡)${safeNum(m.alipayJisuTikaOrderSuccessCount)}笔/${safeNum(m.alipayJisuTikaOrderSuccessAmount)}元
-极速提(宝)${safeNum(m.alipayJisuTibaoOrderSuccessCount)}笔/${safeNum(m.alipayJisuTibaoOrderSuccessAmount)}元
(信评上分${safeNum(m.alipayCreditScoreSuccessCount)}笔${formatTimeText(m.alipayCreditScoreAvgTime)}/其中信评不含图文复核${safeNum(m.alipayCreditNoTuwenCount)}笔${formatTimeText(m.alipayCreditNoTuwenAvgTime)})

#.没信评降等配卡-100/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 100)}笔200/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 200)}笔300/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 300)}笔500/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 500)}笔1000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 1000)}笔1500/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 1500)}笔2000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 2000)}笔3000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 3000)}笔5000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 5000)}笔6000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 6000)}笔7000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 7000)}笔8000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 8000)}笔9000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 9000)}笔10000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 10000)}笔15000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 15000)}笔20000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 20000)}笔30000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 30000)}笔=${safeNum(m.alipayNoCreditDowngradeTotal)}
平均时间${formatTimeText(m.alipayNoCreditDowngradeAvgTime)}

提现申请${safeNum(wm.alipayWithdrawCount)}笔(极速)/${safeNum(wm.alipayWithdrawAmount)}元
充值配对率${formatPercent(alipayMatchRate)}(成功配对${safeNum(m.alipayTotalMatchCount)}笔/充值申请${safeNum(m.alipayApplicationCount)}笔)
配对后成功率${formatPercent(alipaySuccessAfterMatchRate)}(充值成功${safeNum(m.alipayTotalOrderSuccessCount)}笔/成功配对${safeNum(m.alipayTotalMatchCount)}笔)
平均时间${formatTimeText(wm.alipayAvgTime)}

c2c${safeNum(m.alipayC2cCount)}筆点确认平均${formatTimeText(m.alipayC2cConfirmAvgTime)}、人工审核:通过${safeNum(m.alipayC2cManualAuditCount)}笔审核-成功平均${formatTimeText(m.alipayC2cAuditSuccessAvgTime)}、${safeNum(m.alipayC2cOver11MinSuccessCount)}笔用户较久补材料后成功、骗分拉黑${safeNum(wkm.fraudAlipayFraudBlacklistCount)}+卡验及人验${safeNum(wkm.fraudAlipayCardVerifyCount)}笔

骗分没到账来找
人工${safeNum(wkm.fraudAlipayManual, '')}元/${safeNum(wkm.fraudAlipayManualCount, '')}笔
信评${safeNum(wkm.fraudAlipayCredit)}元/${safeNum(wkm.fraudAlipayCreditCount)}笔
没上传回单重复出款充值上分${safeNum(wkm.fraudAlipayNoReceiptCount)}笔
微信充成功${safeNum(m.wechatTotalOrderSuccessAmount)}元/${safeNum(m.wechatTotalOrderSuccessCount)}笔${formatTimeText(m.wechatCreditScoreAvgTime)},提现${safeNum(wm.wechatWithdrawAmount)}元
宝转卡渠道，配支付宝提现申请${safeNum(m.alipayBaoZhuanKaAmount)}元/${safeNum(m.alipayBaoZhuanKaCount)}笔,成功${safeNum(m.alipayBaoZhuanKaSuccessAmount)}元/${safeNum(m.alipayBaoZhuanKaSuccessCount)}笔
宝转宝渠道，配银行卡提现申请${safeNum(m.alipayBaoZhuanBaoAmount)}元/${safeNum(m.alipayBaoZhuanBaoCount)}笔,成功${safeNum(m.alipayBaoZhuanBaoSuccessAmount)}元/${safeNum(m.alipayBaoZhuanBaoSuccessCount)}笔
整体配对成功$/提现申请$${(() => {
  const numerator = safeNum(m.expressOrderSuccessAmount) + safeNum(m.alipayJisuTikaOrderSuccessAmount) + safeNum(m.alipayJisuTibaoOrderSuccessAmount);
  const denominator = safeNum(wm.bankCardWithdrawAmount) + safeNum(wm.alipayWithdrawAmount);
  return denominator > 0 ? formatPercent(numerator / denominator) : '0.00%';
})()}`;

  // 合併文字
  const fullText = bankCardText + '\n\n' + alipayText;

  // 下載純文字檔
  const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  let dateRange = '';
  if (weekRange && weekRange.start) {
    if (weekRange.start === weekRange.end) {
      // 單日：只顯示一個日期
      dateRange = weekRange.start;
    } else {
      // 多日：顯示起訖日期
      dateRange = `${weekRange.start}_${weekRange.end}`;
    }
  } else {
    const now = new Date();
    dateRange = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  a.download = `日周报数据汇总_${dateRange}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 计算提现指标
export const calculateWithdrawMetrics = (records, depositMetrics = null) => {
  const startTime = performance.now();
  const TIMEOUT_MS = 180000; // 180秒超时

  // ===== 先按商戶分類過濾：(銀行卡 + 支付寶 + 微信) + 線下 =====
  const isInCategory = (r) => {
    const merchant = r.merchant || '';
    const hasJiSu = merchant.includes('极速充提3');
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');
    const hasWechat = merchant.includes('微信');
    const hasOffline = merchant.includes('线下') || merchant.includes('線下');

    const isInBankCard = hasJiSu && !hasAlipay && !hasWechat;
    const isInAlipay = hasAlipay;
    const isInWechat = hasWechat;
    const isInOffline = hasOffline && !hasAlipay && !hasWechat && !hasJiSu;

    return isInBankCard || isInAlipay || isInWechat || isInOffline;
  };

  const filteredRecords = records.filter(isInCategory);
  console.log(`提現商戶分類過濾：原始 ${records.length} 筆 → 過濾後 ${filteredRecords.length} 筆`);

  // ===== 单次遍历处理去重和分类 =====
  const uniqueWithdrawRecords = {};
  const len = filteredRecords.length;

  // 累加器
  let autoWithdrawTimeSum = 0, autoWithdrawTimeCount = 0;
  let bankCardWithdrawCount = 0, bankCardWithdrawAmount = 0;
  let bankCardAvgTimeSum = 0, bankCardAvgTimeCount = 0;
  let alipayWithdrawCount = 0, alipayWithdrawAmount = 0;
  let alipayAvgTimeSum = 0, alipayAvgTimeCount = 0;
  let wechatWithdrawCount = 0, wechatWithdrawAmount = 0;
  let wechatAvgTimeSum = 0, wechatAvgTimeCount = 0;

  // 第一次遍历：去重 + 计算渠道指标
  for (let i = 0; i < len; i++) {
    const r = filteredRecords[i];

    // 去重保留最后一笔
    uniqueWithdrawRecords[r.id] = r;

    // 自动提现平均时间
    if (r.isAutoWithdraw === 1 && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      autoWithdrawTimeSum += r.avgTimeSeconds;
      autoWithdrawTimeCount++;
    }

    // 首次调试：输出第一条符合条件的记录详情
    if (i === 0 && r.isAutoWithdraw !== undefined) {
      console.log('提现第一条记录 isAutoWithdraw:', r.isAutoWithdraw, 'avgTimeSeconds:', r.avgTimeSeconds);
    }

    // 银行卡渠道
    if (r.remark === '银行卡' && r.requestAmount > 0) {
      bankCardWithdrawCount++;
      bankCardWithdrawAmount += r.payoutAmount || 0;
    }

    // 银行卡平均时间 (检查繁简体，若 transferStatus 为空则用 status 字段)
    const hasTransferStatus = r.transferStatus && r.transferStatus.trim() !== '';
    const isTransferComplete = hasTransferStatus
      ? (r.transferStatus === '轉帳完成' || r.transferStatus === '转账完成' || r.transferStatus === '转帐完成')
      : (r.status && (r.status.includes('提現完成') || r.status.includes('提现完成')));
    if (r.receivingBank !== '支付宝' && isTransferComplete && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      bankCardAvgTimeSum += r.avgTimeSeconds;
      bankCardAvgTimeCount++;
    }

    // 支付宝渠道
    if (r.remark === '支付宝' && r.requestAmount > 0) {
      alipayWithdrawCount++;
      alipayWithdrawAmount += r.payoutAmount || 0;
    }

    // 支付宝平均时间
    if (r.receivingBank === '支付宝' && isTransferComplete && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      alipayAvgTimeSum += r.avgTimeSeconds;
      alipayAvgTimeCount++;
    }

    // 微信渠道
    if (r.remark === '微信' && r.requestAmount > 0) {
      wechatWithdrawCount++;
      wechatWithdrawAmount += r.payoutAmount || 0;
    }

    // 微信平均时间
    if (r.remark === '微信' && isTransferComplete && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      wechatAvgTimeSum += r.avgTimeSeconds;
      wechatAvgTimeCount++;
    }
  }

  // 第二次遍历：去重后的记录处理成功/失败和时间区段
  const deduplicatedRecords = Object.values(uniqueWithdrawRecords);
  const uniqueOrderCount = deduplicatedRecords.length;

  let withdrawFailedCount = 0;
  let totalWithdrawCount = 0, totalWithdrawAmount = 0;

  // 调试：统计 status 字段的不同值
  const statusCounts = {};
  let withdrawWithin2MinCount = 0, withdrawWithin2MinAmount = 0;
  let withdrawWithin2to5MinCount = 0, withdrawWithin2to5MinAmount = 0;
  let withdrawWithin5to15MinCount = 0, withdrawWithin5to15MinAmount = 0;
  let withdrawWithin15to30MinCount = 0, withdrawWithin15to30MinAmount = 0;
  let withdrawOver30MinCount = 0, withdrawOver30MinAmount = 0;

  for (let i = 0; i < deduplicatedRecords.length; i++) {
    const r = deduplicatedRecords[i];
    const transferStatus = r.transferStatus || '';
    const status = r.status || '';
    const actualAmount = r.actualAmount || 0;

    // 调试：统计 status 值
    const statusKey = status || '(空)';
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

    // 判断提现是否成功：同时检查 transferStatus 和 status 字段
    const isWithdrawSuccess =
      (transferStatus === '轉帳完成' || transferStatus === '转帐完成' || transferStatus === '转账完成') ||
      (status.includes('提現完成') || status.includes('提现完成'));

    // 提现失败：只计算明确的失败状态（不含异常）
    const isWithdrawFailed =
      (transferStatus.includes('轉帳失敗') || transferStatus.includes('转帐失败') || transferStatus.includes('转账失败')) ||
      (status.includes('提現失敗') || status.includes('提现失败') ||
       status.includes('商戶確認未到帳') || status.includes('商户确认未到账') ||
       status.includes('未收單') || status.includes('未收单'));
    if (isWithdrawFailed) {
      withdrawFailedCount++;
    }

    // 提现成功
    if (isWithdrawSuccess) {
      totalWithdrawCount++;
      totalWithdrawAmount += actualAmount;

      // 时间区段
      const seconds = r.avgTimeSeconds !== null ? Math.round(r.avgTimeSeconds) : null;
      if (seconds !== null && seconds >= 0) {
        if (seconds < 120) {
          withdrawWithin2MinCount++;
          withdrawWithin2MinAmount += actualAmount;
        } else if (seconds < 300) {
          withdrawWithin2to5MinCount++;
          withdrawWithin2to5MinAmount += actualAmount;
        } else if (seconds < 900) {
          withdrawWithin5to15MinCount++;
          withdrawWithin5to15MinAmount += actualAmount;
        } else if (seconds < 1800) {
          withdrawWithin15to30MinCount++;
          withdrawWithin15to30MinAmount += actualAmount;
        } else {
          withdrawOver30MinCount++;
          withdrawOver30MinAmount += actualAmount;
        }
      }
    }
  }

  // 计算衍生指标
  const withdrawSuccessTotalCount = withdrawWithin2MinCount + withdrawWithin2to5MinCount + withdrawWithin5to15MinCount + withdrawWithin15to30MinCount + withdrawOver30MinCount + withdrawFailedCount;
  const withdrawSuccessTotalAmount = totalWithdrawAmount;
  const totalBase = withdrawSuccessTotalCount || 1;

  const withdrawWithin2MinRatio = (withdrawWithin2MinCount / totalBase) * 100;
  const withdrawWithin2to5MinRatio = (withdrawWithin2to5MinCount / totalBase) * 100;
  const withdrawWithin5to15MinRatio = (withdrawWithin5to15MinCount / totalBase) * 100;
  const withdrawWithin15to30MinRatio = (withdrawWithin15to30MinCount / totalBase) * 100;
  const withdrawOver30MinRatio = (withdrawOver30MinCount / totalBase) * 100;

  const withdrawSuccessRate = len > 0 ? (totalWithdrawCount / len) * 100 : 0;
  // 订单成功：使用充值的订单成功数据 (银行卡 + 支付宝，不含微信)
  const bankCardOrderSuccess = depositMetrics?.totalOrderSuccessCount || 0;
  const alipayOrderSuccess = depositMetrics?.alipayTotalOrderSuccessCount || 0;
  const withdrawOrderSuccessCount = bankCardOrderSuccess + alipayOrderSuccess;

  const bankCardOrderSuccessAmt = depositMetrics?.totalOrderSuccessAmount || 0;
  const alipayOrderSuccessAmt = depositMetrics?.alipayTotalOrderSuccessAmount || 0;
  const withdrawOrderSuccessAmount = bankCardOrderSuccessAmt + alipayOrderSuccessAmt;

  // 订单成功占比 = 订单成功(加总笔数) / 总充直成功(含掉单)筆數 × 100%
  const depositSuccessfulCount = depositMetrics?.successfulCount || 0;
  const withdrawOrderSuccessRate = depositSuccessfulCount > 0 ? Math.round((withdrawOrderSuccessCount / depositSuccessfulCount) * 10000) / 100 : 0;
  const avgProcessingTime = autoWithdrawTimeCount > 0 ? autoWithdrawTimeSum / autoWithdrawTimeCount : 0;

  // 调试：输出平均处理时间计算详情
  console.log('平均处理时间计算:', {
    autoWithdrawTimeSum: autoWithdrawTimeSum.toFixed(2),
    autoWithdrawTimeCount,
    avgProcessingTime: avgProcessingTime.toFixed(2) + '秒',
    avgProcessingTimeFormatted: `${Math.floor(avgProcessingTime / 60)}:${Math.floor(avgProcessingTime % 60).toString().padStart(2, '0')}`
  });

  // 从 depositMetrics 取得数据
  const jsWaitingNoMatch = depositMetrics?.jsWaitingNoMatch || 0;
  // 充直申请 = 银行卡申请 + 支付宝申请 (不含微信)
  const bankCardAppCount = depositMetrics?.jisuApplicationCount || 0;
  const alipayAppCount = depositMetrics?.alipayApplicationCount || 0;
  const depositApplicationCount = bankCardAppCount + alipayAppCount;
  // 无卡空单率 = JS充值等待最终无配对 / 充直申请 × 100% (四舍五入到小数点后2位)
  const withdrawEmptyOrderRate = depositApplicationCount > 0 ? Math.round((jsWaitingNoMatch / depositApplicationCount) * 10000) / 100 : 0;

  // 调试：输出 depositMetrics 相关数值
  console.log('提现时间区段 - depositMetrics:', {
    jsWaitingNoMatch,
    depositApplicationCount,
    withdrawEmptyOrderRate: withdrawEmptyOrderRate + '%',
    bankCardOrderSuccess,
    alipayOrderSuccess,
    withdrawOrderSuccessCount,
    withdrawOrderSuccessAmount,
    successfulCount: depositMetrics?.successfulCount || 0,
    withdrawOrderSuccessRate: withdrawOrderSuccessRate + '%'
  });

  // 平均时间
  const bankCardAvgTime = bankCardAvgTimeCount > 0 ? bankCardAvgTimeSum / bankCardAvgTimeCount : 0;
  const alipayAvgTime = alipayAvgTimeCount > 0 ? alipayAvgTimeSum / alipayAvgTimeCount : 0;
  const wechatAvgTime = wechatAvgTimeCount > 0 ? wechatAvgTimeSum / wechatAvgTimeCount : 0;

  // 配对率
  let bankCardMatchRate = 0;
  if (depositMetrics && depositMetrics.jisuApplicationCount > 0) {
    bankCardMatchRate = depositMetrics.totalMatchCount / depositMetrics.jisuApplicationCount;
  }
  let bankCardSuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.totalMatchCount > 0) {
    bankCardSuccessAfterMatchRate = depositMetrics.totalOrderSuccessCount / depositMetrics.totalMatchCount;
  }
  let alipayMatchRate = 0;
  if (depositMetrics && depositMetrics.alipayApplicationCount > 0) {
    alipayMatchRate = depositMetrics.alipayTotalMatchCount / depositMetrics.alipayApplicationCount;
  }
  let alipaySuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.alipayTotalMatchCount > 0) {
    alipaySuccessAfterMatchRate = depositMetrics.alipayTotalOrderSuccessCount / depositMetrics.alipayTotalMatchCount;
  }
  let wechatMatchRate = 0;
  if (depositMetrics && depositMetrics.wechatApplicationCount > 0) {
    wechatMatchRate = depositMetrics.wechatTotalMatchCount / depositMetrics.wechatApplicationCount;
  }
  let wechatSuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.wechatTotalMatchCount > 0) {
    wechatSuccessAfterMatchRate = depositMetrics.wechatTotalOrderSuccessCount / depositMetrics.wechatTotalMatchCount;
  }

  const elapsed = performance.now() - startTime;
  // 调试：输出 status 统计
  console.log('提现 status 字段统计:', JSON.stringify(statusCounts));
  console.log('提现成功笔数:', totalWithdrawCount, '失败笔数:', withdrawFailedCount, '总申请:', totalWithdrawCount + withdrawFailedCount);
  console.log(`calculateWithdrawMetrics 完成，耗时: ${elapsed.toFixed(2)}ms，处理 ${len} 条记录`);

  return {
    totalWithdrawCount,
    totalWithdrawAmount,
    avgProcessingTime,
    totalRecords: uniqueOrderCount,
    // 提現成功時間區段
    withdrawSuccessTotalCount,
    withdrawSuccessTotalAmount,
    withdrawWithin2MinCount,
    withdrawWithin2MinAmount,
    withdrawWithin2to5MinCount,
    withdrawWithin2to5MinAmount,
    withdrawWithin5to15MinCount,
    withdrawWithin5to15MinAmount,
    withdrawWithin15to30MinCount,
    withdrawWithin15to30MinAmount,
    withdrawOver30MinCount,
    withdrawOver30MinAmount,
    // 百分比
    withdrawWithin2MinRatio,
    withdrawWithin2to5MinRatio,
    withdrawWithin5to15MinRatio,
    withdrawWithin15to30MinRatio,
    withdrawOver30MinRatio,
    // 新增指標
    withdrawSuccessRate,
    withdrawFailedCount,
    withdrawEmptyOrderRate,
    withdrawOrderSuccessCount,
    withdrawOrderSuccessAmount,
    withdrawOrderSuccessRate,
    // 銀行卡
    bankCardWithdrawCount,
    bankCardWithdrawAmount,
    bankCardAvgTime,
    bankCardMatchRate,
    bankCardSuccessAfterMatchRate,
    bankCardDepositMatchCount: depositMetrics?.totalMatchCount || 0,
    bankCardDepositAppCount: depositMetrics?.jisuApplicationCount || 0,
    bankCardDepositSuccessCount: depositMetrics?.totalOrderSuccessCount || 0,
    // 支付寶
    alipayWithdrawCount,
    alipayWithdrawAmount,
    alipayAvgTime,
    alipayMatchRate,
    alipaySuccessAfterMatchRate,
    alipayDepositMatchCount: depositMetrics?.alipayTotalMatchCount || 0,
    alipayDepositAppCount: depositMetrics?.alipayApplicationCount || 0,
    alipayDepositSuccessCount: depositMetrics?.alipayTotalOrderSuccessCount || 0,
    // 微信
    wechatWithdrawCount,
    wechatWithdrawAmount,
    wechatAvgTime,
    wechatMatchRate,
    wechatSuccessAfterMatchRate,
    wechatDepositMatchCount: depositMetrics?.wechatTotalMatchCount || 0,
    wechatDepositAppCount: depositMetrics?.wechatApplicationCount || 0,
    wechatDepositSuccessCount: depositMetrics?.wechatTotalOrderSuccessCount || 0
  };
};

// 导出指标数据分析 Excel 范本
export const exportMetricsAnalysisTemplate = (weekRange = null) => {
  const wb = XLSX.utils.book_new();

  // ===== 工作表1: 充值原始数据 =====
  // 定义充值栏位标题 (与原始CSV一致)
  const depositHeaders = [
    'A-序号', 'B-商户名称', 'C-商户订单号', 'D-平台订单号', 'E-收款人姓名', 'F-收款银行',
    'G-收款卡号', 'H-申请日期', 'I-申请金额', 'J-银行卡流水号', 'K-银行回单码',
    'L-收款金额', 'M-收款金额', 'N-冻结金额', 'O-商户手续费', 'P-银行到账时间',
    'Q-请求日期', 'R-银行收款时间', 'S-银商确认到账时间', 'T-通知商户时间',
    'U-状态', 'V-userId', 'W-userIP', 'X-配对时间', 'Y-配对银行',
    'Z-配对卡号', 'AA-配对卡姓名', 'AB-配对到账金额', 'AC-配对ID', 'AD-配对商户订单号',
    'AE-配对平台订单号', 'AF-提现金额', 'AG-配对说明', 'AH-配对转账时间',
    'AI-极速提账号', 'AJ-卡剩余池建立时间', 'AK-备注', 'AL-信用评分',
    'AM-处理时间(秒)', 'AN-是否3分内', 'AO-是否自动到账', 'AP-收款金额'
  ];
  const depositData = [depositHeaders];
  // 添加说明行
  depositData.push(['请在此行下方贴上充值原始数据（不含标题行）', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);

  const ws1 = XLSX.utils.aoa_to_sheet(depositData);
  // 设置列宽
  ws1['!cols'] = depositHeaders.map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, ws1, '充值原始数据');

  // ===== 工作表2: 提现原始数据 =====
  const withdrawHeaders = [
    'A-序号', 'B-流水号', 'C-商户名称', 'D-商户订单号', 'E-平台订单号',
    'F-申请出款金额', 'G-商户返点', 'H-实际转出金额', 'I-实际转出金额',
    'J-收款银行', 'K-收款卡号', 'L-收款人', 'M-收款地址',
    'N-剩余池ID', 'O-状态', 'P-商户收款状态', 'Q-通知商户时间',
    'R-userId', 'S-userIP', 'T-建立时间', 'U-POOL建单时间',
    'V-剩余池建立时间', 'W-转账ID', 'X-转出账号', 'Y-转出银行',
    'Z-转出账户名', 'AA-手续费', 'AB-转账时间', 'AC-说明'
  ];
  const withdrawData = [withdrawHeaders];
  withdrawData.push(['请在此行下方贴上提现原始数据（不含标题行）', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);

  const ws2 = XLSX.utils.aoa_to_sheet(withdrawData);
  ws2['!cols'] = withdrawHeaders.map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, ws2, '提现原始数据');

  // ===== 工作表3: 过滤后充值数据 =====
  const filteredDepositHeaders = ['序号', '商户名称', '收款金额(M)', '处理时间(AM)', '是否3分内(AN)', '是否自动到账(AO)', '状态(U)'];
  const filteredDepositFormulas = [
    filteredDepositHeaders,
    ['（此表自动过滤 test/qa/线下 商户）', '', '', '', '', '', ''],
    // 使用 FILTER 函數過濾數據
    ['=IFERROR(FILTER(\'充值原始数据\'!A:A, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!B:B, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!M:M, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!AM:AM, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!AN:AN, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!AO:AO, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!U:U, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")']
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(filteredDepositFormulas);
  ws3['!cols'] = filteredDepositHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws3, '过滤后充值');

  // ===== 工作表4: 指标数据分析 =====
  const analysisData = [
    ['指标数据分析', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['分类', '充值成功率', '充值3分内占比', '充值平均时间', '提现成功率', '提现2分内占比', '提现平均时间'],
    ['', '', '', '', '', '', ''],
    ['【充值公式说明】', '', '', '', '', '', ''],
    ['成功率 = 1 - 补单笔数/总充值笔数', '', '', '', '', '', ''],
    ['3分内占比 = 3分内笔数/自动到账笔数', '', '', '', '', '', ''],
    ['平均时间 = AVERAGEIFS(处理时间, 收款金额, ">0")', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【提现公式说明】', '', '', '', '', '', ''],
    ['成功率 = 自动提现笔数/总提现申请笔数', '', '', '', '', '', ''],
    ['2分内占比 = 2分内笔数/自动提现笔数', '', '', '', '', '', ''],
    ['平均时间 = IF(V为空, Q-T, Q-V) 的平均值', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【分类筛选条件】', '', '', '', '', '', ''],
    ['整体: 所有记录（排除test/qa/线下）', '', '', '', '', '', ''],
    ['支付宝: 商户名称包含「支付宝」', '', '', '', '', '', ''],
    ['微信: 商户名称包含「微信」', '', '', '', '', '', ''],
    ['金宝: 转出账号以 GB 开头（不区分大小写）', '', '', '', '', '', ''],
    ['极速: 转出账号包含 auction 或 *****ion', '', '', '', '', '', ''],
    ['第三方: 排除以上所有分类', '', '', '', '', '', ''],
    ['非正向信评: 信用评分栏位包含「非正向」', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【注意事项】', '', '', '', '', '', ''],
    ['1. 贴上数据前请确保删除原始数据中的标题行', '', '', '', '', '', ''],
    ['2. 数据需要从系统导出的原始CSV复制', '', '', '', '', '', ''],
    ['3. 本范本会自动过滤 test/qa/线下 商户', '', '', '', '', '', '']
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(analysisData);
  ws4['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws4, '指标数据分析说明');

  // ===== 工作表5: 计算结果 =====
  const calcData = [
    ['指标数据分析 - 计算结果', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['分类', '充值成功率', '充值3分内占比', '充值平均时间(秒)', '提现成功率', '提现2分内占比', '提现平均时间(秒)'],
    ['整体',
     '=IFERROR(1-COUNTIFS(\'过滤后充值\'!G:G,"*补*",\'过滤后充值\'!C:C,">0")/COUNTIF(\'过滤后充值\'!C:C,">0"), 0)',
     '=IFERROR(COUNTIFS(\'过滤后充值\'!E:E,1,\'过滤后充值\'!C:C,">0")/COUNTIFS(\'过滤后充值\'!F:F,1,\'过滤后充值\'!C:C,">0"), 0)',
     '=IFERROR(AVERAGEIFS(\'过滤后充值\'!D:D,\'过滤后充值\'!C:C,">0",\'过滤后充值\'!D:D,">0"), 0)',
     '请贴上提现数据后手动计算',
     '请贴上提现数据后手动计算',
     '请贴上提现数据后手动计算'
    ],
    ['支付宝', '=IFERROR(1-COUNTIFS(\'过滤后充值\'!G:G,"*补*",\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*支付*")/COUNTIFS(\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*支付*"), 0)', '', '', '', '', ''],
    ['微信', '=IFERROR(1-COUNTIFS(\'过滤后充值\'!G:G,"*补*",\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*微信*")/COUNTIFS(\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*微信*"), 0)', '', '', '', '', ''],
    ['金宝', '--', '--', '--', '', '', ''],
    ['极速', '--', '--', '--', '', '', ''],
    ['第三方', '--', '--', '--', '', '', ''],
    ['非正向信评', '', '', '', '--', '--', '--']
  ];

  const ws5 = XLSX.utils.aoa_to_sheet(calcData);
  ws5['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws5, '计算结果');

  // 下載檔案
  let dateRange = '';
  if (weekRange && weekRange.start) {
    if (weekRange.start === weekRange.end) {
      dateRange = weekRange.start;
    } else {
      dateRange = `${weekRange.start}_${weekRange.end}`;
    }
  } else {
    const now = new Date();
    dateRange = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  XLSX.writeFile(wb, `指标数据分析_${dateRange}.xlsx`);
};
