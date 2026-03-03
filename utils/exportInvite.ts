type ExportOptions = { fileName?: string; scale?: number };

export async function exportPNG(node: HTMLElement, opts: ExportOptions = {}) {
  try {
    const domToImage = await import('dom-to-image-more');
    const scale = opts.scale ?? 2;
    const width = node.clientWidth * scale;
    const height = node.clientHeight * scale;
    const dataUrl = await (domToImage as any).default.toPng(node, {
      width,
      height,
      style: { transform: `scale(${scale})`, transformOrigin: 'top left' },
      cacheBust: true,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = opts.fileName ?? 'invite.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('Export failed', e);
    throw e;
  }
}

export async function exportPDF(node: HTMLElement, opts: ExportOptions = {}) {
  try {
    const { jsPDF } = await import('jspdf');
    const domToImage = await import('dom-to-image-more');
    const dataUrl = await (domToImage as any).default.toPng(node, { cacheBust: true });
    const pdf = new jsPDF({ unit: 'px', format: [node.clientWidth, node.clientHeight] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, node.clientWidth, node.clientHeight);
    pdf.save(opts.fileName ?? 'invite.pdf');
  } catch (e) {
    console.error('PDF export failed', e);
    throw e;
  }
}
