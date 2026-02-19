import { defineAgent, type JobContext, cli, voice, ServerOptions } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as silero from '@livekit/agents-plugin-silero';
import { AudioStream, RoomEvent, TrackSource } from '@livekit/rtc-node';
import { fileURLToPath } from 'node:url';

const KHETSATHI_VOICE_PROMPT = `MULTILINGUAL INSTRUCTION (CRITICAL - ALWAYS FOLLOW):
You MUST detect the language the user is speaking in and ALWAYS respond in that SAME language.
If the user speaks in Hindi, respond entirely in Hindi.
If the user speaks in Telugu, respond entirely in Telugu.
If the user speaks in English, respond entirely in English.
If the user speaks in any other language, respond in that language.
If the user switches languages mid-conversation, switch your responses to match.

You are KhetSathi — think of yourself as a kind, experienced elder farmer who also happens to be a crop doctor. You genuinely care about the farmer and their family. You speak like a neighbor having chai together, not like a doctor in a clinic.

The farmer has uploaded photos of their sick crop and is now talking to you via voice. You need to understand their full situation before you can help.

CONVERSATION FLOW — follow this order. Ask ONLY ONE question per turn:

BASICS:
1. First ask their name warmly.
2. Which crop they are growing.
3. Where is their farm (village or district).

CROP STAGE:
4. How long ago did they plant this crop?
5. Is the plant small, medium, or fully grown now? Are flowers or fruits coming?
6. What variety or hybrid are they growing? Where did the seeds come from?

SCOPE OF THE PROBLEM:
7. How much of the field is affected — just one corner, or spread across the field?
8. Is the damage only on the fruit, or do they see spots on leaves and stems too?
9. When did they first notice this problem? Is it getting worse quickly or slowly?
10. Do nearby farms have the same problem?

WEATHER & ENVIRONMENT:
11. What has the weather been like recently — hot, humid, rainy?
12. Has there been heavy rain in the last 7-10 days?

WATER & IRRIGATION:
13. How do they water — drip, sprinkler, flood, or rain-fed?
14. When did they last water the field?
15. Is water standing in the field or does the soil stay wet for long?

SOIL:
16. What color is the soil — red, black, brown, or sandy?
17. Is the soil hard or soft?

CROP HISTORY:
18. What was grown in this field last season?
19. Have they applied any fertilizer? Which one — Urea, DAP, organic manure? When?
20. Have they sprayed any pesticide or fungicide already? Which one?

HOW TO TALK:
- Ask ONLY ONE question per turn. Never two. Never a list.
- After the farmer answers, warmly acknowledge what they said before asking the next thing.
- Sound like a caring person, not a form or a survey.
- Keep each response to 1-2 short sentences only.
- If the farmer already mentioned something, don't ask it again.
- Be warm, patient, encouraging. Use phrases like "Don't worry", "We'll figure this out together".
- Since this is a voice conversation, speak naturally and clearly. Avoid technical jargon.`;

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const participant = await ctx.waitForParticipant();
    console.log(`[voice] Participant joined: ${participant.identity}`);

    // DIAGNOSTIC: Monitor audio frames directly from the participant's track
    ctx.room.on(RoomEvent.TrackSubscribed, (track, publication, p) => {
      if (p.identity === participant.identity && publication.source === TrackSource.SOURCE_MICROPHONE) {
        console.log(`[voice-diag] Mic track subscribed! sid=${publication.sid}, kind=${track.kind}`);
        const diagStream = new AudioStream(track, { sampleRate: 24000, numChannels: 1 });
        let frameCount = 0;
        let totalSamples = 0;
        let hasNonZero = false;
        const reader = diagStream[Symbol.asyncIterator]();
        const readFrames = async () => {
          try {
            for await (const frame of diagStream) {
              frameCount++;
              totalSamples += frame.samplesPerChannel;
              if (!hasNonZero) {
                const data = new Int16Array(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength / 2);
                for (let i = 0; i < data.length; i++) {
                  if (Math.abs(data[i]) > 100) {
                    hasNonZero = true;
                    break;
                  }
                }
              }
              if (frameCount % 500 === 0) {
                console.log(`[voice-diag] ${frameCount} audio frames received, totalSamples=${totalSamples}, hasNonZeroAudio=${hasNonZero}`);
              }
              if (frameCount === 1) {
                console.log(`[voice-diag] FIRST audio frame: sampleRate=${frame.sampleRate}, channels=${frame.channels}, samplesPerChannel=${frame.samplesPerChannel}`);
              }
            }
          } catch (e: any) {
            console.log(`[voice-diag] Audio stream ended: ${e.message}`);
          }
        };
        readFrames();
      }
    });

    const metadata = ctx.room.metadata;
    let language = 'English';
    try {
      if (metadata) {
        const parsed = JSON.parse(metadata);
        language = parsed.language || 'English';
      }
    } catch {}

    try {
      const participantMeta = participant.metadata;
      if (participantMeta) {
        const parsed = JSON.parse(participantMeta);
        language = parsed.language || language;
      }
    } catch {}

    console.log(`[voice] Language: ${language}`);

    const languageGreeting = language === 'Telugu'
      ? 'Greet the farmer warmly in Telugu and ask their name.'
      : language === 'Hindi'
        ? 'Greet the farmer warmly in Hindi and ask their name.'
        : 'Greet the farmer warmly in English and ask their name.';

    const model = new google.beta.realtime.RealtimeModel({
      voice: 'Kore',
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.7,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: true,
        },
      },
    });

    const agent = new voice.Agent({
      instructions: KHETSATHI_VOICE_PROMPT + `\n\nThe farmer's preferred language is ${language}. Start the conversation in ${language}, but if they speak in a different language, switch to match them.`,
      llm: model,
      vad: ctx.proc.userData.vad! as silero.VAD,
      allowInterruptions: true,
      turnDetection: 'vad',
    });

    const session = new voice.AgentSession({
      userAwayTimeout: 120,
    });

    session.on('user_input_transcribed' as any, (ev: any) => {
      if (ev.transcript && ev.isFinal) {
        console.log(`[voice] Farmer said: ${ev.transcript}`);
      }
    });

    session.on('agent_state_changed' as any, (ev: any) => {
      console.log(`[voice] Agent state: ${ev.oldState} -> ${ev.newState}`);
    });

    await session.start({
      agent,
      room: ctx.room,
    });

    await session.generateReply({
      instructions: languageGreeting,
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
  })
);
