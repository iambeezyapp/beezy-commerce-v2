/**
 * Video Utilities - Frame Extraction & Thumbnail Generation
 * Provides utilities for extracting frames from video files
 */

export interface VideoFrameOptions {
  timestamp: number // Position in seconds
  quality?: number // JPEG quality 0-1 (default: 0.85)
  maxWidth?: number // Max width for thumbnail (default: 1280)
  maxHeight?: number // Max height for thumbnail (default: 720)
}

export interface ExtractedFrame {
  dataUrl: string // Base64 data URL
  blob: Blob // Blob for upload
  timestamp: number // Position in seconds
  width: number // Actual width
  height: number // Actual height
}

/**
 * Extract a single frame from video at specific timestamp
 */
export async function extractVideoFrame(
  videoFile: File,
  options: VideoFrameOptions
): Promise<ExtractedFrame> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      reject(new Error("Could not get canvas context"))
      return
    }

    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      URL.revokeObjectURL(video.src)
      video.remove()
      canvas.remove()
    }

    video.onerror = () => {
      cleanup()
      reject(new Error("Failed to load video"))
    }

    video.onloadedmetadata = () => {
      // Seek to desired timestamp
      video.currentTime = Math.min(options.timestamp, video.duration)
    }

    video.onseeked = () => {
      try {
        // Calculate dimensions maintaining aspect ratio
        const maxWidth = options.maxWidth || 1280
        const maxHeight = options.maxHeight || 720

        let width = video.videoWidth
        let height = video.videoHeight

        // Scale down if needed
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.floor(width * ratio)
          height = Math.floor(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, width, height)

        // Convert to blob and data URL
        const quality = options.quality || 0.85
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup()
              reject(new Error("Failed to create blob"))
              return
            }

            const dataUrl = canvas.toDataURL("image/jpeg", quality)

            cleanup()
            resolve({
              dataUrl,
              blob,
              timestamp: options.timestamp,
              width,
              height,
            })
          },
          "image/jpeg",
          quality
        )
      } catch (error) {
        cleanup()
        reject(error)
      }
    }

    // Load video
    video.src = URL.createObjectURL(videoFile)
  })
}

/**
 * Extract multiple frames at specified timestamps
 */
export async function extractMultipleFrames(
  videoFile: File,
  timestamps: number[],
  options?: Omit<VideoFrameOptions, "timestamp">
): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = []

  for (const timestamp of timestamps) {
    try {
      const frame = await extractVideoFrame(videoFile, {
        ...options,
        timestamp,
      })
      frames.push(frame)
    } catch (error) {
      console.error(`Failed to extract frame at ${timestamp}s:`, error)
    }
  }

  return frames
}

/**
 * Auto-generate timestamps for thumbnail extraction
 * Extracts frames at evenly distributed points throughout the video
 */
export async function generateThumbnailTimestamps(
  videoFile: File,
  count = 5
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      video.remove()
      reject(new Error("Failed to load video"))
    }

    video.onloadedmetadata = () => {
      const duration = video.duration
      const timestamps: number[] = []

      // Generate evenly spaced timestamps
      for (let i = 0; i < count; i++) {
        const position = (i / (count - 1)) * duration
        timestamps.push(Math.max(0, Math.min(position, duration - 0.1)))
      }

      URL.revokeObjectURL(video.src)
      video.remove()
      resolve(timestamps)
    }

    video.src = URL.createObjectURL(videoFile)
  })
}

/**
 * Get video metadata (duration, dimensions)
 */
export async function getVideoMetadata(videoFile: File): Promise<{
  duration: number
  width: number
  height: number
  aspectRatio: number
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      video.remove()
      reject(new Error("Failed to load video"))
    }

    video.onloadedmetadata = () => {
      const metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
      }

      URL.revokeObjectURL(video.src)
      video.remove()
      resolve(metadata)
    }

    video.src = URL.createObjectURL(videoFile)
  })
}

/**
 * Format seconds to MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

/**
 * Validate video file
 */
export function validateVideoFile(file: File): {
  valid: boolean
  error?: string
} {
  const MAX_SIZE = 100 * 1024 * 1024 // 100 MB
  const ALLOWED_TYPES = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
  ]

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Type de fichier non supporté. Formats acceptés: ${ALLOWED_TYPES.join(", ")}`,
    }
  }

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille maximale: ${MAX_SIZE / 1024 / 1024} MB`,
    }
  }

  return { valid: true }
}

/**
 * Validate video duration (max 30 seconds for Buzz)
 */
export async function validateVideoDuration(
  file: File,
  maxDurationSeconds = 30
): Promise<{
  valid: boolean
  duration: number
  error?: string
}> {
  try {
    const metadata = await getVideoMetadata(file)

    if (metadata.duration > maxDurationSeconds) {
      return {
        valid: false,
        duration: metadata.duration,
        error: `La vidéo est trop longue (${Math.round(metadata.duration)}s). Durée maximale: ${maxDurationSeconds} secondes.`,
      }
    }

    return {
      valid: true,
      duration: metadata.duration,
    }
  } catch (error) {
    return {
      valid: false,
      duration: 0,
      error: "Impossible de lire les métadonnées de la vidéo.",
    }
  }
}

/**
 * Check if file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/")
}

/**
 * Check if file is a GIF
 */
export function isGifFile(file: File): boolean {
  return file.type === "image/gif"
}

/**
 * Get file type category
 */
export function getMediaType(file: File): "video" | "gif" | "image" {
  if (isVideoFile(file)) return "video"
  if (isGifFile(file)) return "gif"
  return "image"
}
