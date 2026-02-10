
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, PlusCircle, Loader2, Sparkles, RefreshCcw, Camera, Layers, 
  Download, FileText, Key, X, Keyboard, FileDown, Users, Lock, Target, Clock, MapPin, Lightbulb, Save, ShieldCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Transaction, TransactionType, ReportConfig, ReportMode } from './types';
import { formatIDR, fileToBase64, generateId, toTitleCase } from './utils';
import { generateReportNarrative, analyzeReceipt } from './services/geminiService';

const STORAGE_KEY = 'lpj_master_v10';
const API_KEY_STORAGE = 'user_manual_api_key';

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>('');
  
  const [config, setConfig] = useState<ReportConfig>({
    reportMode: 'Lengkap',
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
    official3Title: 'Sekretaris',
    official4Name: '',
    official4Title: 'Mengetahui',
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
  }>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'Pengeluaran',
    amount: ''
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setConfig(prev => ({ ...prev, ...(parsed.config || {}) }));
      } catch (e) {}
    }
    
    const key = localStorage.getItem(API_KEY_STORAGE);
    if (key && key.trim() !== '') {
      setHasApiKey(true);
      setTempApiKey(key);
    }
    
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (hasLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, transactions }));
  }, [config, transactions, hasLoaded]);

  const handleSaveKey = () => {
    if (tempApiKey.trim() === '') {
      alert("Silakan masukkan API Key Gemini Anda.");
      return;
    }
    localStorage.setItem(API_KEY_STORAGE, tempApiKey.trim());
    setHasApiKey(true);
    setShowKeyModal(false);
    alert("API Key berhasil disimpan.");
  };

  const handleRemoveKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setHasApiKey(false);
    setTempApiKey('');
    alert("API Key dihapus.");
  };

  const handleResetData = () => {
    if (confirm('Hapus seluruh data laporan ini?')) {
      setTransactions([]);
      setConfig({
        reportMode: 'Lengkap', reportTitle: 'LAPORAN PERTANGGUNGJAWABAN', eventName: '', organizationName: '', reportDate: new Date().toISOString().split('T')[0], location: '', chairpersonName: '', chairpersonTitle: 'Ketua Panitia', treasurerName: '', treasurerTitle: 'Bendahara', official3Name: '', official3Title: 'Sekretaris', official4Name: '', official4Title: 'Mengetahui', background: '', conclusion: '', tujuan: '', sasaran: '', waktuTempat: '', peserta: '', mekanisme: '', hasil: '', hambatan: '', saran: '', logoBase64: ''
      });
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setConfig({ ...config, logoBase64: base64 });
    }
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningAI(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await analyzeReceipt(base64);
      if (result?.transactions) {
        const mapped = result.transactions.map((t: any, idx: number) => ({
          ...t, id: generateId(), manualNo: (transactions.length + idx + 1).toString(), receiptBase64: base64
        }));
        setTransactions(prev => [...prev, ...mapped]);
      }
    } catch (err: any) { alert("Gagal scan nota. Pastikan API Key valid."); } 
    finally { setIsScanningAI(false); }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    const scrollY = window.scrollY;
    
    try {
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 1200));
      
      const element = reportRef.current;
      const pageHeightPx = 1122; 
      const topPagePadding = 60; 

      element.querySelectorAll('.pdf-spacer').forEach(s => s.remove());

      const getAbsoluteTop = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        const rootRect = element.getBoundingClientRect();
        return rect.top - rootRect.top;
      };

      const injectSpacer = (target: HTMLElement, h: number) => {
        if (h <= 5) return;
        const s = document.createElement('div');
        s.className = 'pdf-spacer';
        s.style.height = `${h}px`;
        s.style.width = '100%';
        s.style.display = 'block';
        s.style.clear = 'both';
        s.style.visibility = 'hidden';
        target.parentNode?.insertBefore(s, target);
      };

      const injectTableSpacer = (targetTr: HTMLTableRowElement, h: number) => {
        if (h <= 5) return;
        const sTr = document.createElement('tr');
        sTr.className = 'pdf-spacer';
        const sTd = document.createElement('td');
        sTd.colSpan = 10;
        sTd.style.height = `${h}px`;
        sTd.style.border = 'none';
        sTr.appendChild(sTd);
        targetTr.parentNode?.insertBefore(sTr, targetTr);
      };

      const breakPoints = ['.keuangan-start', '.penutup-start', '.signature-start', '.lampiran-start'];
      breakPoints.forEach(sel => {
        const el = element.querySelector(sel) as HTMLElement;
        if (!el) return;
        const currentTop = getAbsoluteTop(el);
        if (currentTop % pageHeightPx > 5) {
            const pageIdx = Math.floor(currentTop / pageHeightPx);
            const pageBottom = (pageIdx + 1) * pageHeightPx;
            const gapToNextPage = pageBottom - currentTop;
            injectSpacer(el, gapToNextPage + topPagePadding);
        }
      });

      const subItems = Array.from(element.querySelectorAll('.pdf-text-block p.font-bold, table tbody tr, .receipt-card')) as HTMLElement[];
      subItems.forEach(el => {
        const top = getAbsoluteTop(el);
        const h = el.offsetHeight;
        const pageIdx = Math.floor(top / pageHeightPx);
        const pageBottom = (pageIdx + 1) * pageHeightPx;
        if (top + h > pageBottom - 60) {
          const gapToNextPage = pageBottom - top;
          if (el.tagName === 'TR') {
            injectTableSpacer(el as HTMLTableRowElement, gapToNextPage + topPagePadding);
          } else {
            injectSpacer(el, gapToNextPage + topPagePadding);
          }
        }
      });

      await new Promise(r => setTimeout(r, 2200));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollY: 0,
        scrollX: 0,
        x: 0,
        y: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      element.querySelectorAll('.pdf-spacer').forEach(s => s.remove());

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      let heightRemaining = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightRemaining -= pdfHeight;

      while (heightRemaining > 2) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightRemaining -= pdfHeight;
      }
      
      pdf.save(`LPJ_${config.eventName || 'Laporan'}.pdf`);
    } catch (err) { alert("Gagal memproses PDF."); } 
    finally { window.scrollTo(0, scrollY); setIsExporting(false); }
  };

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;
    setTransactions([...transactions, {
      id: generateId(), date: newTx.date, description: toTitleCase(newTx.description), type: newTx.type, amount: Number(newTx.amount), manualNo: (transactions.length + 1).toString()
    }]);
    setNewTx({ ...newTx, description: '', amount: '' });
  };

  const totalIncome = transactions.filter(t => t.type === 'Pemasukan').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'Pengeluaran').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const uniqueReceipts = Array.from(new Map(transactions.filter(t => t.receiptBase64).map(t => [t.receiptBase64, t])).values());
  const activeSigners = [{ name: config.chairpersonName, title: config.chairpersonTitle }, { name: config.treasurerName, title: config.treasurerTitle }, { name: config.official3Name, title: config.official3Title }, { name: config.official4Name, title: config.official4Title }].filter(s => s.name && s.name.trim() !== '');

  const inputStyle = "w-full p-3 border-2 border-slate-200 rounded-xl bg-white focus:border-blue-500 outline-none transition-all text-sm";
  const labelStyle = "text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-20">
      {/* Modal API Key */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-slate-900 p-8 text-white relative">
              <button onClick={() => setShowKeyModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                <Key className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Set Gemini API Key</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Masukkan API Key Gemini Anda untuk mengaktifkan fitur scan nota dan generate narasi otomatis oleh AI.</p>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className={labelStyle}>API Key (Sk-xxxx...)</label>
                <input 
                  type="password" 
                  placeholder="Paste API Key di sini" 
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className={inputStyle} 
                />
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold mt-2 block hover:underline">Dapatkan Kunci di Google AI Studio →</a>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSaveKey}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> SIMPAN KUNCI
                </button>
                {hasApiKey && (
                  <button 
                    onClick={handleRemoveKey}
                    className="w-full bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> HAPUS KUNCI
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-50 no-print">
        <div className="container mx-auto flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl"><FileText className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-black tracking-tight uppercase text-white">LPJ MASTER</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowKeyModal(true)} 
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 border text-[11px] transition-all ${hasApiKey ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/50 text-amber-400 bg-amber-500/10 animate-pulse'}`}
            >
              <Key className="w-4 h-4" /> {hasApiKey ? 'KUNCI AKTIF' : 'ISI API KEY'}
            </button>
            <button onClick={handleDownloadPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 text-xs">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
            </button>
            <button onClick={handleResetData} className="bg-slate-800 hover:bg-red-600 p-2.5 rounded-xl border border-slate-700 shadow-lg active:scale-95 transition-all group">
              <RefreshCcw className="w-5 h-5 text-white group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 max-w-6xl py-8 space-y-8 no-print">
        <div className="flex justify-center">
          <div className="bg-slate-200 p-1.5 rounded-2xl flex gap-1 shadow-inner">
            <button onClick={() => setConfig({...config, reportMode: 'Cepat'})} className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${config.reportMode === 'Cepat' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>LPJ CEPAT</button>
            <button onClick={() => setConfig({...config, reportMode: 'Lengkap'})} className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${config.reportMode === 'Lengkap' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500'}`}>LPJ LENGKAP</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800"><Layers className="text-blue-600 w-6 h-6" /> 1. Data Dasar & Kop</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><label className={labelStyle}>Judul Dokumen</label><input type="text" value={config.reportTitle} onChange={e => setConfig({...config, reportTitle: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Nama Kegiatan</label><input type="text" value={config.eventName} onChange={e => setConfig({...config, eventName: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Organisasi</label><input type="text" value={config.organizationName} onChange={e => setConfig({...config, organizationName: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Tanggal Laporan</label><input type="date" value={config.reportDate} onChange={e => setConfig({...config, reportDate: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Lokasi & Tahun</label><input type="text" value={config.location} placeholder="Contoh: Jakarta, 2024" onChange={e => setConfig({...config, location: e.target.value})} className={inputStyle} /></div>
                <div className="md:col-span-2"><button onClick={() => logoInputRef.current?.click()} className="w-full py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold uppercase hover:bg-blue-50">Upload Logo Kop</button><input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} /></div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800"><Lightbulb className="text-amber-500 w-6 h-6" /> 2. Narasi & Isi Laporan</h2>
                <button onClick={async () => {
                  if(!hasApiKey) { setShowKeyModal(true); return; }
                  setIsGeneratingAI(true);
                  try {
                    const res = await generateReportNarrative({ config, transactions });
                    if (res) setConfig(prev => ({...prev, ...res}));
                  } catch (e: any) { alert("AI Gagal memproses narasi."); } 
                  finally { setIsGeneratingAI(false); }
                }} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-colors">
                  {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} GENERATE AI
                </button>
              </div>
              <div className="space-y-6">
                <div><label className={labelStyle}>I. Latar Belakang</label><textarea value={config.background} onChange={e => setConfig({...config, background: e.target.value})} className={`${inputStyle} h-32`} /></div>
                {config.reportMode === 'Lengkap' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-l-4 border-emerald-100 pl-4">
                    <div><label className={labelStyle}>Tujuan Kegiatan</label><textarea value={config.tujuan} onChange={e => setConfig({...config, tujuan: e.target.value})} className={`${inputStyle} h-24`} /></div>
                    <div><label className={labelStyle}>Sasaran / Peserta</label><textarea value={config.sasaran} onChange={e => setConfig({...config, sasaran: e.target.value})} className={`${inputStyle} h-24`} /></div>
                    <div><label className={labelStyle}>Waktu & Tempat</label><textarea value={config.waktuTempat} onChange={e => setConfig({...config, waktuTempat: e.target.value})} className={`${inputStyle} h-24`} /></div>
                    <div><label className={labelStyle}>Mekanisme Acara</label><textarea value={config.mekanisme} onChange={e => setConfig({...config, mekanisme: e.target.value})} className={`${inputStyle} h-24`} /></div>
                    <div><label className={labelStyle}>Hasil Kegiatan</label><textarea value={config.hasil} onChange={e => setConfig({...config, hasil: e.target.value})} className={`${inputStyle} h-24`} /></div>
                    <div><label className={labelStyle}>Hambatan</label><textarea value={config.hambatan} onChange={e => setConfig({...config, hambatan: e.target.value})} className={`${inputStyle} h-24`} /></div>
                    <div><label className={labelStyle}>Saran / Rekomendasi</label><textarea value={config.saran} onChange={e => setConfig({...config, saran: e.target.value})} className={`${inputStyle} h-24`} /></div>
                  </div>
                )}
                <div><label className={labelStyle}>Kesimpulan & Penutup</label><textarea value={config.conclusion} onChange={e => setConfig({...config, conclusion: e.target.value})} className={`${inputStyle} h-24`} /></div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800"><PlusCircle className="text-blue-600 w-6 h-6" /> 3. Transaksi Keuangan</h2>
                <button onClick={() => { if(!hasApiKey) { setShowKeyModal(true); return; } fileInputRef.current?.click(); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-blue-200">
                  {isScanningAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4"/>} SCAN NOTA (AI)
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleScanReceipt} />
              </div>
              <form onSubmit={addTransaction} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-8 bg-slate-50 p-5 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="md:col-span-2"><label className={labelStyle}>Tanggal</label><input type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} className={inputStyle} /></div>
                <div className="md:col-span-2"><label className={labelStyle}>Jenis</label><select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value as TransactionType})} className={inputStyle}><option value="Pengeluaran">Keluar (-)</option><option value="Pemasukan">Masuk (+)</option></select></div>
                <div className="md:col-span-4"><label className={labelStyle}>Keterangan</label><input type="text" placeholder="Contoh: Konsumsi" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} className={inputStyle} /></div>
                <div className="md:col-span-3"><label className={labelStyle}>Nominal</label><input type="number" placeholder="Rp" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} className={inputStyle} /></div>
                <div className="md:col-span-1 flex items-end"><button type="submit" className="w-full bg-slate-900 text-white rounded-xl font-bold py-3 shadow-lg hover:bg-black transition-all">+</button></div>
              </form>
              <div className="overflow-hidden border border-slate-100 rounded-2xl">
                <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b"><tr><th className="p-4 w-12 text-center">No</th><th className="p-4 w-28 text-center">Tanggal</th><th className="p-4 w-28">Jenis</th><th className="p-4">Deskripsi</th><th className="p-4 text-right w-32">Nominal</th><th className="p-4 w-10"></th></tr></thead><tbody className="divide-y divide-slate-100">
                  {transactions.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-all"><td className="p-4 text-center text-slate-400 font-mono text-xs">{idx + 1}</td><td className="p-4 text-center text-slate-600 font-medium text-xs whitespace-nowrap">{t.date}</td><td className="p-4"><span className={`px-2 py-1 rounded-md text-[10px] font-black ${t.type === 'Pemasukan' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{t.type.toUpperCase()}</span></td><td className="p-4 font-medium text-slate-700">{t.description}</td><td className={`p-4 text-right font-mono font-bold ${t.type === 'Pemasukan' ? 'text-emerald-600' : 'text-slate-900'}`}>{t.type === 'Pemasukan' ? '+' : '-'}{formatIDR(t.amount)}</td><td className="p-4"><button onClick={() => setTransactions(transactions.filter(x => x.id !== t.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button></td></tr>
                  ))}
                  {transactions.length === 0 && (<tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Belum ada transaksi.</td></tr>)}
                </tbody></table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800"><Users className="text-blue-600 w-6 h-6" /> 4. Penandatangan</h2>
              <div className="space-y-4">
                <div><label className={labelStyle}>Ketua Panitia</label><input type="text" value={config.chairpersonName} onChange={e => setConfig({...config, chairpersonName: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Bendahara</label><input type="text" value={config.treasurerName} onChange={e => setConfig({...config, treasurerName: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Sekretaris</label><input type="text" value={config.official3Name} onChange={e => setConfig({...config, official3Name: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Mengetahui</label><input type="text" value={config.official4Name} onChange={e => setConfig({...config, official4Name: e.target.value})} className={inputStyle} /></div>
              </div>
            </section>
            <div className="bg-blue-900 p-8 rounded-3xl text-white shadow-2xl">
               <p className="text-xs font-bold opacity-70 tracking-widest mb-1 uppercase">TOTAL SALDO AKHIR</p>
               <h3 className="text-3xl font-black">{formatIDR(balance)}</h3>
               <div className="mt-4 pt-4 border-t border-blue-800 grid grid-cols-2 gap-2 text-[10px] font-bold">
                  <div className="text-emerald-400">MASUK: {formatIDR(totalIncome)}</div>
                  <div className="text-rose-400 text-right">KELUAR: {formatIDR(totalExpense)}</div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 py-20 flex flex-col items-center overflow-x-auto no-print">
         <div className="bg-amber-900/50 text-amber-200 px-6 py-3 rounded-full text-xs font-black flex items-center gap-3 mb-8 border border-amber-500/30 shadow-2xl">
            <Keyboard className="w-4 h-4" /> <span>EDITOR PREVIEW: KLIK TEKS UNTUK EDIT MANUAL SEBELUM PDF</span>
         </div>
         
         <div ref={reportRef} className="a4-preview flex flex-col shadow-2xl bg-white !text-slate-900">
            {config.reportMode === 'Lengkap' && (
              <div className="flex flex-col items-center justify-center text-center h-[1122px] mb-0 pb-20 pdf-section border-b-2 border-slate-100 overflow-hidden">
                 {config.logoBase64 && <img src={config.logoBase64} className="w-40 h-40 object-contain mb-12" alt="Logo" />}
                 <h1 className="text-3xl font-bold uppercase tracking-[0.2em] mb-4 text-black" contentEditable suppressContentEditableWarning>{config.reportTitle}</h1>
                 <h2 className="text-5xl font-black text-blue-900 mt-4 uppercase leading-tight max-w-2xl" contentEditable suppressContentEditableWarning>{config.eventName || '[NAMA KEGIATAN]'}</h2>
                 <div className="w-32 h-1 bg-blue-900 my-10"></div>
                 <p className="text-2xl font-bold uppercase text-slate-700" contentEditable suppressContentEditableWarning>{config.organizationName}</p>
                 <div className="mt-auto"><p className="text-xl font-bold uppercase tracking-widest text-black" contentEditable suppressContentEditableWarning>{config.location || '[LOKASI & TAHUN]'}</p></div>
              </div>
            )}

            <div className="border-b-4 border-double border-black pb-8 mb-12 flex items-center gap-6 pdf-section kop-section">
              {config.logoBase64 && <img src={config.logoBase64} className="w-24 h-24 object-contain" alt="Kop" />}
              <div className={`flex-1 ${config.logoBase64 ? 'text-left' : 'text-center'}`}>
                <h1 className="text-xl font-bold uppercase underline tracking-wider text-black" contentEditable suppressContentEditableWarning>{config.reportTitle}</h1>
                <h2 className="text-4xl font-black text-blue-900 mt-2 uppercase" contentEditable suppressContentEditableWarning>{config.eventName || '[NAMA KEGIATAN]'}</h2>
                {config.organizationName && <p className="text-xl font-bold uppercase text-slate-700 mt-2" contentEditable suppressContentEditableWarning>{config.organizationName}</p>}
                <p className="text-xs mt-4 font-mono font-bold bg-slate-100 py-1 px-4 inline-block rounded-full border border-slate-200 uppercase text-black">TANGGAL LAPORAN: {config.reportDate}</p>
              </div>
            </div>

            <div className="mb-10 px-4 pdf-section pdf-text-block" contentEditable suppressContentEditableWarning>
              <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase text-black">I. PENDAHULUAN</h3>
              <div className="space-y-4 text-base text-justify leading-relaxed text-black">
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

            {config.reportMode === 'Lengkap' && (
              <div className="mb-10 px-4 pdf-section pdf-text-block" contentEditable suppressContentEditableWarning>
                <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase text-black">II. PELAKSANAAN KEGIATAN</h3>
                <div className="space-y-4 text-base text-justify leading-relaxed text-black">
                  <p className="font-bold underline mb-1">2.1 Waktu dan Tempat</p>
                  <p className="whitespace-pre-wrap">{config.waktuTempat || '-'}</p>
                  <p className="font-bold underline mt-4 mb-1">2.2 Mekanisme Kegiatan</p>
                  <p className="whitespace-pre-wrap">{config.mekanisme || '-'}</p>
                </div>
              </div>
            )}

            <div className="mb-10 px-4 pdf-section keuangan-start">
              <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-6 uppercase text-black">
                {config.reportMode === 'Cepat' ? 'II. LAPORAN KEUANGAN' : 'III. LAPORAN KEUANGAN'}
              </h3>
              <table className="w-full border-collapse border-2 border-black text-sm text-black">
                <thead><tr className="bg-slate-100"><th className="border-2 border-black p-3 text-center w-12 font-bold">No</th><th className="border-2 border-black p-3 text-center w-28 font-bold">Tanggal</th><th className="border-2 border-black p-3 text-left font-bold">Deskripsi</th><th className="border-2 border-black p-3 text-right font-bold w-32">Masuk</th><th className="border-2 border-black p-3 text-right font-bold w-32">Keluar</th></tr></thead>
                <tbody contentEditable suppressContentEditableWarning>
                  {transactions.map((t, i) => (
                    <tr key={t.id} className="pdf-tr"><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2 text-center font-mono text-[10px]">{t.date}</td><td className="border border-black p-2 font-medium">{t.description}</td><td className="border border-black p-2 text-right">{t.type === 'Pemasukan' ? formatIDR(t.amount) : '-'}</td><td className="border border-black p-2 text-right">{t.type === 'Pengeluaran' ? formatIDR(t.amount) : '-'}</td></tr>
                  ))}
                </tbody>
                <tfoot className="font-bold border-2 border-black"><tr className="bg-slate-100"><td colSpan={3} className="p-3 text-right text-xs">TOTAL</td><td className="p-3 text-right text-emerald-700">{formatIDR(totalIncome)}</td><td className="p-3 text-right text-rose-700">{formatIDR(totalExpense)}</td></tr><tr className="bg-blue-900 text-white"><td colSpan={3} className="p-4 text-right text-sm">SALDO AKHIR</td><td colSpan={2} className="p-4 text-center text-xl font-black">{formatIDR(balance)}</td></tr></tfoot>
              </table>
            </div>

            <div className="mb-12 px-4 pdf-section pdf-text-block penutup-start" contentEditable suppressContentEditableWarning>
              <h3 className="font-bold text-lg border-l-8 border-blue-900 pl-4 mb-4 uppercase text-black pt-10">
                {config.reportMode === 'Cepat' ? 'III. PENUTUP' : 'IV. EVALUASI DAN PENUTUP'}
              </h3>
              <div className="space-y-4 text-base text-justify leading-relaxed text-black">
                {config.reportMode === 'Lengkap' && (
                  <>
                    <p className="font-bold underline mb-1">4.1 Hasil Kegiatan</p><p className="whitespace-pre-wrap">{config.hasil || '-'}</p>
                    <p className="font-bold underline mt-4 mb-1">4.2 Hambatan</p><p className="whitespace-pre-wrap">{config.hambatan || '-'}</p>
                    <p className="font-bold underline mt-4 mb-1">4.3 Saran</p><p className="whitespace-pre-wrap">{config.saran || '-'}</p>
                    <p className="font-bold underline mt-4 mb-1">4.4 Penutup</p>
                  </>
                )}
                <p className="whitespace-pre-wrap">{config.conclusion || 'Demikian laporan ini dibuat.'}</p>
              </div>
            </div>

            <div className="mt-auto pt-16 pb-12 px-4 pdf-section signature-start" contentEditable suppressContentEditableWarning>
              <p className="text-center font-bold text-sm uppercase mb-16 underline tracking-widest text-black">PENGESAHAN LAPORAN</p>
              <div className={activeSigners.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 text-center gap-y-16 gap-x-10'}>
                  {activeSigners.map((signer, idx) => (
                    <div key={idx} className="flex flex-col text-center"><p className="text-xl font-bold mb-32 leading-tight h-10 min-w-[200px] text-black">{signer.title || '...'}</p><p className="font-bold underline text-lg whitespace-nowrap text-black">{signer.name}</p></div>
                  ))}
              </div>
            </div>

            {uniqueReceipts.length > 0 && (
              <div className="px-4 pdf-section lampiran-start border-t-4 border-double border-slate-400">
                <h3 className="text-center font-bold text-4xl mb-12 uppercase underline tracking-[0.2em] text-black pt-16 mt-0">LAMPIRAN BUKTI TRANSAKSI</h3>
                <div className="flex flex-wrap gap-x-10 gap-y-12 justify-center pb-20">
                  {uniqueReceipts.map((t, idx) => (
                    <div key={idx} className="border-2 border-slate-200 p-6 rounded-[2.5rem] bg-white flex flex-col items-center shadow-sm receipt-card w-[45%] min-h-[400px]">
                      <div className="flex-1 flex items-center justify-center w-full mb-6 overflow-hidden"><img src={t.receiptBase64!} className="max-w-full max-h-[450px] object-contain rounded-2xl" alt="Nota" /></div>
                      <p className="text-xs text-slate-500 font-black uppercase text-center tracking-tighter border-t pt-4 w-full">NOTA - {t.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default App;
