import { Group, Rect, Text } from 'react-konva'

export function WordBoulder({
  word,
  x,
  y,
  scale,
  fontSize,
  containerWidth,
}: {
  word: string
  x: number
  y: number
  scale: number
  fontSize: number
  containerWidth: number
}) {
  const paddingX = 22
  const paddingY = 18
  const approxTextW = Math.min(containerWidth * 0.86, word.length * fontSize * 0.62 + paddingX * 2)
  const w = approxTextW
  const h = fontSize + paddingY * 2

  return (
    <Group x={x} y={y} scaleX={scale} scaleY={scale} offsetX={w / 2} offsetY={h / 2}>
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        cornerRadius={22}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, '#2a2a33', 1, '#12121a']}
        stroke="#3f3f46"
        strokeWidth={2}
        shadowColor="black"
        shadowBlur={16}
        shadowOpacity={0.45}
        shadowOffset={{ x: 0, y: 8 }}
      />
      <Text
        x={paddingX}
        y={paddingY}
        text={word}
        fontSize={fontSize}
        fontFamily="ui-sans-serif, system-ui, Segoe UI, Roboto, Arial"
        fill="#f4f4f5"
        letterSpacing={1.2}
      />
    </Group>
  )
}

