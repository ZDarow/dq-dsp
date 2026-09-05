export const CHANNEL_COLORS = {
  inputL: '#22cc88',
  inputR: '#44aaff',
  output1: '#ff6644',
  output2: '#ffaa22',
  output3: '#aa66ff',
  output4: '#ff44aa',
} as const

export const INPUT_COLORS = [CHANNEL_COLORS.inputL, CHANNEL_COLORS.inputR] as const
export const OUTPUT_COLORS = [
  CHANNEL_COLORS.output1,
  CHANNEL_COLORS.output2,
  CHANNEL_COLORS.output3,
  CHANNEL_COLORS.output4,
] as const

export function getInputColor(index: number): string {
  return INPUT_COLORS[index] ?? CHANNEL_COLORS.inputL
}

export function getOutputColor(index: number): string {
  return OUTPUT_COLORS[index] ?? CHANNEL_COLORS.output1
}
