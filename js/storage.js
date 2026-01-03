/**
 * 人生覆盤系統 - Cloud API 操作模組 (原 localStorage)
 */

const Storage = {
  // API Base URL (relative to where frontend is hosted, which is same origin)
  API_URL: '/api/storage',

  /**
   * 儲存資料 (Async)
   */
  async save(key, data) {
    try {
      const response = await fetch(`${this.API_URL}/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  },

  /**
   * 讀取資料 (Async)
   */
  async load(key, defaultValue = null) {
    try {
      const response = await fetch(`${this.API_URL}/${key}`);
      if (!response.ok) {
        // If 404 or other error, return default
        return defaultValue;
      }
      const json = await response.json();
      // Backend returns { data: ... } or { data: null }
      return json.data !== undefined && json.data !== null ? json.data : defaultValue;
    } catch (e) {
      console.error('Storage load error:', e);
      return defaultValue;
    }
  },

  /**
   * 刪除資料 (暫不實作 Delete API，僅保留介面)
   */
  async remove(key) {
    console.warn('Delete not implemented for Cloud Storage yet');
  },

  /**
   * 匯出資料 (下載備份) - 改為呼叫後端 endpoints 或 frontend 組合
   * Cloud version: This might be complex. For now, disable or simplify.
   */
  async downloadBackup() {
    alert('雲端版暫不支援一鍵全備份下載，資料已儲存於 Google Sheets。');
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
