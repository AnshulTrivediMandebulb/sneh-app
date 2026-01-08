import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Line, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function NetworkBackground() {
    // Generate random nodes
    const [nodes] = useState(() =>
        Array.from({ length: 12 }, (_, i) => ({
            id: i,
            x: Math.random() * width,
            y: Math.random() * (height * 0.6) + 100,
            size: 4 + Math.random() * 6,
            opacity: new Animated.Value(0.3 + Math.random() * 0.4),
            scale: new Animated.Value(1),
        }))
    );

    // Generate connections between nearby nodes
    const [connections] = useState(() => {
        const conns = [];
        const maxDistance = 150;

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    conns.push({
                        from: nodes[i],
                        to: nodes[j],
                        opacity: 1 - (distance / maxDistance),
                    });
                }
            }
        }
        return conns;
    });

    useEffect(() => {
        // Animate nodes (pulsing effect)
        nodes.forEach((node, index) => {
            const delay = index * 200;

            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.parallel([
                        Animated.timing(node.opacity, {
                            toValue: 0.8,
                            duration: 2000 + Math.random() * 1000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(node.scale, {
                            toValue: 1.2,
                            duration: 2000 + Math.random() * 1000,
                            useNativeDriver: true,
                        }),
                    ]),
                    Animated.parallel([
                        Animated.timing(node.opacity, {
                            toValue: 0.3,
                            duration: 2000 + Math.random() * 1000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(node.scale, {
                            toValue: 1,
                            duration: 2000 + Math.random() * 1000,
                            useNativeDriver: true,
                        }),
                    ]),
                ])
            ).start();
        });
    }, []);

    return (
        <View style={styles.container} pointerEvents="none">
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>
                    <RadialGradient id="nodeGlow" cx="50%" cy="50%">
                        <Stop offset="0%" stopColor="#a78bfa" stopOpacity="1" />
                        <Stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
                        <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* Draw connections */}
                {connections.map((conn, index) => (
                    <Line
                        key={`line-${index}`}
                        x1={conn.from.x}
                        y1={conn.from.y}
                        x2={conn.to.x}
                        y2={conn.to.y}
                        stroke="rgba(167, 139, 250, 0.3)"
                        strokeWidth={0.5}
                        opacity={conn.opacity * 0.4}
                    />
                ))}

                {/* Draw nodes */}
                {nodes.map((node) => (
                    <React.Fragment key={`node-${node.id}`}>
                        {/* Outer glow */}
                        <AnimatedCircle
                            cx={node.x}
                            cy={node.y}
                            r={node.size * 3}
                            fill="url(#nodeGlow)"
                            opacity={node.opacity.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.1, 0.3]
                            })}
                        />

                        {/* Main node */}
                        <AnimatedCircle
                            cx={node.x}
                            cy={node.y}
                            r={node.size}
                            fill="#a78bfa"
                            opacity={node.opacity}
                            scale={node.scale}
                        />

                        {/* Inner highlight */}
                        <Circle
                            cx={node.x - node.size * 0.3}
                            cy={node.y - node.size * 0.3}
                            r={node.size * 0.4}
                            fill="rgba(255, 255, 255, 0.6)"
                        />
                    </React.Fragment>
                ))}
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6,
    },
});
