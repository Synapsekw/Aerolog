type Row = (string | number)[];
type Total = { currency: string; completed: string; open: string; completedCount: number; openCount: number };

function decimal(value: string | number) {
  if (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return null;
  const match = String(value).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const fraction = match[2] || '', exponent = Number(match[3] || 0);
  if (Math.abs(exponent) > 324 || fraction.length > 324) return null;
  let scale = fraction.length - exponent, units = BigInt(match[1] + fraction);
  if (scale < 0) { units *= BigInt(10) ** BigInt(-scale); scale = 0; }
  return { units, scale };
}

function sum(values: NonNullable<ReturnType<typeof decimal>>[]) {
  const scale = Math.max(0, ...values.map(v => v.scale));
  const units = values.reduce((n, v) => n + v.units * BigInt(10) ** BigInt(scale - v.scale), BigInt(0));
  if (!scale) return String(units);
  const digits = String(units).padStart(scale + 1, '0');
  return (digits.slice(0, -scale) + '.' + digits.slice(-scale)).replace(/\.?0+$/, '');
}

/** Costs are recorded work-order amounts, not payments or recognized expenses. */
export function maintenanceCosts(rows: Row[]) {
  const groups = new Map<string, { completed: NonNullable<ReturnType<typeof decimal>>[]; open: NonNullable<ReturnType<typeof decimal>>[] }>();
  let missingCost = 0, invalidCost = 0, missingCurrency = 0, serviceCount = 0;
  for (const row of rows) {
    if (row[2] !== 'service') continue;
    serviceCount++;
    if (row[7] === '') { missingCost++; continue; }
    const amount = decimal(row[7]);
    if (!amount) { invalidCost++; continue; }
    const currency = String(row[8]);
    if (!/^[A-Z]{3}$/.test(currency)) { missingCurrency++; continue; }
    const group = groups.get(currency) || { completed: [], open: [] };
    group[row[5] === 'Completed' ? 'completed' : 'open'].push(amount);
    groups.set(currency, group);
  }
  const totals: Total[] = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([currency, group]) => ({ currency, completed: sum(group.completed), open: sum(group.open), completedCount: group.completed.length, openCount: group.open.length }));
  return { totals, serviceCount, missingCost, invalidCost, missingCurrency };
}
