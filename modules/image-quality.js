/**
 * Image Quality Module
 * Purpose: Provides utilities for enhancing image rendering quality
 * and fixing pixelated images in the gallery.
 */

/**
 * Injects CSS to improve image rendering quality
 * This adds CSS rules that help prevent pixelation during scaling
 */
export function injectImageQualityCss() {
  // Check if already injected
  if (document.getElementById('image-quality-css')) return;

  const css = `
    .artist-image {
      image-rendering: auto;
      -webkit-font-smoothing: antialiased;
      backface-visibility: hidden;
      transform: translateZ(0);
    }
    
    /* Fix for pixelated images during hover/scale */
    .artist-card:hover .artist-image {
      image-rendering: high-quality;
    }
    
    /* Support for older browsers */
    @supports not (image-rendering: high-quality) {
      .artist-card:hover .artist-image {
        image-rendering: -webkit-optimize-contrast;
      }
    }
  `;

  const style = document.createElement('style');
  style.id = 'image-quality-css';
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Applies better image quality settings to all artist card images
 * @param {boolean} force - If true, will re-apply to all images even if already processed
 */
export function enhanceGalleryImages(force = false) {
  // First inject the CSS for all images
  injectImageQualityCss();
  
  // Now find all artist images and add specific attributes/styles if needed
  const images = document.querySelectorAll('.artist-image');
  images.forEach(img => {
    if (force || !img.dataset.qualityEnhanced) {
      // Mark the image as enhanced
      img.dataset.qualityEnhanced = 'true';
      
      // Add decoding async for better performance
      img.decoding = 'async';
      
      // If browser supports fetchpriority, add it (for newer images)
      if ('fetchPriority' in HTMLImageElement.prototype) {
        img.fetchPriority = 'high';
      }
    }
  });
}

export default { injectImageQualityCss, enhanceGalleryImages };