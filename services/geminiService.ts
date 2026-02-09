
/* Correctly initialized GoogleGenAI using process.env.API_KEY as per guidelines. */
import { GoogleGenAI, Type } from "@google/genai";
import { LPJData } from "../types";
import { formatIDR } from "../utils";

// The API key is obtained exclusively from the environment variable process.env.API_KEY.
// Manual key management UI and localStorage are removed as per developer guidelines.

export const generateReportNarrative = async (data: LPJData) => {
  /* Create a new GoogleGenAI instance right before the call to ensure it uses the latest environment configuration. */
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isLengkap = data.config.reportMode === 'Lengkap';

  const totalIncome = data.transactions
    .filter(t => t.type === 'Pemasukan')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = data.transactions
    .filter(t => t.type === 'Pengeluaran')
    .reduce((sum, t) => sum + t.amount, 0);

  const transactionList = data.transactions
    .map(t => `- ${t.date}: ${t.description} (${t.type}: ${formatIDR(t.amount)})`)
    .join('\n');

  let prompt = '';
  let responseSchema: any = {};

  if (!isLengkap) {
    prompt = `
      Bertindaklah sebagai Sekretaris Organisasi profesional. Buat narasi LPJ CEPAT (Sederhana) dalam Bahasa Indonesia.
      Kegiatan: ${data.config.eventName}
      Organisasi: ${data.config.organizationName}
      Detail Transaksi:
      ${transactionList}

      Berikan output JSON: "background" (latar belakang) dan "conclusion" (penutup).
    `;
    responseSchema = {
      type: Type.OBJECT,
      properties: {
        background: { type: Type.STRING },
        conclusion: { type: Type.STRING }
      },
      required: ["background", "conclusion"]
    };
  } else {
    prompt = `
      Bertindaklah sebagai Sekretaris Organisasi profesional. Buat narasi LPJ LENGKAP yang mendalam dalam Bahasa Indonesia.
      Kegiatan: ${data.config.eventName}
      Organisasi: ${data.config.organizationName}
      Ringkasan Kas: Masuk ${formatIDR(totalIncome)}, Keluar ${formatIDR(totalExpense)}.
      
      Detail Transaksi:
      ${transactionList}

      Berikan output JSON with field berikut (semua dalam Bahasa Indonesia yang formal):
      - background: Latar belakang kegiatan secara naratif.
      - tujuan: Tujuan utama dilaksanakannya kegiatan ini.
      - sasaran: Target peserta atau penerima manfaat.
      - waktuTempat: Ringkasan naratif waktu dan lokasi pelaksanaan.
      - peserta: Deskripsi kehadiran peserta.
      - mekanisme: Ringkasan jalannya acara dari awal hingga akhir.
      - hasil: Dampak positif atau pencapaian kegiatan.
      - hambatan: Kendala atau masalah yang dihadapi di lapangan.
      - saran: Rekomendasi untuk panitia di masa mendatang.
      - conclusion: Kalimat penutup formal.
    `;
    responseSchema = {
      type: Type.OBJECT,
      properties: {
        background: { type: Type.STRING },
        tujuan: { type: Type.STRING },
        sasaran: { type: Type.STRING },
        waktuTempat: { type: Type.STRING },
        peserta: { type: Type.STRING },
        mekanisme: { type: Type.STRING },
        hasil: { type: Type.STRING },
        hambatan: { type: Type.STRING },
        saran: { type: Type.STRING },
        conclusion: { type: Type.STRING }
      },
      required: ["background", "tujuan", "sasaran", "waktuTempat", "peserta", "mekanisme", "hasil", "hambatan", "saran", "conclusion"]
    };
  }

  try {
    const response = await ai.models.generateContent({
      /* Using 'gemini-3-pro-preview' for complex text generation tasks. */
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });
    /* The .text property is a direct string accessor, not a method. */
    return JSON.parse(response.text?.trim() || '{}');
  } catch (error) {
    console.error("AI Narrative Error:", error);
    throw error;
  }
};

export const analyzeReceipt = async (base64Image: string) => {
  /* Create a new GoogleGenAI instance right before the call. */
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const mimeType = base64Image.split(';')[0].split(':')[1];
  const base64Data = base64Image.split(',')[1];

  const prompt = `
    Tugas: Bertindak sebagai Auditor Keuangan. Ekstrak SEMUA informasi dari foto nota/struk ini dengan akurasi 100%.
    
    Aturan Ekstraksi:
    1. Ekstrak setiap baris item belanja secara individual.
    2. Masukkan diskon atau potongan harga sebagai angka NEGATIF (misal: -1500).
    3. Masukkan Pajak (PPN/Tax) sebagai item terpisah jika ada.
    4. Pastikan jumlah total dari semua item yang kamu ekstrak SAMA dengan "Grand Total" yang tertera di nota.
    5. Jika ada teks yang buram, berikan estimasi terbaik berdasarkan konteks harga.
    6. JANGAN gunakan huruf kapital semua untuk deskripsi. Gunakan format huruf normal (contoh: dari "SUSU" menjadi "Susu").

    Format JSON yang harus dikembalikan:
    {
      "transactions": [
        {
          "date": "YYYY-MM-DD (Gunakan tanggal yang tertera di nota, jika tidak ada gunakan hari ini)",
          "description": "Nama Barang / Jasa (Gunakan Huruf Normal, Bukan Kapital Semua)",
          "amount": angka_saja (positif untuk barang, negatif untuk diskon),
          "type": "Selalu 'Pengeluaran'"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      /* Using 'gemini-3-pro-preview' for multimodal tasks involving complex parsing. */
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING }
                },
                required: ["date", "description", "amount", "type"]
              }
            }
          },
          required: ["transactions"]
        }
      }
    });
    /* Access the text property directly. */
    return JSON.parse(response.text?.trim() || '{}');
  } catch (error) {
    console.error("Scan Error:", error);
    throw error;
  }
};
