import React, { useRef, useEffect } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";

function TypingIndicator({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.ease,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.ease,
          }),
        ]),
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const opacity = (dot: Animated.Value) =>
    dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <View style={styles.typingDots}>
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity: opacity(dot1) }]}
      />
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity: opacity(dot2) }]}
      />
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity: opacity(dot3) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  typingDots: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
    alignItems: "center",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

export { TypingIndicator };
