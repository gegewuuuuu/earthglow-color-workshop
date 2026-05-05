// LocalStorage Manager for EarthGlow History

class StorageManager {
  constructor() {
    this.historyKey = 'earthglow_history';
    this.configKey = 'earthglow_config';
    this.maxHistoryItems = 20;
    this.maxStorageSize = 5 * 1024 * 1024; // 5MB limit
  }

  /**
   * Save generation to history
   * @param {object} data - Generation data
   * @returns {boolean} Success status
   */
  saveGeneration(data) {
    try {
      const history = this.getHistory();

      // Create history item
      const item = {
        id: data.id || generateId(),
        prompt: data.prompt,
        imageUrl: data.imageUrl,
        colors: data.colors || [],
        timestamp: Date.now(),
        model: data.model || CONFIG.defaultModel
      };

      // Add to beginning of history
      history.unshift(item);

      // Trim if exceeds max items
      if (history.length > this.maxHistoryItems) {
        history.length = this.maxHistoryItems;
      }

      // Check storage size
      const historyString = JSON.stringify(history);
      if (historyString.length > this.maxStorageSize) {
        // Remove oldest items until within limit
        while (historyString.length > this.maxStorageSize && history.length > 0) {
          history.pop();
        }
      }

      // Save to localStorage
      localStorage.setItem(this.historyKey, JSON.stringify(history));

      return true;
    } catch (error) {
      console.error('Failed to save generation:', error);

      // If quota exceeded, try clearing old items
      if (error.name === 'QuotaExceededError') {
        this.clearOldItems(10);
        return this.saveGeneration(data); // Retry
      }

      return false;
    }
  }

  /**
   * Get history items
   * @param {number} limit - Maximum number of items to return
   * @returns {Array<object>} Array of history items
   */
  getHistory(limit = null) {
    try {
      const historyString = localStorage.getItem(this.historyKey);

      if (!historyString) {
        return [];
      }

      const history = JSON.parse(historyString);

      return limit ? history.slice(0, limit) : history;
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  /**
   * Get single history item by ID
   * @param {string} id - Item ID
   * @returns {object|null} History item or null
   */
  getHistoryItem(id) {
    const history = this.getHistory();
    return history.find(item => item.id === id) || null;
  }

  /**
   * Delete history item by ID
   * @param {string} id - Item ID
   * @returns {boolean} Success status
   */
  deleteHistoryItem(id) {
    try {
      const history = this.getHistory();
      const filteredHistory = history.filter(item => item.id !== id);

      localStorage.setItem(this.historyKey, JSON.stringify(filteredHistory));

      return true;
    } catch (error) {
      console.error('Failed to delete history item:', error);
      return false;
    }
  }

  /**
   * Clear old history items
   * @param {number} keepCount - Number of recent items to keep
   * @returns {boolean} Success status
   */
  clearOldItems(keepCount = 10) {
    try {
      const history = this.getHistory();
      const recentHistory = history.slice(0, keepCount);

      localStorage.setItem(this.historyKey, JSON.stringify(recentHistory));

      return true;
    } catch (error) {
      console.error('Failed to clear old items:', error);
      return false;
    }
  }

  /**
   * Clear all history
   * @returns {boolean} Success status
   */
  clearHistory() {
    try {
      localStorage.removeItem(this.historyKey);
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  }

  /**
   * Get configuration
   * @returns {object} Configuration object
   */
  getConfig() {
    try {
      const configString = localStorage.getItem(this.configKey);

      if (!configString) {
        return {
          maxHistoryItems: this.maxHistoryItems
        };
      }

      return JSON.parse(configString);
    } catch (error) {
      console.error('Failed to get config:', error);
      return {
        maxHistoryItems: this.maxHistoryItems
      };
    }
  }

  /**
   * Save configuration
   * @param {object} config - Configuration object
   * @returns {boolean} Success status
   */
  saveConfig(config) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  }

  /**
   * Get storage usage information
   * @returns {object} Storage usage stats
   */
  getStorageInfo() {
    try {
      const historyString = localStorage.getItem(this.historyKey) || '[]';
      const configString = localStorage.getItem(this.configKey) || '{}';

      const historySize = historyString.length;
      const configSize = configString.length;
      const totalSize = historySize + configSize;

      const history = JSON.parse(historyString);

      return {
        totalSize,
        historySize,
        configSize,
        itemCount: history.length,
        maxSize: this.maxStorageSize,
        usagePercent: (totalSize / this.maxStorageSize) * 100
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        totalSize: 0,
        historySize: 0,
        configSize: 0,
        itemCount: 0,
        maxSize: this.maxStorageSize,
        usagePercent: 0
      };
    }
  }

  /**
   * Export history as JSON
   * @returns {string} JSON string of history
   */
  exportHistory() {
    const history = this.getHistory();
    return JSON.stringify(history, null, 2);
  }

  /**
   * Import history from JSON
   * @param {string} jsonString - JSON string to import
   * @returns {boolean} Success status
   */
  importHistory(jsonString) {
    try {
      const history = JSON.parse(jsonString);

      if (!Array.isArray(history)) {
        throw new Error('Invalid history format');
      }

      localStorage.setItem(this.historyKey, JSON.stringify(history));

      return true;
    } catch (error) {
      console.error('Failed to import history:', error);
      return false;
    }
  }
}
