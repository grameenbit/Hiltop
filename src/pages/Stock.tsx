import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { StockItem } from '../lib/db';
import { Plus, X, Package, Loader2, Trash2, QrCode, ArrowLeft, Download } from 'lucide-react';
import { getCachedData, setCachedData, enqueueSyncAction, executeOrEnqueue } from '../lib/sync';
import { useAuth } from '../App';
import ConfirmModal from '../components/ConfirmModal';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';

interface CustomLiveScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

const CustomLiveScanner: React.FC<CustomLiveScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [retryCounter, setRetryCounter] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let streamToClose: MediaStream | null = null;

    const startCamera = async () => {
      setCameraLoading(true);
      setErrorMsg(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraLoading(false);
        setErrorMsg("আপনার ব্রাউজারে বা অ্যাপে ভিডিও ক্যামেরা সাপোর্ট পাওয়া যায়নি। ক্যামেরা ব্যবহারের জন্য অবশ্যই HTTPS বা লোকাল কানেকশন প্রয়োজন।");
        return;
      }

      let stream: MediaStream | null = null;
      let lastError: any = null;

      // Request camera with back-camera preference directly in one single flow
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
      } catch (err: any) {
        console.warn("Could not start with environmental camera directly, trying simple fallback:", err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (fallbackErr: any) {
          console.error("Simple camera fallback failed too:", fallbackErr);
          lastError = fallbackErr;
        }
      }

      if (!stream) {
        setCameraLoading(false);
        const errStr = lastError ? (lastError.message || lastError.name || String(lastError)) : 'Unknown Error';
        if (errStr.toLowerCase().includes('permission') || errStr.toLowerCase().includes('denied') || errStr.toLowerCase().includes('notallowed')) {
          setErrorMsg("ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি। দয়া করে আপনার ব্রাউজারের অ্যাড্রেস বারের বাম পাশে থাকা Lock (তালা) বা Settings আইকনটিতে ক্লিক করুন এবং Camera পারমিশনটি 'Allow' করে দিন।");
        } else {
          setErrorMsg(`ক্যামেরা চালু করা যাচ্ছে না। ত্রুটি: ${errStr}`);
        }
        return;
      }

      streamToClose = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.error("Video play error:", playErr);
        }
        setCameraLoading(false);
        tick();
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current || document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            onScan(code.data);
            return;
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (streamToClose) {
        streamToClose.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan, retryCounter]);

  return (
    <div className="flex flex-col h-full bg-black relative justify-center items-center">
      {cameraLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black z-20">
          <Loader2 className="animate-spin text-[#1aaa55]" size={36} />
          <p className="text-sm font-medium text-gray-400">ক্যামেরা চালু করা হচ্ছে...</p>
        </div>
      )}

      {errorMsg ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-6 text-center bg-zinc-950/95 z-30 overflow-y-auto py-8">
          <div className="bg-red-500/10 p-4 rounded-full text-red-500 mb-3 border border-red-500/20">
            <X size={32} />
          </div>
          <h3 className="font-bold text-lg mb-2 text-red-500">ক্যামেরা অ্যাক্সেস ব্লক করা আছে</h3>
          
          <div className="text-xs text-gray-300 leading-relaxed mb-6 max-w-xs space-y-2">
            <p>
              আইফ্রেম বা প্রিভিউ ফ্রেমের ভেতরে ব্রাউজার সিকিউরিটির কারণে সরাসরি ক্যামেরা অন করা সম্ভব হচ্ছে না।
            </p>
            <p className="text-[#1aaa55] font-semibold bg-[#1aaa55]/10 py-1.5 px-3 rounded-lg border border-[#1aaa55]/20">
              নিচের নীল বাটনে ক্লিক করে নতুন ট্যাবে ওপেন করলেই ক্যামেরা পারমিশন বক্স আসবে এবং ক্যামেরা কাজ করবে!
            </p>
          </div>

          <a 
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-3 px-4 rounded-2xl mb-3 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
          >
            <span>নতুন ট্যাবে ওপেন করুন (Open in New Tab)</span>
          </a>
          
          <button 
            type="button"
            onClick={() => setRetryCounter(prev => prev + 1)}
            className="w-full max-w-xs bg-zinc-800 hover:bg-zinc-700 text-gray-200 text-xs font-bold py-3 px-4 rounded-2xl mb-6 transition-all active:scale-95"
          >
            আবার চেষ্টা করুন (Retry Access)
          </button>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 max-w-xs text-left text-[11px] text-gray-400 space-y-3">
            <div>
              <strong className="text-white">১. ওয়েবসাইট / ব্রাউজারে চালুর নিয়ম:</strong>
              <p className="mt-1">
                - নতুন ট্যাবে লিংকটি ওপেন হওয়ার পর ব্রাউজারের উপরে থাকা <strong>🔒 (তালা / Lock)</strong> আইকনটিতে ক্লিক করুন।
                <br />
                - সেখান থেকে <strong>Camera</strong> এর অনুমতিটি <strong>'Allow'</strong> করে দিন এবং পেজটি রিলোড করুন।
              </p>
            </div>
            <div className="border-t border-white/10 pt-2">
              <strong className="text-white">২. মোবাইলে / APK তে সঠিক নিয়ম:</strong>
              <p className="mt-1">
                - ফোনের <strong>Settings &gt; Apps &gt; ClothShop</strong> এ যান।
                <br />
                - <strong>Permissions</strong> এ ক্লিক করে <strong>Camera</strong> Access কে <strong>Allow</strong> করুন।
                <br />
                - অ্যাপটিকে সম্পূর্ণ রিস্টার্ট করুন।
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover" 
            playsInline 
            muted
          />
          {/* Scanning Target Box */}
          <div className="absolute inset-x-8 top-12 bottom-12 pointer-events-none border-[3px] border-[#1aaa55] rounded-3xl z-10 animate-pulse flex items-center justify-center">
            <div className="w-12 h-12 border-t-4 border-l-4 border-white absolute top-0 left-0 rounded-tl-xl"></div>
            <div className="w-12 h-12 border-t-4 border-r-4 border-white absolute top-0 right-0 rounded-tr-xl"></div>
            <div className="w-12 h-12 border-b-4 border-l-4 border-white absolute bottom-0 left-0 rounded-bl-xl"></div>
            <div className="w-12 h-12 border-b-4 border-r-4 border-white absolute bottom-0 right-0 rounded-br-xl"></div>
          </div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur text-white font-bold py-1.5 px-6 rounded-full text-[10px] tracking-wider animate-bounce">
            QR কোডটি লাল বাক্সের মাঝে রাখুন
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default function Stock() {
  const { isAdmin } = useAuth();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStock();
    const handleSync = () => fetchStock();
    window.addEventListener('sync_completed', handleSync);
    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('sync_completed', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('item_name', { ascending: true });
      
      if (error) {
        if (!navigator.onLine || error.message.includes('fetch')) throw new Error('Offline');
        throw error;
      };
      
      setStockItems(data || []);
      setCachedData('stock', data);
    } catch (err) {
      console.error('Error fetching stock:', err);
      const cached = getCachedData<StockItem>('stock');
      setStockItems(cached);
    } finally {
      setLoading(false);
    }
  };

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [selectedQrItem, setSelectedQrItem] = useState<StockItem | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedQrItem) {
      // Let the canvas render first, then convert it to an image URL
      const timer = setTimeout(() => {
        const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
        if (canvas) {
          try {
            setQrImageUrl(canvas.toDataURL('image/png'));
          } catch (e) {
            console.error('Error generating image URL for QR code:', e);
          }
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setQrImageUrl(null);
    }
  }, [selectedQrItem]);

  const downloadQRCode = () => {
    if (!selectedQrItem) return;
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      try {
        const url = canvas.toDataURL('image/png');
        const filename = `${selectedQrItem.item_name.replace(/\s+/g, '_')}_qr.png`;
        
        if ((window as any).AndroidInterface && (window as any).AndroidInterface.downloadBase64Image) {
          (window as any).AndroidInterface.downloadBase64Image(url, filename);
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (err) {
        console.error("Direct DataURL download failed:", err);
      }
    }
  };

  // Form states
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  const openAddModal = () => {
    setItemName('');
    setQuantity('');
    setPrice('');
    setIsAddOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setSelectedItem(item);
    setItemName(item.item_name);
    setQuantity(item.quantity.toString());
    setPrice(item.price.toString());
    setIsEditOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !quantity || !price) return;

    try {
      const payload: any = {
        item_name: itemName,
        quantity: parseInt(quantity),
        price: parseFloat(price),
        business_id: 'temp-id'
      };

      if (isEditOpen && selectedItem) {
        await executeOrEnqueue(
          { type: 'update', table: 'stock', payload, match: { id: selectedItem.id } },
          () => {
            const updated = stockItems.map(i => i.id === selectedItem.id ? { ...i, ...payload } as StockItem : i);
            setStockItems(updated);
            setCachedData('stock', updated);
          },
          fetchStock
        );
      } else {
        payload.id = crypto.randomUUID();
        await executeOrEnqueue(
          { type: 'insert', table: 'stock', payload },
          () => {
            const updated = [{ ...payload } as StockItem, ...stockItems];
            setStockItems(updated);
            setCachedData('stock', updated);
          },
          fetchStock
        );
      }

      setIsAddOpen(false);
      setIsEditOpen(false);
    } catch (err: any) {
      console.error('Failed to save stock item:', err);
      if (err.message) {
         if (err.message.includes('stock') || err.code === 'PGRST204') {
            alert('Database Error: The "stock" table might be missing. Please create it in Supabase.');
         }
      }
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      if (typeof id === 'string' && id.startsWith('temp-')) {
         const updated = stockItems.filter(i => i.id !== id);
         setStockItems(updated);
         setCachedData('stock', updated);
         return; // Do not send delete to DB for temp items
      }
      await executeOrEnqueue(
        { type: 'delete', table: 'stock', payload: {}, match: { id } },
        () => {
          const updated = stockItems.filter(i => i.id !== id);
          setStockItems(updated);
          setCachedData('stock', updated);
        },
        fetchStock
      );
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Failed to delete item: ' + (err.message || 'Unknown error'));
    }
  };

  const handleScan = (detectedCodes: any[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const value = detectedCodes[0].rawValue;
      if (value) {
        setIsScannerOpen(false);
        const item = stockItems.find(i => i.id === value || i.item_name.toLowerCase() === value.toLowerCase());
        if (item) {
          openEditModal(item);
        } else {
          alert(`Item not found for QR code: ${value}`);
        }
      }
    }
  };

  const handleFileUploadScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            setIsScannerOpen(false);
            const value = code.data;
            const item = stockItems.find(i => i.id === value || i.item_name.toLowerCase() === value.toLowerCase());
            if (item) {
              openEditModal(item);
            } else {
              alert(`Item not found for QR code: ${value}`);
            }
          } else {
            alert('No QR code found in the image. Please try a different or clearer image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const requestCameraAndScan = () => {
    setIsScannerOpen(true);
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link to="/more" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-700 shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Stock Management</h2>
            <p className="text-sm text-gray-500">Track and manage inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={requestCameraAndScan}
             className="bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-100 transition-colors shadow-sm border border-blue-100"
           >
             <QrCode size={18} />
             <span className="hidden sm:inline">Scan</span>
           </button>
           <button 
             onClick={openAddModal}
             className="bg-[#1aaa55] text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 hover:bg-green-600 transition-colors shadow-sm"
           >
             <Plus size={18} />
             <span className="hidden sm:inline">New Item</span>
           </button>
        </div>
      </div>

      <div className="space-y-4 pb-24 relative">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#1aaa55]" size={32} />
          </div>
        ) : stockItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No stock items found.</p>
            <p className="text-sm text-gray-400 mt-1">Click New Item to add inventory.</p>
          </div>
        ) : (
          stockItems.map((item) => (
            <div 
              key={item.id} 
              className="w-full bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:border-[#1aaa55]/30 group"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-gray-900">{item.item_name}</h3>
                  {isAdmin && (
                    <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id!})} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-sm font-medium text-gray-500">
                     Stock: <span className={`font-bold ${item.quantity < 5 ? 'text-red-500' : 'text-gray-900'}`}>{item.quantity}</span>
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                     Price: <span className="font-bold text-[#1aaa55]">৳ {item.price}</span>
                  </p>
                </div>
              </div>
              <div className="text-right ml-4 flex flex-col gap-2">
                 <button 
                   onClick={() => setSelectedQrItem(item)}
                   className="bg-purple-50 px-4 py-2 rounded-xl text-purple-600 font-bold text-xs uppercase hover:bg-purple-100 transition-colors flex items-center justify-center gap-1"
                 >
                   <QrCode size={12} /> QR
                 </button>
                 <button 
                   onClick={() => openEditModal(item)}
                   className="bg-gray-50 px-4 py-2 rounded-xl text-gray-600 font-bold text-xs uppercase hover:bg-[#1aaa55] hover:text-white transition-colors"
                 >
                   Edit
                 </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col pt-10 px-4 pb-10">
           <div className="flex justify-between items-center mb-4 max-w-sm mx-auto w-full">
             <h2 className="text-white font-bold text-lg">Scan QR Code</h2>
             <button onClick={() => setIsScannerOpen(false)} className="bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center backdrop-blur">
               <X size={20} />
             </button>
           </div>
           <div className="flex-1 w-full max-w-sm mx-auto relative overflow-hidden rounded-3xl bg-black">
              <CustomLiveScanner
                  onScan={(value) => {
                     setIsScannerOpen(false);
                     const item = stockItems.find(i => i.id === value || i.item_name.toLowerCase() === value.toLowerCase());
                     if (item) {
                        openEditModal(item);
                     } else {
                        alert(`আইটেমটি পাওয়া যায়নি! QR কোডের মান: ${value}`);
                     }
                  }}
                  onClose={() => setIsScannerOpen(false)}
              />
           </div>
           <div className="text-center mt-6 text-white/70 max-w-sm mx-auto flex flex-col items-center gap-4">
             <p className="text-sm border-b border-white/20 pb-4">Point your camera at a stock item's QR code to quickly find and edit it.</p>
             <label className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors border border-white/30 text-white px-5 py-3 rounded-full cursor-pointer">
                <span className="font-bold text-sm">Scan from Image (Fallback)</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleFileUploadScan} 
                />
             </label>
           </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedQrItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedQrItem(null)} 
              className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 transition-colors"
            >
              <X size={16} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-6">{selectedQrItem.item_name}</h3>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm border border-gray-100 relative min-h-[234px] min-w-[234px]">
              {/* Render the canvas (hidden if image url is ready) to act as generator */}
              <div className={qrImageUrl ? 'hidden' : 'block'}>
                <QRCodeCanvas 
                  id="qr-canvas"
                  value={selectedQrItem.id || selectedQrItem.item_name} 
                  size={200}
                  level="H" 
                  includeMargin={true}
                />
              </div>
              {qrImageUrl && (
                <img 
                  src={qrImageUrl} 
                  alt="QR Code" 
                  className="w-[200px] h-[200px] mx-auto rounded-lg select-all cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            
            <button
              onClick={downloadQRCode}
              className="mt-6 w-full bg-[#1aaa55] text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 active:scale-95 transition-all shadow-md text-sm cursor-pointer"
            >
              <Download size={18} />
              QR Code ডাউনলোড করুন
            </button>

            <div className="text-left mt-5 bg-amber-50 p-4 rounded-2xl border border-amber-200/50">
              <p className="text-amber-800 text-[11px] leading-relaxed font-bold">
                ⚠️ মোবাইলে বা APK-তে ডাউনলোড বাটন কাজ না করলে:
              </p>
              <p className="text-amber-700 text-[10px] leading-relaxed mt-1">
                উপরের QR কোড ইমেজটির উপর <strong>কিছুক্ষণ চেপে ধরুন (Long Press করুন)</strong> এবং অপশনগুলো থেকে <strong>'Download link' / 'Save image' / 'ডাউনলোড ইমেজ'</strong> অপশনটি সিলেক্ট করুন।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl relative overflow-hidden animate-in sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{isEditOpen ? 'Edit Item' : 'New Stock Item'}</h2>
              <button 
                onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} 
                className="bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveItem} className="p-6 space-y-5">
              <div>
                <label className="block font-medium mb-1.5 text-sm text-gray-700">Item Name *</label>
                <input 
                  type="text" 
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. T-Shirt"
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1.5 text-sm text-gray-700">Quantity *</label>
                  <input 
                    type="number" 
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="100"
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-sm text-gray-700">Price (৳) *</label>
                  <input 
                    type="number" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="500"
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-[#1aaa55] text-white font-bold py-4 rounded-xl hover:bg-green-600 active:scale-[0.98] transition-all shadow-sm"
                >
                  {isEditOpen ? 'Save Changes' : 'Add to Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="Delete Stock Item"
        message="Are you sure you want to delete this class? This action cannot be undone."
        onConfirm={() => {
          if (deleteConfirm.id) handleDeleteItem(deleteConfirm.id);
        }}
        onCancel={() => setDeleteConfirm({isOpen: false, id: null})}
      />
    </div>
  );
}

