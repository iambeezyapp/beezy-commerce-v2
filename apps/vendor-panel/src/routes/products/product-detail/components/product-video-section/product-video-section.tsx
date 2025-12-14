/**
 * Porté depuis: apps/backend/src/admin/widgets/product-video-manager.tsx
 * Widget pour gérer les vidéos/GIFs d'un produit
 */
import { Trash, Plus, ChevronUpMini, ChevronDownMini } from "@medusajs/icons"
import { Container, Button, toast, Heading } from "@medusajs/ui"
import { useState, useEffect, useRef } from "react"
import { ExtendedAdminProduct } from "../../../../../types/products"

type ProductVideo = {
  id: string
  url: string
  type: "video" | "gif"
  duration: number
  size: number
  order: number
  thumbnail_url?: string
}

type ProductVideoSectionProps = {
  product: ExtendedAdminProduct
}

export const ProductVideoSection = ({ product }: ProductVideoSectionProps) => {
  const [videos, setVideos] = useState<ProductVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!product) {
    return null
  }

  useEffect(() => {
    loadVideos()
  }, [product.id])

  const loadVideos = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/vendor/products/${product.id}/videos`, {
        credentials: "include",
      })
      const data = await response.json()
      setVideos(data.videos || [])
    } catch (error) {
      // Silently fail if endpoint doesn't exist yet
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validTypes = ["video/mp4", "video/webm", "image/gif"]
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid File Type", {
        description: "Only MP4, WebM, and GIF files are allowed",
      })
      return
    }

    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error("File Too Large", {
        description: "File size cannot exceed 50 MB",
      })
      return
    }

    if (videos.length >= 8) {
      toast.error("Maximum Reached", {
        description: "You can only have 8 videos per product",
      })
      return
    }

    setUploading(true)

    try {
      const videoElement = document.createElement("video")
      videoElement.preload = "metadata"

      const duration = await new Promise<number>((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          resolve(videoElement.duration)
        }
        videoElement.onerror = reject
        videoElement.src = URL.createObjectURL(file)
      })

      if (duration > 30) {
        toast.error("Video Too Long", {
          description: "Video duration cannot exceed 30 seconds",
        })
        setUploading(false)
        return
      }

      const mockUrl = URL.createObjectURL(file)

      const response = await fetch(`/vendor/products/${product.id}/videos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          url: mockUrl,
          type: file.type.includes("gif") ? "gif" : "video",
          duration,
          size: file.size,
          order: videos.length + 1,
        }),
      })

      if (response.ok) {
        toast.success("Video Added", {
          description: "Video uploaded successfully",
        })
        await loadVideos()
      } else {
        throw new Error("Upload failed")
      }
    } catch (error) {
      toast.error("Upload Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (videoId: string) => {
    try {
      await fetch(`/vendor/products/${product.id}/videos/${videoId}`, {
        method: "DELETE",
        credentials: "include",
      })

      toast.success("Video Deleted", {
        description: "Video removed successfully",
      })
      await loadVideos()
    } catch (error) {
      toast.error("Delete Failed", {
        description: "Failed to delete video",
      })
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return

    const newVideos = [...videos]
    ;[newVideos[index - 1], newVideos[index]] = [
      newVideos[index],
      newVideos[index - 1],
    ]

    setVideos(newVideos)
    toast.success("Order Updated", {
      description: "Video order changed",
    })
  }

  const handleMoveDown = async (index: number) => {
    if (index === videos.length - 1) return

    const newVideos = [...videos]
    ;[newVideos[index + 1], newVideos[index]] = [
      newVideos[index],
      newVideos[index + 1],
    ]

    setVideos(newVideos)
    toast.success("Order Updated", {
      description: "Video order changed",
    })
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Heading level="h2">Product Videos/GIFs</Heading>
            <p className="text-ui-fg-subtle text-sm mt-1">
              Add up to 8 videos or GIFs (max 30 seconds each)
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,image/gif"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading || videos.length >= 8}
            />
            <Button
              variant="secondary"
              disabled={uploading || videos.length >= 8}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="mr-2" />
              {uploading ? "Uploading..." : "Add Video"}
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-ui-fg-subtle text-sm">Loading videos...</p>
        ) : videos.length === 0 ? (
          <p className="text-ui-fg-subtle text-sm">
            No videos added yet. Click "Add Video" to upload your first one.
          </p>
        ) : (
          <div className="space-y-3">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <video
                  src={video.url}
                  className="w-24 h-24 object-cover rounded"
                  muted
                  loop
                />

                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {video.type === "gif" ? "GIF" : "Video"} #{index + 1}
                  </p>
                  <p className="text-xs text-ui-fg-subtle">
                    {video.duration.toFixed(1)}s •{" "}
                    {(video.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ChevronUpMini />
                  </Button>

                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === videos.length - 1}
                  >
                    <ChevronDownMini />
                  </Button>

                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => handleDelete(video.id)}
                  >
                    <Trash />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {videos.length > 0 && (
          <p className="text-xs text-ui-fg-subtle mt-3">
            {videos.length} / 8 videos used
          </p>
        )}
      </div>
    </Container>
  )
}
