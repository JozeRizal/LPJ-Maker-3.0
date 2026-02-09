
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  PlusCircle, 
  Loader2,
  Sparkles,
  RefreshCcw,
  CheckCircle,
  Camera,
  Layers,
  Download,
  FileText,
  User,
  FileDown,
  FilePlus,
  Key,
  X,
  ClipboardList,
  Target,
  Clock,
  MapPin,
  Users,
  Settings2,
  AlertCircle,
  Lightbulb,
  ImageIcon,
  Upload,
  Lock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Transaction, TransactionType, ReportConfig, LPJData, ReportMode } from './types';
import { formatIDR, fileToBase64, generateId, toTitleCase } from './utils';
import { generateReportNarrative, analyzeReceipt } from './services/geminiService';
import { exportToWord } from './services/wordService';
import { exportToGoogleDocs } from './services/gdocService';

const STORAGE_KEY = 'lpj_master_v9';

// Define interface for platform API Key integration directly in the global scope augmentation
// to avoid modifier mismatch and type name collisions.
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  
  const [config, setConfig] = useState<ReportConfig>({
    reportMode: 'Cepat',
    reportTitle: 'LAPORAN PERTANGGUNGJAWABAN',
    eventName: '',
    organizationName: '',
    reportDate: new Date().toISOString().split('T')[0],
    location: '',
    chairpersonName: '',
    chairpersonTitle: 'Ketua Panitia',
    treasurerName: '',
    treasurerTitle: 'Bendahara',
    official3Name: '',
    official3Title: '',
    official4Name: '',
    official4Title: '',
    background: '',
    conclusion: '',
    tujuan: '',
    sasaran: '',
    waktuTempat: '',
    peserta: '',
    mekanisme: '',
    hasil: '',
    hambatan: '',
    saran: '',
    logoBase64: ''
  });

  const [newTx, setNewTx] = useState<{
    date: string;
    description: string;
    type: TransactionType;
    amount: string;
    receipt: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'Pengeluaran',
    amount: '',
    receipt: ''
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // Muat Data Aplikasi
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setConfig(prev => ({ ...prev, ...(parsed.config || {}) }));
      } catch (e) {}
    }
    
    // Cek status kunci API
    const checkStatus = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      }
    };
    checkStatus();
    
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, transactions }));
    }
  }, [config, transactions, hasLoaded]);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Asumsikan pemilihan berhasil sesuai panduan platform
      setHasApiKey(true);
      setIsKeyModalOpen(false);
    } else {
      alert("Fitur pemilihan kunci tidak tersedia di lingkungan ini.");
    }
  };

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;
    const tx: Transaction = {
      id: generateId(),
      date: newTx.date || new Date().toISOString().split('T')[0],
      description: toTitleCase(newTx.description),
      type: newTx.type,
      amount: Number(newTx.amount),
      manualNo: (transactions.length + 1).toString(),
      receiptBase64: newTx.receipt
    };
    setTransactions([...transactions, tx]);
    setNewTx({ ...newTx, description: '', amount: '', receipt: '' });
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsScanningAI(true);
      try {
        const base64 = await fileToBase64(file);
        const result = await analyzeReceipt(base64);
        if (result?.transactions) {
          const mapped = result.transactions.map((t: any, idx: number) => ({
            ...t,
            id: generateId(),
            amount: Number(t.amount),
            description: toTitleCase(t.description),
            manualNo: (transactions.length + idx + 1).toString(),
            receiptBase64: base64
          }));
          setTransactions(prev => [...prev, ...mapped]);
        }
      } catch (err: any) {
        if (err.message?.includes("Requested entity was not found")) {
           alert("Kunci API tidak valid atau belum dipilih. Silakan klik tombol KUNCI.");
           setHasApiKey(false);
           setIsKeyModalOpen(true);
        } else {
           alert("Gagal memproses nota. Pastikan gambar jelas.");
        }
      } finally {
        setIsScanningAI(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setConfig({ ...config, logoBase64: base64 });
      } catch (err) {
        alert("Gagal mengupload logo.");
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 1500));
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`LPJ_${config.eventName || 'Laporan'}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Gagal membuat PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const inputStyle = "w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400";
  const labelStyle = "text-[10px] font-bold text-slate-400 mb-1 block ml-1 uppercase tracking-wider";

  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    const months = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
  };

  const activeSigners = [
    { name: config.chairpersonName, title: config.chairpersonTitle || 'Ketua Panitia' },
    { name: config.treasurerName, title: config.treasurerTitle || 'Bendahara' },
    { name: config.official3Name, title: config.official3Title || 'Sekretaris' },
    { name: config.official4Name, title: config.official4Title || 'Mengetahui' }
  ].filter(s => s.name && s.name.trim() !== '');
  
  const displaySigners = activeSigners.length === 0 ? [
    { name: '', title: 'Ketua Panitia' },
    { name: '', title: 'Bendahara' }
  ] : activeSigners;

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      <nav className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-50 no-print">
        <div className="container mx-auto flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl"><FileText className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-black tracking-tight uppercase">LPJ <span className="text-blue-500">Master</span></h1>
          </div>
          <div className="flex gap-2">
            {/* Tombol Kunci Aktif sesuai screenshot user */}
            <button 
              onClick={() => setIsKeyModalOpen(true)}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-sm border active:scale-95 ${hasApiKey ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-amber-900/30 border-amber-500/50 text-amber-400'}`}
            >
              <Key className={`w-4 h-4 ${hasApiKey ? 'text-emerald-400' : 'text-amber-400'}`} /> 
              <span>{hasApiKey ? 'KUNCI AKTIF' : 'INPUT KUNCI'}</span>
            </button>
            
            <button onClick={handleDownloadPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
            </button>
            <button onClick={() => confirm('Hapus semua data?') && (setTransactions([]), setConfig({...config, logoBase64: '', background: '', conclusion: '', eventName: '', organizationName: '', reportTitle: 'LAPORAN PERTANGGUNGJAWABAN'}))} className="bg-slate-800 hover:bg-red-600 p-2.5 rounded-xl transition-colors border border-slate-700 shadow-lg active:scale-95 transition-all">
              <RefreshCcw className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </nav>

      {/* Modal Pengaturan Kunci */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-slate-800 flex items-center gap-2"><Lock className="w-5 h-5 text-blue-600"/> PENGATURAN API KEY</h3>
              <button onClick={() => setIsKeyModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
            </div>
            <div className="p-8 space-y-4">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                  Untuk mengaktifkan fitur AI (Scan Nota & Narasi), Anda perlu menghubungkan kunci API Gemini Anda. Kunci ini tersimpan aman di browser Anda.
                </p>
              </div>
              <div className="pt-4">
                <button 
                  onClick={handleOpenKeySelector} 
                  className="w-full px-6 py-4 rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Key className="w-5 h-5" /> INPUT / PILIH API KEY
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 pt-4 uppercase font-bold tracking-widest">
                Dapatkan key di <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500 underline">Google AI Studio</a>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 max-w-6xl py-8 space-y-8 no-print">
        {/* Mode Switch */}
        <div className="flex justify-center">
          <div className="bg-slate-200 p-1.5 rounded-2xl flex gap-1 shadow-inner">
            <button 
              onClick={() => setConfig({...config, reportMode: 'Cepat'})}
              className={`px-8 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${config.reportMode === 'Cepat' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Clock className="w-4 h-4" /> MODE LPJ CEPAT
            </button>
            <button 
              onClick={() => setConfig({...config, reportMode: 'Lengkap'})}
              className={`px-8 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${config.reportMode === 'Lengkap' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ClipboardList className="w-4 h-4" /> MODE LPJ LENGKAP
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border-b-8 border-emerald-500 p-6 rounded-3xl shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Pemasukan (+)</p>
            <p className="text-3xl font-black text-emerald-600">{formatIDR(totalIncome)}</p>
          </div>
          <div className="bg-white border-b-8 border-rose-500 p-6 rounded-3xl shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Pengeluaran (-)</p>
            <p className="text-3xl font-black text-rose-600">{formatIDR(totalExpense)}</p>
          </div>
          <div className="bg-blue-900 p-6 rounded-3xl shadow-xl text-white">
            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Saldo Akhir</p>
            <p className="text-3xl font-black">{formatIDR(balance)}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800"><Layers className="text-blue-600 w-6 h-6" /> 1. Data Kegiatan</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div className="md:col-span-2">
                  <label className={labelStyle}>Judul Dokumen (Misal: Laporan Pertanggungjawaban)</label>
                  <input type="text" value={config.reportTitle} onChange={e => setConfig({...config, reportTitle: e.target.value})} className={inputStyle} placeholder="LAPORAN PERTANGGUNGJAWABAN" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelStyle}>Nama Kegiatan (Wajib)</label>
                  <input type="text" value={config.eventName} onChange={e => setConfig({...config, eventName: e.target.value})} className={inputStyle} placeholder="Contoh: HUT RI Ke-79" />
                </div>
                <div>
                  <label className={labelStyle}>Nama Organisasi (Opsional)</label>
                  <input type="text" value={config.organizationName} onChange={e => setConfig({...config, organizationName: e.target.value})} className={inputStyle} placeholder="Contoh: Karang Taruna RW 05" />
                </div>
                <div>
                  <label className={labelStyle}>Tanggal Laporan</label>
                  <input type="date" value={config.reportDate} onChange={e => setConfig({...config, reportDate: e.target.value})} className={inputStyle} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelStyle}>Logo Organisasi / Kegiatan</label>
                  <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    {config.logoBase64 ? (
                      <div className="relative group">
                        <img src={config.logoBase64} className="w-16 h-16 object-contain rounded-lg border bg-white p-1" />
                        <button 
                          onClick={() => setConfig({...config, logoBase64: ''})}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-2">Upload logo dalam format PNG/JPG untuk cover dan kop.</p>
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      <button 
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-2 bg-white border-2 border-slate-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all"
                      >
                        <Upload className="w-3 h-3" /> PILIH LOGO
                      </button>
                    </div>
                  </div>
                </div>
                {config.reportMode === 'Lengkap' && (
                  <div className="md:col-span-2">
                    <label className={labelStyle}>Lokasi Pelaksanaan (Cover)</label>
                    <input type="text" value={config.location} onChange={e => setConfig({...config, location: e.target.value})} className={inputStyle} placeholder="Contoh: Jakarta Pusat, 2024" />
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 md:col-span-2">
                   <p className="text-xs font-black text-slate-500 mb-4 flex items-center gap-2"><User className="w-3 h-3"/> PENANDATANGAN</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                      <div className="space-y-2">
                        <label className={labelStyle}>Jabatan 1</label>
                        <input type="text" value={config.chairpersonTitle} onChange={e => setConfig({...config, chairpersonTitle: e.target.value})} className={inputStyle} placeholder="Ketua Panitia" />
                        <label className={labelStyle}>Nama Pejabat 1</label>
                        <input type="text" value={config.chairpersonName} onChange={e => setConfig({...config, chairpersonName: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                      <div className="space-y-2">
                        <label className={labelStyle}>Jabatan 2</label>
                        <input type="text" value={config.treasurerTitle} onChange={e => setConfig({...config, treasurerTitle: e.target.value})} className={inputStyle} placeholder="Bendahara" />
                        <label className={labelStyle}>Nama Pejabat 2</label>
                        <input type="text" value={config.treasurerName} onChange={e => setConfig({...config, treasurerName: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                      <div className="space-y-2">
                        <label className={labelStyle}>Jabatan 3 (Opsional)</label>
                        <input type="text" value={config.official3Title} onChange={e => setConfig({...config, official3Title: e.target.value})} className={inputStyle} placeholder="Sekretaris" />
                        <label className={labelStyle}>Nama Pejabat 3</label>
                        <input type="text" value={config.official3Name} onChange={e => setConfig({...config, official3Name: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                      <div className="space-y-2">
                        <label className={labelStyle}>Jabatan 4 (Opsional)</label>
                        <input type="text" value={config.official4Title} onChange={e => setConfig({...config, official4Title: e.target.value})} className={inputStyle} placeholder="Mengetahui" />
                        <label className={labelStyle}>Nama Pejabat 4</label>
                        <input type="text" value={config.official4Name} onChange={e => setConfig({...config, official4Name: e.target.value})} className={inputStyle} placeholder="Nama Lengkap" />
                      </div>
                   </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800"><PlusCircle className="text-blue-600 w-6 h-6" /> 2. Detail Keuangan</h2>
                <div className="flex gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleScanReceipt} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isScanningAI} className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-md transition-all active:scale-95">
                    {isScanningAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />} SCAN NOTA (AI)
                  </button>
                </div>
              </div>
              <form onSubmit={addTransaction} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-8 bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="md:col-span-3"><input type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} className={`${inputStyle} bg-white`} /></div>
                <div className="md:col-span-4"><input type="text" placeholder="Keterangan" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} className={`${inputStyle} bg-white`} /></div>
                <div className="md:col-span-3"><input type="number" placeholder="Nominal" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} className={`${inputStyle} bg-white`} /></div>
                <div className="md:col-span-2"><button type="submit" className="w-full h-full bg-slate-900 text-white rounded-xl font-bold hover:bg-blue-600 shadow-lg py-3">Tambah</button></div>
                <div className="md:col-span-12">
                   <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value as any})} className="w-full p-2 text-xs font-bold uppercase text-slate-600 bg-white border-b border-slate-300 outline-none rounded-t-lg">
                    <option value="Pengeluaran">PENGELUARAN (Kredit)</option>
                    <option value="Pemasukan">PEMASUKAN (Debit)</option>
                  </select>
                </div>
              </form>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left min-w-[800px] bg-white">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-base uppercase border-b">
                    <tr>
                      <th className="p-4 w-16 text-center bg-white">NO</th>
                      <th className="p-4 w-32 bg-white">TGL</th>
                      <th className="p-4 bg-white">KETERANGAN</th>
                      <th className="p-4 w-32 text-right bg-white">DEBIT</th>
                      <th className="p-4 w-32 text-right bg-white">KREDIT</th>
                      <th className="p-4 w-10 bg-white"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 bg-white">
                    {transactions.length === 0 ? (
                      <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic bg-white">Belum ada data.</td></tr>
                    ) : (
                      transactions.map((t, i) => (
                        <tr key={t.id} className="hover:bg-slate-50 bg-white">
                          <td className="p-2 bg-white border-b border-slate-100">
                            <input type="text" value={t.manualNo || (i + 1)} onChange={e => updateTransaction(t.id, { manualNo: e.target.value })} className="w-full p-2 text-center text-base border-none outline-none focus:ring-0 bg-white text-slate-900 font-normal" />
                          </td>
                          <td className="p-2 bg-white border-b border-slate-100">
                            <input type="date" value={t.date} onChange={e => updateTransaction(t.id, { date: e.target.value })} className="w-full p-2 text-base border-none outline-none bg-white text-slate-900 font-normal" />
                          </td>
                          <td className="p-2 bg-white border-b border-slate-100">
                            <input type="text" value={t.description} onChange={e => updateTransaction(t.id, { description: e.target.value })} className="w-full p-2 text-base border-none outline-none font-normal bg-white text-slate-900" />
                          </td>
                          <td className="p-2 bg-white border-b border-slate-100">
                            <input type="number" value={t.type === 'Pemasukan' ? t.amount : ''} placeholder="0" onChange={e => updateTransaction(t.id, { amount: Number(e.target.value), type: 'Pemasukan' })} className="w-full p-2 text-base border-none outline-none text-right text-emerald-600 font-normal bg-white" />
                          </td>
                          <td className="p-2 bg-white border-b border-slate-100">
                            <input type="number" value={t.type === 'Pengeluaran' ? t.amount : ''} placeholder="0" onChange={e => updateTransaction(t.id, { amount: Number(e.target.value), type: 'Pengeluaran' })} className="w-full p-2 text-base border-none outline-none text-right text-rose-600 font-normal bg-white" />
                          </td>
                          <td className="p-2 text-center bg-white border-b border-slate-100">
                            <button onClick={() => setTransactions(transactions.filter(x => x.id !== t.id))} className="text-slate-300 hover:text-red-500 bg-transparent p-2 rounded-lg transition-colors">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className={`bg-white p-8 rounded-3xl shadow-sm border-2 ${config.reportMode === 'Cepat' ? 'border-blue-100' : 'border-emerald-100'}`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-xl font-bold flex items-center gap-2 ${config.reportMode === 'Cepat' ? 'text-blue-700' : 'text-emerald-700'}`}>
                  <Sparkles className="w-6 h-6" /> {config.reportMode === 'Cepat' ? 'AI Narasi Cepat' : 'AI Narasi Lengkap'}
                </h2>
                <button 
                  onClick={async () => {
                    if (transactions.length === 0) return;
                    setIsGeneratingAI(true);
                    try {
                      const res = await generateReportNarrative({ config, transactions });
                      if (res) {
                        if (config.reportMode === 'Cepat') {
                          setConfig(prev => ({...prev, background: res.background || prev.background, conclusion: res.conclusion || prev.conclusion}));
                        } else {
                          setConfig(prev => ({
                            ...prev, 
                            background: res.background || prev.background, 
                            conclusion: res.conclusion || prev.conclusion,
                            tujuan: res.tujuan || prev.tujuan,
                            sasaran: res.sasaran || prev.sasaran,
                            waktuTempat: res.waktuTempat || prev.waktuTempat,
                            peserta: res.peserta || prev.peserta,
                            mekanisme: res.mekanisme || prev.mekanisme,
                            hasil: res.hasil || prev.hasil,
                            hambatan: res.hambatan || prev.hambatan,
                            saran: res.saran || prev.saran
                          }));
                        }
                      }
                    } catch (err: any) {
                      if (err.message?.includes("Requested entity was not found")) {
                        alert("API Key bermasalah atau belum dipilih. Silakan hubungkan KUNCI Anda.");
                        setHasApiKey(false);
                      } else {
                        alert("AI gagal memproses narasi. Pastikan data terisi.");
                      }
                    } finally {
                      setIsGeneratingAI(false);
                    }
                  }} 
                  disabled={isGeneratingAI || transactions.length === 0} 
                  className={`${config.reportMode === 'Cepat' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50`}
                >
                  {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : 'GENERASI AI'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelStyle}>I. Latar Belakang</label>
                  <textarea value={config.background} onChange={e => setConfig({...config, background: e.target.value})} className={`${inputStyle} h-32 resize-none text-sm`} />
                </div>

                {config.reportMode === 'Lengkap' && (
                  <>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className={labelStyle}>I. Tujuan Kegiatan</label>
                        <textarea value={config.tujuan} onChange={e => setConfig({...config, tujuan: e.target.value})} className={`${inputStyle} h-20 resize-none text-sm`} />
                      </div>
                      <div>
                        <label className={labelStyle}>I. Sasaran / Target</label>
                        <textarea value={config.sasaran} onChange={e => setConfig({...config, sasaran: e.target.value})} className={`${inputStyle} h-20 resize-none text-sm`} />
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <label className={labelStyle}>II. Waktu & Tempat</label>
                      <textarea value={config.waktuTempat} onChange={e => setConfig({...config, waktuTempat: e.target.value})} className={`${inputStyle} h-20 resize-none text-sm`} />
                    </div>
                    <div>
                      <label className={labelStyle}>II. Peserta & Mekanisme</label>
                      <textarea value={config.mekanisme} onChange={e => setConfig({...config, mekanisme: e.target.value})} className={`${inputStyle} h-24 resize-none text-sm`} />
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <label className={labelStyle}>IV. Hasil & Evaluasi</label>
                      <textarea value={config.hasil} onChange={e => setConfig({...config, hasil: e.target.value})} className={`${inputStyle} h-20 resize-none text-sm`} placeholder="Hasil Kegiatan" />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className={labelStyle}>IV. Hambatan</label>
                        <textarea value={config.hambatan} onChange={e => setConfig({...config, hambatan: e.target.value})} className={`${inputStyle} h-20 resize-none text-sm`} />
                      </div>
                      <div>
                        <label className={labelStyle}>IV. Saran Perbaikan</label>
                        <textarea value={config.saran} onChange={e => setConfig({...config, saran: e.target.value})} className={`${inputStyle} h-20 resize-none text-sm`} />
                      </div>
                    </div>
                  </>
                )}

                <div className="border-t border-slate-100 pt-4">
                  <label className={labelStyle}>Penutup</label>
                  <textarea value={config.conclusion} onChange={e => setConfig({...config, conclusion: e.target.value})} className={`${inputStyle} h-24 resize-none text-sm`} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Preview Dokumen */}
      <div className="bg-slate-700 py-20 flex justify-center overflow-x-auto no-print">
        <div ref={reportRef} className="a4-preview flex flex-col shadow-2xl bg-white !text-slate-900">
          {config.reportMode === 'Lengkap' && (
            <div className="flex flex-col items-center justify-center text-center min-h-[900px] mb-20 border-b-2 border-slate-100 pb-20">
               {config.logoBase64 && (
                 <img src={config.logoBase64} className="w-40 h-40 object-contain mb-12" alt="Logo Cover" />
               )}
               <h1 className="text-3xl font-bold uppercase tracking-[0.2em] mb-4">{config.reportTitle || 'LAPORAN PERTANGGUNGJAWABAN'}</h1>
               <h2 className="text-5xl font-black text-blue-900 mt-4 uppercase leading-tight max-w-2xl">{config.eventName || '[NAMA KEGIATAN]'}</h2>
               <div className="w-32 h-1 bg-blue-900 my-10"></div>
               {config.organizationName && <p className="text-2xl font-bold uppercase text-slate-700">{config.organizationName}</p>}
               <div className="mt-auto">
                  <p className="text-xl font-bold uppercase tracking-widest">{config.location || '[LOKASI & TAHUN]'}</p>
               </div>
            </div>
          )}

          <div className="border-b-4 border-double border-black pb-8 mb-12 flex items-center gap-6">
            {config.logoBase64 && (
              <img src={config.logoBase64} className="w-24 h-24 object-contain" alt="Logo Kop" />
            )}
            <div className={`flex-1 ${config.logoBase64 ? 'text-left' : 'text-center'}`}>
              <h1 className="text-xl font-bold uppercase underline tracking-wider">{config.reportTitle || 'LAPORAN PERTANGGUNGJAWABAN'}</h1>
              <h2 className="text-4xl font-black text-blue-900 mt-2 uppercase leading-none">{config.eventName || '[NAMA KEGIATAN]'}</h2>
              {config.organizationName && <p className="text-xl font-bold uppercase text-slate-700 mt-2">{config.organizationName}</p>}
              <p className="text-xs mt-4 font-mono font-bold bg-slate-100 py-1 px-4 inline-block rounded-full border border-slate-200">TANGGAL LAPORAN: {config.reportDate}</p>
            </div>
          </div>

          {/* Bab I: Pendahuluan */}
          <div className="mb-10 px-4">
            <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase">I. PENDAHULUAN</h3>
            <div className="space-y-4 text-base leading-relaxed text-justify">
              <p className="font-bold underline mb-1">1.1 Latar Belakang</p>
              <p className="whitespace-pre-wrap">{config.background || 'Belum diisi.'}</p>
              {config.reportMode === 'Lengkap' && (
                <>
                  <p className="font-bold underline mt-4 mb-1">1.2 Tujuan Kegiatan</p>
                  <p className="whitespace-pre-wrap">{config.tujuan || '-'}</p>
                  <p className="font-bold underline mt-4 mb-1">1.3 Sasaran / Target</p>
                  <p className="whitespace-pre-wrap">{config.sasaran || '-'}</p>
                </>
              )}
            </div>
          </div>

          {/* Bab II: Pelaksanaan (Mode Lengkap) */}
          {config.reportMode === 'Lengkap' && (
            <div className="mb-10 px-4">
              <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase">II. PELAKSANAAN KEGIATAN</h3>
              <div className="space-y-4 text-base leading-relaxed text-justify">
                <p className="font-bold underline mb-1">2.1 Waktu dan Tempat</p>
                <p className="whitespace-pre-wrap">{config.waktuTempat || '-'}</p>
                <p className="font-bold underline mt-4 mb-1">2.2 Mekanisme Kegiatan</p>
                <p className="whitespace-pre-wrap">{config.mekanisme || '-'}</p>
              </div>
            </div>
          )}

          {/* Bab III: Keuangan */}
          <div className="mb-10 px-4">
            <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-6 uppercase">
              {config.reportMode === 'Cepat' ? 'II. RINCIAN ANGGARAN KEUANGAN' : 'III. LAPORAN KEUANGAN'}
            </h3>
            <table className="w-full border-collapse border-2 border-black text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border-2 border-black p-3 text-center w-12 font-bold !text-slate-900">No</th>
                  <th className="border-2 border-black p-3 text-center w-32 font-bold !text-slate-900">Tanggal</th>
                  <th className="border-2 border-black p-3 text-left font-bold !text-slate-900">Deskripsi Transaksi</th>
                  <th className="border-2 border-black p-3 text-right font-bold !text-slate-900">Debit (Masuk)</th>
                  <th className="border-2 border-black p-3 text-right font-bold !text-slate-900">Kredit (Keluar)</th>
                </tr>
              </thead>
              <tbody className="!text-slate-900">
                {transactions.length > 0 ? transactions.map((t, i) => (
                  <tr key={t.id} style={{ minHeight: '40px' }} className="!text-slate-900">
                    <td className="border border-black p-2.5 text-center align-middle !text-slate-900">{t.manualNo || (i + 1)}</td>
                    <td className="border border-black p-2.5 text-center font-mono align-middle !text-slate-900">{t.date}</td>
                    <td className="border border-black p-2.5 font-medium align-middle !text-slate-900">{t.description}</td>
                    <td className="border border-black p-2.5 text-right align-middle !text-slate-900">{t.type === 'Pemasukan' ? formatIDR(t.amount) : '-'}</td>
                    <td className="border border-black p-2.5 text-right align-middle !text-slate-900">{t.type === 'Pengeluaran' ? formatIDR(t.amount) : '-'}</td>
                  </tr>
                )) : (
                   <tr><td colSpan={5} className="border border-black p-10 text-center italic text-slate-400">Belum ada transaksi terekam.</td></tr>
                )}
              </tbody>
              <tfoot className="font-bold border-2 border-black">
                <tr className="bg-slate-100">
                  <td colSpan={3} className="border border-black p-3 text-right uppercase text-sm !text-slate-900">Subtotal Kas</td>
                  <td className="border border-black p-3 text-right text-sm font-bold !text-slate-900">{formatIDR(totalIncome)}</td>
                  <td className="border border-black p-3 text-right text-sm font-bold !text-slate-900">{formatIDR(totalExpense)}</td>
                </tr>
                <tr className="bg-blue-900 text-white">
                  <td colSpan={3} className="p-4 text-right uppercase tracking-widest text-sm font-bold">Saldo Akhir Panitia</td>
                  <td colSpan={2} className="p-4 text-center text-2xl font-black">{formatIDR(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bab IV: Evaluasi & Penutup */}
          <div className="mb-12 px-4">
            <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase">
              {config.reportMode === 'Cepat' ? 'III. PENUTUP' : 'IV. EVALUASI DAN PENUTUP'}
            </h3>
            <div className="space-y-4 text-base leading-relaxed text-justify">
              {config.reportMode === 'Lengkap' && (
                <>
                  <p className="font-bold underline mb-1">4.1 Hasil Kegiatan</p>
                  <p className="whitespace-pre-wrap">{config.hasil || '-'}</p>
                  <p className="font-bold underline mt-4 mb-1">4.2 Hambatan / Kendala</p>
                  <p className="whitespace-pre-wrap">{config.hambatan || '-'}</p>
                  <p className="font-bold underline mt-4 mb-1">4.3 Saran / Rekomendasi</p>
                  <p className="whitespace-pre-wrap">{config.saran || '-'}</p>
                  <p className="font-bold underline mt-4 mb-1">4.4 Penutup</p>
                </>
              )}
              <p className="whitespace-pre-wrap">{config.conclusion || 'Belum diisi.'}</p>
            </div>
          </div>

          {/* Tanda Tangan */}
          <div className="mt-auto pt-16 pb-12 px-4">
            <p className="text-center font-bold text-sm uppercase mb-12">MENGETAHUI,</p>
            <div className={`grid gap-10 text-center ${displaySigners.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
              {displaySigners.map((signer, idx) => (
                <div key={idx} className="flex flex-col">
                  <p className="text-sm font-bold mb-28 uppercase leading-tight h-10">{signer.title}</p>
                  <p className="font-bold underline text-lg whitespace-nowrap">{signer.name || '....................'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Lampiran */}
          {transactions.some(t => t.receiptBase64) && (
            <div className="mt-20 pt-20 border-t-4 border-double border-slate-400 px-4 page-break-before">
              <h3 className="text-center font-bold text-3xl mb-12 uppercase underline tracking-widest">LAMPIRAN BUKTI TRANSAKSI</h3>
              <div className="grid grid-cols-2 gap-10">
                {Array.from(new Set(transactions.map(t => t.receiptBase64).filter(Boolean))).map((img, idx) => {
                  const relatedTx = transactions.find(t => t.receiptBase64 === img);
                  const displayDate = relatedTx ? formatIndonesianDate(relatedTx.date) : '';
                  return (
                    <div key={idx} className="border-2 border-slate-100 p-5 rounded-3xl bg-white flex flex-col items-center shadow-sm">
                      <img src={img!} className="max-h-[400px] object-contain mb-4 rounded-xl shadow-md" alt="Nota" />
                      <p className="text-xs text-slate-400 font-black uppercase tracking-tighter text-center">BUKTI TRANSAKSI {displayDate}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
