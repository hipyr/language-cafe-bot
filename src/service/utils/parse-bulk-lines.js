const MAX_CODE_BLOCK_LENGTH = 3000;

export const parseBulkLines = (raw) => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seen = new Set();
  const entries = [];
  let duplicateInInputCount = 0;

  lines.forEach((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      duplicateInInputCount += 1;
      return;
    }
    seen.add(key);
    entries.push(line);
  });

  return { entries, duplicateInInputCount };
};


export const formatBulkList = (entries) => {
  const lines = entries.map((entry, index) => `${index + 1}. ${entry}`);

  let content = '';
  let shownCount = 0;


  for (const line of lines) {
    if (content.length + line.length + 1 > MAX_CODE_BLOCK_LENGTH) break;
    content += `${line}\n`;
    shownCount += 1;
  }

  const remainingCount = entries.length - shownCount;
  if (remainingCount > 0) {
    content += `...and ${remainingCount} more\n`;
  }

  return `\`\`\`\n${content}\`\`\``;
};

export default parseBulkLines;
