import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';

export default function DeformableBlob3D({ size = 280, state = 'idle' }) {
    const glRef = useRef(null);
    const timeRef = useRef(0);
    const animationFrameId = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        return () => {
            // Cleanup animation frame on unmount
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, []);

    const onContextCreate = async (gl) => {
        try {
            // Setup scene, camera, renderer
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
            camera.position.z = 2.5;

            const renderer = new THREE.WebGLRenderer({
                canvas: {
                    width: gl.drawingBufferWidth,
                    height: gl.drawingBufferHeight,
                    style: {},
                    addEventListener: () => { },
                    removeEventListener: () => { },
                    clientHeight: gl.drawingBufferHeight,
                    getContext: () => gl,
                },
                context: gl,
                alpha: true,
            });
            renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
            renderer.setClearColor(0x000000, 0); // Transparent background

            // Create deformable sphere
            const geometry = new THREE.IcosahedronGeometry(1, 32); // Reduced detail from 64 to 32 for better performance

            // Custom shader material for holographic effect
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color1: { value: new THREE.Color('#a855f7') }, // Purple
                    color2: { value: new THREE.Color('#06b6d4') }, // Cyan
                    color3: { value: new THREE.Color('#ec4899') }, // Pink
                },
                vertexShader: `
                uniform float time;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                // Simple noise function
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
                
                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                    
                    vec3 i  = floor(v + dot(v, C.yyy));
                    vec3 x0 = v - i + dot(i, C.xxx);
                    
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min(g.xyz, l.zxy);
                    vec3 i2 = max(g.xyz, l.zxy);
                    
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    
                    i = mod289(i);
                    vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                    
                    float n_ = 0.142857142857;
                    vec3 ns = n_ * D.wyz - D.xzx;
                    
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_);
                    
                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    
                    vec4 b0 = vec4(x.xy, y.xy);
                    vec4 b1 = vec4(x.zw, y.zw);
                    
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                    
                    vec3 p0 = vec3(a0.xy, h.x);
                    vec3 p1 = vec3(a0.zw, h.y);
                    vec3 p2 = vec3(a1.xy, h.z);
                    vec3 p3 = vec3(a1.zw, h.w);
                    
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;
                    
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
                }
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    
                    // Apply organic deformation using noise
                    vec3 pos = position;
                    float noise1 = snoise(pos * 2.0 + time * 0.3);
                    float noise2 = snoise(pos * 3.0 - time * 0.2);
                    float displacement = (noise1 + noise2) * 0.15;
                    
                    pos += normal * displacement;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
                fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;
                uniform vec3 color3;
                uniform float time;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    // Holographic gradient based on position and view angle
                    vec3 viewDirection = normalize(vPosition);
                    float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.0);
                    
                    // Animated color mixing
                    float mixFactor1 = sin(time * 0.5 + vPosition.x * 2.0) * 0.5 + 0.5;
                    float mixFactor2 = cos(time * 0.3 + vPosition.y * 2.0) * 0.5 + 0.5;
                    
                    vec3 color = mix(color1, color2, mixFactor1);
                    color = mix(color, color3, mixFactor2);
                    
                    // Add fresnel glow
                    color += fresnel * 0.3;
                    
                    gl_FragColor = vec4(color, 0.9);
                }
            `,
                transparent: true,
            });

            const sphere = new THREE.Mesh(geometry, material);
            scene.add(sphere);

            // Add lighting for depth
            const light1 = new THREE.PointLight(0xa855f7, 1, 100);
            light1.position.set(2, 2, 2);
            scene.add(light1);

            const light2 = new THREE.PointLight(0x06b6d4, 1, 100);
            light2.position.set(-2, -2, 2);
            scene.add(light2);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
            scene.add(ambientLight);

            // Animation loop
            const animate = () => {
                animationFrameId.current = requestAnimationFrame(animate);

                timeRef.current += 0.016; // ~60fps

                // Update shader time
                material.uniforms.time.value = timeRef.current;

                // Slow rotation for 3D effect
                sphere.rotation.y += 0.003;
                sphere.rotation.x += 0.002;

                // Render
                renderer.render(scene, camera);
                gl.endFrameEXP();
            };

            animate();
        } catch (err) {
            console.error('DeformableBlob3D Error:', err);
            setError(err.message);
        }
    };

    if (error) {
        return (
            <View style={[styles.container, { width: size, height: size }]}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>WebGL Error</Text>
                    <Text style={styles.errorDetail}>{error}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <GLView
                style={styles.glView}
                onContextCreate={onContextCreate}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    glView: {
        width: '100%',
        height: '100%',
    },
    errorContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    errorDetail: {
        color: '#9ca3af',
        fontSize: 12,
        textAlign: 'center',
    },
});
