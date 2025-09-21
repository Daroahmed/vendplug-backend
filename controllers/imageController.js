const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
  }
});

// @desc    Upload image to Cloudinary
// @route   POST /api/admin-ads/upload-image
// @access  Private/Admin
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image file provided' 
      });
    }

    // Validate file size (max 2MB to prevent timeout)
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 2MB to prevent upload timeout.'
      });
    }

    console.log('📤 Uploading ad image to Cloudinary:', {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    // Upload to Cloudinary with timeout
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'vendplug/ads',
          transformation: [
            { width: 1200, height: 600, crop: 'limit' }, // Optimize for banner ads
            { quality: 'auto' }
          ],
          timeout: 60000 // 60 seconds timeout
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload success:', {
              public_id: result.public_id,
              secure_url: result.secure_url
            });
            resolve(result);
          }
        }
      );

      // Set timeout for the upload
      const timeoutId = setTimeout(() => {
        uploadStream.destroy();
        reject(new Error('Upload timeout - please try again with a smaller image'));
      }, 60000); // 60 seconds

      uploadStream.on('finish', () => {
        clearTimeout(timeoutId);
      });

      uploadStream.end(req.file.buffer);
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      image: {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format
      }
    });

  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload image', 
      error: error.message 
    });
  }
};

// @desc    Delete image from Cloudinary
// @route   DELETE /api/admin-ads/delete-image
// @access  Private/Admin
const deleteImage = async (req, res) => {
  try {
    const { public_id } = req.body;

    if (!public_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Public ID is required' 
      });
    }

    console.log('🗑️ Deleting image from Cloudinary:', public_id);

    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to delete image',
        details: result
      });
    }

  } catch (error) {
    console.error('❌ Image deletion error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete image', 
      error: error.message 
    });
  }
};

// @desc    Get optimized image URL
// @route   GET /api/admin-ads/optimize-image
// @access  Public
const getOptimizedImage = async (req, res) => {
  try {
    const { url, width, height, crop } = req.query;

    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Image URL is required' 
      });
    }

    // Generate optimized URL
    const optimizedUrl = cloudinary.url(url, {
      width: width || 800,
      height: height || 400,
      crop: crop || 'limit',
      quality: 'auto',
      format: 'auto'
    });

    res.status(200).json({
      success: true,
      optimized_url: optimizedUrl
    });

  } catch (error) {
    console.error('❌ Image optimization error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to optimize image', 
      error: error.message 
    });
  }
};

module.exports = {
  upload,
  uploadImage,
  deleteImage,
  getOptimizedImage
};
