import { OutputChannelStrip } from './OutputChannelStrip'

interface OutputStageProps {
  outputIndex: number
}

export function OutputStage({ outputIndex }: OutputStageProps) {
  return (
    <div className="p-2">
      <OutputChannelStrip index={outputIndex} />
    </div>
  )
}
