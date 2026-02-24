type ExportOptions = { fileName?: string; scale?: number };

export async function exportPNG(node: HTMLElement, opts: ExportOptions = {}) {
  // Dynamic import of dom-to-image-more for DOM -> image capture. This
  // avoids adding a blocking dependency at runtime; ensure you run
  // `npm install dom-to-image-more` in the project.
  try {
    // Use eval-import to avoid bundlers resolving this package at build
    // time when it's optional. This keeps the import truly dynamic.
    const lib = await (0, eval)('import("dom-to-image-more")');
    const scale = opts.scale ?? 1;
    const width = node.clientWidth * scale;
    const height = node.clientHeight * scale;
    const dataUrl = await (lib as any).toPng(node, { width, height, style: { transform: `scale(${scale})`, transformOrigin: 'top left' }, cacheBust: true });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = opts.fileName ?? 'invite.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('exportPNG requires dom-to-image-more. Run `npm install dom-to-image-more`.', e);
    throw e;
  }
}

export async function exportPDF(node: HTMLElement, opts: ExportOptions = {}) {
  try {
    const { jsPDF } = await (0, eval)('import("jspdf")');
    const lib = await (0, eval)('import("dom-to-image-more")');
    const dataUrl = await (lib as any).toPng(node, { cacheBust: true });
    const pdf = new jsPDF({ unit: 'px', format: [node.clientWidth, node.clientHeight] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, node.clientWidth, node.clientHeight);
    pdf.save(opts.fileName ?? 'invite.pdf');
  } catch (e) {
    console.error('exportPDF requires jspdf and dom-to-image-more. Run `npm install jspdf dom-to-image-more`.', e);
    throw e;
  }
}
