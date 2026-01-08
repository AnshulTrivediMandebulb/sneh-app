import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Line, Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';

const { width } = Dimensions.get('window');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);

export default function ContextGraph({ contexts = [] }) {
    // Make the network feel broader and closer to full width
    const horizontalMargin = 32; // side padding inside Vault screen
    const containerSize = Math.min(width - horizontalMargin, 460);
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;
    const radius = containerSize * 0.38;

    // Rotation animation for 3D effect
    const rotationAnim = useRef(new Animated.Value(0)).current;
    const tiltAnim = useRef(new Animated.Value(0)).current;
    const [nodes, setNodes] = useState([]);

    useEffect(() => {
        // Continuous rotation animation
        Animated.loop(
            Animated.timing(rotationAnim, {
                toValue: 1,
                duration: 24000,
                useNativeDriver: true,
            })
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(tiltAnim, { toValue: 1, duration: 6000, useNativeDriver: true }),
                Animated.timing(tiltAnim, { toValue: -1, duration: 6000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    // Position nodes in 3D space (simulated with depth)
    useEffect(() => {
        // Always show at least 12-15 nodes for rich visualization
        const MIN_NODES = 14;
        let allContexts = [...contexts];

        // Add decorative nodes if we have fewer than minimum
        while (allContexts.length < MIN_NODES) {
            allContexts.push({
                id: `decorative_${allContexts.length}`,
                title: '',
                priority: 'low',
                isDecorative: true
            });
        }

        const positioned = allContexts.map((context, index) => {
            // Use spherical coordinates for better 3D distribution
            const phi = Math.acos(-1 + (2 * index) / allContexts.length);
            const theta = Math.sqrt(allContexts.length * Math.PI) * phi;

            // Convert to Cartesian with depth
            const depth = 0.45 + Math.random() * 0.55;
            const x = centerX + (radius * Math.sin(phi) * Math.cos(theta) * depth);
            const y = centerY + (radius * Math.sin(phi) * Math.sin(theta) * depth);

            // Real contexts are larger, decorative ones are smaller
            let nodeSize = context.isDecorative ? 4 + (depth * 3) : 6 + (depth * 6);
            if (!context.isDecorative) {
                if (context.priority === 'high') nodeSize += 4;
                else if (context.priority === 'medium') nodeSize += 2;
            }

            return {
                ...context,
                x,
                y,
                depth,
                size: nodeSize,
                opacity: new Animated.Value(0.3 + depth * 0.3),
                scale: new Animated.Value(1),
                pulseAnim: new Animated.Value(0),
            };
        });

        setNodes(positioned);
    }, [contexts, containerSize, centerX, centerY, radius]);

    // Generate all-to-all connections with depth-based opacity
    const connections = useMemo(() => {
        const conns = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const avgDepth = (nodes[i].depth + nodes[j].depth) / 2;
                const distance = Math.sqrt(
                    Math.pow(nodes[i].x - nodes[j].x, 2) +
                    Math.pow(nodes[i].y - nodes[j].y, 2)
                );

                // Only draw connections between nearby nodes for cleaner look
                if (distance < radius * 1.2) {
                    conns.push({
                        from: nodes[i],
                        to: nodes[j],
                        depth: avgDepth,
                        opacity: avgDepth * 0.5,
                        pulseAnim: new Animated.Value(0),
                        distance,
                    });
                }
            }
        }
        // Sort by depth so deeper connections render first
        return conns.sort((a, b) => a.depth - b.depth);
    }, [nodes]);

    // Animate nodes (pulsing effect)
    useEffect(() => {
        nodes.forEach((node, index) => {
            const delay = index * 320;

            // Node pulse animation
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.parallel([
                        Animated.timing(node.opacity, {
                            toValue: 0.85 + node.depth * 0.15,
                            duration: 1800,
                            useNativeDriver: true,
                        }),
                        Animated.timing(node.scale, {
                            toValue: 1.18,
                            duration: 1800,
                            useNativeDriver: true,
                        }),
                    ]),
                    Animated.parallel([
                        Animated.timing(node.opacity, {
                            toValue: 0.32 + node.depth * 0.3,
                            duration: 1800,
                            useNativeDriver: true,
                        }),
                        Animated.timing(node.scale, {
                            toValue: 1,
                            duration: 1800,
                            useNativeDriver: true,
                        }),
                    ]),
                ])
            ).start();
        });
    }, [nodes]);

    // Animate connections (moving pulse effect)
    useEffect(() => {
        connections.forEach((conn, index) => {
            const delay = (index * 90) % 2800;

            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(conn.pulseAnim, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(conn.pulseAnim, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        });
    }, [connections]);

    if (nodes.length === 0) {
        return null;
    }

    const rotation = rotationAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });
    const tiltX = tiltAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ['6deg', '-6deg'],
    });
    const tiltY = tiltAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-5deg', '5deg'],
    });

    return (
        <View style={[styles.container, { width: containerSize, height: containerSize }]} pointerEvents="none">
            <View style={styles.backdrop} />
            <Animated.View style={{ transform: [{ perspective: 700 }, { rotateX: tiltX }, { rotateY: tiltY }, { rotateZ: rotation }] }}>
                <Svg width={containerSize} height={containerSize}>
                    <Defs>
                        <RadialGradient id="nodeGlow" cx="50%" cy="50%">
                            <Stop offset="0%" stopColor="#e0f2fe" stopOpacity="1" />
                            <Stop offset="45%" stopColor="#a5b4fc" stopOpacity="0.45" />
                            <Stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </RadialGradient>
                    </Defs>

                    {/* Draw connections with animated pulse */}
                    {connections.map((conn, index) => (
                        <AnimatedLine
                            key={`line-${index}`}
                            x1={conn.from.x}
                            y1={conn.from.y}
                            x2={conn.to.x}
                            y2={conn.to.y}
                            stroke="rgba(160, 199, 255, 0.9)"
                            strokeWidth={0.7 + conn.depth * 0.45}
                            opacity={conn.pulseAnim.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [conn.opacity * 0.25, conn.opacity * 0.9, conn.opacity * 0.25]
                            })}
                        />
                    ))}

                    {/* Draw context nodes */}
                    {nodes.map((node, index) => (
                        <React.Fragment key={`node-${index}`}>
                            {/* Outer glow */}
                            <AnimatedCircle
                                cx={node.x}
                                cy={node.y}
                                r={node.size * 3}
                                fill="url(#nodeGlow)"
                                opacity={node.opacity.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.2, 0.5]
                                })}
                            />

                            {/* Main node */}
                            <AnimatedCircle
                                cx={node.x}
                                cy={node.y}
                                r={node.size}
                                fill={node.isDecorative ? "rgba(99, 102, 241, 0.9)" : "#e0f2fe"}
                                opacity={node.opacity}
                                scale={node.scale}
                            />

                            {/* Inner highlight for 3D effect */}
                            <Circle
                                cx={node.x - node.size * 0.25}
                                cy={node.y - node.size * 0.25}
                                r={node.size * 0.35}
                                fill="rgba(255, 255, 255, 0.8)"
                            />
                        </React.Fragment>
                    ))}
                </Svg>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(59, 130, 246, 0.06)',
        borderRadius: 999,
    },
});
