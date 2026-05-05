// Drag and Drop functionality for EarthGlow

class DragDropManager {
  constructor() {
    this.draggedElement = null;
    this.draggedImageSrc = null;
    this.referenceImage = null; // 当前AI工具区的参考图

    this.init();
  }

  init() {
    this.setupOriginalArtworkDrag();
    this.setupInspirationDrag();
    this.setupAIDropZone();
    this.setupMainCanvasDrop();
    this.setupGeneratedImageDrag();
  }

  /**
   * 设置原始作品拖拽
   */
  setupOriginalArtworkDrag() {
    const originalArtwork = document.getElementById('originalArtwork');
    if (!originalArtwork) return;

    originalArtwork.addEventListener('dragstart', (e) => {
      this.draggedElement = originalArtwork;
      this.draggedImageSrc = originalArtwork.getAttribute('data-src') || 'original_work.jpg';
      originalArtwork.classList.add('dragging');

      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', this.draggedImageSrc);
      e.dataTransfer.setData('source', 'original');

      console.log('开始拖拽原始作品:', this.draggedImageSrc);
    });

    originalArtwork.addEventListener('dragend', () => {
      originalArtwork.classList.remove('dragging');
      this.draggedElement = null;
    });
  }

  /**
   * 设置灵感区图片拖拽
   */
  setupInspirationDrag() {
    const inspirationThumbnails = document.querySelectorAll('.inspiration-grid .thumbnail');

    inspirationThumbnails.forEach(thumb => {
      thumb.addEventListener('dragstart', (e) => {
        this.draggedElement = thumb;
        this.draggedImageSrc = thumb.getAttribute('data-src');
        thumb.style.opacity = '0.5';

        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', this.draggedImageSrc);
        e.dataTransfer.setData('source', 'inspiration');

        console.log('开始拖拽灵感图:', this.draggedImageSrc);
      });

      thumb.addEventListener('dragend', () => {
        thumb.style.opacity = '1';
        this.draggedElement = null;
      });
    });
  }

  /**
   * 设置AI工具区拖放目标
   */
  setupAIDropZone() {
    const dropZone = document.getElementById('aiDropZone');
    if (!dropZone) return;

    // 拖拽进入
    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    // 拖拽悬停
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    });

    // 拖拽离开
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
      }
    });

    // 放置
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const imageSrc = e.dataTransfer.getData('text/plain');
      const source = e.dataTransfer.getData('source');

      console.log('放置到AI区:', imageSrc, '来源:', source);

      if (imageSrc) {
        this.loadReferenceImage(imageSrc);
      }
    });

    // 点击选择文件
    dropZone.addEventListener('click', () => {
      this.openFilePicker();
    });
  }

  /**
   * 设置主画布拖放目标
   */
  setupMainCanvasDrop() {
    const mainCanvas = document.getElementById('mainCanvasContainer');
    if (!mainCanvas) return;

    mainCanvas.addEventListener('dragenter', (e) => {
      e.preventDefault();
      mainCanvas.classList.add('drag-over');
    });

    mainCanvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    mainCanvas.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!mainCanvas.contains(e.relatedTarget)) {
        mainCanvas.classList.remove('drag-over');
      }
    });

    mainCanvas.addEventListener('drop', (e) => {
      e.preventDefault();
      mainCanvas.classList.remove('drag-over');

      const imageSrc = e.dataTransfer.getData('text/plain');
      const source = e.dataTransfer.getData('source');

      console.log('放置到主画布:', imageSrc, '来源:', source);

      if (imageSrc) {
        // 更新主画布图片
        this.updateMainCanvas(imageSrc);

        // 提取颜色
        if (window.app && window.app.colorExtractor) {
          window.app.colorExtractor.extractPalette(imageSrc, 5).then(colors => {
            window.app.updateColorPalette(colors);
          });
        }

        // 显示成功提示
        if (window.app) {
          window.app.showSuccess('图片已加载到主画布');
        }
      }
    });
  }

  /**
   * 设置生成图片的拖拽
   */
  setupGeneratedImageDrag() {
    const generatedImage = document.getElementById('generatedImage');
    if (!generatedImage) return;

    generatedImage.addEventListener('dragstart', (e) => {
      const src = generatedImage.src;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', src);
      e.dataTransfer.setData('source', 'generated');

      console.log('开始拖拽生成图片:', src);
    });
  }

  /**
   * 加载参考图片到AI区
   */
  loadReferenceImage(src) {
    this.referenceImage = src;

    const dropZone = document.getElementById('aiDropZone');
    const placeholder = document.getElementById('dropPlaceholder');
    const preview = document.getElementById('referencePreview');
    const referenceInfo = document.getElementById('referenceInfo');
    const referenceThumb = document.getElementById('referenceThumb');

    // 更新UI
    if (placeholder) placeholder.style.display = 'none';
    if (preview) {
      preview.src = src;
      preview.style.display = 'block';
    }
    dropZone.classList.add('has-image');

    // 显示参考图信息
    if (referenceInfo) {
      referenceInfo.classList.add('show');
      if (referenceThumb) referenceThumb.src = src;
    }

    console.log('参考图已加载:', src);

    // 触发事件
    window.dispatchEvent(new CustomEvent('referenceImageLoaded', {
      detail: { imageSrc: src }
    }));

    if (window.app) {
      window.app.showSuccess('参考图已加载，可以输入提示词开始生成');
    }
  }

  /**
   * 清除参考图
   */
  clearReference() {
    this.referenceImage = null;

    const dropZone = document.getElementById('aiDropZone');
    const placeholder = document.getElementById('dropPlaceholder');
    const preview = document.getElementById('referencePreview');
    const referenceInfo = document.getElementById('referenceInfo');

    if (placeholder) placeholder.style.display = 'flex';
    if (preview) {
      preview.src = '';
      preview.style.display = 'none';
    }
    dropZone.classList.remove('has-image');
    if (referenceInfo) referenceInfo.classList.remove('show');

    console.log('参考图已清除');
  }

  /**
   * 更新主画布图片
   */
  updateMainCanvas(src) {
    const mainCanvas = document.getElementById('mainCanvas');
    if (mainCanvas) {
      mainCanvas.src = src;
      mainCanvas.style.display = 'block';
    }

    // 保存当前生成
    if (window.app) {
      window.app.currentGeneration = {
        imageUrl: src,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 打开文件选择器
   */
  openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          this.loadReferenceImage(event.target.result);
        };
        reader.readAsDataURL(file);
      }
    };

    input.click();
  }

  /**
   * 获取当前参考图
   */
  getReferenceImage() {
    return this.referenceImage;
  }

  /**
   * 将生成的图片移到主画布
   */
  moveGeneratedToCanvas() {
    const generatedImage = document.getElementById('generatedImage');
    if (generatedImage && generatedImage.src) {
      this.updateMainCanvas(generatedImage.src);

      // 提取颜色
      if (window.app && window.app.colorExtractor) {
        window.app.colorExtractor.extractPalette(generatedImage.src, 5).then(colors => {
          window.app.updateColorPalette(colors);
        });
      }

      if (window.app) {
        window.app.showSuccess('已移到主画布');
      }
    }
  }
}

// 全局函数供HTML调用
function clearReference() {
  if (window.dragDropManager) {
    window.dragDropManager.clearReference();
  }
}

function moveToCanvas() {
  if (window.dragDropManager) {
    window.dragDropManager.moveGeneratedToCanvas();
  }
}

function saveToHistory() {
  const generatedImage = document.getElementById('generatedImage');
  if (generatedImage && generatedImage.src && window.app) {
    const promptInput = document.getElementById('promptInput');
    const prompt = promptInput ? promptInput.value : 'AI生成';

    window.app.colorExtractor.extractPalette(generatedImage.src, 5).then(colors => {
      const generationData = {
        id: generateId(),
        prompt: prompt,
        imageUrl: generatedImage.src,
        colors: colors,
        model: CONFIG.defaultModel,
        timestamp: Date.now()
      };

      window.app.storageManager.saveGeneration(generationData);
      window.app.loadHistoryPanel();
      window.app.showSuccess('已保存到历史记录');
    });
  }
}

// 初始化拖拽管理器
window.dragDropManager = new DragDropManager();
