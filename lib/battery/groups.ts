export function batteryGroup(b: {
  model: string;
  sourceName?: string;
  productModel?: string;
}) {
  if (b.productModel?.trim()) return b.productModel.trim();
  const name = `${b.model} ${b.sourceName || ''}`;
  const code = name.match(/\b(TB\d{2,3}S?|WB\d{2})\b/i);
  if (code) return code[1].toUpperCase();
  const families: [RegExp, string][] = [
    [/matrice\s*4(?:t)?d/i, 'Matrice 4D / 4TD'],
    [/mavic\s*3/i, 'Mavic 3 series'],
    [/mavic\s*2/i, 'Mavic 2 series'],
    [/inspire\s*3/i, 'Inspire 3'],
    [/inspire\s*2/i, 'Inspire 2'],
    [/\bM350\b/i, 'M350 series'],
    [/\bM300\b/i, 'M300 series'],
    [/\bM400\b/i, 'M400 series'],
    [/elios[\s-]*3/i, 'Elios 3'],
    [/elios/i, 'Elios'],
    [/ebee/i, 'eBee'],
    [/phantom\s*4/i, 'Phantom 4 series'],
    [/autel/i, 'Autel'],
  ];
  return (
    families.find(([pattern]) => pattern.test(name))?.[1] ||
    'Other / unidentified'
  );
}
