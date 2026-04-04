import React from "react";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";

type Item = { key: string };

type Props = {
  keys: string[];
  onReorder: (newKeys: string[]) => void;
  onDragBegin?: () => void;
  renderRow: (key: string, drag: () => void, isActive: boolean) => React.ReactNode;
};

export function DraggableFieldList({ keys, onReorder, onDragBegin, renderRow }: Props) {
  const data = keys.map(k => ({ key: k }));

  return (
    <DraggableFlatList<Item>
      data={data}
      keyExtractor={item => item.key}
      scrollEnabled={false}
      activationDistance={8}
      onDragBegin={onDragBegin}
      onDragEnd={({ data: newData }) => onReorder(newData.map(d => d.key))}
      renderItem={({ item, drag, isActive }: RenderItemParams<Item>) => (
        <ScaleDecorator activeScale={1.02}>
          {renderRow(item.key, drag, isActive) as React.ReactElement}
        </ScaleDecorator>
      )}
    />
  );
}
