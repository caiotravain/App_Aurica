import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';

interface Point {
  x: number;
  y: number;
}

interface SignatureCaptureProps {
  onSignatureChange: (hasSignature: boolean) => void;
  onClear: () => void;
  width?: number;
  height?: number;
}

export interface SignatureCaptureRef {
  getSignatureData: () => Promise<string>;
  hasSignature: () => boolean;
}

export const SignatureCapture = React.forwardRef<SignatureCaptureRef, SignatureCaptureProps>(({
  onSignatureChange,
  onClear,
  width = Dimensions.get('window').width - 80,
  height = 200,
}, ref) => {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const viewRef = useRef<View>(null);
  const currentPathRef = useRef<Point[]>([]);
  
  // Keep ref in sync with state for access in event handlers
  React.useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsDrawing(true);
        
        // Save any existing currentPath before starting a new stroke
        // This ensures previous work is never lost when clicking again after some time
        const prevPath = currentPathRef.current;
        if (prevPath.length > 0) {
          // Save the previous path to the paths array
          const pathToSave = prevPath.length === 1 
            ? [prevPath[0], { ...prevPath[0], x: prevPath[0].x + 0.1, y: prevPath[0].y + 0.1 }]
            : prevPath;
          setPaths((paths) => [...paths, pathToSave]);
          onSignatureChange(true);
        }
        
        // Start a new path
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPoint = { x: locationX, y: locationY };
        setCurrentPath((prev) => {
          if (prev.length === 0) {
            return [newPoint];
          }
          const lastPoint = prev[prev.length - 1];
          const dx = newPoint.x - lastPoint.x;
          const dy = newPoint.y - lastPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Always add the point if it's far enough, but also interpolate if gap is too large
          if (distance >= 0.5) {
            // If the gap is too large (fast drawing), interpolate points to fill the gap
            if (distance > 3) {
              const steps = Math.ceil(distance / 2); // Fill gap with intermediate points
              const interpolatedPoints: Point[] = [];

              for (let i = 1; i <= steps; i++) {
                const ratio = i / (steps + 1);
                interpolatedPoints.push({
                  x: lastPoint.x + dx * ratio,
                  y: lastPoint.y + dy * ratio,
                });
              }

              return [...prev, ...interpolatedPoints, newPoint];
            } else {
              return [...prev, newPoint];
            }
          }
          return prev;
        });
      },
      onPanResponderRelease: () => {
        setIsDrawing(false);
        if (currentPath.length > 0) {
          // Always save the path, even if it's just a single point (tap)
          // If it's a single point, duplicate it to make it visible as a small dot
          const pathToSave = currentPath.length === 1 
            ? [currentPath[0], { ...currentPath[0], x: currentPath[0].x + 0.1, y: currentPath[0].y + 0.1 }]
            : currentPath;
          setPaths((prev) => [...prev, pathToSave]);
          setCurrentPath([]);
          onSignatureChange(true);
        }
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath([]);
    onSignatureChange(false);
    onClear();
  };

  // Convert paths to SVG string for base64 encoding
  const getSignatureSVG = (): string => {
    const allPaths = [...paths, currentPath].filter(p => p.length > 0);
    if (allPaths.length === 0) return '';

    let svgPaths = '';
    allPaths.forEach((path) => {
      if (path.length > 0) {
        let pathString = `M${path[0].x},${path[0].y}`;
        for (let i = 1; i < path.length; i++) {
          pathString += ` L${path[i].x},${path[i].y}`;
        }
        svgPaths += `<path d="${pathString}" stroke="#2d6122" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    });

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgPaths}</svg>`;
  };

  // Base64 encoding helper (React Native compatible) - kept as fallback
  const base64Encode = (str: string): string => {
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    // Fallback for environments without btoa
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const b = i < str.length ? str.charCodeAt(i++) : 0;
      const c = i < str.length ? str.charCodeAt(i++) : 0;
      const bitmap = (a << 16) | (b << 8) | c;
      output += chars.charAt((bitmap >> 18) & 63);
      output += chars.charAt((bitmap >> 12) & 63);
      output += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
      output += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
    }
    return output;
  };

  // Get signature as base64 PNG data URL by capturing the view
  const getSignatureData = async (): Promise<string> => {
    if (!viewRef.current) {
      console.error('Signature view ref not available');
      return '';
    }

    if (paths.length === 0 && currentPath.length === 0) {
      return '';
    }

    try {
      // Capture the signature view as PNG
      const uri = await captureRef(viewRef.current, {
        format: 'png',
        quality: 0.9,
        result: 'base64',
      });

      // Convert to data URI format expected by backend
      return `data:image/png;base64,${uri}`;
    } catch (error) {
      console.error('Error capturing signature:', error);
      // Fallback: try SVG format (might not work but better than nothing)
      try {
        const svg = getSignatureSVG();
        if (svg) {
          const base64 = base64Encode(svg);
          return `data:image/svg+xml;base64,${base64}`;
        }
      } catch (e) {
        console.error('Fallback SVG encoding also failed:', e);
      }
      return '';
    }
  };

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    getSignatureData,
    hasSignature: () => paths.length > 0 || currentPath.length > 0,
  }));

  // Update parent when signature changes
  React.useEffect(() => {
    const hasSig = paths.length > 0 || currentPath.length > 0;
    onSignatureChange(hasSig);
  }, [paths.length, currentPath.length]);

  return (
    <View style={styles.container}>
      <View
        ref={viewRef}
        style={[
          styles.signatureBox,
          { width, height },
          isDrawing && styles.signatureBoxDrawing
        ]}
        {...panResponder.panHandlers}
      >
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {paths.map((path, index) => {
            if (path.length < 2) return null;
            let pathData = `M ${path[0].x} ${path[0].y}`;
            for (let i = 1; i < path.length; i++) {
              pathData += ` L ${path[i].x} ${path[i].y}`;
            }
            return (
              <Path
                key={index}
                d={pathData}
                stroke="#2d6122"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
          {currentPath.length > 1 && (() => {
            let pathData = `M ${currentPath[0].x} ${currentPath[0].y}`;
            for (let i = 1; i < currentPath.length; i++) {
              pathData += ` L ${currentPath[i].x} ${currentPath[i].y}`;
            }
            return (
              <Path
                d={pathData}
                stroke="#2d6122"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })()}
        </Svg>
        {paths.length === 0 && currentPath.length === 0 && (
          <View style={styles.placeholder}>
            <Ionicons name="create-outline" size={48} color="#ccc" />
            <Text style={styles.placeholderText}>Desenhe sua assinatura aqui</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
        <Ionicons name="trash-outline" size={20} color="#e74c3c" />
        <Text style={styles.clearButtonText}>Limpar</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  signatureBox: {
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    overflow: 'hidden',
  },
  signatureBoxDrawing: {
    borderColor: '#2d6122',
    backgroundColor: '#f8fdf8',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  clearButtonText: {
    marginLeft: 6,
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '500',
  },
});

