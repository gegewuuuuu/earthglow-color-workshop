// Main UI Controller for EarthGlow

class UIController {
  constructor() {
    // Initialize components - 优先使用通义万相API
    this.apiClient = new WanxAPIClient(CONFIG.wanxApiKey, CONFIG.wanxBaseURL);
    this.grsClient = new GRSAIClient(CONFIG.apiKey, CONFIG.baseURL); // 保留备用
    this.colorExtractor = new ColorExtractor();
    this.storageManager = new StorageManager();

    // Current state
    this.currentGeneration = null;
    this.isGenerating = false;
    this.useWanxAPI = true; // 默认使用通义万相

    // Initialize UI
    this.init();
  }

  /**
   * Initialize application
   */
  init() {
    this.initializeEventListeners();
    this.loadHistoryPanel();
    this.updateDropZoneListeners();
    console.log('EarthGlow initialized successfully with Wanx API');
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Send button
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
      sendButton.addEventListener('click', () => this.handlePromptSubmit());
    }

    // Input enter key
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
      promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !this.isGenerating) {
          this.handlePromptSubmit();
        }
      });
    }

    // Download button
    const downloadButton = document.getElementById('downloadBtn');
    if (downloadButton) {
      downloadButton.addEventListener('click', () => this.handleDownload());
    }

    // 监听参考图加载事件
    window.addEventListener('referenceImageLoaded', (e) => {
      console.log('参考图已加载:', e.detail.imageSrc);
      this.showSuccess('参考图已加载，输入提示词开始生成');
    });
  }

  /**
   * 更新拖放区域的监听
   */
  updateDropZoneListeners() {
    // 拖拽管理器会在drag-drop.js中初始化
    // 这里确保当拖拽完成后UI正确更新
  }

  /**
   * Handle prompt submission with reference image support
   */
  async handlePromptSubmit() {
    const promptInput = document.getElementById('promptInput');
    const prompt = promptInput ? promptInput.value.trim() : '';

    if (!prompt) {
      this.showError('请输入提示词');
      return;
    }

    if (this.isGenerating) {
      this.showError('正在生成中，请稍候...');
      return;
    }

    // 获取参考图
    const referenceImage = window.dragDropManager ? window.dragDropManager.getReferenceImage() : null;

    try {
      this.isGenerating = true;
      this.showLoading();

      let result;

      if (referenceImage && this.useWanxAPI) {
        // 使用通义万相的参考图生成
        console.log('使用参考图生成:', prompt, '参考图:', referenceImage);
        result = await this.apiClient.generateWithReferenceAndPolling(
          prompt,
          referenceImage,
          {
            model: 'wanx2.1-imageedit',
            size: '1024*1024',
            strength: 0.7
          },
          (progress) => this.updateProgress(progress)
        );
      } else if (referenceImage) {
        // 使用GRSAI的参考图生成
        result = await this.grsClient.generateWithReference(
          prompt,
          [referenceImage],
          {
            model: CONFIG.defaultModel,
            aspectRatio: CONFIG.defaultAspectRatio,
            imageSize: CONFIG.defaultImageSize
          },
          (progress) => this.updateProgress(progress)
        );
      } else {
        // 纯文本生成
        console.log('纯文本生成:', prompt);
        result = await this.apiClient.generateImageWithPolling(
          prompt,
          {
            model: 'wanx2.1-t2i-turbo',
            size: '1024*1024'
          },
          (progress) => this.updateProgress(progress)
        );
      }

      // 下载图片并转为dataURL以便持久化
      const dataURL = await imageURLtoDataURL(result.imageUrl);

      // 提取颜色
      const colors = await this.colorExtractor.extractPalette(dataURL, 5);

      // 显示生成结果
      this.showGeneratedResult(dataURL, prompt, colors);

      // 更新主画布
      this.updateMainCanvas(dataURL);
      this.updateColorPalette(colors);

      // 保存到历史
      const generationData = {
        id: result.id,
        prompt: prompt,
        imageUrl: dataURL,
        colors: colors,
        model: this.useWanxAPI ? 'wanx2.1' : CONFIG.defaultModel,
        hasReference: !!referenceImage,
        timestamp: Date.now()
      };

      this.storageManager.saveGeneration(generationData);
      this.currentGeneration = generationData;

      // 刷新历史面板
      this.loadHistoryPanel();

      // 显示成功消息
      this.showSuccess('艺术作品生成成功！');

      // 清空输入
      if (promptInput) {
        promptInput.value = '';
      }

    } catch (error) {
      console.error('生成错误:', error);
      this.showError(error.message || '生成失败，请重试');

      // 如果通义万相失败，尝试使用备用API
      if (this.useWanxAPI) {
        console.log('尝试使用备用API...');
        this.useWanxAPI = false;
        this.isGenerating = false;
        this.hideLoading();
        this.handlePromptSubmit(); // 重试
        return;
      }
    } finally {
      this.isGenerating = false;
      this.hideLoading();
      this.useWanxAPI = true; // 重置
    }
  }

  /**
   * 显示生成结果在预览区
   */
  showGeneratedResult(imageUrl, prompt, colors) {
    const previewSection = document.getElementById('generatedPreview');
    const generatedImage = document.getElementById('generatedImage');

    if (generatedImage) {
      generatedImage.src = imageUrl;
      generatedImage.setAttribute('data-prompt', prompt);

      // 重新绑定拖拽事件
      generatedImage.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', imageUrl);
        e.dataTransfer.setData('source', 'generated');
      });
    }

    if (previewSection) {
      previewSection.classList.add('show');
    }
  }

  /**
   * Update main canvas with image
   */
  updateMainCanvas(imageUrl) {
    const mainCanvas = document.getElementById('mainCanvas');
    if (mainCanvas) {
      mainCanvas.src = imageUrl;
      mainCanvas.style.display = 'block';

      // 同时更新画布编辑器
      if (window.canvasEditor) {
        window.canvasEditor.loadImage(imageUrl);
      }
    }
  }

  /**
   * Update color palette display
   */
  updateColorPalette(colors) {
    for (let i = 0; i < 5; i++) {
      const dot = document.getElementById(`color-dot-${i + 1}`);
      if (dot && colors[i]) {
        dot.style.backgroundColor = colors[i];
        dot.setAttribute('data-color', colors[i]);
        dot.title = colors[i];
      }
    }
  }

  /**
   * Update progress during generation
   */
  updateProgress(progress) {
    const progressText = document.getElementById('progressText');
    if (progressText) {
      if (progress.status === 'PENDING') {
        progressText.textContent = '任务排队中...';
      } else if (progress.status === 'RUNNING') {
        progressText.textContent = `正在生成中... (${progress.attempts}/${CONFIG.maxPollAttempts})`;
      } else if (progress.progress) {
        progressText.textContent = `进度: ${progress.progress}%`;
      }
    }
  }

  /**
   * Load history panel with thumbnails
   */
  loadHistoryPanel() {
    const historyGrid = document.getElementById('historyGrid');
    if (!historyGrid) return;

    const history = this.storageManager.getHistory(4);

    // 清空现有缩略图
    historyGrid.innerHTML = '';

    // 添加历史项目或占位符
    if (history.length === 0) {
      historyGrid.innerHTML = `
        <div class="thumbnail">
          <img src="history1.jpg" alt="示例1">
        </div>
        <div class="thumbnail">
          <img src="history2.jpg" alt="示例2">
        </div>
      `;
      return;
    }

    // 添加历史项目
    history.forEach((item) => {
      const thumbnailDiv = document.createElement('div');
      thumbnailDiv.className = 'thumbnail';

      const img = document.createElement('img');
      img.src = item.imageUrl;
      img.alt = item.prompt;
      img.title = `${item.prompt}\n${formatDate(item.timestamp)}`;
      img.setAttribute('data-id', item.id);

      thumbnailDiv.addEventListener('click', () => this.loadHistoryItem(item.id));

      thumbnailDiv.appendChild(img);
      historyGrid.appendChild(thumbnailDiv);
    });
  }

  /**
   * Load history item and display
   */
  loadHistoryItem(id) {
    const item = this.storageManager.getHistoryItem(id);

    if (!item) {
      this.showError('找不到历史记录');
      return;
    }

    // 更新画布
    this.updateMainCanvas(item.imageUrl);

    // 更新颜色
    this.updateColorPalette(item.colors);

    // 更新当前生成
    this.currentGeneration = item;

    // 更新提示词输入
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
      promptInput.value = item.prompt;
    }

    // 显示生成结果区
    this.showGeneratedResult(item.imageUrl, item.prompt, item.colors);

    this.showSuccess('已加载历史记录');
  }

  /**
   * Handle download button click
   */
  async handleDownload() {
    if (!this.currentGeneration) {
      this.showError('没有可下载的图片');
      return;
    }

    try {
      const filename = `earthglow_${Date.now()}.png`;
      await downloadImage(this.currentGeneration.imageUrl, filename);
      this.showSuccess('图片下载成功！');
    } catch (error) {
      console.error('下载错误:', error);
      this.showError('下载失败');
    }
  }

  /**
   * Show loading overlay
   */
  showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.add('show');
    }

    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
      sendButton.disabled = true;
    }
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('show');
    }

    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
      sendButton.disabled = false;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Show info message
   */
  showInfo(message) {
    this.showToast(message, 'info');
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // 移除现有toast
    const existingToast = document.getElementById('toast');
    if (existingToast) {
      existingToast.remove();
    }

    // 创建新toast
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // 显示动画
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // 3秒后隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
}

// 全局函数供HTML调用
function fillInput(text) {
  const input = document.getElementById('promptInput');
  if (input) {
    input.value = text;
    input.focus();
  }
}

function sendPrompt() {
  if (window.app && !window.app.isGenerating) {
    window.app.handlePromptSubmit();
  }
}

// 初始化应用
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new UIController();
  });
}
