import type { ReactNode } from 'react'

export function renderFormattedText(text: string): ReactNode {
  if (!text || !text.includes('<u>')) return text
  const parts = text.split(/(<u>[\s\S]*?<\/u>)/g)
  return parts.map((part, index) => {
    if (part.startsWith('<u>') && part.endsWith('</u>')) {
      return <u key={index}>{part.slice(3, -4)}</u>
    }
    return part
  })
}
