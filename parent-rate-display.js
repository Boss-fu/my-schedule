function addRateColumn() {
  const frame = document.querySelector('iframe[title="家長端"]');
  const doc = frame?.contentDocument;
  const table = doc?.querySelector('#invoicePreview table');
  if (!table || table.dataset.ratesShown) return;
  table.dataset.ratesShown = 'true';
  const head = table.querySelector('thead tr');
  const costHeader = [...head.children].find(node => node.textContent.includes('本次費用'));
  costHeader?.insertAdjacentHTML('beforebegin', '<th>鐘點費</th>');
  table.querySelectorAll('tbody tr').forEach(row => {
    const cells = row.children;
    const hours = Number(cells[2]?.textContent || 0);
    const cost = Number((cells[3]?.textContent || '').replace(/[^0-9.-]/g, ''));
    const rate = hours ? Math.round(cost / hours) : 0;
    cells[3]?.insertAdjacentHTML('beforebegin', `<td>NT$ ${rate.toLocaleString('zh-TW')}／hr</td>`);
  });
}
const parentFrame = document.querySelector('iframe[title="家長端"]');
parentFrame?.addEventListener('load', () => {
  const doc = parentFrame.contentDocument;
  const output = doc?.getElementById('invoicePreview');
  if (output) new MutationObserver(addRateColumn).observe(output, { childList: true, subtree: true });
  addRateColumn();
});
