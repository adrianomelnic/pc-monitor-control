import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { TextInput, type TextInputProps, type ViewStyle } from "react-native";

import { Focusable } from "@/components/Focusable";
import { useGamepad } from "@/context/GamepadContext";

export interface FocusableTextInputProps extends TextInputProps {
  focusId: string;
  group?: string;
  containerStyle?: ViewStyle;
  ringRadius?: number;
}

export const FocusableTextInput = forwardRef<TextInput, FocusableTextInputProps>(
  function FocusableTextInput(
    { focusId, group, containerStyle, ringRadius = 4, onFocus, onBlur, ...rest },
    outerRef,
  ) {
    const { setKeyboardCaptureActive, pushBackHandler } = useGamepad();
    const inputRef = useRef<TextInput | null>(null);
    useImperativeHandle(outerRef, () => inputRef.current as TextInput);

    const popBackRef = useRef<(() => void) | null>(null);

    return (
      <Focusable
        focusId={focusId}
        group={group}
        containerStyle={containerStyle}
        ringRadius={ringRadius}
        scaleOnFocus={false}
        onPress={() => {
          try { inputRef.current?.focus(); } catch {}
        }}
      >
        <TextInput
          {...rest}
          ref={inputRef}
          onFocus={(e) => {
            setKeyboardCaptureActive(true);
            // While the soft keyboard is up, B should dismiss the keyboard
            // rather than triggering the screen's normal back action. We
            // register a transient back handler that just blurs the field.
            popBackRef.current = pushBackHandler(() => {
              try { inputRef.current?.blur(); } catch {}
              return true;
            });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setKeyboardCaptureActive(false);
            try { popBackRef.current?.(); } catch {}
            popBackRef.current = null;
            onBlur?.(e);
          }}
        />
      </Focusable>
    );
  },
);
