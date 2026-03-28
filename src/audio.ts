import type { SoundCue } from './types'

let audioContext: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!audioContext) {
    const BrowserAudioContext = window.AudioContext
    if (!BrowserAudioContext) {
      return null
    }

    audioContext = new BrowserAudioContext()
  }

  return audioContext
}

function playTone(frequency: number, duration: number, type: OscillatorType, gainValue: number) {
  const context = getAudioContext()
  if (!context) {
    return
  }

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.value = gainValue
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
  oscillator.stop(context.currentTime + duration)
}

export function playSoundCue(cue: SoundCue) {
  const context = getAudioContext()
  if (!context) {
    return
  }

  if (context.state === 'suspended') {
    void context.resume()
  }

  switch (cue) {
    case 'hit':
      playTone(180, 0.12, 'square', 0.06)
      break
    case 'special':
      playTone(320, 0.18, 'sawtooth', 0.05)
      break
    case 'heal':
      playTone(520, 0.18, 'triangle', 0.04)
      break
    case 'guard':
      playTone(240, 0.2, 'triangle', 0.05)
      break
    case 'victory':
      playTone(520, 0.15, 'triangle', 0.04)
      window.setTimeout(() => playTone(660, 0.22, 'triangle', 0.04), 120)
      break
    case 'defeat':
      playTone(150, 0.3, 'sine', 0.05)
      break
    default:
      break
  }
}
