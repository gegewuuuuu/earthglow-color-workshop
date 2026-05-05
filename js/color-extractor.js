// Color Extraction using Canvas API and K-Means Clustering

class ColorExtractor {
  /**
   * Extract dominant color palette from image
   * @param {HTMLImageElement|string} imageSource - Image element or URL
   * @param {number} numColors - Number of colors to extract (default: 5)
   * @returns {Promise<string[]>} Array of hex color strings
   */
  async extractPalette(imageSource, numColors = 5) {
    try {
      // Load image if source is a URL
      const img = typeof imageSource === 'string'
        ? await this.loadImage(imageSource)
        : imageSource;

      // Sample pixels from image
      const pixels = this.samplePixels(img);

      if (pixels.length === 0) {
        return this.getDefaultPalette(numColors);
      }

      // Apply k-means clustering
      const clusters = this.kMeans(pixels, numColors);

      // Convert to hex colors and sort by frequency
      const colors = clusters.map(cluster => this.rgbToHex(
        Math.round(cluster.center[0]),
        Math.round(cluster.center[1]),
        Math.round(cluster.center[2])
      ));

      return colors;
    } catch (error) {
      console.error('Color extraction failed:', error);
      return this.getDefaultPalette(numColors);
    }
  }

  /**
   * Load image from URL
   * @param {string} url - Image URL
   * @returns {Promise<HTMLImageElement>} Loaded image
   */
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));

      img.src = url;
    });
  }

  /**
   * Sample pixels from image using canvas
   * @param {HTMLImageElement} img - Image element
   * @returns {Array<number[]>} Array of [r, g, b] values
   */
  samplePixels(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Resize to reasonable size for performance
    const maxSize = 200;
    let width = img.width;
    let height = img.height;

    if (width > height && width > maxSize) {
      height = (height * maxSize) / width;
      width = maxSize;
    } else if (height > maxSize) {
      width = (width * maxSize) / height;
      height = maxSize;
    }

    canvas.width = width;
    canvas.height = height;

    // Draw image to canvas
    ctx.drawImage(img, 0, 0, width, height);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Sample every Nth pixel to reduce computation
    const pixels = [];
    const sampleRate = 10; // Sample every 10th pixel

    for (let i = 0; i < data.length; i += sampleRate * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      // Skip very light or very dark pixels (background)
      const brightness = (r + g + b) / 3;
      if (brightness > 250 || brightness < 5) continue;

      pixels.push([r, g, b]);
    }

    return pixels;
  }

  /**
   * K-means clustering algorithm
   * @param {Array<number[]>} pixels - Array of [r, g, b] values
   * @param {number} k - Number of clusters
   * @returns {Array<object>} Array of cluster objects with centers
   */
  kMeans(pixels, k) {
    // Initialize random centers
    let centers = this.initializeCenters(pixels, k);

    let iterations = 0;
    const maxIterations = 20;
    let changed = true;

    while (changed && iterations < maxIterations) {
      iterations++;

      // Assign pixels to nearest center
      const clusters = Array.from({ length: k }, () => []);

      for (const pixel of pixels) {
        const nearestIndex = this.findNearestCenter(pixel, centers);
        clusters[nearestIndex].push(pixel);
      }

      // Update centers
      const newCenters = clusters.map(cluster => {
        if (cluster.length === 0) {
          // Keep old center if cluster is empty
          return centers[clusters.indexOf(cluster)];
        }
        return this.calculateCentroid(cluster);
      });

      // Check if centers changed
      changed = !this.centersEqual(centers, newCenters);
      centers = newCenters;
    }

    // Return clusters with centers and sizes
    return centers.map((center, i) => ({
      center,
      size: pixels.filter(p => this.findNearestCenter(p, centers) === i).length
    })).sort((a, b) => b.size - a.size); // Sort by size (most dominant first)
  }

  /**
   * Initialize cluster centers using k-means++
   * @param {Array<number[]>} pixels - Pixel data
   * @param {number} k - Number of centers
   * @returns {Array<number[]>} Initial centers
   */
  initializeCenters(pixels, k) {
    const centers = [];

    // First center: random pixel
    centers.push(pixels[Math.floor(Math.random() * pixels.length)]);

    // Remaining centers: k-means++ algorithm
    for (let i = 1; i < k; i++) {
      const distances = pixels.map(pixel => {
        const minDist = Math.min(...centers.map(center =>
          this.euclideanDistance(pixel, center)
        ));
        return minDist * minDist;
      });

      const totalDist = distances.reduce((sum, d) => sum + d, 0);
      let random = Math.random() * totalDist;

      for (let j = 0; j < distances.length; j++) {
        random -= distances[j];
        if (random <= 0) {
          centers.push(pixels[j]);
          break;
        }
      }
    }

    return centers;
  }

  /**
   * Find nearest center for a pixel
   * @param {number[]} pixel - [r, g, b] values
   * @param {Array<number[]>} centers - Array of center coordinates
   * @returns {number} Index of nearest center
   */
  findNearestCenter(pixel, centers) {
    let minDist = Infinity;
    let minIndex = 0;

    centers.forEach((center, i) => {
      const dist = this.euclideanDistance(pixel, center);
      if (dist < minDist) {
        minDist = dist;
        minIndex = i;
      }
    });

    return minIndex;
  }

  /**
   * Calculate centroid of a cluster
   * @param {Array<number[]>} cluster - Array of pixels
   * @returns {number[]} Centroid [r, g, b]
   */
  calculateCentroid(cluster) {
    const sum = cluster.reduce((acc, pixel) => [
      acc[0] + pixel[0],
      acc[1] + pixel[1],
      acc[2] + pixel[2]
    ], [0, 0, 0]);

    return [
      sum[0] / cluster.length,
      sum[1] / cluster.length,
      sum[2] / cluster.length
    ];
  }

  /**
   * Calculate Euclidean distance between two colors
   * @param {number[]} a - First color [r, g, b]
   * @param {number[]} b - Second color [r, g, b]
   * @returns {number} Distance
   */
  euclideanDistance(a, b) {
    return Math.sqrt(
      Math.pow(a[0] - b[0], 2) +
      Math.pow(a[1] - b[1], 2) +
      Math.pow(a[2] - b[2], 2)
    );
  }

  /**
   * Check if two center arrays are equal
   * @param {Array<number[]>} a - First array of centers
   * @param {Array<number[]>} b - Second array of centers
   * @returns {boolean} True if equal
   */
  centersEqual(a, b) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (this.euclideanDistance(a[i], b[i]) > 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert RGB to hex color string
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {string} Hex color (#RRGGBB)
   */
  rgbToHex(r, g, b) {
    const toHex = (n) => {
      const hex = Math.max(0, Math.min(255, n)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  /**
   * Get default color palette as fallback
   * @param {number} numColors - Number of colors
   * @returns {string[]} Array of hex colors
   */
  getDefaultPalette(numColors) {
    const defaultColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#AAB7B8'
    ];

    return defaultColors.slice(0, numColors);
  }
}
