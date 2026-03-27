import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Colors from "@/constants/colors";

interface MetricRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
  color?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function MetricRing({
  value,
  size = 80,
  strokeWidth = 7,
  label,
  sublabel,
  color = Colors.light.tint,
}: MetricRingProps) {
  const animValue = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const clampedValue = Math.min(100, Math.max(0, value));
  const ringColor =
    clampedValue > 85
      ? Colors.light.danger
      : clampedValue > 65
      ? Colors.light.warning
      : color;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={Colors.light.backgroundTertiary}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        <Text style={[styles.value, { color: ringColor }]}>
          {Math.round(clampedValue)}
          <Text style={styles.pct}>%</Text>
        </Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
  },
  pct: {
    fontSize: 10,
    fontWeight: "400",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.text,
    letterSpacing: 0.5,
  },
  sublabel: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
});
