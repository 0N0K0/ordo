import type { ChartSeries } from './aggregate';

/** Styles copied from the page onto the exported SVG (Mantine charts color it with CSS variables). */
const STYLES = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'font-family', 'font-size', 'font-weight'];
const SCALE = 2;
const PAD = 24;

/**
 * Color of the page for a chart color (`blue.6`, CSS color).
 * @param {string} color Color.
 * @returns {string} CSS color.
 */
function resolveColor(color: string): string {
  const match = /^([a-z]+)\.(\d)$/.exec(color);
  if (!match) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(`--mantine-color-${match[1]}-${match[2]}`).trim() || color;
}

/**
 * Loads an image.
 * @param {string} url URL.
 * @returns {Promise<HTMLImageElement>} Image.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Le diagramme n’a pas pu être converti en image.'));
    image.src = url;
  });
}

/**
 * PNG of a drawn chart, as shown (colors of the current theme), with its title above and its legend below.
 * @param {HTMLElement} container Element holding the chart.
 * @param {string} title Title.
 * @param {ChartSeries[]} legend Legend entries.
 * @returns {Promise<string>} PNG data URL.
 */
export async function chartPng(container: HTMLElement, title: string, legend: ChartSeries[]): Promise<string> {
  const svg = container.querySelector<SVGSVGElement>('svg.recharts-surface');
  if (!svg) throw new Error('Rien à exporter : le diagramme est vide.');
  const { width, height } = svg.getBoundingClientRect();
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  originals.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const style = STYLES.map((name) => `${name}:${computed.getPropertyValue(name)}`).join(';');
    copies[index].setAttribute('style', style);
  });
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await loadImage(url);
    const page = getComputedStyle(document.body);
    const font = page.getPropertyValue('font-family');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    // Legend laid out on lines of the chart's width.
    context.font = `13px ${font}`;
    const lines: { name: string; color: string; x: number }[][] = [[]];
    let x = 0;
    for (const entry of legend) {
      const itemWidth = 18 + context.measureText(entry.name).width + 16;
      if (x > 0 && x + itemWidth > width) {
        lines.push([]);
        x = 0;
      }
      lines[lines.length - 1].push({ name: entry.name, color: resolveColor(entry.color), x });
      x += itemWidth;
    }
    const legendHeight = legend.length ? lines.length * 22 + 8 : 0;
    const titleHeight = 32;
    canvas.width = (width + 2 * PAD) * SCALE;
    canvas.height = (PAD + titleHeight + height + legendHeight + PAD) * SCALE;
    context.scale(SCALE, SCALE);
    context.fillStyle = page.backgroundColor || '#ffffff';
    context.fillRect(0, 0, width + 2 * PAD, canvas.height / SCALE);
    context.fillStyle = page.color || '#1d232b';
    context.font = `600 17px ${font}`;
    context.textBaseline = 'top';
    context.fillText(title, PAD, PAD);
    context.drawImage(image, PAD, PAD + titleHeight, width, height);
    context.font = `13px ${font}`;
    context.textBaseline = 'middle';
    lines.forEach((line, index) => {
      const y = PAD + titleHeight + height + 8 + index * 22 + 11;
      for (const entry of line) {
        context.fillStyle = entry.color;
        context.fillRect(PAD + entry.x, y - 6, 12, 12);
        context.fillStyle = page.color || '#1d232b';
        context.fillText(entry.name, PAD + entry.x + 18, y);
      }
    });
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * File name (characters forbidden in file names replaced).
 * @param {string} title Title.
 * @param {string} extension Extension.
 * @returns {string} File name.
 */
export const exportFileName = (title: string, extension: string) => `${title.replace(/[\\/:*?"<>|]/g, '-')}.${extension}`;

/**
 * Saves a data URL or blob as a file.
 * @param {string | Blob} content Data URL or blob.
 * @param {string} filename File name.
 * @returns {void}
 */
export function saveFile(content: string | Blob, filename: string): void {
  // Large data URLs are not reliably downloaded: always through a blob.
  const blob = typeof content === 'string' ? dataUrlBlob(content) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Blob of a base64 data URL.
 * @param {string} dataUrl Data URL.
 * @returns {Blob} Blob.
 */
function dataUrlBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: /^data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream' });
}

/**
 * Downloads charts as a PDF (laid out by the API).
 * @param {{ title: string, subtitle: string, charts: { title: string, description: string, image: string }[] }} input Charts.
 * @returns {Promise<void>}
 */
export async function downloadChartsPdf(input: { title: string; subtitle: string; charts: { title: string; description: string; image: string }[] }): Promise<void> {
  const response = await fetch('/api/exports/charts.pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Le PDF n’a pas pu être créé.');
  saveFile(await response.blob(), exportFileName(input.title, 'pdf'));
}
