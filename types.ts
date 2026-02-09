
export type TransactionType = 'Pemasukan' | 'Pengeluaran';
export type ReportMode = 'Cepat' | 'Lengkap';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  manualNo?: string;
  receiptBase64?: string;
}

export interface ReportConfig {
  reportMode: ReportMode;
  reportTitle: string; // Judul Dokumen (Kustom)
  eventName: string;
  organizationName: string;
  reportDate: string;
  location: string; // Lokasi Pelaksanaan
  logoBase64?: string; // Logo Organisasi/Kegiatan
  
  // Penandatangan
  chairpersonName: string;
  chairpersonTitle: string;
  treasurerName: string;
  treasurerTitle: string;
  official3Name?: string;
  official3Title?: string;
  official4Name?: string;
  official4Title?: string;

  // Narasi LPJ Cepat
  background: string;
  conclusion: string;

  // Narasi LPJ Lengkap Tambahan
  tujuan?: string;
  sasaran?: string;
  waktuTempat?: string;
  peserta?: string;
  mekanisme?: string;
  hasil?: string;
  hambatan?: string;
  saran?: string;
}

export interface LPJData {
  config: ReportConfig;
  transactions: Transaction[];
}
