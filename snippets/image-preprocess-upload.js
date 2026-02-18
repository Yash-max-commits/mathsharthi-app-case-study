/**
 * Image Preprocess & Upload Pattern
 *
 * Demonstrates a multi-step image pipeline for mobile apps:
 * 1. Pick or capture an image
 * 2. Resize while preserving aspect ratio
 * 3. Compress to reduce upload payload
 * 4. Upload via multipart FormData
 * 5. Clean up temporary files
 *
 * Technique: expo-image-manipulator for resize/compress, axios for upload
 * Pattern: Pipeline with graceful degradation and temp file cleanup
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Image, Platform } from 'react-native';
import axios from 'axios';

// ── Configuration ─────────────────────────────────────────────────
const MAX_DIMENSION = 800;       // Max width or height in pixels
const JPEG_QUALITY = 0.7;        // 70% quality — balances size vs. clarity
const UPLOAD_ENDPOINT = '/api/upload'; // Replace with your endpoint

// ── Step 1: Resize with Aspect Ratio Preservation ─────────────────
/**
 * Resizes an image to fit within MAX_DIMENSION while maintaining
 * its original aspect ratio. If the image is already smaller,
 * it is returned unchanged.
 *
 * @param {string} imageUri - Local file URI of the image
 * @returns {string} URI of the resized image (or original if no resize needed)
 */
const resizeImage = async (imageUri) => {
    try {
        // Retrieve the original dimensions
        const { width, height } = await getImageDimensions(imageUri);

        // Skip resize if already within bounds
        if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
            return imageUri;
        }

        // Calculate new dimensions preserving aspect ratio
        const aspectRatio = width / height;
        let newWidth, newHeight;

        if (width > height) {
            newWidth = MAX_DIMENSION;
            newHeight = Math.round(MAX_DIMENSION / aspectRatio);
        } else {
            newHeight = MAX_DIMENSION;
            newWidth = Math.round(MAX_DIMENSION * aspectRatio);
        }

        // Resize and compress in a single operation
        const result = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ resize: { width: newWidth, height: newHeight } }],
            { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
        );

        return result.uri;
    } catch (error) {
        // Graceful degradation: return original if resize fails
        console.warn('Image resize failed, using original:', error.message);
        return imageUri;
    }
};

// ── Helper: Get Image Dimensions ──────────────────────────────────
/**
 * Wraps Image.getSize in a Promise for async/await usage.
 */
const getImageDimensions = (uri) => {
    return new Promise((resolve, reject) => {
        Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            (error) => reject(error)
        );
    });
};

// ── Step 2: Normalize Platform URI ────────────────────────────────
/**
 * Android requires 'file://' prefix for local URIs.
 * iOS uses the raw path directly.
 */
const normalizePlatformUri = (filePath) => {
    if (Platform.OS === 'android' && !filePath.startsWith('file://')) {
        return `file://${filePath}`;
    }
    return filePath;
};

// ── Step 3: Upload via Multipart FormData ─────────────────────────
/**
 * Uploads an image with an optional text query as multipart form data.
 * Includes auth token in the Authorization header.
 *
 * @param {string} imageUri - Local URI of the processed image
 * @param {string} query - Optional text query to send alongside the image
 * @param {string} authToken - Bearer token for authentication
 * @param {string} baseUrl - API base URL
 * @returns {Object} API response data
 */
const uploadImage = async (imageUri, query, authToken, baseUrl) => {
    const formData = new FormData();

    formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `upload_${Date.now()}.jpg`,
    });

    if (query) {
        formData.append('message', query);
    }

    const response = await axios.post(`${baseUrl}${UPLOAD_ENDPOINT}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${authToken}`,
        },
    });

    return response.data;
};

// ── Step 4: Cleanup Temporary Files ───────────────────────────────
/**
 * Deletes temporary files created during the resize/compress process.
 * Uses idempotent flag to prevent errors if file is already removed.
 *
 * @param {string} originalUri - Original image URI (not deleted)
 * @param {string} processedUri - Processed image URI (deleted if different)
 */
const cleanupTempFiles = async (originalUri, processedUri) => {
    if (processedUri && processedUri !== originalUri) {
        try {
            await FileSystem.deleteAsync(processedUri, { idempotent: true });
        } catch {
            // Silent fail — cleanup is best-effort
        }
    }
};

// ── Full Pipeline: Orchestrator ───────────────────────────────────
/**
 * Runs the complete image processing pipeline:
 * normalize → resize → upload → cleanup
 *
 * @param {string} rawImagePath - Raw path from camera or picker
 * @param {string} query - Text query to accompany the image
 * @param {string} authToken - Auth token
 * @param {string} baseUrl - API base URL
 * @returns {Object} { success: boolean, data?: Object, error?: string }
 */
const processAndUploadImage = async (rawImagePath, query, authToken, baseUrl) => {
    let processedUri = null;

    try {
        // Step 1: Normalize the URI for the current platform
        const normalizedUri = normalizePlatformUri(rawImagePath);

        // Step 2: Resize and compress
        processedUri = await resizeImage(normalizedUri);

        // Step 3: Upload
        const data = await uploadImage(processedUri, query, authToken, baseUrl);

        return { success: true, data };
    } catch (error) {
        const message = error.response?.data?.error || error.message || 'Upload failed';
        return { success: false, error: message };
    } finally {
        // Step 4: Always clean up, even on error
        const normalizedUri = normalizePlatformUri(rawImagePath);
        await cleanupTempFiles(normalizedUri, processedUri);
    }
};

export {
    resizeImage,
    normalizePlatformUri,
    uploadImage,
    cleanupTempFiles,
    processAndUploadImage,
};

/**
 * Usage example:
 *
 * // After camera capture or image picker result:
 * const result = await processAndUploadImage(
 *   photo.path,
 *   'Analyze this image',
 *   userToken,
 *   'https://api.example.com'
 * );
 *
 * if (result.success) {
 *   // Update UI with result.data
 * } else {
 *   Alert.alert('Error', result.error);
 * }
 */
