const PAGE_SIZE = { A4: 'A4', A5: 'A5', '80mm': '80mm auto', '58mm': '58mm auto' };

export function printInvoice(paper) {
  const style = document.createElement('style');
  style.id = 'invoice-page-size';
  const margin = paper === '80mm' || paper === '58mm' ? '0' : '6mm';
  style.textContent = `@page { size: ${PAGE_SIZE[paper] || 'A4'}; margin: ${margin}; }`;
  document.getElementById('invoice-page-size')?.remove();
  document.head.appendChild(style);
  window.print();
}

async function renderCanvas(element) {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc) => {
      const scaler = clonedDoc.getElementById('invoice-print')?.parentElement;
      if (scaler) scaler.style.transform = 'none';
    },
  });
}

export async function buildPdf(element) {
  const [{ jsPDF }, canvas] = await Promise.all([import('jspdf'), renderCanvas(element)]);
  const pxToMm = 0.2646;
  const widthMm = (canvas.width / 2) * pxToMm;
  const heightMm = (canvas.height / 2) * pxToMm;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [widthMm, heightMm] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, widthMm, heightMm);
  return pdf;
}

export async function downloadPdf(element, fileName) {
  const pdf = await buildPdf(element);
  pdf.save(`${fileName}.pdf`);
}

export async function shareInvoice(element, fileName, { phone, text }) {
  try {
    const pdf = await buildPdf(element);
    const file = new File([pdf.output('blob')], `${fileName}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName, text });
      return 'shared';
    }
    pdf.save(`${fileName}.pdf`);
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
  }
  const digits = String(phone || '').replace(/\D/g, '');
  const target = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${target}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'whatsapp';
}
