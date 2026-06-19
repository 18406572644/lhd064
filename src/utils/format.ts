export function padZero(n: number, len: number = 2): string {
  return n.toString().padStart(len, '0');
}

export function formatDuration(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (wholeHours === 0) {
    return `${minutes}分钟`;
  }
  if (minutes === 0) {
    return `${wholeHours}小时`;
  }
  return `${wholeHours}小时${minutes}分钟`;
}

export function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1);
  const day = padZero(date.getDate());
  return `${year}年${month}月${day}日`;
}
