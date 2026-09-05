import { InputChannelStrip } from './InputChannelStrip'

interface InputStageProps {
  inputIndex: number
}

export function InputStage({ inputIndex }: InputStageProps) {
  return (
    <div className="p-2">
      <InputChannelStrip index={inputIndex} />
    </div>
  )
}
