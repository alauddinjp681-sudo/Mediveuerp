const normalize = (value) => String(value || '').normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
const spokenQuantities = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
};

export function parseVoiceDraft(transcript, inventory) {
  const text = normalize(transcript);
  const buyerMatch = text.match(/(?:customer|party|buyer|grahak|graahak|ग्राहक|पार्टी)\s+([\p{L}][\p{L} ]{1,28}?)(?=\s+(?:add|item|medicine|bill|for|dalo|jodo|\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|chaar|char|paanch|panch|chhe|che|saat|aath|nau|das|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)|[,.;]|$)/u);
  const occupiedRanges = [];
  const matchedItems = [];
  const candidates = inventory
    .filter((item) => item.name)
    .map((item) => ({ item, name: normalize(item.name) }))
    .sort((a, b) => b.name.length - a.name.length);

  candidates.forEach(({ item, name }) => {
    let searchFrom = 0;
    while (name && searchFrom < text.length) {
      const position = text.indexOf(name, searchFrom);
      if (position < 0) break;
      searchFrom = position + name.length;
      const end = position + name.length;
      if (occupiedRanges.some((range) => position < range.end && end > range.start)) continue;
      occupiedRanges.push({ start: position, end });

      const beforeName = text.slice(Math.max(0, position - 36), position);
      const quantityMatch = beforeName.match(/(?:^|\s)(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|chaar|char|paanch|panch|chhe|che|saat|aath|nau|das|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)\s*(?:x|pcs?|strips?|bottles?)?\s*$/iu);
      const spokenQuantity = quantityMatch?.[1]?.toLocaleLowerCase();
      const quantity = spokenQuantity ? Number(spokenQuantity) || spokenQuantities[spokenQuantity] : 1;
      const existing = matchedItems.find((entry) => entry.item.id === item.id);
      if (existing) existing.quantity += quantity || 1;
      else matchedItems.push({ item, quantity: quantity || 1 });
    }
  });

  return { buyerName: buyerMatch?.[1]?.trim() || '', matchedItems };
}
