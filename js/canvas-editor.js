// Canvas Editor for EarthGlow - 支持选区和换色

class CanvasEditor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.image = null;
    this.isDrawing = false;
    this.currentTool = 'brush'; // brush, picker, fill, select
    this.currentColor = '#032497';
    this.brushSize = 10;
    this.opacity = 1;

    // 选区相关
    this.selection = null; // {x, y, width, height}
    this.isSelecting = false;
    this.selectStart = null;

    // 撤销/重做
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 20;

    // 颜色替换映射
    this.colorReplacements = new Map();

    this.init();
  }

  init() {
    this.setupCanvas();
    this.setupTools();
    this.setupEventListeners();
    this.setupSliders();
  }

  /**
   * 初始化画布
   */
  setupCanvas() {
    const canvasEl = document.getElementById('canvasEditor');
    const container = document.getElementById('mainCanvasContainer');
    const img = document.getElementById('mainCanvas');

    if (!canvasEl || !container || !img) return;

    this.canvas = canvasEl;
    this.ctx = this.canvas.getContext('2d');

    // 设置画布尺寸匹配容器
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width - 120;
    this.canvas.height = rect.height - 40;

    // 加载当前图片
    if (img.complete) {
      this.loadImage(img.src);
    } else {
      img.onload = () => this.loadImage(img.src);
    }
  }

  /**
   * 加载图片到画布
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      this.image = new Image();
      this.image.crossOrigin = 'Anonymous';

      this.image.onload = () => {
        this.drawImage();
        this.saveState();
        resolve();
      };

      this.image.onerror = reject;
      this.image.src = src;
    });
  }

  /**
   * 绘制图片到画布
   */
  drawImage() {
    if (!this.ctx || !this.image) return;

    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 计算适应画布的尺寸
    const scale = Math.min(
      this.canvas.width / this.image.width,
      this.canvas.height / this.image.height
    );

    const width = this.image.width * scale;
    const height = this.image.height * scale;
    const x = (this.canvas.width - width) / 2;
    const y = (this.canvas.height - height) / 2;

    this.imageBounds = { x, y, width, height, scale };

    // 绘制图片
    this.ctx.drawImage(this.image, x, y, width, height);

    // 绘制选区
    if (this.selection) {
      this.drawSelection();
    }
  }

  /**
   * 绘制选区
   */
  drawSelection() {
    if (!this.selection || !this.ctx) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#032497';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(
      this.selection.x,
      this.selection.y,
      this.selection.width,
      this.selection.height
    );

    // 半透明填充
    this.ctx.fillStyle = 'rgba(3, 36, 151, 0.1)';
    this.ctx.fillRect(
      this.selection.x,
      this.selection.y,
      this.selection.width,
      this.selection.height
    );
    this.ctx.restore();
  }

  /**
   * 设置工具按钮
   */
  setupTools() {
    const toolBtns = document.querySelectorAll('.tool-btn');

    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 移除其他活动状态
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 设置当前工具
        this.currentTool = btn.getAttribute('data-tool');
        this.updateCursor();

        console.log('切换工具:', this.currentTool);
      });
    });
  }

  /**
   * 设置滑块
   */
  setupSliders() {
    // 色相滑块
    const hueSlider = document.getElementById('hueSlider');
    const hueThumb = document.getElementById('hueThumb');

    if (hueSlider && hueThumb) {
      let isDragging = false;

      hueSlider.addEventListener('mousedown', (e) => {
        isDragging = true;
        this.updateHueSlider(e, hueSlider, hueThumb);
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          this.updateHueSlider(e, hueSlider, hueThumb);
        }
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    // 透明度滑块
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityThumb = document.getElementById('opacityThumb');
    const opacityInput = document.getElementById('opacityInput');

    if (opacitySlider && opacityThumb) {
      let isDragging = false;

      opacitySlider.addEventListener('mousedown', (e) => {
        isDragging = true;
        const value = this.updateOpacitySlider(e, opacitySlider, opacityThumb);
        if (opacityInput) opacityInput.value = Math.round(value * 100);
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const value = this.updateOpacitySlider(e, opacitySlider, opacityThumb);
          if (opacityInput) opacityInput.value = Math.round(value * 100);
        }
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    // HEX输入
    const hexInput = document.getElementById('hexInput');
    if (hexInput) {
      hexInput.addEventListener('change', (e) => {
        let color = e.target.value;
        if (!color.startsWith('#')) color = '#' + color;
        this.currentColor = color;
      });
    }

    // 颜色点点击
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const color = dot.getAttribute('data-color') || dot.style.backgroundColor;
        this.currentColor = color;
        if (hexInput) hexInput.value = color.replace('#', '');
      });
    });
  }

  /**
   * 更新色相滑块
   */
  updateHueSlider(e, slider, thumb) {
    const rect = slider.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));

    const percent = x / rect.width;
    thumb.style.left = `${percent * 100}%`;

    // 计算色相值 (0-360)
    const hue = Math.round(percent * 360);
    this.currentColor = `hsl(${hue}, 70%, 50%)`;

    const hexInput = document.getElementById('hexInput');
    if (hexInput) {
      hexInput.value = this.hslToHex(hue, 70, 50).replace('#', '');
    }

    return hue;
  }

  /**
   * 更新透明度滑块
   */
  updateOpacitySlider(e, slider, thumb) {
    const rect = slider.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));

    const percent = x / rect.width;
    thumb.style.left = `${percent * 100}%`;

    this.opacity = percent;
    return percent;
  }

  /**
   * HSL转HEX
   */
  hslToHex(h, s, l) {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r, g, b;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    const toHex = (n) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

    // 触摸支持
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchend', () => {
      const mouseEvent = new MouseEvent('mouseup', {});
      this.canvas.dispatchEvent(mouseEvent);
    });
  }

  /**
   * 更新鼠标样式
   */
  updateCursor() {
    if (!this.canvas) return;

    const cursors = {
      brush: 'crosshair',
      picker: 'crosshair',
      fill: 'pointer',
      select: 'crosshair'
    };

    this.canvas.style.cursor = cursors[this.currentTool] || 'default';
  }

  /**
   * 获取鼠标在画布上的位置
   */
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * 处理鼠标按下
   */
  handleMouseDown(e) {
    if (!this.ctx) return;

    const pos = this.getMousePos(e);

    switch (this.currentTool) {
      case 'brush':
        this.isDrawing = true;
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.setupBrush();
        break;

      case 'picker':
        this.pickColor(pos.x, pos.y);
        break;

      case 'fill':
        this.floodFill(pos.x, pos.y);
        break;

      case 'select':
        this.isSelecting = true;
        this.selectStart = pos;
        break;
    }
  }

  /**
   * 处理鼠标移动
   */
  handleMouseMove(e) {
    if (!this.isDrawing && !this.isSelecting) return;

    const pos = this.getMousePos(e);

    if (this.isDrawing && this.currentTool === 'brush') {
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    }

    if (this.isSelecting) {
      // 实时更新选区显示
      this.selection = {
        x: Math.min(this.selectStart.x, pos.x),
        y: Math.min(this.selectStart.y, pos.y),
        width: Math.abs(pos.x - this.selectStart.x),
        height: Math.abs(pos.y - this.selectStart.y)
      };
      this.drawImage();
    }
  }

  /**
   * 处理鼠标释放
   */
  handleMouseUp() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.ctx.closePath();
      this.saveState();
    }

    if (this.isSelecting) {
      this.isSelecting = false;
      this.saveState();

      // 显示选区操作提示
      if (this.selection && window.app) {
        window.app.showInfo('选区已创建，可以应用颜色替换');
      }
    }
  }

  /**
   * 设置画笔
   */
  setupBrush() {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.brushSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = this.opacity;
  }

  /**
   * 取色
   */
  pickColor(x, y) {
    if (!this.ctx) return;

    const pixel = this.ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;

    this.currentColor = hex.toUpperCase();

    const hexInput = document.getElementById('hexInput');
    if (hexInput) hexInput.value = hex.toUpperCase().replace('#', '');

    if (window.app) {
      window.app.showSuccess(`已选取颜色: ${hex.toUpperCase()}`);
    }
  }

  /**
   * 填充（简化的泛洪填充）
   */
  floodFill(startX, startY) {
    if (!this.ctx) return;

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 获取起始点颜色
    const startIdx = (startY * width + startX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    // 解析目标颜色
    const targetColor = this.parseColor(this.currentColor);

    // 颜色匹配容差
    const tolerance = 32;

    // 使用栈进行泛洪填充
    const stack = [[startX, startY]];
    const visited = new Set();
    const key = (x, y) => `${x},${y}`;

    const matchColor = (idx) => {
      return Math.abs(data[idx] - startR) < tolerance &&
             Math.abs(data[idx + 1] - startG) < tolerance &&
             Math.abs(data[idx + 2] - startB) < tolerance &&
             Math.abs(data[idx + 3] - startA) < tolerance;
    };

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const k = key(x, y);

      if (visited.has(k) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      visited.add(k);
      const idx = (y * width + x) * 4;

      if (matchColor(idx)) {
        data[idx] = targetColor.r;
        data[idx + 1] = targetColor.g;
        data[idx + 2] = targetColor.b;
        data[idx + 3] = Math.round(255 * this.opacity);

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.saveState();

    if (window.app) {
      window.app.showSuccess('填充完成');
    }
  }

  /**
   * 解析颜色
   */
  parseColor(color) {
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);
    const computed = window.getComputedStyle(div).color;
    document.body.removeChild(div);

    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * 替换选区颜色
   */
  replaceColorInSelection(targetColor, replacementColor) {
    if (!this.selection || !this.ctx) return;

    const { x, y, width, height } = this.selection;
    const imageData = this.ctx.getImageData(x, y, width, height);
    const data = imageData.data;

    const target = this.parseColor(targetColor);
    const replacement = this.parseColor(replacementColor);
    const tolerance = 30;

    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - target.r) < tolerance &&
          Math.abs(data[i + 1] - target.g) < tolerance &&
          Math.abs(data[i + 2] - target.b) < tolerance) {
        data[i] = replacement.r;
        data[i + 1] = replacement.g;
        data[i + 2] = replacement.b;
      }
    }

    this.ctx.putImageData(imageData, x, y);
    this.saveState();
  }

  /**
   * 保存状态（用于撤销）
   */
  saveState() {
    if (!this.canvas) return;

    this.historyIndex++;
    if (this.historyIndex < this.history.length) {
      this.history.length = this.historyIndex;
    }

    this.history.push(this.canvas.toDataURL());

    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * 撤销
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState();
    }
  }

  /**
   * 重做
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState();
    }
  }

  /**
   * 恢复状态
   */
  restoreState() {
    if (!this.ctx || this.historyIndex < 0) return;

    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = this.history[this.historyIndex];
  }

  /**
   * 清除选区
   */
  clearSelection() {
    this.selection = null;
    this.drawImage();
  }

  /**
   * 导出图片
   */
  exportImage() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }

  /**
   * 切换编辑器显示
   */
  toggleEditor(show) {
    const canvasEl = document.getElementById('canvasEditor');
    const imgEl = document.getElementById('mainCanvas');

    if (show) {
      if (canvasEl) canvasEl.style.display = 'block';
      if (imgEl) imgEl.style.display = 'none';
    } else {
      if (canvasEl) canvasEl.style.display = 'none';
      if (imgEl) imgEl.style.display = 'block';
    }
  }
}

// 初始化画布编辑器
window.canvasEditor = new CanvasEditor();
