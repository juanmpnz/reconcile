/* global getComputedStyle */
import assert from 'node:assert/strict';

// Operate the visible Radix control; hidden native selects are inspected only as form evidence.
export async function chooseSelect(page, trigger, value) {
  await trigger.click();
  const option = page
    .getByRole('option')
    .and(page.locator(`[data-value=${JSON.stringify(String(value))}]`));
  await option.waitFor({ state: 'visible' });
  const contrast = await option.evaluate((el) => {
    const rgb = (color) =>
      color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const luminance = (color) =>
      rgb(color)
        .map((n) => {
          const v = n / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const fg = luminance(getComputedStyle(el).color);
    const bg = luminance(
      getComputedStyle(el.closest('[role="listbox"]')).backgroundColor,
    );
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  assert.ok(contrast >= 4.5, `select option text contrast ${contrast}`);

  const label = (await option.textContent()).replace('✓', '').trim();
  await option.click();
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  // Router-controlled values may settle after the menu closes. Require the
  // visible label to arrive rather than reading the previous render once.
  await trigger.filter({ hasText: label }).waitFor({ state: 'visible' });
  assert.ok(
    (await trigger.textContent()).includes(label),
    `selected option ${value} is displayed`,
  );
}
