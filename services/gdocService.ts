
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
  HeadingLevel,
  UnderlineType,
  TableLayoutType
} from "docx";
import saveAs from "file-saver";
import { LPJData } from "../types";
import { formatIDR } from "../utils";

const COL_WIDTHS = {
  no: 700,
  date: 1500,
  desc: 3200,
  debit: 1800,
  kredit: 1800
};

export const exportToGoogleDocs = async (element: HTMLElement, filename: string, lpjData: LPJData) => {
  const { config, transactions } = lpjData;
  const customHeader = config.reportTitle || "LAPORAN PERTANGGUNGJAWABAN";
  
  const totalIncome = transactions
    .filter(t => t.type === 'Pemasukan')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter(t => t.type === 'Pengeluaran')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const base64ToBuffer = (base64: string) => {
    const parts = base64.split(';');
    const data = atob(parts[1].split(',')[1]);
    const array = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      array[i] = data.charCodeAt(i);
    }
    return array;
  };

  const tableHeaderRow = new TableRow({
    children: [
      new TableCell({ width: { size: COL_WIDTHS.no, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.date, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Tanggal", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.desc, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Deskripsi", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.debit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Debit", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Kredit", bold: true })], alignment: AlignmentType.CENTER })] }),
    ],
  });

  const transactionRows = transactions.map((t, i) => {
    return new TableRow({
      children: [
        new TableCell({ width: { size: COL_WIDTHS.no, type: WidthType.DXA }, children: [new Paragraph({ text: (t.manualNo || (i + 1).toString()), alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.date, type: WidthType.DXA }, children: [new Paragraph({ text: t.date, alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.desc, type: WidthType.DXA }, children: [new Paragraph({ text: t.description })] }),
        new TableCell({ width: { size: COL_WIDTHS.debit, type: WidthType.DXA }, children: [new Paragraph({ text: t.type === 'Pemasukan' ? formatIDR(t.amount) : "-", alignment: AlignmentType.RIGHT })] }),
        new TableCell({ width: { size: COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ text: t.type === 'Pengeluaran' ? formatIDR(t.amount) : "-", alignment: AlignmentType.RIGHT })] }),
      ],
    });
  });

  const totalRow = new TableRow({
    children: [
      new TableCell({ columnSpan: 3, width: { size: COL_WIDTHS.no + COL_WIDTHS.date + COL_WIDTHS.desc, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "SUBTOTAL KAS", bold: true })], alignment: AlignmentType.RIGHT })] }),
      new TableCell({ width: { size: COL_WIDTHS.debit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: formatIDR(totalIncome), bold: true })], alignment: AlignmentType.RIGHT })] }),
      new TableCell({ width: { size: COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: formatIDR(totalExpense), bold: true })], alignment: AlignmentType.RIGHT })] }),
    ],
  });

  const balanceRow = new TableRow({
    children: [
      new TableCell({ columnSpan: 3, width: { size: COL_WIDTHS.no + COL_WIDTHS.date + COL_WIDTHS.desc, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "SALDO AKHIR PANITIA", bold: true })], alignment: AlignmentType.RIGHT })] }),
      new TableCell({ columnSpan: 2, width: { size: COL_WIDTHS.debit + COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: formatIDR(balance), bold: true })], alignment: AlignmentType.CENTER })] }),
    ],
  });

  const displaySigners = [
    { name: config.chairpersonName, title: config.chairpersonTitle || 'Ketua Panitia' },
    { name: config.treasurerName, title: config.treasurerTitle || 'Bendahara' }
  ].filter(s => s.name);

  const signatureCells = displaySigners.map(s => {
    return new TableCell({
      width: { size: 4500, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [
        new Paragraph({ children: [new TextRun({ text: s.title || "", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ text: "", spacing: { before: 1000, after: 1000 } }),
        new Paragraph({ 
          children: [new TextRun({ text: s.name || "....................", bold: true, size: 24, underline: { type: UnderlineType.SINGLE } })], 
          alignment: AlignmentType.CENTER 
        }),
      ],
    });
  });

  const headerChildren: any[] = [];
  if (config.logoBase64) {
    headerChildren.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 20 }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 1500, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: base64ToBuffer(config.logoBase64),
                        transformation: { width: 60, height: 60 },
                      } as any),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 7500, type: WidthType.DXA },
                children: [
                  new Paragraph({ children: [new TextRun({ text: customHeader.toUpperCase(), bold: true, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: (config.eventName || "").toUpperCase(), bold: true, size: 28, color: "1E3A8A" })] }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 300 } })
    );
  } else {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: customHeader.toUpperCase(), bold: true, size: 28, underline: { type: UnderlineType.SINGLE } })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: (config.eventName || "").toUpperCase() || "[NAMA KEGIATAN]", bold: true, size: 36, color: "1E3A8A" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
        children: [new TextRun({ text: `TANGGAL LAPORAN: ${config.reportDate}`, bold: true, font: "Courier New" })],
      })
    );
  }

  const sections = [
    {
      children: [
        ...headerChildren,
        new Paragraph({ children: [new TextRun({ text: "I. PENDAHULUAN", bold: true, size: 24 })], spacing: { before: 400, after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: config.background || "Belum diisi.", size: 24 })], alignment: AlignmentType.JUSTIFIED }),
        new Paragraph({ children: [new TextRun({ text: "II. RINCIAN ANGGARAN KEUANGAN", bold: true, size: 24 })], spacing: { before: 400, after: 200 } }),
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: [tableHeaderRow, ...transactionRows, totalRow, balanceRow],
        }),
        new Paragraph({ children: [new TextRun({ text: "III. PENUTUP", bold: true, size: 24 })], spacing: { before: 400, after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: config.conclusion || "Belum diisi.", size: 24 })], alignment: AlignmentType.JUSTIFIED }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MENGETAHUI,", bold: true, size: 24 })], spacing: { after: 300 } }),
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: [new TableRow({ children: signatureCells })],
          borders: { 
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
          },
        }),
      ],
    },
  ];

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};
