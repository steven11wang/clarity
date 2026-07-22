export function segmentSentences(passage: string): string[] {
  return passage.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? []
}
