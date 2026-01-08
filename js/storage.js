/**
 * 人生覆盤系統 - Cloud API 操作模組 (原 localStorage)
 */

const Storage = {
  /**
   * 儲存資料 (Sync with localStorage)
   */
  async save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  },

  /**
   * 讀取資料 (Sync with localStorage)
   */
  async load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.error('Storage load error:', e);
      return defaultValue;
    }
  },

  /**
   * 刪除資料
   */
  async remove(key) {
    localStorage.removeItem(key);
  },

  /**
   * 匯出資料 (下載備份)
   */
  async downloadBackup() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data[key] = JSON.parse(localStorage.getItem(key));
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-review-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// 週次相關工具 (保持不變)
const WeekUtils = {
  // 週日為一週的開始
  getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0=週日, 1=週一, ..., 6=週六
    const diff = d.getDate() - day; // 回到週日
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // 週六為一週的結束
  getWeekEnd(date = new Date()) {
    const start = this.getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // 週日+6天=週六
    end.setHours(23, 59, 59, 999);
    return end;
  },

  formatShort(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  },

  formatFull(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  },

  getWeekKey(date = new Date()) {
    const start = this.getWeekStart(date);
    return `${start.getFullYear()}-W${this.getWeekNumber(start)}`;
  },

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  getMonthWeeks(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let current = this.getWeekStart(firstDay);

    while (current <= lastDay) {
      const weekEnd = this.getWeekEnd(current);
      weeks.push({
        start: new Date(current),
        end: new Date(weekEnd),
        key: this.getWeekKey(current),
        label: `${this.formatShort(current)} - ${this.formatShort(weekEnd)}`
      });
      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }
};

// 日期計算工具 (保持不變)
const DateUtils = {
  daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.floor((date2 - date1) / oneDay);
  },

  weeksBetween(date1, date2) {
    return (this.daysBetween(date1, date2) / 7).toFixed(2);
  },

  calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    const ageInMs = today - birth;
    const ageInYears = ageInMs / (365.25 * 24 * 60 * 60 * 1000);
    return ageInYears.toFixed(2);
  }
};

export { Storage, WeekUtils, DateUtils };
