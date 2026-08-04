import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import {
  ARTWORK_HEIGHT_RATIO,
  ARTWORK_TOP_RATIO,
  MARK_GAP,
  MARK_SIZE,
  WORDMARK_SIZE,
} from "./brandLockup";
import { MorphingText } from "./morphing-text";
import { MorphMark, MORPH_STAGES } from "./MorphMark";
import { ShapedImageReveal } from "./ShapedImageReveal";

/**
 * The brand intro timeline, in milliseconds from mount.
 *
 * Tuned to land at roughly 3.7s — long enough for the mark to tell its story
 * and for the artwork to resolve, short enough that it never feels like a
 * loading screen. Every window below overlaps the next on purpose; nothing
 * waits for a previous beat to finish.
 */
const T = {
  revealDuration: 2600,
  markStart: 300,
  markDuration: 1900,
  phraseTwo: 1000,
  phraseThree: 1600,
  grandReveal: 2200,
  grandRevealDuration: 700,
  lift: 2900,
  liftDuration: 620,
} as const;

/**
 * The words the morph steps through. All one case on purpose — the block keys
 * glyphs by character, so a capitalised phrase shares nothing with a lowercase
 * one and everything blurs instead of gliding.
 *
 * LOCAL and CHECK share only a C, so each swap genuinely re-forms the word;
 * the final LOCALCHECK then absorbs both, which is the reveal.
 */
const PHRASES = ["LOCAL", "CHECK", "LOCAL", "LOCALCHECK"] as const;

/** Artwork sits back behind the logo until the grand reveal claims it. */
const ARTWORK_HELD_OPACITY = 0.32;

/**
 * Where the artwork settles once the form arrives. Must match
 * `styles.artworkImage.opacity` on the auth screen, or the handoff steps.
 */
const ARTWORK_RESTING_OPACITY = 0.3;

/** Logo and text sit side by side, so this is the taller of the two. */
const LOCKUP_HEIGHT = MARK_SIZE + 8;

/** Screen padding either side, matching the auth screen. */
const SIDE_PADDING = 24;

const REVEAL_EASING = Easing.bezier(0.24, 0.55, 0.67, 0.99);
const LIFT_EASING = Easing.bezier(0.22, 1, 0.36, 1);

export interface OnboardingIntroProps {
  /** Fires once the logo has settled and the form should take over. */
  onDone: () => void;
  /** Distance from the top of the screen to the logo's resting position. */
  restingTop: number;
  /**
   * Multiplies every duration and delay. Only ever anything but `1` from the
   * dev-only `?introSlow=` override.
   */
  timeScale?: number;
}

/**
 * First-launch brand reveal for the auth screen.
 *
 * The artwork resolves out of black through the shaped-image shader while the
 * word morphs LOCAL → CHECK → LOCAL → LOCALCHECK, then the logo lifts to the
 * top and hands off via {@link onDone}. It finishes exactly where the auth
 * screen's own logo sits, so the handoff does not visibly jump.
 *
 * Honours Reduce Motion: the sequence collapses to its end state.
 */
export function OnboardingIntro({
  onDone,
  restingTop,
  timeScale = 1,
}: OnboardingIntroProps) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const ms = useCallback((value: number) => value * timeScale, [timeScale]);

  const [phrase, setPhrase] = useState<string>(PHRASES[0]);

  const reveal = useSharedValue(0);
  const artwork = useSharedValue(0);
  const markStage = useSharedValue(0);
  const lift = useSharedValue(0);
  const veil = useSharedValue(1);

  useEffect(() => {
    // `null` means the accessibility preference has not resolved yet — waiting
    // one tick is better than starting a sequence we would have to cancel.
    if (reducedMotion === null) return;

    if (reducedMotion) {
      reveal.value = 1;
      artwork.value = ARTWORK_RESTING_OPACITY;
      markStage.value = MORPH_STAGES - 1;
      lift.value = 1;
      veil.value = 0;
      setPhrase(PHRASES[PHRASES.length - 1]);
      const id = setTimeout(onDone, 120);
      return () => clearTimeout(id);
    }

    reveal.value = withTiming(1, {
      duration: ms(T.revealDuration),
      easing: REVEAL_EASING,
    });
    artwork.value = withTiming(ARTWORK_HELD_OPACITY, {
      duration: ms(T.revealDuration),
      easing: Easing.out(Easing.quad),
    });

    markStage.value = withDelay(
      ms(T.markStart),
      withTiming(MORPH_STAGES - 1, {
        duration: ms(T.markDuration),
        easing: Easing.inOut(Easing.cubic),
      })
    );

    const timers = [
      setTimeout(() => setPhrase(PHRASES[1]), ms(T.phraseTwo)),
      setTimeout(() => setPhrase(PHRASES[2]), ms(T.phraseThree)),
      // Grand reveal: the full name forms and the artwork steps forward.
      setTimeout(() => {
        setPhrase(PHRASES[3]);
        artwork.value = withTiming(1, {
          duration: ms(T.grandRevealDuration),
          easing: Easing.out(Easing.cubic),
        });
      }, ms(T.grandReveal)),
      setTimeout(() => {
        lift.value = withTiming(1, {
          duration: ms(T.liftDuration),
          easing: LIFT_EASING,
        });
        // The artwork gives up the stage as the form takes it.
        artwork.value = withTiming(ARTWORK_RESTING_OPACITY, {
          duration: ms(T.liftDuration),
          easing: Easing.inOut(Easing.quad),
        });
        veil.value = withDelay(
          ms(T.liftDuration - 220),
          withTiming(0, { duration: ms(260) }, (finished) => {
            "worklet";
            if (finished) runOnJS(onDone)();
          })
        );
      }, ms(T.lift)),
    ];

    return () => timers.forEach(clearTimeout);
  }, [artwork, lift, markStage, ms, onDone, reducedMotion, reveal, veil]);

  // Centre of the screen for the logo, expressed as an offset from where it
  // will eventually rest. Animating one translateY keeps the lift on the UI
  // thread and avoids re-laying out on every frame.
  const centredOffset = height / 2 - restingTop - LOCKUP_HEIGHT / 2;

  // The morph canvas takes whatever the logo and gap leave behind.
  const textWidth = width - SIDE_PADDING * 2 - MARK_SIZE - MARK_GAP;

  const artworkStyle = useAnimatedStyle(() => ({ opacity: artwork.value }));
  const lockupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: centredOffset * (1 - lift.value) }],
  }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <Animated.View
      style={[styles.container, veilStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.artworkBand, artworkStyle]}>
        <ShapedImageReveal
          progress={reveal}
          width={width}
          height={height * ARTWORK_HEIGHT_RATIO}
        />
      </Animated.View>

      <Animated.View style={[styles.lockup, { top: restingTop }, lockupStyle]}>
        <View style={styles.lockupRow}>
          <MorphMark size={MARK_SIZE} stage={markStage} />
          <View style={styles.wordmarkRow}>
            <MorphingText
              text={phrase}
              fitTexts={PHRASES}
              width={textWidth}
              height={MARK_SIZE}
              fontSize={WORDMARK_SIZE}
              color={Colors.text}
            />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  lockup: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: SIDE_PADDING,
  },
  artworkBand: {
    position: "absolute",
    top: `${ARTWORK_TOP_RATIO * 100}%`,
    left: 0,
    right: 0,
    height: `${ARTWORK_HEIGHT_RATIO * 100}%`,
  },
  lockupRow: { flexDirection: "row", alignItems: "center" },
  wordmarkRow: { marginLeft: MARK_GAP },
});
