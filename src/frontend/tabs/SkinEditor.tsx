import { useEffect, useRef, useState } from "react"
import { Download, Pencil, Eraser, Pipette, Undo, Redo, Grid3x3, Save, Undo2, Eye, EyeOff } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SkinEditorProps {
  onClose: () => void
  onSave: (skinData: string, variant: "classic" | "slim") => Promise<void>
  initialSkinUrl?: string
  initialVariant?: "classic" | "slim"
}

type Tool = "pencil" | "eraser" | "eyedropper"

const SKIN_WIDTH = 75
const SKIN_HEIGHT = 64
const PIXEL_SIZE = 9

export function SkinEditor(props: SkinEditorProps) {
  const { onClose, onSave, initialSkinUrl, initialVariant = "classic" } = props
  const { t } = useTranslation()
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement>(null)
  const outlineCanvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>("pencil")
  const [color, setColor] = useState("#000000")
  const [isDrawing, setIsDrawing] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showOutlines, setShowOutlines] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [saving, setSaving] = useState(false)
  
  // Body parts
  const bodyPartRegions = [
    // Head
    { name: "Head Top", x: 8, y: 0, w: 8, h: 8, color: "#FFD700" },
    { name: "Head Bottom", x: 16, y: 0, w: 8, h: 8, color: "#FFD700" },
    { name: "Head Right", x: 0, y: 8, w: 8, h: 8, color: "#FFD700" },
    { name: "Head Front", x: 8, y: 8, w: 8, h: 8, color: "#FFD700" },
    { name: "Head Left", x: 16, y: 8, w: 8, h: 8, color: "#FFD700" },
    { name: "Head Back", x: 24, y: 8, w: 8, h: 8, color: "#FFD700" },
    
    // Body
    { name: "Body Top", x: 20, y: 16, w: 8, h: 4, color: "#FF4444" },
    { name: "Body Bottom", x: 28, y: 16, w: 8, h: 4, color: "#FF4444" },
    { name: "Body Right", x: 16, y: 20, w: 4, h: 12, color: "#FF4444" },
    { name: "Body Front", x: 20, y: 20, w: 8, h: 12, color: "#FF4444" },
    { name: "Body Left", x: 28, y: 20, w: 4, h: 12, color: "#FF4444" },
    { name: "Body Back", x: 32, y: 20, w: 8, h: 12, color: "#FF4444" },
    
    // Right Arm
    { name: "R Arm Top", x: 44, y: 16, w: 4, h: 4, color: "#00BFFF" },
    { name: "R Arm Bottom", x: 48, y: 16, w: 4, h: 4, color: "#00BFFF" },
    { name: "R Arm Right", x: 40, y: 20, w: 4, h: 12, color: "#00BFFF" },
    { name: "R Arm Front", x: 44, y: 20, w: 4, h: 12, color: "#00BFFF" },
    { name: "R Arm Left", x: 48, y: 20, w: 4, h: 12, color: "#00BFFF" },
    { name: "R Arm Back", x: 52, y: 20, w: 4, h: 12, color: "#00BFFF" },
    
    // Left Arm
    { name: "L Arm Top", x: 36, y: 48, w: 4, h: 4, color: "#9D4EDD" },
    { name: "L Arm Bottom", x: 40, y: 48, w: 4, h: 4, color: "#9D4EDD" },
    { name: "L Arm Right", x: 32, y: 52, w: 4, h: 12, color: "#9D4EDD" },
    { name: "L Arm Front", x: 36, y: 52, w: 4, h: 12, color: "#9D4EDD" },
    { name: "L Arm Left", x: 40, y: 52, w: 4, h: 12, color: "#9D4EDD" },
    { name: "L Arm Back", x: 44, y: 52, w: 4, h: 12, color: "#9D4EDD" },
    
    // Right Leg
    { name: "R Leg Top", x: 4, y: 16, w: 4, h: 4, color: "#00CC66" },
    { name: "R Leg Bottom", x: 8, y: 16, w: 4, h: 4, color: "#00CC66" },
    { name: "R Leg Right", x: 0, y: 20, w: 4, h: 12, color: "#00CC66" },
    { name: "R Leg Front", x: 4, y: 20, w: 4, h: 12, color: "#00CC66" },
    { name: "R Leg Left", x: 8, y: 20, w: 4, h: 12, color: "#00CC66" },
    { name: "R Leg Back", x: 12, y: 20, w: 4, h: 12, color: "#00CC66" },
    
    // Left Leg
    { name: "L Leg Top", x: 20, y: 48, w: 4, h: 4, color: "#FF9500" },
    { name: "L Leg Bottom", x: 24, y: 48, w: 4, h: 4, color: "#FF9500" },
    { name: "L Leg Right", x: 16, y: 52, w: 4, h: 12, color: "#FF9500" },
    { name: "L Leg Front", x: 20, y: 52, w: 4, h: 12, color: "#FF9500" },
    { name: "L Leg Left", x: 24, y: 52, w: 4, h: 12, color: "#FF9500" },
    { name: "L Leg Back", x: 28, y: 52, w: 4, h: 12, color: "#FF9500" },
  ]
  
  const commonColors = [
    "#000000", "#FFFFFF", "#C0C0C0", "#808080",
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#FF00FF", "#00FFFF", "#800000", "#008000",
    "#000080", "#808000", "#800080", "#008080",
    "#FFA500", "#A52A2A", "#D2691E", "#8B4513",
    "#F5DEB3"
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    if (initialSkinUrl) {
      loadSkinFromUrl(initialSkinUrl)
    } else {
      saveToHistory()
    }
  }, [])

  useEffect(() => {
    if (showGrid) {
      drawGrid()
    } else {
      clearGrid()
    }
  }, [showGrid])

  useEffect(() => {
    if (showOutlines) {
      drawOutlines()
    } else {
      clearOutlines()
    }
  }, [showOutlines])

  const drawGrid = () => {
    const gridCanvas = gridCanvasRef.current
    if (!gridCanvas) return

    const ctx = gridCanvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height)
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)"
    ctx.lineWidth = 1

    // Draw vertical lines
    for (let x = 0; x <= gridCanvas.width; x += PIXEL_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, gridCanvas.height)
      ctx.stroke()
    }

    // Draw horizontal lines
    for (let y = 0; y <= gridCanvas.height; y += PIXEL_SIZE) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(gridCanvas.width, y)
      ctx.stroke()
    }
  }

  const clearGrid = () => {
    const gridCanvas = gridCanvasRef.current
    if (!gridCanvas) return

    const ctx = gridCanvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height)
  }

  const drawOutlines = () => {
    const outlineCanvas = outlineCanvasRef.current
    if (!outlineCanvas) return

    const ctx = outlineCanvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height)
    ctx.lineWidth = 2

    bodyPartRegions.forEach(region => {
      ctx.strokeStyle = region.color
      ctx.strokeRect(
        region.x * PIXEL_SIZE,
        region.y * PIXEL_SIZE,
        region.w * PIXEL_SIZE,
        region.h * PIXEL_SIZE
      )
    })
  }

  const clearOutlines = () => {
    const outlineCanvas = outlineCanvasRef.current
    if (!outlineCanvas) return

    const ctx = outlineCanvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height)
  }

  const loadSkinFromUrl = async (url: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      
      img.onload = () => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, SKIN_WIDTH, SKIN_HEIGHT, 0, 0, canvas.width, canvas.height)
        
        saveToHistory()
      }
      
      img.onerror = () => {
        console.error("Failed to load skin image")
        saveToHistory()
      }
      
      img.src = url
    } catch (err) {
      console.error("Error loading skin:", err)
    }
  }

  const saveToHistory = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Remove any history after current index
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(imageData)

    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryIndex(prev => prev + 1)
    }
    
    setHistory(newHistory)
  }

  const undo = () => {
    if (historyIndex <= 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const newIndex = historyIndex - 1
    ctx.putImageData(history[newIndex], 0, 0)
    setHistoryIndex(newIndex)
  }

  const redo = () => {
    if (historyIndex >= history.length - 1) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const newIndex = historyIndex + 1
    ctx.putImageData(history[newIndex], 0, 0)
    setHistoryIndex(newIndex)
  }

  const getPixelPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / PIXEL_SIZE) * PIXEL_SIZE
    const y = Math.floor((e.clientY - rect.top) / PIXEL_SIZE) * PIXEL_SIZE

    return { x, y }
  }

  const drawPixel = (x: number, y: number, currentColor: string, isErasing: boolean = false) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    if (isErasing) {
      ctx.clearRect(x, y, PIXEL_SIZE, PIXEL_SIZE)
    } else {
      ctx.fillStyle = currentColor
      ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE)
    }
  }

  const pickColor = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const imageData = ctx.getImageData(x, y, 1, 1)
    const [r, g, b] = imageData.data
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
    setColor(hex)
    setTool("pencil")
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPosition(e)
    if (!pos) return

    setIsDrawing(true)

    if (tool === "eyedropper") {
      pickColor(pos.x, pos.y)
    } else if (tool === "pencil") {
      drawPixel(pos.x, pos.y, color, false)
    } else if (tool === "eraser") {
      drawPixel(pos.x, pos.y, "", true)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const pos = getPixelPosition(e)
    if (!pos) return

    if (tool === "pencil") {
      drawPixel(pos.x, pos.y, color, false)
    } else if (tool === "eraser") {
      drawPixel(pos.x, pos.y, "", true)
    }
  }

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      saveToHistory()
    }
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary canvas
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = SKIN_WIDTH
    exportCanvas.height = SKIN_HEIGHT
    const exportCtx = exportCanvas.getContext("2d")
    if (!exportCtx) return

    exportCtx.imageSmoothingEnabled = false
    exportCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, SKIN_WIDTH, SKIN_HEIGHT)

    exportCanvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `minecraft-skin-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, "image/png")
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setSaving(true)

    try {
      // Create a temporary canvas
      const exportCanvas = document.createElement("canvas")
      exportCanvas.width = SKIN_WIDTH
      exportCanvas.height = SKIN_HEIGHT
      const exportCtx = exportCanvas.getContext("2d")
      if (!exportCtx) return

      exportCtx.imageSmoothingEnabled = false
      exportCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, SKIN_WIDTH, SKIN_HEIGHT)

      // Convert to base64
      const base64Data = exportCanvas.toDataURL("image/png").split(",")[1]
      
      await onSave(base64Data, initialVariant)
      onClose()
    } catch (err) {
      console.error("Failed to save skin:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <style>{`
        input[type="color"] {
          border: none !important;
          outline: none !important;
          padding: 0 !important;
        }
        input[type="color"]::-webkit-color-swatch-wrapper {
          padding: 0 !important;
        }
        input[type="color"]::-webkit-color-swatch {
          border: none !important;
          border-radius: 6px !important;
        }
        input[type="color"]::-moz-color-swatch {
          border: none !important;
          border-radius: 6px !important;
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-[#e6e6e6] tracking-tight">{t('skins.editor.title') || 'Skin Editor'}</h1>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#22252b] rounded-md transition-colors cursor-pointer text-[#7d8590] hover:text-[#e6e6e6]"
                title="Back"
              >
                <Undo2 size={18} />
              </button>
            </div>
            <p className="text-sm text-[#7d8590] mt-0.5">Create or edit your Minecraft skin</p>
          </div>

          {showOutlines && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#FFD700" }} />
                <span className="text-[#7d8590]">Head</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#FF4444" }} />
                <span className="text-[#7d8590]">Body</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#00BFFF" }} />
                <span className="text-[#7d8590]">R Arm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#9D4EDD" }} />
                <span className="text-[#7d8590]">L Arm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#00CC66" }} />
                <span className="text-[#7d8590]">R Leg</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#FF9500" }} />
                <span className="text-[#7d8590]">L Leg</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center justify-center p-2 bg-[#181a1f] hover:bg-[#1f2128] text-[#e6e6e6] rounded-md transition-all cursor-pointer"
              title="Download PNG"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center p-2 bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-all cursor-pointer"
              title="Save & Apply"
            >
              <Save size={18} />
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Toolbar */}
          <div className="flex-shrink-0 space-y-4 w-64">
            <div className="bg-[#22252b] rounded-md p-4">
              <h3 className="text-sm font-semibold text-[#e6e6e6] mb-3">Tools</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setTool("pencil")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                    tool === "pencil"
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#181a1f] text-[#7d8590] hover:bg-[#1f2128] hover:text-[#e6e6e6]"
                  }`}
                >
                  <Pencil size={16} />
                  <span>Pencil</span>
                </button>
                <button
                  onClick={() => setTool("eraser")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                    tool === "eraser"
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#181a1f] text-[#7d8590] hover:bg-[#1f2128] hover:text-[#e6e6e6]"
                  }`}
                >
                  <Eraser size={16} />
                  <span>Eraser</span>
                </button>
                <button
                  onClick={() => setTool("eyedropper")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                    tool === "eyedropper"
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#181a1f] text-[#7d8590] hover:bg-[#1f2128] hover:text-[#e6e6e6]"
                  }`}
                >
                  <Pipette size={16} />
                  <span>Eyedropper</span>
                </button>
              </div>
            </div>

            {/* Color Picker */}
            <div className="bg-[#22252b] rounded-md p-4">
              <h3 className="text-sm font-semibold text-[#e6e6e6] mb-3">Color</h3>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-12 rounded-md cursor-pointer border-0"
                style={{ padding: 0 }}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full mt-2 px-3 py-2 bg-[#181a1f] text-[#e6e6e6] rounded-md text-sm font-mono"
              />
              
              {/* Color palette */}
              <div className="grid grid-cols-7 gap-1 mt-3">
                {commonColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-full aspect-square rounded cursor-pointer hover:ring-2 hover:ring-[#4572e3] ${
                      color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-[#4572e3]" : ""
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            
            <div className="bg-[#22252b] rounded-md p-4 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#181a1f] hover:bg-[#1f2128] disabled:opacity-50 disabled:cursor-not-allowed text-[#e6e6e6] rounded-md text-sm transition-all cursor-pointer"
                  title="Undo"
                >
                  <Undo size={16} />
                </button>
                <button
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#181a1f] hover:bg-[#1f2128] disabled:opacity-50 disabled:cursor-not-allowed text-[#e6e6e6] rounded-md text-sm transition-all cursor-pointer"
                  title="Redo"
                >
                  <Redo size={16} />
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                    showGrid
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#181a1f] text-[#7d8590] hover:bg-[#1f2128] hover:text-[#e6e6e6]"
                  }`}
                  title="Toggle Grid"
                >
                  <Grid3x3 size={16} />
                </button>
                <button
                  onClick={() => setShowOutlines(!showOutlines)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                    showOutlines
                      ? "bg-[#4572e3] text-white"
                      : "bg-[#181a1f] text-[#7d8590] hover:bg-[#1f2128] hover:text-[#e6e6e6]"
                  }`}
                  title="Toggle Body Outlines"
                >
                  {showOutlines ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

          </div>

          {/* Canvas */}
          <div className="flex-1 flex flex-col items-center">
            <div className="bg-[#22252b] rounded-md p-6 inline-block">
              <div className="relative">
                <div 
                  className="absolute rounded"
                  style={{
                    top: "2px",
                    left: "2px",
                    width: `${SKIN_WIDTH * PIXEL_SIZE}px`,
                    height: `${SKIN_HEIGHT * PIXEL_SIZE}px`,
                    backgroundImage: `
                      linear-gradient(45deg, #2a2d35 25%, transparent 25%),
                      linear-gradient(-45deg, #2a2d35 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #2a2d35 75%),
                      linear-gradient(-45deg, transparent 75%, #2a2d35 75%)
                    `,
                    backgroundSize: `${PIXEL_SIZE * 2}px ${PIXEL_SIZE * 2}px`,
                    backgroundPosition: `0 0, 0 ${PIXEL_SIZE}px, ${PIXEL_SIZE}px -${PIXEL_SIZE}px, -${PIXEL_SIZE}px 0px`
                  }}
                />
                <canvas
                  ref={canvasRef}
                  width={SKIN_WIDTH * PIXEL_SIZE}
                  height={SKIN_HEIGHT * PIXEL_SIZE}
                  className="border-2 border-[#181a1f] rounded relative block"
                  style={{ 
                    imageRendering: "pixelated"
                  }}
                />
                <canvas
                  ref={gridCanvasRef}
                  width={SKIN_WIDTH * PIXEL_SIZE}
                  height={SKIN_HEIGHT * PIXEL_SIZE}
                  className="absolute pointer-events-none"
                  style={{ 
                    imageRendering: "pixelated",
                    top: "2px",
                    left: "2px"
                  }}
                />
                <canvas
                  ref={outlineCanvasRef}
                  width={SKIN_WIDTH * PIXEL_SIZE}
                  height={SKIN_HEIGHT * PIXEL_SIZE}
                  className="absolute pointer-events-none"
                  style={{ 
                    imageRendering: "pixelated",
                    top: "2px",
                    left: "2px"
                  }}
                />
                <canvas
                  width={SKIN_WIDTH * PIXEL_SIZE}
                  height={SKIN_HEIGHT * PIXEL_SIZE}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="absolute cursor-crosshair pointer-events-auto"
                  style={{ 
                    imageRendering: "pixelated",
                    top: "2px",
                    left: "2px",
                    opacity: 0
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}