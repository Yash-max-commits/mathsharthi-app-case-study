# Camera & File Upload Pipeline

## Overview

MathSharthi implements two camera-based upload pipelines — one for the **main AI chat** and one for the **AI Tutor**. Both follow the same multi-step async chain but differ in their target API and post-upload behavior (tutor pipeline includes audio response handling).

---

## Pipeline Stages

```
┌─────────┐    ┌──────┐    ┌────────┐    ┌──────────┐    ┌────────┐    ┌─────────┐
│ Capture  │───►│ Crop │───►│ Resize │───►│ Compress │───►│ Upload │───►│ Cleanup │
└─────────┘    └──────┘    └────────┘    └──────────┘    └────────┘    └─────────┘
```

---

### 1. Capture

**Library:** `react-native-vision-camera`

The camera screen renders a full-screen camera view using the device's back camera. On shutter press, `takePhoto()` captures a high-resolution still.

**Platform handling:**

```
Android: uri = "file://" + photo.path
iOS:     uri = photo.path
```

This branching is necessary because Android requires the `file://` protocol prefix for local file URIs, while iOS uses raw paths.

---

### 2. Crop

**Library:** `react-native-image-crop-tools`

After capture, the image is presented in an interactive `CropView` component. The user can:
- Drag to reposition the crop area
- Pinch to adjust the crop frame

This step is critical for **math problem accuracy** — users crop to the exact problem area, removing surrounding noise before AI analysis.

The crop operation produces a new image URI with just the selected region.

---

### 3. Resize

**Library:** `expo-image-manipulator`

The cropped image is resized with **aspect-ratio preservation**:

```
Input:  arbitrary dimensions from crop
Output: max 800 × 800 px (aspect ratio maintained)

Logic:
  if width > height:
    scale width to 800, compute height from aspect ratio
  else:
    scale height to 800, compute width from aspect ratio
```

This prevents distortion while ensuring a consistent maximum dimension for the API.

---

### 4. Compress

Compression is applied **during the resize step** as part of the same `manipulateAsync` call:

```
Format:  JPEG
Quality: 0.7 (70%)
```

**Combined impact:** The resize + compress step reduces upload payload by approximately **60–80%** compared to the raw camera capture, while preserving sufficient detail for AI text/math recognition.

---

### 5. Upload

**Library:** `axios` with `FormData`

The processed image is uploaded as a multipart form:

```
FormData:
  ├── file:     { uri, type: 'image/jpeg', name: 'photo.jpg' }
  ├── message:  user's text query (main chat) or analysis prompt (tutor)
  └── language: selected language code (tutor only)

Headers:
  ├── Content-Type:  multipart/form-data
  └── Authorization: Bearer <token from AsyncStorage>
```

**Optimistic UI:** Before the upload begins, a temporary message with a typing/uploading indicator is inserted into the chat. On success, this placeholder is replaced with the actual image preview and AI response.

**Temporary message pattern:**

```
1. Create temp message:  { id: Date.now() + '_uploading', isUploading: true }
2. Insert at top of messages array
3. On API success: map over messages, replace temp with real data
4. On API failure: filter out temp message, show Alert
```

---

### 6. Cleanup

After successful upload, temporary files are explicitly deleted to prevent storage bloat:

```
Files cleaned:
  ├── Resized image     (if URI differs from original)
  ├── Cache copy        (created during document picker flow)
  └── TTS audio cache   (tutor pipeline only, after playback)

Method: FileSystem.deleteAsync(uri, { idempotent: true })
```

The `idempotent: true` flag prevents errors if the file was already removed.

---

### 7. Error Handling

Each stage has explicit error handling with user-visible feedback:

| Stage | Error Handling |
|---|---|
| **Permission** | `Alert` with message directing user to device settings |
| **Capture** | Camera error codes surfaced via `Alert` |
| **Crop** | Fallback to original URI if crop fails |
| **Resize** | Returns original URI if `manipulateAsync` throws (graceful degradation) |
| **Upload** | Parses `err.response.data.error` for server messages; falls back to generic message |
| **Auth** | If no token found pre-upload, redirects to Login screen and removes temp message |

**Error recovery pattern:**

```
try {
  // ... upload logic
} catch (err) {
  const errorMessage = err.response?.data?.error || 'Failed to upload.';
  Alert.alert('Error', errorMessage);
  // Remove uploading placeholder from messages
  setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
}
```

---

## Document Picker Flow (Alternative Input)

In addition to camera capture, users can upload files via the device file picker:

```
DocumentPicker.getDocumentAsync({
  copyToCacheDirectory: true,
  type: ['application/pdf', 'image/*']
})
```

**File type branching:**

| Type | Processing | Display |
|---|---|---|
| **Image** | Resize → compress → upload | Inline image in chat bubble |
| **PDF** | Direct upload (no preprocessing) | Document icon + filename |

PDFs skip the resize/compress stage since they are uploaded as-is for server-side page extraction.

---

## Pipeline Comparison

| Aspect | Main Chat Pipeline | AI Tutor Pipeline |
|---|---|---|
| Camera library | `react-native-vision-camera` | `react-native-vision-camera` |
| Crop | `CropView` (interactive) | `CropView` (interactive) |
| Resize | 800×800, JPEG 70% | 800×800, JPEG 70% |
| Upload target | General chat API | AI Tutor API |
| Post-upload | Insert image + text response | Insert image + text response + play audio |
| Audio response | No | Yes (base64 MP3 decoded and played) |
| State update | `MessagesContext` | Local `useState` + `conversationHistory` |
