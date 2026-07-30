// LocalCheck brand mark — React Native (requires react-native-svg)
// <LocalCheckMark size={42} /> · <LocalCheckMark size={34} frame="#fff" check="#fff" />
import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export default function LocalCheckMark({ size = 42, frame = '#f2f2f6', check = '#fc4c02' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <G stroke={frame} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M13 4H4v9" />
        <Path d="M27 4h9v9" />
        <Path d="M36 27v9h-9" />
        <Path d="M4 27v9h9" />
      </G>
      <Path d="M13.5 20.4 18 25l9-9.6" stroke={check} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
