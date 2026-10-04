import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Server-side Gemini initialization with telemetry header
const apiKey = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ============================================================
// 1. OCR & NLP Discharge Summary Extraction Endpoint
// ============================================================

app.post('/api/gemini/extract-discharge', async (req: Request, res: Response) => {
  try {
    const {
      documentText = '',
      imageBase64,
      mimeType,
      documents = [],
      language = 'en',
    } = req.body;

    const incomingDocuments =
      Array.isArray(documents) && documents.length
        ? documents
        : imageBase64
          ? [
              {
                name: 'discharge-document',
                mimeType: mimeType || 'application/pdf',
                base64: imageBase64,
                text: documentText,
              },
            ]
          : [];

    if (!incomingDocuments.length && !documentText.trim()) {
      return res.status(400).json({
        success: false,
        error:
          'Please provide at least one discharge, medication, diet, exercise, or follow-up document.',
      });
    }

    const systemInstruction = `You are RecoveryNav's clinical document extraction engine. Analyze ALL supplied post-hospital documents together as one patient record. Documents may include a discharge summary, separate prescription/medication sheet, diet instructions, physiotherapy sheet, follow-up/appointment sheet, lab instructions, or scanned images/PDFs.

IMPORTANT:

- Extract only information actually present in the supplied documents. Never invent a medication, dose, appointment, diet rule, exercise, diagnosis, warning sign, date, doctor, or patient detail.
- If two documents disagree, preserve both values in detected_conflicts and do not silently choose one.
- If a field is absent, return an empty string/array rather than a sample value.
- Normalize frequency and timing where explicitly stated. Keep exact dose, route, food relation, duration and precautions.
- Build a unified recovery plan from the supplied documents so the frontend can populate the dashboard, medication tracker/reminders, symptoms/red flags, follow-up appointments, diet plan, and exercise/rehabilitation sections.
- Warning signs must come from the documents; you may only normalize wording, not invent clinical thresholds.
- The user's requested language is ${language} for explanatory text, while medicine names and clinical identifiers should remain recognizable.

Return ONLY valid JSON matching the schema.`;

    const contents: any[] = [];

    for (const doc of incomingDocuments) {
      if (doc.base64) {
        contents.push({
          inlineData: {
            mimeType: doc.mimeType || 'application/pdf',
            data: doc.base64,
          },
        });
      }

      if (doc.text) {
        contents.push({
          text: `DOCUMENT: ${doc.name || 'unnamed'}\n${doc.text}`,
        });
      } else {
        contents.push({
          text: `DOCUMENT: ${doc.name || 'unnamed'}\nAnalyze the attached document above.`,
        });
      }
    }

    if (documentText) {
      contents.push({
        text: `ADDITIONAL USER-PROVIDED TEXT:\n${documentText}`,
      });
    }

    let parsedData: any = null;
    let lastError: any = null;

    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.1-pro-preview',
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                hospital_name: {
                  type: Type.STRING,
                },

                patient_name: {
                  type: Type.STRING,
                },

                admission_date: {
                  type: Type.STRING,
                },

                discharge_date: {
                  type: Type.STRING,
                },

                attending_physician: {
                  type: Type.STRING,
                },

                diagnosis: {
                  type: Type.STRING,
                },

                surgical_procedure: {
                  type: Type.STRING,
                },

                allergies: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },

                dietary_instructions: {
                  type: Type.STRING,
                },

                hydration_target_ml: {
                  type: Type.NUMBER,
                },

                activity_restrictions: {
                  type: Type.STRING,
                },

                warning_signs: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },

                medications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                      },

                      generic_name: {
                        type: Type.STRING,
                      },

                      dosage: {
                        type: Type.STRING,
                      },

                      frequency: {
                        type: Type.STRING,
                      },

                      route: {
                        type: Type.STRING,
                      },

                      timing: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.STRING,
                        },
                      },

                      purpose: {
                        type: Type.STRING,
                      },

                      food_relation: {
                        type: Type.STRING,
                      },

                      precautions: {
                        type: Type.STRING,
                      },

                      duration: {
                        type: Type.STRING,
                      },

                      start_date: {
                        type: Type.STRING,
                      },

                      end_date: {
                        type: Type.STRING,
                      },
                    },

                    required: ['name', 'dosage', 'frequency'],
                  },
                },

                exercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                      },

                      category: {
                        type: Type.STRING,
                      },

                      target_body_part: {
                        type: Type.STRING,
                      },

                      repetitions: {
                        type: Type.STRING,
                      },

                      frequency_per_day: {
                        type: Type.NUMBER,
                      },

                      duration_minutes: {
                        type: Type.NUMBER,
                      },

                      instructions: {
                        type: Type.STRING,
                      },

                      precautions: {
                        type: Type.STRING,
                      },
                    },

                    required: ['title', 'instructions'],
                  },
                },

                appointments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      doctor_name: {
                        type: Type.STRING,
                      },

                      specialty: {
                        type: Type.STRING,
                      },

                      hospital_clinic: {
                        type: Type.STRING,
                      },

                      date_time: {
                        type: Type.STRING,
                      },

                      purpose: {
                        type: Type.STRING,
                      },

                      phone: {
                        type: Type.STRING,
                      },
                    },

                    required: ['doctor_name', 'purpose'],
                  },
                },

                detected_conflicts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                      },

                      severity: {
                        type: Type.STRING,
                      },

                      description: {
                        type: Type.STRING,
                      },

                      source_documents: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.STRING,
                        },
                      },

                      recommendation: {
                        type: Type.STRING,
                      },
                    },

                    required: ['title', 'description', 'severity'],
                  },
                },
              },

              required: [
                'hospital_name',
                'patient_name',
                'diagnosis',
                'medications',
                'warning_signs',
              ],
            },
          },
        });

        if (response.text) {
          parsedData = JSON.parse(response.text);
          break;
        }
      } catch (err: any) {
        lastError = err;

        console.warn(
          `Extraction model ${modelName} failed, trying next candidate:`,
          err.message || err,
        );
      }
    }

    if (!parsedData) {
      throw lastError || new Error('All document-analysis models failed.');
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/extract-discharge:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Discharge extraction failed',
    });
  }
});

// ============================================================
// 2. Multi-turn Chat Assistant Endpoint
// ============================================================

app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages,
      userContext,
      language = 'en',
      stream = false,
    } = req.body;

    const languageDirective =
      language === 'hi'
        ? `CRITICAL LANGUAGE REQUIREMENT: Reply exclusively in natural Hindi using Devanagari script.`
        : language === 'gu'
          ? `CRITICAL LANGUAGE REQUIREMENT: Reply exclusively in natural Gujarati using Gujarati script.`
          : `CRITICAL LANGUAGE REQUIREMENT: Reply clearly and naturally in English.`;

    const systemInstruction = `You are "RecoveryNav Assistant", a compassionate, highly knowledgeable post-hospital recovery and healthcare guide.

Patient Context:
${JSON.stringify(userContext || {})}

${languageDirective}

Answer the user's actual question directly. Sound like a helpful ChatGPT-style assistant: natural, warm, concise, and human — never robotic or like a database.

RESPONSE FORMAT:
- Use a short, useful title when it improves clarity. Format it as a single Markdown heading using "# Title" (NOT "##").
- Use **bold** for important words or short phrases.
- Use "- " bullets for lists.
- Use numbered lists when steps are needed.
- Add an appropriate emoji only where it genuinely improves readability or reassurance; do not add emojis to every line.
- Leave a blank line between sections.
- NEVER output raw Markdown escape sequences such as "\\*\\*" or "\\#". Use normal Markdown syntax.
- NEVER put headings like "##" or "###" in the response.
- Do not start with filler such as "Sure!" unless it is natural.
- Keep the answer easy to scan on a phone.

MEDICAL SAFETY:
- Personalize medication/surgery answers using the supplied context.
- Do not invent patient-specific facts, doses, diagnoses, or instructions that are absent from context.
- For urgent symptoms, clearly recommend contacting the treating clinician or emergency services.
- If the question is general medical information, state relevant limitations briefly when needed.
`;

    const formattedContents = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || '' }],
    }));

    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    if (stream) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();

      let lastError: any = null;
      let sentAny = false;

      for (const modelName of candidateModels) {
        try {
          const streamResponse = await ai.models.generateContentStream({
            model: modelName,
            contents: formattedContents,
            config: { systemInstruction },
          });

          for await (const chunk of streamResponse) {
            const textChunk = chunk.text || '';
            if (!textChunk) continue;
            sentAny = true;
            res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
          }

          if (sentAny) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
            return;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Streaming model ${modelName} failed, trying next candidate:`, err.message || err);
        }
      }

      res.write(`data: ${JSON.stringify({ error: lastError?.message || 'All AI models unavailable' })}\n\n`);
      res.end();
      return;
    }

    let replyText = '';
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: formattedContents,
          config: { systemInstruction },
        });

        if (response.text) {
          replyText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed, trying next candidate:`, err.message || err);
      }
    }

    if (!replyText) throw lastError || new Error('All AI models unavailable');

    return res.json({ success: true, reply: replyText });
  } catch (error: any) {
    console.error('Error in /api/gemini/chat:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Chat request failed',
      });
    }

    res.end();
  }
});


// ============================================================
// 3. Text to Speech (TTS) using gemini-3.8-flash-tts
// ============================================================

app.post('/api/gemini/tts', async (req: Request, res: Response) => {
  try {
    const {
      text,
      language = 'en',
    } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Text is required for TTS',
      });
    }

    // Normal conversational voice.
    // Explicitly avoid soft, whispery, overly gentle, dramatic,
    // or soothing delivery.

    const voicePrompt =
      language === 'hi'
        ? `सामान्य बातचीत जैसी स्पष्ट, प्राकृतिक और आत्मविश्वासपूर्ण आवाज़ में बोलें। बहुत धीमी, फुसफुसाती, अत्यधिक नरम या भावुक आवाज़ का उपयोग न करें: ${text}`
        : language === 'gu'
          ? `સામાન્ય વાતચીત જેવી સ્પષ્ટ, કુદરતી અને આત્મવિશ્વાસપૂર્ણ અવાજમાં બોલો. ખૂબ ધીમો, ફૂસફૂસાટવાળો અથવા અતિશય નરમ અવાજ ન રાખો: ${text}`
          : `Speak naturally, clearly, and confidently in a normal conversational voice. Do not use a soft, whispery, overly gentle, dramatic, or soothing tone: ${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',

      contents: [
        {
          role: 'user',
          parts: [
            {
              text: voicePrompt,

              // IMPORTANT:
              // This used to say "gentle, compassionate".
              // It is intentionally changed to a normal,
              // confident conversational voice.
              speechMetadata: {
                style:
                  'Clear, natural, confident conversational voice assistant. Use a normal speaking tone, not soft, whispery, overly gentle, or soothing.',
              },
            },
          ],
        },
      ],

      config: {
        responseModalities: ['AUDIO'],

        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (base64Audio) {
      return res.json({
        success: true,
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'No audio generated',
      });
    }
  } catch (error: any) {
    console.error('Error in /api/gemini/tts:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// 4. Voice Command Interpreter Endpoint
// ============================================================

app.post(
  '/api/gemini/interpret-voice-command',
  async (req: Request, res: Response) => {
    try {
      const {
        transcript,
        language = 'en',
      } = req.body;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',

        contents: `You are an intent parser for a medical recovery application.

User speech transcript (could be in English, Hindi, or Gujarati): "${transcript}"

Language: ${language}

Map this transcript to one of the following actions:

- NAVIGATE (target: 'home' | 'medications' | 'exercises' | 'appointments' | 'scanner' | 'symptoms' | 'emergency' | 'wellness' | 'settings' | 'audit')
- LOG_MEDICATION (medicationName: string, taken: boolean)
- LOG_EXERCISE (exerciseTitle: string, completed: boolean)
- SET_REMINDER (reminderText: string, time: string)
- ASK_INFO (question: string)
- CALL_EMERGENCY ()

Provide a JSON object with:

{
  "action": string,
  "parameters": object,
  "spokenFeedback": string (a short, comforting confirmation message to speak back to the user in ${language})
}`,

        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      return res.json({
        success: true,
        intent: parsed,
      });
    } catch (error: any) {
      console.error(
        'Error in interpret-voice-command:',
        error,
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// ============================================================
// 5. Conflict Detection Engine Endpoint
// ============================================================

app.post(
  '/api/gemini/detect-conflicts',
  async (req: Request, res: Response) => {
    try {
      const {
        medications,
        exercises,
        instructions,
      } = req.body;

      const prompt = `Perform clinical safety conflict and drug-drug interaction screening on these post-discharge items:

Medications: ${JSON.stringify(medications || [])}

Exercises: ${JSON.stringify(exercises || [])}

Instructions: ${instructions || 'Sternal precautions, low sodium diet'}

Identify:

1. Potential contraindications (e.g. NSAID with Aspirin, Beta blockers with low heart rate).
2. Exercise risks against surgical wound healing.
3. Dietary conflicts.

Output strict JSON with an array of conflicts (title, severity: 'CRITICAL'|'WARNING'|'INFO', description, recommendation).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',

        contents: prompt,

        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '[]');

      return res.json({
        success: true,
        conflicts: parsed,
      });
    } catch (error: any) {
      console.error(
        'Error in detect-conflicts:',
        error,
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// ============================================================
// Vite Middleware for Development Mode
// ============================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const {
      createServer: createViteServer,
    } = await import('vite');

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },

      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(
      express.static(
        path.join(__dirname, 'dist'),
      ),
    );

    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(
        path.join(
          __dirname,
          'dist',
          'index.html',
        ),
      );
    });
  }

  app.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `RecoveryNav server running on port ${PORT}`,
      );
    },
  );
}

startServer().catch((err) => {
  console.error(
    'Failed to start server:',
    err,
  );
});