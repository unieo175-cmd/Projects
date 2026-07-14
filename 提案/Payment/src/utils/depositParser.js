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
      if (status.startsWith('金额补单') || status.startsWith('金額補單')) return '金额补单';
      if (status.startsWith('未充值')) return '未充值';
      if (status.startsWith('信用評分上分<br>') || status.startsWith('信用评分上分<br>')) return '信用評分上分';
      if (status.startsWith('審核中') || status.startsWith('审核中')) return '审核中(已超时)';
      if (status.startsWith('图文复核(已超时)') || status.startsWith('圖文複核(已超時)')) return '图文复核(已超时)';
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

    // Determine channel based on merchant name (2.6)
    const merchantName = record.merchant;
    const hasAlipay  = merchantName.includes('支付宝') || merchantName.includes('支付寶');
    const hasWechat  = merchantName.includes('微信');
    const hasOffline = merchantName.includes('線下') || merchantName.includes('线下');

    if (hasOffline) {
      record.channel = '線下';
    } else if (hasAlipay) {
      record.channel = '支付宝';
    } else if (hasWechat) {
      record.channel = '微信';
    } else {
      record.channel = '銀行卡';
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
    record.isWithin3Min = record.processingTime !== null && record.processingTime <= 180;

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
