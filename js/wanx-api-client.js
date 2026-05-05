// 通义万相 (Wanx) API Client for Alibaba DashScope
// 文档: https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-wanxiang

class WanxAPIClient {
  constructor(apiKey, baseURL = CONFIG.wanxBaseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * 生成图像 - 文本到图像
   * @param {string} prompt - 中文/英文提示词
   * @param {object} options - 生成选项
   * @returns {Promise<string>} Task ID
   */
  async generateImage(prompt, options = {}) {
    const {
      model = 'wanx2.1-t2i-turbo', // 通义万相2.1 Turbo 模型
      size = '1024*1024',
      n = 1,
      seed = null,
      promptExtend = true
    } = options;

    const requestBody = {
      model: model,
      input: {
        prompt: prompt
      },
      parameters: {
        size: size,
        n: n,
        prompt_extend: promptExtend
      }
    };

    // 添加可选参数
    if (seed !== null) {
      requestBody.parameters.seed = seed;
    }

    try {
      const response = await fetch(`${this.baseURL}/services/aigc/text2image/image-synthesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.code) {
        throw new Error(data.message || `API error: ${data.code}`);
      }

      return data.output.task_id;
    } catch (error) {
      console.error('Image generation failed:', error);
      throw error;
    }
  }

  /**
   * 生成图像 - 基于参考图（风格迁移/色彩调整）
   * @param {string} prompt - 提示词描述目标效果
   * @param {string} referenceImageUrl - 参考图像的URL或base64
   * @param {object} options - 生成选项
   * @returns {Promise<string>} Task ID
   */
  async generateWithReference(prompt, referenceImageUrl, options = {}) {
    const {
      model = 'wanx2.1-imageedit',
      size = '1024*1024',
      n = 1,
      strength = 0.7 // 调整强度，0-1之间
    } = options;

    // 处理参考图片 - 如果是本地dataURL需要转换
    let refImage = referenceImageUrl;
    if (referenceImageUrl.startsWith('data:')) {
      // 需要上传到临时存储或使用base64直接发送
      // 这里简化为直接发送base64
      refImage = referenceImageUrl;
    }

    const requestBody = {
      model: model,
      input: {
        prompt: prompt,
        base_image_url: refImage
      },
      parameters: {
        size: size,
        n: n,
        strength: strength
      }
    };

    try {
      const response = await fetch(`${this.baseURL}/services/aigc/image2image/image-synthesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.code) {
        throw new Error(data.message || `API error: ${data.code}`);
      }

      return data.output.task_id;
    } catch (error) {
      console.error('Reference image generation failed:', error);
      throw error;
    }
  }

  /**
   * 生成图像 - 使用调色板功能（色彩风格迁移）
   * 这是通义万相的特色功能，可以根据参考图的色彩风格生成新图
   * @param {string} prompt - 提示词
   * @param {string} referenceImageUrl - 参考图像
   * @param {object} options - 选项
   * @returns {Promise<string>} Task ID
   */
  async generateWithPalette(prompt, referenceImageUrl, options = {}) {
    const {
      model = 'wanx2.1-t2i-plus', // 使用支持风格参考的模型
      size = '1024*1024',
      n = 1,
      styleReferenceStrength = 0.8 // 风格参考强度
    } = options;

    const requestBody = {
      model: model,
      input: {
        prompt: prompt
      },
      parameters: {
        size: size,
        n: n,
        style_reference_url: referenceImageUrl,
        style_reference_strength: styleReferenceStrength
      }
    };

    try {
      const response = await fetch(`${this.baseURL}/services/aigc/text2image/image-synthesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.code) {
        throw new Error(data.message || `API error: ${data.code}`);
      }

      return data.output.task_id;
    } catch (error) {
      console.error('Palette generation failed:', error);
      throw error;
    }
  }

  /**
   * 查询任务状态/结果
   * @param {string} taskId - 任务ID
   * @returns {Promise<object>} 任务状态和结果
   */
  async queryTask(taskId) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Query failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Task query failed:', error);
      throw error;
    }
  }

  /**
   * 带轮询的图像生成（文本到图像）
   * @param {string} prompt - 提示词
   * @param {object} options - 选项
   * @param {function} onProgress - 进度回调
   * @returns {Promise<object>} 生成结果
   */
  async generateImageWithPolling(prompt, options = {}, onProgress = null) {
    // 提交生成任务
    const taskId = await this.generateImage(prompt, options);

    // 轮询获取结果
    let attempts = 0;
    const maxAttempts = CONFIG.maxPollAttempts;
    const pollInterval = CONFIG.pollInterval;

    while (attempts < maxAttempts) {
      await sleep(pollInterval);
      attempts++;

      try {
        const result = await this.queryTask(taskId);

        // 回调进度
        if (onProgress) {
          onProgress({
            status: result.output?.task_status || 'PENDING',
            progress: this.getProgressFromStatus(result.output?.task_status),
            attempts: attempts
          });
        }

        const status = result.output?.task_status;

        if (status === 'SUCCEEDED') {
          // 成功 - 返回结果
          const results = result.output?.results || result.output?.image_results || [];
          if (results.length > 0) {
            return {
              success: true,
              id: taskId,
              imageUrl: results[0].url,
              prompt: prompt,
              status: status
            };
          }
          throw new Error('No image results returned');
        } else if (status === 'FAILED') {
          // 失败
          const errorMsg = result.output?.message || result.message || 'Generation failed';
          throw new Error(errorMsg);
        }
        // PENDING 或 RUNNING - 继续轮询

      } catch (error) {
        if (attempts >= maxAttempts) {
          throw error;
        }
        // 继续轮询
      }
    }

    throw new Error('Generation timeout: Max polling attempts reached');
  }

  /**
   * 带轮询的参考图生成
   * @param {string} prompt - 提示词
   * @param {string} referenceImageUrl - 参考图URL
   * @param {object} options - 选项
   * @param {function} onProgress - 进度回调
   * @returns {Promise<object>} 生成结果
   */
  async generateWithReferenceAndPolling(prompt, referenceImageUrl, options = {}, onProgress = null) {
    const taskId = await this.generateWithReference(prompt, referenceImageUrl, options);

    let attempts = 0;
    const maxAttempts = CONFIG.maxPollAttempts;
    const pollInterval = CONFIG.pollInterval;

    while (attempts < maxAttempts) {
      await sleep(pollInterval);
      attempts++;

      try {
        const result = await this.queryTask(taskId);

        if (onProgress) {
          onProgress({
            status: result.output?.task_status || 'PENDING',
            progress: this.getProgressFromStatus(result.output?.task_status),
            attempts: attempts
          });
        }

        const status = result.output?.task_status;

        if (status === 'SUCCEEDED') {
          const results = result.output?.results || result.output?.image_results || [];
          if (results.length > 0) {
            return {
              success: true,
              id: taskId,
              imageUrl: results[0].url,
              prompt: prompt,
              status: status
            };
          }
          throw new Error('No image results returned');
        } else if (status === 'FAILED') {
          const errorMsg = result.output?.message || result.message || 'Generation failed';
          throw new Error(errorMsg);
        }

      } catch (error) {
        if (attempts >= maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error('Generation timeout: Max polling attempts reached');
  }

  /**
   * 从状态获取进度百分比
   * @param {string} status - 任务状态
   * @returns {number} 进度百分比
   */
  getProgressFromStatus(status) {
    const progressMap = {
      'PENDING': 10,
      'RUNNING': 50,
      'SUCCEEDED': 100,
      'FAILED': 0
    };
    return progressMap[status] || 0;
  }
}
