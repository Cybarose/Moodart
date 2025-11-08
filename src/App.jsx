import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, MousePointer2, Image as ImageIcon, Type as TypeIcon, Palette as PaletteIcon, Trash2, Mic, X, FileText, MessageCircle, Link as LinkIcon, Grid3x3, ZoomIn, ZoomOut, Maximize2, Plus, Music, Upload, Bold, Italic, List, AlignLeft, Underline, Video } from "lucide-react";
import * as htmlToImage from "html-to-image";
import logoUrl from "./assets/moodart_logo.png";

const PALETTE = { red: "#D84040", darkRed: "#A31D1D", sand: "#ECDCBF", cream: "#F8F2DE" };

let idCounter = 1;
const newId = () => String(idCounter++);

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref, onClose]);
}

function useDrag(onChange) {
  const dragging = useRef(null);
  const onMouseDown = (e, item) => {
    e.stopPropagation();
    dragging.current = { id: item.id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y };
    document.body.style.userSelect = "none";
  };
  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const d = dragging.current;
    const nx = d.ox + (e.clientX - d.sx) / (window.currentZoom || 1);
    const ny = d.oy + (e.clientY - d.sy) / (window.currentZoom || 1);
    onChange(d.id, { x: nx, y: ny });
  }, [onChange]);
  const onMouseUp = useCallback(() => { dragging.current = null; document.body.style.userSelect = ""; }, []);
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);
  return { onMouseDown };
}

function useResize(onResize) {
  const start = useRef(null);
  const onHandleDown = (e, id, corner, origin) => {
    e.stopPropagation();
    start.current = { id, corner, sx: e.clientX, sy: e.clientY, origin };
    document.body.style.userSelect = "none";
  };
  const onMove = useCallback((e) => {
    if (!start.current) return;
    const { id, corner, sx, sy, origin } = start.current;
    const dx = (e.clientX - sx) / (window.currentZoom || 1);
    const dy = (e.clientY - sy) / (window.currentZoom || 1);
    onResize(id, corner, dx, dy, origin);
  }, [onResize]);
  const onUp = useCallback(() => { start.current = null; document.body.style.userSelect = ""; }, []);
  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [onMove, onUp]);
  return { onHandleDown };
}

export default function App() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [popover, setPopover] = useState(null);
  const [currentColor, setCurrentColor] = useState(PALETTE.red);
  const [paletteStops, setPaletteStops] = useState([PALETTE.red, PALETTE.sand, PALETTE.cream]);
  const [paletteOrientation, setPaletteOrientation] = useState('vertical');
  const [showDots, setShowDots] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [exportSize, setExportSize] = useState('original');
  const [selectMode, setSelectMode] = useState(true);
  
  const boardRef = useRef(null);
  const fileRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const pendingImageRef = useRef(null);
  const docEditorRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  window.currentZoom = zoom;
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panning = useRef(null);

  const beginPan = (e) => { 
    if (!selectMode) return;
    if (e.button !== 0 || e.target.closest('.board-item')) return; 
    panning.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }; 
  };
  const onPanMove = useCallback((e) => { 
    if (!panning.current) return; 
    const d = panning.current; 
    setPan({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }); 
  }, []);
  const endPan = () => { panning.current = null; };
  
  useEffect(() => { 
    window.addEventListener('mousemove', onPanMove); 
    window.addEventListener('mouseup', endPan); 
    return () => { 
      window.removeEventListener('mousemove', onPanMove); 
      window.removeEventListener('mouseup', endPan); 
    }; 
  }, [onPanMove]);
  
  const onWheel = (e) => { 
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.05;
    setZoom(z => Math.min(3, Math.max(0.1, +(z + delta).toFixed(2)))); 
  };
  
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const zoomIn = () => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.1, +(z - 0.1).toFixed(2)));

  // FIXED: Dots mit minimum spacing
  const dotSize = 1.5;
  const dotSpacing = Math.max(16, 24 * zoom);
  const DOT_BG = {
    backgroundImage: `radial-gradient(rgba(0,0,0,0.15) ${dotSize}px, transparent ${dotSize}px)`,
    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
    backgroundPosition: "0 0",
  };

  const setItem = useCallback((id, patch) => { 
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it))); 
  }, []);
  
  const { onMouseDown } = useDrag((id, patch) => setItem(id, patch));

  const addImage = () => {
    const it = { id: newId(), type: "image", x: 100, y: 100, w: 320, h: 220, src: "", zIndex: items.length };
    setItems((p) => [...p, it]);
    setSelected(it.id);
    pendingImageRef.current = it.id;
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const addNote = () => { 
    const it = { id: newId(), type: "note", x: 100, y: 100, w: 240, h: 140, text: "", zIndex: items.length }; 
    setItems((p) => [...p, it]); 
    setSelected(it.id); 
  };
  
  const addDocument = () => {
    const it = { id: newId(), type: "document", x: 100, y: 100, w: 200, h: 140, text: "", title: "Document", zIndex: items.length };
    setItems((p) => [...p, it]);
    setSelected(it.id);
  };

  const addComment = () => {
    const it = { id: newId(), type: "comment", x: 100, y: 100, w: 240, h: 160, text: "", zIndex: items.length };
    setItems((p) => [...p, it]);
    setSelected(it.id);
  };

  const addLink = () => {
    const it = { id: newId(), type: "link", x: 100, y: 100, w: 300, h: 100, url: "", title: "", zIndex: items.length };
    setItems((p) => [...p, it]);
    setSelected(it.id);
  };

  const addMusic = () => {
    setPopover('music');
  };

  const addVideo = () => {
    setPopover('video');
  };

  const onPickAudio = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const it = { id: newId(), type: "audio", x: 100, y: 100, w: 300, h: 80, src: url, title: file.name, zIndex: items.length };
    setItems((p) => [...p, it]);
    setSelected(it.id);
    setPopover(null);
    e.target.value = "";
  };

  const onPickVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const it = { id: newId(), type: "video", x: 100, y: 100, w: 480, h: 270, src: url, title: file.name, zIndex: items.length };
    setItems((p) => [...p, it]);
    setSelected(it.id);
    setPopover(null);
    e.target.value = "";
  };

  const addSwatch = () => {
    const it = { 
      id: newId(), 
      type: "swatch", 
      x: 100, 
      y: 100, 
      w: paletteOrientation === 'horizontal' ? 240 : 110, 
      h: paletteOrientation === 'horizontal' ? 110 : 240, 
      colors: [...paletteStops],
      orientation: paletteOrientation,
      zIndex: items.length
    };
    setItems((p) => [...p, it]);
    setSelected(it.id);
    setPopover(null);
  };

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const [recState, setRecState] = useState('idle');
  const [voiceError, setVoiceError] = useState('');

  const addVoice = (src) => { 
    const it = { id: newId(), type: "audio", x: 100, y: 100, w: 300, h: 80, src, title: "Voice Note", zIndex: items.length }; 
    setItems((p) => [...p, it]); 
    setSelected(it.id);
    setPopover(null);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        addVoice(url);
        setRecState('idle');
        setVoiceError('');
      };
      mr.start();
      setRecState('recording');
      setVoiceError('');
    } catch (err) {
      setRecState('error');
      setVoiceError('Microphone permission required (HTTPS)');
    }
  };

  const stopRec = () => { 
    if (mediaRef.current && recState === 'recording') {
      mediaRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const removeItem = (id) => { 
    setItems((p) => p.filter((i) => i.id !== id)); 
    if (selected === id) setSelected(null); 
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    const pendingId = pendingImageRef.current;
    
    if (file && pendingId) {
      const url = URL.createObjectURL(file);
      setItem(pendingId, { src: url });
    } else if (!file && pendingId) {
      const item = items.find(it => it.id === pendingId);
      if (item && !item.src) {
        removeItem(pendingId);
      }
    }
    
    pendingImageRef.current = null;
    e.target.value = "";
  };

  const exportAs = async (type) => {
    if (!boardRef.current) return;
    
    if (items.length === 0) {
      alert('Board is empty - add some items first!');
      setPopover(null);
      return;
    }

    const sizeMap = {
      small: 1,
      medium: 1.5,
      large: 2,
      original: 2.5
    };
    const pixelRatio = sizeMap[exportSize] || 2;
    
    if (type === 'png' || type === 'jpg') {
      try {
        const boardContainer = boardRef.current.querySelector('.board-container');
        const fn = type === 'png' ? htmlToImage.toPng : htmlToImage.toJpeg;
        const dataUrl = await fn(boardContainer, { 
          pixelRatio, 
          backgroundColor: '#ffffff', 
          quality: 0.95,
          cacheBust: true
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `moodart-board-${exportSize}.${type}`;
        a.click();
      } catch (err) {
        console.error('Export error:', err);
        alert('Export failed - please try again');
      }
    } else if (type === 'pdf') {
      try {
        const boardContainer = boardRef.current.querySelector('.board-container');
        const dataUrl = await htmlToImage.toPng(boardContainer, { 
          pixelRatio, 
          backgroundColor: '#ffffff'
        });
        const w = window.open('');
        if (!w) return;
        w.document.write(`<img src="${dataUrl}" style="width:100%">`);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 100);
      } catch (err) {
        console.error('PDF export error:', err);
        alert('PDF export failed - please try again');
      }
    } else if (type === 'html') {
      exportAsHTML();
    }
    setPopover(null);
  };

  const exportAsHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moodart Board</title>
  <style>
    body { margin: 0; padding: 40px; background: white; font-family: sans-serif; }
    h1 { color: #D84040; margin-bottom: 30px; }
    .board { position: relative; width: 100%; min-height: 800px; background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; }
    .item { position: absolute; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; }
    .item img { width: 100%; height: 100%; object-fit: cover; }
    .item video { width: 100%; height: 100%; object-fit: contain; background: #000; }
    .item audio { width: calc(100% - 20px); margin: 10px; }
    .note { background: rgba(255,255,255,0.95); padding: 20px; font-size: 14px; line-height: 1.6; border: 2px solid rgba(255,255,255,0.6); }
    .document { background: rgba(255,255,255,0.98); padding: 20px; border: 2px solid rgba(255,255,255,0.6); }
    .doc-title { font-weight: bold; margin-bottom: 10px; color: #A31D1D; display: flex; align-items: center; gap: 8px; }
    .comment { background: linear-gradient(135deg, rgba(216, 64, 64, 0.15) 0%, rgba(163, 29, 29, 0.10) 100%); padding: 20px; border: 2px solid rgba(216, 64, 64, 0.3); }
    .comment-title { font-weight: bold; margin-bottom: 10px; color: #D84040; }
    .link { background: linear-gradient(135deg, rgba(224, 242, 254, 0.95) 0%, rgba(219, 234, 254, 0.95) 100%); padding: 20px; border: 2px solid rgba(147, 197, 253, 0.5); }
    .link-title { font-weight: bold; margin-bottom: 10px; }
    .link a { color: #2563eb; text-decoration: none; }
    .link a:hover { text-decoration: underline; }
    .swatch { display: flex; }
    .swatch-h { flex-direction: row; }
    .swatch-v { flex-direction: column; }
    .swatch-color { flex: 1; }
    .audio-container { background: rgba(255,255,255,0.98); padding: 16px; }
    .audio-title { font-weight: 600; font-size: 12px; margin-bottom: 8px; color: #A31D1D; }
  </style>
</head>
<body>
  <h1>Moodart Board</h1>
  <div class="board">
    ${items.map(item => {
      if (item.type === 'image' && item.src) {
        return `<div class="item" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          <img src="${item.src}" alt="" />
        </div>`;
      } else if (item.type === 'video' && item.src) {
        return `<div class="item" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          <video controls src="${item.src}"></video>
        </div>`;
      } else if (item.type === 'audio' && item.src) {
        return `<div class="item audio-container" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          <div class="audio-title">${item.title || 'Audio'}</div>
          <audio controls src="${item.src}"></audio>
        </div>`;
      } else if (item.type === 'note') {
        return `<div class="item note" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          ${item.text || ''}
        </div>`;
      } else if (item.type === 'document') {
        return `<div class="item document" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          <div class="doc-title">${item.title || 'Document'}</div>
          <div>${item.text || ''}</div>
        </div>`;
      } else if (item.type === 'comment') {
        return `<div class="item comment" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          <div class="comment-title">Comment</div>
          <div>${item.text || ''}</div>
        </div>`;
      } else if (item.type === 'link') {
        return `<div class="item link" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          <div class="link-title">${item.title || 'Link'}</div>
          <a href="${item.url || '#'}" target="_blank">${item.url || ''}</a>
        </div>`;
      } else if (item.type === 'swatch') {
        return `<div class="item swatch swatch-${item.orientation === 'horizontal' ? 'h' : 'v'}" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px">
          ${item.colors.map(c => `<div class="swatch-color" style="background:${c}"></div>`).join('')}
        </div>`;
      }
      return '';
    }).join('\n')}
  </div>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moodart-board.html';
    a.click();
  };

  const setPaletteColor = (idx, color) => { 
    setPaletteStops((arr) => arr.map((c, i) => (i === idx ? color : c))); 
  };
  const addPaletteStop = () => setPaletteStops((a) => [...a, currentColor]);
  const removePaletteStop = (idx) => { 
    if (paletteStops.length > 1) setPaletteStops((a) => a.filter((_, i) => i !== idx)); 
  };
  const movePaletteStop = (idx, dir) => {
    if (dir === 'up' && idx > 0) {
      setPaletteStops(a => { const n = [...a]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; });
    } else if (dir === 'down' && idx < paletteStops.length - 1) {
      setPaletteStops(a => { const n = [...a]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; return n; });
    }
  };

  const onResize = (id, corner, dx, dy, origin) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      let { w, h, x, y } = it;
      const min = 60;
      w = Math.max(min, origin.w + dx);
      h = Math.max(min, origin.h + dy);
      return { ...it, w, h, x, y };
    }));
  };
  const { onHandleDown } = useResize(onResize);

  const bringToFront = (id) => {
    const maxZ = Math.max(...items.map(it => it.zIndex || 0));
    setItem(id, { zIndex: maxZ + 1 });
  };

  const toolbarButton = (icon, onClick, label, active = false) => (
    <button 
      title={label} 
      onClick={onClick} 
      className={`w-11 h-11 grid place-items-center rounded-xl border transition shadow-sm hover:scale-105 hover:shadow-md ${
        active 
          ? 'bg-red-100 border-red-300' 
          : 'border-neutral-200/60 bg-white hover:bg-neutral-50'
      }`}
    >
      {icon}
    </button>
  );

  const popRef = useRef(null);
  useOutsideClose(popRef, () => setPopover(null));

  const onBoardClick = (e) => {
    if (e.target.closest('.board-item')) return;
    setSelected(null);
    setPopover(null);
  };

  const sortedItems = [...items].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // FIXED: Document Tools funktionieren jetzt
  const applyDocumentFormat = (command, value = null) => {
    if (docEditorRef.current) {
      docEditorRef.current.focus();
      document.execCommand(command, false, value);
    }
  };

  return (
    <div 
      className="min-h-screen w-full text-neutral-900 overflow-hidden" 
      style={{ 
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
        background: 'white'
      }}
    >
      {}
      <div 
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 border-b border-neutral-200/30 shadow-sm"
        style={{ 
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-3">
        <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl" />
          <div className="text-2xl font-bold tracking-tight" style={{ color: PALETTE.red }}>Moodart</div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowDots(!showDots)}
            className={`w-10 h-10 grid place-items-center rounded-xl border transition shadow-sm hover:scale-105 ${
              showDots 
                ? 'bg-red-100 border-red-300' 
                : 'bg-white border-neutral-200 hover:bg-neutral-50'
            }`}
            title="Toggle grid"
          >
            <Grid3x3 className="w-5 h-5" style={{ color: PALETTE.darkRed }} />
          </button>
          <button 
            onClick={() => setPopover(p => p === 'export' ? null : 'export')} 
            className="inline-flex items-center gap-2 rounded-full px-5 h-10 text-white shadow-md hover:opacity-90 hover:scale-105 transition font-medium" 
            style={{ backgroundColor: PALETTE.red }}
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div 
        className="fixed left-4 top-20 bottom-4 w-16 flex flex-col items-center gap-3 px-3 py-4 rounded-2xl border border-neutral-200 shadow-xl z-20"
        style={{ background: 'white' }}
      >
        {toolbarButton(
          <MousePointer2 className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, 
          () => { setSelectMode(true); setSelected(null); }, 
          "Select Mode",
          selectMode
        )}
        {toolbarButton(<ImageIcon className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, () => { setPopover(null); addImage(); }, "Add image")}
        {toolbarButton(<TypeIcon className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, () => { setPopover(null); addNote(); }, "Add note")}
        {toolbarButton(<FileText className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, () => { setPopover(null); addDocument(); }, "Add document")}
        {toolbarButton(<MessageCircle className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, () => { setPopover(null); addComment(); }, "Add comment")}
        {toolbarButton(<LinkIcon className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, () => { setPopover(null); addLink(); }, "Add link")}
        {toolbarButton(<Music className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, addMusic, "Add music")}
        {toolbarButton(<Video className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, addVideo, "Add video")}
        
        <div className="relative">
          {toolbarButton(
            <PaletteIcon className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, 
            () => setPopover(p => p === 'color' ? null : 'color'), 
            "Color & Palettes"
          )}
          <span 
            className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full border-2 border-white shadow-md" 
            style={{ backgroundColor: currentColor }} 
          />
        </div>
        
        {toolbarButton(<Mic className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, () => setPopover(p => p === 'voice' ? null : 'voice'), "Voice note")}
        {toolbarButton(<Trash2 className="w-5 h-5" style={{ color: PALETTE.darkRed }} />, () => { setPopover(null); setConfirmClear(true); }, "Clear board")}
      </div>

      {/* Popovers */}
      {popover && (
        <div 
          ref={popRef} 
          className="fixed left-24 top-24 z-40 border border-white/40 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {popover === 'color' && (
            <div className="flex gap-0">
              <div className="p-6 border-r border-neutral-200/60" style={{ width: 220 }}>
                <div className="text-sm font-bold mb-4 tracking-wide" style={{ color: PALETTE.darkRed }}>Color Picker</div>
                <div className="relative w-40 h-40 mx-auto mb-4">
                  <div 
                    className="absolute inset-0 rounded-full shadow-xl"
                    style={{
                      background: `conic-gradient(
                        from 0deg,
                        #ff0000 0deg,
                        #ffff00 60deg,
                        #00ff00 120deg,
                        #00ffff 180deg,
                        #0000ff 240deg,
                        #ff00ff 300deg,
                        #ff0000 360deg
                      )`
                    }}
                  />
                  <input 
                    type="color" 
                    value={currentColor} 
                    onChange={(e) => setCurrentColor(e.target.value)} 
                    className="absolute inset-0 w-full h-full rounded-full cursor-pointer opacity-0"
                  />
                  <div 
                    className="absolute inset-6 rounded-full border-4 border-white shadow-inner"
                    style={{ backgroundColor: currentColor }}
                  />
                </div>
                <input 
                  type="text" 
                  value={currentColor.toUpperCase()} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setCurrentColor(val);
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 text-sm font-mono text-center focus:border-red-300 focus:outline-none transition shadow-sm"
                  placeholder="#000000"
                />
              </div>

              <div className="p-6" style={{ width: 260 }}>
                <div className="text-sm font-bold mb-4 tracking-wide" style={{ color: PALETTE.darkRed }}>Palette Generator</div>
                
                <div className="flex gap-2 mb-5">
                  <button 
                    onClick={() => setPaletteOrientation('horizontal')}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm hover:scale-105 ${
                      paletteOrientation === 'horizontal' 
                        ? 'bg-red-100 text-red-700 border-2 border-red-300' 
                        : 'bg-white border-2 border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Horizontal
                  </button>
                  <button 
                    onClick={() => setPaletteOrientation('vertical')}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm hover:scale-105 ${
                      paletteOrientation === 'vertical' 
                        ? 'bg-red-100 text-red-700 border-2 border-red-300' 
                        : 'bg-white border-2 border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Vertical
                  </button>
                </div>

                <div className="space-y-2 mb-5 max-h-52 overflow-y-auto pr-1">
                  {paletteStops.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div 
                        className="w-12 h-10 rounded-lg border-2 border-neutral-200 shadow-sm" 
                        style={{ backgroundColor: c }}
                      />
                      <div className="flex gap-1">
                        <button 
                          onClick={() => movePaletteStop(i, 'up')}
                          disabled={i === 0}
                          className="w-7 h-7 grid place-items-center rounded-lg border-2 border-neutral-200 hover:bg-neutral-50 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition shadow-sm"
                        >
                          ↑
                        </button>
                        <button 
                          onClick={() => movePaletteStop(i, 'down')}
                          disabled={i === paletteStops.length - 1}
                          className="w-7 h-7 grid place-items-center rounded-lg border-2 border-neutral-200 hover:bg-neutral-50 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition shadow-sm"
                        >
                          ↓
                        </button>
                        <button 
                          onClick={() => removePaletteStop(i)}
                          disabled={paletteStops.length === 1}
                          className="w-7 h-7 grid place-items-center rounded-lg border-2 border-neutral-200 hover:bg-red-50 hover:border-red-300 hover:text-red-600 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition shadow-sm"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={addPaletteStop}
                    className="px-3 py-2 rounded-lg border-2 border-neutral-200 text-xs font-semibold hover:bg-neutral-50 hover:scale-105 transition shadow-sm flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={addSwatch}
                    className="flex-1 px-3 py-2 rounded-lg text-white text-xs font-bold hover:opacity-90 hover:scale-105 transition shadow-md"
                    style={{ backgroundColor: PALETTE.red }}
                  >
                    Add to Board
                  </button>
                </div>
              </div>
            </div>
          )}

          {popover === 'music' && (
            <div className="p-6" style={{ width: 320 }}>
              <div className="text-sm font-bold mb-4 tracking-wide" style={{ color: PALETTE.darkRed }}>Add Music</div>
              <button 
                onClick={() => audioRef.current?.click()}
                className="w-full px-4 py-4 rounded-xl text-white text-sm font-bold hover:opacity-90 hover:scale-105 transition shadow-md flex items-center justify-center gap-3"
                style={{ backgroundColor: PALETTE.red }}
              >
                <Upload className="w-5 h-5" />
                Upload Audio File
              </button>
              <div className="mt-4 text-xs text-neutral-500 text-center">
                Supports MP3, WAV, OGG, M4A
              </div>
            </div>
          )}

          {popover === 'video' && (
            <div className="p-6" style={{ width: 320 }}>
              <div className="text-sm font-bold mb-4 tracking-wide" style={{ color: PALETTE.darkRed }}>Add Video</div>
              <button 
                onClick={() => videoRef.current?.click()}
                className="w-full px-4 py-4 rounded-xl text-white text-sm font-bold hover:opacity-90 hover:scale-105 transition shadow-md flex items-center justify-center gap-3"
                style={{ backgroundColor: PALETTE.red }}
              >
                <Upload className="w-5 h-5" />
                Upload Video File
              </button>
              <div className="mt-4 text-xs text-neutral-500 text-center">
                Supports MP4, WebM, MOV
              </div>
            </div>
          )}

          {popover === 'voice' && (
            <div className="p-6" style={{ width: 280 }}>
              <div className="text-sm font-bold mb-4 tracking-wide" style={{ color: PALETTE.darkRed }}>Voice Note</div>
              {recState === 'idle' && (
                <button 
                  className="w-full px-4 py-3.5 rounded-xl text-white text-sm font-bold hover:opacity-90 hover:scale-105 transition shadow-md"
                  style={{ backgroundColor: PALETTE.red }}
                  onClick={startRec}
                >
                  Start Recording
                </button>
              )}
              {recState === 'recording' && (
                <button 
                  className="w-full px-4 py-3.5 rounded-xl text-white text-sm font-bold hover:opacity-90 hover:scale-105 transition shadow-md animate-pulse"
                  style={{ backgroundColor: PALETTE.darkRed }}
                  onClick={stopRec}
                >
                  Stop & Add to Board
                </button>
              )}
              {recState === 'error' && (
                <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 text-xs font-medium">
                  {voiceError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Export dialog */}
      {popover === 'export' && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm grid place-items-center z-50" 
          onMouseDown={() => setPopover(null)}
        >
          <div 
            className="rounded-3xl p-8 shadow-2xl border border-white/40" 
            style={{ 
              width: 420,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(24px)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold mb-4 tracking-tight" style={{ color: PALETTE.darkRed }}>Export Board</div>
            
            <div className="mb-6">
              <div className="text-sm font-semibold mb-3">Export Size</div>
              <div className="grid grid-cols-2 gap-2">
                {['small', 'medium', 'large', 'original'].map(size => (
                  <button
                    key={size}
                    onClick={() => setExportSize(size)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      exportSize === size
                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                        : 'bg-white border-2 border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <button 
                className="w-full px-5 py-4 rounded-2xl border-2 border-neutral-200 hover:border-red-300 hover:bg-red-50/50 hover:scale-102 text-left transition group shadow-sm"
                onClick={() => exportAs('png')}
              >
                <div className="font-bold text-neutral-900 group-hover:text-red-700 transition">PNG</div>
                <div className="text-xs text-neutral-500 mt-0.5">High quality image</div>
              </button>
              <button 
                className="w-full px-5 py-4 rounded-2xl border-2 border-neutral-200 hover:border-red-300 hover:bg-red-50/50 hover:scale-102 text-left transition group shadow-sm"
                onClick={() => exportAs('jpg')}
              >
                <div className="font-bold text-neutral-900 group-hover:text-red-700 transition">JPG</div>
                <div className="text-xs text-neutral-500 mt-0.5">Compressed image</div>
              </button>
              <button 
                className="w-full px-5 py-4 rounded-2xl border-2 border-neutral-200 hover:border-red-300 hover:bg-red-50/50 hover:scale-102 text-left transition group shadow-sm"
                onClick={() => exportAs('pdf')}
              >
                <div className="font-bold text-neutral-900 group-hover:text-red-700 transition">PDF</div>
                <div className="text-xs text-neutral-500 mt-0.5">Print to save as PDF</div>
              </button>
              <button 
                className="w-full px-5 py-4 rounded-2xl border-2 border-neutral-200 hover:border-red-300 hover:bg-red-50/50 hover:scale-102 text-left transition group shadow-sm"
                onClick={() => exportAs('html')}
              >
                <div className="font-bold text-neutral-900 group-hover:text-red-700 transition">Interactive HTML</div>
                <div className="text-xs text-neutral-500 mt-0.5">With video & audio support</div>
              </button>
            </div>
            <button 
              className="w-full mt-5 px-4 py-3 rounded-xl border-2 border-neutral-200 text-sm font-semibold hover:bg-neutral-50 hover:scale-102 transition shadow-sm"
              onClick={() => setPopover(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Board */}
      <div 
        className="fixed left-20 right-0 top-16 bottom-0 overflow-hidden"
        onMouseDown={onBoardClick}
        onWheel={onWheel}
        style={{
          background: showDots ? `${DOT_BG.backgroundImage}, white` : 'white',
          backgroundSize: showDots ? DOT_BG.backgroundSize : undefined,
          backgroundPosition: showDots ? DOT_BG.backgroundPosition : undefined,
        }}
      >
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          <button 
            className="w-11 h-11 rounded-xl border border-white/40 shadow-lg hover:bg-white/90 hover:scale-105 transition grid place-items-center"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
            }}
            onClick={zoomOut}
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <div 
            className="px-4 h-11 rounded-xl border border-white/40 shadow-lg grid place-items-center text-sm font-bold min-w-[80px]"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {Math.round(zoom * 100)}%
          </div>
          
          <button 
            className="w-11 h-11 rounded-xl border border-white/40 shadow-lg hover:bg-white/90 hover:scale-105 transition grid place-items-center"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
            }}
            onClick={zoomIn}
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          
          <button 
            className="w-11 h-11 rounded-xl border border-white/40 shadow-lg hover:bg-white/90 hover:scale-105 transition grid place-items-center"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
            }}
            onClick={resetView}
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        <div 
          className="absolute inset-0" 
          onMouseDown={beginPan}
          style={{ cursor: panning.current ? 'grabbing' : 'default', zIndex: 1 }} 
        />

        <div 
          ref={boardRef} 
          className="absolute left-1/2 top-1/2 pointer-events-none" 
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
            transformOrigin: '0 0',
            zIndex: 2
          }}
        >
          <div 
            className="relative pointer-events-auto board-container" 
            style={{ width: 6000, height: 4000 }}
          >
            {sortedItems.map((item) => (
              <BoardItem
                key={item.id}
                item={item}
                selected={selected === item.id}
                onMouseDown={(e) => { 
                  e.stopPropagation();
                  setSelected(item.id); 
                  bringToFront(item.id);
                  onMouseDown(e, item); 
                }}
                onDoubleClick={() => {
                  if (item.type === 'document') {
                    setExpandedDoc(item.id);
                  }
                }}
                setItem={setItem}
                remove={() => removeItem(item.id)}
                onHandleDown={(e, id, corner) => onHandleDown(e, id, corner, { w: item.w, h: item.h, x: item.x, y: item.y })}
              />
            ))}
          </div>
        </div>
      </div>

      <input 
        ref={fileRef} 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={onPickImage}
      />
      
      <input 
        ref={audioRef} 
        type="file" 
        accept="audio/*" 
        className="hidden" 
        onChange={onPickAudio}
      />

      <input 
        ref={videoRef} 
        type="file" 
        accept="video/*" 
        className="hidden" 
        onChange={onPickVideo}
      />

      {}
      {expandedDoc && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center z-50 p-8" 
          onMouseDown={() => setExpandedDoc(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-white/40 w-full max-w-5xl h-[85vh] flex overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="w-16 border-r border-neutral-200 flex flex-col items-center gap-2 p-3 bg-neutral-50/50 overflow-y-auto">
              <button 
                onClick={() => applyDocumentFormat('bold')}
                className="w-11 h-11 rounded-xl border border-neutral-200 hover:bg-white hover:border-red-300 hover:scale-105 transition grid place-items-center flex-shrink-0" 
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-5 h-5" />
              </button>
              <button 
                onClick={() => applyDocumentFormat('italic')}
                className="w-11 h-11 rounded-xl border border-neutral-200 hover:bg-white hover:border-red-300 hover:scale-105 transition grid place-items-center flex-shrink-0" 
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-5 h-5" />
              </button>
              <button 
                onClick={() => applyDocumentFormat('underline')}
                className="w-11 h-11 rounded-xl border border-neutral-200 hover:bg-white hover:border-red-300 hover:scale-105 transition grid place-items-center flex-shrink-0" 
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
                <input
                  type="text"
                  value={items.find(it => it.id === expandedDoc)?.title || ''}
                  onChange={(e) => setItem(expandedDoc, { title: e.target.value })}
                  className="text-2xl font-bold outline-none flex-1"
                  placeholder="Document Title"
                />
                <button
                  onClick={() => setExpandedDoc(null)}
                  className="w-10 h-10 rounded-xl hover:bg-neutral-100 hover:scale-105 grid place-items-center transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-8 overflow-y-auto">
                <div
                  ref={docEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setItem(expandedDoc, { text: e.currentTarget.innerHTML })}
                  dangerouslySetInnerHTML={{ __html: items.find(it => it.id === expandedDoc)?.text || '' }}
                  className="w-full h-full outline-none text-base leading-relaxed"
                  style={{ 
                    minHeight: '100%', 
                    direction: 'ltr',
                    textAlign: 'left',
                    unicodeBidi: 'plaintext',
                    writingMode: 'horizontal-tb'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmClear && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm grid place-items-center z-50" 
          onMouseDown={() => setConfirmClear(false)}
        >
          <div 
            className="rounded-3xl p-8 shadow-2xl border border-white/40" 
            style={{ 
              width: 420,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(24px)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold mb-3 tracking-tight" style={{ color: PALETTE.darkRed }}>Clear Board?</div>
            <div className="text-sm text-neutral-600 mb-6 leading-relaxed">
              This will remove all elements from the board. This action cannot be undone.
            </div>
            <div className="flex justify-end gap-3">
              <button 
                className="px-5 h-11 rounded-xl border-2 border-neutral-200 text-sm font-bold hover:bg-neutral-50 hover:scale-105 transition shadow-sm"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
              <button 
                className="px-5 h-11 rounded-xl text-white text-sm font-bold hover:opacity-90 hover:scale-105 transition shadow-md"
                style={{ backgroundColor: PALETTE.red }}
                onClick={() => {
                  setItems([]);
                  setSelected(null);
                  setConfirmClear(false);
                }}
              >
                Clear Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoardItem({ item, selected, onMouseDown, onDoubleClick, setItem, remove, onHandleDown }) {
  const [isEditing, setIsEditing] = useState(false);
  const style = { 
    transform: `translate(${item.x}px, ${item.y}px)`,
    zIndex: item.zIndex || 0
  };

  const ResizeHandle = () => (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onHandleDown(e, item.id, 'se'); }}
      className={`absolute w-7 h-7 rounded-full bg-white border-2 shadow-lg transition-all cursor-se-resize ${
        selected ? 'opacity-100 scale-100 border-red-400' : 'opacity-0 scale-0 border-neutral-300'
      }`}
      style={{ 
        bottom: '-12px', 
        right: '-12px',
        zIndex: 100 
      }}
    >
      <div className="absolute inset-0 grid place-items-center text-red-400 text-xs font-bold">⤡</div>
    </div>
  );

  const deleteBtn = selected ? (
    <button
      onClick={(e) => { e.stopPropagation(); remove(); }}
      className="absolute w-9 h-9 rounded-full grid place-items-center text-white shadow-xl hover:scale-110 transition z-50"
      style={{ 
        top: '-12px',
        right: '-12px',
        backgroundColor: PALETTE.red 
      }}
    >
      <X className="w-5 h-5 font-bold" />
    </button>
  ) : null;

  if (item.type === "image") {
    return (
      <div 
        style={style} 
        onMouseDown={onMouseDown}
        className="absolute cursor-move select-none board-item"
      >
        {}
        {deleteBtn}
        <ResizeHandle />
        <div 
          className={`relative rounded-2xl overflow-hidden shadow-xl ring-2 transition-all ${
            selected ? "ring-red-400 ring-4" : "ring-white/60"
          }`} 
          style={{ 
            width: item.w, 
            height: item.h,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {item.src ? (
            <img src={item.src} alt="" draggable={false} className="w-full h-full object-cover" />
          ) : (
            <div 
              className="w-full h-full grid place-items-center text-neutral-400 text-sm font-medium"
              style={{ backgroundColor: PALETTE.cream }}
            >
              Click to select image...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (item.type === "note") {
    return (
      <div 
        style={style} 
        onMouseDown={(e) => { if (!isEditing) onMouseDown(e); }}
        className="absolute board-item"
      >
        <div 
          className={`relative rounded-2xl shadow-xl ring-2 transition-all p-5 ${
            selected ? "ring-red-400 ring-4" : "ring-white/60"
          }`}
          style={{ 
            width: item.w, 
            height: item.h,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            cursor: isEditing ? 'text' : 'move'
          }}
        >
          {deleteBtn}
          <ResizeHandle />
          <textarea
            value={item.text}
            onChange={(e) => setItem(item.id, { text: e.target.value })}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            onMouseDown={(e) => {if (isEditing) e.stopPropagation();}}
            placeholder="Start typing..."
            className="w-full h-full bg-transparent outline-none resize-none text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 placeholder:italic"
          />
        </div>
      </div>
    );
  }

  if (item.type === "document") {
    const displayText = item.text.replace(/<[^>]*>/g, '');
    const preview = displayText.length > 60 ? displayText.substring(0, 60) + '...' : displayText;
    
    return (
      <div 
        style={style} 
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        className="absolute cursor-move select-none board-item"
      >
        {deleteBtn}
        <ResizeHandle />
        <div 
          className={`relative rounded-2xl shadow-xl ring-2 transition-all p-5 overflow-hidden ${
            selected ? "ring-red-400 ring-4" : "ring-white/60"
          }`}
          style={{ 
            width: item.w, 
            height: item.h,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5" style={{ color: PALETTE.darkRed }} />
            <div className="text-sm font-bold truncate flex-1">{item.title}</div>
          </div>
          <div className="text-xs text-neutral-500 leading-relaxed overflow-hidden" style={{ maxHeight: 'calc(100% - 40px)' }}>
            {preview || "Double-click to edit..."}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "comment") {
    return (
      <div 
        style={style} 
        onMouseDown={(e) => { if (!isEditing) onMouseDown(e); }}
        className="absolute board-item"
      >
        <div 
          className={`relative rounded-2xl shadow-xl ring-2 transition-all p-5 ${
            selected ? "ring-red-400 ring-4" : "ring-red-300/60"
          }`}
          style={{ 
            width: item.w, 
            height: item.h,
            background: 'linear-gradient(135deg, rgba(216, 64, 64, 0.15) 0%, rgba(163, 29, 29, 0.10) 100%)',
            backdropFilter: 'blur(20px)',
            cursor: isEditing ? 'text' : 'move'
          }}
        >
          {deleteBtn}
          <ResizeHandle />
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5" style={{ color: PALETTE.red }} />
            <div className="text-sm font-bold" style={{ color: PALETTE.darkRed }}>Comment</div>
          </div>
          <textarea
            value={item.text}
            onChange={(e) => setItem(item.id, { text: e.target.value })}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            onMouseDown={(e) => {if (isEditing) e.stopPropagation();}}
            placeholder="Add a comment..."
            className="w-full bg-transparent outline-none resize-none text-sm leading-relaxed placeholder:text-red-400/50 placeholder:italic"
            style={{ height: 'calc(100% - 35px)', color: PALETTE.darkRed }}
          />
        </div>
      </div>
    );
  }

  if (item.type === "link") {
    return (
      <div 
        style={style} 
        onMouseDown={onMouseDown}
        className="absolute cursor-move select-none board-item"
      >
        <div 
          className={`relative rounded-2xl shadow-xl ring-2 transition-all p-5 ${
            selected ? "ring-red-400 ring-4" : "ring-blue-300/60"
          }`}
          style={{ 
            width: item.w, 
            height: item.h,
            background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.95) 0%, rgba(219, 234, 254, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {deleteBtn}
          <ResizeHandle />
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="w-5 h-5" style={{ color: PALETTE.darkRed }} />
            <input
              type="text"
              value={item.title}
              onChange={(e) => setItem(item.id, { title: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Link title"
              className="flex-1 bg-transparent outline-none text-sm font-bold placeholder:text-blue-400/70 placeholder:italic"
            />
          </div>
          <input
            type="url"
            value={item.url}
            onChange={(e) => setItem(item.id, { url: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="https://..."
            className="w-full bg-blue-100/60 rounded-lg px-3 py-2 text-xs outline-none placeholder:text-blue-400/70 shadow-sm"
          />
        </div>
      </div>
    );
  }

  if (item.type === "swatch") {
    return (
      <div 
        style={style} 
        onMouseDown={onMouseDown}
        className="absolute cursor-move select-none board-item"
      >
        {deleteBtn}
        <ResizeHandle />
        <div 
          className={`relative rounded-2xl overflow-hidden shadow-xl ring-2 transition-all ${
            selected ? "ring-red-400 ring-4" : "ring-white/60"
          }`} 
          style={{ 
            width: item.w, 
            height: item.h,
            display: 'flex',
            flexDirection: item.orientation === 'horizontal' ? 'row' : 'column'
          }}
        >
          {item.colors.map((c, i) => (
            <div 
              key={i} 
              style={{ 
                background: c, 
                flex: 1
              }} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (item.type === "audio") {
    return (
      <div 
        style={style} 
        onMouseDown={onMouseDown}
        className="absolute cursor-move select-none board-item"
      >
        <div 
          className={`relative rounded-2xl ring-2 transition-all shadow-xl p-4 ${
            selected ? "ring-red-400 ring-4" : "ring-white/60"
          }`} 
          style={{ 
            width: item.w, 
            height: item.h,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {deleteBtn}
          <ResizeHandle />
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4" style={{ color: PALETTE.darkRed }} />
            <div className="text-xs font-semibold truncate">{item.title}</div>
          </div>
          <audio src={item.src} controls className="w-full" onMouseDown={(e) => e.stopPropagation()} />
        </div>
      </div>
    );
  }

  if (item.type === "video") {
    return (
      <div 
        style={style} 
        onMouseDown={onMouseDown}
        className="absolute cursor-move select-none board-item"
      >
        {deleteBtn}
        <ResizeHandle />
        <div 
          className={`relative rounded-2xl ring-2 transition-all shadow-xl overflow-hidden ${
            selected ? "ring-red-400 ring-4" : "ring-white/60"
          }`} 
          style={{ 
            width: item.w, 
            height: item.h,
            background: 'rgba(0, 0, 0, 0.95)',
          }}
        >
          <video 
            src={item.src} 
            controls 
            className="w-full h-full object-contain"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    );
  }

  return null;
}