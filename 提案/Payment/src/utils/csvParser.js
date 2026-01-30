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

      if (matches.length < 20) continue;
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
      requestTime: clean(matches[16]),  // Q栏：请求日期
      detailReceiveTime: clean(matches[17]),
      detailArriveTime: clean(matches[18]),
      notifyMerchantTime: clean(matches[19]),  // T栏：通知商户时间
      userId: matches[21] ? clean(matches[21]) : '',
      userIP: matches[22] ? clean(matches[22]) : '',
      userLevel: matches[23] ? clean(matches[23]) : '',
      receiptVerifyResultTime: matches[37] ? clean(matches[37]) : '',  // AL栏：回单验证结果时间
      anProcessingTime: matches[39] ? clean(matches[39]) : '',  // AN栏：处理时间（已计算好的值）
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
      continue;
    }

    records.push(record);
  }

  console.log(`CSV 解析完成：共 ${lines.length} 行，解析出 ${records.length} 笔有效记录`);
  return records;
};

export const calculateMetrics = (records, withdrawMetrics = null, dataDate = null) => {
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

  // 3. 人工审核:通过：状态包含「金额补单」且到账金额>0，处理时间<=11分钟
  const c2cManualAuditRecords = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && r.status.includes('金额补单') &&
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
  // Part 1: 金额补单, M>0, 处理时间 > 11分钟
  const c2cOver11MinBuDanCount = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && r.status.includes('金额补单') &&
    r.processingTime !== null &&
    r.processingTime > 660 // > 11分钟
  ).length;

  // Part 2: 支付宝商户, 状态含「商户确认」, M>0
  const c2cMerchantConfirmCount = records.filter(r => {
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    return hasAlipay &&
      r.receivedAmount > 0 &&
      r.status && r.status.includes('商户确认');
  }).length;

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

  // 3. 人工审核:通过：bankCardCode包含AUCTION，到账金额>0，状态包含「金额补单」，处理时间<=11分钟
  const alipayC2cManualAuditRecords = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && r.status.includes('金额补单') &&
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
  // Part 1: bankCardCode包含AUCTION, receivedAmount>0, status包含金额补单, processingTime>11分钟
  const alipayC2cOver11MinBuDanCount = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && r.status.includes('金额补单') &&
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

  // 微信 - 充值申请笔数
  const wechatNormalCardForApp = wechatRecords.filter(r =>
    r.bankCardCode && r.bankCardCode !== 'AUCTION_PAYMENT_CARD'
  );
  const wechatExpressCardForApp = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD'
  );
  const wechatApplicationCount = wechatNormalCardForApp.length + wechatExpressCardForApp.length;

  // 微信 - 成功配对
  const wechatNormalMatchCount = wechatNormalCardForApp.length;
  const wechatNormalMatchAmount = wechatNormalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatExpressMatchCount = wechatExpressCardForApp.length;
  const wechatExpressMatchAmount = wechatExpressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatTotalMatchCount = wechatNormalMatchCount + wechatExpressMatchCount;
  const wechatTotalMatchAmount = wechatNormalMatchAmount + wechatExpressMatchAmount;

  // 微信 - 订单成功
  const wechatNormalOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('审核中(已超时)')
  );
  const wechatNormalOrderSuccessCount = wechatNormalOrderSuccess.length;
  const wechatNormalOrderSuccessAmount = wechatNormalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  const wechatExpressOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    !r.status.includes('未充值') &&
    !r.status.includes('审核中(已超时)')
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

  // 微信 - 平均时间
  const wechatNoCreditDowngradeForAvgTime = wechatRecords.filter(r =>
    parseFloat(r.userLevel) !== 0 &&
    parseFloat(r.userLevel) !== -1 &&
    r.receivedAmount > 0 &&
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
    // 微信商户
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
  return Math.round(amount).toLocaleString('zh-CN');
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

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // 支援兩種 CSV 格式：
    // 1. Excel 格式: "=""value"""
    // 2. Google Sheets 格式: value 或 "value"
    let matches = line.match(/\"=\"\"([^\"]*)\"\"\"/g);
    let clean;

    if (matches && matches.length >= 20) {
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
      if (matches.length < 20) continue;
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
      requestTime: clean(matches[19]),
      poolCreateTime: matches[20] ? clean(matches[20]) : '',
      remainPoolCreateTime: matches[21] ? clean(matches[21]) : '',
      transferId: matches[22] ? clean(matches[22]) : '',
      payoutMerchant: matches[23] ? clean(matches[23]) : '',
      payoutCardCode: matches[24] ? clean(matches[24]) : '',
      payoutBank: matches[25] ? clean(matches[25]) : '',
      payoutAccount: matches[26] ? clean(matches[26]) : '',
      payoutAmount: matches[27] ? parseFloat(clean(matches[27]).replace(/,/g, '')) || 0 : 0,
      remark: matches[28] ? clean(matches[28]) : '', // AD 栏位 - 说明 (银行卡/支付宝/微信)
      transferStatus: matches[29] ? clean(matches[29]) : '' // AE 栏位 - 转账状态 (转账完成/转账失败)
    };

    // 计算 isAutoWithdraw (AD栏位公式)：IF(AC="转账完成" AND P="通知完成", 1, 0)
    record.isAutoWithdraw = (record.transferStatus === '转账完成' && record.merchantReceiveStatus === '通知完成') ? 1 : 0;

    // remark 已从 CSV AD 栏读取，若为空则从商户名称计算
    if (!record.remark) {
      const merchantName = record.merchant || '';
      if (merchantName.includes('支付宝') || merchantName.includes('支付寶')) {
        record.remark = '支付宝';
      } else if (merchantName.includes('微信')) {
        record.remark = '微信';
      } else {
        record.remark = '银行卡';
      }
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
    if (record.merchant.includes('线下') || record.merchant.includes('線下') ||
        merchantLower.includes('test') || merchantLower.includes('qa')) {
      continue;
    }

    records.push(record);
  }

  console.log(`提现 CSV 解析完成：共 ${lines.length} 行，解析出 ${records.length} 笔有效记录`);
  return records;
};

// ===== 匯出功能 =====
import * as XLSX from 'xlsx';

// 汇出充值数据到 Excel
export const exportDepositToExcel = (metrics, filteredRecords) => {
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
    ['無效申請', metrics.minuteInvalidCount || 0, `${(metrics.minuteInvalidRatio || 0).toFixed(2)}%`],
    ['掉單', metrics.minuteDropCount || 0, `${(metrics.minuteDropRatio || 0).toFixed(2)}%`],
    ['平均时间', formatTime(metrics.minuteAvgTime), ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, ws1, '總覽');

  // 银行卡金额区间（与页面一致）
  const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];
  const noCreditByAmount = metrics.noCreditDowngradeByAmount || {};

  // 工作表2: 銀行卡渠道
  const bankCardChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.jisuApplicationCount || 0, ''],
    ['  一般卡', metrics.normalCardAppCount || 0, ''],
    ['  極速提', metrics.expressCardAppCount || 0, ''],
    ['', '', ''],
    ['成功配对', metrics.totalMatchCount || 0, `${formatAmount(metrics.totalMatchAmount || 0)} 元`],
    ['  一般卡', metrics.normalMatchCount || 0, `${formatAmount(metrics.normalMatchAmount || 0)} 元`],
    ['  極速提', metrics.expressMatchCount || 0, `${formatAmount(metrics.expressMatchAmount || 0)} 元`],
    ['', '', ''],
    ['訂單成功', metrics.totalOrderSuccessCount || 0, `${formatAmount(metrics.totalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.normalOrderSuccessCount || 0, `${formatAmount(metrics.normalOrderSuccessAmount || 0)} 元`],
    ['  極速提', metrics.expressOrderSuccessCount || 0, `${formatAmount(metrics.expressOrderSuccessAmount || 0)} 元`],
    ['  信評上分', metrics.creditScoreSuccessCount || 0, `${formatAmount(metrics.creditScoreSuccessAmount || 0)} 元`],
    ['', '', ''],
    ['没信评降等配卡', metrics.noCreditDowngradeTotal || 0, formatTime(metrics.noCreditDowngradeAvgTime)],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, noCreditByAmount[amt] || 0, '']),
    [`  其他`, noCreditByAmount['other'] || 0, ''],
    ['', '', ''],
    ['c2c', metrics.c2cCount || 0, `${formatAmount(metrics.c2cAmount || 0)} 元`],
    ['  点确认', metrics.c2cConfirmCount || 0, formatTime(metrics.c2cConfirmAvgTime)],
    ['  人工審核:通過', metrics.c2cManualAuditCount || 0, formatTime(metrics.c2cAuditSuccessAvgTime)],
    ['  超过11min补件后成功', metrics.c2cOver11MinSuccessCount || 0, ''],
    ['', '', ''],
    ['三方代收', metrics.thirdPartyCount || 0, `${formatAmount(metrics.thirdPartyAmount || 0)} 元`],
    ['  汇通', metrics.thirdPartyHuitongCount || 0, `${formatAmount(metrics.thirdPartyHuitongAmount || 0)} 元`],
    ['  豆豆', metrics.thirdPartyDoudouCount || 0, `${formatAmount(metrics.thirdPartyDoudouAmount || 0)} 元`],
    ['  UC聚合', metrics.thirdPartyUCCount || 0, `${formatAmount(metrics.thirdPartyUCAmount || 0)} 元`],
    ['  其他', metrics.thirdPartyOtherCount || 0, `${formatAmount(metrics.thirdPartyOtherAmount || 0)} 元`],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(bankCardChannel);
  XLSX.utils.book_append_sheet(wb, ws2, '銀行卡渠道');

  // 支付宝金额区间（与页面一致）
  const alipayNoCreditByAmount = metrics.alipayNoCreditDowngradeByAmount || {};

  // 工作表3: 支付寶渠道
  const alipayChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.alipayApplicationCount || 0, ''],
    ['  一般卡', metrics.alipayNormalCardAppCount || 0, ''],
    ['  一般寶', metrics.alipayExpressCardAppCount || 0, ''],
    ['  極速提(卡)', metrics.alipayJisuTikaCount || 0, ''],
    ['  極速提(寶)', metrics.alipayJisuTibaoCount || 0, ''],
    ['', '', ''],
    ['成功配对', metrics.alipayTotalMatchCount || 0, `${formatAmount(metrics.alipayTotalMatchAmount || 0)} 元`],
    ['', '', ''],
    ['訂單成功', metrics.alipayTotalOrderSuccessCount || 0, `${formatAmount(metrics.alipayTotalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.alipayNormalOrderSuccessCount || 0, `${formatAmount(metrics.alipayNormalOrderSuccessAmount || 0)} 元`],
    ['  一般寶', metrics.alipayBaoOrderSuccessCount || 0, `${formatAmount(metrics.alipayBaoOrderSuccessAmount || 0)} 元`],
    ['  極速提(卡)', metrics.alipayJisuTikaOrderSuccessCount || 0, `${formatAmount(metrics.alipayJisuTikaOrderSuccessAmount || 0)} 元`],
    ['  極速提(寶)', metrics.alipayJisuTibaoOrderSuccessCount || 0, `${formatAmount(metrics.alipayJisuTibaoOrderSuccessAmount || 0)} 元`],
    ['  信評上分', metrics.alipayCreditScoreSuccessCount || 0, `${formatAmount(metrics.alipayCreditScoreSuccessAmount || 0)} 元`],
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
  XLSX.utils.book_append_sheet(wb, ws3, '支付寶渠道');

  // 微信金额区间（与页面一致）
  const wechatNoCreditByAmount = metrics.wechatNoCreditDowngradeByAmount || {};

  // 工作表4: 微信渠道
  const wechatChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.wechatApplicationCount || 0, ''],
    ['  一般卡', metrics.wechatNormalCardAppCount || 0, ''],
    ['  極速', metrics.wechatExpressCardAppCount || 0, ''],
    ['', '', ''],
    ['成功配对', metrics.wechatTotalMatchCount || 0, `${formatAmount(metrics.wechatTotalMatchAmount || 0)} 元`],
    ['', '', ''],
    ['訂單成功', metrics.wechatTotalOrderSuccessCount || 0, `${formatAmount(metrics.wechatTotalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.wechatNormalOrderSuccessCount || 0, `${formatAmount(metrics.wechatNormalOrderSuccessAmount || 0)} 元`],
    ['  極速', metrics.wechatExpressOrderSuccessCount || 0, `${formatAmount(metrics.wechatExpressOrderSuccessAmount || 0)} 元`],
    ['  信評上分', metrics.wechatCreditScoreSuccessCount || 0, `${formatAmount(metrics.wechatCreditScoreSuccessAmount || 0)} 元`],
    ['', '', ''],
    ['没信评降等配卡', metrics.wechatNoCreditDowngradeTotal || 0, formatTime(metrics.wechatNoCreditDowngradeAvgTime)],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, wechatNoCreditByAmount[amt] || 0, '']),
    [`  其他`, wechatNoCreditByAmount['other'] || 0, ''],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(wechatChannel);
  XLSX.utils.book_append_sheet(wb, ws4, '微信渠道');

  // 下載檔案
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `充值报表_${dateStr}.xlsx`);
};

// 汇出提现数据到 Excel
export const exportWithdrawToExcel = (metrics) => {
  const wb = XLSX.utils.book_new();

  // 工作表1: 提现总览
  const overview = [
    ['項目', '數值'],
    ['总提现笔数', metrics.totalWithdrawCount || 0],
    ['总提现金额', `${formatAmount(metrics.totalWithdrawAmount || 0)} 元`],
    ['平均处理时间', formatTime(metrics.avgProcessingTime)],
    ['总记录数', metrics.totalRecords || 0],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(overview);
  XLSX.utils.book_append_sheet(wb, ws1, '提现总览');

  // 工作表2: 銀行卡渠道
  const bankCardWithdraw = [
    ['項目', '數值'],
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
    ['項目', '數值'],
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
    ['項目', '數值'],
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
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `提现报表_${dateStr}.xlsx`);
};

// 汇出周报数据到 Excel
export const exportWeeklyToExcel = (weeklyMetrics, analysisMetrics, weekRange) => {
  const wb = XLSX.utils.book_new();
  const m = weeklyMetrics || {};

  // 安全数值处理，避免 #DIV/0!
  const safeNum = (val) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '';
    return val;
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
    safeNum(m.emptyOrderRate || 0),
    safeNum(m.orderSuccessAmountTotal || 0),
    safeNum(m.orderSuccessAmountNormalCard || 0),
    safeNum(m.orderSuccessAmountJS || 0),
    safeNum(m.orderSuccessAmountTotal || ''),
    safeNum(m.withdrawAvgTimeBankCard || 0),
    safeNum(m.withdrawAvgTimeAlipay || 0),
    safeNum(m.fraudAmount || 0),
    safeNum(m.fraudCostRatio || 0),
    safeNum(m.jsWithdrawRebate || 0)
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([summaryHeaders, summaryData]);
  XLSX.utils.book_append_sheet(wb, ws1, '汇总周报数据');

  // 工作表2: 总计 银行卡
  const bankCardData = [
    ['JS数据_', month, ' /', date],
    ['充值申请', safeNum(m.bankCardAppCount || 0), '笔(', safeNum(m.normalCardAppCount || 0), '一般卡/', safeNum(m.expressCardAppCount || 0), '极速提/', safeNum(m.waitingForMatchCount || 0), '建单成功等待无配对/', safeNum(m.noCard06Count || 0), '取无卡06提示)'],
    ['成功配对', safeNum(m.totalMatchCount || 0), '笔/', safeNum(m.totalMatchAmount || 0), '元'],
    ['- 一般卡', safeNum(m.normalMatchCount || 0), '笔/', safeNum(m.normalMatchAmount || 0), '元'],
    ['- 極速提', safeNum(m.expressMatchCount || 0), '笔/', safeNum(m.expressMatchAmount || 0), '元'],
    ['订單成功', safeNum(m.totalOrderSuccessCount || 0), '笔/', safeNum(m.totalOrderSuccessAmount || 0), '元'],
    ['- 一般卡', safeNum(m.normalOrderSuccessCount || 0), '笔/', safeNum(m.normalOrderSuccessAmount || 0), '元', '(汇通', safeNum(m.thirdPartyHuitongAmount || 0), '元', safeNum(m.thirdPartyHuitongCount || 0), '笔/', '豆豆', safeNum(m.thirdPartyDoudouAmount || 0), '元', safeNum(m.thirdPartyDoudouCount || 0), '笔/', 'UC聚合', safeNum(m.thirdPartyUCAmount || 0), '元', safeNum(m.thirdPartyUCCount || 0), '笔)'],
    ['- 極速提', safeNum(m.expressOrderSuccessCount || 0), '笔/', safeNum(m.expressOrderSuccessAmount || 0), '元'],
    ['(信評上分', safeNum(m.creditScoreSuccessCount || 0), '笔', safeNum(m.creditScoreSuccessRate || ''), '', '', '', '', '', '', '/其中信评不含图文复核', safeNum(m.creditScoreNoImageCount || 0), '笔', safeNum(m.creditScoreNoImageRate || ''), ')'],
    [],
    ['#.没信评降等配卡-100/', safeNum(m.noCreditDowngrade100 || 0), '笔 200/', safeNum(m.noCreditDowngrade200 || 0), '笔 300/', safeNum(m.noCreditDowngrade300 || 0), '笔 500/', safeNum(m.noCreditDowngrade500 || 0), '笔 1000/', safeNum(m.noCreditDowngrade1000 || 0), '笔 1500/', safeNum(m.noCreditDowngrade1500 || 0), '笔 2000/', safeNum(m.noCreditDowngrade2000 || 0), '笔 3000/', safeNum(m.noCreditDowngrade3000 || 0), '笔 5000/', safeNum(m.noCreditDowngrade5000 || 0), '笔 6000/'],
    ['', safeNum(m.noCreditDowngrade6000 || 0), '笔 7000/', safeNum(m.noCreditDowngrade7000 || 0), '笔 8000/', safeNum(m.noCreditDowngrade8000 || 0), '笔 9000/', safeNum(m.noCreditDowngrade9000 || 0), '笔 10000/', safeNum(m.noCreditDowngrade10000 || 0), '笔 15000/', safeNum(m.noCreditDowngrade15000 || 0), '笔 20000/', safeNum(m.noCreditDowngrade20000 || 0), '笔 30000/', safeNum(m.noCreditDowngrade30000 || 0), '笔=', safeNum(m.noCreditDowngradeTotal || 0)],
    ['^空单_'],
    ['平均时间：', safeNum(m.noCreditDowngradeAvgTime || '')],
    [],
    ['提现申请', safeNum(m.withdrawAppCount || 0), '笔(極速)/', safeNum(m.withdrawAppAmount || 0), '元'],
    ['充值配对率', safeNum(m.depositMatchRateDisplay || ''), '(成功配对', safeNum(m.totalMatchCount || 0), '笔/充值申请', safeNum(m.bankCardAppCount || 0), '笔)'],
    ['配对後成功率', safeNum(m.successAfterMatchRate || ''), '(充值成功', safeNum(m.totalOrderSuccessCount || 0), '笔/成功配对', safeNum(m.totalMatchCount || 0), '笔)'],
    ['平均时间：', safeNum(m.withdrawAvgTimeBankCard || '')],
    [],
    ['c2c ', safeNum(m.c2cCount || 0), '笔点确认平均', safeNum(m.c2cConfirmAvgTime || ''), '分多、人工审核:通过', safeNum(m.manualReviewPassCount || 0), '笔审核-成功平均', safeNum(m.manualReviewSuccessAvgTime || ''), '分多、', safeNum(m.userLateSubmitSuccessCount || 0), '笔用户较久补材料后成功', '、骗分拉黑', safeNum(m.fraudBlacklistCount || 0), '+卡验及人验', safeNum(m.cardVerifyCount || 0), '笔'],
    [],
    ['骗分没到账来找'],
    ['人工  ', safeNum(m.fraudBankCardManual || ''), '元/', safeNum(m.fraudBankCardManualCount || ''), '笔'],
    ['信评 ', safeNum(m.fraudBankCardCredit || 0), '元/', safeNum(m.fraudBankCardCreditCount || 0), '笔'],
    ['没上传回单重复出款充值上分', safeNum(m.noReceiptDuplicateCount || 0), '笔']
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(bankCardData);
  XLSX.utils.book_append_sheet(wb, ws2, '总计 银行卡');

  // 工作表3: 总计 支付宝
  const alipayData = [
    ['JS数据_', month, ' /', date, '【支付宝】'],
    ['充值申请', safeNum(m.alipayApplicationCount || 0), '笔(', safeNum(m.alipayNormalCardAppCount || 0), '一般卡/', safeNum(m.alipayExpressCardAppCount || 0), '一般宝/', safeNum(m.alipayJisuTikaCount || 0), '极速提卡/', safeNum(m.alipayJisuTibaoCount || 0), '极速提宝/', safeNum(m.alipayWaitingForMatchCount || 0), '建单成功等待无配对/', safeNum(m.alipayNoCard06Count || 0), '取无卡06提示)'],
    ['成功配对', safeNum(m.alipayTotalMatchCount || 0), '笔/', safeNum(m.alipayTotalMatchAmount || 0), '元'],
    ['- 一般卡', safeNum(m.alipayNormalMatchCount || 0), '笔/', safeNum(m.alipayNormalMatchAmount || 0), '元'],
    ['-一般宝', safeNum(m.alipayExpressCardAppCount || 0), '笔/', safeNum(m.alipayExpressBaoMatchAmount || 0), '元'],
    ['-極速提(卡)', safeNum(m.alipayJisuTikaCount || 0), '笔/', safeNum(m.alipayJisuTikaMatchAmount || 0), '元'],
    ['-极速提(宝)', safeNum(m.alipayJisuTibaoCount || 0), '笔/', safeNum(m.alipayJisuTibaoMatchAmount || 0), '元'],
    ['订單成功', safeNum(m.alipayTotalOrderSuccessCount || 0), '笔/', safeNum(m.alipayTotalOrderSuccessAmount || 0), '元'],
    ['- 一般卡', safeNum(m.alipayNormalOrderSuccessCount || 0), '笔/', safeNum(m.alipayNormalOrderSuccessAmount || 0), '元(', safeNum(m.alipayNormalOrderSuccessRate || ''), ')', '(汇通', safeNum(m.alipayThirdPartyHuitongAmount || 0), '元', safeNum(m.alipayThirdPartyHuitongCount || 0), '笔/', '豆豆', safeNum(m.alipayThirdPartyDoudouAmount || 0), '元', safeNum(m.alipayThirdPartyDoudouCount || 0), '笔/', 'UC聚合', safeNum(m.alipayThirdPartyUCAmount || 0), '元', safeNum(m.alipayThirdPartyUCCount || 0), '笔)'],
    ['-一般宝', safeNum(m.alipayBaoOrderSuccessCount || 0), '笔/', safeNum(m.alipayBaoOrderSuccessAmount || 0), '元(', safeNum(m.alipayBaoOrderSuccessRate || ''), ')'],
    ['-極速提(卡)', safeNum(m.alipayJisuTikaOrderSuccessCount || 0), '笔/', safeNum(m.alipayJisuTikaOrderSuccessAmount || 0), '元(', safeNum(m.alipayJisuTikaOrderSuccessRate || ''), ')'],
    ['-极速提(宝)', safeNum(m.alipayJisuTibaoOrderSuccessCount || 0), '笔/', safeNum(m.alipayJisuTibaoOrderSuccessAmount || 0), '元 (', safeNum(m.alipayJisuTibaoOrderSuccessRate || ''), ')'],
    ['(信評上分', safeNum(m.alipayCreditScoreSuccessCount || 0), '笔', safeNum(m.alipayCreditScoreSuccessRate || ''), '元 ', '', '/其中信评不含图文复核', safeNum(m.alipayCreditScoreNoImageCount || 0), '笔', safeNum(m.alipayCreditScoreNoImageRate || ''), ')'],
    ['#.没信评降等配卡-100/', safeNum(m.alipayNoCreditDowngrade100 || 0), '笔 200/', safeNum(m.alipayNoCreditDowngrade200 || 0), '笔 300/', safeNum(m.alipayNoCreditDowngrade300 || 0), '笔 500/', safeNum(m.alipayNoCreditDowngrade500 || 0), '笔 1000/', safeNum(m.alipayNoCreditDowngrade1000 || 0), '笔 1500/', safeNum(m.alipayNoCreditDowngrade1500 || 0), '笔 2000/', safeNum(m.alipayNoCreditDowngrade2000 || 0), '笔 3000/', safeNum(m.alipayNoCreditDowngrade3000 || 0), '笔 5000/', safeNum(m.alipayNoCreditDowngrade5000 || 0), '笔 6000/'],
    ['', safeNum(m.alipayNoCreditDowngrade6000 || 0), '笔 7000/', safeNum(m.alipayNoCreditDowngrade7000 || 0), '笔 8000/', safeNum(m.alipayNoCreditDowngrade8000 || 0), '笔 9000/', safeNum(m.alipayNoCreditDowngrade9000 || 0), '笔 10000/', safeNum(m.alipayNoCreditDowngrade10000 || 0), '笔 15000/', safeNum(m.alipayNoCreditDowngrade15000 || 0), '笔 20000/', safeNum(m.alipayNoCreditDowngrade20000 || 0), '笔 30000/', safeNum(m.alipayNoCreditDowngrade30000 || 0), '笔=', safeNum(m.alipayNoCreditDowngradeTotal || 0)],
    ['平均时间：', safeNum(m.alipayNoCreditDowngradeAvgTime || '')],
    [],
    ['提现申请', safeNum(m.alipayWithdrawAppCount || 0), '笔(極速)/', safeNum(m.alipayWithdrawAppAmount || 0), '元'],
    ['充值配对率', safeNum(m.alipayDepositMatchRate || ''), ' (成功配对', safeNum(m.alipayTotalMatchCount || 0), '笔/充值申请', safeNum(m.alipayApplicationCount || 0), '笔)'],
    ['配对后成功率', safeNum(m.alipaySuccessAfterMatchRate || ''), ' (充值成功', safeNum(m.alipayTotalOrderSuccessCount || 0), '笔/成功配对', safeNum(m.alipayTotalMatchCount || 0), '笔)'],
    ['平均时间', safeNum(m.withdrawAvgTimeAlipay || '')],
    [],
    ['c2c ', safeNum(m.alipayC2cCount || 0), '筆点确认平均', safeNum(m.alipayC2cConfirmAvgTime || ''), '分多、人工审核:通过', safeNum(m.alipayManualReviewPassCount || 0), '笔审核-成功平均', safeNum(m.alipayManualReviewSuccessAvgTime || ''), '分多、', safeNum(m.alipayUserLateSubmitSuccessCount || 0), '笔用户较久补材料后成功', '、骗分拉黑', safeNum(m.alipayFraudBlacklistCount || 0), '+卡验及人验', safeNum(m.alipayCardVerifyCount || 0), '笔'],
    [],
    ['骗分没到账来找'],
    ['人工  ', safeNum(m.fraudAlipayManual || ''), '元/', safeNum(m.fraudAlipayManualCount || ''), '笔'],
    ['信评 ', safeNum(m.fraudAlipayCredit || 0), '元/', safeNum(m.fraudAlipayCreditCount || 0), '笔'],
    ['没上传回单重复出款充值上分', safeNum(m.alipayNoReceiptDuplicateCount || 0), '笔'],
    ['微信 充成功', safeNum(m.wechatSuccessAmount || 0), '元/', safeNum(m.wechatSuccessCount || 0), '笔', safeNum(m.wechatSuccessRate || ''), ',提现', safeNum(m.wechatWithdrawAmount || 0), '元'],
    [],
    ['宝转卡渠道，配支付宝提现 申请', safeNum(m.baoToKaAppAmount || 0), '元/', safeNum(m.baoToKaAppCount || 0), '笔', ',成功', safeNum(m.baoToKaSuccessAmount || 0), '元/', safeNum(m.baoToKaSuccessCount || 0), '笔'],
    ['宝转宝渠道，配银行卡提现 申请', safeNum(m.baoToBaoAppAmount || 0), '元/', safeNum(m.baoToBaoAppCount || 0), '笔', ',成功', safeNum(m.baoToBaoSuccessAmount || 0), '元/', safeNum(m.baoToBaoSuccessCount || 0), '笔'],
    ['整体 配对成功$/提现申请$', safeNum(m.overallMatchSuccessRate || '')]
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(alipayData);
  XLSX.utils.book_append_sheet(wb, ws3, '总计 支付宝');

  // 下載檔案
  const dateRange = weekRange ? `${weekRange.start}_${weekRange.end}` : '';
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `周报_${dateRange || dateStr}.xlsx`);
};

// 汇出充值数据为纯文字
export const exportDepositToText = (metrics, weekRange) => {
  const m = metrics || {};

  // 安全數值處理
  const safeNum = (val, defaultVal = 0) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return defaultVal;
    return val;
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
    return Math.round(val * 100) + '%';
  };

  // 解析日期
  let month = '';
  let day = '';
  if (weekRange && weekRange.start) {
    const startDate = new Date(weekRange.start);
    month = startDate.getMonth() + 1;
    day = startDate.getDate();
  }

  // 银行卡区块
  const bankCardText = `JS数据_${month}/${day}
充值申请${safeNum(m.bankCardAppCount)}笔(${safeNum(m.normalCardAppCount)}一般卡/${safeNum(m.expressCardAppCount)}极速提/${safeNum(m.waitingForMatchCount)}建单成功等待无配对/${safeNum(m.noCard06Count)}取无卡06提示)
成功配对${safeNum(m.totalMatchCount)}笔/${safeNum(m.totalMatchAmount)}元
-一般卡${safeNum(m.normalMatchCount)}笔/${safeNum(m.normalMatchAmount)}元
-極速提${safeNum(m.expressMatchCount)}笔/${safeNum(m.expressMatchAmount)}元
订单成功${safeNum(m.totalOrderSuccessCount)}笔/${safeNum(m.totalOrderSuccessAmount)}元
-一般卡${safeNum(m.normalOrderSuccessCount)}笔/${safeNum(m.normalOrderSuccessAmount)}元(汇通${safeNum(m.thirdPartyHuitongAmount)}元${safeNum(m.thirdPartyHuitongCount)}笔/豆豆${safeNum(m.thirdPartyDoudouAmount)}元${safeNum(m.thirdPartyDoudouCount)}笔/UC聚合${safeNum(m.thirdPartyUCAmount)}元${safeNum(m.thirdPartyUCCount)}笔)
-極速提${safeNum(m.expressOrderSuccessCount)}笔/${safeNum(m.expressOrderSuccessAmount)}元
(信評上分${safeNum(m.creditScoreSuccessCount)}笔${formatTimeText(m.creditScoreSuccessAvgTime)}/其中信评不含图文复核${safeNum(m.creditScoreNoImageCount)}笔${formatTimeText(m.creditScoreNoImageAvgTime)})

#.没信评降等配卡-100/${safeNum(m.noCreditDowngrade100)}笔200/${safeNum(m.noCreditDowngrade200)}笔300/${safeNum(m.noCreditDowngrade300)}笔500/${safeNum(m.noCreditDowngrade500)}笔1000/${safeNum(m.noCreditDowngrade1000)}笔1500/${safeNum(m.noCreditDowngrade1500)}笔2000/${safeNum(m.noCreditDowngrade2000)}笔3000/${safeNum(m.noCreditDowngrade3000)}笔5000/${safeNum(m.noCreditDowngrade5000)}笔6000/${safeNum(m.noCreditDowngrade6000)}笔7000/${safeNum(m.noCreditDowngrade7000)}笔8000/${safeNum(m.noCreditDowngrade8000)}笔9000/${safeNum(m.noCreditDowngrade9000)}笔10000/${safeNum(m.noCreditDowngrade10000)}笔15000/${safeNum(m.noCreditDowngrade15000)}笔20000/${safeNum(m.noCreditDowngrade20000)}笔30000/${safeNum(m.noCreditDowngrade30000)}笔=${safeNum(m.noCreditDowngradeTotal)}
^空单_
平均时间${formatTimeText(m.noCreditDowngradeAvgTime)}

提现申请${safeNum(m.withdrawAppCount)}笔(極速)/${safeNum(m.withdrawAppAmount)}元
充值配对率${formatPercent(m.depositMatchRate)}(成功配对${safeNum(m.totalMatchCount)}笔/充值申请${safeNum(m.bankCardAppCount)}笔)
配对後成功率${formatPercent(m.successAfterMatchRate)}(充值成功${safeNum(m.totalOrderSuccessCount)}笔/成功配对${safeNum(m.totalMatchCount)}笔)
平均时间${formatTimeText(m.withdrawAvgTimeBankCard)}

c2c${safeNum(m.c2cCount)}笔点确认平均${safeNum(m.c2cConfirmAvgMinutes)}分多、人工审核:通过${safeNum(m.manualReviewPassCount)}笔审核-成功平均${safeNum(m.manualReviewSuccessAvgMinutes)}分多、${safeNum(m.userLateSubmitSuccessCount)}笔用户较久补材料后成功、骗分拉黑${safeNum(m.fraudBlacklistCount)}+卡验及人验${safeNum(m.cardVerifyCount)}笔

骗分没到账来找
人工${safeNum(m.fraudBankCardManual, '')}元/${safeNum(m.fraudBankCardManualCount, '')}笔
信评${safeNum(m.fraudBankCardCredit)}元/${safeNum(m.fraudBankCardCreditCount)}笔
没上传回单重复出款充值上分${safeNum(m.noReceiptDuplicateCount)}笔`;

  // 支付宝区块
  const alipayText = `JS数据_${month}/${day}【支付宝】
充值申请${safeNum(m.alipayApplicationCount)}笔(${safeNum(m.alipayNormalCardAppCount)}一般卡/${safeNum(m.alipayExpressCardAppCount)}一般宝/${safeNum(m.alipayJisuTikaCount)}极速提卡/${safeNum(m.alipayJisuTibaoCount)}极速提宝/${safeNum(m.alipayWaitingForMatchCount)}建单成功等待无配对/${safeNum(m.alipayNoCard06Count)}取无卡06提示)
成功配对${safeNum(m.alipayTotalMatchCount)}笔/${safeNum(m.alipayTotalMatchAmount)}元
-一般卡${safeNum(m.alipayNormalMatchCount)}笔/${safeNum(m.alipayNormalMatchAmount)}元
-一般宝${safeNum(m.alipayExpressCardAppCount)}笔/${safeNum(m.alipayExpressBaoMatchAmount)}元
-極速提(卡)${safeNum(m.alipayJisuTikaCount)}笔/${safeNum(m.alipayJisuTikaMatchAmount)}元
-极速提(宝)${safeNum(m.alipayJisuTibaoCount)}笔/${safeNum(m.alipayJisuTibaoMatchAmount)}元
订单成功${safeNum(m.alipayTotalOrderSuccessCount)}笔/${safeNum(m.alipayTotalOrderSuccessAmount)}元
-一般卡${safeNum(m.alipayNormalOrderSuccessCount)}笔/${safeNum(m.alipayNormalOrderSuccessAmount)}元(${formatPercent(m.alipayNormalOrderSuccessRate)})(汇通${safeNum(m.alipayThirdPartyHuitongAmount)}元${safeNum(m.alipayThirdPartyHuitongCount)}笔/豆豆${safeNum(m.alipayThirdPartyDoudouAmount)}元${safeNum(m.alipayThirdPartyDoudouCount)}笔/UC聚合${safeNum(m.alipayThirdPartyUCAmount)}元${safeNum(m.alipayThirdPartyUCCount)}笔)
-一般宝${safeNum(m.alipayBaoOrderSuccessCount)}笔/${safeNum(m.alipayBaoOrderSuccessAmount)}元(${formatPercent(m.alipayBaoOrderSuccessRate)})
-極速提(卡)${safeNum(m.alipayJisuTikaOrderSuccessCount)}笔/${safeNum(m.alipayJisuTikaOrderSuccessAmount)}元(${formatPercent(m.alipayJisuTikaOrderSuccessRate)})
-极速提(宝)${safeNum(m.alipayJisuTibaoOrderSuccessCount)}笔/${safeNum(m.alipayJisuTibaoOrderSuccessAmount)}元(${formatPercent(m.alipayJisuTibaoOrderSuccessRate)})
(信評上分${safeNum(m.alipayCreditScoreSuccessCount)}笔${formatTimeText(m.alipayCreditScoreSuccessAvgTime)}/其中信评不含图文复核${safeNum(m.alipayCreditScoreNoImageCount)}笔${formatTimeText(m.alipayCreditScoreNoImageAvgTime)})

#.没信评降等配卡-100/${safeNum(m.alipayNoCreditDowngrade100)}笔200/${safeNum(m.alipayNoCreditDowngrade200)}笔300/${safeNum(m.alipayNoCreditDowngrade300)}笔500/${safeNum(m.alipayNoCreditDowngrade500)}笔1000/${safeNum(m.alipayNoCreditDowngrade1000)}笔1500/${safeNum(m.alipayNoCreditDowngrade1500)}笔2000/${safeNum(m.alipayNoCreditDowngrade2000)}笔3000/${safeNum(m.alipayNoCreditDowngrade3000)}笔5000/${safeNum(m.alipayNoCreditDowngrade5000)}笔6000/${safeNum(m.alipayNoCreditDowngrade6000)}笔7000/${safeNum(m.alipayNoCreditDowngrade7000)}笔8000/${safeNum(m.alipayNoCreditDowngrade8000)}笔9000/${safeNum(m.alipayNoCreditDowngrade9000)}笔10000/${safeNum(m.alipayNoCreditDowngrade10000)}笔15000/${safeNum(m.alipayNoCreditDowngrade15000)}笔20000/${safeNum(m.alipayNoCreditDowngrade20000)}笔30000/${safeNum(m.alipayNoCreditDowngrade30000)}笔=${safeNum(m.alipayNoCreditDowngradeTotal)}
平均时间${formatTimeText(m.alipayNoCreditDowngradeAvgTime)}

提现申请${safeNum(m.alipayWithdrawAppCount)}笔(極速)/${safeNum(m.alipayWithdrawAppAmount)}元
充值配对率${formatPercent(m.alipayDepositMatchRate)}(成功配对${safeNum(m.alipayTotalMatchCount)}笔/充值申请${safeNum(m.alipayApplicationCount)}笔)
配对后成功率${formatPercent(m.alipaySuccessAfterMatchRate)}(充值成功${safeNum(m.alipayTotalOrderSuccessCount)}笔/成功配对${safeNum(m.alipayTotalMatchCount)}笔)
平均时间${formatTimeText(m.withdrawAvgTimeAlipay)}

c2c${safeNum(m.alipayC2cCount)}筆点确认平均${safeNum(m.alipayC2cConfirmAvgMinutes)}分多、人工审核:通过${safeNum(m.alipayManualReviewPassCount)}笔审核-成功平均${safeNum(m.alipayManualReviewSuccessAvgMinutes)}分多、${safeNum(m.alipayUserLateSubmitSuccessCount)}笔用户较久补材料后成功、骗分拉黑${safeNum(m.alipayFraudBlacklistCount)}+卡验及人验${safeNum(m.alipayCardVerifyCount)}笔

骗分没到账来找
人工${safeNum(m.fraudAlipayManual, '')}元/${safeNum(m.fraudAlipayManualCount, '')}笔
信评${safeNum(m.fraudAlipayCredit)}元/${safeNum(m.fraudAlipayCreditCount)}笔
没上传回单重复出款充值上分${safeNum(m.alipayNoReceiptDuplicateCount)}笔
微信充成功${safeNum(m.wechatSuccessAmount)}元/${safeNum(m.wechatSuccessCount)}笔${formatTimeText(m.wechatSuccessAvgTime)},提现${safeNum(m.wechatWithdrawAmount)}元
宝转卡渠道，配支付宝提现申请${safeNum(m.baoToKaAppAmount)}元/${safeNum(m.baoToKaAppCount)}笔,成功${safeNum(m.baoToKaSuccessAmount)}元/${safeNum(m.baoToKaSuccessCount)}笔
宝转宝渠道，配银行卡提现申请${safeNum(m.baoToBaoAppAmount)}元/${safeNum(m.baoToBaoAppCount)}笔,成功${safeNum(m.baoToBaoSuccessAmount)}元/${safeNum(m.baoToBaoSuccessCount)}笔
整体配对成功$/提现申请$${formatPercent(m.overallMatchSuccessRate)}`;

  // 合併文字
  const fullText = bankCardText + '\n\n' + alipayText;

  // 下載純文字檔
  const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateRange = weekRange ? `${weekRange.start}_${weekRange.end}` : '';
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  a.download = `充值报表_${dateRange || dateStr}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 计算提现指标
export const calculateWithdrawMetrics = (records, depositMetrics = null) => {
  // 计算唯一订单号（流水号）的笔数
  const uniqueOrderIds = new Set(records.map(r => r.id));
  const uniqueOrderCount = uniqueOrderIds.size;

  // ===== 先按订单号（流水号）去重，保留每个订单号的最后一笔记录 =====
  const uniqueWithdrawRecords = {};
  records.forEach(r => {
    uniqueWithdrawRecords[r.id] = r;
  });
  const deduplicatedRecords = Object.values(uniqueWithdrawRecords);

  // ===== 提现失败笔数 =====
  // 按流水号去重后，transferStatus 包含「转账失败」的数量
  const withdrawFailedCount = deduplicatedRecords.filter(r => {
    return r.transferStatus &&
           (r.transferStatus.includes('轉帳失敗') || r.transferStatus.includes('转帐失败'));
  }).length;

  // ===== 提现成功笔数（统一使用 transferStatus = "转账完成" 且按订单号去重）=====
  const withdrawSuccessRecords = deduplicatedRecords.filter(r =>
    r.transferStatus === '轉帳完成' || r.transferStatus === '转帐完成'
  );

  // 总提现成功笔数
  const totalWithdrawCount = withdrawSuccessRecords.length;

  // 总提现成功金额
  const totalWithdrawAmount = withdrawSuccessRecords.reduce((sum, r) => sum + r.actualAmount, 0);

  // 按时间区段分类 (使用 ROUND 后的 avgTimeSeconds 确保整数秒)
  // 边界条件：>= 下界 AND < 上界（与 Google Sheets ROUND 后的 TIME() 函数一致）
  const getSeconds = (r) => r.avgTimeSeconds !== null ? Math.round(r.avgTimeSeconds) : null;
  const within2Min = withdrawSuccessRecords.filter(r => getSeconds(r) !== null && getSeconds(r) >= 0 && getSeconds(r) < 120);
  const within2to5Min = withdrawSuccessRecords.filter(r => getSeconds(r) !== null && getSeconds(r) >= 120 && getSeconds(r) < 300);
  const within5to15Min = withdrawSuccessRecords.filter(r => getSeconds(r) !== null && getSeconds(r) >= 300 && getSeconds(r) < 900);
  const within15to30Min = withdrawSuccessRecords.filter(r => getSeconds(r) !== null && getSeconds(r) >= 900 && getSeconds(r) < 1800);
  const over30Min = withdrawSuccessRecords.filter(r => getSeconds(r) !== null && getSeconds(r) >= 1800);

  // 总申请 = 时间区间加总 + 提现失败笔数
  const withdrawSuccessTotalCount = within2Min.length + within2to5Min.length + within5to15Min.length + within15to30Min.length + over30Min.length + withdrawFailedCount;
  const withdrawSuccessTotalAmount = withdrawSuccessRecords.reduce((sum, r) => sum + r.actualAmount, 0);

  // 2分钟内出款
  const withdrawWithin2MinCount = within2Min.length;
  const withdrawWithin2MinAmount = within2Min.reduce((sum, r) => sum + r.actualAmount, 0);

  // 2-5分钟出款
  const withdrawWithin2to5MinCount = within2to5Min.length;
  const withdrawWithin2to5MinAmount = within2to5Min.reduce((sum, r) => sum + r.actualAmount, 0);

  // 5-15分钟出款
  const withdrawWithin5to15MinCount = within5to15Min.length;
  const withdrawWithin5to15MinAmount = within5to15Min.reduce((sum, r) => sum + r.actualAmount, 0);

  // 15-30分钟出款
  const withdrawWithin15to30MinCount = within15to30Min.length;
  const withdrawWithin15to30MinAmount = within15to30Min.reduce((sum, r) => sum + r.actualAmount, 0);

  // 超过30分钟出款
  const withdrawOver30MinCount = over30Min.length;
  const withdrawOver30MinAmount = over30Min.reduce((sum, r) => sum + r.actualAmount, 0);

  // 计算百分比
  const totalBase = withdrawSuccessTotalCount || 1;
  const withdrawWithin2MinRatio = (withdrawWithin2MinCount / totalBase) * 100;
  const withdrawWithin2to5MinRatio = (withdrawWithin2to5MinCount / totalBase) * 100;
  const withdrawWithin5to15MinRatio = (withdrawWithin5to15MinCount / totalBase) * 100;
  const withdrawWithin15to30MinRatio = (withdrawWithin15to30MinCount / totalBase) * 100;
  const withdrawOver30MinRatio = (withdrawOver30MinCount / totalBase) * 100;

  // ===== 新增指标 =====
  // 提现成功率 = 提现成功笔数/总记录 且转出金额不等于0
  // totalWithdrawCount = actualAmount > 0 的记录数
  const withdrawSuccessRate = records.length > 0 ? (totalWithdrawCount / records.length) * 100 : 0;

  // 无卡空单率 = 同週報訂單成功無卡空單率 = JS充值等待最终无配对 / 充值申请
  // 从 depositMetrics 取得数据
  const jsWaitingNoMatch = depositMetrics?.jsWaitingNoMatch || 0;
  const depositApplicationCount = depositMetrics?.totalApplicationCount || 0;
  const withdrawEmptyOrderRate = depositApplicationCount > 0 ? (jsWaitingNoMatch / depositApplicationCount) * 100 : 0;

  // 订单成功 = 提現成功筆數
  const withdrawOrderSuccessCount = withdrawSuccessTotalCount;
  const withdrawOrderSuccessAmount = withdrawSuccessTotalAmount;

  // 订单成功占比 = 提現成功筆數 / 總記錄數
  const withdrawOrderSuccessRate = records.length > 0 ? (withdrawOrderSuccessCount / records.length) * 100 : 0;

  // 平均處理時間：只計算 isAutoWithdraw=1（AC="轉帳完成" AND P="通知完成"）的記錄
  const autoWithdrawRecordsWithTime = records.filter(r =>
    r.isAutoWithdraw === 1 && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
  );
  const avgProcessingTime = autoWithdrawRecordsWithTime.length > 0
    ? autoWithdrawRecordsWithTime.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / autoWithdrawRecordsWithTime.length
    : 0;

  // ===== 銀行卡渠道提現 =====
  // 提现申请：remark = "银行卡" 且 requestAmount > 0
  const bankCardWithdrawRecords = records.filter(r =>
    r.remark === '银行卡' && r.requestAmount > 0
  );
  const bankCardWithdrawCount = bankCardWithdrawRecords.length;
  const bankCardWithdrawAmount = bankCardWithdrawRecords.reduce((sum, r) => sum + r.actualAmount, 0);

  // 銀行卡平均时间：receivingBank != "支付宝" 且 transferStatus = "轉帳完成"
  // 公式：AVERAGEIFS(AF:AF, AC:AC, "<>支付宝", AD:AD, "轉帳完成")
  // AC = 收款銀行 (receivingBank), AD = 說明 (transferStatus)
  // AF = IFERROR(Q - T, U - T)
  const bankCardTransferComplete = records.filter(r =>
    r.receivingBank !== '支付宝' && r.transferStatus === '轉帳完成' &&
    r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
  );
  const bankCardAvgTime = bankCardTransferComplete.length > 0
    ? bankCardTransferComplete.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / bankCardTransferComplete.length
    : 0;

  // 充值配对率 = 成功配对 / 充值申请 (從充值數據來)
  let bankCardMatchRate = 0;
  if (depositMetrics && depositMetrics.jisuApplicationCount > 0) {
    const rate = depositMetrics.totalMatchCount / depositMetrics.jisuApplicationCount;
    bankCardMatchRate = rate > 0.995 ? 0.99 : rate;
  }

  // 配对後成功率 = 充值成功筆數 / 成功配对筆數
  let bankCardSuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.totalMatchCount > 0) {
    bankCardSuccessAfterMatchRate = depositMetrics.totalOrderSuccessCount / depositMetrics.totalMatchCount;
  }

  // ===== 支付寶渠道提現 =====
  const alipayWithdrawRecords = records.filter(r =>
    r.remark === '支付宝' && r.requestAmount > 0
  );
  const alipayWithdrawCount = alipayWithdrawRecords.length;
  const alipayWithdrawAmount = alipayWithdrawRecords.reduce((sum, r) => sum + r.actualAmount, 0);

  // 支付寶平均时间：receivingBank = "支付宝" 且 transferStatus = "轉帳完成"
  // 公式：AVERAGEIFS(AF:AF, AC:AC, "支付宝", AD:AD, "轉帳完成")
  // AC = 收款銀行 (receivingBank), AD = 說明 (transferStatus)
  const alipayTransferComplete = records.filter(r =>
    r.receivingBank === '支付宝' && r.transferStatus === '轉帳完成' &&
    r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
  );
  const alipayAvgTime = alipayTransferComplete.length > 0
    ? alipayTransferComplete.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / alipayTransferComplete.length
    : 0;

  // 充值配对率 (支付寶)
  let alipayMatchRate = 0;
  if (depositMetrics && depositMetrics.alipayApplicationCount > 0) {
    const rate = depositMetrics.alipayTotalMatchCount / depositMetrics.alipayApplicationCount;
    alipayMatchRate = rate > 0.995 ? 0.99 : rate;
  }

  // 配对後成功率 (支付寶)
  let alipaySuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.alipayTotalMatchCount > 0) {
    alipaySuccessAfterMatchRate = depositMetrics.alipayTotalOrderSuccessCount / depositMetrics.alipayTotalMatchCount;
  }

  // ===== 微信渠道提現 =====
  const wechatWithdrawRecords = records.filter(r =>
    r.remark === '微信' && r.requestAmount > 0
  );
  const wechatWithdrawCount = wechatWithdrawRecords.length;
  const wechatWithdrawAmount = wechatWithdrawRecords.reduce((sum, r) => sum + r.actualAmount, 0);

  // 微信平均时间：remark = "微信" 且 transferStatus = "轉帳完成"
  // 公式：AVERAGEIFS(AF:AF, AC:AC, "微信", AD:AD, "轉帳完成")
  const wechatTransferComplete = records.filter(r =>
    r.remark === '微信' && r.transferStatus === '轉帳完成' &&
    r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
  );
  const wechatAvgTime = wechatTransferComplete.length > 0
    ? wechatTransferComplete.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / wechatTransferComplete.length
    : 0;

  // 充值配对率 (微信)
  let wechatMatchRate = 0;
  if (depositMetrics && depositMetrics.wechatApplicationCount > 0) {
    const rate = depositMetrics.wechatTotalMatchCount / depositMetrics.wechatApplicationCount;
    wechatMatchRate = rate > 0.995 ? 0.99 : rate;
  }

  // 配对後成功率 (微信)
  let wechatSuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.wechatTotalMatchCount > 0) {
    wechatSuccessAfterMatchRate = depositMetrics.wechatTotalOrderSuccessCount / depositMetrics.wechatTotalMatchCount;
  }

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

// 匯出指標數據分析 Excel 範本
export const exportMetricsAnalysisTemplate = () => {
  const wb = XLSX.utils.book_new();

  // ===== 工作表1: 充值原始數據 =====
  // 定義充值欄位標題 (與原始CSV一致)
  const depositHeaders = [
    'A-序號', 'B-商戶名稱', 'C-商戶訂單號', 'D-平台訂單號', 'E-收款人姓名', 'F-收款銀行',
    'G-收款卡號', 'H-申請日期', 'I-申請金額', 'J-銀行卡流水號', 'K-銀行回單碼',
    'L-收款金額', 'M-收款金額', 'N-凍結金額', 'O-商戶手續費', 'P-銀行到帳時間',
    'Q-請求日期', 'R-銀行收款時間', 'S-銀商確認到帳時間', 'T-通知商戶時間',
    'U-狀態', 'V-userId', 'W-userIP', 'X-配對時間', 'Y-配對銀行',
    'Z-配對卡號', 'AA-配對卡姓名', 'AB-配對到帳金額', 'AC-配對ID', 'AD-配對商戶訂單號',
    'AE-配對平台訂單號', 'AF-提現金額', 'AG-配對說明', 'AH-配對轉帳時間',
    'AI-極速提帳號', 'AJ-卡剩餘池建立時間', 'AK-備註', 'AL-信用評分',
    'AM-處理時間(秒)', 'AN-是否3分內', 'AO-是否自動到帳', 'AP-收款金額'
  ];
  const depositData = [depositHeaders];
  // 添加說明行
  depositData.push(['請在此行下方貼上充值原始數據（不含標題行）', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);

  const ws1 = XLSX.utils.aoa_to_sheet(depositData);
  // 設定欄寬
  ws1['!cols'] = depositHeaders.map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, ws1, '充值原始數據');

  // ===== 工作表2: 提現原始數據 =====
  const withdrawHeaders = [
    'A-序號', 'B-流水號', 'C-商戶名稱', 'D-商戶訂單號', 'E-平台訂單號',
    'F-申請出款金額', 'G-商戶返點', 'H-實際轉出金額', 'I-實際轉出金額',
    'J-收款銀行', 'K-收款卡號', 'L-收款人', 'M-收款地址',
    'N-剩餘池ID', 'O-狀態', 'P-商戶收款狀態', 'Q-通知商戶時間',
    'R-userId', 'S-userIP', 'T-建立時間', 'U-POOL建单时间',
    'V-剩餘池建立時間', 'W-轉帳ID', 'X-轉出帳號', 'Y-轉出銀行',
    'Z-轉出帳戶名', 'AA-手續費', 'AB-轉帳時間', 'AC-說明'
  ];
  const withdrawData = [withdrawHeaders];
  withdrawData.push(['請在此行下方貼上提現原始數據（不含標題行）', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);

  const ws2 = XLSX.utils.aoa_to_sheet(withdrawData);
  ws2['!cols'] = withdrawHeaders.map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, ws2, '提現原始數據');

  // ===== 工作表3: 過濾後充值數據 =====
  const filteredDepositHeaders = ['序號', '商戶名稱', '收款金額(M)', '處理時間(AM)', '是否3分內(AN)', '是否自動到帳(AO)', '狀態(U)'];
  const filteredDepositFormulas = [
    filteredDepositHeaders,
    ['（此表自動過濾 test/qa/線下 商戶）', '', '', '', '', '', ''],
    // 使用 FILTER 函數過濾數據
    ['=IFERROR(FILTER(\'充值原始數據\'!A:A, (ISERROR(SEARCH("test",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始數據\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始數據\'!B:B)))*(\'充值原始數據\'!A:A<>"")*(\'充值原始數據\'!A:A<>"A-序號")), "")',
     '=IFERROR(FILTER(\'充值原始數據\'!B:B, (ISERROR(SEARCH("test",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始數據\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始數據\'!B:B)))*(\'充值原始數據\'!A:A<>"")*(\'充值原始數據\'!A:A<>"A-序號")), "")',
     '=IFERROR(FILTER(\'充值原始數據\'!M:M, (ISERROR(SEARCH("test",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始數據\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始數據\'!B:B)))*(\'充值原始數據\'!A:A<>"")*(\'充值原始數據\'!A:A<>"A-序號")), "")',
     '=IFERROR(FILTER(\'充值原始數據\'!AM:AM, (ISERROR(SEARCH("test",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始數據\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始數據\'!B:B)))*(\'充值原始數據\'!A:A<>"")*(\'充值原始數據\'!A:A<>"A-序號")), "")',
     '=IFERROR(FILTER(\'充值原始數據\'!AN:AN, (ISERROR(SEARCH("test",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始數據\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始數據\'!B:B)))*(\'充值原始數據\'!A:A<>"")*(\'充值原始數據\'!A:A<>"A-序號")), "")',
     '=IFERROR(FILTER(\'充值原始數據\'!AO:AO, (ISERROR(SEARCH("test",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始數據\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始數據\'!B:B)))*(\'充值原始數據\'!A:A<>"")*(\'充值原始數據\'!A:A<>"A-序號")), "")',
     '=IFERROR(FILTER(\'充值原始數據\'!U:U, (ISERROR(SEARCH("test",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始數據\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始數據\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始數據\'!B:B)))*(\'充值原始數據\'!A:A<>"")*(\'充值原始數據\'!A:A<>"A-序號")), "")']
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(filteredDepositFormulas);
  ws3['!cols'] = filteredDepositHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws3, '過濾後充值');

  // ===== 工作表4: 指標數據分析 =====
  const analysisData = [
    ['指標數據分析', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['分類', '充值成功率', '充值3分內占比', '充值平均时间', '提現成功率', '提現2分內占比', '提現平均时间'],
    ['', '', '', '', '', '', ''],
    ['【充值公式說明】', '', '', '', '', '', ''],
    ['成功率 = 1 - 補單筆數/總充值筆數', '', '', '', '', '', ''],
    ['3分內占比 = 3分內筆數/自動到帳筆數', '', '', '', '', '', ''],
    ['平均时间 = AVERAGEIFS(處理時間, 收款金額, ">0")', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【提現公式說明】', '', '', '', '', '', ''],
    ['成功率 = 自動提現筆數/總提现申请筆數', '', '', '', '', '', ''],
    ['2分內占比 = 2分內筆數/自動提現筆數', '', '', '', '', '', ''],
    ['平均时间 = IF(V為空, Q-T, Q-V) 的平均值', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【分類篩選條件】', '', '', '', '', '', ''],
    ['整體: 所有記錄（排除test/qa/線下）', '', '', '', '', '', ''],
    ['支付寶: 商戶名稱包含「支付寶」或「支付宝」', '', '', '', '', '', ''],
    ['微信: 商戶名稱包含「微信」', '', '', '', '', '', ''],
    ['金寶: 轉出帳號以 GB 開頭（不區分大小寫）', '', '', '', '', '', ''],
    ['極速: 轉出帳號包含 auction 或 *****ion', '', '', '', '', '', ''],
    ['第三方: 排除以上所有分類', '', '', '', '', '', ''],
    ['非正向信评: 信用評分欄位包含「非正向」', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【注意事項】', '', '', '', '', '', ''],
    ['1. 貼上數據前請確保刪除原始數據中的標題行', '', '', '', '', '', ''],
    ['2. 數據需要從系統匯出的原始CSV複製', '', '', '', '', '', ''],
    ['3. 本範本會自動過濾 test/qa/線下 商戶', '', '', '', '', '', '']
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(analysisData);
  ws4['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws4, '指標數據分析說明');

  // ===== 工作表5: 計算結果 =====
  const calcData = [
    ['指標數據分析 - 計算結果', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['分類', '充值成功率', '充值3分內占比', '充值平均时间(秒)', '提現成功率', '提現2分內占比', '提現平均时间(秒)'],
    ['整體',
     '=IFERROR(1-COUNTIFS(\'過濾後充值\'!G:G,"*補*",\'過濾後充值\'!C:C,">0")/COUNTIF(\'過濾後充值\'!C:C,">0"), 0)',
     '=IFERROR(COUNTIFS(\'過濾後充值\'!E:E,1,\'過濾後充值\'!C:C,">0")/COUNTIFS(\'過濾後充值\'!F:F,1,\'過濾後充值\'!C:C,">0"), 0)',
     '=IFERROR(AVERAGEIFS(\'過濾後充值\'!D:D,\'過濾後充值\'!C:C,">0",\'過濾後充值\'!D:D,">0"), 0)',
     '請貼上提現數據後手動計算',
     '請貼上提現數據後手動計算',
     '請貼上提現數據後手動計算'
    ],
    ['支付寶', '=IFERROR(1-COUNTIFS(\'過濾後充值\'!G:G,"*補*",\'過濾後充值\'!C:C,">0",\'過濾後充值\'!B:B,"*支付*")/COUNTIFS(\'過濾後充值\'!C:C,">0",\'過濾後充值\'!B:B,"*支付*"), 0)', '', '', '', '', ''],
    ['微信', '=IFERROR(1-COUNTIFS(\'過濾後充值\'!G:G,"*補*",\'過濾後充值\'!C:C,">0",\'過濾後充值\'!B:B,"*微信*")/COUNTIFS(\'過濾後充值\'!C:C,">0",\'過濾後充值\'!B:B,"*微信*"), 0)', '', '', '', '', ''],
    ['金寶', '--', '--', '--', '', '', ''],
    ['極速', '--', '--', '--', '', '', ''],
    ['第三方', '--', '--', '--', '', '', ''],
    ['非正向信评', '', '', '', '--', '--', '--']
  ];

  const ws5 = XLSX.utils.aoa_to_sheet(calcData);
  ws5['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws5, '計算結果');

  // 下載檔案
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `指標數據分析範本_${dateStr}.xlsx`);
};
