// GRSAI API Client for Nano Banana Image Generation

class GRSAIClient {
  constructor(apiKey, baseURL = CONFIG.baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Generate image from text prompt
   * @param {string} prompt - Text prompt for image generation
   * @param {object} options - Generation options
   * @returns {Promise<string>} Task ID
   */
  async generateImage(prompt, options = {}) {
    const {
      model = CONFIG.defaultModel,
      aspectRatio = CONFIG.defaultAspectRatio,
      imageSize = CONFIG.defaultImageSize,
      urls = [],
      webHook = '-1' // Use polling mode
    } = options;

    const requestBody = {
      model,
      prompt,
      aspectRatio,
      imageSize,
      webHook,
      shutProgress: false
    };

    // Add reference images if provided
    if (urls.length > 0) {
      requestBody.urls = urls;
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/draw/nano-banana`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.code !== 0) {
        throw new Error(data.msg || 'Unknown API error');
      }

      return data.data.id;
    } catch (error) {
      console.error('Image generation failed:', error);
      throw error;
    }
  }

  /**
   * Poll for generation result
   * @param {string} taskId - Task ID from generateImage
   * @returns {Promise<object>} Generation result
   */
  async pollResult(taskId) {
    try {
      const response = await fetch(`${this.baseURL}/v1/draw/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ id: taskId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.code === 22) {
        throw new Error('Task not found');
      }

      if (data.code !== 0) {
        throw new Error(data.msg || 'Unknown API error');
      }

      return data.data;
    } catch (error) {
      console.error('Poll result failed:', error);
      throw error;
    }
  }

  /**
   * Generate image with automatic polling
   * @param {string} prompt - Text prompt
   * @param {object} options - Generation options
   * @param {function} onProgress - Progress callback (optional)
   * @returns {Promise<object>} Final result with image URL
   */
  async generateImageWithPolling(prompt, options = {}, onProgress = null) {
    // Step 1: Submit generation request
    const taskId = await this.generateImage(prompt, options);

    // Step 2: Poll for result
    let attempts = 0;
    const maxAttempts = CONFIG.maxPollAttempts;
    const pollInterval = CONFIG.pollInterval;

    while (attempts < maxAttempts) {
      await sleep(pollInterval);
      attempts++;

      try {
        const result = await this.pollResult(taskId);

        // Call progress callback if provided
        if (onProgress) {
          onProgress(result);
        }

        // Check status
        if (result.status === 'succeeded') {
          // Success - return result
          return {
            success: true,
            id: result.id,
            imageUrl: result.results[0].url,
            prompt: result.results[0].content,
            progress: result.progress,
            status: result.status
          };
        } else if (result.status === 'failed') {
          // Failed - throw error
          throw new Error(result.failure_reason || result.error || 'Generation failed');
        } else if (result.status === 'running') {
          // Still running - continue polling
          console.log(`Progress: ${result.progress}% (attempt ${attempts}/${maxAttempts})`);
          continue;
        }
      } catch (error) {
        // If task not found yet, continue polling
        if (error.message === 'Task not found' && attempts < maxAttempts) {
          console.log('Task not found yet, retrying...');
          continue;
        }
        throw error;
      }
    }

    // Timeout - max attempts reached
    throw new Error('Generation timeout: Max polling attempts reached');
  }

  /**
   * Generate image with reference images
   * @param {string} prompt - Text prompt
   * @param {string[]} referenceUrls - Array of reference image URLs
   * @param {object} options - Generation options
   * @param {function} onProgress - Progress callback (optional)
   * @returns {Promise<object>} Final result with image URL
   */
  async generateWithReference(prompt, referenceUrls, options = {}, onProgress = null) {
    return this.generateImageWithPolling(
      prompt,
      { ...options, urls: referenceUrls },
      onProgress
    );
  }
}
