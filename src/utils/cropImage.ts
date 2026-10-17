export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
        image.src = url
    })

export async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    // Set canvas size to the cropped size
    canvas.width = Math.max(1, Math.round(pixelCrop.width))
    canvas.height = Math.max(1, Math.round(pixelCrop.height))

    // Clear transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate source and destination coordinates to support negative sx, sy or outside bounds
    // (when user zooms out smaller than the crop box or adds padding)
    const sx = Math.max(0, pixelCrop.x)
    const sy = Math.max(0, pixelCrop.y)
    const sWidth = Math.max(0, Math.min(image.naturalWidth - sx, pixelCrop.width - (sx - pixelCrop.x)))
    const sHeight = Math.max(0, Math.min(image.naturalHeight - sy, pixelCrop.height - (sy - pixelCrop.y)))

    const dx = pixelCrop.x < 0 ? -pixelCrop.x : 0
    const dy = pixelCrop.y < 0 ? -pixelCrop.y : 0
    const dWidth = sWidth
    const dHeight = sHeight

    if (dWidth > 0 && dHeight > 0) {
        ctx.drawImage(
            image,
            sx,
            sy,
            sWidth,
            sHeight,
            dx,
            dy,
            dWidth,
            dHeight
        )
    }

    // Return as a blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob)
        }, 'image/png')
    })
}
