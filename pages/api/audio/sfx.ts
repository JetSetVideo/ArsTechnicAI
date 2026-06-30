/**
 * POST /api/audio/sfx
 *
 * Generates a short sound-effects audio clip.
 * Tries ElevenLabs Sound Effects API if ELEVENLABS_API_KEY is set;
 * otherwise returns null so the client can proceed without audio.
 *
 * Body: { preset: string; duration?: number }
 * Response: { audioUrl: string | null }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Map preset names to descriptive prompts for audio generation
const PRESET_PROMPTS: Record<string, string> = {
  ambient:   'soft ambient background music, atmospheric, lo-fi, calm',
  cinematic: 'dramatic cinematic sound effect, epic, orchestral swell',
  upbeat:    'upbeat energetic electronic music, punchy beats, positive',
  nature:    'gentle nature sounds, birds chirping, soft wind, outdoor ambience',
  tech:      'futuristic tech sounds, digital beeps, sci-fi interface sounds',
};

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { preset = 'ambient', duration = 10 } = req.body as {
    preset?: string;
    duration?: number;
  };

  const elevenlabsKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenlabsKey) {
    // No API key — client proceeds without audio
    return res.status(200).json({ audioUrl: null, message: 'No ELEVENLABS_API_KEY set; proceeding without audio.' });
  }

  const textPrompt = PRESET_PROMPTS[preset] ?? PRESET_PROMPTS.ambient;
  const durationSec = Math.min(Math.max(duration, 1), 22); // ElevenLabs max is 22s

  try {
    const elevenRes = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsKey,
      },
      body: JSON.stringify({
        text: textPrompt,
        duration_seconds: durationSec,
        prompt_influence: 0.3,
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      return res.status(200).json({ audioUrl: null, message: `ElevenLabs error: ${errText}` });
    }

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
    const outDir = path.join(process.cwd(), 'public', 'exports');
    await fs.mkdir(outDir, { recursive: true });

    const filename = `sfx-${uuidv4()}.mp3`;
    const outPath = path.join(outDir, filename);
    await fs.writeFile(outPath, audioBuffer);

    return res.status(200).json({ audioUrl: `/exports/${filename}`, preset, duration: durationSec });
  } catch (err) {
    console.error('[audio/sfx]', err);
    return res.status(200).json({ audioUrl: null, message: String(err) });
  }
}
