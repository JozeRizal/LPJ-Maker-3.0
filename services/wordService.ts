
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  ImageRun,
  UnderlineType,
  TableLayoutType
} from "docx";
import saveAs from "file-saver";
import { LPJData } from "../types";
import { formatIDR } from "../utils";

const COL_WIDTHS = { no: 700, date: 1500, desc: 3200, debit: 1800, kredit: 1800 };

export const exportToWord = async (data: LPJData) => {
  const { config, transactions } = data;
  const isLengkap = config.reportMode === 'Lengkap';
  const customTitle = config.reportTitle || "LAPORAN PERTANGGUNGJAWABAN";
  const customHeader = config.reportTitle || "LAPORAN PERTANGGUNGJAWABAN";
  
  const totalIncome = transactions.filter(t => t.type === 'Pemasukan').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'Pengeluaran').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const children: any[] = [];

  // Helper untuk convert base64 ke buffer
  const base64ToBuffer = (base64: string) => {
    const parts = base64.split(';');
    const mime = parts[0].split(':')[1];
    const data = atob(parts[1].split(',')[1]);
    const array = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      array[i] = data.charCodeAt(i);
    }
    return array;
  };

  // 1. Cover (Mode Lengkap)
  if (isLengkap) {
    if (config.logoBase64) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1000 },
          children: [
            new ImageRun({
              data: base64ToBuffer(config.logoBase64),
              transformation: { width: 150, height: 150 },
            } as any),
          ],
        })
      );
    }

    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: config.logoBase64 ? 800 : 2000 }, children: [new TextRun({ text: customTitle.toUpperCase(), bold: true, size: 36 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800 }, children: [new TextRun({ text: (config.eventName || "").toUpperCase(), bold: true, size: 48, color: "1E3A8A" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 1000 }, children: [new TextRun({ text: (config.organizationName || "").toUpperCase(), bold: true, size: 28 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 3000 }, children: [new TextRun({ text: (config.location || "[LOKASI]").toUpperCase(), bold: true, size: 24 })] }),
      new Paragraph({ children: [], pageBreakBefore: true })
    );
  }

  // Header Formal dengan Logo (Kop)
  if (config.logoBase64) {
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 30 }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 2000, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: base64ToBuffer(config.logoBase64),
                        transformation: { width: 80, height: 80 },
                      } as any),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 7000, type: WidthType.DXA },
                children: [
                  new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: customHeader.toUpperCase(), bold: true, size: 24 })] }),
                  new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: (config.eventName || "").toUpperCase(), bold: true, size: 28, color: "1E3A8A" })] }),
                  new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: (config.organizationName || "").toUpperCase(), bold: true, size: 18 })] }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 400 } })
    );
  } else {
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: customHeader.toUpperCase(), bold: true, size: 28, underline: { type: UnderlineType.SINGLE } })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: (config.eventName || "").toUpperCase(), bold: true, size: 36, color: "1E3A8A" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 400 }, children: [new TextRun({ text: `TANGGAL LAPORAN: ${config.reportDate}`, bold: true, font: "Courier New" })] })
    );
  }

  // Bab I: Pendahuluan
  children.push(
    new Paragraph({ children: [new TextRun({ text: "I. PENDAHULUAN", bold: true, size: 24 })], spacing: { before: 400, after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: "1.1 Latar Belakang", bold: true, size: 24 })] }),
    new Paragraph({ children: [new TextRun({ text: config.background || "Belum diisi.", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 } })
  );

  if (isLengkap) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: "1.2 Tujuan Kegiatan", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: config.tujuan || "-", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "1.3 Sasaran / Target", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: config.sasaran || "-", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 400 } })
    );

    // Bab II: Pelaksanaan
    children.push(
      new Paragraph({ children: [new TextRun({ text: "II. PELAKSANAAN KEGIATAN", bold: true, size: 24 })], spacing: { before: 400, after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "2.1 Waktu dan Tempat", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: config.waktuTempat || "-", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "2.2 Mekanisme Kegiatan", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: config.mekanisme || "-", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 400 } })
    );
  }

  // Bab Keuangan
  children.push(
    new Paragraph({ children: [new TextRun({ text: isLengkap ? "III. LAPORAN KEUANGAN" : "II. RINCIAN ANGGARAN KEUANGAN", bold: true, size: 24 })], spacing: { before: 400, after: 200 } })
  );

  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: COL_WIDTHS.no, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.date, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Tanggal", bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.desc, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Deskripsi", bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.debit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Debit", bold: true })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Kredit", bold: true })], alignment: AlignmentType.CENTER })] }),
      ],
    }),
    ...transactions.map((t, i) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: (t.manualNo || (i + 1).toString()), alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: t.date, alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: t.description })] }),
        new TableCell({ children: [new Paragraph({ text: t.type === 'Pemasukan' ? formatIDR(t.amount) : "-", alignment: AlignmentType.RIGHT })] }),
        new TableCell({ children: [new Paragraph({ text: t.type === 'Pengeluaran' ? formatIDR(t.amount) : "-", alignment: AlignmentType.RIGHT })] }),
      ],
    })),
    new TableRow({
      children: [
        new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: "SALDO AKHIR", bold: true })], alignment: AlignmentType.RIGHT })] }),
        new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: formatIDR(balance), bold: true })], alignment: AlignmentType.CENTER })] }),
      ],
    }),
  ];

  children.push(new Table({ width: { size: 9000, type: WidthType.DXA }, layout: TableLayoutType.FIXED, rows: tableRows }));

  // Bab Penutup
  children.push(
    new Paragraph({ children: [new TextRun({ text: isLengkap ? "IV. EVALUASI DAN PENUTUP" : "III. PENUTUP", bold: true, size: 24 })], spacing: { before: 400, after: 200 } })
  );

  if (isLengkap) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: "4.1 Hasil Kegiatan", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: config.hasil || "-", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "4.2 Hambatan", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: config.hambatan || "-", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "4.3 Saran", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: config.saran || "-", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "4.4 Penutup", bold: true, size: 24 })] })
    );
  }

  children.push(new Paragraph({ children: [new TextRun({ text: config.conclusion || "Belum diisi.", size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 800 } }));

  // Tanda Tangan
  const displaySigners = [{ name: config.chairpersonName, title: config.chairpersonTitle }, { name: config.treasurerName, title: config.treasurerTitle }].filter(s => s.name);
  const signatureCells = displaySigners.map(s => new TableCell({
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [
      new Paragraph({ children: [new TextRun({ text: s.title || "", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 1200 } }),
      new Paragraph({ children: [new TextRun({ text: s.name || "....................", bold: true, size: 24, underline: { type: UnderlineType.SINGLE } })], alignment: AlignmentType.CENTER }),
    ],
  }));

  children.push(new Table({
    width: { size: 9000, type: WidthType.DXA }, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: signatureCells })],
    borders: { insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
  }));

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `LPJ_${config.eventName || "Laporan"}.docx`);
};
