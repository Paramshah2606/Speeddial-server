export function generateCallingNumber() {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(100 + Math.random() * 900);

  return `${part1}-${part2}`;
}
