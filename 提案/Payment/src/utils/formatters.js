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

export const formatAmountInteger = (amount) => {
  return Math.round(Number(amount)).toLocaleString('zh-CN');
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
